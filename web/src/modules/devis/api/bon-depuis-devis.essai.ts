import { describe, expect, it, vi } from "vitest";
import { EnregistrementPartiel } from "@/modules/commandes/api/bons";

/**
 * Relecture 4, I7 : si les lignes échouent après la création du bon, le bon
 * existe (lié au devis, montant posé) et un nouvel essai est refusé « déjà
 * lié ». L'erreur doit donc porter l'id du bon, pour l'ouvrir et le compléter.
 */
function requete(donnees: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    insert: () => q,
    maybeSingle: () => Promise.resolve({ data: donnees, error: null }),
    single: () => Promise.resolve({ data: { id: "bon-cree" }, error: null }),
    then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({ supabase: () => ({ from: (t: string) => requete(t === "v_devis_totaux" ? { ht: 100 } : null) }) }));
vi.mock("./devis", () => ({
  lireDevis: vi.fn(async () => ({
    client_id: "c1", client_nom: "OPAC", interlocuteur: null, adresse_locataire: "1 rue", code_postal: "69001", ville: "Lyon",
    logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, conducteur_id: null,
    lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Peinture", quantite: 1, prix_unitaire: 100, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null }],
  })),
}));
vi.mock("@/modules/documents/api/lignes", () => ({
  synchroniserLignes: vi.fn(async () => {
    throw { code: "42501", message: "refus" };
  }),
}));

const { bonDepuisDevis } = await import("./operations");

describe("bon depuis un devis : lignes refusées", () => {
  it("l'erreur porte l'id du bon créé, pour l'ouvrir au lieu de le perdre", async () => {
    const erreur = await bonDepuisDevis("s1", "d1").catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(EnregistrementPartiel);
    expect((erreur as EnregistrementPartiel).bonId).toBe("bon-cree");
  });
});
