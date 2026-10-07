-- PROPOSITION — non appliquée en production (DEF-REP-16, D-REP-16 ; relecture 3, M1).
--
-- Un bon de commande (comme un devis) acceptait un `client_id` ou un
-- `conducteur_id` d'une AUTRE société : la RLS contrôle la ligne écrite
-- (`societe_id`), pas les fiches qu'elle désigne. Les écrans ne proposent que les
-- fiches de la société ; l'API, elle, laissait passer — et la facture née du bon
-- aurait repris l'adresse et le délai de paiement d'un client d'autrui.
--
-- Correction : un déclencheur BEFORE INSERT / UPDATE refuse (23514) une fiche
-- client ou conducteur qui n'est pas de la société de la ligne. SECURITY DEFINER
-- pour juger sur la fiche elle-même, que la RLS de l'appelant pourrait cacher
-- (un client invisible n'est pas pour autant de la même société) ; EXECUTE retiré
-- à tous (règle du n° 27 : un déclencheur n'est pas une API).
--
-- Les lignes existantes ne sont PAS touchées : l'essai à blanc les compte
-- (docs/migrations-proposees.md) — à corriger à la main avant, sinon leur
-- prochaine modification sera refusée.
--
-- Idempotent. Validé par tests/rls/corrections-reproduites.essai.ts
-- (« [proposition] un document reste dans sa société »), écrit, non lancé.

create or replace function public.document_reste_dans_sa_societe()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if new.client_id is not null
     and not exists (select 1 from public.clients c where c.id = new.client_id and c.societe_id = new.societe_id) then
    raise exception 'Ce client n''appartient pas à la société du document.' using errcode = '23514';
  end if;
  if new.conducteur_id is not null
     and not exists (select 1 from public.conducteurs k where k.id = new.conducteur_id and k.societe_id = new.societe_id) then
    raise exception 'Ce conducteur n''appartient pas à la société du document.' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

comment on function public.document_reste_dans_sa_societe() is
  'Refuse un client ou un conducteur d''une autre société sur un bon ou un devis (DEF-REP-16).';

revoke all on function public.document_reste_dans_sa_societe() from public, anon, authenticated;

drop trigger if exists bons_commande_reste_dans_sa_societe on public.bons_commande;
create trigger bons_commande_reste_dans_sa_societe
  before insert or update of client_id, conducteur_id, societe_id on public.bons_commande
  for each row execute function public.document_reste_dans_sa_societe();

drop trigger if exists devis_reste_dans_sa_societe on public.devis;
create trigger devis_reste_dans_sa_societe
  before insert or update of client_id, conducteur_id, societe_id on public.devis
  for each row execute function public.document_reste_dans_sa_societe();
