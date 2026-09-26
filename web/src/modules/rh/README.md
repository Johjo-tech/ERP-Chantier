# rh

**Rôle** : l'onglet RH (`/rh`, section 12 de l'inventaire, RH-01 à RH-21) et
les intervenants rangés sous `rh` par la matrice (PAR-06) — salariés, dossier
documentaire, registre des visites médicales, équipes, sous-traitants, congés
et absences, registre unique du personnel (`/rh/registre`), fiche salarié
(`/rh/salaries/nouveau`, `/rh/salaries/:id`).

- **Tables** : `salaries` (qui a `rh / modifier`) ou `v_salaries_annuaire`
  (les autres : salaire, coût, naissance, IBAN, suivi médical et notes masqués —
  proposition 20260926060000), `salarie_documents`, `salarie_visites_medicales`,
  `salarie_absences`, `techniciens` (équipes), `sous_traitants`,
  `sous_traitant_documents`, `conducteurs` (fiche liée au salarié) ; fichiers au
  seau `terrain`, sous `<société>/salaries/<salarié>/` et
  `<société>/sous-traitants/<id>/`. Comptes et invitations : `comptes/api`.
- **Droits** (miroir de la matrice, la RLS tranche) : l'onglet s'ouvre avec
  `rh / voir` (admin, secrétaire, conducteur, technicien, lecture) ; fiche
  complète, dossiers, visites, congés, registre et coûts avec `rh / modifier`
  (admin, secrétaire) ; équipes, sous-traitants et case « Conducteur de
  travaux » exigent EN PLUS `peut_ecrire()` — soit l'administrateur (D-RH-05) ;
  inviter un compte et changer son rôle : `utilisateurs`.
- **Règles** : dossier incomplet = pièce obligatoire manquante, document
  expiré OU suivi médical inconnu/dépassé (RH-09) ; seuils de Réglages › RH
  (documents 30 j, visites 45 j, carte BTP et habilitations 60 j — D-RH-04) ;
  l'échéance médicale qui fait foi est la colonne de la fiche, tenue par la
  base ; échéance proposée selon le régime, dépassement du plafond averti sans
  bloquer (RH-07) ; solde CP = acquis − congés payés, jours ouvrés hors
  week-end (fériés comptés — RH-08) ; décocher « Conducteur » retire la fiche
  (`actif = false`), cocher la crée et PROPOSE le rôle au compte (RH-06,
  AUTH-20) ; habilitations et visites choisies avant la création partent avec
  la fiche, une à une, ce qui échoue reste à l'écran.
- **Tests** : `domain/rh.essai.ts`, `components/rh.essai.tsx`,
  `tests/parite/rh.essai.ts` (regles-documents-rh, regles-visite-medicale,
  `nbJoursOuvres`, `soldeCPRestant`, `technicienLabel` d'`app.js`),
  `tests/rls/rh.essai.ts`.
- **Pas repris** : `salarie_habilitations` (les habilitations vivent au
  dossier, comme dans l'ancien écran — D-RH-03) ; `nom2`/`nom3`/composition des
  équipes (RH-21, D-RH-06) ; notes de frais (l'ancien onglet RH n'en gère pas) ;
  prêts de véhicules et de matériel (section 13).
