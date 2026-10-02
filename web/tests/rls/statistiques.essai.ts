/**
 * Tableaux de bord et statistiques, sous la RLS de chaque table (voie choisie
 * en D-STA-B-01 : le calcul reste dans le navigateur, mais ses montants sont
 * ceux de la BASE — `v_facture_totaux`, `v_devis_totaux`, `v_facture_solde` —
 * et ses défauts sont corrigés). Aucune fonction `stats_*` : la proposition
 * 20260926080000 reste retirée.
 *
 * Les pièces sont datées de février 2012 et portent un nom de client unique :
 * la base locale est partagée, un mois que personne d'autre n'emploie rend les
 * sommes exactes (mesurées en écart). Les factures émises ne se suppriment pas
 * (L441-9) ; les bons créés ici sont retirés à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lireBons, lireConducteurs, lireFactures, lireReglements, lireTaches, lireTravaux } from "../../src/modules/statistiques/api/collections";
import { bonsDuConducteur, maFicheConducteur } from "../../src/modules/statistiques/api/conducteur";
import { restantDu, resumeDuMois, revenuPlage } from "../../src/modules/statistiques/domain/tableau";
import type { SoldeStats } from "../../src/modules/statistiques/domain/pieces";
import { statsParConducteur } from "../../src/modules/statistiques/domain/statistiques";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const suffixe = `${Date.now()}`;
const CLIENT = `Stats ${suffixe}`;
const FEVRIER = { du: "2012-02-01", au: "2012-02-29" };
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";
const NOM_CONDUCTEUR = "Christophe Conducteur";
const COMPTE_CONDUCTEUR = "a1000000-0000-0000-0000-000000000003";

let admin: Client;
const bonsCrees: string[] = [];

async function piece(ht: number, o: { type?: "facture" | "avoir" | "acompte"; emise?: boolean; bon?: string | null } = {}): Promise<string> {
  const { data, error } = await admin
    .from("factures")
    .insert({ societe_id: ALPHA, client_nom: CLIENT, statut: "brouillon", type_document: o.type ?? "facture", date: "2012-02-14", echeance: "2012-02-20", acomptes_deduits: 0, retenue_garantie_pourcentage: null, bon_commande_id: o.bon ?? null, conducteur_id: CONDUCTEUR })
    .select("id")
    .single();
  if (error) throw error;
  const l = await admin.from("facture_lignes").insert({ facture_id: data.id, position: 0, type: "ligne", designation: "Essai", quantite: 1, prix_unitaire: ht, tva: 0 });
  if (l.error) throw l.error;
  if (o.emise !== false) {
    const e = await admin.from("factures").update({ statut: "impayée" }).eq("id", data.id);
    if (e.error) throw e.error;
  }
  return data.id;
}

async function bon(dateFin: string | null = "2012-01-10"): Promise<string> {
  const { data, error } = await admin
    .from("bons_commande")
    .insert({ societe_id: ALPHA, client_nom: CLIENT, conducteur_id: CONDUCTEUR, numero_bc: `STATS-${suffixe}-${bonsCrees.length}`, sans_bc: false, en_attente_bc: false, date: "2012-02-01", date_fin_travaux: dateFin, metiers: ["Peinture"], metier: "Peinture", adresse: "1 rue des Stats", gratuite: false })
    .select("id")
    .single();
  if (error) throw error;
  bonsCrees.push(data.id);
  return data.id;
}

let facture: string;
let avoir: string;
/** Ce que février 2012 portait déjà (passages précédents) : on mesure l'apport de CE passage. */
let avant = { total: "0", nombre: 0 };
const caDeFevrier = async (c: Client) => {
  const r = revenuPlage(await lireFactures(ALPHA, c), FEVRIER.du, FEVRIER.au);
  return { total: r.total.toString(), nombre: r.nombre };
};

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
  avant = await caDeFevrier(admin);
  facture = await piece(1000);
  avoir = await piece(200, { type: "avoir" });
  await piece(500, { type: "acompte" });
  await piece(700, { emise: false });
  const r = await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: facture, date: "2012-02-16", montant: 300, mode: "virement", reference: null });
  if (r.error) throw r.error;
  const { error } = await avecPropositions(admin).rpc("imputer_avoir", { p_avoir: avoir, p_facture: facture, p_montant: 100, p_date: "2012-02-17" });
  if (error) throw error;
});

afterAll(async () => {
  if (!bonsCrees.length) return;
  for (const [table, colonne] of [["tache_travaux_supplementaires", "bon_commande_id"], ["factures", "bon_commande_id"], ["bons_commande", "id"]] as const) {
    const { error } = await admin.from(table).delete().in(colonne, bonsCrees);
    if (error) console.warn(`Nettoyage partiel de ${table} : ${error.message}`);
  }
});

describe("chiffre d'affaires : les pièces émises, le HT de la base (DEF-STA-01)", () => {
  it("ni brouillon ni acompte, avoir en négatif — le HT lu dans v_facture_totaux", async () => {
    const apres = await caDeFevrier(admin);
    // 1 000 − 200 ; l'acompte de 500 et le brouillon de 700 n'y entrent pas.
    expect(Number(apres.total) - Number(avant.total)).toBe(800);
    expect(apres.nombre - avant.nombre).toBe(2);
    const lue = (await lireFactures(ALPHA, admin)).find((f) => f.id === facture);
    expect(lue?.ht.toString()).toBe("1000");
  });
});

describe("[proposition 20260926040000] restant dû et encaissé : le solde de la base, les règlements du mois (DEF-STA-02, 03)", () => {
  it("le dû de la facture est celui de v_facture_solde : 1 000 − 300 réglés − 100 lettrés", async () => {
    // Les colonnes que lit le tableau de bord (`SoldeStats`), sous le compte admin : la même vue que l'écran des factures.
    const { data, error } = await avecPropositions(admin).from("v_facture_solde").select("facture_id, cle, sens, ttc, du, en_retard").in("facture_id", [facture, avoir]);
    if (error) throw error;
    const soldes = (data ?? []).map((s) => ({ facture_id: s.facture_id ?? "", cle: (s.cle ?? "brouillon") as SoldeStats["cle"], sens: s.sens ?? 1, ttc: s.ttc ?? 0, du: s.du ?? 0, en_retard: s.en_retard === true }));
    expect(soldes).toHaveLength(2);
    // L'avoir ne doit rien : son crédit n'est pas une dette.
    expect(restantDu(soldes).toString()).toBe("600");
  });

  it("l'encaissé de février 2012 : le règlement de 300, pas les deux moitiés du lettrage", async () => {
    const reglements = (await lireReglements(ALPHA, admin)).filter((r) => r.facture_id === facture || r.facture_id === avoir);
    // `imputer_avoir` écrit le lettrage (mode « imputation », et sa jumelle « avoir » sur l'avoir) à côté du virement.
    expect(reglements.some((r) => r.mode === "imputation")).toBe(true);
    const factures = (await lireFactures(ALPHA, admin)).filter((f) => f.client_nom === CLIENT);
    expect(resumeDuMois(factures, [], reglements, [], "2012-02-20", []).encaisseMois.toString()).toBe("300");
  });
});

describe("statistiques par la référence du conducteur (DEF-STA-08, 09, 11)", () => {
  it("un bon désigné par une facture n'est pas en retard ; son travail supplémentaire chiffré compte", async () => {
    const id = await bon("2012-01-10");
    await piece(50, { bon: id, emise: false });
    const t = await admin.from("tache_travaux_supplementaires").insert({ societe_id: ALPHA, bon_commande_id: id, planning_tache_id: null, libelle: "Siphon", quantite: 2, unite: "u", prix_vente_ht: 45, tva: 10, origine: "conducteur", statut: "chiffre" });
    if (t.error) throw t.error;
    const [bons, conducteurs, taches, travaux, factures] = await Promise.all([lireBons(ALPHA, admin), lireConducteurs(ALPHA, admin), lireTaches(ALPHA, admin), lireTravaux(ALPHA, admin), lireFactures(ALPHA, admin)]);
    const lu = bons.find((b) => b.id === id);
    expect(lu?.conducteur_id).toBe(CONDUCTEUR);
    const lignes = statsParConducteur({ bons: bons.filter((b) => b.id === id), devis: [], factures, conducteurs, taches, travaux }, "tout", "2026-09-25", new Date("2026-09-25T10:00:00Z"));
    expect(lignes.find((l) => l.cle === CONDUCTEUR)).toMatchObject({ nom: NOM_CONDUCTEUR, bcTotal: 1, bcEnRetard: 0, nbTravSup: 1, tauxTravSup: 100 });
    expect(lignes.find((l) => l.cle === CONDUCTEUR)?.montantTravSup.toString()).toBe("90");
  });
});

describe("chacun ne lit que ce que la RLS lui ouvre", () => {
  it.each([COMPTES.technicienAlpha, COMPTES.sousTraitantAlpha, COMPTES.adminBeta])("%s ne voit aucune facture de ce passage", async (email) => {
    const c = await connecte(email);
    expect((await lireFactures(ALPHA, c)).filter((f) => f.client_nom === CLIENT)).toEqual([]);
  });

  it.each([COMPTES.secretaireAlpha, COMPTES.lectureAlpha])("%s lit les factures et leur HT (v_facture_totaux)", async (email) => {
    const c = await connecte(email);
    expect(await caDeFevrier(c)).toEqual(await caDeFevrier(admin));
  });

  it("le conducteur ouvre les statistiques : factures, totaux, tâches et travaux supplémentaires lui sont lisibles", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    await expect(lireFactures(ALPHA, c)).resolves.toBeInstanceOf(Array);
    await expect(lireTaches(ALPHA, c)).resolves.toBeInstanceOf(Array);
    await expect(lireTravaux(ALPHA, c)).resolves.toBeInstanceOf(Array);
  });

  it("le conducteur ne lit pas les règlements : pour lui, rien n'est réglé", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    expect((await lireReglements(ALPHA, c)).filter((r) => r.facture_id === facture)).toEqual([]);
  });
});

describe("tableau du conducteur : ses affaires par sa fiche, sans montant", () => {
  it("la fiche se trouve par le compte, et ses bons par sa référence", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const fiche = await maFicheConducteur(ALPHA, COMPTE_CONDUCTEUR, cond);
    expect(fiche?.id).toBe(CONDUCTEUR);
    const id = await bon();
    const bons = await bonsDuConducteur(ALPHA, CONDUCTEUR, cond);
    expect(bons.every((b) => b.conducteur_id === CONDUCTEUR)).toBe(true);
    const b = bons.find((x) => x.id === id);
    expect(b).toBeDefined();
    expect(b && "montant" in b).toBe(false);
  });
});
