# clients

**Rôle** : fiches clients (particuliers, entreprises, administrations,
étrangers), leurs interlocuteurs, délai et mode de paiement.

- **Tables** : `clients`, `interlocuteurs` (société déduite par `clients`).
- **Droits** : module `clients` de la matrice (voir / créer / modifier / supprimer).
- **Règles** (`domain/`) : identifiants SIREN/SIRET/TVA — le MAL FORMÉ bloque,
  le MANQUANT jamais ; délai de paiement client > société > 30 j net, `0` =
  à réception ; B2C → « à réception » proposé au changement de type seulement ;
  dépassement L441-10 signalé, jamais bloqué. Parité : `tests/parite/identifiants.essai.ts`.
- **Annuaire des entreprises** (recherche-entreprises.api.gouv.fr, sans clé) :
  suggestions sous le nom, « Rechercher » à côté du SIRET/SIREN ; l'identité
  s'écrase, TVA et adresse électronique ne remplissent que le vide ; entreprise
  radiée → avertissement ; « administration » seulement proposé ; rien pour un
  particulier (CLI-40). File d'appels sous le quota (6/s, 3 en vol, 429 dit).
  Parité : `tests/parite/annuaire.essai.ts`.
- **Adresse** : Base Adresse Nationale sous le champ, code postal → communes.
- **Rattachement** (`domain/rattachement.ts`) : `identiteClientDocument` —
  l'identité de l'acheteur recopiée sur la facture à l'écriture (CLI-26) ;
  `listerClientsRapprochables` — la lecture légère de l'OCR et des imports (CLI-32).
- **Listes** complètes ou refusées (`lib/lecture.ts`, TRV-10).
