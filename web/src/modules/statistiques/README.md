# statistiques

**Rôle** : les tableaux de bord de l'accueil — un par métier — et l'écran
Statistiques (section 14 de l'inventaire, STA-01 à STA-22). **Chaque chiffre
est calculé comme l'ancien écran, défauts compris** (décision du client,
D-STA-A-01) ; les défauts ainsi gardés sont décrits dans
`docs/DEFAUTS-A-TRANCHER.md` (DEF-STA-01 à 19), avec la correction à remettre.

- **Accueil** (`/`, `TableauDeBord`, choisi par le rôle EFFECTIF — « voir en
  tant que » compris) :
  - **pilotage** (admin, secrétaire, lecture) : recherche globale, actions
    rapides sous le droit « créer », tuiles « CA encaissé ce mois (HT) » /
    Devis en attente / Factures impayées / À facturer, « À traiter », chiffre
    d'affaires HT sur 6 ou 12 mois face à N-1 (SVG + tableau équivalent), total
    d'une plage libre, activité récente (6), top 5 clients, résumé du mois ;
  - **conducteur** : ses affaires, par `conducteurs.profile_id` (sans fiche :
    toute la société, et le bandeau de l'ancien le dit) ; tuiles Hors délai /
    SAV / À valider / Sans rendez-vous, « À traiter », mesures sur 90 jours.
    **Aucun montant** : l'API ne demande même pas les colonnes de prix ;
  - **technicien** : ses bons par la colonne `technicien` (uuid ou libellé de
    son équipe ; sans équipe, tous) — rendez-vous du jour (8 au plus), six
    jours suivants, travaux à pointer, pièces. **Aucun montant** ;
  - **sous-traitant** : ses trois tuiles (factures prêtes, devis, impayés),
    sans sous-traitant « actuel », comme chaque ouverture de l'ancien
    (salutation « Sous-traitant » et bandeau, DEF-STA-19).
- **Statistiques** (`/statistiques`, matrice « statistiques / voir ») : par
  conducteur (par l'étiquette portée par les pièces), CA par équipe et par
  mois ; période tout / année / mois.
- **Calculs** : `domain/ancien/` — `montants.ts` (`computeDocTotals`,
  `reglementStatutFacture`), `pilotage.ts`, `statistiques.ts`, `terrain.ts` —
  en **virgule flottante**, `Math.round` compris : seule exception au décimal
  exact du domaine (garde-fou `CALCULS_DE_L_ANCIEN`). Les montants s'écrivent
  par `components/format.ts#formatEurosEcranAncien` (comme `moneyDisplay`, mode
  discret compris). `domain/conducteur.ts` : `statsConducteur`.
- **Base** : lecture seule, sous la RLS de chaque table — `api/collections.ts`
  lit, comme `chargerCollection`, toutes les factures et tous les devis (avec
  leurs lignes), règlements, rapports, bons (`v_bons_commande_terrain`), fiches
  de conducteur et équipes ; « À traiter » reprend `useBons` (commandes) ; le
  technicien et le sous-traitant, `usePlanning`. Le conducteur lit
  `conducteurs`, `v_bons_commande_terrain` (sans prix), `planning_taches`,
  `factures.bon_commande_id`. La proposition `20260926080000` (`stats_*`) est
  retirée.
- **Graphiques** : SVG écrits à la main, sans bibliothèque, à la géométrie de
  l'ancien (`barresGraphique`) ; chaque graphique a sa légende, son survol
  clavier et son tableau.
- **Parité** : `tests/parite/statistiques.essai.ts` évalue la source de
  `app.js` (`renderDashboard`, `computeMonthSummary`, `computeDashTraiter`,
  `computeRevenuePeriod`, `computeCustomRevenue`, `buildActivityFeed`,
  `renderTopClientsHTML`, `computeStatsParConducteur`,
  `computeStatsBinomesParMois`, `renderStats*`, `renderYearlyComparisonSVG`,
  `renderDashboardTechnicien`, `renderDashboardSousTraitant`,
  `statsConducteur`, `relativeTime`) et compare au flottant près, à l'heure
  de Paris, avec un cas nommé par défaut DEF-STA-xx. RLS :
  `tests/rls/statistiques.essai.ts`.
- **Non repris** : le filtre dans l'adresse des tuiles vers la liste des
  factures (l'ancien ouvrait « payées ce mois ») — la tuile ouvre les
  règlements.
