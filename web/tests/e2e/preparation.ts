import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Avant les parcours : efface leurs traces de la base LOCALE et rejoue le jeu
 * d'essai, pour qu'ils se rejouent à l'identique. Passe par le conteneur local
 * (docker exec) : aucune autre cible n'est possible.
 */
/** Les parcours émettent des factures, que rien ne supprime : jamais ailleurs qu'en local. */
function verifierBaseLocale() {
  const env = readFileSync(join(import.meta.dirname, "../../.env.local"), "utf8");
  const url = /^VITE_SUPABASE_URL="?([^"\n]+)"?/m.exec(env)?.[1] ?? "";
  const hote = URL.canParse(url) ? new URL(url).hostname : "";
  if (!["127.0.0.1", "localhost", "::1"].includes(hote)) {
    throw new Error(`Parcours e2e refusés : .env.local vise « ${hote || url} », pas la base locale.`);
  }
}

export default function preparation() {
  verifierBaseLocale();
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
    delete from devis where client_nom = 'SCI Les Tilleuls';
  `);
  psql(readFileSync(join(import.meta.dirname, "../../supabase/seed-web.sql"), "utf8"));
}
