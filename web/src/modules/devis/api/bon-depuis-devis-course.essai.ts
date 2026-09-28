import { describe, expect, it, vi } from "vitest";

/**
 * DEF-REP-15, D-REP-15 : deux onglets créaient deux bons depuis le même devis — le
 * contrôle « déjà lié » passait des deux côtés. L'index unique proposé
 * (20260928200002) refuse le second INSERT (23505) ; l'écran doit alors dire la même
 * chose que s'il était arrivé après, avec le numéro du bon créé par l'autre onglet.
 */
const lectures = vi.hoisted(() => ({ n: 0 }));

function requete(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: () => q,
    maybeSingle: () => Promise.resolve({ data: table === "v_devis_totaux" ? { ht: 100 } : null, error: null }),
    single: () => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"bons_commande_un_par_devis\"" } }),
    // Premier contrôle : aucun bon ; relu après le refus de l'index : celui de l'autre onglet.
    then: (ok: (r: unknown) => unknown) =>
      Promise.resolve({ data: lectures.n++ === 0 ? [] : [{ id: "b-autre", numero_bc: "En attente de BC", numero_interne: "BC-2026-000042" }], error: null }).then(ok),
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({ supabase: () => ({ from: requete }) }));
vi.mock("./devis", () => ({
  lireDevis: vi.fn(async () => ({
    client_id: "c1", client_nom: "OPAC", interlocuteur: null, adresse_locataire: "1 rue", code_postal: "69001", ville: "Lyon",
    logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, conducteur_id: null,
    lignes: [],
  })),
}));
vi.mock("@/modules/documents/api/lignes", () => ({ synchroniserLignes: vi.fn(async () => undefined) }));

const { bonDepuisDevis } = await import("./operations");

describe("bon depuis un devis : deux onglets", () => {
  it("le second reçoit « déjà lié au bon BC-… », pas l'erreur technique de l'index", async () => {
    const erreur = await bonDepuisDevis("s1", "d1").catch((e: unknown) => e);
    expect(erreur).toEqual({ code: "P0001", message: "Ce devis est déjà lié au bon de commande BC-2026-000042. Ouvrez-le directement pour le modifier." });
  });
});
