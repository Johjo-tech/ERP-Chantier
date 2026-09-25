/**
 * [proposition] Agrégats des tableaux de bord et des statistiques —
 * 20260926080000_statistiques_de_pilotage.sql.
 *
 * Les pièces sont datées de février 2012 et portent un nom de client unique :
 * la base locale est partagée, un mois que personne d'autre n'emploie rend les
 * sommes exactes. Les factures émises ne se suppriment pas (L441-9) ; les bons
 * créés ici sont retirés à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lireActivite, lireCaParMois, lireIndicateurs, lireParClient, lireParConducteur, lireParMetier } from "../../src/modules/statistiques/api/statistiques";
import { bonsDuConducteur, maFicheConducteur } from "../../src/modules/statistiques/api/conducteur";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const suffixe = `${Date.now()}`;
const CLIENT = `Stats ${suffixe}`;
const MOIS = { du: "2012-02-01", au: "2012-02-29" };
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";
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

async function bon(metiers: string[], dateFin: string | null = "2012-01-10"): Promise<string> {
  const { data, error } = await admin
    .from("bons_commande")
    .insert({ societe_id: ALPHA, client_nom: CLIENT, conducteur_id: CONDUCTEUR, numero_bc: `STATS-${suffixe}`, sans_bc: false, en_attente_bc: false, date: "2012-02-01", date_fin_travaux: dateFin, metiers, metier: metiers[0] ?? null, adresse: "1 rue des Stats", gratuite: false })
    .select("id")
    .single();
  if (error) throw error;
  bonsCrees.push(data.id);
  return data.id;
}

let facture: string;
let avoir: string;
/** Ce que février 2012 portait déjà (passages précédents) : on mesure l'apport de CE passage. */
let avant = { ca: 0, nb: 0, encaisse: 0 };

const caDeFevrier = async (c: Client) => {
  const f = (await lireCaParMois(ALPHA, MOIS, c)).find((l) => l.mois.startsWith("2012-02"));
  return { ca: Number(f?.ht.toString() ?? 0), nb: f?.nb ?? 0 };
};
const encaisseDeFevrier = async (c: Client) => Number((await lireIndicateurs(ALPHA, "2012-02-25", c)).encaisse_mois.toString());

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
  avant = { ...(await caDeFevrier(admin)), encaisse: await encaisseDeFevrier(admin) };
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
  for (const [table, colonne] of [["factures", "bon_commande_id"], ["bons_commande", "id"]] as const) {
    const { error } = await admin.from(table).delete().in(colonne, bonsCrees);
    if (error) console.warn(`Nettoyage partiel de ${table} : ${error.message}`);
  }
});

describe("[proposition] stats : le chiffre d'affaires ne compte que des factures", () => {
  it("émises seulement, avoir en négatif, ni brouillon ni acompte (STA-21)", async () => {
    const apres = await caDeFevrier(admin);
    // 1 000 − 200 ; l'acompte (500) et le brouillon (700) ne comptent pas.
    expect(apres.ca - avant.ca).toBe(800);
    expect(apres.nb - avant.nb).toBe(2);
  });

  it("par client : CA, restant dû sans les avoirs, groupé par le nom faute de fiche", async () => {
    const lignes = await lireParClient(ALPHA, MOIS, null, admin);
    const c = lignes.find((l) => l.client_nom === CLIENT);
    expect(c).toBeDefined();
    expect(Number(c?.ht.toString())).toBe(800);
    expect(c?.nb_factures).toBe(2);
    // 1 000 − 300 réglés − 100 lettrés ; le crédit restant de l'avoir n'est pas une dette.
    expect(Number(c?.du.toString())).toBe(600);
  });
});

describe("[proposition] stats : « encaissé » = ce qui est entré en caisse dans le mois", () => {
  it("les règlements datés du mois, sans le lettrage d'un avoir (STA-21)", async () => {
    expect((await encaisseDeFevrier(admin)) - avant.encaisse).toBe(300);
  });

  it("l'activité récente ne montre pas un lettrage comme un paiement", async () => {
    const a = await lireActivite(ALPHA, 50, admin);
    expect(a.some((x) => x.nature === "reglement" && x.facture_id === avoir)).toBe(false);
  });
});

describe("[proposition] stats : un bon facturé n'est plus « en retard » (STA-22)", () => {
  it("stats_bon_ouvert : ouvert, puis fermé par la facture qui le désigne", async () => {
    const id = await bon(["Zinguerie"]);
    const ouvert = async () => {
      const { data, error } = await admin.rpc("stats_bon_ouvert" as never, { p_bon: id, p_statut_workflow: "en_cours" } as never);
      if (error) throw error;
      return data as unknown as boolean;
    };
    expect(await ouvert()).toBe(true);
    await piece(50, { bon: id, emise: false });
    expect(await ouvert()).toBe(false);
  });

  it("par métier : un bon compte dans chacun de ses métiers", async () => {
    const metier = `Métier ${suffixe}`;
    await bon([metier, `${metier} bis`], "2000-01-01");
    const jour = new Date().toISOString().slice(0, 10);
    const lignes = await lireParMetier(ALPHA, { du: null, au: null }, jour, admin);
    expect(lignes.find((l) => l.metier === metier)).toMatchObject({ bons: 1, sav: 0, en_retard: 1 });
    expect(lignes.find((l) => l.metier === `${metier} bis`)).toMatchObject({ bons: 1 });
  });

  it("par conducteur : par la référence, avec le nom de sa fiche", async () => {
    const lignes = await lireParConducteur(ALPHA, { du: null, au: null }, "2026-09-25", admin);
    expect(lignes.find((l) => l.conducteur_id === CONDUCTEUR)?.nom).toBe("Christophe Conducteur");
  });
});

describe("[proposition] stats : la garde « statistiques / voir »", () => {
  it.each([COMPTES.technicienAlpha, COMPTES.sousTraitantAlpha, COMPTES.adminBeta])("%s est refusé", async (email) => {
    const c = await connecte(email);
    await expect(lireIndicateurs(ALPHA, "2012-02-25", c)).rejects.toMatchObject({ code: "42501" });
    await expect(lireCaParMois(ALPHA, MOIS, c)).rejects.toMatchObject({ code: "42501" });
  });

  it.each([COMPTES.secretaireAlpha, COMPTES.lectureAlpha, COMPTES.conducteurAlpha])("%s y a accès, sous la RLS de chaque table", async (email) => {
    const c = await connecte(email);
    // Le conducteur ne lit pas les règlements : rien n'est « entré en caisse » pour lui.
    expect(await encaisseDeFevrier(c)).toBe(email === COMPTES.conducteurAlpha ? 0 : await encaisseDeFevrier(admin));
  });
});

describe("tableau du conducteur : ses affaires par sa fiche, sans montant", () => {
  it("la fiche se trouve par le compte, et ses bons par sa référence", async () => {
    const cond = await connecte(COMPTES.conducteurAlpha);
    const fiche = await maFicheConducteur(ALPHA, COMPTE_CONDUCTEUR, cond);
    expect(fiche?.id).toBe(CONDUCTEUR);
    const id = await bon(["Peinture"]);
    const bons = await bonsDuConducteur(ALPHA, CONDUCTEUR, cond);
    expect(bons.every((b) => b.conducteur_id === CONDUCTEUR)).toBe(true);
    const b = bons.find((x) => x.id === id);
    expect(b).toBeDefined();
    expect(b && "montant" in b).toBe(false);
  });
});
