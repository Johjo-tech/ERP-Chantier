/**
 * Propositions transversales 2026092610* (D-TRV-02 à D-TRV-07) et le lien
 * DPGF → planning (D-CHA-04), contre la base LOCALE. Contre la production
 * actuelle, les tests marqués [proposition] échoueraient : c'est ce qu'elles
 * corrigent.
 *
 * Tout ce qui est créé ici porte « Essai RLS TRV » (ou est suivi par id) et
 * est retiré à la fin : la base locale est partagée.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appliquerPlan, lirePlanning } from "../../src/modules/planning/api/planning";
import { construireCartes } from "../../src/modules/planning/domain/cartes";
import { planPoser } from "../../src/modules/planning/domain/planification";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseTransversal } from "../../src/lib/database.propositions";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const trv = (c: Client) => c as unknown as SupabaseClient<DatabaseTransversal>;

const MARQUE = "Essai RLS TRV";
const CH1 = "a3000000-0000-0000-0000-000000000001"; // technicien affecté (jeu d'essai)
const CH2 = "a3000000-0000-0000-0000-000000000002"; // technicien NON affecté
const PROFIL_TECHNICIEN = "a1000000-0000-0000-0000-000000000004";
const PROFIL_SOUS_TRAITANT = "a1000000-0000-0000-0000-000000000006";
const JPEG = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

let admin: Client;
let conducteur: Client;
let technicien: Client;
let sousTraitant: Client;
let lecture: Client;
const ids = { bons: [] as string[], salaries: [] as string[], st: "", autreSt: "", fichiers: [] as string[], lignesDpgf: [] as string[], fournisseur: "", entrante: "", cycle: "" };

function suivi<T extends { id: string }>(r: { data: T | null; error: unknown }, liste: string[]): string {
  if (r.error || !r.data) throw r.error ?? new Error("Ligne attendue absente.");
  liste.push(r.data.id);
  return r.data.id;
}

async function unBon(): Promise<string> {
  const r = await admin
    .from("bons_commande")
    .insert({ societe_id: ALPHA, client_nom: MARQUE, numero_bc: MARQUE, sans_bc: false, en_attente_bc: false, gratuite: false, date: "2026-09-25", statut: "en attente", metier: "Peinture", metiers: ["Peinture"], montant: 100 })
    .select("id")
    .single();
  return suivi(r, ids.bons);
}

async function deposer(chemin: string): Promise<void> {
  const { error } = await admin.storage.from("terrain").upload(chemin, JPEG());
  if (error) throw error;
  ids.fichiers.push(chemin);
}

const lit = async (c: Client, chemin: string) => (await c.storage.from("terrain").createSignedUrl(chemin, 60)).error === null;

beforeAll(async () => {
  [admin, conducteur, technicien, sousTraitant, lecture] = await Promise.all([
    connecte(COMPTES.adminAlpha),
    connecte(COMPTES.conducteurAlpha),
    connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.sousTraitantAlpha),
    connecte(COMPTES.lectureAlpha),
  ]);
  const sts = await admin
    .from("sous_traitants")
    .insert([{ societe_id: ALPHA, nom: `${MARQUE} ST`, contact_profile_id: PROFIL_SOUS_TRAITANT, metiers: [] }, { societe_id: ALPHA, nom: `${MARQUE} confrère`, contact_profile_id: null, metiers: [] }])
    .select("id, nom");
  if (sts.error) throw sts.error;
  ids.st = sts.data.find((s) => s.nom.endsWith("ST"))?.id ?? "";
  ids.autreSt = sts.data.find((s) => s.nom.endsWith("confrère"))?.id ?? "";
});

afterAll(async () => {
  if (!admin) return;
  const nettoyages = [
    ids.fichiers.length ? admin.storage.from("terrain").remove(ids.fichiers) : null,
    admin.from("bons_commande").delete().in("id", ids.bons),
    admin.from("chantier_dpgf_lignes").delete().in("id", ids.lignesDpgf),
    admin.from("salaries").delete().in("id", ids.salaries),
    admin.from("sous_traitants").delete().in("id", [ids.st, ids.autreSt]),
    ids.fournisseur ? admin.from("fournisseurs_controle").delete().eq("id", ids.fournisseur) : null,
    ids.entrante ? admin.from("factures_entrantes").delete().eq("id", ids.entrante) : null,
    ids.cycle ? admin.from("facture_cycle_vie").delete().eq("id", ids.cycle) : null,
  ];
  for (const n of nettoyages) {
    if (!n) continue;
    const { error } = await n;
    if (error) console.warn(`Nettoyage partiel (transversal) : ${error.message}`);
  }
});

describe("D-CHA-04 — le bon né du DPGF : le planning DATE sa tâche, il n'en crée pas une seconde", () => {
  it("poser la carte date la tâche sans date et garde son lien à la ligne", async () => {
    const c = avecPropositions(conducteur);
    const ligne = await c
      .from("chantier_dpgf_lignes")
      .insert({ chantier_id: CH1, position: 950, type: "ligne", designation: `${MARQUE} planif`, quantite: 10, prix_unitaire: 20, unite: "u", avancement_cumule: 0, devis_source_id: null, metier: "Peinture" })
      .select("id")
      .single();
    const ligneId = suivi(ligne, ids.lignesDpgf);
    // Les deux écritures de `chantiers/api/planification.ts#planifierQuantite`.
    const bon = await conducteur
      .from("bons_commande")
      .insert({ societe_id: ALPHA, client_nom: MARQUE, numero_bc: `${MARQUE} (4/10)`, sans_bc: false, en_attente_bc: false, gratuite: false, date: "2026-09-25", statut: "en attente", metier: "Peinture", metiers: ["Peinture"], montant: 80, reference_chantier: MARQUE })
      .select("id")
      .single();
    const bcId = suivi(bon, ids.bons);
    const tache = await c
      .from("planning_taches")
      .insert({ societe_id: ALPHA, libelle: MARQUE, bon_commande_id: bcId, chantier_id: CH1, dpgf_ligne_id: ligneId, quantite_planifiee: 4, metier: "Peinture", statut: "planifiee", date_tache: null })
      .select("id")
      .single();
    expect(tache.error).toBeNull();

    const d = await lirePlanning(ALPHA, "", conducteur);
    const carte = construireCartes(d.bons, d.taches, d).find((x) => x.bcId === bcId);
    if (!carte) throw new Error("carte du bon né du DPGF absente");
    await appliquerPlan(ALPHA, bcId, planPoser(carte, "2026-10-12", "09:00", null), conducteur);

    const { data: taches } = await c.from("planning_taches").select("id, date_tache, dpgf_ligne_id, quantite_planifiee").eq("bon_commande_id", bcId);
    expect(taches).toEqual([{ id: tache.data?.id, date_tache: "2026-10-12", dpgf_ligne_id: ligneId, quantite_planifiee: 4 }]);
  });
});

describe("[proposition] seau terrain : le terrain ne lit que ses fichiers (20260926100000)", () => {
  it("chantier : le technicien lit celui où il est affecté, pas l'autre ; la lecture lit tout", async () => {
    const affecte = `${ALPHA}/chantiers/${CH1}/${Date.now()}_trv-affecte.jpg`;
    const autre = `${ALPHA}/chantiers/${CH2}/${Date.now()}_trv-autre.jpg`;
    await deposer(affecte);
    await deposer(autre);
    expect(await lit(technicien, affecte)).toBe(true);
    expect(await lit(technicien, autre)).toBe(false);
    expect(await lit(lecture, autre)).toBe(true);
    expect(await lit(conducteur, autre)).toBe(true);
  });

  it("dossier RH : jamais celui d'un collègue (le sien, selon la règle RH qui s'y ajoute)", async () => {
    suivi(await admin.from("salaries").insert({ societe_id: ALPHA, nom: MARQUE, prenom: "Lui", profile_id: PROFIL_TECHNICIEN, actif: true }).select("id").single(), ids.salaries);
    const collegue = suivi(await admin.from("salaries").insert({ societe_id: ALPHA, nom: MARQUE, prenom: "Collègue", profile_id: null, actif: true }).select("id").single(), ids.salaries);
    const pasSien = `${ALPHA}/salaries/${collegue}/${Date.now()}_visite.jpg`;
    await deposer(pasSien);
    expect(await lit(technicien, pasSien)).toBe(false);
    expect(await lit(sousTraitant, pasSien)).toBe(false);
    expect(await lit(admin, pasSien)).toBe(true);
  });

  it("bon : le sous-traitant lit les photos des bons où il a une tâche, pas celles d'un confrère", async () => {
    const sien = await unBon();
    const autre = await unBon();
    const t = await admin.from("planning_taches").insert([
      { societe_id: ALPHA, bon_commande_id: sien, libelle: MARQUE, metier: "Peinture", statut: "planifiee", date_tache: null, sous_traitant_id: ids.st },
      { societe_id: ALPHA, bon_commande_id: autre, libelle: MARQUE, metier: "Peinture", statut: "planifiee", date_tache: null, sous_traitant_id: ids.autreSt },
    ]);
    expect(t.error).toBeNull();
    const photoSienne = `${ALPHA}/bons/${sien}/${crypto.randomUUID()}.jpg`;
    const photoAutre = `${ALPHA}/bons/${autre}/${crypto.randomUUID()}.jpg`;
    await deposer(photoSienne);
    await deposer(photoAutre);
    expect(await lit(sousTraitant, photoSienne)).toBe(true);
    expect(await lit(sousTraitant, photoAutre)).toBe(false);
    // Le technicien voit tous les bons au planning : il en lit les photos.
    expect(await lit(technicien, photoAutre)).toBe(true);
  });

  it("logo de la société : lisible par tout membre ; domaine inconnu : refusé au terrain", async () => {
    const logo = `${ALPHA}/societe/${Date.now()}_logo-trv.jpg`;
    const inconnu = `${ALPHA}/divers/${crypto.randomUUID()}/${Date.now()}_x.jpg`;
    await deposer(logo);
    await deposer(inconnu);
    expect(await lit(technicien, logo)).toBe(true);
    expect(await lit(sousTraitant, logo)).toBe(true);
    expect(await lit(technicien, inconnu)).toBe(false);
    expect(await lit(lecture, inconnu)).toBe(true);
  });
});

describe("[proposition] suppression des filles restantes (20260926101000)", () => {
  it("le rôle lecture ne supprime plus une ligne du cycle de vie, d'une facture reçue ni d'un contrôle fournisseur", async () => {
    const { data: facture } = await admin.from("factures").select("id").eq("societe_id", ALPHA).limit(1).single();
    if (!facture) throw new Error("facture du jeu d'essai absente");
    const cycle = await admin.from("facture_cycle_vie").insert({ facture_id: facture.id, statut: "brouillon" }).select("id").single();
    ids.cycle = cycle.data?.id ?? "";
    const fournisseur = await admin.from("fournisseurs_controle").insert({ societe_id: ALPHA, nom: MARQUE }).select("id").single();
    ids.fournisseur = fournisseur.data?.id ?? "";
    const ligneF = await admin.from("fournisseur_controle_lignes").insert({ fournisseur_id: ids.fournisseur, origine: "reference", designation: MARQUE }).select("id").single();
    const entrante = await admin.from("factures_entrantes").insert({ societe_id: ALPHA }).select("id").single();
    ids.entrante = entrante.data?.id ?? "";
    const ligneE = await admin.from("facture_entrante_lignes").insert({ facture_entrante_id: ids.entrante, designation: MARQUE }).select("id").single();
    for (const r of [cycle, fournisseur, ligneF, entrante, ligneE]) expect(r.error).toBeNull();

    const cibles = [
      ["facture_cycle_vie", ids.cycle],
      ["fournisseur_controle_lignes", ligneF.data?.id ?? ""],
      ["facture_entrante_lignes", ligneE.data?.id ?? ""],
    ] as const;
    for (const [table, id] of cibles) {
      expect((await lecture.from(table).select("id").eq("id", id)).data, `${table} lisible par la lecture`).toHaveLength(1);
      const { data } = await lecture.from(table).delete().eq("id", id).select("id");
      expect(data, `${table} : la lecture ne supprime pas`).toEqual([]);
      const parAdmin = await admin.from(table).delete().eq("id", id).select("id");
      expect(parAdmin.data, `${table} : l'admin supprime`).toHaveLength(1);
    }
    ids.cycle = "";
  });
});

describe("[proposition] tâches du sous-traitant (20260926102000)", () => {
  it("le sous-traitant ne lit que SES tâches ; le technicien lit toute la société", async () => {
    const bcId = await unBon();
    const { error } = await admin.from("planning_taches").insert([
      { societe_id: ALPHA, bon_commande_id: bcId, libelle: `${MARQUE} sienne`, metier: "Peinture", statut: "planifiee", date_tache: "2026-10-13", sous_traitant_id: ids.st },
      { societe_id: ALPHA, bon_commande_id: bcId, libelle: `${MARQUE} confrère`, metier: "Peinture", statut: "planifiee", date_tache: "2026-10-14", sous_traitant_id: ids.autreSt },
      { societe_id: ALPHA, bon_commande_id: bcId, libelle: `${MARQUE} interne`, metier: "Peinture", statut: "planifiee", date_tache: "2026-10-15", sous_traitant_id: null },
    ]);
    expect(error).toBeNull();
    const libelles = async (c: Client) => ((await c.from("planning_taches").select("libelle").eq("bon_commande_id", bcId).order("libelle")).data ?? []).map((t) => t.libelle);
    expect(await libelles(sousTraitant)).toEqual([`${MARQUE} sienne`]);
    expect(await libelles(technicien)).toHaveLength(3);
    expect(await libelles(lecture)).toHaveLength(3);
  });
});

describe("[proposition] journal du circuit (20260926103000)", () => {
  it("aucun membre n'y écrit une transition à la main, pas même l'administrateur", async () => {
    const bcId = await unBon();
    for (const c of [lecture, admin]) {
      const { error } = await c.from("workflow_journal").insert({ societe_id: ALPHA, entite: "bon_commande", entite_id: bcId, ancien_statut: "chiffre", nouveau_statut: "facture", motif: MARQUE });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("[proposition] Alsace-Moselle (20260926105000)", () => {
  it("la colonne existe, faux par défaut ; seul l'administrateur la change", async () => {
    const p = trv(admin);
    const { data } = await p.from("societes").select("feries_alsace_moselle").eq("id", ALPHA).single();
    expect(data?.feries_alsace_moselle).toBe(false);
    const refus = await trv(conducteur).from("societes").update({ feries_alsace_moselle: true }).eq("id", ALPHA).select("id");
    expect(refus.data ?? []).toEqual([]);
    const ok = await p.from("societes").update({ feries_alsace_moselle: true }).eq("id", ALPHA).select("feries_alsace_moselle");
    expect(ok.data).toEqual([{ feries_alsace_moselle: true }]);
    await p.from("societes").update({ feries_alsace_moselle: false }).eq("id", ALPHA);
  });
});

describe("[proposition] accès clients gérés par l'administrateur (20260926106000)", () => {
  const OPAC = "a2000000-0000-0000-0000-000000000001";
  const AUTRE_CLIENT = "a2000000-0000-0000-0000-000000000002";
  const COMPTE_CLIENT = "client.opac@erp.local";

  it("l'admin liste les accès avec le compte ; les autres rôles sont refusés", async () => {
    const { data, error } = await trv(admin).rpc("acces_clients_de_la_societe", { p_societe: ALPHA });
    expect(error).toBeNull();
    expect(data?.some((a) => a.compte_email === COMPTE_CLIENT && a.client_id === OPAC)).toBe(true);
    for (const c of [conducteur, lecture]) {
      expect((await trv(c).rpc("acces_clients_de_la_societe", { p_societe: ALPHA })).error?.code).toBe("42501");
    }
  });

  it("ouvrir : compte absent, compte membre, ouvert, déjà ouvert, rouvert après fermeture", async () => {
    const p = trv(admin);
    const ouvrir = async (email: string, client = AUTRE_CLIENT) => (await p.rpc("ouvrir_acces_client", { p_client: client, p_email: email, p_interlocuteur: " " })).data;
    expect(await ouvrir("personne@nulle-part.local")).toBe("compte_absent");
    expect(await ouvrir(COMPTES.lectureAlpha)).toBe("compte_membre");
    expect(await ouvrir(` ${COMPTE_CLIENT.toUpperCase()} `)).toBe("ouvert");
    expect(await ouvrir(COMPTE_CLIENT)).toBe("deja_ouvert");
    const { data: acces } = await p.from("acces_clients").update({ actif: false }).eq("client_id", AUTRE_CLIENT).select("id, interlocuteur");
    expect(acces).toEqual([{ id: expect.any(String), interlocuteur: null }]);
    expect(await ouvrir(COMPTE_CLIENT)).toBe("rouvert");
    const retrait = await p.from("acces_clients").delete().eq("client_id", AUTRE_CLIENT).select("id");
    expect(retrait.data).toHaveLength(1);
  });

  it("le conducteur n'ouvre pas d'accès ; BETA non plus sur un client d'ALPHA", async () => {
    const beta = await connecte(COMPTES.adminBeta);
    for (const c of [conducteur, beta]) {
      const { error } = await trv(c).rpc("ouvrir_acces_client", { p_client: AUTRE_CLIENT, p_email: COMPTE_CLIENT, p_interlocuteur: null });
      expect(error?.code).toBe("42501");
    }
  });
});
