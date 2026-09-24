# clients

**Rôle** : fiches clients (particuliers, entreprises, administrations,
étrangers), leurs interlocuteurs, délai et mode de paiement.

- **Tables** : `clients`, `interlocuteurs` (société déduite par `clients`).
- **Droits** : module `clients` de la matrice (voir / créer / modifier / supprimer).
- **Règles** (`domain/`) : identifiants SIREN/SIRET/TVA — le MAL FORMÉ bloque,
  le MANQUANT jamais ; délai de paiement client > société > 30 j net, `0` =
  à réception ; B2C → « à réception » proposé au changement de type seulement ;
  dépassement L441-10 signalé, jamais bloqué. Parité : `tests/parite/identifiants.essai.ts`.
- **Non repris cette nuit** : annuaire des entreprises, autocomplétion d'adresse
  (BAN), import CSV de clients, complétude facture électronique.
