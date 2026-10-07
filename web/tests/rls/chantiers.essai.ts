/**
 * Fiche chantier — dépend des migrations PROPOSÉES
 * 20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql et
 * 20260926021000_filles_du_chantier_suivent_la_matrice.sql. Contre la
 * production actuelle, les tests marqués [proposition] échoueraient : c'est
 * précisément ce qu'elles corrigent.
 *
 * Chaque ligne écrite porte « Essai RLS CHA » et est retirée à la fin : la base
 * locale est partagée.
 */
import { afterAll, describe, expect, it } from "vitest";
import { ALPHA, COMPTES, avecPropositions, connecte } from "./cible";

const CH1 = "a3000000-0000-0000-0000-000000000001"; // technicien affecté
const CH2 = "a3000000-0000-0000-0000-000000000002"; // technicien NON affecté
const TECHNICIEN = "a1000000-0000-0000-0000-000000000004";
const MARQUE = "Essai RLS CHA";
const fichiers: string[] = [];
const bons: string[] = [];

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  const p = avecPropositions(admin);
  await admin.from("chantier_todos").delete().like("texte", `${MARQUE}%`);
  await admin.from("chantier_achats").delete().like("designation", `${MARQUE}%`);
  await admin.from("chantier_documents").delete().like("nom", `${MARQUE}%`);
  await admin.from("chantier_comptes_rendus").delete().like("titre", `${MARQUE}%`);
  await admin.from("chantier_affectations").delete().eq("chantier_id", CH2).eq("profile_id", TECHNICIEN);
  if (bons.length) await admin.from("bons_commande").delete().in("id", bons);
  await admin.from("chantier_dpgf_lignes").delete().like("designation", `${MARQUE}%`);
  if (fichiers.length) await admin.storage.from("terrain").remove(fichiers);
  await p.from("chantiers").update({ statut: "en préparation", ppsps_lot: null, notes: null }).eq("id", CH1);
});

describe("[proposition] les champs saisis ont leur colonne", () => {
  it("statut, notes et PPSPS du chantier s'enregistrent et se relisent", async () => {
    const c = avecPropositions(await connecte(COMPTES.conducteurAlpha));
    const { error } = await c.from("chantiers").update({ statut: "en cours", ppsps_lot: "Peinture", notes: MARQUE }).eq("id", CH1);
    expect(error).toBeNull();
    const { data } = await c.from("chantiers").select("statut, ppsps_lot, notes").eq("id", CH1).single();
    expect(data).toEqual({ statut: "en cours", ppsps_lot: "Peinture", notes: MARQUE });
  });

  it("un statut hors liste est refusé", async () => {
    const c = avecPropositions(await connecte(COMPTES.conducteurAlpha));
    const { error } = await c.from("chantiers").update({ statut: "fini" }).eq("id", CH1);
    expect(error?.code).toBe("23514");
  });

  it("un compte-rendu déposé naît « non lu », puis se marque vu", async () => {
    const c = avecPropositions(await connecte(COMPTES.conducteurAlpha));
    const { data, error } = await c.from("chantier_comptes_rendus").insert({ chantier_id: CH1, titre: `${MARQUE} CR`, vu: false }).select("id, vu").single();
    expect(error).toBeNull();
    expect(data?.vu).toBe(false);
    await c.from("chantier_comptes_rendus").update({ vu: true }).eq("id", data?.id ?? "");
    const { data: relu } = await c.from("chantier_comptes_rendus").select("vu").eq("id", data?.id ?? "").single();
    expect(relu?.vu).toBe(true);
  });

  it("une ligne de DPGF porte son métier", async () => {
    const c = avecPropositions(await connecte(COMPTES.conducteurAlpha));
    const { data, error } = await c
      .from("chantier_dpgf_lignes")
      .insert({ chantier_id: CH1, position: 900, type: "ligne", designation: `${MARQUE} métier`, quantite: 1, prix_unitaire: 1, unite: "u", avancement_cumule: 0, devis_source_id: null, metier: "Peinture" })
      .select("metier")
      .single();
    expect(error).toBeNull();
    expect(data?.metier).toBe("Peinture");
  });
});

describe("to-do, documents : le terrain écrit, la lecture ne supprime pas", () => {
  it("le technicien ajoute un point de to-do sur SON chantier et ne voit pas celles des autres", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { error } = await c.from("chantier_todos").insert({ chantier_id: CH1, texte: `${MARQUE} bâcher`, statut: "a_faire", position: 0 });
    expect(error).toBeNull();
    const admin = await connecte(COMPTES.adminAlpha);
    await admin.from("chantier_todos").insert({ chantier_id: CH2, texte: `${MARQUE} ailleurs`, statut: "a_faire", position: 0 });
    const { data } = await c.from("chantier_todos").select("chantier_id").like("texte", `${MARQUE}%`);
    expect(new Set((data ?? []).map((t) => t.chantier_id))).toEqual(new Set([CH1]));
  });

  it("[proposition] le rôle lecture ne supprime ni un point de to-do, ni un document", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data: todo } = await admin.from("chantier_todos").insert({ chantier_id: CH1, texte: `${MARQUE} garder`, statut: "a_faire", position: 0 }).select("id").single();
    const { data: doc } = await admin.from("chantier_documents").insert({ chantier_id: CH1, famille: "cctp", nom: `${MARQUE} CCTP` }).select("id").single();
    const lecture = await connecte(COMPTES.lectureAlpha);
    expect((await lecture.from("chantier_todos").delete().eq("id", todo?.id ?? "").select("id")).data ?? []).toEqual([]);
    expect((await lecture.from("chantier_documents").delete().eq("id", doc?.id ?? "").select("id")).data ?? []).toEqual([]);
    const { count } = await admin.from("chantier_documents").select("id", { count: "exact", head: true }).eq("id", doc?.id ?? "");
    expect(count).toBe(1);
  });
});

describe("[proposition] achats et affectations : « chantiers / modifier »", () => {
  it("le conducteur ajoute une dépense (date sous date_achat) et la relit", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    const { data, error } = await c
      .from("chantier_achats")
      .insert({ chantier_id: CH1, designation: `${MARQUE} placo`, montant: 243.75, categorie: "salarie", heures: 7.5, date_achat: "2026-09-25" })
      .select("date_achat, montant")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ date_achat: "2026-09-25", montant: 243.75 });
  });

  it("le technicien n'ajoute pas de dépense (il ne peut pas la relire)", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { error } = await c.from("chantier_achats").insert({ chantier_id: CH1, designation: `${MARQUE} intrus`, montant: 1 });
    expect(error?.code).toBe("42501");
  });

  it("le technicien n'affecte personne ; le conducteur si, et l'affectation ouvre le chantier au terrain", async () => {
    const tech = await connecte(COMPTES.technicienAlpha);
    expect((await tech.from("chantier_affectations").insert({ chantier_id: CH1, profile_id: TECHNICIEN, societe_id: ALPHA, role_sur_chantier: MARQUE })).error?.code).toBe("42501");
    const cond = await connecte(COMPTES.conducteurAlpha);
    const { error } = await cond.from("chantier_affectations").insert({ chantier_id: CH2, profile_id: TECHNICIEN, societe_id: ALPHA, role_sur_chantier: MARQUE });
    expect(error).toBeNull();
    const { data } = await tech.from("chantiers").select("id").eq("id", CH2);
    expect(data?.length).toBe(1);
    await cond.from("chantier_affectations").delete().eq("chantier_id", CH2).eq("profile_id", TECHNICIEN);
    const { data: apres } = await tech.from("chantiers").select("id").eq("id", CH2);
    expect(apres).toEqual([]);
  });
});

describe("stockage des fichiers du chantier (bucket terrain)", () => {
  const chemin = `${ALPHA}/chantiers/${CH1}/${Date.now()}_essai-rls-cha.pdf`;

  it("le conducteur dépose, la lecture relit par URL signée, BETA non, et la lecture ne dépose pas", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const { error } = await cond.storage.from("terrain").upload(chemin, new Blob(["%PDF-1.4 essai"], { type: "application/pdf" }));
    expect(error).toBeNull();
    fichiers.push(chemin);
    const lecture = await connecte(COMPTES.lectureAlpha);
    expect((await lecture.storage.from("terrain").createSignedUrl(chemin, 60)).error).toBeNull();
    const beta = await connecte(COMPTES.adminBeta);
    expect((await beta.storage.from("terrain").createSignedUrl(chemin, 60)).data).toBeNull();
    const autre = `${ALPHA}/chantiers/${CH1}/${Date.now()}_intrus.pdf`;
    const { error: refus } = await lecture.storage.from("terrain").upload(autre, new Blob(["x"]));
    expect(refus).not.toBeNull();
  });
});

describe("planifier une quantité : un bon et sa tâche liée à la ligne (CHA-09, CHA-51)", () => {
  it("le conducteur crée le bon puis la tâche sans date qui pointe la ligne", async () => {
    const c = avecPropositions(await connecte(COMPTES.conducteurAlpha));
    const { data: ligne } = await c
      .from("chantier_dpgf_lignes")
      .insert({ chantier_id: CH1, position: 901, type: "ligne", designation: `${MARQUE} planif`, quantite: 10, prix_unitaire: 45.5, unite: "u", avancement_cumule: 0, devis_source_id: null, metier: "Peinture" })
      .select("id")
      .single();
    const { data: bon, error } = await c
      .from("bons_commande")
      .insert({ societe_id: ALPHA, client_nom: "OPAC du Rhône", numero_bc: `${MARQUE} (5/10)`, sans_bc: false, en_attente_bc: false, gratuite: false, date: "2026-09-25", statut: "en attente", metier: "Peinture", metiers: ["Peinture"], montant: 227.5, reference_chantier: "Réhabilitation bât. C" })
      .select("id, numero_interne")
      .single();
    expect(error).toBeNull();
    if (bon) bons.push(bon.id);
    expect(bon?.numero_interne).toMatch(/^[A-Z]+-\d{4}-\d{6}$/);
    const { error: e2 } = await c.from("planning_taches").insert({ societe_id: ALPHA, libelle: MARQUE, bon_commande_id: bon?.id, chantier_id: CH1, dpgf_ligne_id: ligne?.id, quantite_planifiee: 5, metier: "Peinture", statut: "planifiee", date_tache: null });
    expect(e2).toBeNull();
    const { data: taches } = await c.from("planning_taches").select("quantite_planifiee").eq("dpgf_ligne_id", ligne?.id ?? "");
    expect(taches).toEqual([{ quantite_planifiee: 5 }]);
  });
});
