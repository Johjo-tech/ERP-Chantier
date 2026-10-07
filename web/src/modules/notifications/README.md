# notifications

**Rôle** : la cloche de l'en-tête (TRV-09, `computeNotifications` de l'ancien
écran) — ce qui arrive à échéance dans toute la société, en un seul endroit.

- **Familles** (dans l'ordre de l'ancien écran) : véhicules (cartes, contrôle
  technique, documents), salariés (carte BTP, visite médicale, habilitations),
  documents légaux, dossier RH, bons en retard, documents de sous-traitant,
  rappels de locataire. Les urgentes (échues) passent devant.
- **Tables** : `notifications_traitees` (proposition 20260926120000) pour
  « fait », par société. Le reste est lu par les API des modules concernés,
  sous LEURS clés de cache : une écriture dans ces écrans rafraîchit la cloche.
- **Droits** : une famille n'est lue que si le rôle ouvre l'écran où elle se
  traite (`vehicules`, `rh`, `rh / modifier` pour le dossier, `reglages`,
  `bons_commande`). « Fait » : tout membre ; « remettre à faire » : `peut_ecrire`.
- **Seuils** : Réglages › RH et Véhicules (`seuils`), défauts de l'ancien écran.
- **Parité** : `tests/parite/notifications.essai.ts` (source d'`app.js` évaluée).
  Écarts (D-CLI-06) : libellé des véhicules, habilitation annoncée une fois,
  bons dont les travaux sont finis écartés, seuils des réglages partout.
- **Chargement tolérant** : une famille illisible est nommée dans le panneau,
  les autres s'affichent.
