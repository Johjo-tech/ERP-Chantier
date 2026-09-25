/**
 * Rapport → devis / facture par la VOIE UNIQUE (`interventions/api/transformations.ts`,
 * D-CLI-09) contre la base LOCALE : lien au rapport posé dès l'INSERT, lignes
 * lues par la règle du module devis, gardes « déjà transformé » et « rapport
 * lié à un bon ». Tout ce qui est créé est retiré.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({
  supabase: () => courant.client,
  supabasePropositions: () => courant.client,
  clientPlanning: (c?: unknown) => c ?? courant.client,
  clientTransversal: (c?: unknown) => c ?? courant.client,
}));

const { enregistrerRapport, lireRapport, supprimerRapport } = await import("../../src/modules/interventions/api/rapports");
const { devisDepuisRapport, factureDepuisRapport } = await import("../../src/modules/interventions/api/transformations");
const { saisieInitiale } = await import("../../src/modules/interventions/domain/assistant");

const OPAC = "a2000000-0000-0000-0000-000000000001";
let admin: Client;
const ids = { rapports: [] as string[], devis: [] as string[], factures: [] as string[] };

async function unRapport(preconisations: string, bonId: string | null = null) {
  const id = await enregistrerRapport(
    ALPHA,
    null,
    { ...saisieInitiale("2026-09-25", "09:30", null), client_id: OPAC, client_nom: "OPAC du Rhône", metier: "plomberie", constatations: "Fuite sous évier", preconisations, logement_statut: "vacant", occupant: "Ne doit pas partir", ancien_locataire: "M. Ancien" },
    [],
    {},
    null,
    admin
  );
  ids.rapports.push(id);
  if (bonId) await admin.from("interventions").update({ bon_commande_id: bonId } as never).eq("id", id);
  return (await lireRapport(id, admin)).rapport;
}

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
  courant.client = admin;
});

afterAll(async () => {
  if (!admin) return;
  for (const [table, liste] of [["devis", ids.devis], ["factures", ids.factures]] as const) {
    const { error } = await admin.from(table).delete().in("id", liste);
    if (error) console.warn(`Nettoyage des ${table} d'essai incomplet :`, error);
  }
  for (const id of ids.rapports) await supprimerRapport(id, admin).catch((e: unknown) => console.warn("Rapport d'essai non retiré :", e));
});

describe("rapport → devis / facture, une seule voie (D-CLI-09)", () => {
  it("le devis naît lié au rapport, ses lignes lues par la règle du devis, le logement nettoyé ; pas de second devis", async () => {
    const r = await unRapport("Reprise enduit x3,5 m²\nJoint silicone");
    const id = await devisDepuisRapport(ALPHA, r);
    ids.devis.push(id);
    const d = (await admin.from("devis").select("intervention_id, statut, logement_statut, occupant, ancien_locataire, devis_lignes(designation, quantite, unite, prix_unitaire)").eq("id", id).single()).data;
    expect(d).toMatchObject({ intervention_id: r.id, statut: "brouillon", logement_statut: "vacant", occupant: null, ancien_locataire: "M. Ancien" });
    expect(d?.devis_lignes.map((l) => [l.designation, Number(l.quantite), l.unite, Number(l.prix_unitaire)]).sort()).toEqual([["Joint silicone", 1, "u", 0], ["Reprise enduit", 3.5, "m²", 0]]);
    await expect(devisDepuisRapport(ALPHA, r)).rejects.toMatchObject({ code: "P0001", message: expect.stringMatching(/déjà été transformé en devis/) });
  });

  it("la facture naît brouillon, liée au rapport, avec l'identité de l'acheteur ; un rapport lié à un bon se facture par le bon", async () => {
    const r = await unRapport("Remplacement siphon");
    const id = await factureDepuisRapport(ALPHA, r);
    ids.factures.push(id);
    const f = (await admin.from("factures").select("intervention_id, statut, numero, client_pays_code").eq("id", id).single()).data;
    expect(f).toMatchObject({ intervention_id: r.id, statut: "brouillon", numero: null, client_pays_code: "FR" });
    const bon = (await admin.from("bons_commande").select("id").eq("societe_id", ALPHA).limit(1).single()).data;
    if (!bon) throw new Error("Aucun bon dans le jeu d'essai.");
    const lie = await unRapport("x", bon.id);
    await expect(factureDepuisRapport(ALPHA, lie)).rejects.toMatchObject({ message: expect.stringMatching(/facture le bon de commande lié/) });
  });
});
