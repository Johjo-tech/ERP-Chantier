-- Le devis relu depuis son PDF garde le PDF.
--
-- Même arbitrage que pour le bon de commande le 15/09
-- (`20260915180000_le_bon_du_client_reste_attache_au_bon.sql`) : le fichier va
-- dans le bucket privé « terrain », jamais en base64 dans la ligne, et seul son
-- chemin est stocké. Sans ces colonnes, `versDb` écarterait les champs avec un
-- simple avertissement de console (`html-adapter.ts`) : le document s'afficherait
-- le temps de la saisie, puis disparaîtrait au rechargement — sans un mot.
--
-- Le MIME est conservé plutôt que déduit. Un bucket privé se lit par URL signée,
-- et une URL signée ne porte pas son type : `apercuDe` retomberait sur « aperçu
-- non disponible » sur un PDF parfaitement lisible.
--
-- AUCUNE VUE À RECONSTRUIRE, contrairement au bon de commande : `devis` n'a pas
-- de vue de lecture, et `v_devis_totaux` énumère ses colonnes une à une avec un
-- GROUP BY explicite — trois colonnes de plus sur la table ne la traversent pas.
--
-- AUCUNE POLICY STORAGE À TOUCHER : les quatre policies du bucket « terrain »
-- (`20260915180100_le_stockage_terrain_et_la_reference_client.sql`) ne lisent que
-- `split_part(name, '/', 1)`, c'est-à-dire la SOCIÉTÉ. Le domaine est le deuxième
-- segment et n'est jamais inspecté : `<societeId>/devis/<devisId>/…` passe tel
-- quel, sous le même cloisonnement que les bons.

alter table public.devis
  add column if not exists piece_jointe_chemin text,
  add column if not exists piece_jointe_nom    text,
  add column if not exists piece_jointe_mime   text;

comment on column public.devis.piece_jointe_chemin is
  'Chemin dans le bucket « terrain » du devis d''origine : le PDF de l''ancien logiciel, déposé pour lecture automatique et conservé au lieu d''être relâché.';
comment on column public.devis.piece_jointe_nom is
  'Nom d''origine du fichier, pour l''afficher et le retélécharger tel quel.';
comment on column public.devis.piece_jointe_mime is
  'Type du document. Une URL signée ne porte pas son type : sans lui, l''aperçu ne sait pas s''il faut une image ou un PDF.';
