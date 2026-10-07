/**
 * [proposition] Gestes de facturation en UNE transaction (relecture 4) :
 * 20260926130000 (supprimer un brouillon, situation comprise — B2, I2),
 * 20260926131000 (établir un avoir — I6), 20260926132000 (annuler une
 * imputation entière — I8), 20260926133000 (un bon ne se facture qu'une fois — I9).
 *
 * Chaque pièce porte « Essai RLS TXF » ; ce qui peut l'être est retiré à la
 * fin. Une facture émise ne se supprime pas (L441-9) : la base locale en garde
 * la trace, comme pour tests/rls/facturation.essai.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerBon, genererFacture } from "../../src/modules/commandes/api/bons";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import { ALPHA, COMPTES, avecPropositions, connecte, type Client } from "./cible";

const MARQUE = "Essai RLS TXF";
const CH1 = "a3000000-0000-0000-0000-000000000001";
const OPAC = "a2000000-0000-0000-0000-000000000001";
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";
const suffixe = `${Date.now()}`;
const bons: string[] = [];

let admin: Client;
let secretaire: Client;
let conducteur: Client;

beforeAll(async () => {
  [admin, secretaire, conducteur] = await Promise.all([connecte(COMPTES.adminAlpha), connecte(COMPTES.secretaireAlpha), connecte(COMPTES.conducteurAlpha)]);
});

afterAll(async () => {
  const brouillons = await admin.from("factures").delete().like("client_nom", `${MARQUE}%`).is("numero", null);
  if (brouillons.error) console.warn(`Nettoyage des brouillons : ${brouillons.error.message}`);
  if (bons.length) {
    await admin.from("factures").delete().in("bon_commande_id", bons).is("numero", null);
    const b = await admin.from("bons_commande").delete().in("id", bons);
    if (b.error) console.warn(`Nettoyage des bons : ${b.error.message}`);
  }
  const d = await admin.from("chantier_dpgf_lignes").delete().like("designation", `${MARQUE}%`);
  if (d.error) console.warn(`Nettoyage du DPGF : ${d.error.message}`);
});

async function exiger<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data === null || data === undefined) throw new Error("Aucune donnée");
  return data;
}

/** Une facture (brouillon ou émise) d'une ligne, sous un nom de client unique. */
async function facture(nom: string, ht: number, o: { emise?: boolean; type?: "facture" | "avoir" } = {}) {
  const f = await exiger(
    admin
      .from("factures")
      .insert({ societe_id: ALPHA, client_nom: `${MARQUE} ${nom} ${suffixe}`, statut: "brouillon", type_document: o.type ?? "facture", date: "2026-09-25", chantier_id: CH1 })
      .select("id")
      .single()
  );
  await exiger(admin.from("facture_lignes").insert({ facture_id: f.id, position: 0, type: "ligne", designation: "Essai", quantite: 1, prix_unitaire: ht, tva: 20 }).select("id"));
  if (!o.emise) return { id: f.id, numero: null as string | null };
  const e = await exiger(admin.from("factures").update({ statut: "impayée" }).eq("id", f.id).select("numero").single());
  return { id: f.id, numero: e.numero };
}

/** Une situation en brouillon qui a porté une ligne de DPGF de 0 à 50 %. */
async function situationBrouillon(nom: string) {
  const ligne = await exiger(
    admin
      .from("chantier_dpgf_lignes")
      .insert({ chantier_id: CH1, position: 950, type: "ligne", designation: `${MARQUE} ${nom}`, quantite: 1, prix_unitaire: 1000, unite: "u", avancement_cumule: 50, devis_source_id: null })
      .select("id")
      .single()
  );
  const f = await facture(nom, 500);
  await exiger(
    admin
      .from("chantier_avancement_factures")
      .insert({ facture_id: f.id, dpgf_ligne_id: ligne.id, avancement_avant: 0, avancement_apres: 50, montant_facture: 500 })
      .select("id")
  );
  return { factureId: f.id, ligneId: ligne.id };
}

async function avancement(ligneId: string): Promise<number> {
  return (await exiger(admin.from("chantier_dpgf_lignes").select("avancement_cumule").eq("id", ligneId).single())).avancement_cumule;
}

async function existe(factureId: string): Promise<boolean> {
  return !!(await admin.from("factures").select("id").eq("id", factureId).maybeSingle()).data;
}

const supprimer = (c: Client, id: string) => avecPropositions(c).rpc("supprimer_brouillon_facture", { p_facture: id });

describe("[proposition] supprimer un brouillon de situation : tout ou rien (B2, I2)", () => {
  it("la secrétaire supprime le brouillon et le DPGF retrouve son avancement, bien qu'elle ne le voie pas", async () => {
    const s = await situationBrouillon("secrétaire");
    // Elle n'a pas « chantiers / modifier » : la ligne du DPGF lui est cachée.
    expect((await secretaire.from("chantier_dpgf_lignes").select("id").eq("id", s.ligneId)).data).toEqual([]);
    expect((await supprimer(secretaire, s.factureId)).error).toBeNull();
    expect(await existe(s.factureId)).toBe(false);
    expect(await avancement(s.ligneId)).toBe(0);
  });

  it("émise entre-temps : la suppression est refusée ET le DPGF reste à 50 %", async () => {
    const s = await situationBrouillon("émise");
    await exiger(admin.from("factures").update({ statut: "impayée" }).eq("id", s.factureId).select("numero"));
    const { error } = await supprimer(admin, s.factureId);
    expect(error?.message).toMatch(/émise entre-temps/);
    expect(await existe(s.factureId)).toBe(true);
    expect(await avancement(s.ligneId)).toBe(50);
  });

  it("une situation plus récente s'appuie dessus : refus, rien ne bouge", async () => {
    const s = await situationBrouillon("plus récente");
    await exiger(admin.from("chantier_dpgf_lignes").update({ avancement_cumule: 80 }).eq("id", s.ligneId).select("id"));
    const { error } = await supprimer(admin, s.factureId);
    expect(error?.message).toMatch(/situation plus récente/);
    expect(await existe(s.factureId)).toBe(true);
    expect(await avancement(s.ligneId)).toBe(80);
  });

  it("sans « factures / supprimer » (conducteur) : refus motivé, rien ne bouge", async () => {
    const s = await situationBrouillon("conducteur");
    const { error } = await supprimer(conducteur, s.factureId);
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/pas le droit de supprimer/);
    expect(await existe(s.factureId)).toBe(true);
    expect(await avancement(s.ligneId)).toBe(50);
  });

  it("un brouillon ordinaire (sans situation) se supprime par le même geste", async () => {
    const f = await facture("ordinaire", 10);
    expect((await supprimer(secretaire, f.id)).error).toBeNull();
    expect(await existe(f.id)).toBe(false);
  });
});

describe("[proposition] établir un avoir d'un seul geste (I6)", () => {
  const etablir = (c: Client, id: string, motif = "Erreur de facturation (quantité ou montant)") => avecPropositions(c).rpc("etablir_avoir", { p_facture: id, p_motif: motif });

  it("l'avoir naît émis, avec les lignes et le rattachement ; un second avoir total est refusé", async () => {
    const f = await facture("avoir", 250, { emise: true });
    const { data: avoirId, error } = await etablir(secretaire, f.id);
    expect(error).toBeNull();
    const avoir = await exiger(admin.from("factures").select("numero, statut, type_document, facture_rectifiee_id, motif_rectification, client_nom").eq("id", avoirId ?? "").single());
    expect(avoir).toMatchObject({ statut: "impayée", type_document: "avoir", facture_rectifiee_id: f.id, motif_rectification: "Erreur de facturation (quantité ou montant)" });
    expect(avoir.numero).toBeTruthy();
    expect(avoir.client_nom).toContain(`${MARQUE} avoir`);
    const lignes = await exiger(admin.from("facture_lignes").select("designation, prix_unitaire, tva").eq("facture_id", avoirId ?? ""));
    expect(lignes).toEqual([{ designation: "Essai", prix_unitaire: 250, tva: 20 }]);
    const second = await etablir(admin, f.id);
    expect(second.error?.message).toMatch(/rectifient déjà cette facture/);
  });

  it("refusé sur un brouillon, sans motif, ou sans droit d'écrire — et rien n'est créé", async () => {
    const brouillon = await facture("avoir brouillon", 10);
    expect((await etablir(admin, brouillon.id)).error?.message).toMatch(/n'est pas émise/);
    const emise = await facture("avoir motif", 10, { emise: true });
    expect((await etablir(admin, emise.id, "  ")).error?.message).toMatch(/motif est obligatoire/);
    expect((await etablir(conducteur, emise.id)).error).not.toBeNull();
    const avoirs = await exiger(admin.from("factures").select("id").eq("facture_rectifiee_id", emise.id));
    expect(avoirs).toEqual([]);
  });
});

describe("[proposition] annuler une imputation : les deux moitiés ensemble (I8)", () => {
  it("retirer la moitié « avoir » retire aussi la moitié « imputation »", async () => {
    const f = await facture("imputée", 100, { emise: true });
    const a = await facture("imputée", 100, { emise: true, type: "avoir" });
    expect((await avecPropositions(admin).rpc("imputer_avoir", { p_avoir: a.id, p_facture: f.id, p_montant: 40, p_date: "2026-09-25" })).error).toBeNull();
    const moities = await exiger(admin.from("reglements").select("id, facture_id, mode").in("facture_id", [f.id, a.id]));
    expect(moities.map((m) => m.mode).sort()).toEqual(["avoir", "imputation"]);
    const surFacture = moities.find((m) => m.facture_id === f.id);
    // Sans « reglements / supprimer », rien ne part.
    expect((await avecPropositions(conducteur).rpc("annuler_imputation", { p_reglement: surFacture?.id ?? "" })).error).not.toBeNull();
    expect((await avecPropositions(admin).rpc("annuler_imputation", { p_reglement: surFacture?.id ?? "" })).error).toBeNull();
    expect(await exiger(admin.from("reglements").select("id").in("facture_id", [f.id, a.id]))).toEqual([]);
  });

  it("un règlement ordinaire n'est pas une imputation : refus", async () => {
    const f = await facture("virement", 100, { emise: true });
    const r = await exiger(admin.from("reglements").insert({ societe_id: ALPHA, facture_id: f.id, date: "2026-09-25", montant: 10, mode: "virement", reference: null }).select("id").single());
    expect((await avecPropositions(admin).rpc("annuler_imputation", { p_reglement: r.id })).error?.message).toMatch(/pas une imputation/);
  });
});

describe("[proposition] un bon ne se facture qu'une fois (I9)", () => {
  const entete: EnteteAEnregistrer = {
    client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: CONDUCTEUR, conducteur: null,
    numero_bc: "RLS-TXF", sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-25", date_fin_travaux: null,
    nature_travaux: MARQUE, notes: null, montant: 120, adresse: "1 rue de l'Essai", code_postal: "69001", ville: "Lyon",
    logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
    devis_id: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, probleme_description: null,
    metiers: [], metier: null, montant_par_metier: null,
  };

  async function bonChiffre(): Promise<string> {
    const id = await enregistrerBon(ALPHA, null, entete, [{ id: null, position: 0, type: "ligne", designation: "Travaux", quantite: 1, prix_unitaire: 120, unite: "u", tva: 10, article_reference: null, commentaire: null, metier: null, montant_ht: 120 }], admin);
    bons.push(id);
    expect((await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: id })).error).toBeNull();
    return id;
  }

  // La course elle-même se reproduit mal par HTTP (la fonction est rapide) ; ce
  // cas-ci, déterministe, est ce que le second appel voit une fois le premier passé.
  it("une facture porte déjà ce bon : la base refuse d'en créer une seconde", async () => {
    const id = await bonChiffre();
    await exiger(admin.from("factures").insert({ societe_id: ALPHA, client_nom: `${MARQUE} déjà ${suffixe}`, statut: "brouillon", date: "2026-09-25", bon_commande_id: id }).select("id"));
    await expect(genererFacture(id, admin)).rejects.toMatchObject({ message: expect.stringMatching(/Une facture existe deja/) as unknown });
    expect(await exiger(admin.from("factures").select("id").eq("bon_commande_id", id))).toHaveLength(1);
  });

  it("deux « Créer la facture » simultanés : une seule facture", async () => {
    const id = await bonChiffre();
    const issues = await Promise.allSettled([genererFacture(id, admin), genererFacture(id, secretaire)]);
    expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
    expect(await exiger(admin.from("factures").select("id").eq("bon_commande_id", id))).toHaveLength(1);
  });
});
