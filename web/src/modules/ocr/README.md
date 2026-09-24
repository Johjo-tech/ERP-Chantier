# ocr

**Rôle** : lire un bon de commande reçu (PDF, photo) pour préremplir sa saisie.

- **Edge Function** : `extraire-bc` (dépôt historique, `supabase/functions/`) —
  OCR Mistral puis extraction JSON stricte, côté serveur ; secret
  `MISTRAL_API_KEY` (jamais côté navigateur). Appelée seulement depuis
  `api/extraire.ts`, avec un délai de 120 s et une annulation.
- **Contrat** (`domain/contrat.ts`) : la réponse est validée par Zod ; une date
  mal formée, un statut de logement inventé ou une forme inattendue ne passent
  pas dans le formulaire.
- **Règles** : `adresse` lue = LIEU D'INTERVENTION (jamais le siège du client) ;
  essentiels signalés (numéro, adresse, une ligne de travaux) sans bloquer ;
  client rapproché du fichier clients (exact, inclusion, mots-clés ≥ 0,8), sinon
  des suggestions — on ne choisit pas à la place de l'utilisateur. Parité :
  `tests/parite/ocr.essai.ts`.
- **Préremplissage** : `navigate("/commandes/nouveau", { state: { prefill } })`,
  lu par le formulaire du module `commandes`.
- **Non repris** : conversion HEIC → JPEG dans le navigateur (le fichier est
  refusé avec un message), bascule de modèle affichée, factures fournisseurs.
- **En local** : sans clé Mistral la fonction ne lit rien ; le parcours e2e
  simule sa réponse au niveau réseau.
