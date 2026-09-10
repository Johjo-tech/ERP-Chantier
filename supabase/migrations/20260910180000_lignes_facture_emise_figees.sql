-- Les lignes d'une facture émise ne bougent plus.
--
-- Ce matin, le numéro d'une facture est devenu définitif et la facture
-- numérotée insupprimable. Une sonde manuelle a montré que cela ne protégeait
-- que la référence, pas le montant :
--
--   FAC-2026-0006, ligne à 2 340,00 €
--     → PATCH par un compte « technicien »  → 1,00 €
--   FAC-2026-0500, facture émise à 5 000 € HT
--     → DELETE de sa ligne par le même compte → HTTP 204, total 0,00 €
--
-- La facture restait numérotée, datée, et ne valait plus rien. Deux gardes
-- trop larges le permettaient : `peut_ecrire` pour l'UPDATE — qui inclut le
-- technicien — et `est_membre` pour le DELETE, c'est-à-dire n'importe quel
-- membre de la société, un compte en lecture seule compris.
--
-- Resserrer les rôles ne suffirait pas : une facture émise ne se corrige pas,
-- **même par un administrateur**. C'est la règle comptable, et c'est celle
-- qu'on pose ici. Une erreur se rattrape par un avoir.

create or replace function public.lignes_facture_emise_figees()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_facture_id uuid := coalesce(new.facture_id, old.facture_id);
  v_numero     text;
  v_nb_lignes  integer;
begin
  select numero into v_numero from factures where id = v_facture_id;

  -- Une facture sans numéro est un brouillon : elle se compose librement.
  if coalesce(v_numero, '') = '' then
    return coalesce(new, old);
  end if;

  /* L'insertion reste possible tant que la facture n'a aucune ligne : c'est
     le cas de la création en un geste, où l'en-tête est écrit puis numéroté
     avant que ses lignes ne suivent. Dès qu'elle en porte une, la facture est
     composée — y ajouter reviendrait à la gonfler après émission. */
  if tg_op = 'INSERT' then
    select count(*) into v_nb_lignes from facture_lignes where facture_id = v_facture_id;
    if v_nb_lignes = 0 then
      return new;
    end if;
    raise exception 'La facture % est émise : on ne peut plus lui ajouter de ligne. Une correction passe par un avoir.', v_numero
      using errcode = 'restrict_violation';
  end if;

  raise exception 'La facture % est émise : ses lignes ne peuvent plus être %. Une correction passe par un avoir.',
    v_numero, case tg_op when 'DELETE' then 'supprimées' else 'modifiées' end
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.lignes_facture_emise_figees() is
  'Fige le contenu d''une facture numérotée. Protéger le numéro sans protéger le montant ne protège rien.';

create trigger facture_lignes_figees
  before insert or update or delete on public.facture_lignes
  for each row
  execute function public.lignes_facture_emise_figees();

-- Le devis et le bon de commande ne sont pas des pièces comptables : leurs
-- lignes restent modifiables. Leurs gardes de rôle sont trop larges elles
-- aussi, mais c'est une question de qui, pas de quand — elle se traite avec
-- la matrice des rôles, pas ici.
