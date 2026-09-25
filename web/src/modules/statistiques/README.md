# statistiques

**Rôle** : les tableaux de bord de l'accueil — un par métier — et l'écran
Statistiques (section 14 de l'inventaire, STA-01 à STA-22).

- **Accueil** (`/`, `TableauDeBord`, choisi par le rôle EFFECTIF — « voir en
  tant que » compris) :
  - **pilotage** (admin, secrétaire, lecture) : recherche globale (devis,
    factures, rapports ; Entrée passe au résultat suivant), actions rapides
    sous le droit « créer », tuiles Encaissé ce mois / Devis en attente /
    Factures impayées / À facturer, « À traiter », chiffre d'affaires HT sur 6
    ou 12 mois ou depuis janvier face à N-1 (SVG + tableau équivalent), total
    d'une plage libre, activité récente (6), top 5 clients, résumé du mois
    (conversion des devis, taux d'encaissement RM-70) ;
  - **conducteur** : ses affaires, par `conducteurs.profile_id` (sans fiche :
    toute la société, et un bandeau le dit) ; tuiles Hors délai / SAV / À
    valider / Sans rendez-vous, « À traiter », mesures sur 90 jours. **Aucun
    montant** : l'API ne demande même pas les colonnes de prix ;
  - **terrain** (technicien, sous-traitant) : interventions du jour (8 au
    plus), six jours suivants, travaux à pointer, pièces signalées — tout
    renvoie à « Ma journée » du planning. **Aucun montant.**
- **Statistiques** (`/statistiques`, matrice « statistiques / voir » : admin,
  secrétaire, conducteur, lecture) : par conducteur (par `conducteur_id`), par
  métier, par client, CA par équipe et par mois ; période tout / année / mois /
  plage libre.
- **Base** : les montants et les comptes viennent des fonctions d'agrégat de la
  proposition `20260926080000_statistiques_de_pilotage.sql` (`stats_*`, SECURITY
  INVOKER + garde « statistiques / voir »), qui lisent `v_facture_totaux`,
  `v_facture_solde` (proposition 20260926040000) et `v_devis_totaux`. L'écran
  n'en tire que des taux et des parts (`domain/indicateurs.ts`).
  Le conducteur lit `conducteurs`, `v_bons_commande_terrain` (sans prix),
  `planning_taches`, `factures.bon_commande_id` ; le terrain lit le planning
  (`usePlanning`) ; « À traiter » du pilotage lit les bons (`useBons`) ; la
  recherche, les listes des devis, soldes et rapports, **à la première frappe**.
- **Définitions** (D-STA-01 à D-STA-08) : CA = pièces émises, avoirs en
  négatif, sans brouillon ni facture d'acompte ; « encaissé » = règlements
  datés du mois (TTC), hors lettrage d'avoir ; « en retard » = fin de travaux
  dépassée sur un bon ouvert ; injoignable = 3 tentatives ou plus (STA-20).
- **Graphiques** : SVG écrits à la main, sans bibliothèque ; l'année en cours
  prend `--color-accent-societe` s'il est posé ; chaque graphique a sa
  légende, son survol clavier et son tableau.
- **Parité** : `tests/parite/statistiques.essai.ts` (source de `app.js` évaluée :
  `computeMonthSummary` pour RM-70, `statsConducteur`, `buildMonthsBack`,
  `computeRevenuePeriod`, `relativeTime`). RLS : `tests/rls/statistiques.essai.ts`.
- **Non repris** : le tableau de bord du sous-traitant sur ses factures et devis
  (FST et devis de sous-traitant non repris — D-FAC-09, D-FAC-14 : il reçoit le
  tableau du terrain) ; le filtre dans l'adresse des listes de devis, bons et
  planning (D-STA-07).
