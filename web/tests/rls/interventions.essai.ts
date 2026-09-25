/**
 * Rapports d'intervention contre la base LOCALE : numéro posé par la base,
 * contrôles, photos et signatures au seau, un rapport par bon, et ce que voit
 * chaque rôle (proposition 20260926052000). Tout ce qui est créé est supprimé.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerBon } from "../../src/modules/commandes/api/bons";
import { enregistrerRapport, lierBon, lireRapport, listerRapports, supprimerRapport } from "../../src/modules/interventions/api/rapports";
import { saisieInitiale } from "../../src/modules/interventions/domain/assistant";
import type { SaisieRapport } from "../../src/modules/interventions/domain/rapport";
import { clientPlanning } from "../../src/lib/supabase";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const PROFIL_SOUS_TRAITANT = "a1000000-0000-0000-0000-000000000006";
const OPAC = "a2000000-0000-0000-0000-000000000001";
let admin: Client;
let technicien: Client;
let sousTraitant: Client;
const crees: string[] = [];
let st = "";
let bon = "";
const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

const saisie = (s: Partial<SaisieRapport> = {}): SaisieRapport => ({ ...saisieInitiale("2026-09-25", "09:30", null), client_id: OPAC, client_nom: "OPAC du Rhône", metier: "plomberie", constatations: "Fuite", ...s });

async function rapport(c: Client, s: Partial<SaisieRapport> = {}, avec: { photos?: boolean; signatures?: boolean } = {}) {
  const id = await enregistrerRapport(
    ALPHA,
    null,
    saisie(s),
    avec.photos ? [{ id: null, chemin: null, fichier: jpeg(), categorie: "constatation" }] : [],
    avec.signatures ? { client: png(), technicien: png() } : {},
    null,
    c
  );
  crees.push(id);
  return id;
}

beforeAll(async () => {
  [admin, technicien, sousTraitant] = await Promise.all([connecte(COMPTES.adminAlpha), connecte(COMPTES.technicienAlpha), connecte(COMPTES.sousTraitantAlpha)]);
  const r = await admin.from("sous_traitants").insert({ societe_id: ALPHA, nom: "ST rapports RLS", contact_profile_id: PROFIL_SOUS_TRAITANT, metiers: [] }).select("id").single();
  if (r.error) throw r.error;
  st = r.data.id;
  bon = await enregistrerBon(ALPHA, null, {
    client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: null, conducteur: null, numero_bc: "RLS-RAPPORT", sans_bc: false, en_attente_bc: false,
    reference_chantier: null, date_reception: "2026-09-24", date_fin_travaux: null, nature_travaux: null, notes: null, montant: 0, adresse: "1 rue", code_postal: "69001", ville: "Lyon",
    logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  }, [], await connecte(COMPTES.conducteurAlpha));
});

afterAll(async () => {
  if (!admin) return;
  for (const id of crees) {
    try {
      await supprimerRapport(id, admin);
    } catch (e) {
      console.warn("Rapport non supprimé :", id, e);
    }
  }
  for (const n of [admin.from("bons_commande").delete().eq("id", bon), admin.from("sous_traitants").delete().eq("id", st)]) {
    const { error } = await n;
    if (error) console.warn(`Nettoyage partiel des rapports : ${error.message}`);
  }
});

describe("rapport rédigé sur le terrain (PLN-20, PLN-21)", () => {
  it("[proposition] le technicien rédige : numéro INT posé par la base, contrôles, photo et signatures au seau", async () => {
    const id = await rapport(technicien, { controles: { alim_froide: true, autre: true }, precision_autre: "Robinet" }, { photos: true, signatures: true });
    const complet = await lireRapport(id, technicien);
    expect(complet.rapport.numero).toMatch(/^INT-2026-\d{6}$/);
    expect(complet.rapport.statut).toBe("en cours");
    expect(complet.controles).toEqual({ alim_froide: true, autre: true });
    expect(complet.precisionAutre).toBe("Robinet");
    expect(complet.photos).toEqual([expect.objectContaining({ categorie: "constatation", url: expect.stringMatching(/^http/) })]);
    expect(complet.signatureClient).toMatch(/^http/);
    expect(complet.signatureTechnicien).toMatch(/^http/);
  });

  it("logement vacant : la signature du client n'est pas gardée", async () => {
    const id = await rapport(technicien, { logement_statut: "vacant", occupant: "Personne", ancien_locataire: "M. B" }, { signatures: true });
    const complet = await lireRapport(id, admin);
    expect(complet.rapport).toMatchObject({ signature_chemin: null, occupant: null, ancien_locataire: "M. B" });
    expect(complet.signatureTechnicien).toMatch(/^http/);
  });
});

describe("[proposition] émetteur sous-traitant et visibilité (PLN-52)", () => {
  it("le sous-traitant rédige au nom de SON entreprise et ne voit que ses rapports", async () => {
    const sien = await rapport(sousTraitant, { constatations: "Rapport du sous-traitant" }, { photos: true });
    const interne = await rapport(technicien, { constatations: "Rapport interne" });
    const { data } = await clientPlanning(admin).from("interventions").select("sous_traitant_id").eq("id", sien).single();
    expect(data?.sous_traitant_id).toBe(st);
    const vus = (await listerRapports(ALPHA, sousTraitant)).map((r) => r.id);
    expect(vus).toContain(sien);
    expect(vus).not.toContain(interne);
    expect((await listerRapports(ALPHA, technicien)).map((r) => r.id)).toEqual(expect.arrayContaining([sien, interne]));
    const force = await sousTraitant.from("interventions").update({ statut: "piraté" }).eq("id", interne).select("id");
    expect(force.data).toEqual([]);
  });

  it("le rôle lecture ne supprime ni un rapport ni ses contrôles", async () => {
    const id = await rapport(technicien, { controles: { joints: true } });
    const lecture = await connecte(COMPTES.lectureAlpha);
    await expect(supprimerRapport(id, lecture)).rejects.toMatchObject({ code: "42501" });
    const { data } = await lecture.from("intervention_controles").delete().eq("intervention_id", id).select("id");
    expect(data).toEqual([]);
    expect((await lireRapport(id, admin)).controles).toEqual({ joints: true });
  });
});

describe("[proposition] un rapport par bon (PLN-20)", () => {
  it("lier un second rapport au même bon délie le premier ; délier remet à vide", async () => {
    const a = await rapport(technicien, { bon_commande_id: bon });
    const b = await rapport(technicien);
    await lierBon(b, bon, technicien);
    const lus = await listerRapports(ALPHA, admin);
    expect(lus.find((r) => r.id === a)?.bon_commande_id).toBeNull();
    expect(lus.find((r) => r.id === b)?.bon_commande_id).toBe(bon);
    await lierBon(b, null, technicien);
    expect((await lireRapport(b, admin)).rapport.bon_commande_id).toBeNull();
    const doublon = await clientPlanning(admin).from("interventions").update({ bon_commande_id: bon }).in("id", [a, b]);
    expect(doublon.error?.code).toBe("23505");
  });
});
