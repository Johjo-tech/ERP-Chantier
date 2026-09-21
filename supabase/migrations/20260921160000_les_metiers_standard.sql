-- Les métiers d'une société : préchargés, ordonnés, colorés, et indélébiles
-- tant qu'on s'en sert.
--
-- Trois manques se ferment ici.
--
-- 1. UNE SOCIÉTÉ NAISSAIT SANS AUCUN MÉTIER. Trois des quatre sociétés en
--    production n'en déclarent aucun : la liste à cocher d'un bon de commande
--    y est vide, et le métier d'un chapitre ne peut pas se choisir.
--
-- 2. LA COULEUR N'AVAIT PAS DE COLONNE. L'écran la fait choisir dans une
--    palette, l'enregistre… et `colonnesDe()` l'écarte avant l'envoi, en
--    silence. `metierCouleur()` rendait donc toujours vide, et le liseré de
--    couleur des cartes du planning n'est jamais apparu.
--
-- 3. L'ORDRE N'EXISTAIT PAS. La liste se triait par libellé ; on ne pouvait
--    pas mettre en tête les deux métiers qu'on emploie tous les jours.
--
-- Et une chausse-trappe : les métiers sont référencés PAR LEUR NOM —
-- `bons_commande.metier`, `bons_commande.metiers`, `planning_taches.metier`,
-- les lignes de document. Aucune clé étrangère ne les tient. Supprimer un
-- métier employé laissait donc des références orphelines, et le renommer les
-- laissait derrière lui. Les deux déclencheurs ci-dessous ferment ces deux
-- portes : on ne supprime pas ce qui sert, et un renommage suit partout.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Les colonnes qui manquaient
-- ──────────────────────────────────────────────────────────────────────────

alter table public.metiers
  add column if not exists couleur  text,
  add column if not exists position integer not null default 0;

comment on column public.metiers.couleur is
  'Liseré de couleur des cartes de planning. La palette vit à l''écran ; la '
  'base ne fait que conserver le choix.';
comment on column public.metiers.position is
  'Ordre d''affichage choisi par l''utilisateur. À égalité, le libellé tranche.';

-- Un ordre de départ qui ne surprend personne : celui qu'on voyait déjà.
update public.metiers m
   set position = r.rang
  from (
    select id, (row_number() over (partition by societe_id order by libelle))::int as rang
      from public.metiers
  ) r
 where r.id = m.id and m.position = 0;

create index if not exists metiers_societe_position_idx
  on public.metiers (societe_id, position, libelle);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Comparer deux libellés de métier comme l'écran le fait
-- ──────────────────────────────────────────────────────────────────────────
-- Miroir SQL de `normaliserLibelle` (src/api/regles-metiers.ts) : sans
-- accents, en majuscules, ponctuation ramenée à des espaces. « Faïence » et
-- « FAIENCE » désignent le même métier, et la base doit le savoir aussi bien
-- que l'écran — sinon le refus de suppression se contredirait avec l'écran
-- qui, lui, les confond.
--
-- `translate` plutôt qu'`unaccent` : l'extension n'est pas installée, et six
-- voyelles suffisent au français des métiers du bâtiment.

create or replace function public.metier_normalise(p_texte text)
returns text language sql immutable as $fn$
  select nullif(
    btrim(
      regexp_replace(
        upper(translate(coalesce(p_texte, ''),
          'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
          'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')),
        '[^A-Z0-9]+', ' ', 'g')
    ), '')
$fn$;

comment on function public.metier_normalise(text) is
  'Libellé de métier réduit à sa forme comparable : sans accents, en '
  'majuscules. Miroir de `normaliserLibelle` côté écran.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Les métiers standard, posés à la naissance d'une société
-- ──────────────────────────────────────────────────────────────────────────
-- L'ordre de la liste EST l'ordre d'affichage : il vient du client, qui a
-- nommé ses métiers dans l'ordre où il les emploie.

create or replace function public.metiers_standard(p_societe uuid)
returns integer language plpgsql as $fn$
declare
  v_standard text[] := array[
    'Peinture', 'Sol', 'Plomberie', 'Menuiserie', 'Électricité', 'Astreinte', 'Faïence'
  ];
  -- Relevées sur la palette de l'écran (`METIER_PALETTE`), dans le même ordre.
  v_couleurs text[] := array[
    '#FF6A1A', '#F5B301', '#1E8FD5', '#8A6D3B', '#FFD23F', '#C0392B', '#5B5FE8'
  ];
  v_pose integer := 0;
  v_i    integer;
begin
  -- Une société qui déclare déjà ses métiers n'est pas à remplir : lui poser
  -- une liste par-dessus ferait réapparaître ce qu'elle a volontairement
  -- supprimé.
  if exists (select 1 from public.metiers where societe_id = p_societe) then
    return 0;
  end if;

  for v_i in 1 .. array_length(v_standard, 1) loop
    insert into public.metiers (societe_id, libelle, couleur, position)
    values (p_societe, v_standard[v_i], v_couleurs[v_i], v_i);
    v_pose := v_pose + 1;
  end loop;

  return v_pose;
end;
$fn$;

comment on function public.metiers_standard(uuid) is
  'Pose les sept métiers standard sur une société qui n''en déclare aucun. '
  'Sans effet sur une société déjà pourvue.';

create or replace function public.societe_metiers_standard()
returns trigger language plpgsql as $fn$
begin
  perform public.metiers_standard(new.id);
  return new;
end;
$fn$;

drop trigger if exists societes_metiers_standard on public.societes;
create trigger societes_metiers_standard
  after insert on public.societes
  for each row execute function public.societe_metiers_standard();

-- Les sociétés déjà en base qui n'en déclarent aucun.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.societes loop
    perform public.metiers_standard(v_id);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. On ne supprime pas un métier dont on se sert
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.metier_employe(p_societe uuid, p_libelle text)
returns text language plpgsql stable as $fn$
declare
  v_cle text := public.metier_normalise(p_libelle);
  v_n   integer;
begin
  if v_cle is null then return null; end if;

  select count(*) into v_n from public.bons_commande b
   where b.societe_id = p_societe
     and (public.metier_normalise(b.metier) = v_cle
          or (jsonb_typeof(b.metiers) = 'array'
              and exists (select 1 from jsonb_array_elements_text(b.metiers) m
                           where public.metier_normalise(m) = v_cle)));
  if v_n > 0 then return v_n || ' bon(s) de commande'; end if;

  select count(*) into v_n from public.planning_taches t
   where t.societe_id = p_societe and public.metier_normalise(t.metier) = v_cle;
  if v_n > 0 then return v_n || ' tâche(s) de planning'; end if;

  select count(*) into v_n from public.bon_commande_lignes l
    join public.bons_commande b on b.id = l.bon_commande_id
   where b.societe_id = p_societe and public.metier_normalise(l.metier) = v_cle;
  if v_n > 0 then return v_n || ' ligne(s) de bon de commande'; end if;

  select count(*) into v_n from public.devis_lignes l
    join public.devis d on d.id = l.devis_id
   where d.societe_id = p_societe and public.metier_normalise(l.metier) = v_cle;
  if v_n > 0 then return v_n || ' ligne(s) de devis'; end if;

  select count(*) into v_n from public.facture_lignes l
    join public.factures f on f.id = l.facture_id
   where f.societe_id = p_societe and public.metier_normalise(l.metier) = v_cle;
  if v_n > 0 then return v_n || ' ligne(s) de facture'; end if;

  return null;
end;
$fn$;

comment on function public.metier_employe(uuid, text) is
  'Ce qui emploie ce métier dans cette société, nommé et compté — ou NULL si '
  'rien ne s''en sert. Sert au refus de suppression et à l''écran.';

create or replace function public.metier_indelebile_si_employe()
returns trigger language plpgsql as $fn$
declare v_ou text;
begin
  v_ou := public.metier_employe(old.societe_id, old.libelle);
  if v_ou is not null then
    raise exception
      'Le métier « % » est employé par % : il ne peut pas être supprimé. Renommez-le plutôt — le nouveau nom suivra partout.',
      old.libelle, v_ou
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$fn$;

drop trigger if exists metiers_indelebile_si_employe on public.metiers;
create trigger metiers_indelebile_si_employe
  before delete on public.metiers
  for each row execute function public.metier_indelebile_si_employe();

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Renommer un métier le renomme PARTOUT
-- ──────────────────────────────────────────────────────────────────────────
-- C'est la réaffectation : les références sont des NOMS, pas des clés. Sans
-- cette propagation, renommer « Faïence » en « Carrelage » laissait derrière
-- lui tous les bons qui disent encore « Faïence » — et le référentiel les
-- faisait réapparaître comme un métier de plus. Trois graphies du même
-- conducteur avaient déjà produit trois conducteurs dans les statistiques ;
-- c'est la même mécanique, et le même remède.

create or replace function public.metier_renomme_partout()
returns trigger language plpgsql as $fn$
declare v_cle text := public.metier_normalise(old.libelle);
begin
  if new.libelle is not distinct from old.libelle then return new; end if;
  if v_cle is null then return new; end if;

  update public.bons_commande
     set metier = new.libelle
   where societe_id = old.societe_id and public.metier_normalise(metier) = v_cle;

  update public.bons_commande b
     set metiers = (
       select jsonb_agg(case when public.metier_normalise(m) = v_cle then new.libelle else m end)
         from jsonb_array_elements_text(b.metiers) m
     )
   where b.societe_id = old.societe_id
     and jsonb_typeof(b.metiers) = 'array'
     and exists (select 1 from jsonb_array_elements_text(b.metiers) m
                  where public.metier_normalise(m) = v_cle);

  update public.planning_taches
     set metier = new.libelle
   where societe_id = old.societe_id and public.metier_normalise(metier) = v_cle;

  update public.bon_commande_lignes l
     set metier = new.libelle
    from public.bons_commande b
   where b.id = l.bon_commande_id and b.societe_id = old.societe_id
     and public.metier_normalise(l.metier) = v_cle;

  update public.devis_lignes l
     set metier = new.libelle
    from public.devis d
   where d.id = l.devis_id and d.societe_id = old.societe_id
     and public.metier_normalise(l.metier) = v_cle;

  -- Les lignes de facture ÉMISE sont figées par ailleurs ; on ne touche donc
  -- qu'aux brouillons. Une facture partie chez le client dit ce qu'elle disait.
  update public.facture_lignes l
     set metier = new.libelle
    from public.factures f
   where f.id = l.facture_id and f.societe_id = old.societe_id
     and coalesce(f.numero, '') = ''
     and public.metier_normalise(l.metier) = v_cle;

  return new;
end;
$fn$;

comment on function public.metier_renomme_partout() is
  'Propage le renommage d''un métier à tout ce qui le désigne par son nom. '
  'Les lignes de facture émise sont laissées telles quelles : le document '
  'parti chez le client ne se réécrit pas.';

drop trigger if exists metiers_renomme_partout on public.metiers;
create trigger metiers_renomme_partout
  after update of libelle on public.metiers
  for each row execute function public.metier_renomme_partout();
