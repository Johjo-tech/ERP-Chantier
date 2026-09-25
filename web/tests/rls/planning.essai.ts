/**
 * Planning contre la base LOCALE : ce que chaque rôle lit et écrit, le
 * circuit réservé aux RPC, l'équipe qui seule pointe sa tâche, et les
 * propositions 2026092605* (sous-traitant, photos, téléphone). Tout ce qui est
 * créé ici (équipes, salarié, sous-traitants, bons et leurs tâches) est
 * supprimé à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerBon } from "../../src/modules/commandes/api/bons";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import { ajouterPhoto, appliquerPlan, lirePlanning, marquerRealisee, photosDuBon, sauvegarderTerrain, supprimerPhoto, validerTache, ajouterTravailSupplementaire } from "../../src/modules/planning/api/planning";
import { construireCartes } from "../../src/modules/planning/domain/cartes";
import { planAjouterDate, planPoser } from "../../src/modules/planning/domain/planification";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const PROFIL_TECHNICIEN = "a1000000-0000-0000-0000-000000000004";
const PROFIL_SOUS_TRAITANT = "a1000000-0000-0000-0000-000000000006";
const OPAC = "a2000000-0000-0000-0000-000000000001";
const JOUR = "2026-10-05";

let admin: Client;
let conducteur: Client;
let technicien: Client;
let sousTraitant: Client;
const ids = { equipe: "", autreEquipe: "", salarie: "", st: "", autreSt: "", bons: [] as string[] };

const entete = (surcharges: Partial<EnteteAEnregistrer> = {}): EnteteAEnregistrer => ({
  client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: null, conducteur: null,
  numero_bc: "RLS-PLANNING", sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-24", date_fin_travaux: null,
  nature_travaux: "Essai planning", notes: null, montant: 480, adresse: "1 rue du Planning", code_postal: "69001", ville: "Lyon",
  logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  ...surcharges,
});

async function nouveauBon(): Promise<string> {
  const id = await enregistrerBon(ALPHA, null, entete(), [], conducteur);
  ids.bons.push(id);
  return id;
}

async function lesCartes(c: Client, utilisateur: string) {
  const d = await lirePlanning(ALPHA, utilisateur, c);
  return { d, cartes: construireCartes(d.bons, d.taches, d) };
}

async function tacheDe(bcId: string, champs: { technicien_id?: string | null; sous_traitant_id?: string | null; date_tache?: string }) {
  const { data, error } = await admin
    .from("planning_taches")
    .insert({ societe_id: ALPHA, bon_commande_id: bcId, libelle: "RLS", metier: "Plomberie", date_tache: champs.date_tache ?? JOUR, technicien_id: champs.technicien_id ?? null, sous_traitant_id: champs.sous_traitant_id ?? null, heure_debut: null, heure_fin: null, statut: "planifiee", piece_a_commander: false })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [admin, conducteur, technicien, sousTraitant] = await Promise.all([connecte(COMPTES.adminAlpha), connecte(COMPTES.conducteurAlpha), connecte(COMPTES.technicienAlpha), connecte(COMPTES.sousTraitantAlpha)]);
  const equipes = await admin.from("techniciens").insert([{ societe_id: ALPHA, nom: "Équipe RLS", metiers: ["Plomberie"] }, { societe_id: ALPHA, nom: "Équipe RLS bis", metiers: [] }]).select("id, nom");
  if (equipes.error) throw equipes.error;
  ids.equipe = equipes.data.find((e) => e.nom === "Équipe RLS")?.id ?? "";
  ids.autreEquipe = equipes.data.find((e) => e.nom === "Équipe RLS bis")?.id ?? "";
  const salarie = await admin.from("salaries").insert({ societe_id: ALPHA, nom: "Technicien", prenom: "Thomas", profile_id: PROFIL_TECHNICIEN, technicien_id: ids.equipe, actif: true }).select("id").single();
  if (salarie.error) throw salarie.error;
  ids.salarie = salarie.data.id;
  const sts = await admin.from("sous_traitants").insert([{ societe_id: ALPHA, nom: "ST RLS", contact_profile_id: PROFIL_SOUS_TRAITANT, metiers: [] }, { societe_id: ALPHA, nom: "ST RLS concurrent", contact_profile_id: null, metiers: [] }]).select("id, nom");
  if (sts.error) throw sts.error;
  ids.st = sts.data.find((s) => s.nom === "ST RLS")?.id ?? "";
  ids.autreSt = sts.data.find((s) => s.nom === "ST RLS concurrent")?.id ?? "";
});

afterAll(async () => {
  if (!admin) return;
  const nettoyages = [
    admin.from("bons_commande").delete().in("id", ids.bons),
    admin.from("salaries").delete().eq("id", ids.salarie),
    admin.from("techniciens").delete().in("id", [ids.equipe, ids.autreEquipe]),
    admin.from("sous_traitants").delete().in("id", [ids.st, ids.autreSt]),
  ];
  for (const n of nettoyages) {
    const { error } = await n;
    if (error) console.warn(`Nettoyage partiel du planning : ${error.message}`);
  }
});

describe("planifier (PLN-04, PLN-06)", () => {
  it("le conducteur pose une carte : rendez-vous sur le bon, tâche avec équipe et créneau ; la journée supplémentaire suit", async () => {
    const bcId = await nouveauBon();
    const { cartes } = await lesCartes(conducteur, "");
    const carte = cartes.find((c) => c.bcId === bcId);
    if (!carte) throw new Error("carte absente");
    const equipe = { id: ids.equipe, nom: "Équipe RLS", couleur: null, metiers: [] };
    await appliquerPlan(ALPHA, bcId, planPoser(carte, JOUR, "10:00", { type: "equipe", equipe }), conducteur);
    const apres = (await lesCartes(conducteur, "")).cartes.find((c) => c.bcId === bcId);
    expect(apres?.rdv).toMatchObject({ datePlanifiee: JOUR, heurePlanifiee: "10:00", technicien: "Équipe RLS" });
    expect(apres?.equipeId).toBe(ids.equipe);
    expect(apres?.taches).toEqual([expect.objectContaining({ date_tache: JOUR, technicien_id: ids.equipe, heure_debut: "10:00", heure_fin: "11:00", statut: "planifiee" })]);
    if (!apres) return;
    await appliquerPlan(ALPHA, bcId, planAjouterDate(apres, "2026-10-07", "13:00", 2), conducteur);
    const encore = (await lesCartes(conducteur, "")).cartes.find((c) => c.bcId === bcId);
    expect(encore?.suppl).toEqual([{ date: "2026-10-07", creneau: { heure: "13:00", duree: 2 }, fait: false }]);
  });

  it("le technicien lit le planning sans aucun montant, connaît son équipe, et ne planifie pas", async () => {
    const bcId = await nouveauBon();
    const { d, cartes } = await lesCartes(technicien, PROFIL_TECHNICIEN);
    expect(d.monEquipeId).toBe(ids.equipe);
    expect(d.bons.every((b) => b.montant === null && b.montant_par_metier === null && b.montant_sous_traitant === null)).toBe(true);
    const carte = cartes.find((c) => c.bcId === bcId);
    if (!carte) throw new Error("carte absente");
    await expect(appliquerPlan(ALPHA, bcId, planPoser(carte, JOUR, "08:00", null), technicien)).rejects.toMatchObject({ code: "42501" });
  });

  it("une société ne voit rien du planning de l'autre", async () => {
    const beta = await connecte(COMPTES.adminBeta);
    const d = await lirePlanning(ALPHA, "", beta);
    expect([d.bons, d.taches, d.equipes]).toEqual([[], [], []]);
  });
});

describe("circuit de la tâche (PLN-08, PLN-31, PLN-32)", () => {
  it("l'équipe consigne, puis déclare faite ; l'état ne s'écrit pas en direct", async () => {
    const bcId = await nouveauBon();
    const tacheId = await tacheDe(bcId, { technicien_id: ids.equipe });
    await sauvegarderTerrain(tacheId, { commentaire: "Siphon changé", pieceACommander: true, pieceDescription: "Joint 40", croquis: "data:image/png;base64,AAAA" }, technicien);
    const direct = await technicien.from("planning_taches").update({ statut: "validee" }).eq("id", tacheId);
    expect(direct.error?.code).toBe("42501");
    await marquerRealisee(tacheId, "Terminé", technicien);
    const { data } = await admin.from("planning_taches").select("statut, commentaire, piece_a_commander, piece_description, croquis, realisee_par").eq("id", tacheId).single();
    expect(data).toMatchObject({ statut: "realisee", commentaire: "Terminé", piece_a_commander: true, piece_description: "Joint 40", croquis: "data:image/png;base64,AAAA", realisee_par: PROFIL_TECHNICIEN });
  });

  it("une autre équipe est refusée, en toutes lettres", async () => {
    const bcId = await nouveauBon();
    const tacheId = await tacheDe(bcId, { technicien_id: ids.autreEquipe });
    await expect(marquerRealisee(tacheId, "", technicien)).rejects.toMatchObject({ message: expect.stringMatching(/confiée à une autre équipe/) });
    await expect(sauvegarderTerrain(tacheId, { commentaire: "x", pieceACommander: false, pieceDescription: "", croquis: null }, technicien)).rejects.toMatchObject({ code: "42501" });
  });

  it("le conducteur arbitre : un refus sans motif est refusé par la base, avec motif il renvoie la tâche", async () => {
    const bcId = await nouveauBon();
    const tacheId = await tacheDe(bcId, { technicien_id: ids.equipe });
    await marquerRealisee(tacheId, "", technicien);
    await expect(validerTache(tacheId, false, "  ", conducteur)).rejects.toMatchObject({ code: "P0001", message: expect.stringMatching(/motivé/) });
    await expect(validerTache(tacheId, true, null, technicien)).rejects.toMatchObject({ code: "42501" });
    await validerTache(tacheId, false, "Joint à reprendre", conducteur);
    const { data } = await admin.from("planning_taches").select("statut, refus_motif").eq("id", tacheId).single();
    expect(data).toEqual({ statut: "refusee", refus_motif: "Joint à reprendre" });
  });
});

describe("[proposition] sous-traitant, photos et téléphone du terrain (2026092605*)", () => {
  it("le sous-traitant pointe les tâches de SON entreprise, pas celles d'un confrère", async () => {
    const bcId = await nouveauBon();
    const sienne = await tacheDe(bcId, { sous_traitant_id: ids.st });
    const autre = await tacheDe(bcId, { sous_traitant_id: ids.autreSt, date_tache: "2026-10-06" });
    const { d } = await lesCartes(sousTraitant, PROFIL_SOUS_TRAITANT);
    expect(d.monSousTraitantId).toBe(ids.st);
    await sauvegarderTerrain(sienne, { commentaire: "Posé", pieceACommander: false, pieceDescription: "", croquis: null }, sousTraitant);
    await marquerRealisee(sienne, "Posé", sousTraitant);
    await expect(marquerRealisee(autre, "", sousTraitant)).rejects.toMatchObject({ message: expect.stringMatching(/confiée à une autre équipe/) });
  });

  it("le sous-traitant lit SON montant, jamais celui du bon ni celui d'un autre bon", async () => {
    const sien = await nouveauBon();
    const autre = await nouveauBon();
    await admin.from("bons_commande").update({ montant_sous_traitant: 250 }).eq("id", sien);
    await admin.from("bons_commande").update({ montant_sous_traitant: 999 }).eq("id", autre);
    await tacheDe(sien, { sous_traitant_id: ids.st });
    const { d } = await lesCartes(sousTraitant, PROFIL_SOUS_TRAITANT);
    expect(d.montantsSousTraitant[sien]).toBe(250);
    expect(d.montantsSousTraitant[autre]).toBeUndefined();
    expect(d.bons.find((b) => b.id === sien)?.montant).toBeNull();
    const tech = await lesCartes(technicien, PROFIL_TECHNICIEN);
    expect(tech.d.montantsSousTraitant).toEqual({});
  });

  it("le sous-traitant signale un travail supplémentaire sur son bon, pas sur celui d'un autre", async () => {
    const sien = await nouveauBon();
    const autre = await nouveauBon();
    const tacheId = await tacheDe(sien, { sous_traitant_id: ids.st });
    await ajouterTravailSupplementaire(ALPHA, PROFIL_SOUS_TRAITANT, { bcId: sien, tacheId, libelle: "Reprise plinthes", origine: "technicien" }, sousTraitant);
    await expect(ajouterTravailSupplementaire(ALPHA, PROFIL_SOUS_TRAITANT, { bcId: autre, tacheId: null, libelle: "Pas chez moi", origine: "technicien" }, sousTraitant)).rejects.toMatchObject({ code: "42501" });
  });

  it("le technicien dépose et lit une photo du bon ; le rôle lecture ne peut pas l'effacer", async () => {
    const bcId = await nouveauBon();
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
    await ajouterPhoto(ALPHA, bcId, jpeg, 0, technicien);
    const photos = await photosDuBon(bcId, technicien);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.url).toMatch(/^http/);
    const photo = photos[0];
    if (!photo) return;
    const lecture = await connecte(COMPTES.lectureAlpha);
    await expect(supprimerPhoto(photo, lecture)).rejects.toMatchObject({ code: "42501" });
    await ajouterPhoto(ALPHA, bcId, jpeg, 1, sousTraitant);
    await supprimerPhoto(photo, technicien);
    expect(await photosDuBon(bcId, conducteur)).toHaveLength(1);
    const reste = await photosDuBon(bcId, admin);
    for (const p of reste) await supprimerPhoto(p, admin);
  });

  it("le terrain lit le téléphone de l'occupant, que la vue ne sert pas", async () => {
    const bcId = await nouveauBon();
    await admin.from("bons_commande").update({ telephone_locataire: "06 12 34 56 78" }).eq("id", bcId);
    const { d } = await lesCartes(technicien, PROFIL_TECHNICIEN);
    expect(d.telephones[bcId]).toBe("06 12 34 56 78");
  });
});
