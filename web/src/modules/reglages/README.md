# reglages

**Rôle** : l'écran Réglages (`/reglages/:rubrique`), rubriques groupées comme dans
l'ancien écran (PAR-01) : Société (Organisation, Identité visuelle, Documents
légaux) · Documents (Devis & factures, Numérotation) · Référentiels (Listes de
choix, Intervenants, RH, Véhicules, Conduite, Notifications) · Accès (Comptes).
« Mon compte » vit à part (`/mon-compte`, module `auth-roles`) : il est ouvert à
tous les rôles.

- **Tables** : `societes` (identité, via `societes/api/societe.ts`),
  `societe_settings.infos_entreprise.reglages` (via `societes/api/reglages.ts`),
  `compteurs`, `documents_legaux` + bucket `terrain` (`<societe>/documents-legaux/…`),
  `referentiels`, `metiers`, `conducteurs`, `fournisseurs`.
- **Droits** : l'écran s'ouvre avec `reglages/voir` ; on n'y ÉCRIT qu'avec
  `reglages/modifier` (administrateur). La base est plus large pour les listes et
  intervenants (`peut_ecrire` : admin, conducteur, technicien) : l'écran reste au
  plus étroit (D-SOC-05). La rubrique Comptes exige `utilisateurs/voir`.
- **Règles** : enregistrement par FUSION (SOC-07) puis relecture (PAR-02) ;
  le mal formé bloque (SIRET, SIREN, TVA), le manquant s'affiche dans le bandeau
  de complétude (SOC-06) ; un compteur qui baisse se confirme (PAR-03) ; code de
  liste dérivé du libellé par `normaliserEntree`, puis figé (PAR-04, PAR-21) ;
  métier employé indélébile et renommage propagé, tenus par la base (PAR-05) ;
  `actif` toujours envoyé pour conducteurs et fournisseurs (PAR-06).
- **Tests** : `domain/reglages.essai.ts`, `components/reglages.essai.tsx`,
  `tests/parite/reglages.essai.ts`, `tests/rls/reglages.essai.ts`.
- **Pas repris** : sous-traitants et équipes (écran RH), aperçu grandeur nature
  de la couleur sur tout l'écran avant enregistrement (D-SOC-04).
