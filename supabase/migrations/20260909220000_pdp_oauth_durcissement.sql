-- Durcissement OAuth 2.1 pour la plateforme de dématérialisation.
--
-- Le schéma PDP existe depuis l'origine mais aucun code ne s'en sert : ces
-- tables n'ont jamais porté une ligne. Avant de brancher les fonctions, il leur
-- manque de quoi tenir trois situations que la norme OAuth 2.1 impose.
--
-- 1. **La rotation du jeton de rafraîchissement.** Chaque usage invalide le
--    jeton précédent. Deux rafraîchissements concurrents détruisent donc la
--    connexion : le second présente un jeton déjà consommé, la plateforme le
--    rejette, et la société doit tout reconnecter. On sérialise par un bail,
--    pris en `update` conditionnel — atomique, sans verrou applicatif.
--
-- 2. **La délégation morte.** Un `invalid_grant` n'est pas une panne passagère :
--    la société doit se reconnecter. L'état le dit, au lieu d'échouer en
--    silence à chaque tentative.
--
-- 3. **Les états OAuth non consommés.** Ils portent déjà une expiration à
--    quinze minutes ; il leur manquait le ménage.

alter table public.pdp_connexion_secrets
  add column if not exists bail_refresh timestamptz,
  add column if not exists dernier_refresh_le timestamptz;

comment on column public.pdp_connexion_secrets.bail_refresh is
  'Jusqu''à quand une invocation détient le droit de rafraîchir. Les autres attendent puis relisent.';

-- Les états de connaissance de l'application. `non_connecte` existait déjà
-- comme défaut ; les deux autres sont ce que le circuit produit réellement.
do $$ begin
  alter table public.pdp_connexions
    add constraint pdp_connexions_etat_check
    check (etat in ('non_connecte', 'connecte', 'reconnexion_requise'));
exception when duplicate_object then null; end $$;

-- Bac à sable ou production : les jetons d'un environnement ne valent rien dans
-- l'autre, et le rafraîchissement doit repasser par les identifiants qui les
-- ont émis. La colonne le retient plutôt que de le déduire.
alter table public.pdp_connexions
  add column if not exists environnement text not null default 'sandbox';

do $$ begin
  alter table public.pdp_connexions
    add constraint pdp_connexions_environnement_check
    check (environnement in ('sandbox', 'production'));
exception when duplicate_object then null; end $$;

-- Un état OAuth non consommé ne sert plus à rien passé son délai : le garder
-- n'offre qu'une surface d'attaque supplémentaire.
delete from public.pdp_oauth_etats where expire_le < now() - interval '1 day';

/* Ce que le retour d'autorisation doit retrouver.

   `code_verifier` : PKCE. Le vérifieur reste chez nous, seule son empreinte
   part à l'autorisation — c'est ce qui empêche qu'un code intercepté serve à
   quelqu'un d'autre.

   `environnement` : l'état mémorise l'environnement de départ. Le retour
   échange le code avec le secret de la MÊME application, même si la société a
   changé d'environnement entre-temps. */
alter table public.pdp_oauth_etats
  add column if not exists code_verifier text,
  add column if not exists environnement text not null default 'sandbox',
  add column if not exists retour_url text;

create index if not exists pdp_oauth_etats_etat_idx on public.pdp_oauth_etats (etat);
create index if not exists pdp_connexions_societe_idx on public.pdp_connexions (societe_id);

-- ---------------------------------------------------------------------------
-- Les jetons ne se lisent jamais depuis l'application.
--
-- `pdp_connexion_secrets` porte des jetons d'accès : la RLS n'y donne aucune
-- politique, donc aucun rôle applicatif n'y accède. Seul le `service_role`, qui
-- la contourne, les manipule — c'est-à-dire les seules fonctions edge.
-- L'application lit l'état de la connexion dans `pdp_connexions`, jamais le
-- secret lui-même.

alter table public.pdp_connexion_secrets enable row level security;

comment on table public.pdp_connexion_secrets is
  'Jetons OAuth. Aucune politique RLS : hors de portée de l''application, réservé au service_role.';
