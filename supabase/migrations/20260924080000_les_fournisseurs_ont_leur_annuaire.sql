-- Les fournisseurs deviennent un annuaire, au lieu d'un nom retapé.
--
-- Ils étaient partout du texte libre : `chantier_achats.fournisseur`,
-- `planning_taches.piece_fournisseur`. L'écran des pièces commandées les
-- regroupe même PAR NOM — deux graphies du même fournisseur y font deux
-- dossiers, et rien ne permet de les rapprocher.
--
-- Une liste de noms n'aurait pas suffi : un fournisseur a un téléphone qu'on
-- appelle pour relancer une commande, un contact, une adresse. C'est une
-- entité, pas une case à cocher — d'où une table, et non un domaine de plus
-- dans `referentiels`.
--
-- À NE PAS CONFONDRE avec `fournisseurs_controle`, qui porte le même mot :
-- celle-là appartient à la comparaison de prix par lot
-- (`fournisseur_controle_lignes`), n'a qu'un `nom`, aucun écran, et 0 ligne en
-- local comme en production. Elle est laissée intacte : elle sert une autre
-- fonction, même dormante. Si elle devait disparaître, ce serait une décision
-- à part.
--
-- RLS recopiée de `sous_traitants`, l'entité la plus proche — un tiers avec
-- lequel on travaille, cloisonné par société.

create table if not exists public.fournisseurs (
  id           uuid primary key default gen_random_uuid(),
  societe_id   uuid not null references public.societes(id) on delete cascade,
  nom          text not null,
  specialite   text,
  contact_nom  text,
  telephone    text,
  email        text,
  adresse      text,
  code_postal  text,
  ville        text,
  siret        text,
  notes        text,
  actif        boolean not null default true,
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);

comment on table public.fournisseurs is
  'Annuaire des fournisseurs : pièces, matériaux, location. À ne pas confondre '
  'avec `fournisseurs_controle`, qui sert la comparaison de prix par lot.';
comment on column public.fournisseurs.actif is
  'Sorti des listes sans être supprimé : des commandes passées le désignent '
  'par son nom, et l''effacer les laisserait orphelines.';
comment on column public.fournisseurs.specialite is
  'Ce qu''on lui achète — plomberie, peinture, outillage. Sert à le retrouver '
  'quand la liste s''allonge.';

-- Deux fiches pour un même fournisseur rendraient le regroupement des pièces
-- commandées faux — c'est précisément ce qu'on vient corriger.
create unique index if not exists fournisseurs_un_nom_par_societe
  on public.fournisseurs (societe_id, nom);

create index if not exists fournisseurs_actifs
  on public.fournisseurs (societe_id, actif);

create trigger trg_fournisseurs_maj
  before update on public.fournisseurs
  for each row execute function public.set_maj_le();

alter table public.fournisseurs enable row level security;

drop policy if exists fournisseurs_select on public.fournisseurs;
create policy fournisseurs_select on public.fournisseurs
  for select using (public.est_membre(societe_id));

drop policy if exists fournisseurs_insert on public.fournisseurs;
create policy fournisseurs_insert on public.fournisseurs
  for insert with check (public.peut_ecrire(societe_id));

drop policy if exists fournisseurs_update on public.fournisseurs;
create policy fournisseurs_update on public.fournisseurs
  for update using (public.peut_ecrire(societe_id))
  with check (public.peut_ecrire(societe_id));

drop policy if exists fournisseurs_delete on public.fournisseurs;
create policy fournisseurs_delete on public.fournisseurs
  for delete using (public.peut_ecrire(societe_id));

-- ──────────────────────────────────────────────────────────────────────────
-- Reprise : les noms déjà saisis deviennent des fiches
-- ──────────────────────────────────────────────────────────────────────────
-- Sans cela, l'annuaire naîtrait vide devant des commandes qui nomment déjà
-- des fournisseurs, et il faudrait les ressaisir à la main. Rien n'est écrasé :
-- on ne pose que ce qui manque, et le nom reste le lien — les commandes
-- passées continuent de fonctionner sans être réécrites.

insert into public.fournisseurs (societe_id, nom)
select distinct b.societe_id, trim(t.piece_fournisseur)
  from public.planning_taches t
  join public.bons_commande b on b.id = t.bon_commande_id
 where coalesce(trim(t.piece_fournisseur), '') <> ''
on conflict (societe_id, nom) do nothing;

insert into public.fournisseurs (societe_id, nom)
select distinct c.societe_id, trim(a.fournisseur)
  from public.chantier_achats a
  join public.chantiers c on c.id = a.chantier_id
 where coalesce(trim(a.fournisseur), '') <> ''
on conflict (societe_id, nom) do nothing;

-- Le domaine `fournisseur_piece` du référentiel n'a plus lieu d'être : une
-- liste de noms ne dit ni le téléphone ni le contact. Posé la veille, il n'a
-- jamais servi — aucune entrée n'a été créée.
--
-- Le garde `to_regclass` n'est pas du zèle : joué seul sur une base où
-- `referentiels` n'existe pas encore — c'est le cas de la production tant que
-- `20260923200000` n'y est pas passée —, ce `delete` faisait échouer la
-- migration entière sur un 42P01. L'ordre des migrations le garantirait, mais
-- une migration ne devrait pas dépendre de l'ordre pour ne pas exploser.
do $$
begin
  if to_regclass('public.referentiels') is not null then
    delete from public.referentiels where domaine = 'fournisseur_piece';
  end if;
end $$;
