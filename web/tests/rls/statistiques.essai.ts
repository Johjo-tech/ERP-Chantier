/**
 * Tableaux de bord et statistiques : les collections lues comme l'ancien
 * (`api/collections.ts`) et calculées comme l'ancien (D-STA-A-01), sous la
 * RLS de chaque table. La proposition 20260926080000 (fonctions `stats_*`)
 * est RETIRÉE : ces cas remplacent ceux qui l'éprouvaient.
 *
 * Les pièces sont datées de février 2012 et portent un nom de client unique :
 * la base locale est partagée, un mois que personne d'autre n'emploie rend les
 * sommes exactes (mesurées en écart). Les factures émises ne se suppriment pas
 * (L441-9) ; les bons créés ici sont retirés à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lireBons, lireFactures, lireReglements } from "../../src/modules/statistiques/api/collections";
import { bonsDuConducteur, maFicheConducteur } from "../../src/modules/statistiques/api/conducteur";
import { statutReglementFacture } from "../../src/modules/statistiques/domain/ancien/montants";
import { revenuPlage } from "../../src/modules/statistiques/domain/ancien/pilotage";
import { statsParConducteur } from "../../src/modules/statistiques/domain/ancien/statistiques";
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
    .insert({ societe_id: ALPHA, client_nom: CLIENT, statut: "brouillon", type_document: o.type ?? "facture", date: "2012-02-14", echeance: "2012-02-20", acomptes_deduits: 0, retenue_garantie_pourcentage: null, bon_commande_id: o.bon ?? null })
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
    .insert({ societe_id: ALPHA, client_nom: CLIENT, conducteur_id: CONDUCTEUR, numero_bc: `STATS-${suffixe}`, sans_bc: false, en_attente_bc: false, date: "2012-02-01", date_fin_travaux: dateFin, metiers: ["Peinture"], metier: "Peinture", adresse: "1 rue des Stats", gratuite: false })
    .select("id")
    .single();
  if (error) throw error;
  bonsCrees.push(data.id);
  return data.id;
}

let facture: string;
/** Ce que février 2012 portait déjà (passages précédents) : on mesure l'apport de CE passage. */
let avant = { total: 0, nombre: 0 };
const caDeFevrier = async (c: Client) => revenuPlage(await lireFactures(ALPHA, c), FEVRIER.du, FEVRIER.au);

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
  avant = await caDeFevrier(admin);
  facture = await piece(1000);
  const avoir = await piece(200, { type: "avoir" });
  await piece(500, { type: "acompte" });
  await piece(700, { emise: false });
  const r = await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: facture, date: "2012-02-16", montant: 300, mode: "virement", reference: null });
  if (r.error) throw r.error;
  const { error } = await avecPropositions(admin).rpc("imputer_avoir", { p_avoir: avoir, p_facture: facture, p_montant: 100, p_date: "2012-02-17" });
  if (error) throw error;
});

afterAll(async () => {
  if (!bonsCrees.length) return;
  for (const [table, colonne] of [["factures", "bon_commande_id"], ["bons_commande", "id"]] as const) {
    const { error } = await admin.from(table).delete().in(colonne, bonsCrees);
    if (error) console.warn(`Nettoyage partiel de ${table} : ${error.message}`);
  }
});

describe("chiffre d'affaires : toutes les factures, comme l'ancien (DEF-STA-01)", () => {
  it("brouillon et acompte compris, avoir en négatif, lignes lues avec leur facture", async () => {
    const apres = await caDeFevrier(admin);
    // 1 000 − 200 + 500 (acompte) + 700 (brouillon).
    expect(apres.total - avant.total).toBe(2000);
    expect(apres.nombre - avant.nombre).toBe(4);
  });

  it("restant dû : les règlements ET le lettrage de l'avoir comptent comme payé", async () => {
    const f = (await lireFactures(ALPHA, admin)).find((x) => x.id === facture);
    expect(f).toBeDefined();
    const reglements = (await lireReglements(ALPHA, admin)).filter((r) => r.facture_id === facture);
    // 1 000 − 300 réglés − 100 lettrés.
    expect(f && statutReglementFacture(f, reglements)).toEqual({ cle: "partiellement_reglee", reste: 600 });
  });
});

describe("statistiques par l'étiquette du conducteur (DEF-STA-08, 09)", () => {
  it("un bon facturé dont la fin de travaux est passée compte « en retard »", async () => {
    const id = await bon("2012-01-10");
    await piece(50, { bon: id, emise: false });
    const bons = await lireBons(ALPHA, admin);
    const lu = bons.find((b) => b.id === id);
    // L'étiquette est tenue par la base d'après la fiche : c'est elle qui groupe.
    expect(lu?.conducteur).toBe(NOM_CONDUCTEUR);
    const ligne = statsParConducteur({ bons: bons.filter((b) => b.id === id), devis: [], factures: [], conducteurs: [] }, "tout", "2026-09-25", new Date("2026-09-25T10:00:00Z"))[0];
    expect(ligne).toMatchObject({ nom: NOM_CONDUCTEUR, bcTotal: 1, bcEnRetard: 1 });
  });
});

describe("chacun ne lit que ce que la RLS lui ouvre", () => {
  it.each([COMPTES.technicienAlpha, COMPTES.sousTraitantAlpha, COMPTES.adminBeta])("%s ne voit aucune facture de ce passage", async (email) => {
    const c = await connecte(email);
    expect((await lireFactures(ALPHA, c)).filter((f) => f.client_nom === CLIENT)).toEqual([]);
  });

  it.each([COMPTES.secretaireAlpha, COMPTES.lectureAlpha])("%s lit les factures et leurs lignes", async (email) => {
    const c = await connecte(email);
    expect((await caDeFevrier(c)).total).toBe((await caDeFevrier(admin)).total);
  });

  it("le conducteur ouvre les statistiques : la lecture des factures ne lui est pas refusée", async () => {
    const c = await connecte(COMPTES.conducteurAlpha);
    await expect(lireFactures(ALPHA, c)).resolves.toBeInstanceOf(Array);
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
