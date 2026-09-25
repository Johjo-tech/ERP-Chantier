/**
 * Imports, reprise d'historique, sauvegarde et lecture de la facture
 * électronique contre la base LOCALE, par les fonctions `api/` telles que
 * l'écran les emploie (IMP-14, IMP-22, IMP-40, EFA-02, EFA-22).
 *
 * Les clients écrits portent le préfixe ESSAI-IMP et disparaissent à la fin.
 * Les pièces reprises, elles, sont numérotées donc INDESTRUCTIBLES (c'est ce
 * qu'on vérifie) : leurs numéros portent un horodatage unique.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({ supabase: () => courant.client, supabasePropositions: () => courant.client }));

const clientsApi = await import("../../src/modules/import-export/api/clients");
const facturesApi = await import("../../src/modules/import-export/api/factures");
const { construireSauvegarde } = await import("../../src/modules/import-export/api/sauvegarde");
const { lireSourcesEmission, preparerEmission } = await import("../../src/modules/efacture/api/emission");
const { analyserExportFactures } = await import("../../src/modules/import-export/domain/factures");
const { construireApercuFactures } = await import("../../src/modules/import-export/domain/apercu-factures");

const suffixe = `${Date.now()}`;
const PREFIXE = `ESSAI-IMP-${suffixe}`;
let secretaire: Client;
let lecture: Client;
let admin: Client;

beforeAll(async () => {
  [secretaire, lecture, admin] = await Promise.all([connecte(COMPTES.secretaireAlpha), connecte(COMPTES.lectureAlpha), connecte(COMPTES.adminAlpha)]);
});

afterAll(async () => {
  await secretaire.from("clients").delete().like("nom", `${PREFIXE}%`);
});

describe("import de clients (IMP-14)", () => {
  it("créations par lots de 200 à clés uniformisées : une ligne sans téléphone ne fait pas tomber le lot", async () => {
    courant.client = secretaire;
    const aCreer = Array.from({ length: 205 }, (_, i) => ({
      nom: `${PREFIXE}-${i}`,
      pays_code: "FR",
      ...(i % 2 ? { telephone: "0476000000" } : {}),
      ...(i === 3 ? { delai_paiement_jours: 0, delai_paiement_mode: "net" as const } : {}),
    }));
    const r = await clientsApi.importerClients(ALPHA, aCreer, []);
    expect(r).toEqual({ crees: 205, misAJour: 0, echecs: [] });
    const { data } = await secretaire.from("clients").select("nom, delai_paiement_jours, cadre_facturation").like("nom", `${PREFIXE}-%`);
    expect(data).toHaveLength(205);
    expect(data?.find((c) => c.nom === `${PREFIXE}-3`)?.delai_paiement_jours).toBe(0);
  });

  it("une mise à jour n'écrit que ce que le fichier renseigne (D-EFA-07)", async () => {
    courant.client = secretaire;
    const existants = await clientsApi.clientsRapprochables(ALPHA);
    const cible = existants.find((c) => c.nom === `${PREFIXE}-1`);
    expect(cible).toBeDefined();
    const r = await clientsApi.importerClients(ALPHA, [], [{ id: cible?.id ?? "", nom: cible?.nom ?? "", valeurs: { email: "compta@exemple.fr" } }]);
    expect(r.misAJour).toBe(1);
    const { data } = await secretaire.from("clients").select("email, telephone").eq("id", cible?.id ?? "").single();
    expect(data).toEqual({ email: "compta@exemple.fr", telephone: "0476000000" });
  });

  it("le rôle lecture est refusé, et le refus est nommé", async () => {
    courant.client = lecture;
    const r = await clientsApi.importerClients(ALPHA, [{ nom: `${PREFIXE}-lecture`, pays_code: "FR" }], []);
    expect(r.crees).toBe(0);
    expect(r.echecs).toEqual([{ noms: [`${PREFIXE}-lecture`], motif: "vos droits ne permettent pas d'écrire les clients" }]);
  });
});

describe("reprise d'historique (IMP-20 à IMP-22)", () => {
  const numero = `HIST-${suffixe}`;
  const csv = `numero_facture;type;date_facture;client;montant_ht;taux_tva;montant_tva;montant_ttc\n${numero};facture;2025-06-30;${PREFIXE}-reprise;1000,00;20;200,00;1200,00\n`;
  const lignes = `numero_facture;num_ligne;compte_produit;designation;montant_ht\n${numero};1;706000;;600,00\n${numero};2;707000;Fournitures;400,00\n`;
  let factureId = "";

  it("brouillon → lignes → numéro : la pièce porte SON numéro, « payée », legacy « compta: »", async () => {
    // Réservée à l'administrateur (proposition 20260925040000, relecture 4 I1, D-SQL-02).
    courant.client = admin;
    const rapport = analyserExportFactures(new TextEncoder().encode(csv), new TextEncoder().encode(lignes));
    const pris = await facturesApi.numerosDejaPris(ALPHA, [numero]);
    const apercu = construireApercuFactures(rapport, await facturesApi.clientsConnus(ALPHA), pris);
    expect(apercu.ecriturePossible).toBe(true);
    const r = await facturesApi.importerFactures(ALPHA, apercu.pieces);
    expect(r).toEqual({ ecrites: 1, lignes: 2, echecs: [], brouillonsOrphelins: [] });

    const { data } = await secretaire.from("factures").select("id, numero, statut, legacy_id, lignes:facture_lignes(designation, article_reference)").eq("societe_id", ALPHA).eq("numero", numero).single();
    factureId = data?.id ?? "";
    expect(data).toMatchObject({ numero, statut: "payée", legacy_id: `compta:${numero}` });
    expect(data?.lignes.map((l) => l.article_reference).sort()).toEqual(["706000", "707000"]);
    const totaux = await secretaire.from("v_facture_totaux").select("ht, tva, ttc").eq("facture_id", factureId).single();
    expect(totaux.data).toEqual({ ht: 1000, tva: 200, ttc: 1200 });
  });

  it("une pièce reprise ne se supprime plus, et son numéro ne se reprend pas", async () => {
    courant.client = secretaire;
    expect(await facturesApi.supprimerBrouillonsImport([factureId])).toBe(0);
    expect(await facturesApi.numerosDejaPris(ALPHA, [numero, "INEXISTANT"])).toEqual(new Set([numero]));
  });

  it("[proposition] la secrétaire, qui crée les factures, ne pose pas le marqueur « compta: » (relecture 4, I1)", async () => {
    courant.client = secretaire;
    const autre = `${numero}-S`;
    const rapport = analyserExportFactures(new TextEncoder().encode(csv.replaceAll(numero, autre)), new TextEncoder().encode(lignes.replaceAll(numero, autre)));
    const apercu = construireApercuFactures(rapport, await facturesApi.clientsConnus(ALPHA), new Set());
    const r = await facturesApi.importerFactures(ALPHA, apercu.pieces);
    expect(r.ecrites).toBe(0);
    expect(r.echecs[0]).toMatchObject({ etape: "entete", motif: "vos droits ne permettent pas d'écrire les factures" });
  });

  it("le rôle lecture ne passe pas l'étape de l'en-tête", async () => {
    courant.client = lecture;
    const rapport = analyserExportFactures(new TextEncoder().encode(csv.replace(numero, `${numero}-L`)), null);
    const apercu = construireApercuFactures(rapport, [], new Set());
    const r = await facturesApi.importerFactures(ALPHA, apercu.pieces);
    expect(r.ecrites).toBe(0);
    expect(r.echecs[0]).toMatchObject({ etape: "entete", motif: "vos droits ne permettent pas d'écrire les factures" });
  });

  it("la facture électronique se lit : totaux de la vue, déjà-réglé de la base (EFA-22)", async () => {
    courant.client = secretaire;
    const sources = await lireSourcesEmission(factureId);
    expect(sources.lignes).toHaveLength(2);
    expect(sources.totaux).toEqual({ ht: 1000, tva: 200, ttc: 1200 });
    expect(sources.paye).toBe(0);
    const { charge } = await preparerEmission(factureId);
    expect(charge.en_invoice.totals.total_with_vat).toBe("1200.00");
    expect(charge.en_invoice.lines.map((l) => l.item_information.name)).toContain("Prestations de services (historique)");
  });
});

describe("sauvegarde (IMP-40)", () => {
  it("version 2, toutes les collections, rien d'une autre société", async () => {
    courant.client = admin;
    const doc = JSON.parse(await construireSauvegarde(ALPHA, "alpha", "2026-09-26T08:00:00.000Z")) as Record<string, unknown>;
    expect(doc).toMatchObject({ version: 2, codeSociete: "alpha", exportedAt: "2026-09-26T08:00:00.000Z" });
    for (const cle of ["clients", "articles", "devis", "factures", "reglements", "bons_commande", "chantiers", "salaries"]) {
      const liste = doc[cle] as { societe_id: string }[];
      expect(Array.isArray(liste), cle).toBe(true);
      expect(liste.every((x) => x.societe_id === ALPHA), cle).toBe(true);
      expect(liste.some((x) => x.societe_id === BETA), cle).toBe(false);
    }
    expect((doc.factures as { lignes: unknown[] }[]).some((f) => f.lignes.length > 0)).toBe(true);
  });
});
