# chantiers

**Rôle** : les chantiers et tout ce que leur fiche porte — statut, PPSPS,
comptes-rendus, pièces du marché, sécurité, DPGF chiffré et son suivi,
planification de parts en bons de commande, to-do, achats, intervenants,
devis complémentaires, factures, chiffres du chantier.

## Écrans

Au HTML de l'ancien écran (`renderChantiers`, `renderChantierDetail`), comparé par
`tests/visuel/ecrans-chantiers.ts` (D-ECR-CHA-01 à 12).

- `PageChantiers` : cartes A4 filtrables (recherche, conducteur, type), formulaire
  `FormulaireChantier` ouvert en place (`/chantiers/nouveau` y arrive ouvert).
- `PageFicheChantier` : « ← Retour aux chantiers », bandeau sombre, puis les
  sections empilées de l'ancien : comptes-rendus, informations diverses + sécurité
  (inspections, PPSPS Word, DOE), pièces du marché, to-do (kanban, ← → au
  clavier), devis complémentaires, factures, achats, DPGF chiffré (import,
  « + Ligne », « Enregistrer les lignes », « Facturer la sélection », « 📅
  Planifier »), puis Intervenants (web/ seulement). « Modifier les infos » remplace
  le bandeau par le formulaire (`/chantiers/:id/modifier`).

## Tables, vues, stockage

`chantiers` · `chantier_dpgf_lignes` · `chantier_documents` (familles dpgf, cctp,
ccap, avenant, dgd, ppsps, doe) · `chantier_comptes_rendus` · `chantier_inspections`
· `chantier_todos` · `chantier_achats` · `chantier_devis_complementaires` ·
`chantier_affectations` · `planning_taches` (parts planifiées du DPGF) ·
`bons_commande` (créés par « Planifier ») · lectures : `v_chantier_avancement`,
`v_facture_totaux`, `v_salaries_annuaire`, `referentiels` (`categorie_achat`),
`metiers`, `membres_societe`. Fichiers : bucket privé `terrain`,
`<société>/chantiers/<chantier>/…`, URL signée.

Colonnes et politiques PROPOSÉES (base locale seulement) :
`supabase/propositions/20260926020000_*` (statut, notes, PPSPS, `vu`, `metier`) et
`20260926021000_*` (écriture des filles alignée sur la matrice). Types :
`src/lib/database.propositions.ts`, client `supabasePropositions()`.

## Droits (miroirs — la RLS tranche)

`hooks/useDroitsChantier.ts` : DPGF, achats, devis reçus, affectations =
« chantiers / modifier » + voir les prix ; to-do, documents, inspections =
`peut_ecrire()` (technicien compris, `domain/droits.ts`) ; comptes-rendus =
matrice « rapports ». Le terrain ne voit que ses chantiers affectés.

## Règles (domaine pur, testées)

- `dpgf.ts` : totaux et % facturé (RM-60), lignes figées (facturées ou planifiées).
- `planification.ts` : reste, plafond, montant, libellé « (q/total) » (CHA-21).
- `import-dpgf.ts` : port à comportement identique de l'import de l'ancien écran.
- `achats.ts` : catégories du référentiel (code stocké), totaux et parts,
  main-d'œuvre heures × coût horaire.
- `todo.ts`, `devis-vers-dpgf.ts`, `fichiers.ts` (8 Mo, chemin), `ppsps.ts`,
  `statistiques.ts`, `liens.ts`.
- `fichiers/` (hors domaine : I/O navigateur) : ZIP, lecture .xlsx, écriture .docx.

## Composition

Les devis du chantier (`DevisLies`, avec `lienNouveau` prérempli) et « Facturer
l'avancement / la sélection » (module facturation) sont branchés dans
`app/routes.tsx` par `complements`, `actionsDpgf`, `actionsSelection` — un module
n'importe pas les composants d'un autre.

## Tests

`domain/regles.essai.ts`, `domain/dpgf.essai.ts`, `fichiers/fichiers.essai.ts`,
`components/fiche.essai.tsx` (rôles, DPGF, to-do, achats),
`tests/parite/chantiers.essai.ts` (contre app.js extrait),
`tests/rls/chantiers.essai.ts`, `tests/rls/chantiers-api.essai.ts`.

## Non repris / écarts

Voir `docs/DECISIONS.md` D-CHA-01 à D-CHA-14 : pas de suppression de chantier
(D-016), pas d'envoi de facture depuis la fiche, planning ouvert via le bon,
.xls refusé, PPSPS sans logo.
