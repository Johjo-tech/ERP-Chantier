# Schéma Supabase

La source de vérité est **`src/api/database.types.ts`**, généré depuis Postgres.
`src/api/types.ts` ne fait que l'aliaser : aucune définition de colonne n'est
écrite à la main.

## Régénérer

```bash
npm run db:types
```

soit `npx supabase gen types typescript --linked > src/api/database.types.ts`.
Une colonne ajoutée en base apparaît alors dans les types sans intervention ;
une colonne supprimée casse la compilation au lieu de casser à l'exécution.

Le projet lié est `tjhljjuvfosmnpmzgbnl` (organisation `necddsfceymhsdmkwqrz`).
La commande passe par l'API Management et ne demande pas le mot de passe de la
base.

## Forme générale

- 77 tables, 4 vues de calcul, 10 fonctions, 13 énumérations.
- Clés primaires en `uuid`, générées par la base — ne pas en fabriquer côté client.
- Horodatage : `cree_le` et `maj_le` (et non `created_at` / `updated_at`).
- RLS active partout : toute lecture comme toute écriture exige une session.

### Deux colonnes qui portent la bascule depuis `kv_store`

- **`client_nom`** : les documents portent le nom du client en clair, en plus de
  la clé étrangère `client_id` (facultative). L'app historique ne connaît que le
  nom : la traduction est directe.
- **`legacy_id`** : conserve l'identifiant base36 d'origine. Les références
  croisées de l'app (`devisId`, `bonCommandeId`…) restent donc valides sans
  réécriture, et une reprise de données est idempotente.

### Vues de calcul

Les totaux ne sont pas recomposés côté client :

| Vue | Donne |
|---|---|
| `v_devis_totaux` | `ht`, `tva`, `ttc`, avant et après remise |
| `v_facture_totaux` | idem pour les factures |
| `v_facture_solde` | `paye`, `reste`, `jours_retard`, `etat` |
| `v_chantier_avancement` | `montant_total`, `montant_facture`, `reste_a_facturer` |

### Fonctions

`prochain_numero(p_annee, p_societe, p_type)` numérote atomiquement — le
compteur est porté par le triplet (société, type, année) dans `compteurs`.
`mes_societes()` et `mon_role()` servent au cloisonnement.

### Tables `zz_obsolete_*`

Vestiges d'une modélisation antérieure (`zz_obsolete_devis`,
`zz_obsolete_clients`, …). Ne pas y écrire.

## Note de méthode

Une première version de ce document décrivait un schéma relevé par sondage
PostgREST à l'aveugle, faute d'accès au projet. Ce relevé n'avait trouvé que 34
tables sur 77 — on ne peut sonder que les noms que l'on devine — et concluait à
tort à l'absence de rattachement SAV, de suivi de contrôle technique, de table de
réglages ou de lignes DPGF. Ces tables existent
(`bons_commande.bon_commande_parent_id`, `vehicule_controles_periodiques`,
`societe_settings`, `chantier_dpgf_lignes`). D'où la règle : ne décrire le schéma
qu'à partir des types générés.
