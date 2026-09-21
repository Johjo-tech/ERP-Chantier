-- Refermer `kv_store` à l'anonyme.
--
-- La table précède la modélisation relationnelle. Elle a été fermée le
-- 2026-09-09 par activation de la RLS sans politique, puis ROUVERTE le
-- 2026-09-10, délibérément : « un outil externe s'y branche et personne ne sait
-- encore avec quelle clé ». La politique posée alors est aussi large qu'on peut
-- l'être —
--
--     kv_store_ouverte | FOR ALL | {authenticated, anon} | using: true
--
-- — c'est-à-dire lecture, écriture ET SUPPRESSION, sans être connecté, sur des
-- données de clients réels. La clé anonyme voyage dans le paquet servi au
-- navigateur : elle est publique par construction.
--
-- Ce qui a tranché, le 2026-09-21 : on a cherché qui écrivait encore. Les
-- écritures récentes portent les formes de l'ancien magasin — `bonCommande:`,
-- `facture:`, `devis:`, `interlocuteur:` — et SEPT d'entre elles sont des
-- factures réelles d'ALPES ISERE HABITAT, numérotées FAC-2026-0007 à 0013, qui
-- n'existent dans AUCUNE table relationnelle. La série des factures passe de
-- 0006 à 0021 : ces sept numéros sont le trou.
--
-- Ce n'est donc pas un outil externe qu'on protégeait, c'est un repli hérité de
-- l'écran qui écrit là où personne ne regarde — et il exposait des pièces
-- comptables à la suppression par n'importe qui.
--
-- Les DONNÉES sont conservées : ces sept factures sont la seule trace de pièces
-- émises, et les effacer les perdrait pour de bon. Seul l'accès se referme.
-- Leur rapatriement dans `factures` est un chantier à part.

drop policy if exists kv_store_ouverte on public.kv_store;

-- La RLS reste activée, sans aucune politique : ni `anon` ni `authenticated` ne
-- passent. Seuls `postgres` et `service_role` voient encore la table — ce qu'il
-- faut pour rapatrier les sept factures le jour venu.
revoke all on table public.kv_store from anon;
revoke all on table public.kv_store from authenticated;

comment on table public.kv_store is
  'Ancien magasin clé-valeur, antérieur au relationnel. FERMÉ le 2026-09-21 : plus aucune politique RLS, droits retirés à anon et authenticated. Contient encore sept factures réelles (FAC-2026-0007 à 0013) absentes du relationnel — à rapatrier avant toute suppression.';
