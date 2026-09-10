-- Hygiène des fonctions du schéma public.
--
-- Trois défauts relevés par l'analyseur Supabase, aucun exploitable
-- aujourd'hui — les gardes internes tiennent — mais tous du même genre :
-- une porte laissée ouverte derrière une porte fermée.

-- ---------------------------------------------------------------------------
-- 1. Aucune fonction SECURITY DEFINER ne répond à un anonyme
-- ---------------------------------------------------------------------------

-- En production, une seule était concernée : `bc_cloturer_gratuit`, qui avait
-- gardé le EXECUTE accordé à PUBLIC par défaut. Elle vérifie bien le rôle
-- admin en interne, donc l'appel anonyme se heurtait au refus — mais après
-- avoir lu `bons_commande` avec les droits du propriétaire. Une fonction qui
-- n'a rien à dire à un anonyme ne doit pas lui répondre.
--
-- La règle est posée pour **toutes** plutôt que pour celle-là seule, et ce
-- n'est pas de la précaution gratuite : une base reconstruite depuis
-- `20260101000000_base_schema_distant.sql` en ouvre quatorze. Le dump ne
-- rejoue pas les REVOKE du distant, si bien que l'environnement local est
-- durablement plus permissif que la production. En production, ce bloc est
-- sans effet sur treize d'entre elles.
do $$
declare
  v_fonction text;
  -- Ce que `authenticated` doit pouvoir appeler : les prédicats que la RLS
  -- évalue, et les transitions du circuit. Une fonction absente d'ici est une
  -- fonction de trigger, que Postgres refuse d'appeler directement.
  v_pour_authenticated constant text[] := array[
    'a_permission', 'bc_chiffrage_valide', 'bc_cloturer_gratuit',
    'bc_generer_facture', 'bc_passer_pret_a_chiffrer', 'est_admin',
    'est_affecte_au_chantier', 'est_de_l_equipe', 'est_membre', 'mes_societes',
    'mon_role', 'peut_ecrire', 'prochain_numero', 'role_dans_societe',
    'tache_a_une_equipe', 'tache_marquer_realisee', 'tache_sauvegarder_terrain',
    'tache_valider'
  ];
begin
  for v_fonction in
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    /* `authenticated` est retiré lui aussi, puis rendu à la liste ci-dessous.
       Supabase accorde EXECUTE à `authenticated` par privilège par défaut :
       sans ce retrait, les fonctions de trigger le garderaient. Elles rendent
       toutes le type `trigger`, que Postgres refuse d'appeler directement — le
       droit est donc inerte, mais il encombre l'analyseur et fait douter à
       chaque relecture. */
    execute format('revoke all on function %s from public, anon, authenticated', v_fonction);
  end loop;

  for v_fonction in
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and p.proname = any (v_pour_authenticated)
  loop
    execute format('grant execute on function %s to authenticated', v_fonction);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. `search_path` figé, `pg_temp` compris
-- ---------------------------------------------------------------------------

-- Sans `pg_temp` en fin de chemin, Postgres le place **en tête** : un
-- utilisateur qui crée `pg_temp.planning_taches` détourne alors chaque
-- référence non qualifiée d'une fonction SECURITY DEFINER, qui s'exécute avec
-- les droits du propriétaire. Le mettre en dernier le neutralise.
--
-- Les trois premières sont SECURITY DEFINER et n'avaient que `public`.
alter function public.bc_passer_pret_a_chiffrer(uuid)  set search_path = public, pg_temp;
alter function public.tache_marquer_realisee(uuid, text, date) set search_path = public, pg_temp;
alter function public.tache_valider(uuid, boolean, text) set search_path = public, pg_temp;

-- Les trois suivantes ne sont pas SECURITY DEFINER : le risque n'est pas
-- l'élévation de privilège mais la substitution silencieuse d'une table.
-- `circuit_etat_reserve` garde les colonnes d'état du circuit de validation :
-- la détourner reviendrait à désarmer le garde-fou lui-même.
alter function public.circuit_etat_reserve()      set search_path = public, pg_temp;
alter function public.decouper_adresse(text)      set search_path = public, pg_temp;
alter function public.reparer_adresses()          set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. `kv_store` : la RLS suffit, le droit de table n'a plus de raison d'être
-- ---------------------------------------------------------------------------

-- La table héritée est verrouillée par une RLS sans aucune policy : personne
-- n'en lit ni n'en écrit une ligne. Elle conservait pourtant le SELECT accordé
-- à `anon` et `authenticated`, vestige de l'époque où elle portait toutes les
-- données. Le retirer ne change rien au comportement et rend l'intention
-- lisible : cette table est close.
--
-- Elle n'est pas supprimée : elle est la trace de la reprise, et `legacy_id`
-- y renvoie encore.
revoke all on table public.kv_store from anon, authenticated;
