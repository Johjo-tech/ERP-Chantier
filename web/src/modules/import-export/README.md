# import-export

**Rôle** : faire entrer des données venues d'ailleurs, et sortir celles de la
société — import de clients, reprise d'un historique de facturation déjà
numéroté, sauvegarde JSON. L'import d'articles vit dans `articles`, celui du
DPGF dans `chantiers` (IMP-30) : ce module les signale depuis `/import-export`.

- **Écrans** : `/clients/import` (bouton « Importer un fichier » de la liste),
  `/factures/import` (« Reprendre un historique »), `/import-export` (menu,
  sous `reglages`).
- **Tables** : `clients` (lecture de rapprochement, insert par lots, update),
  `factures` + `facture_lignes` (reprise en trois temps), lecture de toutes les
  collections de la société pour la sauvegarde. Aucune migration nouvelle : la
  reprise s'appuie sur la proposition `20260925040000` (seul un `legacy_id`
  « compta: » peut fournir son numéro).
- **Droits** : un import CRÉE et MET À JOUR — bouton visible seulement avec
  `creer` ET `modifier` sur `clients` (CLI-08) ou `factures` (IMP-23) ; la RLS
  refuse le reste (`tests/rls/import-export.essai.ts`).
- **Règles** (`domain/`, parités `tests/parite/import-clients.essai.ts`,
  `import-factures.essai.ts`) :
  - `csv.ts` — CSV conforme RFC 4180 (le `;` et le retour à la ligne vivent
    dans un champ cité), numéros de ligne du FICHIER ;
  - `clients.ts` — colonnes Vertuoza par leur nom, pays → ISO, conditions →
    délai, immatriculation par clé de Luhn, rapprochement SIRET puis nom,
    doublons du fichier ; `apercu-clients.ts` — ce qui sera écrit ; une mise à
    jour n'efface rien et ne change pas le type (D-EFA-07), pas d'annuaire
    (D-EFA-06) ;
  - `factures.ts` — alias de colonnes, séparateur constaté, dates ISO seules,
    contrôles à 0,011 (signe, TVA, TTC, somme des lignes), un rejet bloque
    TOUT, 0 % sans catégorie mis de côté ; `apercu-factures.ts` — rapprochement
    exact puis préfixe, collisions de numéros, statut « payée », montants en
    valeur absolue, legacy « compta: » ;
  - `sauvegarde.ts` — le fichier `terrain-sauvegarde-AAAA-MM-JJ.json`,
    `version: 2`.
- **Écriture** (`api/`) : clients par lots de 200 à clés uniformisées, mises à
  jour une par une ; factures pièce par pièce, brouillon → lignes → numéro +
  statut en un ordre ; brouillons orphelins supprimables tant qu'ils n'ont pas
  de numéro.
- **Non repris** : la restauration d'une sauvegarde (D-EFA-08), l'annuaire des
  entreprises à l'import (D-EFA-06). L'ancien n'avait aucun export CSV/Excel
  des listes ni d'export comptable : rien à reprendre.
