/**
 * Bons de commande contre la base LOCALE : lecture par les vues terrain
 * (prix masqués), isolement des sociétés, droits d'écriture, circuit réservé
 * aux RPC, facture née du bon, pièces. Chaque bon créé ici est supprimé à la fin.
 */
import { afterAll, describe, expect, it } from "vitest";
import { enregistrerBon, genererFacture, lireBon, listerBons } from "../../src/modules/commandes/api/bons";
import { listerPieces, marquerCommandee, pieceRecue } from "../../src/modules/commandes/api/pieces";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import { etapeWorkflow } from "../../src/modules/commandes/domain/workflow";
import type { LigneAEnregistrer } from "../../src/modules/documents/domain/lignes";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";

const BON_BETA = "b5000000-0000-0000-0000-000000000001";
const BON_CHIFFRE_SEED = "a5000000-0000-0000-0000-000000000001";
const OPAC = "a2000000-0000-0000-0000-000000000001";
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";

const crees: string[] = [];
afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (!crees.length) return;
  // Une facture émise est indélébile, et son bon avec : on le dit plutôt que de laisser croire la base propre (relecture 3, M11).
  for (const [table, colonne] of [["factures", "bon_commande_id"], ["bons_commande", "id"]] as const) {
    const { error } = await admin.from(table).delete().in(colonne, crees);
    if (error) console.warn(`Nettoyage partiel de ${table} : ${error.message}`);
  }
});

const entete = (surcharges: Partial<EnteteAEnregistrer> = {}): EnteteAEnregistrer => ({
  client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: CONDUCTEUR, conducteur: null,
  numero_bc: "RLS-ESSAI", sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-24", date_fin_travaux: null,
  nature_travaux: "Essai RLS", notes: null, montant: 120, adresse: "1 rue de l'Essai", code_postal: "69001", ville: "Lyon",
  logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  devis_id: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, probleme_description: null,
  metiers: [], metier: null, montant_par_metier: null,
  ...surcharges,
});
const ligne = (designation: string, prix: number): LigneAEnregistrer => ({
  id: null, position: 0, type: "ligne", designation, quantite: 1, prix_unitaire: prix, unite: "u", tva: 10,
  article_reference: null, commentaire: null, metier: null, montant_ht: prix,
});

async function nouveauBon(c: Client, surcharges: Partial<EnteteAEnregistrer> = {}) {
  const id = await enregistrerBon(ALPHA, null, entete(surcharges), [ligne("Travaux d'essai", 120)], c);
  crees.push(id);
  return id;
}

describe("lecture par les vues terrain (BC-56, BC-61)", () => {
  it("le technicien lit les bons et leurs lignes, sans AUCUN montant ; la table lui est fermée", async () => {
    const tech = await connecte(COMPTES.technicienAlpha);
    const bons = await listerBons(ALPHA, tech);
    expect(bons.length).toBeGreaterThanOrEqual(3);
    expect(bons.every((b) => b.montant === null)).toBe(true);
    const { data: lignes } = await tech.from("v_bon_commande_lignes_terrain").select("prix_unitaire, montant_ht, designation").eq("bon_commande_id", BON_CHIFFRE_SEED);
    expect(lignes?.length).toBeGreaterThan(0);
    expect(lignes?.every((l) => l.prix_unitaire === null && l.montant_ht === null)).toBe(true);
    const { data: table } = await tech.from("bons_commande").select("id, montant");
    expect(table).toEqual([]);
    const { data: lignesTable } = await tech.from("bon_commande_lignes").select("id, prix_unitaire");
    expect(lignesTable).toEqual([]);
  });

  it("le sous-traitant non plus ne lit aucun prix", async () => {
    const st = await connecte(COMPTES.sousTraitantAlpha);
    const bon = await lireBon(BON_CHIFFRE_SEED, st);
    expect(bon.montant).toBeNull();
    expect(bon.lignes.every((l) => l.prix_unitaire === null)).toBe(true);
  });

  it("la secrétaire lit les montants", async () => {
    const sec = await connecte(COMPTES.secretaireAlpha);
    expect((await lireBon(BON_CHIFFRE_SEED, sec)).montant).toBe(471);
  });
});

describe("isolement des sociétés", () => {
  it("aucun compte d'ALPHA ne voit le bon de BETA, ni par la vue ni par la table", async () => {
    for (const compte of [COMPTES.adminAlpha, COMPTES.conducteurAlpha, COMPTES.technicienAlpha, COMPTES.lectureAlpha]) {
      const c = await connecte(compte);
      const vue = await c.from("v_bons_commande_terrain").select("id").eq("id", BON_BETA);
      const table = await c.from("bons_commande").select("id").eq("societe_id", BETA);
      const lignes = await c.from("v_bon_commande_lignes_terrain").select("id").eq("bon_commande_id", BON_BETA);
      expect([vue.data, table.data, lignes.data], compte).toEqual([[], [], []]);
    }
  });

  it("l'admin de BETA voit son bon, et rien d'ALPHA", async () => {
    const beta = await connecte(COMPTES.adminBeta);
    const bons = await listerBons(BETA, beta);
    expect(bons.map((b) => b.id)).toContain(BON_BETA);
    const { data } = await beta.from("v_bons_commande_terrain").select("id").eq("societe_id", ALPHA);
    expect(data).toEqual([]);
  });
});

describe("écriture", () => {
  it("le conducteur crée : numéro interne et étiquette du conducteur posés par la base", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(c);
    const bon = await lireBon(id, c);
    expect(bon.numero_interne).toMatch(/^[A-Z]+-2026-\d{6}$/);
    expect(bon.conducteur).toBe("Christophe Conducteur");
    expect(bon.statut_workflow).toBe("en_cours");
    expect(bon.lignes.map((l) => l.designation)).toEqual(["Travaux d'essai"]);
    expect(etapeWorkflow(bon.circuit, bon.factures.length > 0).cle).toBe("terrain");
  });

  it("la secrétaire modifie un bon mais n'en crée pas (droit « creer » absent)", async () => {
    const sec = await connecte(COMPTES.secretaireAlpha);
    await expect(enregistrerBon(ALPHA, null, entete(), [], sec)).rejects.toMatchObject({ code: "42501" });
    const id = await nouveauBon(await connecte(COMPTES.conducteurAlpha));
    await enregistrerBon(ALPHA, id, entete({ nature_travaux: "Modifié par la secrétaire" }), [ligne("Travaux d'essai", 120)], sec);
    expect((await lireBon(id, sec)).nature_travaux).toBe("Modifié par la secrétaire");
  });

  it("le rôle lecture n'écrit rien", async () => {
    const lecture = await connecte(COMPTES.lectureAlpha);
    await expect(enregistrerBon(ALPHA, null, entete(), [], lecture)).rejects.toMatchObject({ code: "42501" });
    await expect(enregistrerBon(ALPHA, BON_CHIFFRE_SEED, entete(), [], lecture)).rejects.toMatchObject({ code: "42501" });
  });

  it("statut_workflow ne se modifie pas en direct, même par l'admin (BC-36)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin);
    const { error } = await admin.from("bons_commande").update({ statut_workflow: "chiffre" }).eq("id", id);
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/par le circuit/);
  });
});

describe("[proposition] circuit et verrou tenus par la base (relecture 3)", () => {
  it("un bon créé « chiffré » naît quand même au début du circuit (I4)", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const { data, error } = await cond
      .from("bons_commande")
      .insert({ ...entete(), societe_id: ALPHA, date: "2026-09-24", statut: "en attente", statut_workflow: "chiffre" })
      .select("id, statut_workflow")
      .single();
    expect(error).toBeNull();
    if (data) crees.push(data.id);
    expect(data?.statut_workflow).toBe("en_cours");
  });

  it("les lignes d'un bon dont la facture est émise sont figées ; en brouillon, non (I3)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin);
    expect((await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: id })).error).toBeNull();
    const factureId = await genererFacture(id, admin);
    // Facture encore brouillon : rien n'est parti chez le client, corriger le bon reste permis.
    const avant = await admin.from("bon_commande_lignes").update({ designation: "Corrigé avant émission" }).eq("bon_commande_id", id).select("id");
    expect(avant.error).toBeNull();
    const emise = await admin.from("factures").update({ statut: "impayée" }).eq("id", factureId).select("numero").single();
    expect(emise.data?.numero).toBeTruthy();
    const cond = await connecte(COMPTES.conducteurAlpha);
    const maj = await cond.from("bon_commande_lignes").update({ designation: "MODIFIÉ" }).eq("bon_commande_id", id).select("id");
    expect(maj.error?.code).toBe("23001");
    const sup = await cond.from("bon_commande_lignes").delete().eq("bon_commande_id", id).select("id");
    expect(sup.error?.code).toBe("23001");
    const ajout = await cond.from("bon_commande_lignes").insert({ bon_commande_id: id, position: 9, type: "ligne", designation: "AJOUT", quantite: 1, prix_unitaire: 999, unite: "u", tva: 20 });
    expect(ajout.error?.message).toMatch(/facturé/);
  });
});

describe("facture née du bon (BC-15, BC-49)", () => {
  it("chiffré → la secrétaire génère une facture BROUILLON ; le conducteur est refusé ; le bon passe « facturé »", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin);
    const hc = await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: id });
    expect(hc.error).toBeNull();
    await expect(genererFacture(id, await connecte(COMPTES.conducteurAlpha))).rejects.toMatchObject({ code: "42501" });
    const sec = await connecte(COMPTES.secretaireAlpha);
    const factureId = await genererFacture(id, sec);
    const { data: facture } = await sec.from("factures").select("numero, statut, ref_bon_commande_client, adresse_locataire").eq("id", factureId).single();
    expect(facture).toEqual({ numero: null, statut: "brouillon", ref_bon_commande_client: "RLS-ESSAI", adresse_locataire: "1 rue de l'Essai" });
    const bon = await lireBon(id, sec);
    expect(bon.statut_workflow).toBe("facture");
    expect(etapeWorkflow(bon.circuit, bon.factures.length > 0).libelle).toBe("Facturé");
    await expect(genererFacture(id, sec)).rejects.toMatchObject({ code: "P0001" });
  });
});

describe("pièces (BC-19, BC-21)", () => {
  it("commandée : écriture directe permise au conducteur, refusée à la secrétaire ; pièce reçue par RPC", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin);
    const { error } = await admin.from("planning_taches").insert({ societe_id: ALPHA, libelle: "Essai pièce", bon_commande_id: id, date_tache: "2026-09-30", piece_a_commander: true, piece_description: "Vanne d'essai" });
    expect(error).toBeNull();

    const sec = await connecte(COMPTES.secretaireAlpha);
    await expect(marquerCommandee(id, { date: "2026-09-24", fournisseur: "Cedeo" }, sec)).rejects.toMatchObject({ code: "42501" });
    await expect(pieceRecue(id, sec)).rejects.toMatchObject({ code: "42501" });

    const cond = await connecte(COMPTES.conducteurAlpha);
    await marquerCommandee(id, { date: "2026-09-24", fournisseur: "Cedeo" }, cond);
    const avant = (await listerPieces(ALPHA, cond)).find((p) => p.bon.id === id);
    expect(avant).toMatchObject({ pieceACommander: true, fournisseur: "Cedeo", dateCommande: "2026-09-24", description: "Vanne d'essai" });

    await pieceRecue(id, cond);
    const apres = (await listerPieces(ALPHA, cond)).find((p) => p.bon.id === id);
    expect(apres?.pieceACommander).toBe(false);
    expect(apres?.recueLe).not.toBe("");
    const { data: tache } = await cond.from("planning_taches").select("date_tache").eq("bon_commande_id", id).single();
    expect(tache?.date_tache).toBeNull();
  });

  it("pièce reçue refusée sur un bon chiffré, avec le motif de la base", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    await expect(pieceRecue(BON_CHIFFRE_SEED, cond)).rejects.toMatchObject({ code: "P0001", message: expect.stringMatching(/ne se replanifie plus/) });
  });
});
