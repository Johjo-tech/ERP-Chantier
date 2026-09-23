-- Un véhicule se reconnaît à sa plaque, pas à un nom retapé à la main.
--
-- Le formulaire demandait un « Nom du véhicule », OBLIGATOIRE, avec pour
-- exemple « Renault Trafic ». C'est ce nom qui servait de titre partout : la
-- liste, la fiche, la facture de vente.
--
-- Or la table porte déjà `marque` et `modele` — et le formulaire ne les
-- demandait NULLE PART. On invitait donc à réécrire à la main ce que le schéma
-- savait déjà ranger, dans un champ dont le nom ne disait pas ce qu'il
-- contenait. Deux Trafic blancs y portaient le même « nom » sans que rien ne
-- les distingue.
--
-- L'immatriculation fait foi désormais : c'est l'identifiant de la carte
-- grise, celui des factures de garage et des contrats d'assurance, et deux
-- véhicules ne peuvent pas le partager.
--
-- `nom` DEVIENT FACULTATIF, il n'est pas supprimé. Les véhicules déjà saisis
-- le portent, et l'effacer perdrait ce que quelqu'un a écrit — parfois un
-- surnom utile, « Camion 3 ». Le formulaire cesse de le demander ; la colonne
-- garde ce qu'elle a.
--
-- RLS : rien à écrire, `vehicules` est déjà cloisonnée par `societe_id` et
-- aucune colonne n'est ajoutée.

alter table public.vehicules
  alter column nom drop not null;

comment on column public.vehicules.nom is
  'Étiquette libre, facultative depuis le 23/09/2026 — un surnom d''usage. '
  'L''identité du véhicule est son immatriculation ; sa description, '
  'marque + modele. Le formulaire ne demande plus ce champ.';

-- ──────────────────────────────────────────────────────────────────────────
-- Deux véhicules ne partagent pas une plaque
-- ──────────────────────────────────────────────────────────────────────────
-- Le contrôle AVANT l'index : créer l'index sur des données en double échoue
-- sur un message de Postgres qui nomme la clé, pas le problème. Mieux vaut
-- dire ce qu'il faut faire. Fusionner deux fiches est un arbitrage — laquelle
-- garder, avec quel kilométrage, quels entretiens — pas une reprise
-- automatique.

do $$
declare v_doublons text;
begin
  select string_agg(format('%s (%s fois)', immatriculation, n), ', ')
    into v_doublons
    from (
      select immatriculation, count(*) as n
        from public.vehicules
       where coalesce(immatriculation, '') <> ''
       group by societe_id, immatriculation
      having count(*) > 1
    ) d;

  if v_doublons is not null then
    raise exception
      'Des véhicules partagent une immatriculation (%). Fusionnez les fiches à '
      'la main — garder l''une, reporter ses entretiens, supprimer l''autre — '
      'puis rejouez cette migration.', v_doublons
      using errcode = 'data_exception';
  end if;
end $$;

-- Partielle : une fiche sans plaque reste possible — un engin de chantier non
-- immatriculé, une remorque — et plusieurs peuvent l'être sans se gêner.
create unique index if not exists vehicules_une_plaque_par_societe
  on public.vehicules (societe_id, immatriculation)
  where coalesce(immatriculation, '') <> '';
