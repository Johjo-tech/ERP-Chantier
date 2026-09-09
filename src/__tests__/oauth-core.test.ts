// Tests de la machine à états OAuth par société (rotation obligatoire du
// refresh_token la plateforme). Exécutés par vitest — le module est pur (aucune
// API Deno), voir vite.config.ts (include supabase/functions).
import { describe, expect, it } from "vitest";
import {
  type ConnectionSnapshot,
  getOrgAccessToken,
  type OAuthCoreDeps,
  oauthStateExpired,
  ReconnectRequiredError,
  type RefreshResult,
  TransientRefreshError,
} from "../../supabase/functions/_shared/oauth-core";

const ORG = "org-1";
const LEASE_TTL_MS = 30_000;

interface MockRow extends ConnectionSnapshot {
  refresh_lease_at: number | null;
}

function makeHarness(init: Partial<MockRow>, refreshImpl?: () => Promise<RefreshResult>) {
  const row: MockRow = {
    access_token: "old-access",
    refresh_token: "rt-1",
    expires_at: new Date(Date.now() - 1000).toISOString(), // périmé par défaut
    status: "connected",
    refresh_lease_at: null,
    ...init,
  };
  let refreshCalls = 0;
  let rotation = 0;
  const deps: OAuthCoreDeps = {
    store: {
      async read() {
        const { refresh_lease_at: _l, ...snap } = row;
        return { ...snap };
      },
      async acquireLease() {
        const now = Date.now();
        if (row.refresh_lease_at !== null && now - row.refresh_lease_at < LEASE_TTL_MS) {
          return null;
        }
        row.refresh_lease_at = now;
        const { refresh_lease_at: _l, ...snap } = row;
        return { ...snap };
      },
      async saveTokens(_societeId, tokens) {
        row.access_token = tokens.access_token;
        row.refresh_token = tokens.refresh_token;
        row.expires_at = tokens.expires_at;
        row.status = "connected";
        row.refresh_lease_at = null;
      },
      async markReconnectRequired() {
        row.status = "reconnect_required";
        row.refresh_lease_at = null;
      },
      async releaseLease() {
        row.refresh_lease_at = null;
      },
    },
    refresh: async () => {
      refreshCalls += 1;
      if (refreshImpl) return await refreshImpl();
      // Simule la rotation : chaque refresh invalide l'ancien couple.
      await new Promise((r) => setTimeout(r, 5));
      rotation += 1;
      return {
        ok: true,
        access_token: `access-${rotation}`,
        refresh_token: `rt-${rotation + 1}`,
        expires_in: 1800,
      };
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
  };
  return { row, deps, refreshCalls: () => refreshCalls };
}

describe("getOrgAccessToken — refresh sous bail", () => {
  it("jeton encore valide : aucun appel réseau", async () => {
    const h = makeHarness({ expires_at: new Date(Date.now() + 600_000).toISOString() });
    const token = await getOrgAccessToken(h.deps, ORG);
    expect(token).toBe("old-access");
    expect(h.refreshCalls()).toBe(0);
  });

  it("jeton expiré : un refresh, jetons remplacés, bail libéré", async () => {
    const h = makeHarness({});
    const token = await getOrgAccessToken(h.deps, ORG);
    expect(token).toBe("access-1");
    expect(h.refreshCalls()).toBe(1);
    expect(h.row.refresh_token).toBe("rt-2");
    expect(h.row.refresh_lease_at).toBeNull();
    expect(h.row.status).toBe("connected");
  });

  it("refresh concurrent sur le même société : UN SEUL échange réseau, les deux obtiennent un jeton valide", async () => {
    const h = makeHarness({});
    const [a, b] = await Promise.all([
      getOrgAccessToken(h.deps, ORG),
      getOrgAccessToken(h.deps, ORG),
    ]);
    // La rotation rend un second échange destructeur : il ne doit pas avoir lieu.
    expect(h.refreshCalls()).toBe(1);
    expect(a).toBe("access-1");
    expect(b).toBe("access-1");
  });

  it("refresh_token invalide (invalid_grant) : société marqué à reconnecter, erreur typée", async () => {
    const h = makeHarness({}, async () => ({ ok: false, reason: "invalid_grant" }));
    await expect(getOrgAccessToken(h.deps, ORG)).rejects.toBeInstanceOf(ReconnectRequiredError);
    expect(h.row.status).toBe("reconnect_required");
    expect(h.row.refresh_lease_at).toBeNull();
    // Les appels suivants échouent immédiatement, sans nouvel essai réseau.
    await expect(getOrgAccessToken(h.deps, ORG)).rejects.toBeInstanceOf(ReconnectRequiredError);
    expect(h.refreshCalls()).toBe(1);
  });

  it("échec transitoire (réseau/5xx) : bail libéré, jetons intacts, erreur réessayable", async () => {
    const h = makeHarness({}, async () => ({ ok: false, reason: "transient", detail: "HTTP 503" }));
    await expect(getOrgAccessToken(h.deps, ORG)).rejects.toBeInstanceOf(TransientRefreshError);
    expect(h.row.refresh_token).toBe("rt-1");
    expect(h.row.refresh_lease_at).toBeNull();
    expect(h.row.status).toBe("connected");
  });

  it("bail abandonné (détenteur mort) : repris après expiration du TTL", async () => {
    const h = makeHarness({ refresh_lease_at: Date.now() - LEASE_TTL_MS - 1000 });
    const token = await getOrgAccessToken(h.deps, ORG);
    expect(token).toBe("access-1");
    expect(h.refreshCalls()).toBe(1);
  });

  it("forceRefresh : rafraîchit un jeton encore valide (retry après 401 amont)", async () => {
    const h = makeHarness({ expires_at: new Date(Date.now() + 600_000).toISOString() });
    const token = await getOrgAccessToken(h.deps, ORG, { forceRefresh: true });
    expect(token).toBe("access-1");
    expect(h.refreshCalls()).toBe(1);
  });

  it("forceRefresh concurrent : le perdant récupère le jeton du gagnant sans second échange", async () => {
    const h = makeHarness({ expires_at: new Date(Date.now() + 600_000).toISOString() });
    const [a, b] = await Promise.all([
      getOrgAccessToken(h.deps, ORG, { forceRefresh: true }),
      getOrgAccessToken(h.deps, ORG, { forceRefresh: true }),
    ]);
    expect(h.refreshCalls()).toBe(1);
    expect(a).toBe("access-1");
    expect(b).toBe("access-1");
  });

  it("société jamais connecté : null, aucun appel réseau", async () => {
    const h = makeHarness({ access_token: null, refresh_token: null });
    expect(await getOrgAccessToken(h.deps, ORG)).toBeNull();
    expect(h.refreshCalls()).toBe(0);
  });

  it("ligne héritée sans refresh_token : renvoyée telle quelle", async () => {
    const h = makeHarness({ refresh_token: null });
    expect(await getOrgAccessToken(h.deps, ORG)).toBe("old-access");
    expect(h.refreshCalls()).toBe(0);
  });
});

describe("oauthStateExpired — TTL des states du callback", () => {
  const now = Date.now();

  it("state frais (expires_at futur) : accepté", () => {
    expect(oauthStateExpired({ expires_at: new Date(now + 60_000).toISOString() }, now)).toBe(false);
  });

  it("state expiré (expires_at passé) : rejeté", () => {
    expect(oauthStateExpired({ expires_at: new Date(now - 1000).toISOString() }, now)).toBe(true);
  });

  it("ligne d'avant la colonne expires_at : created_at + 10 min fait foi", () => {
    expect(oauthStateExpired({ created_at: new Date(now - 11 * 60_000).toISOString() }, now)).toBe(true);
    expect(oauthStateExpired({ created_at: new Date(now - 5 * 60_000).toISOString() }, now)).toBe(false);
  });

  it("dates illisibles : non expiré (le state reste à usage unique)", () => {
    expect(oauthStateExpired({ expires_at: "n/a" }, now)).toBe(false);
    expect(oauthStateExpired({}, now)).toBe(false);
  });
});
