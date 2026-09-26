# devis

**Rôle** : devis — liste filtrée, édition (en-tête, lieu d'intervention, lignes
multi-TVA, remise), duplication, aperçu, PDF, e-mail, bon de commande et
facture depuis le devis, devis depuis un rapport d'intervention. Liste en
cartes et formulaire dans le panneau de l'ancien, à l'identique (D-ECR-FAC-08,
D-ECR-FAC-10) ; lignes, lieu et totaux par les composants partagés
`documents/components/LignesAncien`, `SectionLieuAncien`, `TotauxAncien`.

- **Tables / vues / RPC** : `devis`, `devis_lignes`, vue `v_devis_totaux`
  (totaux de la liste et montant du bon créé), RPC `prochain_numero(societe, 'devis')` ;
  écrit dans `bons_commande` (bon depuis le devis) et lit `interventions`.
- **Droits** : module `devis` ; « Créer un bon de commande » sous
  `bons_commande/creer` ; technicien et sous-traitant n'ont aucun accès aux
  devis (ni en base, ni à l'écran — DEV-18, D-FAC-14).
- **Règles** : numéro `DEV-AAAA-NNNNNN` à la PREMIÈRE écriture ; statut
  brouillon / envoyé / accepté / refusé ; adresse = siège du client, lieu à
  part, nettoyé selon le logement ; conducteur par son id, un ancien devis le
  retrouve par son nom (DEV-26) ; validité = date + N jours nets, imprimée avec
  sa durée ; taux de conversion du mois (DEV-28, calculé ici, affiché au tableau de bord comme l'ancien) ; filtres conducteur,
  logement, client, interlocuteur (`domain/liste.ts`) ; préconisations d'un
  rapport en lignes (`domain/preconisations.ts`, parité `tests/parite/devis.essai.ts`).
- **Pièces nées du devis** : bon « en attente de BC » au HT de la base, refusé
  si un bon porte déjà le devis. Le devis né d'un rapport passe par la voie
  unique du module interventions (`api/transformations.ts`, D-CLI-09), qui
  emprunte `domain/preconisations.ts` pour lire les préconisations.
