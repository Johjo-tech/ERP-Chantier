-- PROPOSITION — non appliquée en production (DECISIONS D-018).
--
-- `prochain_numero` exige `peut_ecrire()` (admin, conducteur, technicien) :
-- la secrétaire, qui a « devis / creer » dans la matrice, ne peut donc pas
-- enregistrer un devis — son numéro lui est refusé (défaut DEV-50). On ajoute
-- la matrice comme seconde voie, pour les devis seulement ; le reste du
-- contrôle est inchangé (et les pièces comptables restent numérotées à
-- l'émission). Idempotent.
create or replace function public.prochain_numero(p_societe uuid, p_type text, p_annee integer default null::integer)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_annee integer := coalesce(p_annee, extract(year from current_date)::integer);
begin
  if not (peut_ecrire(p_societe)
          or (p_type = 'devis' and a_permission(p_societe, 'devis', 'creer'))) then
    raise exception 'Droits insuffisants sur cette societe' using errcode = '42501';
  end if;

  if p_type in ('facture', 'avoir', 'acompte') then
    raise exception 'Le numéro d''une pièce comptable est attribué à son émission, pas à la demande'
      using errcode = '42501';
  end if;

  return numero_suivant_interne(p_societe, p_type, v_annee);
end;
$function$;
