/**
 * [proposition] Espace client, suite — 20260926042000_espace_client_bons_et_reglements.
 * Le client suit SES bons (sans montant ni note interne), lit le solde de ses
 * factures émises, et un accès nominatif ne montre que les pièces de son
 * interlocuteur.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const OPAC = "a2000000-0000-0000-0000-000000000001";
const PROFIL_CLIENT = "c1000000-0000-0000-0000-000000000001";
let client: Client;
let admin: Client;
let factureOpac: string | null = null;

beforeAll(async () => {
  client = await connecte("client.opac@erp.local");
  admin = await connecte(COMPTES.adminAlpha);
  // Une facture émise de l'OPAC, citant un interlocuteur, partiellement réglée.
  const { data } = await admin
    .from("factures")
    .insert({ societe_id: ALPHA, client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: "M. Chargé", statut: "brouillon", date: "2026-09-01" })
    .select("id")
    .single();
  factureOpac = data?.id ?? null;
  await admin.from("facture_lignes").insert({ facture_id: factureOpac ?? "", position: 0, type: "ligne", designation: "Essai espace client", quantite: 1, prix_unitaire: 100, tva: 20 });
  await admin.from("factures").update({ statut: "impayée" }).eq("id", factureOpac ?? "");
  await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: factureOpac ?? "", date: "2026-09-10", montant: 20, mode: "virement", reference: "VIR-OPAC" });
});

afterAll(async () => {
  await avecPropositions(admin).from("acces_clients").update({ interlocuteur: null }).eq("profile_id", PROFIL_CLIENT);
});

describe("[proposition] espace client : ses bons, sans rien d'interne", () => {
  it("ne voit que les bons de l'OPAC, jamais ceux de Mme Durand ni de BETA", async () => {
    const { data, error } = await avecPropositions(client).from("v_espace_client_bons").select("id, client_id, numero_bc");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const b of data ?? []) expect(b.client_id).toBe(OPAC);
    expect(data?.some((b) => b.numero_bc === "SECRET-BETA-1")).toBe(false);
  });

  it("aucun montant ni note interne n'existe dans la vue", async () => {
    for (const colonne of ["montant", "notes", "probleme_description", "conducteur", "montant_sous_traitant"]) {
      const { error } = await client.from("v_espace_client_bons" as "bons_commande").select(colonne);
      expect(error, colonne).not.toBeNull();
    }
  });

  it("un membre ne tire rien de la vue du client", async () => {
    const { data } = await avecPropositions(admin).from("v_espace_client_bons").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("[proposition] espace client : le solde de ses factures", () => {
  it("lit les règlements de SES factures émises, et donc leur reste", async () => {
    const { data: regs } = await client.from("reglements").select("facture_id, montant");
    expect(regs?.some((r) => r.facture_id === factureOpac && r.montant === 20)).toBe(true);
    const { data: s } = await avecPropositions(client).from("v_facture_solde").select("facture_id, paye, reste, cle").eq("facture_id", factureOpac ?? "").single();
    expect(s).toMatchObject({ paye: 20, reste: 100, cle: "partiellement_reglee" });
  });

  it("n'écrit aucun règlement", async () => {
    const { error } = await client.from("reglements").insert({ societe_id: ALPHA, facture_id: factureOpac ?? "", date: "2026-09-11", montant: 1, mode: "virement", reference: null });
    expect(error?.code).toBe("42501");
  });

  it("l'identité légale de l'émetteur, pour l'en-tête de ses pièces", async () => {
    const { data } = await avecPropositions(client).from("v_mes_acces_clients").select("societe_nom, societe_siret, societe_adresse");
    expect(data?.[0]?.societe_nom).toBeTruthy();
  });
});

describe("[proposition] espace client : accès nominatif (interlocuteur)", () => {
  it("un accès restreint à un interlocuteur ne montre que ses pièces", async () => {
    const maj = await avecPropositions(admin).from("acces_clients").update({ interlocuteur: "M. Chargé" }).eq("profile_id", PROFIL_CLIENT).select("id");
    expect(maj.data?.length).toBe(1);
    const { data: factures } = await client.from("factures").select("id, interlocuteur");
    // Chaque passage crée sa facture : on vérifie la règle, pas un compte.
    expect(factures?.some((f) => f.id === factureOpac)).toBe(true);
    for (const f of factures ?? []) expect(f.interlocuteur).toBe("M. Chargé");
    const { data: devis } = await client.from("devis").select("id, interlocuteur");
    for (const d of devis ?? []) expect(d.interlocuteur).toBe("M. Chargé");
    const { data: bons } = await avecPropositions(client).from("v_espace_client_bons").select("interlocuteur");
    for (const b of bons ?? []) expect(b.interlocuteur).toBe("M. Chargé");
  });

  it("le client ne modifie pas son propre accès pour s'ouvrir tout le client", async () => {
    const { data } = await avecPropositions(client).from("acces_clients").update({ interlocuteur: null }).eq("profile_id", PROFIL_CLIENT).select("id");
    expect(data ?? []).toEqual([]);
  });
});
