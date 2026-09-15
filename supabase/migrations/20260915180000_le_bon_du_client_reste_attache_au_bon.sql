-- Le document reçu du client reste attaché au bon de commande.
--
-- Le formulaire portait déjà un champ « Pièce jointe (bon de commande scanné) »
-- et la lecture automatique recevait le PDF — mais `bons_commande` n'avait pas
-- de colonne pour eux. `versDb` écarte tout champ sans colonne : le document
-- s'affichait le temps de la saisie, puis disparaissait au rechargement.
--
-- Le fichier va dans le bucket « terrain », pas en base64 dans la ligne : c'est
-- l'arbitrage déjà rendu pour `technicienPhotos`. Seul le chemin est stocké.
--
-- Le mime est conservé plutôt que déduit : les copieurs déposent des fichiers
-- sans extension, et un aperçu qui ne sait pas s'il faut une image ou un PDF
-- retombe sur « aperçu non disponible ».

alter table public.bons_commande
  add column if not exists piece_jointe_chemin text,
  add column if not exists piece_jointe_nom    text,
  add column if not exists piece_jointe_mime   text;

comment on column public.bons_commande.piece_jointe_chemin is
  'Chemin dans le bucket « terrain » du bon tel que le client l''a envoyé — '
  'le document déposé pour lecture automatique, conservé au lieu d''être relâché.';
comment on column public.bons_commande.piece_jointe_nom is
  'Nom d''origine du fichier, pour l''afficher et le retélécharger tel quel.';
comment on column public.bons_commande.piece_jointe_mime is
  'Type du document reçu. Les copieurs déposent des fichiers sans extension : '
  'sans lui, l''aperçu ne sait pas s''il faut une image ou un PDF.';

-- La vue du terrain doit rendre les nouvelles colonnes, sans quoi l'écriture
-- fonctionne et la lecture rend `null` — un silence indistinguable d'une panne.
--
-- Elle est reconstruite depuis `information_schema` plutôt qu'énumérée à la
-- main. Recopier quarante colonnes est le mécanisme qui a déjà coûté deux
-- oublis ; ce bloc est celui du catalogue des vues du terrain
-- (`20260910230000_le_terrain_ne_voit_aucun_prix.sql`), réduit à la seule vue
-- qui change ici. Les colonnes ajoutées arrivent en fin de table, donc en fin
-- de vue : `create or replace view`, qui refuse tout réordonnancement des
-- colonnes existantes, l'accepte.
do $$
declare
  v_colonnes text;
  v_masquees text[] := array['montant','montant_par_metier','montant_sous_traitant'];
begin
  select string_agg(
           case when c.column_name = any (v_masquees)
                then format('case when voit_les_prix(s.societe_id) then s.%I end as %I',
                            c.column_name, c.column_name)
                else format('s.%I', c.column_name) end,
           ', ' order by c.ordinal_position)
    into v_colonnes
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'bons_commande';

  execute format(
    'create or replace view public.v_bons_commande_terrain with (security_barrier) as '
    'select %s from public.bons_commande s where est_membre(s.societe_id)', v_colonnes);

  execute 'grant select on public.v_bons_commande_terrain to authenticated';
end $$;
