/**
 * [proposition] Espace client — migration 20260925030000_espace_client_en_lecture.
 * Le client ne voit que SES chantiers, ses devis envoyés et ses factures émises,
 * et n'écrit rien.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA, BETA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const OPAC = "a2000000-0000-0000-0000-000000000001";
const CHANTIER_OPAC = "a3000000-0000-0000-0000-000000000001";
let client: Client;
let brouillonOpac: string | null = null;

beforeAll(async () => {
  client = await connecte("client.opac@erp.local");
  const admin = await connecte(COMPTES.adminAlpha);
  const { data } = await admin
    .from("devis")
    .insert({ societe_id: ALPHA, numero: `ESSAI-CLIENT-${Date.now()}`, client_id: OPAC, client_nom: "OPAC du Rhône", statut: "brouillon" })
    .select("id")
    .single();
  brouillonOpac = data?.id ?? null;
});

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (brouillonOpac) await admin.from("devis").delete().eq("id", brouillonOpac);
});

describe("[proposition] espace client : ne voit que ce qui est à lui", () => {
  it("un seul client : le sien", async () => {
    const { data } = await client.from("clients").select("id");
    expect(data?.map((c) => c.id)).toEqual([OPAC]);
  });

  it("ses chantiers seulement", async () => {
    const { data } = await client.from("chantiers").select("id, client_id");
    expect(data?.map((c) => c.id)).toEqual([CHANTIER_OPAC]);
  });

  it("ses devis ENVOYÉS, jamais un brouillon ni le devis d'un autre client", async () => {
    const { data } = await client.from("devis").select("id, client_id, statut");
    expect(data?.length).toBeGreaterThan(0);
    for (const d of data ?? []) {
      expect(d.client_id).toBe(OPAC);
      expect(d.statut).not.toBe("brouillon");
    }
    expect(data?.some((d) => d.id === brouillonOpac)).toBe(false);
    const { data: lignes } = await client.from("devis_lignes").select("devis_id");
    expect(new Set(lignes?.map((l) => l.devis_id))).toEqual(new Set(data?.map((d) => d.id)));
  });

  it("les totaux calculés par la base suivent les mêmes droits", async () => {
    const { data: totaux } = await client.from("v_devis_totaux").select("devis_id, ttc");
    const { data: devis } = await client.from("devis").select("id");
    expect(new Set(totaux?.map((t) => t.devis_id))).toEqual(new Set(devis?.map((d) => d.id)));
  });

  it("ses factures ÉMISES seulement", async () => {
    const { data } = await client.from("factures").select("client_id, numero");
    for (const f of data ?? []) {
      expect(f.client_id).toBe(OPAC);
      expect(f.numero).not.toBeNull();
    }
  });

  it("rien de BETA, rien d'interne (articles, membres, bons, salariés)", async () => {
    const { data: societes } = await client.from("societes").select("id");
    expect(societes?.map((s) => s.id)).toEqual([ALPHA]);
    // Les noms de tables en union épuisent l'inférence de supabase-js : on les passe un à un.
    const tables = ["articles", "membres_societe", "v_bons_commande_terrain", "v_salaries_annuaire", "interlocuteurs", "reglements"];
    for (const table of tables) {
      const { data } = await client.from(table as "articles").select("id").limit(5);
      expect(data ?? [], table).toEqual([]);
    }
    const { data: beta } = await client.from("clients").select("id").eq("societe_id", BETA);
    expect(beta ?? []).toEqual([]);
  });
});

describe("[proposition] espace client : lecture seule", () => {
  it("n'écrit ni ne modifie ni ne supprime", async () => {
    const insert = await client.from("devis").insert({ societe_id: ALPHA, numero: "PIRATE", client_id: OPAC, client_nom: "OPAC" });
    expect(insert.error?.code).toBe("42501");
    const maj = await client.from("clients").update({ notes: "piraté" }).eq("id", OPAC).select("id");
    expect(maj.data ?? []).toEqual([]);
    const sup = await client.from("chantiers").delete().eq("id", CHANTIER_OPAC).select("id");
    expect(sup.data ?? []).toEqual([]);
    // Insertion non typée : l'inférence de supabase-js sur une table ajoutée à la main s'effondre en `never`.
    const nouvelAcces = { profile_id: "c1000000-0000-0000-0000-000000000001", client_id: "a2000000-0000-0000-0000-000000000002", societe_id: ALPHA };
    const acces = await avecPropositions(client).from("acces_clients").insert(nouvelAcces as never);
    expect(acces.error?.code).toBe("42501");
  });

  it("n'est membre d'aucune société : aucun rôle, aucun numéro", async () => {
    const { data } = await client.from("membres_societe").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await client.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" });
    expect(error?.code).toBe("42501");
  });

  it("les membres de la société ne voient pas plus qu'avant (la politique ne s'ajoute qu'aux clients d'un accès)", async () => {
    const tech = await connecte(COMPTES.technicienAlpha);
    const { data } = await tech.from("devis").select("id");
    expect(data ?? []).toEqual([]);
  });
});
