# materiel

**Rôle** : l'inventaire du matériel et de l'outillage (INVENTAIRE §13, VEH-05,
VEH-20) — liste avec recherche et statut Disponible / En prêt, fiche, prêts et
retours. Fournit aussi au module `vehicules` ce qui est commun aux prêts du
parc : `domain/prets.ts`, `FormulairePret`, `HistoriquePrets`, l'annuaire des
salariés et les listes « états » / « catégories ».

- **Tables** : `materiels`, `materiel_prets` (colonne `duree_jours` proposée par
  `20260926070000`), `referentiels` (domaines `etat_materiel`,
  `categorie_materiel`), `v_salaries_annuaire` (identité seulement).
- **Droits** : module `materiel` (admin et conducteur : tout ; technicien : voir,
  modifier — il prête et rend ; secrétaire, sous-traitant, lecture : voir). Les
  prêts suivent « matériel / modifier » (proposition, D-VEH-01).
- **Règles** (`domain/`) : un prêt est en cours tant qu'il n'a pas de retour
  réel (`materielStatut`) ; retour prévu = début + durée en jours de calendrier ;
  états = référentiel, sinon la liste de repli, valeur courante réinjectée ;
  catégories = référentiel PUIS celles déjà employées (`referentielCompose`).
  Parité : `tests/parite/vehicules.essai.ts`.
- **Écarts voulus** : durée entière ≥ 1 (l'ancien acceptait « -2 ») ; un seul
  prêt en cours par objet, garanti en base ; supprimer un prêt se confirme.
