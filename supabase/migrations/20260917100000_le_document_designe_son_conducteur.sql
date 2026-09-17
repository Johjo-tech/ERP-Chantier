-- Le document désigne son conducteur, il ne recopie plus son nom.
--
-- Les cinq tables qui portent un conducteur ne gardaient que son NOM, recopié
-- au moment de l'écriture. La liste déroulante proposait pourtant les fiches —
-- mais elle envoyait `c.nom` là où celle des chantiers envoie `c.id`.
--
-- Deux conséquences, dont une déjà constatée :
--   * toute écriture qui contourne le formulaire invente sa graphie. Les suites
--     de tests ont ainsi semé « PAUL » et « Paul » à côté de « paUL », et les
--     statistiques, qui regroupent par égalité exacte, ont montré trois
--     conducteurs là où il n'y en a qu'un ;
--   * renommer une fiche — ne serait-ce que pour corriger une casse — laisse
--     tous les documents antérieurs sur l'ancienne graphie, et scinde
--     définitivement les statistiques de cette personne.
--
-- On ajoute donc la référence, et c'est elle qui fait foi. Le nom RESTE sur le
-- document, mais comme une étiquette que la base entretient : les quelque cent
-- endroits qui l'affichent, le filtrent ou le regroupent continuent de
-- fonctionner sans être touchés, et un renommage se propage désormais partout.

-- ---------------------------------------------------------------- 1. La référence

alter table public.bons_commande add column if not exists conducteur_id uuid
  references public.conducteurs(id) on delete set null;
alter table public.devis         add column if not exists conducteur_id uuid
  references public.conducteurs(id) on delete set null;
alter table public.factures      add column if not exists conducteur_id uuid
  references public.conducteurs(id) on delete set null;
alter table public.interventions add column if not exists conducteur_id uuid
  references public.conducteurs(id) on delete set null;
alter table public.chantiers     add column if not exists conducteur_id uuid
  references public.conducteurs(id) on delete set null;

create index if not exists bons_commande_conducteur_id_idx on public.bons_commande(conducteur_id);
create index if not exists devis_conducteur_id_idx         on public.devis(conducteur_id);
create index if not exists factures_conducteur_id_idx      on public.factures(conducteur_id);
create index if not exists interventions_conducteur_id_idx on public.interventions(conducteur_id);
create index if not exists chantiers_conducteur_id_idx     on public.chantiers(conducteur_id);

comment on column public.factures.conducteur_id is
  'La fiche du conducteur. C''est elle qui fait foi ; la colonne `conducteur` '
  'n''est qu''une étiquette entretenue par le déclencheur.';

-- ------------------------------------------------- 2. La facture émise l'accepte
--
-- `facture_emise_entete_figee` gèle tout ce qui n'est pas nommé. `conducteur`
-- y figure déjà, au titre de l'affectation interne — qui ne change rien à ce
-- que le client a reçu. Sa référence doit y figurer aussi, SANS QUOI la reprise
-- ci-dessous serait refusée sur les factures numérotées.

create or replace function public.facture_emise_entete_figee()
returns trigger language plpgsql as $fn$
declare
  v_libres text[] := array[
    'statut',
    'statut_cycle', 'depose_le', 'pdp_identifiant', 'pdp_transmission_id',
    'verrouillee',
    -- Affectation interne : ne change rien à ce que le client a reçu.
    'conducteur', 'conducteur_id', 'interlocuteur', 'chantier_id',
    'facturation_adresse', 'facturation_code_postal', 'facturation_ville',
    'facturation_pays_code',
    'maj_le', 'identifiant_unique',
    'numero'
  ];
  v_completables text[] := array[
    'client_id', 'client_siret', 'client_siren', 'client_tva_intracom',
    'client_pays_code', 'client_code_service', 'client_code_routage'
  ];
  v_col   text;
  v_avant jsonb := to_jsonb(old);
  v_apres jsonb := to_jsonb(new);
  v_touches text[] := '{}';
begin
  if coalesce(old.numero, '') = '' then
    return new;
  end if;

  for v_col in select jsonb_object_keys(v_apres) loop
    if v_col = any(v_libres) then continue; end if;
    if v_apres -> v_col is not distinct from v_avant -> v_col then continue; end if;
    if v_col = any(v_completables)
       and coalesce(v_avant ->> v_col, '') = ''
       and coalesce(v_apres ->> v_col, '') <> '' then
      continue;
    end if;
    v_touches := v_touches || v_col;
  end loop;

  if array_length(v_touches, 1) > 0 then
    raise exception
      'La facture % est émise : son en-tête ne peut plus être modifié (%). Une correction passe par un avoir.',
      old.numero, array_to_string(v_touches, ', ')
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$fn$;

-- ------------------------------------------------------------ 3. La résolution
--
-- Retrouver la fiche d'un nom. Insensible à la casse et aux espaces de bord,
-- car c'est exactement ce qui a divergé. Pas aux accents : `unaccent` n'est pas
-- installé, et l'installer pour ce seul usage coûterait plus qu'il ne rend.
--
-- `order by cree_le` : si deux fiches portent le même nom, la plus ancienne
-- gagne, toujours. Un départage arbitraire mais stable vaut mieux qu'un
-- rattachement qui change d'une exécution à l'autre.

create or replace function public.conducteur_par_nom(p_societe uuid, p_nom text)
returns uuid language sql stable as $fn$
  select c.id
    from public.conducteurs c
   where c.societe_id = p_societe
     and lower(btrim(c.nom)) = lower(btrim(p_nom))
   order by c.cree_le
   limit 1;
$fn$;

comment on function public.conducteur_par_nom(uuid, text) is
  'La fiche conducteur portant ce nom dans cette société, casse et espaces de '
  'bord indifférents. La plus ancienne si plusieurs, pour rester stable.';

-- --------------------------------------------------------- 4. L'étiquette suit
--
-- Sur chacune des cinq tables. L'ordre compte :
--   * une référence posée fait foi, et réécrit le nom ;
--   * un nom seul est rattrapé — on cherche sa fiche, et on l'adopte. C'est ce
--     qui rend la base auto-réparatrice face aux écritures qui contournent le
--     formulaire (scripts, reprises, suites de tests) ;
--   * un nom sans fiche est laissé tel quel : on ne perd pas une donnée sous
--     prétexte qu'elle n'a pas d'équivalent au répertoire.

create or replace function public.document_designe_son_conducteur()
returns trigger language plpgsql as $fn$
begin
  if new.conducteur_id is not null then
    select c.nom into new.conducteur
      from public.conducteurs c where c.id = new.conducteur_id;
  elsif coalesce(new.conducteur, '') <> '' then
    new.conducteur_id := public.conducteur_par_nom(new.societe_id, new.conducteur);
    if new.conducteur_id is not null then
      select c.nom into new.conducteur
        from public.conducteurs c where c.id = new.conducteur_id;
    end if;
  end if;
  return new;
end;
$fn$;

comment on function public.document_designe_son_conducteur() is
  'Tient `conducteur` d''après `conducteur_id`, et rattrape un nom écrit sans '
  'référence en lui retrouvant sa fiche.';

drop trigger if exists bons_commande_conducteur on public.bons_commande;
create trigger bons_commande_conducteur before insert or update on public.bons_commande
  for each row execute function public.document_designe_son_conducteur();

drop trigger if exists devis_conducteur on public.devis;
create trigger devis_conducteur before insert or update on public.devis
  for each row execute function public.document_designe_son_conducteur();

drop trigger if exists factures_conducteur on public.factures;
create trigger factures_conducteur before insert or update on public.factures
  for each row execute function public.document_designe_son_conducteur();

drop trigger if exists interventions_conducteur on public.interventions;
create trigger interventions_conducteur before insert or update on public.interventions
  for each row execute function public.document_designe_son_conducteur();

drop trigger if exists chantiers_conducteur on public.chantiers;
create trigger chantiers_conducteur before insert or update on public.chantiers
  for each row execute function public.document_designe_son_conducteur();

-- Sur `factures`, deux déclencheurs BEFORE UPDATE coexistent. Postgres les
-- exécute par ordre alphabétique : `factures_conducteur` pose l'étiquette,
-- puis `factures_entete_figee` juge — et il juge donc la valeur finale, ce qui
-- est le bon ordre. Renommer l'un des deux casserait cette propriété.

-- -------------------------------------------------- 5. Un renommage se propage

create or replace function public.conducteur_renomme()
returns trigger language plpgsql as $fn$
begin
  update public.bons_commande set conducteur = new.nom
    where conducteur_id = new.id and conducteur is distinct from new.nom;
  update public.devis set conducteur = new.nom
    where conducteur_id = new.id and conducteur is distinct from new.nom;
  update public.factures set conducteur = new.nom
    where conducteur_id = new.id and conducteur is distinct from new.nom;
  update public.interventions set conducteur = new.nom
    where conducteur_id = new.id and conducteur is distinct from new.nom;
  update public.chantiers set conducteur = new.nom
    where conducteur_id = new.id and conducteur is distinct from new.nom;
  return new;
end;
$fn$;

comment on function public.conducteur_renomme() is
  'Propage un changement de nom à tous les documents qui désignent cette '
  'fiche. Sans quoi renommer scinderait les statistiques de la personne.';

drop trigger if exists conducteurs_renomme on public.conducteurs;
create trigger conducteurs_renomme
  after update of nom on public.conducteurs
  for each row when (old.nom is distinct from new.nom)
  execute function public.conducteur_renomme();

-- ---------------------------------------------------------------- 6. La reprise
--
-- Chaque document qui porte un nom adopte la fiche correspondante, et reçoit
-- au passage sa graphie de référence — le déclencheur ci-dessus s'en charge,
-- puisque ces UPDATE le réveillent.

update public.bons_commande set conducteur_id = public.conducteur_par_nom(societe_id, conducteur)
  where conducteur_id is null and coalesce(conducteur, '') <> '';
update public.devis set conducteur_id = public.conducteur_par_nom(societe_id, conducteur)
  where conducteur_id is null and coalesce(conducteur, '') <> '';
update public.factures set conducteur_id = public.conducteur_par_nom(societe_id, conducteur)
  where conducteur_id is null and coalesce(conducteur, '') <> '';
update public.interventions set conducteur_id = public.conducteur_par_nom(societe_id, conducteur)
  where conducteur_id is null and coalesce(conducteur, '') <> '';
update public.chantiers set conducteur_id = public.conducteur_par_nom(societe_id, conducteur)
  where conducteur_id is null and coalesce(conducteur, '') <> '';

-- ------------------------------------------------------------ 7. La vue du bon
--
-- Les bons de commande se LISENT par cette vue, pas par leur table : ajouter la
-- colonne ne suffit pas à la rendre visible au pont.
--
-- La définition est reprise de la vue VIVANTE, jamais d'une liste écrite ici.
-- Deux migrations s'y étaient déjà cassées ; celle-ci a bien failli faire la
-- troisième — la vue de production et celle de la base locale n'ont pas le même
-- ordre de colonnes, et une définition recopiée en dur ne passait que sur l'une
-- des deux. `CREATE OR REPLACE VIEW` n'accepte qu'un ajout EN FIN : mêmes noms,
-- mêmes types, même ordre pour tout ce qui précède.

do $vue$
declare
  v_def text;
  v_corps text;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public'
                and table_name = 'v_bons_commande_terrain'
                and column_name = 'conducteur_id') then
    return;
  end if;

  select pg_get_viewdef('public.v_bons_commande_terrain'::regclass, true) into v_def;
  v_def := rtrim(btrim(v_def), ';');

  -- Le FROM de la requête principale, et lui seul : on refuse plutôt que de
  -- reconstruire une vue de travers.
  if (select count(*) from regexp_matches(v_def, '\sFROM\s+bons_commande\s+s\M', 'gi')) <> 1 then
    raise exception 'Vue v_bons_commande_terrain : le FROM attendu n''est pas unique, reprise annulée.';
  end if;

  v_corps := regexp_replace(v_def, '(\s)(FROM\s+bons_commande\s+s\M)',
                            ',' || chr(10) || '    conducteur_id\1\2', 'i');

  execute 'create or replace view public.v_bons_commande_terrain '
       || 'with (security_barrier = true) as ' || v_corps;
end
$vue$;
