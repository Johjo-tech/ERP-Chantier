-- La retenue de garantie, sur la facture.
--
-- Loi du 16 juillet 1971 : le marché peut retenir une part du règlement en
-- garantie des travaux. Le comptable l'a réclamée parmi les mentions à porter.
--
-- Cette colonne a été posée directement sur la production le 16/09/2026, sans
-- fichier — elle n'existait donc nulle part ailleurs, et la pile locale
-- refusait tout enregistrement de facture avec un PGRST204 sur ce nom. Ce
-- fichier rattrape l'oubli ; il est sans effet sur la production, où la
-- colonne est déjà là.
alter table public.factures
  add column if not exists retenue_garantie_pourcentage numeric;

do $$ begin
  alter table public.factures
    add constraint factures_retenue_garantie_bornee
    check (retenue_garantie_pourcentage is null
           or (retenue_garantie_pourcentage >= 0 and retenue_garantie_pourcentage <= 100));
exception when duplicate_object then null; end $$;

comment on column public.factures.retenue_garantie_pourcentage is
  'Part du TTC retenue au titre de la garantie, quand le marché la prévoit. '
  'NULL ou 0 = pas de retenue. Le montant se recalcule, il ne se stocke pas : '
  'le figer le ferait diverger du TTC à la moindre correction de ligne.';
