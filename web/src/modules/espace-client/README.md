# espace-client

**Rôle** : accès d'un CLIENT, en lecture seule, à ses chantiers, ses devis
envoyés et ses factures émises (aperçu imprimable).

- **Dépend de la migration PROPOSÉE** `20260925030000_espace_client_en_lecture`
  (table `acces_clients`, fonction `mes_clients()`, politiques de lecture). Sans
  elle, la session ne trouve aucun accès client et l'espace ne s'ouvre pas —
  sans erreur (DECISIONS D-008, D-018).
- **Pourquoi pas un rôle de membre** : un membre passe `est_membre()` et lirait
  presque tout. Le client n'est membre de rien ; il n'a aucune politique
  d'écriture.
- **Règles** : brouillons de devis et factures non émises invisibles ; totaux lus
  dans les vues `security_invoker` ; aucune navigation de gestion.
- **Tests** : `tests/rls/espace-client.essai.ts` (ce qu'il voit, ce qu'il ne voit
  pas, qu'il n'écrit rien, que les membres ne voient pas plus) et parcours e2e.
- **Non repris** : état de règlement (le client ne lit pas les règlements), bons
  de commande (vue terrain réservée aux membres), gestion des accès par l'admin.
