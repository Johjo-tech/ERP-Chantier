/**
 * Droits contre la base LOCALE (AUTH-51, AUTH-70, AUTH-71, AUTH-72).
 *
 *  - les fonctions de droits, appelées par chaque rôle, disent ce que la
 *    session de l'écran croit (rôle, sociétés, prix, écriture) ;
 *  - le relevé de `pg_policy` : plus aucune suppression ouverte à tout membre ;
 *  - la proposition 20260926110000 : la matrice ouvre à la secrétaire ce
 *    qu'elle lui donne, la suppression suit « supprimer », les filles du
 *    chantier suivent l'affectation en toutes lettres.
 *
 * Tout ce qui est créé ici porte la marque « RLS-AUTH » et est supprimé à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import droitsFixture from "../../src/test/fixtures/role_permissions.json";
import { voitLesPrix, type RoleMembre } from "../../src/modules/auth-roles/domain/permissions";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";
import { lireCatalogue } from "./catalogue";

const MARQUE = "RLS-AUTH";
const TACHE_SEED = "a6000000-0000-0000-0000-000000000001";
const CHANTIER_AFFECTE = "a3000000-0000-0000-0000-000000000001";
const CHANTIER_NON_AFFECTE = "a3000000-0000-0000-0000-000000000002";
const PROFIL_TECHNICIEN = "a1000000-0000-0000-0000-000000000004";

/** Les tables que la proposition 20260926110000 aligne sur la matrice. */
const TABLES_ALIGNEES = [
  "techniciens", "sous_traitants", "conducteurs", "referentiels", "metiers", "documents_legaux", "fournisseurs",
  "fournisseurs_controle", "factures_entrantes", "sous_traitant_documents", "fournisseur_controle_lignes",
  "facture_entrante_lignes", "facture_cycle_vie", "vehicule_cartes_carburant", "vehicule_consommations", "vehicule_controles_periodiques",
];

const ROLES_ALPHA: Record<string, RoleMembre> = {
  [COMPTES.adminAlpha]: "admin",
  [COMPTES.secretaireAlpha]: "secretaire",
  [COMPTES.conducteurAlpha]: "conducteur",
  [COMPTES.technicienAlpha]: "technicien",
  [COMPTES.lectureAlpha]: "lecture",
  [COMPTES.sousTraitantAlpha]: "sous_traitant",
};

let admin: Client;
let secretaire: Client;
let technicien: Client;
let conducteur: Client;
const crees: { table: string; id: string }[] = [];

function retenir(table: string, id: string | undefined) {
  if (id) crees.push({ table, id });
  return id ?? "";
}

beforeAll(async () => {
  [admin, secretaire, technicien, conducteur] = await Promise.all([
    connecte(COMPTES.adminAlpha),
    connecte(COMPTES.secretaireAlpha),
    connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.conducteurAlpha),
  ]);
});

afterAll(async () => {
  if (!admin) return;
  // Enfants d'abord : l'ordre de création inversé.
  for (const { table, id } of [...crees].reverse()) {
    const { error } = await admin.from(table as "techniciens").delete().eq("id", id);
    if (error) console.error(`Nettoyage ${table} ${id} impossible`, error);
  }
});

describe("fonctions de droits, vues par chaque rôle (AUTH-51)", () => {
  for (const [email, role] of Object.entries(ROLES_ALPHA)) {
    it(`${role} : mon_role, role_dans_societe, mes_societes, est_membre, est_admin, peut_ecrire, voit_les_prix, a_permission`, async () => {
      const c = await connecte(email);
      expect((await c.rpc("mon_role", { p_societe: ALPHA })).data).toBe(role);
      expect((await c.rpc("role_dans_societe", { p_societe_id: ALPHA })).data).toBe(role);
      expect((await c.rpc("mon_role", { p_societe: BETA })).data).toBeNull();
      expect((await c.rpc("mes_societes")).data).toEqual([ALPHA]);
      expect((await c.rpc("est_membre", { p_societe: ALPHA })).data).toBe(true);
      expect((await c.rpc("est_membre", { p_societe: BETA })).data).toBe(false);
      expect((await c.rpc("est_admin", { p_societe: ALPHA })).data).toBe(role === "admin");
      expect((await c.rpc("peut_ecrire", { p_societe: ALPHA })).data).toBe(["admin", "conducteur", "technicien"].includes(role));
      // Le miroir d'affichage des prix dit la même chose que la base.
      expect((await c.rpc("voit_les_prix", { p_societe: ALPHA })).data).toBe(voitLesPrix(role));
      for (const [module, action] of [["devis", "creer"], ["factures", "modifier"], ["rh", "supprimer"], ["rapports", "creer"], ["utilisateurs", "voir"]] as const) {
        const attendu = droitsFixture.some((d) => d.role === role && d.module === module && d.action === action);
        expect((await c.rpc("a_permission", { p_societe_id: ALPHA, p_module: module, p_action: action })).data, `${module}/${action}`).toBe(attendu);
      }
    });
  }

  it("est_affecte_au_chantier : le terrain seul est limité à ses affectations", async () => {
    const nonAffecte = "a3000000-0000-0000-0000-000000000002";
    expect((await technicien.rpc("est_affecte_au_chantier", { p_chantier_id: CHANTIER_AFFECTE })).data).toBe(true);
    expect((await technicien.rpc("est_affecte_au_chantier", { p_chantier_id: nonAffecte })).data).toBe(false);
    expect((await conducteur.rpc("est_affecte_au_chantier", { p_chantier_id: nonAffecte })).data).toBe(true);
  });

  it("tache_a_une_equipe et est_de_l_equipe : une tâche sans équipe n'appartient à personne", async () => {
    // Le cas positif (l'équipe qui pointe sa tâche) est exercé par tests/rls/planning.essai.ts.
    expect((await technicien.rpc("tache_a_une_equipe", { p_tache_id: TACHE_SEED })).data).toBe(false);
    expect((await technicien.rpc("est_de_l_equipe", { p_tache_id: TACHE_SEED })).data).toBe(false);
  });
});

describe("relevé de pg_policy (AUTH-71)", () => {
  it("aucune politique de suppression n'est ouverte à « tout membre »", () => {
    const fautives = lireCatalogue(`
      select n.nspname || '.' || c.relname || ' · ' || p.polname
        from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'storage') and p.polcmd in ('d', '*')
         and coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'est_membre\\('`);
    expect(fautives.flat()).toEqual([]);
  });

  it("[proposition] référentiels, contrôle fournisseurs, cycle de vie, filles de véhicule : plus de suppression par peut_ecrire()", () => {
    const tables = lireCatalogue(`
      select c.relname
        from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and p.polcmd in ('d', '*')
         and c.relname in (${TABLES_ALIGNEES.map((t) => `'${t}'`).join(", ")})
         and coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'peut_ecrire\\('`).flat();
    expect(tables).toEqual([]);
  });
});

describe("[proposition] la secrétaire écrit ce que la matrice lui donne (AUTH-70)", () => {
  it("rh : équipe, sous-traitant et son document, fiche conducteur — créés puis supprimés", async () => {
    const equipe = await secretaire.from("techniciens").insert({ societe_id: ALPHA, nom: `${MARQUE} équipe`, metiers: [] }).select("id").single();
    retenir("techniciens", equipe.data?.id);
    expect(equipe.error).toBeNull();
    const st = await secretaire.from("sous_traitants").insert({ societe_id: ALPHA, nom: `${MARQUE} ST`, metiers: [], pays_code: "FR" }).select("id").single();
    expect(st.error).toBeNull();
    const stId = retenir("sous_traitants", st.data?.id);
    const doc = await secretaire.from("sous_traitant_documents").insert({ sous_traitant_id: stId, nom: `${MARQUE} Kbis` }).select("id").single();
    retenir("sous_traitant_documents", doc.data?.id);
    expect(doc.error).toBeNull();
    const cond = await secretaire.from("conducteurs").insert({ societe_id: ALPHA, nom: `${MARQUE} Conducteur` }).select("id").single();
    retenir("conducteurs", cond.data?.id);
    expect(cond.error).toBeNull();

    for (const [table, id] of [["sous_traitant_documents", doc.data?.id], ["conducteurs", cond.data?.id], ["techniciens", equipe.data?.id]] as const) {
      const { data } = await secretaire.from(table).delete().eq("id", id ?? "").select("id");
      expect(data, `${table} : la secrétaire supprime (rh / supprimer)`).toHaveLength(1);
    }
  });

  it("contrôle fournisseurs : contrôle et facture reçue, avec leurs lignes", async () => {
    const f = await secretaire.from("fournisseurs_controle").insert({ societe_id: ALPHA, nom: MARQUE }).select("id").single();
    expect(f.error).toBeNull();
    const fId = retenir("fournisseurs_controle", f.data?.id);
    const ligneF = await secretaire.from("fournisseur_controle_lignes").insert({ fournisseur_id: fId, origine: "reference", designation: MARQUE }).select("id").single();
    expect(ligneF.error).toBeNull();
    const e = await secretaire.from("factures_entrantes").insert({ societe_id: ALPHA }).select("id").single();
    expect(e.error).toBeNull();
    const eId = retenir("factures_entrantes", e.data?.id);
    const ligneE = await secretaire.from("facture_entrante_lignes").insert({ facture_entrante_id: eId, designation: MARQUE }).select("id").single();
    expect(ligneE.error).toBeNull();
    const parTechnicien = await technicien.from("fournisseur_controle_lignes").delete().eq("id", ligneF.data?.id ?? "").select("id");
    expect(parTechnicien.data, "le technicien (aucun droit sur le module) ne supprime plus").toEqual([]);
    const parSecretaire = await secretaire.from("fournisseur_controle_lignes").delete().eq("id", ligneF.data?.id ?? "").select("id");
    expect(parSecretaire.data).toHaveLength(1);
  });

  it("factures : la secrétaire, qui émet, écrit le cycle de vie", async () => {
    const { data: facture } = await admin.from("factures").select("id").eq("societe_id", ALPHA).limit(1).single();
    const cycle = await secretaire.from("facture_cycle_vie").insert({ facture_id: facture?.id ?? "", statut: "brouillon" }).select("id").single();
    expect(cycle.error).toBeNull();
    const { data } = await secretaire.from("facture_cycle_vie").delete().eq("id", cycle.data?.id ?? "").select("id");
    expect(data).toHaveLength(1);
  });

  it("véhicules : consommations comme documents et prêts (« véhicules / modifier ») — le technicien n'y écrit plus", async () => {
    const v = await admin.from("vehicules").insert({ societe_id: ALPHA, immatriculation: `${MARQUE}-01` }).select("id").single();
    expect(v.error).toBeNull();
    const vId = retenir("vehicules", v.data?.id);
    const plein = await secretaire.from("vehicule_consommations").insert({ vehicule_id: vId, litres: 40 }).select("id").single();
    expect(plein.error).toBeNull();
    retenir("vehicule_consommations", plein.data?.id);
    const intrus = await technicien.from("vehicule_consommations").insert({ vehicule_id: vId, litres: 1 });
    expect(intrus.error?.code).toBe("42501");
  });
});

describe("[proposition] suppression = « module / supprimer » (AUTH-71)", () => {
  it("ni le technicien ni le conducteur n'effacent une fiche conducteur ou un métier ; l'admin, si", async () => {
    const cond = await admin.from("conducteurs").insert({ societe_id: ALPHA, nom: `${MARQUE} Fiche` }).select("id").single();
    const metier = await admin.from("metiers").insert({ societe_id: ALPHA, libelle: `${MARQUE} Métier`, couleur: null, position: 999 }).select("id").single();
    retenir("conducteurs", cond.data?.id);
    retenir("metiers", metier.data?.id);
    expect(cond.error).toBeNull();
    expect(metier.error).toBeNull();
    for (const c of [technicien, conducteur]) {
      expect((await c.from("conducteurs").delete().eq("id", cond.data?.id ?? "").select("id")).data).toEqual([]);
      expect((await c.from("metiers").delete().eq("id", metier.data?.id ?? "").select("id")).data).toEqual([]);
    }
    expect((await admin.from("metiers").delete().eq("id", metier.data?.id ?? "").select("id")).data).toHaveLength(1);
  });
});

describe("[proposition] filles du chantier : l'affectation en toutes lettres (AUTH-72)", () => {
  it("le technicien ne lit la to-do et les documents d'un chantier qu'une fois affecté", async () => {
    const todo = await admin.from("chantier_todos").insert({ chantier_id: CHANTIER_NON_AFFECTE, texte: MARQUE, statut: "a_faire", position: 0 }).select("id").single();
    expect(todo.error).toBeNull();
    retenir("chantier_todos", todo.data?.id);
    const doc = await admin.from("chantier_documents").insert({ chantier_id: CHANTIER_NON_AFFECTE, famille: "cctp", nom: MARQUE }).select("id").single();
    expect(doc.error).toBeNull();
    retenir("chantier_documents", doc.data?.id);

    const lire = async () => ({
      todos: (await technicien.from("chantier_todos").select("id").eq("id", todo.data?.id ?? "")).data,
      docs: (await technicien.from("chantier_documents").select("id").eq("id", doc.data?.id ?? "")).data,
    });
    expect(await lire()).toEqual({ todos: [], docs: [] });

    const aff = await admin.from("chantier_affectations").insert({ chantier_id: CHANTIER_NON_AFFECTE, profile_id: PROFIL_TECHNICIEN, societe_id: ALPHA, role_sur_chantier: MARQUE }).select("id").single();
    expect(aff.error).toBeNull();
    retenir("chantier_affectations", aff.data?.id);
    const apres = await lire();
    expect(apres.todos).toHaveLength(1);
    expect(apres.docs).toHaveLength(1);
  });

  it("la politique de lecture cite est_affecte_au_chantier sur les quatre filles", () => {
    const lignes = lireCatalogue(`
      select c.relname
        from pg_policy p join pg_class c on c.oid = p.polrelid
       where c.relname in ('chantier_documents', 'chantier_inspections', 'chantier_todos', 'chantier_comptes_rendus')
         and p.polcmd = 'r' and pg_get_expr(p.polqual, p.polrelid) ~ 'est_affecte_au_chantier'`).flat();
    expect(lignes.sort()).toEqual(["chantier_comptes_rendus", "chantier_documents", "chantier_inspections", "chantier_todos"]);
  });

  it("l'administrateur relit le chantier qu'il crée, dans la même requête (insert … select)", async () => {
    // Défaut reproduit : est_affecte_au_chantier() relisait une ligne encore invisible → 42501.
    const ch = await admin.from("chantiers").insert({ societe_id: ALPHA, nom: `${MARQUE} chantier` }).select("id, nom").single();
    expect(ch.error).toBeNull();
    retenir("chantiers", ch.data?.id);
    expect(ch.data?.nom).toBe(`${MARQUE} chantier`);
    // Le terrain, lui, ne le voit toujours pas : il n'y est pas affecté.
    expect((await technicien.from("chantiers").select("id").eq("id", ch.data?.id ?? "")).data).toEqual([]);
  });
});
