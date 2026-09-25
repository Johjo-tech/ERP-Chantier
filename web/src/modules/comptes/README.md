# comptes

**Rôle** : comptes et accès d'une société — membres, rôles, accès actif ou
désactivé, invitations des salariés (rubrique « Comptes et invitations » de
l'écran Réglages).

- **Tables** : `membres_societe` (+ `profiles` pour nom et adresse),
  `invitations`, `v_salaries_annuaire` (salariés sans compte), `conducteurs`
  (rôle proposé). **Fonction de bord** : `inviter-salarie` (créer une identité
  exige la clé de service).
- **Droits** : `utilisateurs` (administrateur seul) ; la RLS (`membres_*`,
  `invitations_*` : `est_admin`) est la vraie barrière. Une écriture que la RLS
  écarte touche zéro ligne sans erreur : l'api le détecte et le dit.
- **Règles** : rôle proposé `conducteur` si une fiche conducteur suit le
  salarié, sinon `technicien` ; `sous_traitant` n'est pas invitable ; donner le
  rôle administrateur se confirme ; le dernier administrateur et son propre rôle
  sont verrouillés (miroir de `proteger_dernier_admin`, dont les refus sont
  redits en français) ; désactiver l'accès garde la ligne (historique).
- **Tests** : `domain/comptes.essai.ts`, `components/comptes.essai.tsx`,
  `tests/rls/comptes.essai.ts` (compte jetable, jamais les comptes du jeu d'essai).
- **Pas repris** : inviter un sous-traitant (AUTH-79, D-SOC-08) ; la
  désactivation d'un PROFIL (toutes sociétés) reste une opération du service.
