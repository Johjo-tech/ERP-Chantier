# Diagnostic — Gemini contre Mistral

Ce dossier ne construit rien : il **mesure**, pour trancher avant d'intégrer.
Le préfixe `_` l'écarte de `supabase functions deploy`, comme `_shared`.

## Ce qu'il compare

Sur chaque PDF, trois extractions, le même contrat en sortie, `temperature: 0` :

1. **Gemini** — le pipeline actuel tel quel : le PDF part au modèle, cascade
   `3.7-flash` → `3.8` → `3.6`, `response_schema` strict.
2. **Mistral OCR → `mistral-medium-latest`**
3. **Mistral OCR → `mistral-small-latest`**

L'appel OCR n'est fait **qu'une fois** par document et sert aux deux modèles,
mais il est compté dans la durée et le coût de chacun : c'est le prix d'un bon
lu de bout en bout.

## Préparer

```bash
# La clé, dans un fichier ignoré par git
printf 'MISTRAL_API_KEY=…\nGEMINI_API_KEY=…\n' > supabase/functions/.env

# Les bons d'essai, ignorés eux aussi
cp mes-bons/*.pdf supabase/functions/_diagnostic/samples/
```

`GEMINI_API_KEY` est facultative : sans elle, la colonne Gemini reste vide et
la comparaison se limite aux deux modèles Mistral.

## Lancer

Deno n'a pas besoin d'être installé : le script tourne dans l'image officielle.

```bash
docker run --rm -v "$PWD:/w" -w /w --env-file supabase/functions/.env \
  denoland/deno:alpine-2.1.4 run \
  --allow-net --allow-read --allow-write --allow-env \
  supabase/functions/_diagnostic/diagnostic.ts
```

## Ce qu'on obtient

Un tableau par document, champ par champ, avec la valeur de chaque fournisseur.
Le marquage en tête de ligne :

| | |
|---|---|
| `≠` | au moins deux ont répondu et ne disent pas la même chose |
| `=` | au moins deux ont répondu et s'accordent |
| `·` | **un seul a trouvé le champ** — c'est là que se juge l'écart |
| ` ` | aucun n'a trouvé |

Une case vide n'est jamais un désaccord : c'est une absence de réponse, et elle
n'entre pas dans la comparaison. Puis, par colonne : champs remplis, nombre de lignes et de chapitres,
avertissements, durée, jetons, coût.

Le détail part dans `resultats/`, ignoré par git.

## Deux choix à connaître

**Les noms de personnes ne sortent pas d'ici.** `occupant` et `interlocuteur`
sont masqués partout où le diagnostic écrit — fichiers comme rapport — et seule
leur *présence* reste visible. Savoir qu'un fournisseur a trouvé l'occupant et
l'autre non ne demande pas de lire le nom. Le Markdown de l'OCR n'est pas écrit
sur disque du tout : c'est le document lui-même.

**Les coûts ne sont pas estimés par défaut.** `TARIFS` est à `null` : annoncer
un prix sur des tarifs que je n'ai pas vérifiés vaudrait moins que de n'en
annoncer aucun. Renseignez-les en tête de `diagnostic.ts` et la colonne se
remplit. Les jetons et les pages, eux, sont mesurés et toujours affichés.
