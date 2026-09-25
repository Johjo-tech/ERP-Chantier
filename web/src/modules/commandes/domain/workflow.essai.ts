import { describe, expect, it } from "vitest";
import { ongletDe, parFournisseur, pieceDuBon, SANS_FOURNISSEUR } from "./pieces";
import { circuitDuBon, etapeWorkflow, etatPieceDuBon, type TacheBon } from "./workflow";

const tache = (t: Partial<TacheBon>): TacheBon => ({
  id: "t", bon_commande_id: "b", libelle: null, metier: null, statut: "planifiee", date_tache: null,
  commentaire: null, refus_motif: null, realisee_le: null, validee_le: null,
  piece_a_commander: false, piece_description: null, piece_fournisseur: null, piece_date_commande: null, piece_recue_le: null, ...t,
});

describe("circuit dérivé des tâches (BC-43)", () => {
  it("un bon sans tâche n'est pas terminé : il est « à pointer » (BC-41)", () => {
    const c = circuitDuBon([], "en_cours");
    expect(c.nbTaches).toBe(0);
    expect(etapeWorkflow(c, false).libelle).toBe("Travaux à pointer");
  });

  it("toutes réalisées → au conducteur ; toutes validées → au directeur ; chiffré → à facturer ; facture liée → facturé", () => {
    const realisees = [tache({ metier: "Peinture", statut: "realisee" }), tache({ metier: "Sol", statut: "validee" })];
    expect(etapeWorkflow(circuitDuBon(realisees, "en_cours"), false).cle).toBe("conducteur");
    const validees = realisees.map((t) => ({ ...t, statut: "validee" }));
    expect(etapeWorkflow(circuitDuBon(validees, "pret_a_chiffrer"), false).cle).toBe("directeur");
    expect(etapeWorkflow(circuitDuBon([], "chiffre"), false).cle).toBe("aFacturer");
    expect(etapeWorkflow(circuitDuBon([], "en_cours"), true).libelle).toBe("Facturé");
  });

  it("les tâches non pointées se nomment par métier, sinon date, sinon « tâche non planifiée »", () => {
    const c = circuitDuBon([tache({ metier: "Sol" }), tache({ date_tache: "2026-09-22" }), tache({ statut: "refusee" }), tache({ statut: "realisee", metier: "Peinture" })], null);
    expect(c.tachesNonPointees).toEqual(["Sol", "2026-09-22", "tâche non planifiée"]);
    expect(c.metiersFait).toEqual({ Sol: false, Peinture: true });
  });
});

describe("pièces (BC-19, BC-20)", () => {
  it("le drapeau d'une seule tâche met le bon en commande ; l'histoire survit à la réception", () => {
    const attente = etatPieceDuBon([tache({}), tache({ piece_a_commander: true, piece_description: "Mitigeur", piece_fournisseur: "Cedeo" })]);
    expect(attente).toMatchObject({ pieceACommander: true, description: "Mitigeur", fournisseur: "Cedeo" });
    const recue = etatPieceDuBon([tache({ piece_description: "Mitigeur", piece_recue_le: "2026-09-24T08:00:00+00:00" })]);
    expect(recue).toMatchObject({ pieceACommander: false, description: "Mitigeur", recueLe: "2026-09-24T08:00:00+00:00" });
  });

  it("à commander → commandée (date posée) → reçue (drapeau levé)", () => {
    expect(ongletDe({ pieceACommander: true, dateCommande: "", description: "", fournisseur: "", recueLe: "" })).toBe("a_commander");
    expect(ongletDe({ pieceACommander: true, dateCommande: "2026-09-20", description: "", fournisseur: "", recueLe: "" })).toBe("commandees");
    expect(ongletDe({ pieceACommander: false, dateCommande: "", description: "x", fournisseur: "", recueLe: "2026-09-24" })).toBe("recues");
    expect(ongletDe({ pieceACommander: false, dateCommande: "", description: "", fournisseur: "", recueLe: "" })).toBeNull();
  });

  it("dossiers par fournisseur, triés, avec un dossier pour le fournisseur absent", () => {
    const bon = (id: string) => ({ id, numero_interne: id, numero_bc: null, client_nom: "C", adresse: null, ville: null, statut_workflow: null });
    const pieces = [
      pieceDuBon(bon("1"), [tache({ piece_a_commander: true, piece_fournisseur: "Point P" })]),
      pieceDuBon(bon("2"), [tache({ piece_a_commander: true, piece_fournisseur: "  " })]),
      pieceDuBon(bon("3"), [tache({ piece_a_commander: true, piece_fournisseur: "Cedeo" })]),
    ];
    expect(parFournisseur(pieces).map((d) => d.fournisseur)).toEqual(["— Fournisseur non renseigné —", "Cedeo", "Point P"].sort((a, b) => a.localeCompare(b)));
    expect(parFournisseur(pieces).find((d) => d.fournisseur === SANS_FOURNISSEUR)?.pieces[0]?.bon.id).toBe("2");
  });
});
