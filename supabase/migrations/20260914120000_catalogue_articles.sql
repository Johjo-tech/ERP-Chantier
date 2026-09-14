-- Le catalogue d'articles devient un vrai catalogue, avec ses propres droits.
--
-- `articles` existe depuis le premier jour et n'a jamais servi : **zéro ligne
-- en production**, sur aucune des quatre sociétés, et aucune ligne de devis, de
-- facture ou de bon de commande ne porte de `article_reference`. On part donc
-- d'une table vide — il n'y a ni doublon à arbitrer, ni reprise à faire, et
-- rendre `code` obligatoire ne peut rien casser.
--
-- Elle va être alimentée par import depuis un logiciel de gestion (~1 000
-- références), puis servir à remplir les lignes de documents par leur code.
-- D'où ce que cette migration pose : les champs qui manquent, l'unicité du
-- code dans la société, de quoi chercher vite sur une chaîne partielle, et des
-- droits qui lui appartiennent.

-- ---------------------------------------------------------------------------
-- 1. Ce qu'un article doit pouvoir porter
-- ---------------------------------------------------------------------------

alter table public.articles
  add column if not exists description   text,
  add column if not exists type_article  text not null default 'service',
  add column if not exists prix_achat    numeric(12,4),
  add column if not exists actif         boolean not null default true,
  add column if not exists famille       text,
  add column if not exists gere_en_stock boolean not null default false;

alter table public.articles
  drop constraint if exists articles_type_article_connu;
alter table public.articles
  add constraint articles_type_article_connu
  check (type_article in ('bien', 'service'));

comment on column public.articles.description is
  'Description longue, reprise dans le commentaire de la ligne de document.';
comment on column public.articles.actif is
  'Un article retiré du catalogue passe à faux : les documents qui citent son code gardent un sens, ce que la suppression leur retirerait.';
comment on column public.articles.prix_achat is
  'Prix d''achat net. Quatre décimales : les tarifs fournisseurs en portent souvent trois.';

-- ---------------------------------------------------------------------------
-- 2. Un code par société, et il est obligatoire
-- ---------------------------------------------------------------------------

-- C'est la clé de l'import comme de l'autocomplétion : sans elle, un même code
-- pourrait désigner deux articles et le remplissage automatique deviendrait un
-- tirage au sort. La table étant vide, la contrainte se pose sans arbitrage.
alter table public.articles alter column code set not null;

create unique index if not exists articles_code_par_societe
  on public.articles (societe_id, code);

-- Le même couple était déjà indexé, sans unicité. Deux index identiques se
-- paient à chaque écriture et ne servent qu'une fois à la lecture.
drop index if exists public.articles_societe_id_code_idx;

-- ---------------------------------------------------------------------------
-- 3. Chercher sur un morceau de mot, pas seulement sur un début
-- ---------------------------------------------------------------------------

-- On tape « siphon » pour trouver « Remplacement siphon lavabo ». Un index
-- B-tree ne sert à rien sur un `ILIKE '%…%'` ; les trigrammes, si.
create extension if not exists pg_trgm;

create index if not exists articles_code_trgm
  on public.articles using gin (code gin_trgm_ops);
create index if not exists articles_designation_trgm
  on public.articles using gin (designation gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Des droits qui appartiennent au catalogue
-- ---------------------------------------------------------------------------

-- Jusqu'ici `articles` empruntait ceux des autres : la **lecture** exigeait la
-- permission « devis », et l'**écriture** passait par `peut_ecrire`, c'est-à-dire
-- admin, conducteur ou technicien. Deux conséquences absurdes :
--
--   * un technicien pouvait écrire un catalogue qu'il ne pouvait pas lire ;
--   * une secrétaire, qui chiffre au quotidien, ne pouvait pas l'écrire.
--
-- Le catalogue entre donc dans la matrice avec son propre module. Depuis le
-- 11/09 la matrice est une **table** : c'est là qu'on écrit, et nulle part
-- ailleurs. Réécrire `a_permission` reviendrait à lui rendre le CASE en dur
-- qu'elle avait justement quitté.
--
--   admin, secrétaire  tout
--   conducteur         voir      — il chiffre avec le catalogue, il ne le
--   lecture            voir        décide pas
--   technicien         rien      — il ne voit aucun prix de vente
--   sous-traitant      rien

insert into public.role_permissions (role, module, action)
select r, 'articles', a
  from unnest(array['admin', 'secretaire']::role_membre[]) r,
       unnest(array['voir', 'creer', 'modifier', 'supprimer']) a
on conflict do nothing;

insert into public.role_permissions (role, module, action)
select r, 'articles', 'voir'
  from unnest(array['conducteur', 'lecture']::role_membre[]) r
on conflict do nothing;

-- Un module absent de la table n'accorde rien : le technicien et le
-- sous-traitant sont donc traités sans avoir à l'écrire.

do $$
declare v_lignes integer;
begin
  select count(*) into v_lignes from public.role_permissions where module = 'articles';
  if v_lignes <> 10 then
    raise exception 'Droits du catalogue incomplets : % lignes au lieu de 10.', v_lignes;
  end if;
end $$;

-- Les quatre politiques cessent d'emprunter celles des devis.
drop policy if exists articles_select on public.articles;
create policy articles_select on public.articles
  for select to authenticated
  using (a_permission(societe_id, 'articles', 'voir'));

drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles
  for insert to authenticated
  with check (a_permission(societe_id, 'articles', 'creer'));

drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles
  for update to authenticated
  using (a_permission(societe_id, 'articles', 'modifier'))
  with check (a_permission(societe_id, 'articles', 'modifier'));

-- La suppression reste possible pour qui a le droit, mais l'écran ne s'en sert
-- pas : retirer un article du catalogue se fait par `actif = false`, sans quoi
-- les documents qui citent son code perdraient leur référence.
drop policy if exists articles_delete on public.articles;
create policy articles_delete on public.articles
  for delete to authenticated
  using (a_permission(societe_id, 'articles', 'supprimer'));
