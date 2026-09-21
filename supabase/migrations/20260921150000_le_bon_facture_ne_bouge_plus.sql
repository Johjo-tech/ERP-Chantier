-- Un bon de commande déjà facturé ne se retouche plus.
--
-- Le client tient une facture définitive qui décrit des travaux. Laisser
-- réécrire le bon dont elle découle — son montant, son adresse, la nature des
-- travaux — fait dire deux choses différentes à deux pièces d'un même dossier.
-- Une correction passe par un avoir sur la facture, jamais par le bon.
--
-- LE CRITÈRE EST LA FACTURE ÉMISE, pas le statut du circuit. `bc_generer_facture`
-- fait naître un BROUILLON et pose `statut_workflow = 'facture'` : à ce moment
-- rien n'est parti chez le client, et corriger le bon est encore légitime —
-- c'est même le dernier moment où c'est possible. Le verrou tombe quand la
-- facture reçoit son numéro.
--
-- LISTE BLANCHE, comme pour `facture_emise_entete_figee` : tout ce qui n'est
-- pas nommé est gelé, et une colonne ajoutée demain sera protégée sans que
-- personne n'y pense.

create or replace function public.bon_commande_facture_fige()
returns trigger language plpgsql as $fn$
declare
  -- Ce qui peut encore bouger, et pourquoi.
  v_libres text[] := array[
    -- Le circuit continue de vivre après la facture.
    'statut', 'statut_workflow',
    -- Le conducteur est réécrit par un DÉCLENCHEUR quand la fiche est
    -- renommée (`le_document_designe_son_conducteur`). Le geler ferait
    -- échouer la propagation d'un renommage sur tous les bons facturés.
    'conducteur', 'conducteur_id',
    -- Affectation et suivi internes : ne changent rien à ce qui a été facturé.
    'technicien', 'interlocuteur', 'notes', 'tentatives_contact', 'rappel_date',
    -- L'agenda. Les travaux sont faits ; déplacer une trace de planning ne
    -- touche pas à la créance.
    'date_planifiee', 'date_planifiee_fin', 'heure_planifiee', 'duree_heures',
    'duree_dernier_jour', 'heure_dernier_jour', 'schedule_par_metier',
    'date_planification_initiale', 'date_intervention_terminee', 'en_attente_bc',
    -- L'adresse où le client veut recevoir ses factures : son service
    -- comptable déménage sans que les travaux changent.
    'facturation_adresse', 'facturation_code_postal', 'facturation_ville',
    -- La pièce jointe du client peut arriver après coup.
    'piece_jointe_chemin', 'piece_jointe_nom', 'piece_jointe_mime',
    -- Technique.
    'maj_le', 'numero_interne'
  ];
  v_col      text;
  v_avant    jsonb := to_jsonb(old);
  v_apres    jsonb := to_jsonb(new);
  v_touches  text[] := '{}';
  v_numeros  text;
begin
  -- Une seule requête, et seulement si quelque chose a bougé ailleurs que
  -- dans la liste blanche : ce déclencheur passe sur CHAQUE écriture de bon.
  for v_col in select jsonb_object_keys(v_apres) loop
    if v_col = any(v_libres) then continue; end if;
    -- `is distinct from` et non `<>` : l'écran renvoie la ligne entière à
    -- chaque enregistrement, NULL compris, et réécrire une valeur à
    -- l'identique n'est pas une modification.
    if v_apres -> v_col is not distinct from v_avant -> v_col then continue; end if;
    v_touches := v_touches || v_col;
  end loop;

  if array_length(v_touches, 1) is null then
    return new;
  end if;

  select string_agg(f.numero, ', ' order by f.numero)
    into v_numeros
    from public.factures f
   where f.bon_commande_id = old.id
     and coalesce(f.numero, '') <> '';

  if v_numeros is null then
    return new;
  end if;

  raise exception
    'Ce bon de commande est facturé (%) : son contenu ne peut plus changer (%). Une correction passe par un avoir sur la facture.',
    v_numeros, array_to_string(v_touches, ', ')
    using errcode = 'restrict_violation';
end;
$fn$;

comment on function public.bon_commande_facture_fige() is
  'Gèle le contenu commercial d''un bon de commande dont au moins une facture '
  'est émise. Liste blanche : circuit, conducteur, agenda, suivi interne, '
  'adresse de facturation et pièce jointe restent modifiables.';

drop trigger if exists bons_commande_facture_fige on public.bons_commande;
create trigger bons_commande_facture_fige
  before update on public.bons_commande
  for each row execute function public.bon_commande_facture_fige();

-- Et la suppression, qui emporterait les lignes avec elle.
create or replace function public.bon_commande_facture_indelebile()
returns trigger language plpgsql as $fn$
declare
  v_numeros text;
begin
  select string_agg(f.numero, ', ' order by f.numero)
    into v_numeros
    from public.factures f
   where f.bon_commande_id = old.id
     and coalesce(f.numero, '') <> '';

  if v_numeros is not null then
    raise exception
      'Ce bon de commande est facturé (%) : il ne peut plus être supprimé.',
      v_numeros
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$fn$;

comment on function public.bon_commande_facture_indelebile() is
  'Refuse la suppression d''un bon de commande dont une facture est émise : '
  'la facture désignerait un bon qui n''existe plus.';

drop trigger if exists bons_commande_facture_indelebile on public.bons_commande;
create trigger bons_commande_facture_indelebile
  before delete on public.bons_commande
  for each row execute function public.bon_commande_facture_indelebile();
