# societes

**Rôle** : multi-sociétés — sélecteur en haut à gauche, société active,
niveaux d'abonnement (drapeaux de fonctionnalités), identité légale, réglages de
documents et couleur de la société.

- **Tables** : `societes` (lue via `membres_societe` dans la session ; fiche
  complète par `api/societe.ts`), `societe_settings.infos_entreprise` (réglages,
  `api/reglages.ts`), bucket `terrain` (logo sous `<societe>/societe/`).
- **Règles** : la société active est mémorisée si le compte y est encore membre,
  sinon la première par ordre alphabétique ; changer de société remonte tout
  l'écran (aucun état ne survit d'une société à l'autre) ; les clés de requête
  portent toujours `societe_id`.
- **Identité** (`domain/societe.ts`) : saisie Zod, mal formé bloquant, complétude
  et recommandations séparées (parité `regles-efacture.ts`).
- **Réglages** : `domain/reglages.ts` (la part documents, lue par les autres
  modules) et `domain/reglages-societe.ts` (tout le document, `fusionnerReglages`
  à l'identique ; écriture par fusion, jamais par remplacement).
- **Couleur** : `theme/palette.ts` (portage de `regles-theme.ts`) et
  `<ThemeSociete>` qui la pose sur l'écran une fois les réglages lus (SOC-04, SOC-40).
- **Abonnement** : 5 niveaux (`domain/abonnement.ts`), tout ouvert tant que la
  base n'a pas de niveau (DECISIONS D-009).
