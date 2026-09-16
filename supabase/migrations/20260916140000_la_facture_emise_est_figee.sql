-- Une facture émise ne se retouche plus.
--
-- Ses LIGNES étaient déjà gelées, et son NUMÉRO définitif. Son en-tête, non :
-- on pouvait changer le client, la date, l'adresse ou l'échéance d'une facture
-- portant un numéro, sans que rien ne s'y oppose. Le cadenas de l'écran
-- (« déjà téléchargée ») n'est qu'un garde-fou d'affichage, levé par un bouton.
--
-- Art. L441-9 : la facture est un document définitif. Une correction passe par
-- un avoir — ce que les messages des deux autres gardes disent déjà.
--
-- LISTE BLANCHE, et non liste noire : tout ce qui n'est pas nommé ci-dessous
-- est gelé. Une colonne ajoutée demain sera donc protégée sans que personne
-- n'y pense, ce qui est le bon sens de l'oubli.

create or replace function public.facture_emise_entete_figee()
returns trigger language plpgsql as $fn$
declare
  -- Ce qui peut encore bouger après émission, et pourquoi.
  v_libres text[] := array[
    -- La vie du règlement : c'est tout l'objet du suivi.
    'statut',
    -- Le parcours sur la plateforme de facturation électronique.
    'statut_cycle', 'depose_le', 'pdp_identifiant', 'pdp_transmission_id',
    -- Le cadenas d'écran, qui se lève et se repose.
    'verrouillee',
    -- Affectation interne : ne change rien à ce que le client a reçu.
    'conducteur', 'interlocuteur', 'chantier_id',
    -- L'adresse où le client veut recevoir ses factures : son service
    -- comptable déménage sans que la créance change.
    'facturation_adresse', 'facturation_code_postal', 'facturation_ville',
    'facturation_pays_code',
    -- Technique.
    'maj_le', 'identifiant_unique',
    -- Le numéro a son propre garde, avec un meilleur message.
    'numero'
  ];
  -- Ce qui peut être COMPLÉTÉ si c'était vide, mais jamais changé.
  -- Désigner l'acheteur qu'on avait oublié de désigner n'altère pas le
  -- document : la facture disait déjà à qui elle s'adressait, par son nom.
  -- 1 399 factures émises n'avaient aucun lien vers la fiche du client, et
  -- sans lui la plateforme les refuse.
  v_completables text[] := array[
    'client_id', 'client_siret', 'client_siren', 'client_tva_intracom',
    'client_pays_code', 'client_code_service', 'client_code_routage'
  ];
  v_col   text;
  v_avant jsonb := to_jsonb(old);
  v_apres jsonb := to_jsonb(new);
  v_touches text[] := '{}';
begin
  -- Un brouillon se compose librement : c'est justement à quoi il sert.
  if coalesce(old.numero, '') = '' then
    return new;
  end if;

  for v_col in select jsonb_object_keys(v_apres) loop
    if v_col = any(v_libres) then continue; end if;
    -- `is distinct from` et non `<>` : l'écran réécrit la ligne entière à
    -- chaque enregistrement, y compris les NULL, et réécrire une valeur à
    -- l'identique n'est pas une modification.
    if v_apres -> v_col is not distinct from v_avant -> v_col then continue; end if;
    -- Un vide qui se remplit : on complète, on ne réécrit pas.
    if v_col = any(v_completables)
       and coalesce(v_avant ->> v_col, '') = ''
       and coalesce(v_apres ->> v_col, '') <> '' then
      continue;
    end if;
    v_touches := v_touches || v_col;
  end loop;

  if array_length(v_touches, 1) > 0 then
    raise exception
      'La facture % est émise : son en-tête ne peut plus être modifié (%). Une correction passe par un avoir.',
      old.numero, array_to_string(v_touches, ', ')
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$fn$;

comment on function public.facture_emise_entete_figee() is
  'Gèle l''en-tête d''une facture numérotée. Liste blanche : seuls le statut, '
  'le suivi plateforme, le cadenas d''écran, l''affectation interne et '
  'l''adresse de facturation restent modifiables.';

drop trigger if exists factures_entete_figee on public.factures;
create trigger factures_entete_figee
  before update on public.factures
  for each row execute function public.facture_emise_entete_figee();
