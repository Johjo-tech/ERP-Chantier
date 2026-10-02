// Machine à états du jeton OAuth 2.1, par société.
//
// Portage de `_shared/oauth-core.ts` de facturation-tpe, sans dépendance Deno ni
// Supabase — ce qui le rend testable sous vitest comme n'importe quel module du
// dépôt, et c'est délibéré : une erreur ici casse la connexion d'un client.
//
// Le point dur : la plateforme fait tourner le jeton de rafraîchissement à
// CHAQUE usage, l'ancien étant aussitôt invalidé. Deux rafraîchissements
// concurrents pour la même société détruisent donc la connexion. On sérialise
// par un bail pris en `update` conditionnel atomique : le détenteur rafraîchit,
// les autres attendent puis relisent le jeton frais.

export interface ConnectionSnapshot {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  status: string | null;
  /** Environnement la plateforme ayant émis les jetons ('sandbox' | 'production'). */
  env?: string | null;
}

export type RefreshResult =
  | { ok: true; access_token: string; refresh_token: string | null; expires_in: number }
  | { ok: false; reason: "invalid_grant" | "transient"; detail?: string };

export interface TokenStore {
  /** État courant de la connexion du société (null si jamais connecté). */
  read(societeId: string): Promise<ConnectionSnapshot | null>;
  /**
   * Prend le bail de refresh par UPDATE conditionnel atomique (bail absent ou
   * périmé). Retourne l'état de la ligne APRÈS acquisition — donc le
   * refresh_token à jour si un autre refresh vient d'aboutir — ou null si le
   * bail est détenu par une autre invocation.
   */
  acquireLease(societeId: string): Promise<ConnectionSnapshot | null>;
  /** Écrit le nouveau couple de jetons, repasse en 'connected', libère le bail. */
  saveTokens(
    societeId: string,
    tokens: { access_token: string; refresh_token: string | null; expires_at: string },
  ): Promise<void>;
  /** Refresh_token rejeté : marque 'reconnect_required' et libère le bail. */
  markReconnectRequired(societeId: string): Promise<void>;
  /** Échec transitoire : libère le bail sans toucher aux jetons. */
  releaseLease(societeId: string): Promise<void>;
}

export interface OAuthCoreDeps {
  store: TokenStore;
  /** Le snapshot porte l'environnement : le refresh doit utiliser SES identifiants. */
  refresh(refreshToken: string, snapshot: ConnectionSnapshot): Promise<RefreshResult>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** La délégation du société est morte : l'utilisateur doit se reconnecter. */
export class ReconnectRequiredError extends Error {
  constructor(societeId: string) {
    super(
      `La connexion la plateforme de la société ${societeId} doit être rétablie (refresh_token invalide).`,
    );
    this.name = "ReconnectRequiredError";
  }
}

/** Échec réessayable (réseau, 5xx, attente de bail expirée). */
export class TransientRefreshError extends Error {
  constructor(detail: string) {
    super(`Refresh la plateforme momentanément impossible : ${detail}`);
    this.name = "TransientRefreshError";
  }
}

/** Marge avant expiration au-delà de laquelle on rafraîchit préventivement. */
export const EXPIRY_MARGIN_MS = 60_000;
/** Pas et durée max d'attente d'un refresh mené par une autre invocation. */
export const WAIT_STEP_MS = 400;
export const WAIT_MAX_MS = 10_000;

/**
 * Un state OAuth non consommé expire (10 min par défaut). Les lignes créées
 * avant la colonne expires_at retombent sur created_at + TTL.
 */
export function oauthStateExpired(
  st: { expires_at?: string | null; created_at?: string | null },
  nowMs: number,
  fallbackTtlMs = 10 * 60_000,
): boolean {
  const expiry = st.expires_at
    ? Date.parse(st.expires_at)
    : st.created_at
      ? Date.parse(st.created_at) + fallbackTtlMs
      : NaN;
  return Number.isFinite(expiry) && expiry < nowMs;
}

function isUsable(row: ConnectionSnapshot, nowMs: number): boolean {
  if (!row.access_token) return false;
  const exp = row.expires_at ? Date.parse(row.expires_at) : 0;
  return exp > nowMs + EXPIRY_MARGIN_MS;
}

/**
 * Retourne un access_token valide pour le société, en rafraîchissant sous bail
 * si nécessaire. `forceRefresh` traite le jeton courant comme périmé (retry
 * après un 401 amont). Retourne null si le société n'a jamais connecté son
 * compte ; lève ReconnectRequiredError si la délégation est morte.
 */
export async function getOrgAccessToken(
  deps: OAuthCoreDeps,
  societeId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  const initial = await deps.store.read(societeId);
  if (!initial || (!initial.access_token && !initial.refresh_token)) return null;
  if (initial.status === "reconnect_required") throw new ReconnectRequiredError(societeId);
  if (!opts.forceRefresh && isUsable(initial, deps.now())) return initial.access_token;
  // Ligne héritée sans refresh_token : rien à rafraîchir, on renvoie tel quel.
  if (!initial.refresh_token) return initial.access_token;

  const staleToken = initial.access_token;
  const deadline = deps.now() + WAIT_MAX_MS;

  while (true) {
    const leased = await deps.store.acquireLease(societeId);
    if (leased) {
      // Un refresh a pu aboutir entre notre lecture et l'acquisition du bail :
      // le jeton retourné par l'acquisition fait foi.
      const alreadyFresh = opts.forceRefresh
        ? leased.access_token !== staleToken && isUsable(leased, deps.now())
        : isUsable(leased, deps.now());
      if (alreadyFresh) {
        await deps.store.releaseLease(societeId);
        return leased.access_token;
      }
      if (!leased.refresh_token) {
        await deps.store.releaseLease(societeId);
        return leased.access_token;
      }

      let result: RefreshResult;
      try {
        result = await deps.refresh(leased.refresh_token, leased);
      } catch (e) {
        result = { ok: false, reason: "transient", detail: e instanceof Error ? e.message : String(e) };
      }

      if (result.ok) {
        const expiresAt = new Date(deps.now() + result.expires_in * 1000).toISOString();
        await deps.store.saveTokens(societeId, {
          access_token: result.access_token,
          // Rotation obligatoire : le nouveau refresh_token remplace TOUJOURS
          // l'ancien (déjà invalidé côté la plateforme).
          refresh_token: result.refresh_token,
          expires_at: expiresAt,
        });
        return result.access_token;
      }
      if (result.reason === "invalid_grant") {
        await deps.store.markReconnectRequired(societeId);
        throw new ReconnectRequiredError(societeId);
      }
      await deps.store.releaseLease(societeId);
      throw new TransientRefreshError(result.detail ?? "échec du refresh");
    }

    // Bail détenu ailleurs : on attend le résultat de l'autre invocation.
    if (deps.now() >= deadline) {
      throw new TransientRefreshError("attente du refresh concurrent expirée");
    }
    await deps.sleep(WAIT_STEP_MS);
    const fresh = await deps.store.read(societeId);
    if (!fresh) return null;
    if (fresh.status === "reconnect_required") throw new ReconnectRequiredError(societeId);
    const refreshedByOther = opts.forceRefresh
      ? fresh.access_token !== staleToken && isUsable(fresh, deps.now())
      : isUsable(fresh, deps.now());
    if (refreshedByOther) return fresh.access_token;
  }
}
