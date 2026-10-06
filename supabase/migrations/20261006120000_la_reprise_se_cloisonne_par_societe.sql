-- Deux sociétés peuvent reprendre chacune leur « FAC000910 ».
--
-- Chaque société du parc vient de son propre ancien logiciel, avec sa propre
-- série : AKT Elec, KTA Plomberie et Alkia ont toutes une FAC000453, et ce ne
-- sont pas les mêmes pièces. Le numéro le sait déjà —
-- `factures_societe_numero_unique_idx` porte sur (societe_id, numero). Le
-- marqueur de reprise, lui, ne le savait pas : `factures_legacy_id_key` était
-- UNIQUE (legacy_id), hérité du temps de kv_store où l'identifiant était un
-- base36 tiré au hasard, unique de fait dans tout le parc.
--
-- La reprise y range `compta:<numéro>`. Le préfixe distingue une pièce reprise
-- d'une clé kv_store ; il ne dit rien de la société. Le 06/10/2026, 319 pièces
-- d'Alkia (FAC000910 à FAC001219) et d'AKT Elec (FAC000453 à FAC000461) ont
-- été refusées à l'en-tête parce que KTA Plomberie avait repris les mêmes
-- numéros le 28/09 — et l'aperçu ne l'avait pas vu venir, puisqu'il cherche
-- les collisions dans la société active, comme le numéro.
--
-- L'unicité devient donc (societe_id, legacy_id), comme celle du numéro. Ce
-- n'est pas un relâchement : dans une même société, la même pièce reste
-- refusée deux fois. Et c'est la clé que `upsertByLegacyId` vise déjà
-- (`onConflict: "societe_id,legacy_id"`).
--
-- Rien ne dépend de l'ancienne contrainte : aucune clé étrangère ne pointe
-- vers `factures.legacy_id`, aucune fonction ni vue ne compte sur elle
-- (vérifié sur la base vivante le 06/10/2026). Les 6 800 lignes actuelles sont
-- uniques globalement, donc a fortiori par société : la nouvelle contrainte se
-- pose sans rien rejeter.
--
-- Les autres tables gardent leur `legacy_id` global : seules les factures
-- reçoivent un identifiant venu d'une série propre à chaque société.

alter table public.factures
  drop constraint if exists factures_legacy_id_key;

alter table public.factures
  add constraint factures_societe_legacy_id_key unique (societe_id, legacy_id);

comment on constraint factures_societe_legacy_id_key on public.factures is
  'Une pièce reprise ne s''écrit qu''une fois par société. Par société et non '
  'globalement : chaque société reprend sa propre série, et deux d''entre elles '
  'peuvent avoir chacune leur FAC000453.';
