/**
 * [proposition] Les défauts de l'ancienne application qui étaient REPRODUITS
 * (DEF-REP), corrigés en base le 28/09 — propositions 202609282000xx :
 *
 *   DEF-REP-14  20260928200001  la facture du bon reprend le mode de règlement du client, son conducteur, la TVA de la société
 *   DEF-REP-15  20260928200002  un devis, un bon (index unique partiel)
 *   DEF-REP-16  20260928200003  un bon ou un devis ne désigne ni client ni conducteur d'une autre société
 *   DEF-REP-17  20260928200004  le terrain ne crée ni fiche conducteur ni fournisseur
 *   DEF-REP-18  20260928200005  le sous-traitant ne lit ni fournisseurs, ni factures fournisseurs, ni véhicules, ni journal
 *   DEF-REP-20  20260928200007  le niveau d'abonnement est opposable
 *
 * Chaque cas échoue contre la base sans la proposition. Tout ce qui est créé
 * porte « Essai RLS REP » et est retiré à la fin (sauf pièce numérotée).
 * Écrit, NON LANCÉ (brief du 28/09) : à passer par `npm run test:rls`.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerBon, genererFacture } from "../../src/modules/commandes/api/bons";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";
import { lireCatalogue } from "./catalogue";

const MARQUE = "Essai RLS REP";
const OPAC = "a2000000-0000-0000-0000-000000000001";
const CONDUCTEUR = "a7000000-0000-0000-0000-000000000001";
const TRACE = `${Date.now()}`;
const CLE_SERVICE = process.env.RLS_SERVICE_ROLE_KEY ?? "";
const URL_API = process.env.RLS_API_URL ?? "";

let admin: Client;
let secretaire: Client;
let technicien: Client;
let conducteur: Client;
let sousTraitant: Client;
let adminBeta: Client;
const crees: { table: string; id: string; client: () => Client }[] = [];

function retenir(table: string, id: string | undefined, client: () => Client = () => admin): string {
  if (id) crees.push({ table, id, client });
  return id ?? "";
}

async function exiger<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data === null || data === undefined) throw new Error("Aucune donnée");
  return data;
}

beforeAll(async () => {
  [admin, secretaire, technicien, conducteur, sousTraitant, adminBeta] = await Promise.all([
    connecte(COMPTES.adminAlpha),
    connecte(COMPTES.secretaireAlpha),
    connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.conducteurAlpha),
    connecte(COMPTES.sousTraitantAlpha),
    connecte(COMPTES.adminBeta),
  ]);
});

afterAll(async () => {
  // Dans l'ordre inverse : les factures (brouillons) avant leurs bons, les bons avant leurs devis et clients.
  for (const { table, id, client } of [...crees].reverse()) {
    const r = await client().from(table as "clients").delete().eq("id", id);
    if (r.error) console.warn(`Nettoyage ${table} ${id} : ${r.error.message}`);
  }
});

const entete = (o: Partial<EnteteAEnregistrer> = {}): EnteteAEnregistrer => ({
  client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: CONDUCTEUR, conducteur: null,
  numero_bc: `RLS-REP-${TRACE}`, sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-28", date_fin_travaux: null,
  nature_travaux: MARQUE, notes: null, montant: 120, adresse: "1 rue de l'Essai", code_postal: "69001", ville: "Lyon",
  logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  devis_id: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, probleme_description: null,
  metiers: [], metier: null, montant_par_metier: null, ...o,
});

describe("[proposition] la facture du bon reprend le client (DEF-REP-14, 20260928200001)", () => {
  it("mode de règlement du client, conducteur du bon, TVA par défaut de la société sur le forfait", async () => {
    const client = await exiger(admin.from("clients").insert({ societe_id: ALPHA, nom: `${MARQUE} Chèque ${TRACE}`, mode_paiement: "cheque" }).select("id, nom").single());
    retenir("clients", client.id);
    // Sans ligne : la facture porte une ligne forfait, dont la TVA était 10 en dur.
    const bon = await enregistrerBon(ALPHA, null, entete({ client_id: client.id, client_nom: client.nom }), [], admin);
    expect((await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: bon })).error).toBeNull();
    const factureId = await genererFacture(bon, admin);
    retenir("factures", factureId);
    retenir("bons_commande", bon);
    const f = await exiger(admin.from("factures").select("mode_paiement, conducteur_id, facture_lignes(tva, unite)").eq("id", factureId).single());
    expect(f.mode_paiement).toBe("cheque");
    expect(f.conducteur_id).toBe(CONDUCTEUR);
    const reglages = await admin.from("societe_settings").select("infos_entreprise").eq("societe_id", ALPHA).maybeSingle();
    const brut = ((reglages.data?.infos_entreprise as { reglages?: { documents?: { tvaDefaut?: unknown } } } | null)?.reglages?.documents?.tvaDefaut ?? null);
    const attendue = brut === null || brut === "" || Number.isNaN(Number(String(brut).replace(",", "."))) ? 10 : Number(String(brut).replace(",", "."));
    expect(f.facture_lignes.map((l) => Number(l.tva))).toEqual([attendue]);
  });

  it("un client sans mode de règlement : « virement », comme avant", async () => {
    const client = await exiger(admin.from("clients").insert({ societe_id: ALPHA, nom: `${MARQUE} Sans mode ${TRACE}`, mode_paiement: null }).select("id, nom").single());
    retenir("clients", client.id);
    const bon = await enregistrerBon(ALPHA, null, entete({ client_id: client.id, client_nom: client.nom, numero_bc: `RLS-REP-V-${TRACE}` }), [], admin);
    expect((await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: bon })).error).toBeNull();
    const factureId = await genererFacture(bon, admin);
    retenir("factures", factureId);
    retenir("bons_commande", bon);
    expect((await exiger(admin.from("factures").select("mode_paiement").eq("id", factureId).single())).mode_paiement).toBe("virement");
  });
});

describe("[proposition] un devis, un bon (DEF-REP-15, 20260928200002)", () => {
  it("le second bon du même devis est refusé par la base (23505)", async () => {
    const numero = await exiger(admin.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" }));
    const devis = await exiger(admin.from("devis").insert({ societe_id: ALPHA, numero, client_id: OPAC, client_nom: "OPAC du Rhône", date: "2026-09-28" }).select("id").single());
    retenir("devis", devis.id);
    const ligne = { societe_id: ALPHA, devis_id: devis.id, client_id: OPAC, client_nom: "OPAC du Rhône", date: "2026-09-28", statut: "en attente", numero_bc: `RLS-REP-D-${TRACE}` };
    const premier = await admin.from("bons_commande").insert(ligne).select("id").single();
    expect(premier.error).toBeNull();
    retenir("bons_commande", premier.data?.id);
    const second = await admin.from("bons_commande").insert({ ...ligne, numero_bc: `RLS-REP-D2-${TRACE}` }).select("id").single();
    retenir("bons_commande", second.data?.id);
    expect(second.error?.code).toBe("23505");
  });
});

describe("[proposition] un document reste dans sa société (DEF-REP-16, 20260928200003)", () => {
  let clientBeta = "";
  let conducteurBeta = "";

  beforeAll(async () => {
    clientBeta = retenir("clients", (await exiger(adminBeta.from("clients").insert({ societe_id: BETA, nom: `${MARQUE} Client Beta ${TRACE}` }).select("id").single())).id, () => adminBeta);
    conducteurBeta = retenir("conducteurs", (await exiger(adminBeta.from("conducteurs").insert({ societe_id: BETA, nom: `${MARQUE} Conducteur Beta ${TRACE}` }).select("id").single())).id, () => adminBeta);
  });

  const bon = (o: Record<string, unknown>) => ({ societe_id: ALPHA, client_id: OPAC, client_nom: "OPAC du Rhône", date: "2026-09-28", statut: "en attente", numero_bc: `RLS-REP-S-${TRACE}`, ...o });

  it("un bon ALPHA ne désigne ni le client ni le conducteur d'une autre société", async () => {
    const client = await admin.from("bons_commande").insert(bon({ client_id: clientBeta })).select("id").single();
    retenir("bons_commande", client.data?.id);
    expect(client.error?.code).toBe("23514");
    const cond = await admin.from("bons_commande").insert(bon({ conducteur_id: conducteurBeta })).select("id").single();
    retenir("bons_commande", cond.data?.id);
    expect(cond.error?.code).toBe("23514");
  });

  it("ni à la modification, ni sur un devis ; les fiches de la société passent", async () => {
    const ok = await exiger(admin.from("bons_commande").insert(bon({ conducteur_id: CONDUCTEUR })).select("id").single());
    retenir("bons_commande", ok.id);
    const change = await admin.from("bons_commande").update({ client_id: clientBeta }).eq("id", ok.id).select("id");
    expect(change.error?.code).toBe("23514");
    const numero = await exiger(admin.rpc("prochain_numero", { p_societe: ALPHA, p_type: "devis" }));
    const devis = await admin.from("devis").insert({ societe_id: ALPHA, numero, client_id: clientBeta, client_nom: "Intrus", date: "2026-09-28" }).select("id").single();
    retenir("devis", devis.data?.id);
    expect(devis.error?.code).toBe("23514");
  });
});

describe("[proposition] le terrain ne crée ni conducteur ni fournisseur (DEF-REP-17, 20260928200004)", () => {
  it("technicien et conducteur : ni création ni renommage d'une fiche conducteur ou d'un fournisseur", async () => {
    for (const c of [technicien, conducteur]) {
      expect((await c.from("conducteurs").insert({ societe_id: ALPHA, nom: `${MARQUE} intrus` })).error?.code).toBe("42501");
      expect((await c.from("fournisseurs").insert({ societe_id: ALPHA, nom: `${MARQUE} intrus`, actif: true })).error?.code).toBe("42501");
    }
    const fiche = retenir("conducteurs", (await exiger(admin.from("conducteurs").insert({ societe_id: ALPHA, nom: `${MARQUE} Fiche ${TRACE}` }).select("id").single())).id);
    expect((await technicien.from("conducteurs").update({ nom: "Renommé" }).eq("id", fiche).select("id")).data).toEqual([]);
  });

  it("ceux que la matrice désigne écrivent toujours : secrétaire (rh), administrateur (réglages)", async () => {
    const parRh = await secretaire.from("conducteurs").insert({ societe_id: ALPHA, nom: `${MARQUE} RH ${TRACE}` }).select("id").single();
    retenir("conducteurs", parRh.data?.id);
    expect(parRh.error).toBeNull();
    const fournisseur = await admin.from("fournisseurs").insert({ societe_id: ALPHA, nom: `${MARQUE} Fournisseur ${TRACE}`, actif: true }).select("id").single();
    retenir("fournisseurs", fournisseur.data?.id);
    expect(fournisseur.error).toBeNull();
  });

  it("aucune politique d'écriture de ces deux tables ne passe encore par peut_ecrire()", () => {
    const restantes = lireCatalogue(`
      select c.relname || ' · ' || p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
       where c.relname in ('conducteurs', 'fournisseurs') and p.polcmd in ('a', 'w', '*')
         and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'peut_ecrire\\('`).flat();
    expect(restantes).toEqual([]);
  });
});

describe("[proposition] le sous-traitant ne lit pas la gestion (DEF-REP-18, 20260928200005)", () => {
  it("fournisseurs, factures fournisseurs, véhicules, journal du circuit : rien pour le sous-traitant", async () => {
    for (const table of ["fournisseurs", "factures_entrantes", "vehicules", "workflow_journal"] as const) {
      const { data, error } = await sousTraitant.from(table).select("id").eq("societe_id", ALPHA).limit(5);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("ce que ses écrans lisent reste lisible : clients (rapports), conducteurs, matériel, réglages", async () => {
    // Comparé à ce que lit l'administrateur, pas à « au moins une ligne » : la ligne de réglages
    // d'ALPHA n'existe qu'une fois qu'un autre fichier l'a écrite, et l'ordre des fichiers varie.
    for (const table of ["clients", "conducteurs", "materiels", "societe_settings"] as const) {
      const vu = await sousTraitant.from(table).select("societe_id").eq("societe_id", ALPHA);
      const reference = await admin.from(table).select("societe_id").eq("societe_id", ALPHA);
      expect(vu.error, table).toBeNull();
      expect(reference.error, table).toBeNull();
      expect(vu.data?.length, table).toBe(reference.data?.length);
    }
  });

  it("les autres rôles lisent comme avant (véhicules : l'administrateur et le technicien)", async () => {
    for (const c of [admin, technicien]) {
      const { error } = await c.from("vehicules").select("id").eq("societe_id", ALPHA).limit(1);
      expect(error).toBeNull();
    }
    const vehicules = await admin.from("vehicules").select("id").eq("societe_id", ALPHA);
    const vusParLeTechnicien = await technicien.from("vehicules").select("id").eq("societe_id", ALPHA);
    expect(vusParLeTechnicien.data?.length).toBe(vehicules.data?.length);
  });
});

describe.skipIf(!CLE_SERVICE)("[proposition] niveau d'abonnement opposable (DEF-REP-20, 20260928200007)", () => {
  // Sans types générés pour la colonne proposée : client de service non typé.
  const service = createClient(URL_API, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  afterAll(async () => {
    const { error } = await service.from("societes").update({ niveau_abonnement: null }).eq("id", BETA);
    if (error) console.error("Niveau de BETA non remis à NULL : à remettre à la main", error);
  });

  it("l'application ne pose pas son propre niveau, même administrateur", async () => {
    const r = await (adminBeta as unknown as typeof service).from("societes").update({ niveau_abonnement: 5 }).eq("id", BETA).select("id");
    expect(r.error?.code).toBe("42501");
  });

  it("niveau 1 : articles, factures et bons se ferment à la société ; NULL les rouvre", async () => {
    const article = { societe_id: BETA, code: `REP-${TRACE}`, designation: MARQUE, prix_unitaire: 1, tva: 20, type_article: "service" as const, actif: true, gere_en_stock: false };
    expect((await service.from("societes").update({ niveau_abonnement: 1 }).eq("id", BETA)).error).toBeNull();
    expect((await (adminBeta as unknown as typeof service).rpc("niveau_suffisant", { p_societe_id: BETA, p_fonctionnalite: "articles" })).data).toBe(false);
    expect((await adminBeta.from("articles").insert(article)).error?.code).toBe("42501");
    expect((await adminBeta.from("factures").select("id").eq("societe_id", BETA)).data).toEqual([]);
    expect((await adminBeta.from("bons_commande").select("id").eq("societe_id", BETA)).data).toEqual([]);
    // Clients, niveau 1 : toujours ouverts.
    expect((await adminBeta.from("clients").select("id").eq("societe_id", BETA).limit(1)).error).toBeNull();

    expect((await service.from("societes").update({ niveau_abonnement: null }).eq("id", BETA)).error).toBeNull();
    const cree = await adminBeta.from("articles").insert(article).select("id").single();
    retenir("articles", cree.data?.id, () => adminBeta);
    expect(cree.error).toBeNull();
  });
});
