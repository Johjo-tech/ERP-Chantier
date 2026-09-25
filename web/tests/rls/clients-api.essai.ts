/**
 * Les fonctions `api/` des clients et de la facture, telles quelles, contre la
 * base LOCALE (CLI-26, CLI-32, TRV-10) : la liste lue par pages avec son
 * compte, la lecture de rapprochement, et l'identité de l'acheteur recopiée
 * sur la facture. Tout ce qui est créé porte « Essai CLI » et est retiré.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({
  supabase: () => courant.client,
  supabasePropositions: () => courant.client,
  clientPlanning: () => courant.client,
}));

const clients = await import("../../src/modules/clients/api/clients");
const factures = await import("../../src/modules/facturation/api/factures");

const MARQUE = `Essai CLI ${Date.now().toString(36)}`;
let secretaire: Client;
const ids = { clients: [] as string[], factures: [] as string[] };

async function unClient(saisie: Record<string, unknown>): Promise<string> {
  const { data, error } = await secretaire.from("clients").insert({ societe_id: ALPHA, ...saisie }).select("id").single();
  if (error) throw error;
  ids.clients.push(data.id);
  return data.id;
}

const ENTETE = { interlocuteur: null, chantier_id: null, date: "2026-09-25", conducteur_id: null, remise_pourcentage: 0, echeance: null, mode_paiement: null, adresse: null };

beforeAll(async () => {
  secretaire = await connecte(COMPTES.secretaireAlpha);
  courant.client = secretaire;
});

afterAll(async () => {
  if (!secretaire) return;
  for (const id of ids.factures) await factures.supprimerBrouillon(id).catch((e: unknown) => console.warn("Brouillon d'essai non retiré :", e));
  const { error } = await secretaire.from("clients").delete().in("id", ids.clients);
  if (error) console.warn("Clients d'essai non retirés :", error);
});

describe("clients : lectures complètes et identité recopiée", () => {
  it("la liste se lit par pages jusqu'au compte exact (TRV-10)", async () => {
    await unClient({ nom: `${MARQUE} liste` });
    const liste = await clients.listerClients(ALPHA);
    const { count } = await secretaire.from("clients").select("id", { count: "exact", head: true }).eq("societe_id", ALPHA);
    expect(liste).toHaveLength(count ?? -1);
    expect(liste.some((c) => c.nom === `${MARQUE} liste`)).toBe(true);
  });

  it("la lecture de rapprochement porte nom, SIRET, SIREN, cadre et délai (CLI-32)", async () => {
    await unClient({ nom: `${MARQUE} rapprochable`, siret: "73282932000074", siren: "732829320", cadre_facturation: "B2G", delai_paiement_jours: 45, delai_paiement_mode: "fin_de_mois" });
    const trouve = (await clients.listerClientsRapprochables(ALPHA)).find((c) => c.nom === `${MARQUE} rapprochable`);
    expect(trouve).toMatchObject({ siret: "73282932000074", siren: "732829320", cadre_facturation: "B2G", delai_paiement_jours: 45, delai_paiement_mode: "fin_de_mois" });
  });

  it("la facture recopie l'identité de l'acheteur depuis sa fiche, et la suit quand on change de client (CLI-26)", async () => {
    const public_ = await unClient({ nom: `${MARQUE} mairie`, siret: "21690123100011", tva_intracom: "FR83216901231", pays_code: "FR", code_service: "SERV-42", code_routage: "ROUT-7", cadre_facturation: "B2G" });
    const particulier = await unClient({ nom: `${MARQUE} particulier`, cadre_facturation: "B2C" });
    const id = await factures.creerFacture(ALPHA, { ...ENTETE, client_id: public_, client_nom: `${MARQUE} mairie`, cadre_facturation: "B2B_national" }, []);
    ids.factures.push(id);
    const lue = async () => (await secretaire.from("factures").select("client_siret, client_siren, client_tva_intracom, client_pays_code, client_code_service, client_code_routage, cadre_facturation").eq("id", id).single()).data;
    expect(await lue()).toEqual({
      client_siret: "21690123100011", client_siren: "216901231", client_tva_intracom: "FR83216901231", client_pays_code: "FR",
      client_code_service: "SERV-42", client_code_routage: "ROUT-7", cadre_facturation: "B2B_national",
    });
    // Le cadre FOURNI par l'appelant l'emporte ; la modification, elle, relit la fiche et l'impose.
    await factures.modifierBrouillon(id, { ...ENTETE, client_id: particulier, client_nom: `${MARQUE} particulier`, cadre_facturation: "B2B_national" } as Parameters<typeof factures.modifierBrouillon>[1], []);
    expect(await lue()).toEqual({ client_siret: null, client_siren: null, client_tva_intracom: null, client_pays_code: "FR", client_code_service: null, client_code_routage: null, cadre_facturation: "B2C" });
  });
});
