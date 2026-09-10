-- `kv_store` retrouve l'accès qu'elle avait avant le 8 septembre.
--
-- Demandé explicitement : un outil externe s'y branche et personne ne sait
-- aujourd'hui avec quelle clé. Plutôt que de laisser ce travail bloqué, on
-- rétablit l'état antérieur et on cherchera ensuite comment le refermer
-- proprement.
--
-- **Ce que cela expose, pour que ce soit écrit noir sur blanc.** La clé
-- anonyme est publique par conception : elle est livrée dans le bundle du
-- navigateur, et le dépôt est public. Les 116 lignes de cette table — deux
-- clients, 47 bons de commande, 21 factures, 12 devis, 3 règlements, une
-- fiche salarié, avec noms, adresses d'intervention et montants — redeviennent
-- donc lisibles, modifiables et **supprimables** par quiconque.
--
-- Ce n'est pas une fatalité technique : c'est un arbitrage entre débloquer un
-- collègue aujourd'hui et fermer une porte. Il est pris en connaissance de
-- cause, et il est réversible.
--
-- Deux façons de refermer, quand l'outil aura été identifié :
--
--     drop policy kv_store_ouverte on public.kv_store;
--     revoke all on table public.kv_store from anon;
--
-- La politique remplace la désactivation pure et simple de la RLS qui
-- prévalait avant : l'effet est le même, mais le robinet reste visible et se
-- referme d'une ligne au lieu d'un `alter table`.

grant select, insert, update, delete on table public.kv_store to anon, authenticated;

drop policy if exists kv_store_membre on public.kv_store;
drop policy if exists kv_store_ouverte on public.kv_store;

create policy kv_store_ouverte on public.kv_store
  for all to anon, authenticated
  using (true)
  with check (true);

comment on table public.kv_store is
  'Table héritée, plus alimentée depuis le 04/09/2026. OUVERTE À L''ANONYME sur demande, le temps qu''un outil externe soit identifié : la clé anonyme étant publique, ces 116 lignes réelles le sont aussi. À refermer — voir la migration 20260910235500.';
