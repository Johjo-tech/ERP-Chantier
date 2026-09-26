/**
 * [proposition] Facturation en base — 20260926040000 (solde), 20260926041000
 * (statut recalé, règlement groupé, lettrage), 20260926043000 (préfixes).
 *
 * Chaque cas crée ses propres pièces, sous un nom de client unique : les
 * factures émises ne se suppriment pas (L441-9), la base locale en garde la trace.
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import * as ancienReg from "../../../src/api/regles-reglements";
import { etatPiece } from "../../src/modules/facturation/domain/etat";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

let admin: Client;
const suffixe = `${Date.now()}`;

interface Piece {
  id: string;
  numero: string;
}

async function piece(
  c: Client,
  clientNom: string,
  ht: number,
  o: { type?: "facture" | "avoir" | "note_frais"; date?: string; echeance?: string | null; acomptes?: number; retenue?: number | null } = {}
): Promise<Piece> {
  const { data, error } = await c
    .from("factures")
    .insert({
      societe_id: ALPHA,
      client_nom: clientNom,
      statut: "brouillon",
      type_document: o.type ?? "facture",
      date: o.date ?? "2026-09-01",
      echeance: o.echeance ?? null,
      acomptes_deduits: o.acomptes ?? 0,
      retenue_garantie_pourcentage: o.retenue ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const lignes = await c.from("facture_lignes").insert({ facture_id: data.id, position: 0, type: "ligne", designation: "Essai", quantite: 1, prix_unitaire: ht, tva: 0 });
  if (lignes.error) throw lignes.error;
  const emise = await c.from("factures").update({ statut: "impayée" }).eq("id", data.id).select("numero").single();
  if (emise.error) throw emise.error;
  return { id: data.id, numero: emise.data.numero ?? "" };
}

async function solde(c: Client, id: string) {
  const { data, error } = await avecPropositions(c).from("v_facture_solde").select("*").eq("facture_id", id).single();
  if (error) throw error;
  return data;
}

const sansEspaces = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "");

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
});

describe("[proposition] v_facture_solde dit vrai", () => {
  it("un avoir n'est jamais une dette : crédit disponible, du = 0 (FAC-85)", async () => {
    const av = await piece(admin, `Solde avoir ${suffixe}`, 682, { type: "avoir" });
    const s = await solde(admin, av.id);
    expect(s).toMatchObject({ etat: "Disponible", cle: "disponible", sens: -1, du: 0, credit: 682, jours_retard: null, en_retard: false });
  });

  it("une facture à 0 € est réglée, pas impayée à vie", async () => {
    const f = await piece(admin, `Solde zéro ${suffixe}`, 0);
    expect(await solde(admin, f.id)).toMatchObject({ etat: "Payée", cle: "reglee", reste: 0 });
  });

  it("acomptes déduits et retenue : la retenue non levée n'est pas un retard (FAC-93)", async () => {
    const f = await piece(admin, `Solde retenue ${suffixe}`, 1000, { date: "2026-01-01", echeance: "2026-01-31", acomptes: 400, retenue: 5 });
    const avant = await solde(admin, f.id);
    expect(avant).toMatchObject({ reste: 600, net_a_payer: 550, reste_exigible: 550, retenue: 50, en_retard: true });
    await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: f.id, date: "2026-02-01", montant: 550, mode: "virement", reference: null });
    const apres = await solde(admin, f.id);
    // La créance reste entière (la retenue sera levée plus tard) : partielle, mais plus en retard.
    expect(apres).toMatchObject({ cle: "partiellement_reglee", reste: 50, reste_exigible: 0, en_retard: false, jours_retard: null });
  });

  it("sans acompte ni retenue, la vue et l'écran (etatPiece) disent la même chose", async () => {
    const f = await piece(admin, `Solde parité ${suffixe}`, 1200, { date: "2026-08-01", echeance: "2026-09-01" });
    await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: f.id, date: "2026-09-02", montant: 500, mode: "cheque", reference: "12" });
    const s = await solde(admin, f.id);
    const e = etatPiece({ numero: f.numero, type_document: "facture", statut: "impayée", legacy_id: null, date: "2026-08-01", echeance: "2026-09-01" }, 1200, [{ montant: 500 }], s.date && s.jours_retard !== null ? addJours("2026-09-01", s.jours_retard) : "2026-09-01");
    expect(e).toMatchObject({ nature: "facture", cle: s.cle, enRetard: s.en_retard, joursRetard: s.jours_retard ?? 0 });
    expect(Number(e.nature === "facture" ? e.reste : -1)).toBe(s.reste);
  });

  it("une pièce historique « payée » ne redevient pas due (reprise)", async () => {
    // Le chemin de la reprise : brouillon « compta: » par l'admin, lignes, puis numéro et statut (relecture 4, I1).
    const { data, error } = await admin
      .from("factures")
      .insert({ societe_id: ALPHA, client_nom: `Reprise ${suffixe}`, statut: "brouillon", legacy_id: `compta:solde-${suffixe}` })
      .select("id")
      .single();
    expect(error).toBeNull();
    const lignes = await admin.from("facture_lignes").insert({ facture_id: data?.id ?? "", position: 0, type: "ligne", designation: "Historique", quantite: 1, prix_unitaire: 100, tva: 20 });
    expect(lignes.error).toBeNull();
    const numero = await admin.from("factures").update({ numero: `HIST-SOLDE-${suffixe}`, statut: "payée" }).eq("id", data?.id ?? "");
    expect(numero.error).toBeNull();
    const s = await solde(admin, data?.id ?? "");
    expect(s).toMatchObject({ cle: "reprise", etat: "Payée", reste: 0, du: 0, reprise: true });
  });
});

/** « AAAA-MM-JJ » + n jours, en UTC (pour rejouer le « aujourd'hui » de la vue). */
function addJours(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("[proposition] le statut stocké suit les règlements (déclencheur)", () => {
  it("réglée → payée ; règlement retiré → impayée", async () => {
    const f = await piece(admin, `Statut ${suffixe}`, 300);
    const { data: r } = await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: f.id, date: "2026-09-10", montant: 300, mode: "virement", reference: null }).select("id").single();
    expect((await admin.from("factures").select("statut").eq("id", f.id).single()).data?.statut).toBe("payée");
    await admin.from("reglements").delete().eq("id", r?.id ?? "");
    expect((await admin.from("factures").select("statut").eq("id", f.id).single()).data?.statut).toBe("impayée");
  });
});

describe("[proposition] enregistrer_reglement_groupe : un virement réparti, tout ou rien", () => {
  it("impute de la plus ancienne à la plus récente, comme regles-reglements.ts#imputer", async () => {
    const nom = `Groupé ${suffixe}`;
    const a = await piece(admin, nom, 100, { date: "2026-01-10" });
    const b = await piece(admin, nom, 300, { date: "2026-02-10" });
    const attendu = ancienReg.imputer(250, [
      { id: b.id, reste: 300, date: "2026-02-10", numero: b.numero },
      { id: a.id, reste: 100, date: "2026-01-10", numero: a.numero },
    ]);
    const sec = avecPropositions(await connecte(COMPTES.secretaireAlpha));
    const { data, error } = await sec.rpc("enregistrer_reglement_groupe", { p_factures: [b.id, a.id], p_montant: 250, p_date: "2026-09-20", p_mode: "virement", p_reference: "VIR-GROUPE" });
    expect(error).toBeNull();
    expect((data ?? []).map((p) => [p.facture, Number(p.part), Number(p.reste_apres)])).toEqual(attendu.map((p) => [p.id, p.montant, p.resteApres]));
    expect((await solde(admin, a.id)).cle).toBe("reglee");
    expect((await admin.from("factures").select("statut").eq("id", a.id).single()).data?.statut).toBe("payée");
    const { data: regs } = await admin.from("reglements").select("reference, date, mode").in("facture_id", [a.id, b.id]);
    expect(new Set(regs?.map((r) => `${r.reference}|${r.date}|${r.mode}`))).toEqual(new Set(["VIR-GROUPE|2026-09-20|virement"]));
  });

  it("refuse le trop-perçu avec le message de refusImputation, et n'écrit rien", async () => {
    const f = await piece(admin, `Trop-perçu ${suffixe}`, 120);
    const { error } = await avecPropositions(admin).rpc("enregistrer_reglement_groupe", { p_factures: [f.id], p_montant: 200, p_date: "2026-09-20", p_mode: "virement", p_reference: null });
    expect(sansEspaces(error?.message)).toBe(sansEspaces(ancienReg.refusImputation(200, [{ id: f.id, reste: 120 }])));
    expect((await admin.from("reglements").select("id").eq("facture_id", f.id)).data).toEqual([]);
  });

  it("un avoir dans la sélection fait tout refuser (rien n'est écrit)", async () => {
    const nom = `Groupé avoir ${suffixe}`;
    const f = await piece(admin, nom, 100);
    const av = await piece(admin, nom, 50, { type: "avoir" });
    const { error } = await avecPropositions(admin).rpc("enregistrer_reglement_groupe", { p_factures: [f.id, av.id], p_montant: 100, p_date: "2026-09-20", p_mode: "virement", p_reference: null });
    expect(error?.message).toMatch(/avoir ne s'encaisse pas/);
    expect((await admin.from("reglements").select("id").eq("facture_id", f.id)).data).toEqual([]);
  });

  it("le rôle lecture n'écrit aucun règlement (RLS)", async () => {
    const f = await piece(admin, `Lecture ${suffixe}`, 80);
    const lecture = avecPropositions(await connecte(COMPTES.lectureAlpha));
    const { error } = await lecture.rpc("enregistrer_reglement_groupe", { p_factures: [f.id], p_montant: 80, p_date: "2026-09-20", p_mode: "virement", p_reference: null });
    expect(error).not.toBeNull();
    expect((await admin.from("reglements").select("id").eq("facture_id", f.id)).data).toEqual([]);
  });
});

describe("[proposition] imputer_avoir : le lettrage refait les contrôles en base", () => {
  it("écrit les deux règlements liés et solde les deux côtés", async () => {
    const nom = `Lettrage ${suffixe}`;
    const f = await piece(admin, nom, 500);
    const av = await piece(admin, nom, 200, { type: "avoir" });
    const { error } = await avecPropositions(admin).rpc("imputer_avoir", { p_avoir: av.id, p_facture: f.id, p_montant: 200, p_date: "2026-09-21" });
    expect(error).toBeNull();
    expect(await solde(admin, f.id)).toMatchObject({ reste: 300, cle: "partiellement_reglee" });
    expect(await solde(admin, av.id)).toMatchObject({ reste: 0, cle: "impute", credit: 0 });
    const { data } = await admin.from("reglements").select("facture_id, mode, reference, montant").in("facture_id", [f.id, av.id]);
    expect(data).toEqual(expect.arrayContaining([
      { facture_id: f.id, mode: "avoir", reference: av.numero, montant: 200 },
      { facture_id: av.id, mode: "imputation", reference: f.numero, montant: 200 },
    ]));
  });

  it("mêmes refus, dans le même ordre, que regles-avoir.ts#refusImputationAvoir", async () => {
    const f = await piece(admin, `Lettrage A ${suffixe}`, 100);
    const av = await piece(admin, `Lettrage A ${suffixe}`, 40, { type: "avoir" });
    const autre = await piece(admin, `Lettrage B ${suffixe}`, 100);
    const cas: [string, string, number, Parameters<typeof ancienAvoir.refusImputationAvoir>[0]][] = [
      [av.id, f.id, 60, { avoir: { numero: av.numero, typeDocument: "avoir", clientNom: `Lettrage A ${suffixe}` }, facture: { numero: f.numero, typeDocument: "facture", clientNom: `Lettrage A ${suffixe}` }, montant: 60, resteFacture: 100, resteAvoir: 40 }],
      [av.id, autre.id, 10, { avoir: { numero: av.numero, typeDocument: "avoir", clientNom: `Lettrage A ${suffixe}` }, facture: { numero: autre.numero, typeDocument: "facture", clientNom: `Lettrage B ${suffixe}` }, montant: 10, resteFacture: 100, resteAvoir: 40 }],
      [f.id, autre.id, 10, { avoir: { numero: f.numero, typeDocument: "facture", clientNom: "" }, facture: { numero: autre.numero, typeDocument: "facture", clientNom: "" }, montant: 10, resteFacture: 100, resteAvoir: 100 }],
    ];
    for (const [a, fac, m, ancien] of cas) {
      const { error } = await avecPropositions(admin).rpc("imputer_avoir", { p_avoir: a, p_facture: fac, p_montant: m, p_date: "2026-09-21" });
      expect(sansEspaces(error?.message)).toBe(sansEspaces(ancienAvoir.refusImputationAvoir(ancien)));
    }
  });
});

describe("[proposition] préfixes de numérotation complets", () => {
  it("une note de frais sort « NDF-… » et non « NOT-… » (FAC-98)", async () => {
    const n = await piece(admin, `Note ${suffixe}`, 12, { type: "note_frais" });
    expect(n.numero).toMatch(/^NDF-2026-\d{6}$/);
  });
});
