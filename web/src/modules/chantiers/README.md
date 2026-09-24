# chantiers

**Rôle** : chantiers (fiche, client, conducteur, période) et leur DPGF
(lignes chiffrées, avancement facturé).

- **Tables / vues** : `chantiers`, `chantier_affectations` (le terrain ne voit que
  ses chantiers affectés — `est_affecte_au_chantier`), `chantier_dpgf_lignes`
  (lisible seulement avec `chantiers/modifier`), vue `v_chantier_avancement`.
- **Règles** (`domain/dpgf.ts`) : total DPGF = Σ qté × PU des lignes ; facturé =
  Σ total × avancement / 100 ; pourcentage arrondi à l'unité. Une ligne déjà
  facturée ne se supprime pas.
- **Écart voulu** : l'ancien écran rangeait le DPGF dans le JSON du chantier, et
  il se perdait au rechargement (colonne inexistante). `web/` écrit dans la
  table `chantier_dpgf_lignes`, qui existait déjà.
- **Composition** : les devis du chantier et les situations de travaux viennent
  d'autres modules, branchés dans `app/` par les props `complements` et
  `actionsDpgf` — un module n'importe pas les composants d'un autre.
- **Non repris cette nuit** : comptes-rendus, fichiers, PPSPS, DOE, achats,
  to-do, import Excel du DPGF, affectations (écran).
