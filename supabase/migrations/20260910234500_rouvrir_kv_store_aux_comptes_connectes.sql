-- `kv_store` redevient lisible et modifiable — par un compte connecté.
--
-- La table héritée avait été fermée le 8 septembre : avec la seule clé
-- anonyme — publique par conception, livrée dans le bundle du navigateur, et
-- le dépôt étant public — elle répondait en lecture, en insertion et en
-- suppression sur 116 lignes réelles : clients, adresses d'intervention,
-- montants de devis et de factures, une fiche salarié.
--
-- Un autre outil s'y connecte encore. Le fermer entièrement l'a donc privé de
-- sa source, ce que le verrouillage n'avait pas anticipé : il ne restait plus
-- que `service_role`, qui contourne la RLS.
--
-- On rouvre donc, mais un cran plus haut : **il faut être connecté**. La
-- différence est tout sauf théorique — la clé anonyme est publique, un compte
-- ne l'est pas. Un outil qui a besoin de cette table a besoin d'une identité,
-- pas d'une porte ouverte.
--
-- Pas de cloisonnement par société ici : `kv_store` n'a pas de colonne pour
-- ça, la société vit dans le JSON. Les deux comptes existants sont
-- administrateurs des quatre sociétés — le filtrer n'ajouterait rien
-- aujourd'hui, et prétendrait une protection qui n'existe pas.

grant select, insert, update, delete on table public.kv_store to authenticated;

drop policy if exists kv_store_membre on public.kv_store;
create policy kv_store_membre on public.kv_store
  for all to authenticated
  using (true)
  with check (true);

comment on table public.kv_store is
  'Table héritée, plus alimentée par l''application depuis le 04/09/2026 : elle est une photo, pas une source. Ouverte aux comptes connectés pour l''outil qui s''y branche encore. Jamais à `anon` — la clé anonyme est publique.';
