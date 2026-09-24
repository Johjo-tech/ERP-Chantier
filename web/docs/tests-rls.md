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
  vérifier que `lecture` ne supprime rien — échoue aujourd'hui.
- Storage (bucket `terrain`) : un compte d'ALPHA ne lit pas `beta/…`.
- Edge Functions PDP : elles vérifient l'appartenance mais pas le rôle — un
  compte `lecture` pourrait déclencher une émission.
