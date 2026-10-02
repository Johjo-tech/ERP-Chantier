# statistiques

**Rôle** : les tableaux de bord de l'accueil — un par métier — et l'écran
Statistiques (section 14 de l'inventaire, STA-01 à STA-22). **La forme est
celle de l'ancien écran, ses défauts de calcul sont corrigés** (décision du
client du 28/09, D-STA-B-01, qui remplace D-STA-A-01) : chaque défaut
corrigé est décrit dans `docs/DEFAUTS-A-TRANCHER.md` (DEF-STA-01 à 19,
DEF-ECR-03, 04). Les nouveautés de production du 28/09 sont gardées
(D-MAIN-10 : référence N-1, « Facturé AAAA », top clients par exercice,
millésime de chaque barre, fil rangé par date des pièces).

- **Accueil** (`/`, `TableauDeBord`, choisi par le rôle EFFECTIF — « voir en
  tant que » compris) :
  - **pilotage** (admin, secrétaire, lecture) : recherche globale, actions
    rapides sous le droit « créer », tuiles « Encaissé ce mois (TTC) »
    (règlements datés du mois, hors lettrage, DEF-STA-02) / Devis en attente /
    Factures impayées (sur le solde de la base, DEF-STA-03, 04) / À facturer,
    « À traiter » (rappels des bons ouverts, échues selon la base), chiffre
    d'affaires HT des pièces émises hors acompte sur 6 ou 12 mois face à N-1
    (DEF-STA-01 ; SVG + tableau équivalent), total d'une plage libre, activité
    récente (6, sans « · null » ni lettrage, DEF-STA-06), top 5 clients par
    fiche (DEF-STA-07), résumé du mois ;
  - **conducteur** : ses affaires, par `conducteurs.profile_id` (sans fiche :
    toute la société, et le bandeau de l'ancien le dit) ; tuiles Hors délai /
    SAV / À valider / Sans rendez-vous, « À traiter » (injoignables comptés,
    DEF-STA-12), mesures sur 90 jours. **Aucun montant** : l'API ne demande
    même pas les colonnes de prix ;
  - **technicien** et **sous-traitant** : leur journée sur les CARTES du
    planning (`domain/terrain.ts`), par l'équipe ou l'entreprise du compte,
    journées supplémentaires comprises (DEF-STA-13) ; le sous-traitant est
    salué au nom de son entreprise (`monSousTraitantId`, DEF-STA-19) et reçoit
    ce tableau à la place de tuiles de devis et factures inexistantes
    (DEF-STA-14). **Aucun montant**.
- **Statistiques** (`/statistiques`, matrice « statistiques / voir ») : par
  RÉFÉRENCE de conducteur avec une ligne « Sans conducteur » (DEF-STA-08),
  retard sur les bons ouverts (DEF-STA-09), barre vide sans bon (DEF-STA-10),
  travaux supplémentaires de `tache_travaux_supplementaires` (DEF-STA-11),
  répartition sans part négative (DEF-STA-17), bons rangés par date de
  commande (DEF-STA-18) ; CA par équipe et par mois ; période tout / année /
  mois.
- **Calculs** : `domain/pieces.ts` (ce qui entre au chiffre d'affaires —
  `htCompte` —, lettrages, taux), `domain/tableau.ts` (pilotage),
  `domain/statistiques.ts`, `domain/terrain.ts`, `domain/conducteur.ts`
  (`statsConducteur`). **Décimal exact** (`@/lib/money`), aucune exception au
  garde-fou ; les montants s'écrivent par `components/format.ts#formatMontant`
  (arrondi décimal au centime, mode discret compris).
- **Base** : lecture seule, sous la RLS de chaque table. `api/collections.ts`
  lit les pièces AVEC le HT de la base (`v_facture_totaux`, `v_devis_totaux`)
  et le nom de la fiche client, les règlements (avec leur mode), rapports,
  bons (`v_bons_commande_terrain`), fiches de conducteur, équipes, états des
  tâches et travaux supplémentaires ; le solde de chaque pièce est celui de
  `v_facture_solde` (proposition 20260926040000), lu par le module de
  facturation (`useSoldes`, même cache que l'écran des factures) : le tableau
  de bord ne peut pas le contredire. « À traiter » reprend `useBons`
  (commandes) ; le technicien et le sous-traitant, `usePlanning`. Aucune
  fonction `stats_*` : la proposition 20260926080000 reste retirée (D-STA-B-01).
- **Graphiques** : SVG écrits à la main, sans bibliothèque, à la géométrie de
  l'ancien (`barresGraphique`) ; chaque graphique a sa légende, son survol
  clavier et son tableau.
- **Parité** : `tests/parite/statistiques.essai.ts` évalue la source de
  `app.js` et prouve (1) l'écart voulu — sur un même cas, l'ancien donne la
  valeur fausse, le nouveau la juste, un cas nommé par DEF-STA-xx — et (2)
  que rien d'autre ne change — sur des sociétés tirées au hasard où aucun
  défaut ne joue, mêmes chiffres que l'ancien. RLS :
  `tests/rls/statistiques.essai.ts`.
- **Non repris** : le filtre dans l'adresse des tuiles vers la liste des
  factures (l'ancien ouvrait « payées ce mois ») — la tuile ouvre les
  règlements.
