-- Le conducteur de travaux chiffre les devis.
--
-- La matrice ne lui accordait que la consultation : `devis` valait
-- « voir » seulement, alors qu'il a tous les droits sur les bons de commande.
-- L'écart n'avait pas de justification métier — c'est lui qui voit le
-- chantier, relève les quantités et sait ce que les travaux coûtent.
--
-- Il gagne donc la création et la modification. Pas la suppression : effacer
-- un devis efface une trace commerciale, et cela reste un geste
-- d'administrateur ou de secrétaire.
--
-- Le reste de la matrice est reproduit à l'identique — une fonction Postgres
-- se remplace en entier, on ne modifie pas une branche isolément.

create or replace function public.a_permission(
  p_societe_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := role_dans_societe(p_societe_id);
begin
  if v_role is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role = 'lecture' then
    return p_action = 'voir' and p_module <> 'utilisateurs';
  end if;

  if v_role = 'secretaire' then
    return case p_module
      when 'clients' then true
      when 'devis' then true
      when 'factures' then true
      when 'facturation_electronique' then true
      when 'reglements' then true
      when 'controle_fournisseurs' then true
      when 'rh' then true
      when 'vehicules' then true
      when 'bons_commande' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rapports' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'conducteur' then
    return case p_module
      when 'chantiers' then true
      when 'bons_commande' then true
      when 'materiel' then true
      when 'planning' then true
      when 'rapports' then true
      -- Il relève les quantités sur le chantier : il chiffre le devis qui en
      -- découle. La suppression reste hors de sa portée.
      when 'devis' then p_action in ('voir', 'creer', 'modifier')
      when 'vehicules' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'clients' then p_action = 'voir'
      when 'factures' then p_action = 'voir'
      when 'controle_fournisseurs' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'statistiques' then p_action = 'voir'
      when 'reglages' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'technicien' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'materiel' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'rh' then p_action = 'voir'
      when 'vehicules' then p_action = 'voir'
      else false
    end;
  end if;

  if v_role = 'sous_traitant' then
    return case p_module
      when 'rapports' then p_action in ('voir', 'creer', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'chantiers' then p_action = 'voir'
      when 'planning' then p_action = 'voir'
      when 'materiel' then p_action = 'voir'
      else false
    end;
  end if;

  return false;
end;
$function$;
