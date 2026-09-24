/**
 * Numérotation : personne ne consomme la série d'une société dont il n'est pas membre.
 *
 * [proposition] 20260925015000 : en PRODUCTION aujourd'hui, `peut_ecrire()` rend
 * NULL pour un non-membre et la garde `if not peut_ecrire(...)` de
 * `prochain_numero` laisse passer. Ces tests échouent contre la production
 * actuelle — c'est la faille que la proposition corrige.
 */
import { describe, expect, it } from "vitest";
import { ALPHA, BETA, COMPTES, connecte } from "./cible";

describe("[proposition] prochain_numero ne sert que les membres autorisés", () => {
  it("l'admin de BETA n'obtient pas de numéro d'ALPHA", async () => {
    const c = await connecte(COMPTES.adminBeta);
    const { data, error } = await c.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("un compte client (non membre) n'obtient aucun numéro", async () => {
    const c = await connecte("client.opac@erp.local");
    const { error } = await c.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" });
    expect(error?.code).toBe("42501");
  });

  it("l'admin d'ALPHA en obtient un dans sa société, pas dans BETA", async () => {
    const c = await connecte(COMPTES.adminAlpha);
    expect((await c.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" })).error).toBeNull();
    expect((await c.rpc("prochain_numero", { p_societe: BETA, p_type: "devis" })).error?.code).toBe("42501");
  });
});

describe("[proposition] le numéro d'une facture ne se fournit pas", () => {
  it("un INSERT « émis » avec son propre numéro est refusé", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const { error } = await c.from("factures").insert({ societe_id: ALPHA, client_nom: "Intrus", numero: "FAC-2026-999999", statut: "impayée" });
    expect(error?.message).toMatch(/ne se fournit pas/);
  });

  it("poser un numéro à la main sur un brouillon est refusé", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const { data } = await c.from("factures").insert({ societe_id: ALPHA, client_nom: "Essai numéro", statut: "brouillon" }).select("id").single();
    const { error } = await c.from("factures").update({ numero: "FAC-2026-888888" }).eq("id", data?.id ?? "");
    expect(error?.message).toMatch(/ne se fournit pas/);
    await c.from("factures").delete().eq("id", data?.id ?? "");
  });

  it("la reprise de l'historique comptable garde son numéro d'origine", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const legacy = `compta:essai-${Date.now()}`;
    const { data, error } = await c.from("factures").insert({ societe_id: ALPHA, client_nom: "Reprise", numero: `HIST-${Date.now()}`, statut: "brouillon", legacy_id: legacy }).select("id").single();
    expect(error).toBeNull();
    await c.from("factures").delete().eq("id", data?.id ?? "");
  });
});
