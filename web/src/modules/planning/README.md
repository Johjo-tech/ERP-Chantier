# planning

**Rôle** : le planning des interventions (section 11 de l'inventaire, PLN-01 à
PLN-54) — calendrier de six semaines par équipe ou par sous-traitant, colonne
« Non planifiés », vues « En attente », fiche d'intervention (circuit de la
tâche, constats, pièce, croquis, photos, contacts, travaux supplémentaires),
écran terrain « Ma journée », impression paysage.

- **Deux sources, comme l'écran historique qui partage encore la base** :
  - le RENDEZ-VOUS vit sur le bon — colonnes `date_planifiee`,
    `date_planifiee_fin`, `heure_planifiee`, `duree_heures`,
    `heure_dernier_jour`, `duree_dernier_jour`, `technicien` pour un bon
    mono-métier ; `schedule_par_metier[métier]` (clés camelCase de l'ancien
    écran, les autres clés conservées) pour un bon multi-métiers ;
  - les JOURNÉES réelles vivent dans `planning_taches` (une tâche par
    bon × métier × jour, avec équipe `technicien_id` ou `sous_traitant_id`,
    plage `heure_debut`/`heure_fin`). Les journées supplémentaires n'ont pas
    de colonne : elles se DÉRIVENT des tâches.
- **Lecture** : bons par la vue `v_bons_commande_terrain` (prix masqués au
  terrain), lignes par `v_bon_commande_lignes_terrain` **sans colonne de prix**
  (même pour qui les verrait), travaux supplémentaires par
  `v_travaux_supplementaires_terrain`, équipe du compte par
  `v_salaries_annuaire` (compte → salarié → équipe).
- **Écriture** : tout geste de planification est calculé par le domaine
  (`domain/planification.ts` : un `Plan` = colonnes du bon + opérations sur
  les tâches, ou un `RefusPlanning` rédigé), puis appliqué par
  `api/planning.ts#appliquerPlan` (le bon d'abord, puis les tâches). Les
  transitions d'état passent UNIQUEMENT par les RPC `tache_sauvegarder_terrain`,
  `tache_marquer_realisee`, `tache_valider` (`circuit_etat_reserve` interdit
  l'écriture directe). Tout geste recharge le planning ET les bons (le circuit
  d'un bon se dérive de ses tâches).
- **Droits** (matrice) : voir = tous ; planifier (poser, déplacer, régler,
  journées, affectation) = `planning/modifier` ET `bons_commande/modifier`
  (admin, conducteur) ; contacts et rappel = `bons_commande/modifier` ;
  constats / « Travaux terminés » = le terrain de l'équipe (et l'encadrement),
  selon `actionsTache` + `appartenanceDe` ; Valider / Refuser = admin,
  conducteur. Le technicien a « Ma journée » et la vue technicien sans colonne
  « Non planifiés » ni glisser-déposer ; le sous-traitant « Ma journée » et
  « Mon planning » (ses cartes seules) avec « Votre montant ». **Aucun prix**
  pour le terrain.
- **Règles** (parité `tests/parite/planning.essai.ts`) : `regles-taches.ts`
  (circuit, créneau 08:00 / 1 h, 1-8 h, modifiable si planifiée|refusée),
  `regles-metiers.ts` (`metierDeLaLigne` pour les travaux d'une carte —
  CLAUDE.md racine), fériés (Pâques), `calculerSpanRows`, `bcInterventionFaite`.
- **Propositions** (base locale seulement, `supabase/propositions/2026092605*`) :
  le sous-traitant pointe ses tâches et voit SON montant ; photos du terrain
  lisibles et déposables par le terrain ; téléphone de l'occupant. Sans elles,
  l'écran fonctionne (les fonctions absentes sont ignorées avec un
  avertissement) mais le sous-traitant se voit refuser ses gestes par la base.
- **Non repris** : génération IA des rapports (PLN-51, D-PLN-11), noms des
  auteurs dans l'historique d'une tâche (profils illisibles aux membres),
  aperçu de la pièce jointe du bon depuis la carte (lien vers le bon).

**Essayer en local** : le jeu d'essai ne crée ni équipe ni sous-traitant (les tests RLS
créent et retirent les leurs). Pour voir « Ma journée » du technicien :
`insert into techniciens (societe_id, nom, metiers) values ('a0000000-0000-0000-0000-00000000000a', 'Équipe Thomas', '{}');`
puis un salarié `profile_id = 'a1000000-0000-0000-0000-000000000004'` rattaché à cette équipe,
et poser une carte au planning avec le compte conducteur.
