# articles

**Rôle** : le catalogue d'articles de la société — liste paginée côté serveur,
fiche, retrait / remise, import du fichier du logiciel de gestion, et le choix
d'un article depuis une ligne de document.

- **Table** : `articles` (unicité `(societe_id, code)`, index trigrammes sur
  `code` et `designation`). Jamais chargée en entier : tout passe par des
  requêtes filtrées, comptées (`count: exact`) et paginées (25 par page).
- **Droits** : module `articles`. Lecture : admin, secrétaire, conducteur,
  lecture ; écriture (`<Can action="modifier">`, routes `nouveau`, `:id/modifier`,
  `import`) : admin et secrétaire. Technicien et sous-traitant : aucun accès,
  ni à l'écran ni en base (ART-40). L'import exige en plus le niveau
  d'abonnement `import_articles`.
- **Règles** :
  - jamais de suppression — retirer / remettre (`actif`), des documents citent le code ;
  - code en double (23505) → « Le code « X » existe déjà dans le catalogue. » ;
  - une ligne de document ne se remplit qu'avec un article ACTIF, 20 propositions au plus ;
  - choisir un article (`domain/ligne.ts#appliquerArticle`) COPIE désignation,
    prix, TVA, unité, référence et description (si aucun commentaire n'est déjà
    écrit) — jamais la quantité ni l'identifiant ;
  - import (`domain/import.ts`) : port à l'identique de l'ancien lecteur
    (encodage constaté, découpe sur `;` sans guillemets, colonnes par nom, TVA
    `INTER`/`NORMA`/`EXO`/`0` — RM-06) ; écriture par `upsert` sur
    `(societe_id, code)`, lots de 200, un lot refusé n'arrête pas les autres.
- **Parité** : `tests/parite/import-articles.essai.ts` (600 fichiers tirés à
  graine fixe, en octets, contre `src/api/regles-import-articles.ts`).
- **Base** : `tests/rls/articles.essai.ts` — rôles, isolement BETA, recherche
  échappée, pagination, import par lots.
- **Intégration attendue** : `components/ChoixArticle` (combobox accessible,
  `onChoisir(article)`, `onCreer(code)`) et `domain/ligne.ts` sont prêts pour
  l'éditeur de lignes du module `documents`, qui ne les emploie pas encore.
  Créer l'article depuis une ligne : naviguer vers `/articles/nouveau` avec
  `state: { brouillon: brouillonDepuisLigne(ligne, code), retour }`.
- **Non repris** : `articles.metier` (ART-50, D-025) ; export / sauvegarde du
  catalogue complet (`catalogueComplet`) ; liste de familles proposée à la
  saisie (`datalist`) ; pré-facture (second éditeur de l'ancien écran).
