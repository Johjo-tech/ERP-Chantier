/**
 * Client de la plateforme de dématérialisation (SuperPDP).
 *
 * Portage de `_shared/superpdp.ts` de facturation-tpe, adapté au modèle de
 * données d'ERP-Chantier. La correspondance vaut d'être écrite une fois :
 *
 *   superpdp_connections   →  pdp_connexions + pdp_connexion_secrets
 *   superpdp_oauth_states  →  pdp_oauth_etats
 *   organizations          →  societes
 *   invoices               →  factures
 *   invoice_events         →  facture_cycle_vie
 *   integration_runs       →  integration_journal
 *   ereporting_submissions →  ereporting_depots
 *
 * Une différence de fond : là-bas, jetons et état de connexion vivaient dans la
 * même ligne. Ici les jetons sont isolés dans `pdp_connexion_secrets`, sans
 * aucune politique RLS — hors de portée de l'application, réservés au
 * `service_role`. L'écran lit l'état dans `pdp_connexions`, jamais le secret.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ReconnectRequiredError,
  TransientRefreshError,
  getOrgAccessToken,
  type ConnectionSnapshot,
  type RefreshResult,
  type TokenStore,
} from "./oauth-core.ts";

export { ReconnectRequiredError, TransientRefreshError };
export { oauthStateExpired } from "./oauth-core.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Client agissant au nom de l'utilisateur : la RLS s'applique. */
export function userClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    }
  );
}

/** Client de service : contourne la RLS. Seul chemin vers les jetons. */
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

export type Environnement = "sandbox" | "production";

export function normaliserEnv(valeur: unknown): Environnement {
  return String(valeur ?? "").toLowerCase() === "production" ? "production" : "sandbox";
}

/**
 * Les identifiants, par environnement.
 *
 * En production il n'existe **aucun jeton global** : chaque société passe par
 * `authorization_code`. Un jeton statique y donnerait à toutes les sociétés la
 * même identité d'émetteur — ce qui n'a pas de sens sur une facture.
 */
export function configPdp(env: Environnement = "sandbox") {
  const baseDefaut = Deno.env.get("SUPERPDP_BASE_URL") ?? "https://api.superpdp.tech";

  if (env === "production") {
    const clientId = Deno.env.get("SUPERPDP_PROD_CLIENT_ID");
    const clientSecret = Deno.env.get("SUPERPDP_PROD_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error(
        "Plateforme non configurée en production. Ajoutez SUPERPDP_PROD_CLIENT_ID et SUPERPDP_PROD_CLIENT_SECRET."
      );
    }
    return {
      env,
      token: undefined as string | undefined,
      clientId,
      clientSecret,
      baseUrl: Deno.env.get("SUPERPDP_PROD_BASE_URL") ?? baseDefaut,
    };
  }

  const token = Deno.env.get("SUPERPDP_API_TOKEN");
  const clientId =
    Deno.env.get("SUPERPDP_SANDBOX_CLIENT_ID") ?? Deno.env.get("SUPERPDP_CLIENT_ID");
  const clientSecret =
    Deno.env.get("SUPERPDP_SANDBOX_CLIENT_SECRET") ?? Deno.env.get("SUPERPDP_CLIENT_SECRET");

  if (!token && (!clientId || !clientSecret)) {
    throw new Error(
      "Plateforme non configurée en bac à sable. Ajoutez SUPERPDP_SANDBOX_CLIENT_ID et SUPERPDP_SANDBOX_CLIENT_SECRET, ou SUPERPDP_API_TOKEN."
    );
  }
  return {
    env,
    token,
    clientId,
    clientSecret,
    baseUrl: Deno.env.get("SUPERPDP_SANDBOX_BASE_URL") ?? baseDefaut,
  };
}

/** L'environnement d'une société, bac à sable par défaut. */
export async function envSociete(societeId: string | null | undefined): Promise<Environnement> {
  if (!societeId) return "sandbox";
  try {
    const { data } = await adminClient()
      .from("pdp_connexions")
      .select("environnement")
      .eq("societe_id", societeId)
      .maybeSingle();
    return normaliserEnv(data?.environnement);
  } catch {
    return "sandbox";
  }
}

let jetonGlobal: { valeur: string; expireLe: number } | null = null;

/**
 * Jeton `client_credentials` — **bac à sable uniquement**.
 *
 * Il vaut pour le compte principal et ses sociétés fictives. En production, une
 * société qui n'a pas délégué par `authorization_code` ne peut rien faire, et
 * c'est voulu.
 */
async function jetonApplicatif(): Promise<string> {
  const { token, clientId, clientSecret, baseUrl } = configPdp("sandbox");

  if (clientId && clientSecret) {
    if (jetonGlobal && jetonGlobal.expireLe > Date.now() + 30_000) return jetonGlobal.valeur;

    const reponse = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok || typeof corps?.access_token !== "string") {
      throw new Error(
        reponse.status === 401
          ? "Identifiants OAuth refusés. Vérifiez SUPERPDP_SANDBOX_CLIENT_ID et son secret."
          : `Jeton de plateforme indisponible (HTTP ${reponse.status}).`
      );
    }
    jetonGlobal = {
      valeur: corps.access_token,
      expireLe: Date.now() + Number(corps.expires_in ?? 300) * 1000,
    };
    return jetonGlobal.valeur;
  }

  if (!token) throw new Error("SUPERPDP_API_TOKEN non configuré.");
  return token;
}

/** Passé ce délai, un bail est tenu pour abandonné : son détenteur est mort. */
const BAIL_TTL_MS = 30_000;

/**
 * Le magasin de jetons, à cheval sur deux tables.
 *
 * `pdp_connexions` porte ce que l'application peut voir ; `pdp_connexion_secrets`
 * porte ce qu'elle ne doit jamais voir. La jointure se fait ici, côté service.
 */
function magasinJetons(): TokenStore {
  const admin = adminClient();

  async function lire(societeId: string): Promise<ConnectionSnapshot | null> {
    const { data } = await admin
      .from("pdp_connexions")
      .select("id, etat, environnement, pdp_connexion_secrets(access_token, refresh_token, expire_le)")
      .eq("societe_id", societeId)
      .maybeSingle();
    if (!data) return null;

    const secret = (Array.isArray(data.pdp_connexion_secrets)
      ? data.pdp_connexion_secrets[0]
      : data.pdp_connexion_secrets) as
      | { access_token: string | null; refresh_token: string | null; expire_le: string | null }
      | null;

    return {
      access_token: secret?.access_token ?? null,
      refresh_token: secret?.refresh_token ?? null,
      expires_at: secret?.expire_le ?? null,
      // Le vocabulaire du socle OAuth reste le sien ; la traduction se fait ici.
      status: data.etat === "reconnexion_requise" ? "reconnect_required" : data.etat,
      env: data.environnement,
    };
  }

  async function idConnexion(societeId: string): Promise<string | null> {
    const { data } = await admin
      .from("pdp_connexions")
      .select("id")
      .eq("societe_id", societeId)
      .maybeSingle();
    return (data?.id as string) ?? null;
  }

  return {
    read: lire,

    async acquireLease(societeId) {
      const id = await idConnexion(societeId);
      if (!id) return null;

      /* `update` conditionnel : atomique côté Postgres. Sous READ COMMITTED,
         une invocation concurrente attend le verrou de ligne puis réévalue le
         `where` sur la ligne déjà modifiée — zéro ligne si le bail vient
         d'être pris. C'est ce qui sérialise sans verrou applicatif. */
      const limite = new Date(Date.now() - BAIL_TTL_MS).toISOString();
      const { data } = await admin
        .from("pdp_connexion_secrets")
        .update({ bail_refresh: new Date().toISOString() })
        .eq("connexion_id", id)
        .or(`bail_refresh.is.null,bail_refresh.lt.${limite}`)
        .select("connexion_id")
        .maybeSingle();

      // Le bail pris, on relit l'état complet : un rafraîchissement a pu
      // aboutir entre notre lecture et l'acquisition.
      return data ? await lire(societeId) : null;
    },

    async saveTokens(societeId, jetons) {
      const id = await idConnexion(societeId);
      if (!id) return;
      await admin
        .from("pdp_connexion_secrets")
        .update({
          access_token: jetons.access_token,
          // Rotation obligatoire : le nouveau remplace toujours l'ancien, déjà
          // invalidé par la plateforme.
          refresh_token: jetons.refresh_token,
          expire_le: jetons.expires_at,
          bail_refresh: null,
          dernier_refresh_le: new Date().toISOString(),
          maj_le: new Date().toISOString(),
        })
        .eq("connexion_id", id);
      await admin
        .from("pdp_connexions")
        .update({ etat: "connecte", message: null, maj_le: new Date().toISOString() })
        .eq("id", id);
    },

    async markReconnectRequired(societeId) {
      const id = await idConnexion(societeId);
      if (!id) return;
      await admin
        .from("pdp_connexion_secrets")
        .update({ bail_refresh: null })
        .eq("connexion_id", id);
      await admin
        .from("pdp_connexions")
        .update({
          etat: "reconnexion_requise",
          message: "La délégation a expiré : reconnectez la société à la plateforme.",
          maj_le: new Date().toISOString(),
        })
        .eq("id", id);
    },

    async releaseLease(societeId) {
      const id = await idConnexion(societeId);
      if (!id) return;
      await admin
        .from("pdp_connexion_secrets")
        .update({ bail_refresh: null })
        .eq("connexion_id", id);
    },
  };
}

/** Rafraîchit un jeton avec les identifiants de SON environnement. */
async function rafraichir(
  refreshToken: string,
  snapshot: ConnectionSnapshot
): Promise<RefreshResult> {
  const { clientId, clientSecret, baseUrl } = configPdp(normaliserEnv(snapshot.env));
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "transient", detail: "identifiants OAuth absents" };
  }

  const reponse = await fetch(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const corps = await reponse.json().catch(() => ({}));

  if (reponse.ok && typeof corps?.access_token === "string") {
    return {
      ok: true,
      access_token: corps.access_token,
      refresh_token: corps.refresh_token ?? null,
      expires_in: Number(corps.expires_in ?? 3600),
    };
  }
  // `invalid_grant` n'est pas une panne : la délégation est morte.
  if (reponse.status === 400 && corps?.error === "invalid_grant") {
    return { ok: false, reason: "invalid_grant" };
  }
  return { ok: false, reason: "transient", detail: `HTTP ${reponse.status}` };
}

/** Le jeton d'une société : le sien s'il a délégué, sinon celui de l'application. */
export async function jetonSociete(
  societeId: string | null | undefined,
  options: { forcerRefresh?: boolean } = {}
): Promise<string> {
  if (societeId) {
    const propre = await getOrgAccessToken(
      {
        store: magasinJetons(),
        refresh: rafraichir,
        now: () => Date.now(),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      },
      societeId,
      { forceRefresh: options.forcerRefresh }
    );
    if (propre) return propre;
  }
  // Pas de délégation : le bac à sable tolère le jeton applicatif, la
  // production le refuse — `configPdp` y lève avant d'en arriver là.
  return jetonApplicatif();
}

export interface OptionsAppel {
  methode?: string;
  corps?: unknown;
  entetes?: Record<string, string>;
  societeId?: string | null;
  /** Agir au nom d'une société tierce, quand la plateforme le permet. */
  incarner?: string | null;
}

/**
 * Un appel à la plateforme, avec une seule reprise sur 401.
 *
 * Le 401 arrive quand le jeton a expiré entre sa lecture et l'appel : on
 * rafraîchit une fois, on rejoue, et on s'arrête là. Réessayer en boucle sur
 * une délégation morte ne ferait que masquer le vrai message.
 */
export async function appelPdp(chemin: string, options: OptionsAppel = {}): Promise<Response> {
  const env = await envSociete(options.societeId);
  const { baseUrl } = configPdp(env);

  async function tenter(jeton: string): Promise<Response> {
    const entetes: Record<string, string> = {
      Authorization: `Bearer ${jeton}`,
      Accept: "application/json",
      ...(options.entetes ?? {}),
    };
    if (options.incarner) entetes["X-Company-Id"] = options.incarner;
    if (options.corps !== undefined && !entetes["Content-Type"]) {
      entetes["Content-Type"] = "application/json";
    }

    return fetch(`${baseUrl}${chemin}`, {
      method: options.methode ?? (options.corps !== undefined ? "POST" : "GET"),
      headers: entetes,
      body:
        options.corps === undefined
          ? undefined
          : typeof options.corps === "string"
            ? options.corps
            : JSON.stringify(options.corps),
    });
  }

  const reponse = await tenter(await jetonSociete(options.societeId));
  if (reponse.status !== 401) return reponse;
  return tenter(await jetonSociete(options.societeId, { forcerRefresh: true }));
}

/** Les libellés du cycle de vie, tels que l'écran doit les montrer. */
export const LIBELLES_CYCLE: Record<string, string> = {
  brouillon: "Brouillon",
  deposee: "Déposée",
  recue: "Reçue par le destinataire",
  approuvee: "Approuvée",
  refusee: "Refusée",
  paiement_transmis: "Paiement transmis",
  encaissee: "Encaissée",
  rejetee: "Rejetée",
  suspendue: "Suspendue",
};

export interface Execution {
  societeId?: string | null;
  operation: string;
  cibleType?: string | null;
  cibleId?: string | null;
  statut: "succes" | "echec";
  codeHttp?: number | null;
  message?: string | null;
  requete?: unknown;
  reponse?: unknown;
  dureeMs?: number | null;
}

/**
 * Trace d'une opération vers la plateforme.
 *
 * Un échec de journalisation n'a jamais à faire échouer l'opération elle-même :
 * on trace, on n'arbitre pas.
 */
export async function journaliser(execution: Execution): Promise<void> {
  try {
    await adminClient().from("integration_journal").insert({
      societe_id: execution.societeId ?? null,
      operation: execution.operation,
      cible_type: execution.cibleType ?? null,
      cible_id: execution.cibleId ?? null,
      statut: execution.statut,
      code_http: execution.codeHttp ?? null,
      message: execution.message ?? null,
      requete: execution.requete ?? null,
      reponse: execution.reponse ?? null,
      duree_ms: execution.dureeMs ?? null,
    });
  } catch (err) {
    console.error("Journal d'intégration indisponible", err);
  }
}

/** L'identifiant de la société sur la plateforme, s'il a été enregistré. */
export async function identifiantPlateforme(societeId: string): Promise<string | null> {
  const { data } = await adminClient()
    .from("pdp_connexions")
    .select("pdp_company_id")
    .eq("societe_id", societeId)
    .maybeSingle();
  return (data?.pdp_company_id as string) ?? null;
}

/**
 * Le numéro de vendeur retenu lors de la délégation.
 *
 * La plateforme n'accepte que des factures dont le vendeur correspond au compte
 * connecté : c'est ce numéro qui fait foi, pas le SIREN saisi dans les réglages.
 */
export async function numeroVendeur(societeId: string): Promise<string | null> {
  const { data } = await adminClient()
    .from("pdp_connexions")
    .select("pdp_seller_number")
    .eq("societe_id", societeId)
    .maybeSingle();
  return (data?.pdp_seller_number as string) ?? null;
}

/**
 * L'identité de la société sur la plateforme, lue depuis la session elle-même.
 *
 * Une session `authorization_code` vaut pour exactement une société : c'est la
 * source la plus sûre. La déduire des factures laisserait une société neuve
 * sans identité — elle n'en a encore émis aucune.
 */
export interface IdentitePlateforme {
  companyId: string | null;
  companyNumber: string | null;
  source: string | null;
}

function extraire(objet: unknown, chemins: string[]): string | null {
  for (const chemin of chemins) {
    let courant: unknown = objet;
    for (const cle of chemin.split(".")) {
      if (courant == null) break;
      courant = Array.isArray(courant) ? courant[Number(cle)] : (courant as Record<string, unknown>)[cle];
    }
    if (typeof courant === "string" && courant) return courant;
    if (typeof courant === "number") return String(courant);
  }
  return null;
}

export async function identiteSociete(societeId: string): Promise<IdentitePlateforme> {
  const vues: Record<string, unknown> = {};

  const sonder = async (
    chemin: string,
    cheminsId: string[],
    cheminsNumero: string[]
  ): Promise<IdentitePlateforme | null> => {
    try {
      const reponse = await appelPdp(chemin, { societeId });
      const corps = await reponse.json().catch(() => null);
      vues[chemin] = {
        statut: reponse.status,
        cles: corps && typeof corps === "object" ? Object.keys(corps) : null,
      };
      if (!reponse.ok || !corps) return null;
      const companyId = extraire(corps, cheminsId);
      const companyNumber = extraire(corps, cheminsNumero);
      if (!companyId && !companyNumber) return null;
      return { companyId, companyNumber, source: chemin };
    } catch (e) {
      vues[chemin] = { erreur: e instanceof Error ? e.message : String(e) };
      return null;
    }
  };

  const trouve =
    (await sonder(
      "/v1.beta/directory_entries",
      ["data.0.company.id", "data.0.company_id"],
      ["data.0.company.number", "data.0.identifier"]
    )) ?? (await sonder("/v1.beta/invoices?limit=1", ["data.0.company_id"], []));

  const identite = trouve ?? { companyId: null, companyNumber: null, source: null };

  await journaliser({
    societeId,
    operation: "identite_societe",
    statut: identite.companyId || identite.companyNumber ? "succes" : "echec",
    message: identite.source ? `source : ${identite.source}` : "identité introuvable",
    reponse: vues,
  });

  if (identite.companyId || identite.companyNumber) {
    await adminClient()
      .from("pdp_connexions")
      .update({
        pdp_company_id: identite.companyId,
        pdp_seller_number: identite.companyNumber,
        maj_le: new Date().toISOString(),
      })
      .eq("societe_id", societeId);
  }

  return identite;
}
