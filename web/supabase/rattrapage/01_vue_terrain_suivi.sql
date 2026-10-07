-- La migration 20260915100000 recrée v_bons_commande_terrain d'après la
-- définition de production DU MOMENT ; rejouée après 20260917 (conducteur_id),
-- elle ne s'applique plus. On ajoute donc EN FIN, sur la définition vivante,
-- les six colonnes de suivi qu'elle apportait — la seule forme que
-- CREATE OR REPLACE VIEW accepte. Base locale uniquement.
do $$
declare
  def text := pg_get_viewdef('public.v_bons_commande_terrain');
begin
  if def like '%tentatives_contact%' then return; end if;
  def := regexp_replace(def, '\s+FROM bons_commande s',
    ', s.date_intervention_terminee, s.date_planification_initiale, s.nature_travaux,'
    ' s.rappel_date, s.reference_chantier, s.tentatives_contact FROM bons_commande s');
  execute 'create or replace view public.v_bons_commande_terrain with (security_barrier = true) as ' || def;
end $$;
