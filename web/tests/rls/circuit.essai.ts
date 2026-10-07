/**
 * Le circuit d'un bon contre la base LOCALE : tâches, validation conducteur,
 * travaux supplémentaires, pré-facture (circuit et hors circuit), clôture
 * gratuite, SAV, pièce jointe, contacts. Chaque bon créé ici est supprimé à la
 * fin, et chaque fichier déposé retiré du bucket.
 */
import { afterAll, describe, expect, it } from "vitest";
import { ecrireContacts, enregistrerBon, lireBon } from "../../src/modules/commandes/api/bons";
import {
  ajouterTravail,
  arbitrerTache,
  chiffrerTravail,
  cloturerGratuit,
  creerTachesManquantes,
  journalDuBon,
  listerTaches,
  listerTravaux,
  marquerRealisee,
  validerAffaireConducteur,
  validerPrefacture,
} from "../../src/modules/commandes/api/circuit";
import { creerSav, listerPhotos, remplacerPieceJointe, urlPieceJointe } from "../../src/modules/commandes/api/documents";
import { listerMetiersDeclares } from "../../src/modules/commandes/api/metiers";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import { documentDirecteur, depuisLignesAEnregistrer, versLignesAEnregistrer } from "../../src/modules/commandes/domain/prefacture";
import type { LigneAEnregistrer } from "../../src/modules/documents/domain/lignes";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const OPAC = "a2000000-0000-0000-0000-000000000001";
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";

const crees: string[] = [];
const fichiers: string[] = [];
afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (fichiers.length) {
    const { error } = await admin.storage.from("terrain").remove(fichiers);
    if (error) console.warn(`Nettoyage partiel du bucket : ${error.message}`);
  }
  if (!crees.length) return;
  for (const [table, colonne] of [["factures", "bon_commande_id"], ["bons_commande", "bon_commande_parent_id"], ["bons_commande", "id"]] as const) {
    const { error } = await admin.from(table).delete().in(colonne, crees);
    if (error) console.warn(`Nettoyage partiel de ${table} : ${error.message}`);
  }
});

const entete = (surcharges: Partial<EnteteAEnregistrer> = {}): EnteteAEnregistrer => ({
  client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: CONDUCTEUR, conducteur: null,
  numero_bc: "RLS-CIRCUIT", sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-25", date_fin_travaux: null,
  nature_travaux: "Essai circuit", notes: null, montant: 0, adresse: "2 rue du Circuit", code_postal: "69001", ville: "Lyon",
  logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  devis_id: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, probleme_description: null,
  metiers: ["Peinture", "Sol"], metier: "Peinture", montant_par_metier: null,
  ...surcharges,
});
const ligne = (position: number, type: LigneAEnregistrer["type"], designation: string, prix: number): LigneAEnregistrer => ({
  id: null, position, type, designation, quantite: type === "ligne" ? 1 : 0, prix_unitaire: prix, unite: type === "ligne" ? "u" : null, tva: type === "ligne" ? 10 : 0,
  article_reference: null, commentaire: null, metier: null, montant_ht: type === "ligne" ? prix : 0,
});

async function nouveauBon(c: Client, surcharges: Partial<EnteteAEnregistrer> = {}) {
  const id = await enregistrerBon(ALPHA, null, entete(surcharges), [ligne(0, "chapitre", "PEINTURE", 0), ligne(1, "ligne", "Murs", 200), ligne(2, "chapitre", "SOL", 0), ligne(3, "ligne", "Parquet", 100)], c);
  crees.push(id);
  return id;
}

describe("tâches du bon (BC-37, BC-38)", () => {
  it("une tâche par métier ; déclarée faite, arbitrée ; refus motivé ; une tâche validée ne se rouvre pas", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(cond);
    const bon = await lireBon(id, cond);
    expect(await creerTachesManquantes(bon, [], cond)).toBe(2);
    expect(await creerTachesManquantes(bon, await listerTaches(id, cond), cond)).toBe(0);
    const [peinture, sol] = await listerTaches(id, cond);
    if (!peinture || !sol) throw new Error("deux tâches attendues");

    // Le technicien sans équipe affectée : la base le dit, l'écran le montre tel quel.
    const tech = await connecte(COMPTES.technicienAlpha);
    await expect(marquerRealisee(peinture.id, null, tech)).rejects.toMatchObject({ message: expect.stringMatching(/équipe/) });

    await marquerRealisee(peinture.id, "Fait", cond);
    await expect(arbitrerTache(sol.id, true, null, cond)).rejects.toMatchObject({ message: expect.stringMatching(/Transition interdite/) });
    await expect(arbitrerTache(peinture.id, false, "  ", cond)).rejects.toMatchObject({ message: "Un refus doit être motivé." });
    await arbitrerTache(peinture.id, false, "Reprendre l'angle", cond);
    expect((await listerTaches(id, cond)).find((t) => t.id === peinture.id)).toMatchObject({ statut: "refusee", refus_motif: "Reprendre l'angle" });
    await marquerRealisee(peinture.id, null, cond);
    await arbitrerTache(peinture.id, true, null, cond);
    await expect(marquerRealisee(peinture.id, null, cond)).rejects.toMatchObject({ message: expect.stringMatching(/Transition interdite/) });

    // La secrétaire lit mais n'arbitre pas (planning/modifier).
    await marquerRealisee(sol.id, null, cond);
    await expect(arbitrerTache(sol.id, true, null, await connecte(COMPTES.secretaireAlpha))).rejects.toMatchObject({ code: "42501" });
  });

  it("validation conducteur : refusée tant qu'un métier n'a pas de tâche ou qu'une tâche n'est pas pointée ; puis tout est validé", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(cond);
    const { error } = await cond.from("planning_taches").insert({ societe_id: ALPHA, bon_commande_id: id, metier: "Peinture", libelle: "Peinture", statut: "planifiee" });
    expect(error).toBeNull();
    await expect(validerAffaireConducteur(await lireBon(id, cond), cond)).rejects.toMatchObject({ message: expect.stringMatching(/métier\(s\) du bon n'ont encore aucune tâche planifiée\. \(Sol\)/) });
    await creerTachesManquantes(await lireBon(id, cond), await listerTaches(id, cond), cond);
    for (const t of await listerTaches(id, cond)) await marquerRealisee(t.id, null, cond);
    await validerAffaireConducteur(await lireBon(id, cond), cond);
    const relu = await lireBon(id, cond);
    expect(relu.circuit).toMatchObject({ nbTaches: 2, valideConducteur: true, tachesNonPointees: [] });
  });
});

describe("travaux supplémentaires (BC-46)", () => {
  it("le conducteur ajoute (« à chiffrer », TVA 10) et chiffre prix + quantité + unité ; la secrétaire ne les écrit pas ; le terrain les lit sans prix", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(cond);
    await ajouterTravail({ societeId: ALPHA, bonId: id, tacheId: null, libelle: "Siphon", origine: "conducteur" }, cond);
    const [travail] = await listerTravaux(id, cond);
    expect(travail).toMatchObject({ libelle: "Siphon", statut: "a_chiffrer", tva: 10, quantite: 1, unite: "u", origine: "conducteur" });
    if (!travail) throw new Error("travail attendu");
    const sec = await connecte(COMPTES.secretaireAlpha);
    await expect(ajouterTravail({ societeId: ALPHA, bonId: id, tacheId: null, libelle: "Non", origine: "technicien" }, sec)).rejects.toMatchObject({ code: "42501" });
    await expect(chiffrerTravail(travail.id, { prix: 1, quantite: 1, unite: "u" }, sec)).rejects.toMatchObject({ code: "42501" });
    await chiffrerTravail(travail.id, { prix: 12.5, quantite: 4, unite: "ml" }, cond);
    expect((await listerTravaux(id, sec))[0]).toMatchObject({ statut: "chiffre", prix_vente_ht: 12.5, quantite: 4, unite: "ml" });
    expect((await listerTravaux(id, await connecte(COMPTES.technicienAlpha)))[0]).toMatchObject({ libelle: "Siphon", prix_vente_ht: null });
  });
});

describe("pré-facture (BC-47, BC-48, BC-91)", () => {
  it("dans le circuit : prix, lignes avec le travail dans le chapitre de son métier, « intégré », puis chiffré ; le conducteur ne valide pas", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin, { metiers: ["Peinture"], metier: "Peinture" });
    await creerTachesManquantes(await lireBon(id, admin), [], admin);
    const [tache] = await listerTaches(id, admin);
    if (!tache) throw new Error("tâche attendue");
    await ajouterTravail({ societeId: ALPHA, bonId: id, tacheId: tache.id, libelle: "Reprise plinthes", origine: "conducteur" }, admin);
    await marquerRealisee(tache.id, null, admin);
    await arbitrerTache(tache.id, true, null, admin);
    // S'il reste un travail « à chiffrer », la base refuse le chiffrage (BC-48).
    expect((await admin.rpc("bc_passer_pret_a_chiffrer", { p_bc_id: id })).error).toBeNull();
    expect((await admin.rpc("bc_chiffrage_valide", { p_bc_id: id })).error?.message).toMatch(/pas encore chiffres/);

    const bon = await lireBon(id, admin);
    const travaux = (await listerTravaux(id, admin)).map((t) => ({ ...t, prix_vente_ht: 15, statut: "chiffre" as const }));
    const lignesBon = bon.lignes.map((l) => ({ ...l, prix_unitaire: l.prix_unitaire ?? 0, montant_ht: 0 }));
    const doc = versLignesAEnregistrer(documentDirecteur(depuisLignesAEnregistrer(lignesBon), travaux, await listerTaches(id, admin), ["Peinture", "Sol"], 10));
    const chiffrage = { bonId: id, statutWorkflow: bon.statut_workflow, lignes: doc, montant: 360, prix: travaux.map((t) => ({ id: t.id, prix: 15, quantite: t.quantite ?? 1, unite: t.unite ?? "u" })), integres: travaux.map((t) => t.id), horsCircuit: false };
    await expect(validerPrefacture(chiffrage, await connecte(COMPTES.conducteurAlpha))).rejects.toMatchObject({ code: "42501" });
    await validerPrefacture(chiffrage, admin);
    const relu = await lireBon(id, admin);
    expect(relu.statut_workflow).toBe("chiffre");
    expect(relu.lignes.map((l) => l.designation)).toEqual(["PEINTURE", "Murs", "Reprise plinthes", "SOL", "Parquet"]);
    expect((await listerTravaux(id, admin)).map((t) => t.statut)).toEqual(["integre"]);
    expect(relu.montant).toBe(360);
  });

  it("hors circuit : sans tâche, tracé au journal, et les travaux chiffrés sont intégrés aussi", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const id = await nouveauBon(admin);
    await ajouterTravail({ societeId: ALPHA, bonId: id, tacheId: null, libelle: "Déplacement", origine: "conducteur" }, admin);
    const bon = await lireBon(id, admin);
    const travaux = (await listerTravaux(id, admin)).map((t) => ({ ...t, prix_vente_ht: 30, statut: "chiffre" as const }));
    const doc = versLignesAEnregistrer(documentDirecteur(depuisLignesAEnregistrer(bon.lignes.map((l) => ({ ...l, prix_unitaire: l.prix_unitaire ?? 0, montant_ht: 0 }))), travaux, [], [], 10));
    await validerPrefacture({ bonId: id, statutWorkflow: "en_cours", lignes: doc, montant: 330, prix: travaux.map((t) => ({ id: t.id, prix: 30, quantite: 1, unite: "u" })), integres: travaux.map((t) => t.id), horsCircuit: true }, admin);
    const relu = await lireBon(id, admin);
    expect(relu.statut_workflow).toBe("chiffre");
    expect(relu.lignes.at(-1)?.designation).toBe("Déplacement");
    expect((await journalDuBon(id, admin)).map((j) => [j.ancien_statut, j.nouveau_statut])).toContainEqual(["en_cours", "chiffre"]);
  });
});

describe("clôture sans facturation (BC-14, BC-50)", () => {
  it("admin seul ; les travaux à chiffrer passent « refusé » ; gratuité et motif gardés", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(cond);
    await ajouterTravail({ societeId: ALPHA, bonId: id, tacheId: null, libelle: "Offert", origine: "conducteur" }, cond);
    await expect(cloturerGratuit(id, "Non", cond)).rejects.toMatchObject({ code: "42501" });
    const admin = await connecte(COMPTES.adminAlpha);
    await cloturerGratuit(id, "Reprise sous garantie", admin);
    const relu = await lireBon(id, admin);
    expect(relu).toMatchObject({ statut_workflow: "cloture_gratuit", gratuite: true, gratuite_motif: "Reprise sous garantie" });
    expect((await listerTravaux(id, admin))[0]?.statut).toBe("refuse");
    expect((await journalDuBon(id, admin)).at(-1)).toMatchObject({ nouveau_statut: "cloture_gratuit", motif: "Reprise sous garantie" });
  });
});

describe("SAV (BC-13, BC-51)", () => {
  it("le conducteur crée le SAV : numéro de notre série, bon d'origine, en-tête recopié, photos ; la secrétaire ne crée pas", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const origine = await lireBon(await nouveauBon(cond, { logement_statut: "occupé", occupant: "M. A" }), cond);
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "fuite.jpg", { type: "image/jpeg" });
    const savId = await creerSav(origine, "Fuite revenue", [photo], "2026-09-25", cond);
    crees.push(savId);
    const sav = await lireBon(savId, cond);
    expect(sav).toMatchObject({ bon_commande_parent_id: origine.id, sans_bc: true, occupant: "M. A", conducteur_id: CONDUCTEUR, probleme_description: "Fuite revenue", montant: 0, statut_workflow: "en_cours", devis_id: null });
    expect(sav.numero_bc).toMatch(/^SAV-2026-\d{6}$/);
    const photos = await listerPhotos(savId, cond);
    expect(photos).toHaveLength(1);
    fichiers.push(...photos.map((p) => p.chemin));
    expect(photos[0]?.chemin.startsWith(`${ALPHA}/bons-commande/${savId}/`)).toBe(true);
    await expect(creerSav(origine, null, [], "2026-09-25", await connecte(COMPTES.secretaireAlpha))).rejects.toMatchObject({ code: "42501" });
  });
});

describe("pièce jointe (BC-09)", () => {
  it("déposée par le conducteur sous le dossier de la société, lue par URL signée ; refusée à la secrétaire ; retirée", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const id = await nouveauBon(cond);
    const pdf = new File(["%PDF-1.4 essai"], "Bon n°12 – Résidence.pdf", { type: "application/pdf" });
    await remplacerPieceJointe({ id, societe_id: ALPHA, piece_jointe_chemin: null }, pdf, cond);
    const bon = await lireBon(id, cond);
    expect(bon).toMatchObject({ piece_jointe_nom: "Bon n°12 – Résidence.pdf", piece_jointe_mime: "application/pdf" });
    expect(bon.piece_jointe_chemin).toMatch(new RegExp(`^${ALPHA}/bons-commande/${id}/\\d+_Bon-n-12-Residence\\.pdf$`));
    if (bon.piece_jointe_chemin) fichiers.push(bon.piece_jointe_chemin);
    const url = await urlPieceJointe(bon.piece_jointe_chemin ?? "", cond);
    expect(await (await fetch(url)).text()).toBe("%PDF-1.4 essai");

    const sec = await connecte(COMPTES.secretaireAlpha);
    await expect(remplacerPieceJointe({ id, societe_id: ALPHA, piece_jointe_chemin: bon.piece_jointe_chemin }, pdf, sec)).rejects.toMatchObject({ message: expect.stringMatching(/n'a pas pu être rangé/) });
    await expect(urlPieceJointe(bon.piece_jointe_chemin ?? "", await connecte(COMPTES.adminBeta))).rejects.toBeTruthy();

    await remplacerPieceJointe({ id, societe_id: ALPHA, piece_jointe_chemin: bon.piece_jointe_chemin }, null, cond);
    expect(await lireBon(id, cond)).toMatchObject({ piece_jointe_chemin: null, piece_jointe_nom: null, piece_jointe_mime: null });
  });
});

describe("contacts et métiers (BC-02, BC-54)", () => {
  it("la secrétaire note une tentative et programme un rappel ; le rôle lecture non", async () => {
    const id = await nouveauBon(await connecte(COMPTES.conducteurAlpha));
    const sec = await connecte(COMPTES.secretaireAlpha);
    await ecrireContacts(id, { tentatives_contact: [{ id: "t", type: "appel", date: "2026-09-25", heure: "09:00" }], rappel_date: "2026-10-01" }, sec);
    expect(await lireBon(id, sec)).toMatchObject({ tentatives_contact: [{ type: "appel" }], rappel_date: "2026-10-01" });
    await expect(ecrireContacts(id, { rappel_date: null }, await connecte(COMPTES.lectureAlpha))).rejects.toMatchObject({ code: "42501" });
  });

  it("les métiers déclarés de la société se lisent, ceux de BETA non", async () => {
    const metiers = await listerMetiersDeclares(ALPHA, await connecte(COMPTES.lectureAlpha));
    expect(metiers).toEqual(expect.arrayContaining(["Peinture", "Sol", "Plomberie"]));
    expect(await listerMetiersDeclares(ALPHA, await connecte(COMPTES.adminBeta))).toEqual([]);
  });
});

describe("[proposition] préfixe des bons (BC-94, 20260926030000)", () => {
  it("un bon créé reçoit un numéro « BC- », sans ligne de compteur posée à la main", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const bon = await lireBon(await nouveauBon(cond), cond);
    expect(bon.numero_interne).toMatch(/^BC-2026-\d{6}$/);
  });
});
