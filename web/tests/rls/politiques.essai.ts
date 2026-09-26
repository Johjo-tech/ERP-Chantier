/**
 * [proposition] Relecture 4 des migrations proposées : un cas par constat,
 * qui échoue contre la version précédente des propositions et passe avec la
 * correction (D-SQL-01 à D-SQL-08).
 *
 *   B1  les vues de l'espace client ne s'écrivent pas            (20260925030000, 20260926042000)
 *   B2  le terrain ne pose ni prix ni statut à un travail         (20260926050000)
 *   B3  un `legacy_id` base 36 de l'écran historique n'est pas une reprise (20260926040000, 041000)
 *   I1  le marqueur « compta: » est réservé à l'administrateur   (20260925040000) — aussi numerotation / import-export
 *   I2  un avoir au TTC signé garde son crédit                    (20260926040000)
 *   I3  le dépôt au seau et les photos suivent le domaine et le bon (20260926051000, 100000)
 *   I4  le téléphone des occupants : seulement les bons du sous-traitant (20260926053000)
 *   I5  le sous-traitant ne lit que ses bons, leurs lignes, sa fiche (20260926102000)
 *   I6  aucune vue de production refaite sans garde de sa définition vivante
 *   I8  un bon facturé s'enregistre encore (en-tête, lignes à l'identique) (20260925050000)
 *   M1  un anonyme n'exécute aucune fonction SECURITY DEFINER proposée
 *   M3  un rapport ne cite que le bon et l'entreprise de SA société (20260926052000)
 *   M6  « envoyée » n'est pas réécrite en « impayée » par un règlement (20260926041000)
 *
 * Tout ce qui est créé ici est suivi par id et retiré à la fin, sauf les
 * pièces numérotées (indélébiles par la loi, c'est ce que la base garantit).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientPlanning } from "../../src/lib/supabase";
import { enregistrerBon, genererFacture } from "../../src/modules/commandes/api/bons";
import type { EnteteAEnregistrer } from "../../src/modules/commandes/domain/bon";
import type { LigneAEnregistrer } from "../../src/modules/documents/domain/lignes";
import { ALPHA, BETA, COMPTES, anonyme, avecPropositions, connecte, type Client } from "./cible";

const PROFIL_SOUS_TRAITANT = "a1000000-0000-0000-0000-000000000006";
const PROFIL_TECHNICIEN = "a1000000-0000-0000-0000-000000000004";
const OPAC = "a2000000-0000-0000-0000-000000000001";
const JOUR = "2026-10-12";
const suffixe = Date.now().toString(36);

/** Pour les vues et fonctions que les types de production ne décrivent pas en écriture. */
const libre = (c: Client) => c as unknown as SupabaseClient;

let admin: Client;
let conducteur: Client;
let technicien: Client;
let sousTraitant: Client;
let client: Client;
let adminBeta: Client;
const ids = { st: "", autreSt: "", bons: [] as string[], fichiers: [] as string[] };

const entete = (surcharges: Partial<EnteteAEnregistrer> = {}): EnteteAEnregistrer => ({
  client_id: OPAC, client_nom: "OPAC du Rhône", interlocuteur: null, conducteur_id: null, conducteur: null,
  numero_bc: "RLS-R4", sans_bc: false, en_attente_bc: false, reference_chantier: null, date_reception: "2026-09-24", date_fin_travaux: null,
  nature_travaux: "Essai relecture 4", notes: null, montant: 120, adresse: "4 rue de la Relecture", code_postal: "69004", ville: "Lyon",
  logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null,
  devis_id: null, facturation_adresse: null, facturation_code_postal: null, facturation_ville: null, probleme_description: null,
  metiers: [], metier: null, montant_par_metier: null,
  ...surcharges,
});
const ligne = (designation: string, prix: number): LigneAEnregistrer => ({
  id: null, position: 0, type: "ligne", designation, quantite: 1, prix_unitaire: prix, unite: "u", tva: 10,
  article_reference: null, commentaire: null, metier: null, montant_ht: prix,
});

async function nouveauBon(lignes: LigneAEnregistrer[] = []): Promise<string> {
  const id = await enregistrerBon(ALPHA, null, entete(), lignes, admin);
  ids.bons.push(id);
  return id;
}

async function tacheDe(bcId: string, sousTraitantId: string | null): Promise<string> {
  const { data, error } = await admin
    .from("planning_taches")
    .insert({ societe_id: ALPHA, bon_commande_id: bcId, libelle: "R4", metier: "Plomberie", date_tache: JOUR, sous_traitant_id: sousTraitantId, statut: "planifiee", piece_a_commander: false })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Un bon « à lui » (une tâche confiée au sous-traitant) et un bon d'un confrère. */
async function deuxBons(): Promise<{ sien: string; autre: string; tacheSienne: string; tacheAutre: string }> {
  const sien = await nouveauBon();
  const autre = await nouveauBon();
  return { sien, autre, tacheSienne: await tacheDe(sien, ids.st), tacheAutre: await tacheDe(autre, ids.autreSt) };
}

/** Une facture émise, TTC = ht × 1,2, sous un client unique. */
async function factureEmise(o: { ht: number; type?: "facture" | "avoir"; legacy?: string | null }): Promise<string> {
  const { data, error } = await admin
    .from("factures")
    .insert({ societe_id: ALPHA, client_nom: `Client R4 ${suffixe}`, statut: "brouillon", type_document: o.type ?? "facture", date: "2026-09-01", legacy_id: o.legacy ?? null })
    .select("id")
    .single();
  if (error) throw error;
  const l = await admin.from("facture_lignes").insert({ facture_id: data.id, position: 0, type: "ligne", designation: "R4", quantite: 1, prix_unitaire: o.ht, tva: 20 });
  if (l.error) throw l.error;
  const emise = await admin.from("factures").update({ statut: "impayée" }).eq("id", data.id);
  if (emise.error) throw emise.error;
  return data.id;
}

async function solde(id: string) {
  const { data, error } = await avecPropositions(admin).from("v_facture_solde").select("*").eq("facture_id", id).single();
  if (error) throw error;
  return data;
}

async function statut(id: string): Promise<string | undefined> {
  return (await admin.from("factures").select("statut").eq("id", id).single()).data?.statut;
}

beforeAll(async () => {
  [admin, conducteur, technicien, sousTraitant, client, adminBeta] = await Promise.all([
    connecte(COMPTES.adminAlpha), connecte(COMPTES.conducteurAlpha), connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.sousTraitantAlpha), connecte("client.opac@erp.local"), connecte(COMPTES.adminBeta),
  ]);
  const sts = await admin
    .from("sous_traitants")
    .insert([{ societe_id: ALPHA, nom: `ST R4 ${suffixe}`, contact_profile_id: PROFIL_SOUS_TRAITANT, metiers: [] }, { societe_id: ALPHA, nom: `ST R4 confrère ${suffixe}`, contact_profile_id: null, metiers: [] }])
    .select("id, contact_profile_id");
  if (sts.error) throw sts.error;
  ids.st = sts.data.find((s) => s.contact_profile_id)?.id ?? "";
  ids.autreSt = sts.data.find((s) => !s.contact_profile_id)?.id ?? "";
});

afterAll(async () => {
  if (!admin) return;
  if (ids.fichiers.length) {
    const { error } = await admin.storage.from("terrain").remove(ids.fichiers);
    if (error) console.warn(`Fichiers d'essai non retirés : ${error.message}`);
  }
  // Un bon facturé est indélébile avec sa facture : on le dit plutôt que de laisser croire la base propre.
  for (const n of [admin.from("bons_commande").delete().in("id", ids.bons), admin.from("sous_traitants").delete().in("id", [ids.st, ids.autreSt])]) {
    const { error } = await n;
    if (error) console.warn(`Nettoyage partiel (relecture 4) : ${error.message}`);
  }
});

describe("[proposition] relecture 4 — B1 : les vues de l'espace client ne s'écrivent pas", () => {
  it("ni le client ni une autre société n'insèrent, ne modifient ou ne suppriment par une vue", async () => {
    const intrusion = await libre(adminBeta).from("v_espace_client_chantiers").insert({ id: crypto.randomUUID(), societe_id: ALPHA, nom: "INTRUSION BETA" });
    expect(intrusion.error?.code).toBe("42501");
    const avant = (await avecPropositions(client).from("v_espace_client_chantiers").select("id")).data ?? [];
    const renomme = await libre(client).from("v_espace_client_chantiers").update({ nom: "RENOMMÉ PAR LE CLIENT" }).neq("id", "00000000-0000-0000-0000-000000000000");
    expect(renomme.error?.code).toBe("42501");
    const efface = await libre(client).from("v_espace_client_chantiers").delete().neq("societe_id", BETA);
    expect(efface.error?.code).toBe("42501");
    // Jointure et `lateral` : ces deux vues ne sont pas modifiables (55000) ; leurs droits en trop sont retirés quand même.
    for (const vue of ["v_espace_client_bons", "v_mes_acces_clients"]) {
      const refus = await libre(client).from(vue).delete().neq("societe_id", BETA);
      expect(refus.error?.code, vue).toMatch(/^(42501|55000)$/);
    }
    const apres = (await avecPropositions(client).from("v_espace_client_chantiers").select("id")).data ?? [];
    expect(apres.length).toBe(avant.length);
  });
});

describe("[proposition] relecture 4 — B2 : le terrain ne chiffre pas", () => {
  it("le sous-traitant qui pose prix, statut, origine et auteur voit son signalement ramené « à chiffrer », à son nom", async () => {
    const { sien, tacheSienne } = await deuxBons();
    const id = crypto.randomUUID();
    const { error } = await sousTraitant.from("tache_travaux_supplementaires").insert({
      id, societe_id: ALPHA, bon_commande_id: sien, planning_tache_id: tacheSienne, libelle: "injecté par ST", quantite: 1,
      prix_vente_ht: 9999, statut: "integre", origine: "conducteur", cree_par: "a1000000-0000-0000-0000-000000000001",
    });
    expect(error).toBeNull();
    const { data } = await admin.from("tache_travaux_supplementaires").select("statut, prix_vente_ht, origine, cree_par").eq("id", id).single();
    expect(data).toEqual({ statut: "a_chiffrer", prix_vente_ht: null, origine: "technicien", cree_par: PROFIL_SOUS_TRAITANT });
  });

  it("le technicien non plus ; et une tâche d'un autre bon ne s'accroche pas", async () => {
    const { sien, tacheAutre } = await deuxBons();
    const id = crypto.randomUUID();
    const pose = await technicien.from("tache_travaux_supplementaires").insert({ id, societe_id: ALPHA, bon_commande_id: sien, libelle: "prix du technicien", prix_vente_ht: 500, statut: "chiffre" });
    expect(pose.error).toBeNull();
    const { data } = await admin.from("tache_travaux_supplementaires").select("statut, prix_vente_ht, cree_par").eq("id", id).single();
    expect(data).toEqual({ statut: "a_chiffrer", prix_vente_ht: null, cree_par: PROFIL_TECHNICIEN });
    const ailleurs = await admin.from("tache_travaux_supplementaires").insert({ societe_id: ALPHA, bon_commande_id: sien, planning_tache_id: tacheAutre, libelle: "mal accroché" });
    expect(ailleurs.error?.code).toBe("23514");
  });

  it("qui voit les prix chiffre toujours", async () => {
    const { sien } = await deuxBons();
    const id = crypto.randomUUID();
    expect((await conducteur.from("tache_travaux_supplementaires").insert({ id, societe_id: ALPHA, bon_commande_id: sien, libelle: "chiffré", prix_vente_ht: 80, statut: "chiffre", origine: "conducteur" })).error).toBeNull();
    const { data } = await admin.from("tache_travaux_supplementaires").select("statut, prix_vente_ht, origine").eq("id", id).single();
    expect(data).toEqual({ statut: "chiffre", prix_vente_ht: 80, origine: "conducteur" });
  });
});

describe("[proposition] relecture 4 — B3 : un identifiant base 36 de l'écran historique n'est pas une reprise", () => {
  it("un règlement supprimé rend la facture de nouveau due", async () => {
    const id = await factureEmise({ ht: 100, legacy: `mf${suffixe}xyz` });
    const r = await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: id, date: "2026-09-02", montant: 120, mode: "virement", reference: null }).select("id").single();
    expect(r.error).toBeNull();
    expect(await statut(id)).toBe("payée");
    await admin.from("reglements").delete().eq("id", r.data?.id ?? "");
    expect(await statut(id)).toBe("impayée");
    expect(await solde(id)).toMatchObject({ etat: "Impayée", cle: "non_reglee", reprise: false, du: 120 });
  });

  it("passée « payée » à la main sans règlement, elle reste due", async () => {
    const id = await factureEmise({ ht: 50, legacy: `mg${suffixe}xyz` });
    await admin.from("factures").update({ statut: "payée" }).eq("id", id);
    expect(await solde(id)).toMatchObject({ cle: "non_reglee", reprise: false, du: 60 });
  });
});

describe("[proposition] relecture 4 — I1 : le marqueur « compta: » n'est pas à la portée de tous", () => {
  it("la secrétaire ne le pose pas, ni à la création ni sur un brouillon existant", async () => {
    const sec = await connecte(COMPTES.secretaireAlpha);
    const pose = await sec.from("factures").insert({ societe_id: ALPHA, client_nom: "Faux", statut: "brouillon", legacy_id: `compta:contournement-${suffixe}` });
    expect(pose.error?.code).toBe("42501");
    const { data } = await sec.from("factures").insert({ societe_id: ALPHA, client_nom: "Faux", statut: "brouillon" }).select("id").single();
    const ajout = await sec.from("factures").update({ legacy_id: `compta:apres-${suffixe}`, numero: "FAC-2026-999999", statut: "impayée" }).eq("id", data?.id ?? "");
    expect(ajout.error?.code).toBe("42501");
    await sec.from("factures").delete().eq("id", data?.id ?? "");
  });

  it("même l'administrateur ne numérote pas une reprise sans ligne", async () => {
    const { data } = await admin.from("factures").insert({ societe_id: ALPHA, client_nom: "Reprise vide", statut: "brouillon", legacy_id: `compta:vide-${suffixe}` }).select("id").single();
    const numero = await admin.from("factures").update({ numero: `HIST-VIDE-${suffixe}`, statut: "payée" }).eq("id", data?.id ?? "");
    expect(numero.error?.message).toMatch(/sans ligne/);
    await admin.from("factures").delete().eq("id", data?.id ?? "");
  });
});

describe("[proposition] relecture 4 — I2 : un avoir au TTC signé garde son crédit", () => {
  it("lignes négatives : « Disponible », crédit en valeur absolue, TTC exposé signé", async () => {
    const id = await factureEmise({ ht: -568.33, type: "avoir" });
    const s = await solde(id);
    expect(Number(s.ttc)).toBeLessThan(0);
    expect(s).toMatchObject({ cle: "disponible", etat: "Disponible", sens: -1, du: 0, credit: 682, reste: 682 });
  });
});

describe("[proposition] relecture 4 — I3 : le seau et les photos suivent le bon et le domaine", () => {
  it("le sous-traitant dépose sur SON bon, jamais dans les documents légaux ni chez un confrère", async () => {
    const { sien, autre } = await deuxBons();
    const faux = `${ALPHA}/documents-legaux/faux-kbis-${suffixe}.pdf`;
    expect((await sousTraitant.storage.from("terrain").upload(faux, new Blob(["%PDF"]))).error).not.toBeNull();
    const chezAutre = `${ALPHA}/bons/${autre}/${suffixe}.jpg`;
    expect((await sousTraitant.storage.from("terrain").upload(chezAutre, new Blob(["x"]))).error).not.toBeNull();
    const chezLui = `${ALPHA}/bons/${sien}/${suffixe}.jpg`;
    expect((await sousTraitant.storage.from("terrain").upload(chezLui, new Blob(["x"]))).error).toBeNull();
    ids.fichiers.push(chezLui);
    const ligneAutre = await sousTraitant.from("bon_commande_photos").insert({ bon_commande_id: autre, chemin: chezAutre, position: 0 });
    expect(ligneAutre.error?.code).toBe("42501");
  });

  it("le technicien n'écrase ni n'efface les documents légaux, et n'y dépose pas", async () => {
    const kbis = `${ALPHA}/documents-legaux/kbis-r4-${suffixe}.txt`;
    expect((await admin.storage.from("terrain").upload(kbis, new Blob(["kbis"], { type: "text/plain" }))).error).toBeNull();
    ids.fichiers.push(kbis);
    await technicien.storage.from("terrain").remove([kbis]);
    expect((await admin.storage.from("terrain").download(kbis)).data).not.toBeNull();
    const depot = await technicien.storage.from("terrain").upload(`${ALPHA}/documents-legaux/tech-${suffixe}.txt`, new Blob(["x"]));
    expect(depot.error).not.toBeNull();
  });
});

describe("[proposition] relecture 4 — I4 et I5 : le sous-traitant ne tire rien des bons d'un confrère", () => {
  it("téléphones, bons, lignes, photos, fiches : seulement les siens — et les siens sans aucun prix", async () => {
    const { sien, autre } = await deuxBons();
    await admin.from("bon_commande_lignes").insert({ bon_commande_id: sien, position: 0, type: "ligne", designation: "Prix caché", quantite: 1, prix_unitaire: 90, unite: "u", tva: 10 });
    const lu = await sousTraitant.from("v_bons_commande_terrain").select("montant").eq("id", sien).single();
    expect(lu.data).toEqual({ montant: null });
    const sesLignes = (await sousTraitant.from("v_bon_commande_lignes_terrain").select("prix_unitaire").eq("bon_commande_id", sien)).data ?? [];
    expect(sesLignes).toEqual([{ prix_unitaire: null }]);
    await admin.from("bons_commande").update({ telephone_locataire: "06 00 00 00 01" }).in("id", [sien, autre]);
    const photo = await admin.from("bon_commande_photos").insert({ bon_commande_id: autre, chemin: `${ALPHA}/bons/${autre}/r4.jpg`, position: 0 });
    expect(photo.error).toBeNull();

    const tels = (await clientPlanning(sousTraitant).rpc("telephones_locataires", { p_societe: ALPHA })).data ?? [];
    expect(tels.map((t) => t.bon_commande_id)).toContain(sien);
    expect(tels.map((t) => t.bon_commande_id)).not.toContain(autre);

    const bons = ((await sousTraitant.from("v_bons_commande_terrain").select("id")).data ?? []).map((b) => b.id);
    expect(bons).toContain(sien);
    expect(bons).not.toContain(autre);
    expect((await sousTraitant.from("v_bon_commande_lignes_terrain").select("id").eq("bon_commande_id", autre)).data ?? []).toEqual([]);
    expect((await sousTraitant.from("bon_commande_photos").select("id").eq("bon_commande_id", autre)).data ?? []).toEqual([]);

    const fiches = ((await sousTraitant.from("sous_traitants").select("id").eq("societe_id", ALPHA)).data ?? []).map((s) => s.id);
    expect(fiches).toEqual([ids.st]);
    // L'encadrement et le technicien ne perdent rien.
    expect(((await technicien.from("v_bons_commande_terrain").select("id").in("id", [sien, autre])).data ?? []).length).toBe(2);
    expect(((await conducteur.from("sous_traitants").select("id").in("id", [ids.st, ids.autreSt])).data ?? []).length).toBe(2);
  });
});

describe("[proposition] relecture 4 — I6 : une vue de production ne se refait pas à l'aveugle", () => {
  it("aucune proposition ne refait une vue de production hors d'une garde de sa définition vivante", () => {
    const dossier = path.resolve(import.meta.dirname, "../../supabase/propositions");
    const vuesDeProduction = /^\s*create\s+or\s+replace\s+view\s+(public\.)?(v_facture_solde|v_facture_totaux|v_devis_totaux|v_salaries_annuaire|v_bons_commande_terrain|v_bon_commande_lignes_terrain)\b/im;
    const fautifs = readdirSync(dossier).filter((f) => f.endsWith(".sql") && vuesDeProduction.test(readFileSync(path.join(dossier, f), "utf8")));
    expect(fautifs).toEqual([]);
  });
});

describe("[proposition] relecture 4 — I8 : un bon facturé s'enregistre encore", () => {
  it("en-tête (notes, tentatives de contact) et lignes réécrites à l'identique passent ; la suppression d'une ligne, non", async () => {
    const id = await nouveauBon([ligne("Travaux R4", 120)]);
    expect((await admin.rpc("bc_chiffrage_valide_hors_circuit", { p_bc_id: id })).error).toBeNull();
    const factureId = await genererFacture(id, admin);
    expect((await admin.from("factures").update({ statut: "impayée" }).eq("id", factureId)).error).toBeNull();

    const entete = await conducteur.from("bons_commande").update({ notes: "Rappel locataire", tentatives_contact: [] }).eq("id", id).select("id");
    expect(entete.error).toBeNull();
    const { data: lignes } = await conducteur.from("bon_commande_lignes").select("id, designation, quantite, prix_unitaire").eq("bon_commande_id", id);
    const premiere = lignes?.[0];
    if (!premiere) throw new Error("ligne du bon absente");
    const identique = await conducteur.from("bon_commande_lignes").update({ designation: premiere.designation, quantite: premiere.quantite, prix_unitaire: premiere.prix_unitaire }).eq("id", premiere.id).select("id");
    expect(identique.error).toBeNull();
    const suppression = await conducteur.from("bon_commande_lignes").delete().eq("id", premiere.id);
    expect(suppression.error?.code).toBe("23001");
  });
});

describe("[proposition] relecture 4 — M1, M3, M6", () => {
  it("M1 : un anonyme n'apprend pas la société d'un bon", async () => {
    const { error } = await libre(anonyme()).rpc("societe_du_bon", { p_bc: "a5000000-0000-0000-0000-000000000001" });
    expect(error?.code).toBe("42501");
  });

  it("M3 : un rapport ne cite pas le bon d'une autre société, ni un bon qui n'est pas confié au sous-traitant", async () => {
    const { autre } = await deuxBons();
    const beta = await clientPlanning(adminBeta).from("interventions").insert({ societe_id: BETA, client_nom: "Occupation", bon_commande_id: autre });
    expect(beta.error?.code).toBe("23514");
    const st = await clientPlanning(sousTraitant).from("interventions").insert({ societe_id: ALPHA, client_nom: "Occupation", bon_commande_id: autre });
    expect(st.error?.code).toBe("42501");
  });

  it("M6 : un règlement partiel laisse « envoyée » ; le solde la passe « payée »", async () => {
    const id = await factureEmise({ ht: 100 });
    expect((await admin.from("factures").update({ statut: "envoyée" }).eq("id", id)).error).toBeNull();
    await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: id, date: "2026-09-03", montant: 20, mode: "cheque", reference: null });
    expect(await statut(id)).toBe("envoyée");
    await admin.from("reglements").insert({ societe_id: ALPHA, facture_id: id, date: "2026-09-04", montant: 100, mode: "cheque", reference: null });
    expect(await statut(id)).toBe("payée");
  });
});
