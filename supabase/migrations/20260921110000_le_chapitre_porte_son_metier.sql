-- Le chapitre d'un document porte le métier qu'il désigne.
--
-- Le métier est déjà écrit dans le titre — « PEINTURE TOUT LE LOGEMENT »,
-- « SOL CHAMBRE 1 » — et `regles-metiers.metierDuChapitre` le lit déjà. Mais
-- cette lecture ne se corrige pas : un chapitre « SALLE DE BAIN » ne désigne
-- aucun métier connu, et rien ne permettait de dire que c'est de la plomberie.
-- Or le métier découpe le planning : une tâche vaut bon × métier × jour.
--
-- Convention de la colonne, tenue par `regles-metiers.metierDeLaLigne` :
--
--   NULL      le métier se lit sur le titre — c'est l'état par défaut
--   un nom    quelqu'un a tranché ; ce choix l'emporte sur le titre
--   (aucun)   ce chapitre ne désigne aucun métier, et c'est délibéré
--
-- La sentinelle « (aucun) » n'est pas une coquetterie. `enfantsIdentiques`
-- compare les lignes sur `String(valeur ?? "")`, où NULL et la chaîne vide
-- sont le même texte : un refus écrit '' ne serait jamais enregistré s'il est
-- la seule modification du document. Et on ne peut pas durcir cette
-- comparaison — `commentaire` part `undefined` là où la base porte '', on
-- ferait paraître modifiée chaque ligne de chaque document, donc un
-- delete+insert que `facture_lignes_figees` refuse.

alter table public.devis_lignes
  add column if not exists metier text;
alter table public.bon_commande_lignes
  add column if not exists metier text;
-- `facture_lignes` suit par nécessité, pas par symétrie : le pont insère les
-- lignes sans les filtrer par `colonnesDe()`, donc dès que `ligneVersDb` émet
-- `metier`, une table qui n'a pas la colonne rend tout enregistrement
-- impossible. Et le cas est réel : `transformerEnFacture` recopie les lignes
-- du devis, métier compris.
alter table public.facture_lignes
  add column if not exists metier text;

comment on column public.devis_lignes.metier is
  'Le métier du chapitre, quand il a été choisi. NULL : il se lit sur le titre. '
  '« (aucun) » : ce chapitre ne désigne aucun métier, délibérément. '
  'Voir regles-metiers.metierDeLaLigne.';
comment on column public.bon_commande_lignes.metier is
  'Le métier du chapitre, quand il a été choisi. NULL : il se lit sur le titre. '
  'Gouverne le découpage des tâches — une tâche vaut bon × métier × jour.';
comment on column public.facture_lignes.metier is
  'Le métier du chapitre, hérité du devis ou du bon dont la facture est née.';

-- Aucun UPDATE de rattrapage, et c'est délibéré.
--
-- Matérialiser ici la déduction d'aujourd'hui figerait le référentiel du jour
-- dans les données, alors qu'il grandit à mesure que les bons emploient des
-- métiers non déclarés. Surtout, les 830 bons existants paraîtraient modifiés
-- à leur prochain enregistrement : `enfantsIdentiques` verrait un `metier` là
-- où l'écran n'en envoie pas, d'où un delete+insert de toutes leurs lignes.
-- La déduction reste vivante à la lecture ; la colonne ne garde que les choix.

-- ---------------------------------------------------------------------------
-- La vue du terrain doit reconnaître les colonnes neuves
-- ---------------------------------------------------------------------------

-- Les lignes de bon se lisent par `v_bon_commande_lignes_terrain`, jamais par
-- leur table : ajouter une colonne ne la rend donc pas lisible. La vue est
-- régénérée depuis le catalogue, comme à sa création — jamais depuis une liste
-- écrite à la main, qui aurait vieilli entre-temps.
--
-- Elle a d'ailleurs vieilli : `montant_ht`, ajoutée par
-- 20260916120000_chaque_ligne_porte_son_total.sql, n'y a jamais été reportée.
-- La régénération la fera donc entrer en même temps que `metier` — et c'est un
-- prix. Sans précaution, cette migration ouvrirait au terrain les montants que
-- 20260910230000 masque délibérément. `montant_ht` rejoint donc `prix_unitaire`
-- derrière `voit_les_prix()`. `metier` reste en clair : un nom de métier n'est
-- pas un montant.
do $$
declare
  v_vue       constant text := 'v_bon_commande_lignes_terrain';
  v_source    constant text := 'bon_commande_lignes';
  v_masquees  constant text[] := array['prix_unitaire', 'montant_ht'];
  v_actuelles text[];
  v_attendues text[];
  v_colonnes  text;
begin
  select array_agg(column_name order by ordinal_position) into v_actuelles
    from information_schema.columns
   where table_schema = 'public' and table_name = v_vue;

  select array_agg(column_name order by ordinal_position) into v_attendues
    from information_schema.columns
   where table_schema = 'public' and table_name = v_source;

  /* `create or replace view` n'accepte que des ajouts EN FIN : mêmes noms,
     mêmes types, même ordre pour les colonnes déjà là. On le contrôle ici pour
     dire LAQUELLE diverge — le refus de Postgres, lui, ne nomme rien, et deux
     migrations s'y sont déjà cassées sans qu'on sache où regarder. */
  if v_actuelles is distinct from v_attendues[1:array_length(v_actuelles, 1)] then
    raise exception
      '% ne préfixe plus %. Vue : %. Table (début) : %.',
      v_vue, v_source, v_actuelles, v_attendues[1:array_length(v_actuelles, 1)];
  end if;

  select string_agg(
           case when c.column_name = any (v_masquees)
                then format(
                  'case when voit_les_prix((select p.societe_id from bons_commande p'
                  || ' where p.id = s.bon_commande_id)) then s.%I end as %I',
                  c.column_name, c.column_name)
                else format('s.%I', c.column_name) end,
           ', ' order by c.ordinal_position)
    into v_colonnes
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = v_source;

  execute format(
    'create or replace view public.%I with (security_barrier) as'
    || ' select %s from public.%I s'
    || ' where exists (select 1 from bons_commande p'
    || ' where p.id = s.bon_commande_id and est_membre(p.societe_id))',
    v_vue, v_colonnes, v_source);

  execute format('grant select on public.%I to authenticated', v_vue);
end $$;

comment on view public.v_bon_commande_lignes_terrain is
  'Les lignes d''un bon sans aucun prix pour le terrain : ni prix unitaire, ni montant. '
  'Le métier du chapitre, lui, est visible — il dit quoi faire, pas ce que ça vaut.';
