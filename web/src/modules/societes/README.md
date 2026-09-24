# societes

**Rôle** : multi-sociétés — sélecteur en haut à gauche, société active,
niveaux d'abonnement (drapeaux de fonctionnalités).

- **Tables** : `societes` (lue via `membres_societe` dans la session).
- **Règles** : la société active est mémorisée si le compte y est encore membre,
  sinon la première par ordre alphabétique ; changer de société remonte tout
  l'écran (aucun état ne survit d'une société à l'autre) ; les clés de requête
  portent toujours `societe_id`.
- **Abonnement** : 5 niveaux (`domain/abonnement.ts`), tout ouvert tant que la
  base n'a pas de niveau (DECISIONS D-009).
