# devis

**Rôle** : devis — liste, édition (en-tête, lieu d'intervention, lignes multi-TVA,
remise), duplication, aperçu imprimable.

- **Tables / vues / RPC** : `devis`, `devis_lignes`, vue `v_devis_totaux`
  (totaux de la liste, calculés par la base), RPC `prochain_numero(societe, 'devis')`.
- **Droits** : module `devis` ; technicien et sous-traitant n'y ont aucun accès
  (ni en base, ni à l'écran).
- **Règles** : numéro `DEV-AAAA-NNNNNN` attribué par la base à la PREMIÈRE écriture,
  brouillon compris ; statut brouillon / envoyé / accepté / refusé ; adresse du
  devis = siège du client, lieu d'intervention à part, nettoyé selon le logement ;
  conducteur écrit par son id seul (le libellé est tenu par un déclencheur) ;
  validité = date + N jours nets (réglage, 30 par défaut). Calculs : module
  `documents` (parité testée).
- **Enregistrement** : en-tête puis lignes ; si les lignes échouent après la
  création, l'écran rouvre le devis créé (jamais de doublon au nouvel essai).
- **Non repris cette nuit** : recherche d'article dans la ligne, e-mail,
  devis depuis un rapport d'intervention, filtres conducteur / logement.
