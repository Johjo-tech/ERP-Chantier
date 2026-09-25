# vehicules

**Rôle** : le parc de véhicules (INVENTAIRE §13, VEH-01 à VEH-04, VEH-20, VEH-21) —
liste En service / Vendus / Tous, fiche, pièces et photos, télépéage et carte
carburant, échéances, prêts avec schéma d'état, entretiens, vente.

- **Tables** : `vehicules`, `vehicule_prets`, `vehicule_entretiens`,
  `vehicule_documents` ; fichiers dans le seau privé `terrain`, sous
  `<société>/vehicules/<véhicule>/…`. Annuaire des salariés et états de prêt :
  ceux du module `materiel`. Vente : `facturation/api` (`creerFacture`,
  `emettreFacture`, `conditions`).
- **Droits** : module `vehicules` de la matrice (admin et secrétaire : tout ;
  conducteur : voir, modifier ; technicien et lecture : voir). Prêts, entretiens
  et documents suivent « véhicules / modifier » (proposition
  `20260926070000`, D-VEH-01). Vendre exige aussi « factures / créer ».
  Montants (entretiens, prix de vente) masqués à qui ne voit pas les prix.
- **Règles** (`domain/`) : libellé = plaque · marque modèle (ou surnom) ;
  plaque obligatoire, en capitales, unique par société (index en base, message
  en clair) ; compteur qui ne fait que monter (condition posée en base) ; prêt
  en cours tant qu'il n'a pas de retour réel, retour prévu = début + durée ;
  échéances CT / cartes / documents selon les seuils des Réglages (D-VEH-04) ;
  désignation de la ligne de vente mot pour mot celle de l'ancien écran.
  Parité : `tests/parite/vehicules.essai.ts`.
- **Écarts voulus** : date de CT dans `date_controle_technique` (VEH-21) ;
  validité de la carte carburant = une date, jamais un code PIN (D-VEH-05) ;
  vente à une fiche client, facture émise par la base (D-VEH-06) ; marques du
  schéma posables au clavier (zones nommées).
- **Non repris** : contrôles périodiques, cartes carburant multiples et
  consommations (tables sans écran dans l'ancienne app) ; sinistres et amendes
  (l'ancienne app ne les gère pas) — D-VEH-07.
