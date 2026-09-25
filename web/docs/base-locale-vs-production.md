# Base d'essai locale et production

## Ce qui a été vérifié (25/09/2026)

La production n'est jamais lue par `web/` ni par ses scripts. Un humain a exporté
sa **structure** (sans aucune donnée), en lecture seule, depuis un poste lié :

```bash
supabase link --project-ref tjhljjuvfosmnpmzgbnl
supabase db dump --linked -f ~/schema-prod.sql
supabase unlink
```

`scripts/comparer-a-la-production.sh ~/schema-prod.sql` charge cet export dans une
base temporaire du conteneur local, reconstruit à côté la base d'essai **sans les
propositions** (migrations du dépôt + `supabase/rattrapage/`), et compare
(`scripts/releve-structure.sql`) : chaque colonne (type, NULL, défaut), l'ordre des
colonnes des vues, le corps des 96 fonctions (commentaires et blancs ignorés), les
261 politiques RLS, les 8 vues, les 78 déclencheurs, la RLS activée par table, les
droits d'`anon` / `authenticated` sur tables, vues et fonctions.

**Résultat : identique.** Trois écarts réels avaient été trouvés puis alignés par
`supabase/rattrapage/02_alignement_production.sql` :

1. `bons_commande.tentatives_contact` : NOT NULL, défaut `[]` en production ;
2. `voit_les_prix(uuid)` : non exécutable par `PUBLIC` / `anon` en production ;
3. `v_bons_commande_terrain` : mêmes colonnes mais pas dans le même ordre — refaite
   avec le texte exact exporté de la production (écriture révoquée comprise).

Écart connu et sans effet : le RANG des colonnes de la table `bons_commande`
(les colonnes ajoutées par une migration qui ne se rejoue pas arrivent en fin).
PostgREST adresse les colonnes par leur nom.

## Ce qui n'est PAS couvert par l'export

- Les politiques du **stockage** (`storage.objects`) et les déclencheurs posés sur
  `auth.users` : `supabase db dump` ne les exporte pas par défaut. Pour les
  comparer : `supabase db dump --linked --schema storage -f ~/storage-prod.sql`.
- Les **données** : la base d'essai n'a que le jeu fictif `supabase/seed-web.sql`.

## Deux bases d'essai, deux usages

| Base | Contenu | Sert à |
|---|---|---|
| **sans propositions** (`reconstruite`, ou `npm run base:locale` sans le dossier `propositions/`) | identique à la production | référence : l'ancienne app s'y comporte comme en production ; mesurer ce que `web/` sait faire AVANT toute migration |
| **avec propositions** (`npm run base:locale`, défaut) | production + 35 migrations proposées | faire tourner `web/` complet, et les tests RLS `[proposition]` |

Tant que les propositions ne sont pas appliquées en production, `web/` doit être
jugée sur la première.
