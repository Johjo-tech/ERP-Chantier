/**
 * RH (section 12, PAR-06, AUTH-44) : ce que la base accorde à chaque rôle sur
 * les salariés, leurs dossiers, visites, absences, équipes et sous-traitants.
 * Tout ce qui est créé ici l'est par l'administrateur d'ALPHA et retiré à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA, BETA, COMPTES, connecte } from "./cible";

let salarieId = "";
const sousTraitants: string[] = [];
const equipes: string[] = [];
const conducteurs: string[] = [];
const fichiers: string[] = [];

beforeAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  const { data, error } = await admin
    .from("salaries")
    .insert({ societe_id: ALPHA, nom: `Essai RLS RH ${Date.now()}`, prenom: "Jean", actif: true, salaire_mensuel_net: 1850, cout_horaire_charge: 32.5, notes: "note privée", legacy_id: null })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Salarié d'essai non créé : ${error?.message}`);
  salarieId = data.id;
  // Une visite pose l'échéance sur la fiche (déclencheur) : c'est elle que l'annuaire doit taire.
  const visite = await admin.from("salarie_visites_medicales").insert({ salarie_id: salarieId, date_visite: "2026-01-10", type: "embauche", suivi: "simple", prochaine_visite: "2031-01-10" });
  if (visite.error) throw new Error(`Visite d'essai non créée : ${visite.error.message}`);
});

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (fichiers.length) await admin.storage.from("terrain").remove(fichiers);
  if (conducteurs.length) await admin.from("conducteurs").delete().in("id", conducteurs);
  if (sousTraitants.length) await admin.from("sous_traitants").delete().in("id", sousTraitants);
  if (equipes.length) await admin.from("techniciens").delete().in("id", equipes);
  if (salarieId) await admin.from("salaries").delete().eq("id", salarieId);
});

describe("salariés : la table suit `rh / modifier`, l'annuaire masque le sensible (RH-11)", () => {
  it("administrateur et secrétaire lisent la fiche complète", async () => {
    for (const compte of [COMPTES.adminAlpha, COMPTES.secretaireAlpha]) {
      const c = await connecte(compte);
      const { data, error } = await c.from("salaries").select("id, salaire_mensuel_net").eq("id", salarieId);
      expect(error, compte).toBeNull();
      expect(Number(data?.[0]?.salaire_mensuel_net), compte).toBe(1850);
    }
  });

  it("conducteur, technicien, lecture et sous-traitant ne lisent pas la table", async () => {
    for (const compte of [COMPTES.conducteurAlpha, COMPTES.technicienAlpha, COMPTES.lectureAlpha, COMPTES.sousTraitantAlpha]) {
      const c = await connecte(compte);
      const { data } = await c.from("salaries").select("id").eq("id", salarieId);
      expect(data ?? [], compte).toEqual([]);
    }
  });

  it("par l'annuaire, le conducteur voit la personne mais ni salaire ni coût", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    const { data } = await c.from("v_salaries_annuaire").select("id, prenom, salaire_mensuel_net, cout_horaire_charge").eq("id", salarieId);
    expect(data).toEqual([{ id: salarieId, prenom: "Jean", salaire_mensuel_net: null, cout_horaire_charge: null }]);
  });

  it("[proposition] l'annuaire tait aussi le suivi médical et les notes hors RH (20260926060000)", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { data } = await c.from("v_salaries_annuaire").select("visite_medicale_date, visite_medicale_prochaine, notes").eq("id", salarieId);
    expect(data).toEqual([{ visite_medicale_date: null, visite_medicale_prochaine: null, notes: null }]);
    const admin = await connecte(COMPTES.adminAlpha);
    const vu = await admin.from("v_salaries_annuaire").select("visite_medicale_prochaine, notes").eq("id", salarieId);
    expect(vu.data).toEqual([{ visite_medicale_prochaine: "2031-01-10", notes: "note privée" }]);
  });

  it("BETA ne voit pas le salarié d'ALPHA, même par l'annuaire", async () => {
    const c = await connecte(COMPTES.adminBeta);
    const { data } = await c.from("v_salaries_annuaire").select("id").eq("id", salarieId);
    expect(data ?? []).toEqual([]);
  });
});

describe("dossier, visites, absences : réservés à qui tient les dossiers", () => {
  it("la secrétaire dépose un document au dossier ; le conducteur ne le lit pas", async () => {
    const s = await connecte(COMPTES.secretaireAlpha);
    const ajout = await s.from("salarie_documents").insert({ salarie_id: salarieId, type: "contrat", nom: "Contrat" }).select("id").single();
    expect(ajout.error).toBeNull();
    const c = await connecte(COMPTES.conducteurAlpha);
    const lu = await c.from("salarie_documents").select("id").eq("salarie_id", salarieId);
    expect(lu.data ?? []).toEqual([]);
  });

  it("le technicien ne lit pas le registre des visites", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { data } = await c.from("salarie_visites_medicales").select("id").eq("salarie_id", salarieId);
    expect(data ?? []).toEqual([]);
  });

  it("une absence saisie par la secrétaire est relue (elle ne se perd plus au rechargement — RH-20)", async () => {
    const s = await connecte(COMPTES.secretaireAlpha);
    const ajout = await s
      .from("salarie_absences")
      .insert({ salarie_id: salarieId, type: "Congé payé", date_debut: "2026-10-05", date_fin: "2026-10-09", nb_jours: 5, statut: "approuvee", legacy_id: null })
      .select("id")
      .single();
    expect(ajout.error).toBeNull();
    const relu = await s.from("salarie_absences").select("nb_jours").eq("id", ajout.data?.id ?? "");
    expect(Number(relu.data?.[0]?.nb_jours)).toBe(5);
    const lecture = await connecte(COMPTES.lectureAlpha);
    const intrus = await lecture.from("salarie_absences").insert({ salarie_id: salarieId, type: "Congé payé", date_debut: "2026-10-05", date_fin: "2026-10-05", statut: "approuvee" });
    expect(intrus.error?.code).toBe("42501");
  });

  it("[proposition] une absence qui finit avant de commencer est refusée par la base (RH-08)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { error } = await admin.from("salarie_absences").insert({ salarie_id: salarieId, type: "Congé payé", date_debut: "2026-10-10", date_fin: "2026-10-01", statut: "approuvee" });
    expect(error?.code).toBe("23514");
  });
});

describe("[proposition] le dossier RH du seau `terrain` suit `rh / modifier` (20260926060000)", () => {
  const chemin = () => `${ALPHA}/salaries/${salarieId}/essai-rls-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;

  it("la secrétaire dépose et retire une pièce du dossier (`peut_ecrire` l'en empêchait)", async () => {
    const s = await connecte(COMPTES.secretaireAlpha);
    const c = chemin();
    const depot = await s.storage.from("terrain").upload(c, new Blob(["contrat"], { type: "text/plain" }));
    expect(depot.error).toBeNull();
    const retrait = await s.storage.from("terrain").remove([c]);
    expect(retrait.error).toBeNull();
    expect(retrait.data?.length).toBe(1);
  });

  it("le technicien et le sous-traitant ne lisent ni ne déposent sous `salaries/`", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const c = chemin();
    fichiers.push(c);
    expect((await admin.storage.from("terrain").upload(c, new Blob(["rib"], { type: "text/plain" }))).error).toBeNull();
    for (const compte of [COMPTES.technicienAlpha, COMPTES.sousTraitantAlpha, COMPTES.conducteurAlpha]) {
      const x = await connecte(compte);
      const lecture = await x.storage.from("terrain").download(c);
      expect(lecture.data, compte).toBeNull();
      const depot = await x.storage.from("terrain").upload(chemin(), new Blob(["intrus"], { type: "text/plain" }));
      expect(depot.error, compte).not.toBeNull();
    }
  });

  it("le reste du seau garde ses règles : le technicien dépose toujours sous un autre dossier", async () => {
    const t = await connecte(COMPTES.technicienAlpha);
    const c = `${ALPHA}/chantiers/essai-rls-rh/${Date.now()}.txt`;
    const depot = await t.storage.from("terrain").upload(c, new Blob(["photo"], { type: "text/plain" }));
    expect(depot.error).toBeNull();
    fichiers.push(c);
  });
});

describe("équipes, sous-traitants, fiche conducteur : `peut_ecrire` (D-RH-05)", () => {
  it("l'administrateur crée une équipe et y rattache le salarié ; la secrétaire ne crée pas d'équipe", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const e = await admin.from("techniciens").insert({ societe_id: ALPHA, nom: "Équipe RLS", metiers: ["Peinture"], metier: "Peinture", couleur: "#112233" }).select("id").single();
    expect(e.error).toBeNull();
    if (e.data) equipes.push(e.data.id);
    const s = await connecte(COMPTES.secretaireAlpha);
    const rattache = await s.from("salaries").update({ technicien_id: e.data?.id ?? null }).eq("id", salarieId).select("id");
    expect(rattache.data?.length).toBe(1);
    const intrus = await s.from("techniciens").insert({ societe_id: ALPHA, nom: "Intrus", metiers: [] });
    expect(intrus.error?.code).toBe("42501");
  });

  it("le sous-traitant se relie à un compte (AUTH-44) ; BETA n'y touche pas", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const st = await admin.from("sous_traitants").insert({ societe_id: ALPHA, nom: "ST RLS", metiers: [], pays_code: "FR" }).select("id").single();
    expect(st.error).toBeNull();
    if (st.data) sousTraitants.push(st.data.id);
    const moi = (await admin.auth.getUser()).data.user?.id ?? null;
    const lien = await admin.from("sous_traitants").update({ contact_profile_id: moi }).eq("id", st.data?.id ?? "").select("contact_profile_id");
    expect(lien.data?.[0]?.contact_profile_id).toBe(moi);
    const beta = await connecte(COMPTES.adminBeta);
    const intrus = await beta.from("sous_traitants").update({ nom: "Volé" }).eq("id", st.data?.id ?? "").select("id");
    expect(intrus.data ?? []).toEqual([]);
    expect(BETA).not.toBe(ALPHA);
  });

  it("[proposition] le rôle lecture n'efface plus les documents d'un sous-traitant (AUTH-71)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const st = sousTraitants[0] ?? "";
    const d = await admin.from("sous_traitant_documents").insert({ sous_traitant_id: st, nom: "Assurance décennale", type: "Assurance décennale", date_validite: "2027-01-01" }).select("id").single();
    expect(d.error).toBeNull();
    const lecture = await connecte(COMPTES.lectureAlpha);
    const efface = await lecture.from("sous_traitant_documents").delete().eq("id", d.data?.id ?? "").select("id");
    expect(efface.data ?? []).toEqual([]);
    const retrait = await admin.from("sous_traitant_documents").delete().eq("id", d.data?.id ?? "").select("id");
    expect(retrait.data?.length).toBe(1);
  });

  it("cocher « Conducteur » : l'administrateur crée la fiche liée, la retire (actif = false) ; la secrétaire ne peut pas", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const f = await admin.from("conducteurs").insert({ societe_id: ALPHA, nom: "Jean Essai", salarie_id: salarieId, actif: true, profile_id: null, legacy_id: null }).select("id").single();
    expect(f.error).toBeNull();
    if (f.data) conducteurs.push(f.data.id);
    const retire = await admin.from("conducteurs").update({ actif: false }).eq("id", f.data?.id ?? "").select("actif");
    expect(retire.data?.[0]?.actif).toBe(false);
    const s = await connecte(COMPTES.secretaireAlpha);
    const intrus = await s.from("conducteurs").update({ actif: true }).eq("id", f.data?.id ?? "").select("id");
    expect(intrus.data ?? []).toEqual([]);
  });
});
