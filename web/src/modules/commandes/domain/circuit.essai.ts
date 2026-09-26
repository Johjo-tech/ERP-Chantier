import { describe, expect, it } from "vitest";
import { ligneVide } from "@/modules/documents/domain/lignes";
import { bonAvecTaches, bonEssai, tacheEssai, travailEssai } from "../essai-fixtures";
import { lireFichierRetenu, montantsSaisisParMetier, facturationRenseignee, schemaSaisieBon, valeursDepuis } from "./bon";
import { enAttentePlanning, origineDuTravail, peutCloturerSansFacturation, peutEcrireTerrain } from "./circuit";
import { nouvelleTentative, tentativesDuBon } from "./contacts";
import { preparerEnregistrement } from "./enregistrement";
import { aFacturer, fileValidation, filtrerFile } from "./files";
import { metierChoisi, METIER_AUCUN, metiersDuBon, metiersRetenus, montantDuMetierDansLeDevis, totauxDesChapitres } from "./metiers";
import { comptesRendus, documentDirecteur, lirePrixTravail, travauxSaisis, versLignesAEnregistrer, type LigneDocument } from "./prefacture";
import { enteteSav, savDuBon } from "./sav";

describe("métiers du bon", () => {
  it("« Déduit du titre » redevient NULL, jamais \"\" ; la sentinelle est gardée telle quelle (BC-72)", () => {
    expect(metierChoisi("")).toBeNull();
    expect(metierChoisi("  ")).toBeNull();
    expect(metierChoisi(METIER_AUCUN)).toBe("(aucun)");
  });

  it("la déduction ajoute les métiers des chapitres sans retirer ce qui est coché", () => {
    const r = metiersRetenus(["Sol"], [{ type: "chapitre", designation: "PEINTURE SEJOUR", metier: null }], ["Peinture", "Sol"]);
    expect(r).toEqual({ retenus: ["Sol", "Peinture"], origines: { Peinture: "PEINTURE SEJOUR" }, ajoutes: 1 });
  });

  it("les métiers d'un bon lu : la liste jsonb, sinon l'ancien champ unique ; une valeur illisible est ignorée", () => {
    expect(metiersDuBon({ metiers: ["Peinture", 3, ""], metier: "Sol" })).toEqual(["Peinture"]);
    expect(metiersDuBon({ metiers: null, metier: "Sol" })).toEqual(["Sol"]);
    expect(metiersDuBon({ metiers: "Peinture", metier: null })).toEqual([]);
  });

  it("montant d'un métier lu dans le devis lié, en mots entiers (« SOL » n'est pas dans « ISOLATION »)", () => {
    const totaux = totauxDesChapitres([
      { type: "chapitre", designation: "ISOLATION COMBLES" },
      { type: "ligne", quantite: 2, prix_unitaire: 10 },
      { type: "chapitre", designation: "Peinture séjour" },
      { type: "ligne", quantite: 3, prix_unitaire: "0,1" },
    ]);
    expect(montantDuMetierDansLeDevis("Peinture", totaux)?.toString()).toBe("0.3");
    expect(montantDuMetierDansLeDevis("Sol", totaux)).toBeNull();
  });
});

describe("enregistrement d'un bon ventilé par métier (BC-11, BC-33, BC-35)", () => {
  const saisie = (s: Record<string, string> = {}) => schemaSaisieBon.parse({ ...valeursDepuis(null, null), client_id: "c1", ...s });

  it("sans ligne : le montant est la somme des métiers ; la ventilation est enregistrée ; `metier` = le premier", () => {
    const p = preparerEnregistrement({ saisie: saisie(), client: { nom: "OPAC" }, mode: "normal", lignes: [ligneVide(10)], brouillon: true, aujourdhui: "2026-09-25", metiers: ["Sol", "Peinture"], montantsParMetier: { Sol: "0,1", Peinture: "0,2" } });
    expect(p).toMatchObject({ ok: true, entete: { montant: 0.3, montant_par_metier: { Sol: 0.1, Peinture: 0.2 }, metiers: ["Sol", "Peinture"], metier: "Sol" } });
  });

  it("avec des lignes, ce sont elles qui font foi ; un seul métier ne ventile pas", () => {
    const lignes = [{ ...ligneVide(10), designation: "Murs", prix_unitaire: "50" }];
    const p = preparerEnregistrement({ saisie: saisie({ adresse_locataire: "1 rue" }), client: { nom: "OPAC" }, mode: "normal", lignes, brouillon: false, aujourdhui: "2026-09-25", metiers: ["Sol"], montantsParMetier: { Sol: "999" } });
    expect(p).toMatchObject({ ok: true, entete: { montant: 50, montant_par_metier: null, metier: "Sol" } });
  });

  it("un montant de métier illisible est refusé", () => {
    const p = preparerEnregistrement({ saisie: saisie(), client: { nom: "OPAC" }, mode: "normal", lignes: [], brouillon: true, aujourdhui: "2026-09-25", metiers: ["Sol", "Peinture"], montantsParMetier: { Sol: "beaucoup" } });
    expect(p).toMatchObject({ ok: false, montantIllisible: true });
  });

  it("un bon sans métier n'écrit pas `metier: \"\"` mais null", () => {
    const p = preparerEnregistrement({ saisie: saisie(), client: { nom: "OPAC" }, mode: "normal", lignes: [], brouillon: true, aujourdhui: "2026-09-25" });
    expect(p).toMatchObject({ ok: true, entete: { metier: null, metiers: [] } });
  });

  it("la ventilation relue en base redevient saisissable ; l'adresse de facturation se déplie si remplie", () => {
    expect(montantsSaisisParMetier({ Sol: 12.5, Peinture: "3" , X: { y: 1 } })).toEqual({ Sol: "12,5", Peinture: "3" });
    expect(montantsSaisisParMetier([1])).toEqual({});
    expect(facturationRenseignee({ facturation_adresse: "", facturation_code_postal: " ", facturation_ville: "Lyon" })).toBe(true);
    expect(facturationRenseignee({ facturation_adresse: "", facturation_code_postal: "", facturation_ville: "" })).toBe(false);
  });

  it("le document lu retenu par la navigation est un File, rien d'autre (OCR-04)", () => {
    const f = new File(["x"], "bon.pdf");
    expect(lireFichierRetenu({ fichier: f })).toBe(f);
    expect(lireFichierRetenu({ fichier: "bon.pdf" })).toBeNull();
    expect(lireFichierRetenu(null)).toBeNull();
  });
});

describe("circuit : droits et files", () => {
  it("peut_ecrire, origine d'un travail, clôture par l'admin seul sur un circuit ouvert (BC-14, BC-46)", () => {
    expect(["admin", "conducteur", "technicien", "secretaire", "lecture"].map((r) => peutEcrireTerrain(r as never))).toEqual([true, true, true, false, false]);
    expect(origineDuTravail("admin")).toBe("conducteur");
    expect(origineDuTravail("technicien")).toBe("technicien");
    expect(peutCloturerSansFacturation("admin", { statut_workflow: "en_cours" }, false)).toBe(true);
    expect(peutCloturerSansFacturation("admin", { statut_workflow: "cloture_gratuit" }, false)).toBe(false);
    expect(peutCloturerSansFacturation("admin", { statut_workflow: "en_cours" }, true)).toBe(false);
    expect(peutCloturerSansFacturation("conducteur", { statut_workflow: "en_cours" }, false)).toBe(false);
  });

  it("« en attente planning » : ni SAV, ni circuit clos, ni validé conducteur (BC-44)", () => {
    expect(enAttentePlanning({ statut_workflow: "en_cours", bon_commande_parent_id: null }, false, false)).toBe(true);
    expect(enAttentePlanning({ statut_workflow: "en_cours", bon_commande_parent_id: "b0" }, false, false)).toBe(false);
    expect(enAttentePlanning({ statut_workflow: "chiffre", bon_commande_parent_id: null }, false, false)).toBe(false);
    expect(enAttentePlanning({ statut_workflow: "en_cours", bon_commande_parent_id: null }, true, false)).toBe(false);
  });

  it("file de validation : compteur et filtre lisent la même règle ; clos gratuit et sans tâche exclus (BC-79, BC-96)", () => {
    const bons = [
      bonAvecTaches([tacheEssai({ statut: "validee" })], { id: "pret" }),
      bonAvecTaches([tacheEssai({ statut: "realisee" }), tacheEssai({ id: "t2", statut: "planifiee" })], { id: "encours" }),
      bonAvecTaches([tacheEssai({ statut: "realisee" })], { id: "gratuit", statut_workflow: "cloture_gratuit" }),
      bonAvecTaches([], { id: "vide" }),
    ];
    const file = fileValidation(bons);
    expect(file.map((x) => [x.bon.id, x.etape])).toEqual([["pret", "pret"], ["encours", "travaux_en_cours"]]);
    expect(filtrerFile(file, "pret").length + filtrerFile(file, "travaux_en_cours").length).toBe(filtrerFile(file, "tous").length);
    expect(aFacturer([bonAvecTaches([], { id: "c", statut_workflow: "chiffre" }), bonAvecTaches([], { id: "f", statut_workflow: "chiffre", factures: [{ id: "x", numero: null, bon_commande_id: "f" }] })]).map((b) => b.id)).toEqual(["c"]);
  });
});

describe("pré-facture", () => {
  it("un prix saisi chiffre le travail ; quantité et unité suivent ; « PLB-001 » est refusé (BC-47, BC-72)", () => {
    const { travaux, erreurs } = travauxSaisis([travailEssai(), travailEssai({ id: "w2" })], { w1: { quantite: "2,5", unite: "m²", prix: "10" }, w2: { quantite: "1", unite: "u", prix: "PLB-001" } });
    expect(travaux[0]).toMatchObject({ statut: "chiffre", prix_vente_ht: 10, quantite: 2.5, unite: "m²" });
    expect(travaux[1]).toMatchObject({ statut: "a_chiffrer" });
    expect(erreurs).toEqual({ w2: "Montant invalide." });
    expect(lirePrixTravail("-3")).toEqual({ ok: false, message: "Un prix ne peut pas être négatif." });
    expect(lirePrixTravail(" ")).toEqual({ ok: true, prix: null });
  });

  it("le document devient les lignes du bon : positions dans l'ordre, HT exact, surbrillance retirée", () => {
    const ligne: LigneDocument = { id: "l1", type: "ligne", designation: "Murs", quantite: 3, prix_unitaire: 0.1, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null };
    const doc = documentDirecteur([ligne], [travailEssai({ statut: "chiffre", prix_vente_ht: 5 })], [], [], 10);
    const lignes = versLignesAEnregistrer(doc);
    expect(lignes.map((l) => [l.position, l.type, l.designation, l.montant_ht])).toEqual([[0, "chapitre", "Bon de commande", 0], [1, "ligne", "Murs", 0.3], [2, "chapitre", "Travaux supplémentaires constatés sur le chantier", 0], [3, "ligne", "Reprise plinthes", 20]]);
    expect(lignes.some((l) => "ajout" in l)).toBe(false);
  });

  it("tous les comptes-rendus du terrain, pas le premier seulement", () => {
    expect(comptesRendus([tacheEssai({ commentaire: " A " }), tacheEssai({ id: "t2", commentaire: null }), tacheEssai({ id: "t3", commentaire: "B" })]).map((c) => c.commentaire)).toEqual(["A", "B"]);
  });
});

describe("SAV (BC-13, BC-51)", () => {
  it("l'en-tête est recopié, sans n° du client, sans devis, sans montant ni circuit ; un seul SAV par bon", () => {
    const e = enteteSav(bonEssai({ devis_id: "d1", metiers: ["Sol"], statut_workflow: "chiffre", numero_interne: "BC-1" }), "Fuite", "SAV-2026-000002", "2026-09-25");
    expect(e).toMatchObject({ bon_commande_parent_id: "b1", numero_bc: "SAV-2026-000002", sans_bc: true, devis_id: null, montant: 0, metiers: ["Sol"], probleme_description: "Fuite", date_reception: "2026-09-25", conducteur: null });
    expect("statut_workflow" in e || "numero_interne" in e || "id" in e).toBe(false);
    expect(savDuBon("b1", [bonEssai({ id: "s", bon_commande_parent_id: "b1" })])?.id).toBe("s");
  });
});

describe("contacts et onglets", () => {
  it("une tentative illisible est écartée ; la nouvelle porte date et heure", () => {
    expect(tentativesDuBon([{ id: "1", type: "appel", date: "2026-09-24", heure: "10:00" }, { type: "fax" }, "x"])).toHaveLength(1);
    expect(tentativesDuBon(null)).toEqual([]);
    expect(nouvelleTentative("sms", "id", "2026-09-25", new Date(2026, 8, 25, 9, 5))).toEqual({ id: "id", type: "sms", date: "2026-09-25", heure: "09:05" });
  });

});
