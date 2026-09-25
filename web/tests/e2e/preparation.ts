import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Avant les parcours : efface leurs traces de la base LOCALE et rejoue le jeu
 * d'essai, pour qu'ils se rejouent à l'identique. Passe par le conteneur local
 * (docker exec) : aucune autre cible n'est possible.
 */
export default function preparation() {
  const psql = (sql: string) =>
    execFileSync("docker", ["exec", "-i", "supabase_db_erp-chantier-web", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql });
  psql(`
    delete from reglements where facture_id in (select id from factures where devis_id = 'a4000000-0000-0000-0000-000000000002' or chantier_id = 'a3000000-0000-0000-0000-000000000002');
    -- Les factures émises sont protégées par la base ; en local seulement, on lève la garde le temps du ménage.
    set session_replication_role = replica;
    delete from facture_lignes where facture_id in (select id from factures where devis_id = 'a4000000-0000-0000-0000-000000000002' or chantier_id = 'a3000000-0000-0000-0000-000000000002');
    delete from factures where devis_id = 'a4000000-0000-0000-0000-000000000002' or chantier_id = 'a3000000-0000-0000-0000-000000000002';
    set session_replication_role = origin;
    delete from chantier_dpgf_lignes where designation like 'E2E %';
    -- Parcours commandes : la facture née du bon chiffré, les bons créés, la pièce du jeu d'essai.
    -- En local, joué par postgres : le circuit (réservé aux RPC) se remet à « chiffre » sans elles.
    set session_replication_role = replica;
    delete from facture_lignes where facture_id in (select id from factures where bon_commande_id = 'a5000000-0000-0000-0000-000000000001');
    delete from factures where bon_commande_id = 'a5000000-0000-0000-0000-000000000001';
    set session_replication_role = origin;
    update bons_commande set statut_workflow = 'chiffre' where id = 'a5000000-0000-0000-0000-000000000001';
    delete from bons_commande where nature_travaux like 'E2E %';
    update planning_taches set piece_a_commander = true, piece_date_commande = null, piece_fournisseur = null, piece_recue_le = null, date_tache = '2026-09-22'
      where id = 'a6000000-0000-0000-0000-000000000001';
    delete from devis where client_nom = 'SCI Les Tilleuls';
  `);
  psql(readFileSync(join(import.meta.dirname, "../../supabase/seed-web.sql"), "utf8"));
}
