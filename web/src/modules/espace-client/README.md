# espace-client

**Rôle** : accès d'un CLIENT, en lecture seule, à ses chantiers, ses devis
envoyés, ses factures émises (avec ce qu'il en doit encore) et le suivi de ses
bons de commande ; pièces imprimables et téléchargeables en PDF.

- **Dépend des migrations PROPOSÉES** `20260925030000_espace_client_en_lecture`
  et `20260926042000_espace_client_bons_et_reglements` (accès nominatif par
  interlocuteur, vue `v_espace_client_bons`, lecture des règlements de ses
  factures, identité légale de l'émetteur). Sans elles, la session ne trouve
  aucun accès client et l'espace ne s'ouvre pas (D-008, D-018, D-FAC-10).
- **Pourquoi pas un rôle de membre** : un membre passe `est_membre()` et lirait
  presque tout. Le client n'est membre de rien ; il n'a aucune politique
  d'écriture.
- **Règles** : brouillons invisibles ; solde lu dans `v_facture_solde` (un
  avoir n'y est jamais « dû ») ; bons colorés rouge / jaune / orange / vert et
  triés dans cet ordre, recherche limitée aux 13 champs de l'ancien portail
  (parité `tests/parite/espace-client.essai.ts`) ; aucune navigation de gestion.
- **Tests** : `tests/rls/espace-client.essai.ts`, `espace-client-bons.essai.ts`,
  `components/bons-client.essai.tsx`, parcours e2e.
- **Gestion des accès** : Réglages › Accès clients (`SectionAccesClients`,
  administrateur seul) — ouvrir par l'adresse du compte, restreindre à un
  interlocuteur, fermer / rouvrir / retirer. Proposition `20260926106000`
  (`acces_clients_de_la_societe`, `ouvrir_acces_client`), D-TRV-08. La
  création du compte du client n'est pas couverte (clé de service).
- **Non repris** : date de validité des devis (réglage non lisible par le client).
