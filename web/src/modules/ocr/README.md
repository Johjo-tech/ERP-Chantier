# ocr

**Rôle** : lire un bon de commande reçu (PDF, photo) pour préremplir sa saisie.

- **Edge Function** : `extraire-bc` (dépôt historique, `supabase/functions/`) —
  OCR Mistral puis extraction JSON stricte, côté serveur ; secret
  `MISTRAL_API_KEY` (jamais côté navigateur). Appelée seulement depuis
  `api/extraire.ts`, avec un délai de 120 s et une annulation. Elle ne vérifie
  ni l'utilisateur ni la société (OCR-40, D-BC-15) : la page exige
  `bons_commande/creer` ET la fonctionnalité `ocr`.
- **Préparation** (`api/preparer.ts`, partagée avec la pièce jointe du bon) :
  image hors format (HEIC) ou > 3 Mo → JPEG 0,85, 2 200 px ; PDF > 14 Mo refusé.
- **Contrat** (`domain/contrat.ts`) : réponse validée par Zod ; un champ hors
  contrat est vidé et nommé (« Lecture partiellement incertaine », D-BC-12).
- **Écran** (`PageLectureBon`) : étapes (préparation, envoi, lecture par le
  modèle, bascule à 2 s), chronomètre, durée annoncée, « Annuler la lecture » ;
  trois issues (annulée, délai, échec) avec « Réessayer » et « Saisir à la main ».
- **Règles** : `adresse` lue = LIEU D'INTERVENTION ; essentiels signalés sans
  bloquer ; client rapproché du fichier clients (exact, inclusion, mots-clés
  ≥ 0,8), choisi par son IDENTIFIANT. Parité : `tests/parite/ocr.essai.ts`
  (fonctions EXTRAITES de `integrations/ocr.ts`, `regles-ocr` importé).
- **Préremplissage** : `navigate("/commandes/nouveau", { state: { prefill, fichier } })`
  — tout ce que `versSaisieBonCommande` transmettait (« Sans BC », date du jour,
  logement, facturation, TVA des lignes, montant) et le document lu, retenu
  comme pièce jointe du bon.
- **En local** : sans clé Mistral la fonction ne lit rien ; le parcours e2e
  simule sa réponse au niveau réseau.
