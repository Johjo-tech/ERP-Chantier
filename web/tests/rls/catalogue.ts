import { execFileSync } from "node:child_process";

/**
 * Lire le catalogue Postgres (`pg_policy`, `pg_proc`) de la base LOCALE.
 *
 * PostgREST ne sert pas le catalogue : pour relever les politiques telles
 * qu'elles sont VRAIMENT en base, on passe par le conteneur local, comme la
 * préparation des parcours e2e. Aucune autre cible n'est possible — le nom du
 * conteneur est celui du projet local de web/ — et la requête est enfermée
 * dans une transaction en lecture seule : ce relevé ne peut rien écrire.
 */
const CONTENEUR = "supabase_db_erp-chantier-web";
const SEPARATEUR = "\u001f";

export function lireCatalogue(sql: string): string[][] {
  const sortie = execFileSync(
    "docker",
    ["exec", "-i", CONTENEUR, "psql", "-U", "postgres", "-X", "-q", "-A", "-t", "-F", SEPARATEUR, "-v", "ON_ERROR_STOP=1"],
    { input: `begin transaction read only;\n${sql};\nrollback;`, encoding: "utf8" }
  );
  return sortie
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(SEPARATEUR));
}
