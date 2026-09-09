-- URGENT — `kv_store` est accessible en lecture, écriture et suppression sans
-- authentification.
--
-- Constat du 2026-09-07, reproduit avec la seule clé anon (publique par
-- conception, livrée dans le bundle navigateur) :
--
--   GET    /rest/v1/kv_store  -> 200, 116 enregistrements réels
--   POST   /rest/v1/kv_store  -> 201, insertion acceptée
--   DELETE /rest/v1/kv_store  -> 204, suppression acceptée
--
-- Les données lisibles comprennent le nom des clients, les adresses
-- d'intervention, les montants des devis et factures. Quiconque connaît l'URL
-- de l'application peut donc tout lire, modifier, ou tout effacer.
--
-- Les 76 autres tables sont correctement protégées : seule celle-ci l'a été
-- oubliée, sans doute parce qu'elle précède la modélisation relationnelle.
--
-- Aucune des deux applications ne la lit plus : ERP-Chantier passe par les
-- tables relationnelles depuis la refonte du pont, chantier-mate-ease depuis
-- `db.ts`. Activer la RLS sans y attacher de politique la ferme donc
-- complètement, sans rien casser.

alter table public.kv_store enable row level security;

-- Pas de politique : aucun rôle applicatif n'y accède plus. Le `service_role`
-- contourne la RLS et garde la main pour une éventuelle reprise de données.

-- Une fois la migration des 116 enregistrements confirmée et sauvegardée,
-- la table pourra être supprimée :
--   drop table public.kv_store;
