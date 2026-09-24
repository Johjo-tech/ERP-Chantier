/**
 * Tables filles — dépend de la migration PROPOSÉE
 * supabase/propositions/20260925010000_filles_suivent_la_matrice.sql.
 * Contre la production actuelle, les tests marqués [proposition] échoueraient :
 * c'est précisément le défaut qu'elle corrige (voir docs/tests-rls.md).
 */
import { afterAll, describe, expect, it } from "vitest";
import { COMPTES, connecte } from "./cible";

const CLIENT_ALPHA = "a2000000-0000-0000-0000-000000000003";
const CHANTIER_ALPHA = "a3000000-0000-0000-0000-000000000001";
const crees: string[] = [];

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (crees.length) await admin.from("interlocuteurs").delete().in("id", crees);
  await admin.from("chantier_dpgf_lignes").delete().eq("chantier_id", CHANTIER_ALPHA).like("designation", "Essai RLS%");
});

describe("interlocuteurs : les droits du module clients", () => {
  it("[proposition] la secrétaire (clients/modifier) ajoute un interlocuteur", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const { data, error } = await c.from("interlocuteurs").insert({ client_id: CLIENT_ALPHA, nom: "Essai RLS" }).select("id").single();
    expect(error).toBeNull();
    if (data) crees.push(data.id);
  });

  it("[proposition] le rôle lecture ne supprime pas un interlocuteur", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data: cree } = await admin.from("interlocuteurs").insert({ client_id: CLIENT_ALPHA, nom: "Essai RLS 2" }).select("id").single();
    if (cree) crees.push(cree.id);
    const lecture = await connecte(COMPTES.lectureAlpha);
    const { data } = await lecture.from("interlocuteurs").delete().eq("id", cree?.id ?? "").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("[proposition] le technicien n'ajoute pas d'interlocuteur", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { error } = await c.from("interlocuteurs").insert({ client_id: CLIENT_ALPHA, nom: "Intrus" });
    expect(error?.code).toBe("42501");
  });
});

describe("DPGF : réservé à « chantiers / modifier »", () => {
  const ligne = { chantier_id: CHANTIER_ALPHA, position: 99, type: "ligne" as const, designation: "Essai RLS DPGF", quantite: 2, prix_unitaire: 50, unite: "u", avancement_cumule: 0 };

  it("le conducteur écrit et lit le DPGF", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    const { error } = await c.from("chantier_dpgf_lignes").insert(ligne);
    expect(error).toBeNull();
    const { data } = await c.from("chantier_dpgf_lignes").select("id").eq("chantier_id", CHANTIER_ALPHA);
    expect(data?.length).toBeGreaterThan(0);
  });

  it("technicien, secrétaire et lecture ne lisent pas les prix du DPGF", async () => {
    for (const compte of [COMPTES.technicienAlpha, COMPTES.secretaireAlpha, COMPTES.lectureAlpha]) {
      const c = await connecte(compte);
      const { data } = await c.from("chantier_dpgf_lignes").select("id, prix_unitaire").eq("chantier_id", CHANTIER_ALPHA);
      expect(data ?? [], compte).toEqual([]);
    }
  });

  it("[proposition] le technicien n'écrit pas dans le DPGF", async () => {
    const c = await connecte(COMPTES.technicienAlpha);
    const { error } = await c.from("chantier_dpgf_lignes").insert({ ...ligne, designation: "Essai RLS intrus" });
    expect(error?.code).toBe("42501");
  });
});
