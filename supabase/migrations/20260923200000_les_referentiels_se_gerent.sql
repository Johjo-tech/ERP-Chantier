-- Les listes de catégories se tiennent, au lieu d'être écrites en dur.
--
-- Trois listes vivaient jusqu'ici dans le code de l'écran, hors de portée de
-- qui s'en sert :
--
--   materiels.categorie      saisie LIBRE — chacun retape sa graphie, et
--                            « échafaudage » et « Échafaudages » deviennent
--                            deux catégories
--   materiels.etat_general   `<select>` figé, cinq valeurs dans `app.js`
--   catégorie d'achat        `<select>` figé, et pas même une colonne
--
-- UNE SEULE TABLE pour tous les domaines. Trois tables auraient donné trois
-- écrans à tenir et trois occasions de diverger ; `domaine` suffit à les
-- séparer, et le même formulaire les édite toutes.
--
-- POURQUOI PAS LES RÉGLAGES. `societe_settings.infos_entreprise.reglages`
-- aurait évité cette migration. C'est là que vivent les unités — éditables
-- depuis les Réglages, et JAMAIS RELUES : `uniteOptions()` lit une constante
-- du code. Une liste éditable qui n'alimente rien est pire que pas de liste.
-- Une table oblige à la lire.
--
-- `code`, `couleur` et `icone` ne sont pas du décor : l'écran des achats colore
-- et illustre déjà ses lignes par catégorie (`ACHAT_CATEGORIES`), et sans ces
-- trois colonnes la liste gérable serait un recul sur l'existant.

create table if not exists public.referentiels (
  id          uuid primary key default gen_random_uuid(),
  societe_id  uuid not null references public.societes(id) on delete cascade,
  domaine     text not null,
  libelle     text not null,
  code        text,
  couleur     text,
  icone       text,
  position    integer not null default 0,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);

comment on table public.referentiels is
  'Listes de choix tenues par la société : catégories et états de matériel, '
  'catégories d''achat de chantier. Un domaine par liste.';
comment on column public.referentiels.domaine is
  'categorie_materiel · etat_materiel · categorie_achat · unite · '
  'piece_courante · fournisseur_piece';
comment on column public.referentiels.code is
  'Clé stable quand l''écran en a besoin — la catégorie d''achat « salarie » '
  'ouvre des champs que les autres n''ont pas. Le libellé, lui, se renomme.';

-- Deux fois la même entrée dans un domaine n'a pas de sens, et rendrait le
-- menu ambigu. La contrainte porte sur la société : deux sociétés tiennent
-- leurs listes séparément, comme pour les métiers.
create unique index if not exists referentiels_un_libelle_par_domaine
  on public.referentiels (societe_id, domaine, libelle);

create index if not exists referentiels_par_domaine
  on public.referentiels (societe_id, domaine, position);

-- `set_maj_le` : le nom exact relevé sur `trg_metiers_maj`, pas supposé.
create trigger trg_referentiels_maj
  before update on public.referentiels
  for each row execute function public.set_maj_le();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — recopiée de `metiers`, mot pour mot
-- ──────────────────────────────────────────────────────────────────────────
-- Les politiques existantes ont été relevées sur la base vivante plutôt que
-- réécrites : une liste de choix n'a aucune raison d'être plus ouverte que le
-- référentiel des métiers, et en inventer de nouvelles serait l'occasion d'en
-- faire une plus large sans s'en apercevoir.

alter table public.referentiels enable row level security;

drop policy if exists referentiels_select on public.referentiels;
create policy referentiels_select on public.referentiels
  for select using (public.est_membre(societe_id));

drop policy if exists referentiels_insert on public.referentiels;
create policy referentiels_insert on public.referentiels
  for insert with check (public.peut_ecrire(societe_id));

drop policy if exists referentiels_update on public.referentiels;
create policy referentiels_update on public.referentiels
  for update using (public.peut_ecrire(societe_id))
  with check (public.peut_ecrire(societe_id));

drop policy if exists referentiels_delete on public.referentiels;
create policy referentiels_delete on public.referentiels
  for delete using (public.peut_ecrire(societe_id));

-- ──────────────────────────────────────────────────────────────────────────
-- L'amorçage
-- ──────────────────────────────────────────────────────────────────────────
-- Les valeurs de départ sont EXACTEMENT celles que l'écran proposait, pour que
-- rien ne change le jour de la bascule — `ETATS_MATERIEL` et `ACHAT_CATEGORIES`
-- de `src/pages/app.js`, couleurs et icônes comprises. S'y ajoute une liste de
-- catégories de matériel, qui n'existait nulle part : le champ était libre.

create or replace function public.referentiels_liste()
returns table(domaine text, rang integer, libelle text, code text, couleur text, icone text)
language sql immutable as $fn$
  select * from (values
    -- L'état d'un matériel : les cinq valeurs de `ETATS_MATERIEL`
    ('etat_materiel',      1, 'Neuf',          'neuf',          '#12875A', null),
    ('etat_materiel',      2, 'Bon état',      'bon',           '#2461C7', null),
    ('etat_materiel',      3, 'Usé',           'use',           '#E9A23B', null),
    ('etat_materiel',      4, 'À réparer',     'a_reparer',     '#C24E00', null),
    ('etat_materiel',      5, 'Hors service',  'hors_service',  '#D9363E', null),

    -- La catégorie d'un achat : les trois de `ACHAT_CATEGORIES`. Le `code` est
    -- ce que l'écran teste — « salarie » ouvre les champs salarié et heures.
    ('categorie_achat',    1, 'Fournitures',   'fournitures',   '#2461C7', '📦'),
    ('categorie_achat',    2, 'Main-d''œuvre', 'salarie',       '#12875A', '👷'),
    ('categorie_achat',    3, 'Sous-traitance','soustraitant',  '#9B6EF0', '🏗️'),

    -- La catégorie d'un matériel : neuve, le champ était libre
    ('categorie_materiel', 1, 'Outillage électroportatif', null, null, null),
    ('categorie_materiel', 2, 'Outillage à main',          null, null, null),
    ('categorie_materiel', 3, 'Échafaudage',               null, null, null),
    ('categorie_materiel', 4, 'Nacelle élévatrice',        null, null, null),
    ('categorie_materiel', 5, 'Étaiement',                 null, null, null),
    ('categorie_materiel', 6, 'Compresseur et pneumatique',null, null, null),
    ('categorie_materiel', 7, 'Groupe électrogène',        null, null, null),
    ('categorie_materiel', 8, 'Matériel de mesure',        null, null, null),
    ('categorie_materiel', 9, 'Équipement de protection',  null, null, null),
    ('categorie_materiel',10, 'Petit engin de chantier',   null, null, null),

    -- LES UNITÉS. Elles étaient déjà éditables dans les Réglages… et jamais
    -- relues : `uniteOptions()` lit la constante `UNITES` de `app.js:2078`, pas
    -- `reglagesCourants().unites`. Les deux listes ne disent d'ailleurs pas la
    -- même chose. Ce sont les valeurs de la CONSTANTE qui sont reprises ici —
    -- celles que l'écran propose réellement —, pour que rien ne change le jour
    -- de la bascule. Une unité inconnue ne casse rien : `code_unite()` retombe
    -- sur « C62 », vérifié.
    ('unite',              1, 'u',        'u',       null, null),
    ('unite',              2, 'pièce',    'piece',   null, null),
    ('unite',              3, 'h',        'h',       null, null),
    ('unite',              4, 'forfait',  'forfait', null, null),
    ('unite',              5, 'm',        'm',       null, null),
    ('unite',              6, 'm²',       'm2',      null, null),
    ('unite',              7, 'm³',       'm3',      null, null),
    ('unite',              8, 'ml',       'ml',      null, null),
    ('unite',              9, 'mm',       'mm',      null, null),
    ('unite',             10, 'jour',     'jour',    null, null)
  ) as t(domaine, rang, libelle, code, couleur, icone)
$fn$;

comment on function public.referentiels_liste() is
  'Les listes de départ, déclarées une seule fois. La pose initiale et le '
  'déclencheur de naissance d''une société la lisent toutes deux.';

/**
 * Pose ce qui manque, sans toucher à ce que la société a déjà.
 *
 * Idempotente, et comparée sur le LIBELLÉ : une société qui a renommé
 * « Usé » en « Usagé » ne se verra pas reposer l'original — mais elle ne
 * verra pas non plus disparaître son propre libellé.
 */
create or replace function public.referentiels_standard(p_societe uuid)
returns integer language plpgsql as $fn$
declare v_pose integer := 0; r record;
begin
  for r in select * from public.referentiels_liste() order by domaine, rang loop
    if exists (
      select 1 from public.referentiels x
       where x.societe_id = p_societe and x.domaine = r.domaine and x.libelle = r.libelle
    ) then
      continue;
    end if;
    insert into public.referentiels (societe_id, domaine, libelle, code, couleur, icone, position)
    values (p_societe, r.domaine, r.libelle, r.code, r.couleur, r.icone, r.rang);
    v_pose := v_pose + 1;
  end loop;
  return v_pose;
end;
$fn$;

-- LES PIÈCES À COMMANDER ET LEURS FOURNISSEURS n'ont AUCUNE valeur de départ,
-- et c'est délibéré. `planning_taches.piece_description` et `piece_fournisseur`
-- sont du texte libre, il n'existe aucune table de fournisseurs, et je ne sais
-- pas quelles pièces vous commandez ni chez qui. Inventer une liste serait
-- pire que pas de liste : personne ne s'y reconnaîtrait, et il faudrait la
-- vider avant de s'en servir.
--
-- Les deux domaines existent donc vides. La règle `referentielCompose` les
-- remplit d'elle-même : ce qui a déjà été saisi devient une proposition, et il
-- suffit de la garder pour qu'elle entre dans la liste.

do $$
declare v_id uuid;
begin
  for v_id in select id from public.societes loop
    perform public.referentiels_standard(v_id);
  end loop;
end $$;

-- Une société qui naît reçoit ses listes, comme elle reçoit ses métiers.
create or replace function public.societes_referentiels_standard()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $fn$
begin
  perform public.referentiels_standard(new.id);
  return new;
end;
$fn$;

drop trigger if exists societes_referentiels_standard on public.societes;
create trigger societes_referentiels_standard
  after insert on public.societes
  for each row execute function public.societes_referentiels_standard();
