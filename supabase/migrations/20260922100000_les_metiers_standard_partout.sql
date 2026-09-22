-- Les métiers standard sur TOUTES les sociétés, écrits de la même façon.
--
-- La migration `20260921160000` ne posait les métiers standard que sur une
-- société qui n'en déclarait AUCUN. KTA en avait quatre — CARRELAGE, FAIENCE,
-- PEINTURE, SOL — elle était donc ignorée, et Plomberie, Menuiserie,
-- Électricité et Astreinte n'y arrivaient jamais. Ce n'était pas l'intention :
-- les métiers standard sont un PLANCHER, pas un remplissage tout-ou-rien.
--
-- Deux changements de fond, assumés :
--
--  1. `metiers_standard()` complète au lieu de renoncer. Le revers est réel —
--     une société qui supprime délibérément « Astreinte » la reverrait
--     réapparaître si la fonction était rejouée sur elle. Elle ne l'est que
--     par le déclencheur de naissance et par cette migration-ci, une fois.
--
--  2. Étanchéité rejoint la liste. Elle n'était pas dans les sept demandés,
--     mais 47 bons de KTA la portent déjà et c'est l'un des trois types
--     d'intervention historiques : l'omettre aurait laissé un métier employé
--     hors du référentiel.
--
-- Et la casse est harmonisée : CARRELAGE devient Carrelage, FAIENCE devient
-- Faïence. Sans quoi la liste mêlerait deux conventions — c'est précisément ce
-- qu'on trouvait mal fait. La propagation aux bons, tâches et lignes est
-- l'affaire de `metier_renomme_partout`, amendé juste avant pour qu'elle passe
-- sur un bon facturé et qu'elle emporte les clés des cartes par métier.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. La liste, déclarée UNE fois
-- ──────────────────────────────────────────────────────────────────────────
-- `metiers_standard()` et `metier_libelle_canonique()` la lisent toutes deux.
-- Écrite deux fois, elle finirait par dire deux choses. L'ordre du rang est
-- celui de l'affichage ; les couleurs sont relevées sur la palette de l'écran.

create or replace function public.metiers_standard_liste()
returns table(rang integer, libelle text, couleur text)
language sql immutable as $fn$
  select * from (values
    (1, 'Peinture',    '#FF6A1A'),
    (2, 'Sol',         '#F5B301'),
    (3, 'Plomberie',   '#1E8FD5'),
    (4, 'Menuiserie',  '#8A6D3B'),
    (5, 'Électricité', '#FFD23F'),
    (6, 'Étanchéité',  '#0E7C66'),
    (7, 'Astreinte',   '#C0392B'),
    (8, 'Faïence',     '#5B5FE8')
  ) as t(rang, libelle, couleur)
$fn$;

comment on function public.metiers_standard_liste() is
  'Les métiers posés sur toute société, dans leur ordre d''affichage et avec '
  'leur couleur de départ. Source unique : la fonction de pose et celle de '
  'graphie canonique la lisent toutes deux.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. La graphie de référence d'un métier
-- ──────────────────────────────────────────────────────────────────────────
-- Un mappage explicite pour les standard, `initcap` pour le reste. `initcap`
-- ne rend pas les accents : il ferait « Electricite » et « Etancheite », ce
-- qui rouvrirait par la fenêtre la divergence de graphies qu'on ferme ici.

create or replace function public.metier_libelle_canonique(p_libelle text)
returns text language sql stable as $fn$
  select coalesce(
    (select s.libelle from public.metiers_standard_liste() s
      where public.metier_normalise(s.libelle) = public.metier_normalise(p_libelle)),
    initcap(p_libelle)
  )
$fn$;

comment on function public.metier_libelle_canonique(text) is
  'La graphie de référence d''un métier : celle du standard s''il en est un, '
  'sinon la capitale initiale.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Refuser d'avancer sur un référentiel ambigu
-- ──────────────────────────────────────────────────────────────────────────
-- Deux graphies du même métier dans une société — « Peinture » et
-- « PEINTURE » — se ramèneraient au même libellé et violeraient
-- `UNIQUE (societe_id, libelle)`. Fusionner est un arbitrage : quelle ligne
-- garder, quelle couleur, quelle position. On s'arrête et on le dit, plutôt
-- que de trancher à la place de quelqu'un.
-- Aucune société n'est dans ce cas aujourd'hui — vérifié.

do $$
declare v_ambigus text;
begin
  select string_agg(format('%s → %s', s.code, d.cle), ', ')
    into v_ambigus
    from (
      select societe_id, public.metier_normalise(libelle) as cle
        from public.metiers
       group by societe_id, public.metier_normalise(libelle)
      having count(*) > 1
    ) d
    join public.societes s on s.id = d.societe_id;

  if v_ambigus is not null then
    raise exception
      'Deux graphies du même métier coexistent (%). Fusionnez-les à la main — '
      'garder l''une, reporter ses références, supprimer l''autre — puis '
      'rejouez cette migration.', v_ambigus
      using errcode = 'data_exception';
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Harmoniser la casse — AVANT de compléter
-- ──────────────────────────────────────────────────────────────────────────
-- L'ordre compte. Compléter d'abord insérerait « Peinture » à côté de
-- « PEINTURE » : les deux textes diffèrent, aucune contrainte ne s'y oppose,
-- et l'harmonisation suivante tenterait alors PEINTURE → Peinture, qui
-- violerait l'unicité. Harmoniser d'abord, et le garde sur la forme
-- normalisée suffit ensuite.
--
-- Ligne à ligne : `metier_renomme_partout` est un déclencheur FOR EACH ROW, et
-- chaque renommage doit propager le sien avant que le suivant ne parte.

do $$
declare r record; v_cible text;
begin
  for r in select id, libelle from public.metiers order by societe_id, libelle loop
    v_cible := public.metier_libelle_canonique(r.libelle);
    if v_cible is distinct from r.libelle then
      update public.metiers set libelle = v_cible where id = r.id;
    end if;
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Compléter : le standard est un plancher
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.metiers_standard(p_societe uuid)
returns integer language plpgsql as $fn$
declare
  v_pose integer := 0;
  v_rang integer;
  r      record;
begin
  select coalesce(max(position), 0) into v_rang
    from public.metiers where societe_id = p_societe;

  for r in select * from public.metiers_standard_liste() order by rang loop
    -- Au sens de la forme normalisée : « FAIENCE » compte pour « Faïence ».
    if exists (
      select 1 from public.metiers m
       where m.societe_id = p_societe
         and public.metier_normalise(m.libelle) = public.metier_normalise(r.libelle)
    ) then
      continue;
    end if;

    v_rang := v_rang + 1;
    insert into public.metiers (societe_id, libelle, couleur, position)
    values (p_societe, r.libelle, r.couleur, v_rang);
    v_pose := v_pose + 1;
  end loop;

  return v_pose;
end;
$fn$;

comment on function public.metiers_standard(uuid) is
  'Garantit que les métiers standard existent sur cette société, sans toucher '
  'à ce qu''elle déclare déjà. Idempotente : ce qui est là n''est pas reposé.';

do $$
declare v_id uuid;
begin
  for v_id in select id from public.societes loop
    perform public.metiers_standard(v_id);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. L'ordre d'affichage : les standard d'abord, le reste à la suite
-- ──────────────────────────────────────────────────────────────────────────
-- `position` n'est pas surveillée par `metier_renomme_partout`, qui ne se
-- déclenche que sur `libelle` : renuméroter ne propage rien.

update public.metiers m
   set position = r.rang
  from (
    select m2.id,
           (row_number() over (
              partition by m2.societe_id
              order by coalesce(s.rang, 1000), m2.libelle))::integer as rang
      from public.metiers m2
      left join public.metiers_standard_liste() s
        on public.metier_normalise(s.libelle) = public.metier_normalise(m2.libelle)
  ) r
 where r.id = m.id and m.position is distinct from r.rang;
