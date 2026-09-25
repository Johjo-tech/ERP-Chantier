/**
 * Parc — véhicules, matériel, prêts, entretiens, fichiers.
 *
 * Les tests marqués [proposition] dépendent de
 * supabase/propositions/20260926070000_vehicules_et_materiel_gardent_leurs_prets.sql
 * et échouent contre la base actuelle (vérifié avant application) : c'est le
 * défaut qu'elle corrige (D-VEH-01 à D-VEH-03).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseParc } from "../../src/lib/database.propositions";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const parc = (c: Client) => c as unknown as SupabaseClient<DatabaseParc>;
const suffixe = Date.now().toString(36).toUpperCase();
let vehiculeId = "";
let materielId = "";
const fichiers: string[] = [];

beforeAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  const v = await admin.from("vehicules").insert({ societe_id: ALPHA, immatriculation: `RLS-${suffixe}`, vendu: false, statut: "en_service" }).select("id").single();
  if (v.error) throw v.error;
  vehiculeId = v.data.id;
  const m = await admin.from("materiels").insert({ societe_id: ALPHA, nom: `Essai RLS ${suffixe}` }).select("id").single();
  if (m.error) throw m.error;
  materielId = m.data.id;
});

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (fichiers.length) await admin.storage.from("terrain").remove(fichiers);
  // Les filles partent avec leur parent (ON DELETE CASCADE).
  if (vehiculeId) await admin.from("vehicules").delete().eq("id", vehiculeId);
  if (materielId) await admin.from("materiels").delete().eq("id", materielId);
});

describe("véhicules : la fiche suit la matrice", () => {
  it("le conducteur (voir, modifier) ne crée pas de véhicule", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    const { error } = await c.from("vehicules").insert({ societe_id: ALPHA, immatriculation: `INTRUS-${suffixe}`, vendu: false, statut: "en_service" });
    expect(error?.code).toBe("42501");
  });

  it("deux véhicules ne partagent pas une plaque dans une société (VEH-02)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { error } = await admin.from("vehicules").insert({ societe_id: ALPHA, immatriculation: `RLS-${suffixe}`, vendu: false, statut: "en_service" });
    expect(error?.code).toBe("23505");
  });

  it("la date de CT a sa colonne : `date_controle_technique` (VEH-21)", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const { data, error } = await c.from("vehicules").update({ date_controle_technique: "2026-12-31" }).eq("id", vehiculeId).select("date_controle_technique").single();
    expect(error).toBeNull();
    expect(data?.date_controle_technique).toBe("2026-12-31");
  });

  it("une autre société ne voit pas le véhicule", async () => {
    const beta = await connecte(COMPTES.adminBeta);
    const { data } = await beta.from("vehicules").select("id").eq("id", vehiculeId);
    expect(data ?? []).toEqual([]);
  });
});

describe("prêts et entretiens d'un véhicule : « véhicules / modifier »", () => {
  it("[proposition] la secrétaire prête un véhicule, avec sa durée prévue", async () => {
    const c = parc(await connecte(COMPTES.secretaireAlpha));
    const { data, error } = await c
      .from("vehicule_prets")
      .insert({ vehicule_id: vehiculeId, date_debut: "2026-09-25", duree_jours: 3, etat_depart: { etat: "Bon état", marques: [{ x: 40, y: 60 }] } })
      .select("id, duree_jours, date_fin")
      .single();
    expect(error).toBeNull();
    expect(data?.duree_jours).toBe(3);
    expect(data?.date_fin).toBeNull();
  });

  it("[proposition] un second prêt en cours du même véhicule est refusé", async () => {
    const c = parc(await connecte(COMPTES.adminAlpha));
    const { error } = await c.from("vehicule_prets").insert({ vehicule_id: vehiculeId, date_debut: "2026-09-26", duree_jours: null });
    expect(error?.code).toBe("23505");
  });

  it("[proposition] une durée nulle ou négative est refusée", async () => {
    const c = parc(await connecte(COMPTES.adminAlpha));
    const { error } = await c.from("materiel_prets").insert({ materiel_id: materielId, date_debut: "2026-09-26", duree_jours: 0 });
    expect(error?.code).toBe("23514");
  });

  it("[proposition] le technicien (voir) ne note pas d'entretien", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { error } = await c.from("vehicule_entretiens").insert({ vehicule_id: vehiculeId, designation: "Intrus", montant: 0, statut: "realise" });
    expect(error?.code).toBe("42501");
  });

  it("[proposition] le rôle lecture ne supprime pas un entretien", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data: cree, error } = await admin
      .from("vehicule_entretiens")
      .insert({ vehicule_id: vehiculeId, designation: "Vidange", montant: 120.5, date_entretien: "2026-09-20", kilometrage: 1000, statut: "realise" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const lecture = await connecte(COMPTES.lectureAlpha);
    const { data } = await lecture.from("vehicule_entretiens").delete().eq("id", cree?.id ?? "").select("id");
    expect(data ?? []).toEqual([]);
    const { data: reste } = await admin.from("vehicule_entretiens").select("id").eq("id", cree?.id ?? "");
    expect(reste?.length).toBe(1);
  });
});

describe("prêts de matériel : « matériel / modifier »", () => {
  it("[proposition] la secrétaire (matériel : voir) ne prête pas de matériel", async () => {
    const c = parc(await connecte(COMPTES.secretaireAlpha));
    const { error } = await c.from("materiel_prets").insert({ materiel_id: materielId, date_debut: "2026-09-25", duree_jours: 2 });
    expect(error?.code).toBe("42501");
  });

  it("[proposition] le technicien (matériel : modifier) prête puis rend le matériel", async () => {
    const c = parc(await connecte(COMPTES.technicienAlpha));
    const { data, error } = await c.from("materiel_prets").insert({ materiel_id: materielId, date_debut: "2026-09-25", duree_jours: 2, etat_depart: "Bon état" }).select("id").single();
    expect(error).toBeNull();
    const rendu = await c.from("materiel_prets").update({ date_fin: "2026-09-26" }).eq("id", data?.id ?? "").select("id");
    expect(rendu.error).toBeNull();
    expect(rendu.data?.length).toBe(1);
  });

  it("[proposition] le rôle lecture ne supprime pas un prêt de matériel", async () => {
    const lecture = await connecte(COMPTES.lectureAlpha);
    const { data } = await lecture.from("materiel_prets").delete().eq("materiel_id", materielId).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("fichiers du parc dans le seau `terrain`", () => {
  it("[proposition] la secrétaire dépose la facture d'achat d'un véhicule", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const chemin = `${ALPHA}/vehicules/${vehiculeId}/${Date.now()}_facture.txt`;
    const { error } = await c.storage.from("terrain").upload(chemin, new Blob(["facture"], { type: "text/plain" }));
    expect(error).toBeNull();
    fichiers.push(chemin);
  });

  it("le rôle lecture ne dépose rien sous les véhicules", async () => {
    const c = await connecte(COMPTES.lectureAlpha);
    const { error } = await c.storage.from("terrain").upload(`${ALPHA}/vehicules/${vehiculeId}/${Date.now()}_intrus.txt`, new Blob(["x"], { type: "text/plain" }));
    expect(error).not.toBeNull();
  });
});
