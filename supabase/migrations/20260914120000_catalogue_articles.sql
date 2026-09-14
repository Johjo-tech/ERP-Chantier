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
-- Le catalogue entre donc dans la matrice avec son propre module. Le reste de
-- la fonction est reproduit à l'identique : une fonction Postgres se remplace
-- en entier, on ne modifie pas une branche isolément.

create or replace function public.a_permission(
  p_societe_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := role_dans_societe(p_societe_id);
begin
  if v_role is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role = 'lecture' then
    return p_action = 'voir' and p_module <> 'utilisateurs';
  end if;

  if v_role = 'secretaire' then
    return case p_module
      when 'clients' then true
      when 'devis' then true
      when 'factures' then true
      when 'facturation_electronique' then true
      when 'reglements' then true
      when 'controle_fournisseurs' then true
      when 'rh' then true
      when 'vehicules' then true
      -- Elle chiffre les devis et les factures : le catalogue est son outil.
      when 'articles' then true
      when 'bons_commande' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rapports' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'conducteur' then
    return case p_module
      when 'chantiers' then true
      when 'bons_commande' then true
      when 'materiel' then true
      when 'planning' then true
      when 'rapports' then true
      when 'devis' then p_action in ('voir', 'creer', 'modifier')
      when 'vehicules' then p_action in ('voir', 'modifier')
      -- Il chiffre un devis, donc il consulte les prix du catalogue ; il ne
      -- décide pas de ce qui y figure.
      when 'articles' then p_action = 'voir'
      when 'tableau_de_bord' then p_action = 'voir'
      when 'clients' then p_action = 'voir'
      when 'factures' then p_action = 'voir'
      when 'controle_fournisseurs' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'technicien' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'materiel' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'vehicules' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'sous_traitant' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      else false
    end;
  end if;

  return false;
end;
$function$;

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
