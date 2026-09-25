# Tests RLS

Les tests de politiques tournent contre la base **locale** de `web/`
(`npm run base:locale` puis `npm run test:rls`). `tests/rls/cible.ts` refuse
toute cible qui n'est pas une boucle locale — le projet historique a laissé
ses tests écrire neuf jours en production.

## Jeu d'essai (`supabase/seed-web.sql`)

| Compte | Société | Rôle |
|---|---|---|
| admin.alpha@erp.local | ALPHA | admin |
| secretaire.alpha@erp.local | ALPHA | secrétaire |
| conducteur.alpha@erp.local | ALPHA | conducteur |
| technicien.alpha@erp.local | ALPHA | technicien (affecté au chantier « Réhabilitation bât. C ») |
| lecture.alpha@erp.local | ALPHA | lecture |
| soustraitant.alpha@erp.local | ALPHA | sous-traitant (affecté à « Salle de bains Durand ») |
| admin.beta@erp.local | BETA | admin |
| client.opac@erp.local | — (accès client à « OPAC du Rhône ») | espace client (proposition) |

Mot de passe de tous : `motdepasse-local`.

## Scénarios automatisés

| Fichier | Scénario | Dépend d'une proposition |
|---|---|---|
| `isolement.essai.ts` | La matrice figée des tests d'interface = `role_permissions` en base | non |
| | Chaque compte d'ALPHA : aucune ligne de BETA (clients, chantiers, devis, articles) ; ne voit que la société ALPHA | non |
| | L'admin de BETA ne voit que BETA ; un compte d'ALPHA ne peut pas écrire dans BETA (42501) | non |
| | L'anonyme ne voit rien | non |
| | Technicien et sous-traitant : ni devis, ni lignes, ni articles, ni factures | non |
| | Le terrain ne voit que les chantiers où il est affecté | non |
| | Lecture lit mais n'écrit ni ne modifie ; le conducteur ne supprime pas un devis | non |
| `filles.essai.ts` | Secrétaire ajoute un interlocuteur ; lecture n'en supprime pas ; technicien n'en ajoute pas | **oui** (20260925010000) |
| | DPGF : conducteur lit/écrit ; technicien, secrétaire, lecture ne lisent pas les prix ; technicien n'écrit pas | en partie |
| | Numérotation : secrétaire obtient un numéro de devis ; lecture non ; personne n'obtient un numéro de facture à la demande | en partie (20260925020000) |
| `numerotation.essai.ts` | Un admin d'une autre société, un client : aucun numéro d'ALPHA | **oui** (20260925015000) — **échoue contre la production actuelle** |
| `lignes.essai.ts` | Synchronisation des lignes : nouvelles écrites, gardées modifiées, retirées supprimées, lecture refusée | non |
| `articles.essai.ts` | Terrain sans accès au catalogue, conducteur lit sans écrire, secrétaire écrit, BETA invisible | non |
| `espace-client.essai.ts` | Le client ne voit que SON client, SES chantiers, ses devis envoyés (pas les brouillons), ses factures émises ; rien de BETA ni d'interne ; n'écrit rien ; n'est membre de rien ; les membres ne voient pas plus qu'avant | **oui** (20260925030000) |
| `commandes.essai.ts` | Vues terrain sans prix, isolement, droits d'écriture, circuit par RPC, facture née du bon, pièces | non |
| `chantiers.essai.ts` | Statut / notes / PPSPS, compte-rendu « non lu », métier d'une ligne de DPGF ; to-do du technicien sur SON chantier seulement ; lecture ne supprime ni to-do ni document ; achats et affectations sous « chantiers / modifier » (l'affectation ouvre et ferme la vue du chantier au terrain) ; bucket `terrain` (dépôt, URL signée, BETA refusée, lecture ne dépose pas) ; bon + tâche liée à la ligne de DPGF | **oui** (20260926020000, 20260926021000) pour les cas marqués |
| `chantiers-api.essai.ts` | Les fonctions `chantiers/api/*` elles-mêmes (client remplacé par un compte connecté) : chaque lecture passe son schéma Zod ; import de DPGF, planification d'une part, dépôt et retrait d'un compte-rendu (fichier compris) ; le technicien lit la fiche mais reçoit un DPGF et des achats vides | oui (colonnes proposées) |
| | Un bon inséré « chiffré » naît `en_cours` ; les lignes d'un bon à facture émise sont figées (brouillon : non) | **oui** (20260925050000, 20260925060000) |
| `comptes.essai.ts` | Compte jetable (inscription) : l'admin change un rôle, un non-admin non (zéro ligne) ; l'admin ne se retire pas son propre rôle (42501) ; accès désactivé = société invisible, réactivé = rendue ; invitation appliquée à l'inscription (membre, rôle, « acceptée ») ; une invitation par adresse et société (casse comprise) ; seul l'admin invite ; chacun renomme son profil, pas celui d'un autre | non |
| | Un compte ne modifie ni son `actif` ni son adresse | **oui** (20260926010000) |
| `reglages.essai.ts` | `societes` : admin seul (secrétaire et conducteur : zéro ligne), pas BETA ; `societe_settings` et `compteurs` suivent `reglages/modifier` ; documents légaux : pièce déposée sous `<societe>/…`, illisible et invisible pour BETA, refusée au rôle lecture ; listes et fournisseurs : admin oui, secrétaire non | non |
| `circuit.essai.ts` | Tâches par métier, déclarées faites, arbitrées, refus motivé, validée non rouverte ; le technicien sans équipe refusé avec le motif de la base ; la secrétaire n'arbitre pas | non |
| | Validation conducteur refusée (métier sans tâche, tâche non pointée), puis acceptée | non |
| | Travaux supplémentaires : ajout « à chiffrer » (TVA 10), chiffrage prix + quantité + unité ; secrétaire refusée ; terrain sans prix | non |
| | Pré-facture dans le circuit (le travail rejoint le chapitre de son métier, « intégré », chiffré ; conducteur refusé ; `bc_chiffrage_valide` refuse un travail à chiffrer) et hors circuit (journal, travaux intégrés) | non |
| | Clôture gratuite (admin seul, travaux « refusé », motif au journal) ; SAV (`SAV-AAAA-NNNNNN`, en-tête recopié, photo au bucket ; secrétaire refusée) | non |
| | Pièce jointe au bucket `terrain` (`<société>/bons-commande/<bon>/…`), URL signée lisible, refusée à la secrétaire et à BETA, retrait | non |
| | Contacts (secrétaire oui, lecture non) ; métiers déclarés (BETA ne voit pas ceux d'ALPHA) | non |
| | Un bon créé reçoit un numéro « BC- » sans ligne de compteur de l'année | **oui** (20260926030000) |
| `facturation.essai.ts` | `v_facture_solde` : avoir jamais dû, facture à 0 € réglée, acomptes et retenue (la retenue non levée n'est pas un retard), reprise historique, accord avec `etatPiece` | oui (20260926040000) |
| | Statut stocké recalé par le déclencheur ; règlement groupé : imputation = `imputer` de l'ancien, trop-perçu refusé avec son message, un avoir dans la sélection fait tout refuser, le rôle lecture n'écrit rien | oui (20260926041000) |
| | `imputer_avoir` : deux règlements liés, refus dans l'ordre et avec les mots de `refusImputationAvoir` ; note de frais « NDF- » | oui (20260926041000, 20260926043000) |
| `espace-client-bons.essai.ts` | Le client suit ses bons (jamais ceux d'un autre client ni de BETA), aucune colonne interne dans la vue ; lit les règlements et le solde de SES factures, n'écrit aucun règlement ; accès nominatif restreint à l'interlocuteur, qu'il ne peut pas élargir lui-même | oui (20260926042000) |
| `planning.essai.ts` | Le conducteur pose une carte (rendez-vous sur le bon, tâche avec équipe et créneau) et ajoute une journée ; le technicien lit sans aucun montant, connaît son équipe, ne planifie pas ; BETA ne voit rien | non |
| | Circuit : l'équipe consigne puis déclare faite ; l'état ne s'écrit pas en direct ; une autre équipe est refusée en toutes lettres ; refus sans motif refusé, avec motif renvoyé | non |
| | Sous-traitant : pointe ses tâches et pas celles d'un confrère, lit SON montant seul, signale un travail sur SON bon ; photos déposées et lues par le terrain, pas effacées par le rôle lecture ; téléphone de l'occupant | **oui** (20260926050000, 051000, 053000) |
| `interventions.essai.ts` | Rapport du technicien : numéro INT par la base, contrôles, photo et signatures ; vacant : pas de signature client ; le sous-traitant rédige au nom de son entreprise et ne voit que ses rapports ; lecture ne supprime rien ; un rapport par bon | **oui** (20260926052000) |

## Scénarios à exécuter plus tard (non automatisés cette nuit)

- Bons de commande : le terrain lit `v_bons_commande_terrain` sans montant ;
  `statut_workflow` ne change que par RPC ; un bon facturé est figé.
- Facture émise : ni l'admin ni la secrétaire ne modifient une ligne ou
  l'en-tête hors liste blanche (déclencheurs) ; une facture numérotée ne se
  supprime pas.
- Règlements : le conducteur (`reglements` absent de sa matrice) ne lit ni
  n'écrit aucun règlement.
- Tables filles restantes : pour chacune des 20 tables dont la suppression
  est `est_membre()` (véhicules, matériel, documents de chantier, photos…),
  vérifier que `lecture` ne supprime rien — échoue aujourd'hui (les filles du chantier : `chantiers.essai.ts`).
- Storage (bucket `terrain`) : un compte d'ALPHA ne lit pas `beta/…` (l'inverse est couvert par `circuit.essai.ts`).
- Edge Functions PDP : elles vérifient l'appartenance mais pas le rôle — un
  compte `lecture` pourrait déclencher une émission.
