-- PROPOSITION — non appliquée en production (DECISIONS D-018, D-R4-04).
--
-- Établir un avoir se faisait en deux appels : créer la pièce (brouillon et
-- ses lignes), PUIS l'émettre. Un échec de l'émission laissait un avoir
-- brouillon rattaché à la facture, invisible dans la liste (l'invalidation
-- n'avait lieu qu'au succès), et un nouvel essai en créait un second. Rien ne
-- bornait non plus le cumul des avoirs d'une facture : deux onglets pouvaient
-- émettre deux avoirs totaux sur la même pièce (relecture 4, I6).
--
-- `etablir_avoir(p_facture, p_motif)` fait tout dans UNE transaction :
--   - verrou consultatif sur la facture (deux avoirs simultanés se suivent) ;
--   - les contrôles et les mots de `domain/avoir.ts#refusAvoir` ;
--   - refus si des avoirs rectifient déjà cette facture pour un total qui,
--     avec celui-ci, dépasserait son TTC (brouillons compris : un reste
--     d'échec passé se supprime d'abord) ;
--   - la copie de l'en-tête (mêmes parties, même émetteur : ceux de la
--     facture rectifiée) et des lignes, puis l'émission — le numéro « AV »
--     est posé par le déclencheur de numérotation, comme à l'écran.
-- Ni devis, ni bon, ni intervention : ces liens disent « ce travail a été
-- facturé », l'avoir ne facture rien. Ni cycle ni identifiant de plateforme.
--
-- SECURITY INVOKER : la RLS de `factures` et `facture_lignes` (creer, modifier)
-- reste la barrière. Idempotent.
-- Validé par tests/rls/transactions-facturation.essai.ts (« [proposition] »).

create or replace function public.etablir_avoir(p_facture uuid, p_motif text)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  f public.factures%rowtype;
  v_cumul numeric;
  v_avoir uuid;
  v_numero text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_facture::text, 0));
  select * into f from public.factures where id = p_facture;
  -- L'ordre et les mots de domain/avoir.ts#refusAvoir.
  if f.id is null then raise exception 'Facture introuvable.' using errcode = 'no_data_found'; end if;
  if coalesce(trim(f.numero), '') = '' then
    raise exception 'Cette facture n''est pas émise : modifiez-la directement, un avoir n''aurait rien à corriger.' using errcode = 'check_violation';
  end if;
  if f.type_document = 'avoir' then
    raise exception 'Un avoir ne s''annule pas par un autre avoir : il faut refacturer.' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_motif, ''))) < 5 then
    raise exception 'Le motif est obligatoire : il s''imprime sur l''avoir et justifie la rectification.' using errcode = 'check_violation';
  end if;

  -- L'avoir reprend TOUTES les lignes : son TTC est celui de la facture. Le
  -- cumul ne peut donc dépasser le TTC que s'il existe déjà un avoir non nul.
  select round(coalesce(sum(abs(t.ttc)), 0), 2) into v_cumul
    from public.factures a join public.v_facture_totaux t on t.facture_id = a.id
   where a.facture_rectifiee_id = p_facture and a.type_document = 'avoir';
  if v_cumul > 0.005 then
    raise exception 'Des avoirs rectifient déjà cette facture pour % : un nouvel avoir total la rectifierait deux fois. Vérifiez la liste des avoirs (un brouillon d''avoir se supprime).', public.montant_fr(v_cumul)
      using errcode = 'check_violation';
  end if;

  insert into public.factures (
    societe_id, client_id, client_nom, interlocuteur, chantier_id,
    adresse, adresse_locataire, code_postal, ville,
    logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire,
    date, echeance, date_livraison, date_fin_execution,
    remise_pourcentage, acomptes_deduits, retenue_garantie_pourcentage,
    delai_paiement_jours, delai_paiement_mode, conditions_reglement, mode_paiement,
    escompte_pourcentage, penalites_retard, indemnite_recouvrement,
    ref_marche, ref_bon_commande_client, ref_contrat, cadre_facturation,
    devise, taux_change, tva_categorie, tva_motif_exoneration, tva_sur_encaissements,
    conducteur_id, conducteur,
    emetteur_nom, emetteur_adresse, emetteur_code_postal, emetteur_ville, emetteur_siret,
    emetteur_siren, emetteur_tva_intracom, emetteur_pays_code, emetteur_iban,
    client_siret, client_siren, client_tva_intracom, client_pays_code, client_code_service, client_code_routage,
    facturation_adresse, facturation_code_postal, facturation_ville, facturation_pays_code,
    livraison_adresse, livraison_code_postal, livraison_ville, livraison_pays_code,
    type_document, facture_rectifiee_id, motif_rectification, statut, verrouillee
  ) values (
    f.societe_id, f.client_id, f.client_nom, f.interlocuteur, f.chantier_id,
    f.adresse, f.adresse_locataire, f.code_postal, f.ville,
    f.logement_statut, f.occupant, f.etage, f.numero_logement, f.precision_commune, f.ancien_locataire,
    (now() at time zone 'Europe/Paris')::date, f.echeance, f.date_livraison, f.date_fin_execution,
    f.remise_pourcentage, 0, null,
    f.delai_paiement_jours, f.delai_paiement_mode, f.conditions_reglement, f.mode_paiement,
    f.escompte_pourcentage, f.penalites_retard, f.indemnite_recouvrement,
    f.ref_marche, f.ref_bon_commande_client, f.ref_contrat, f.cadre_facturation,
    f.devise, f.taux_change, f.tva_categorie, f.tva_motif_exoneration, f.tva_sur_encaissements,
    -- L'étiquette `conducteur` est tenue par la base d'après `conducteur_id`.
    f.conducteur_id, null,
    f.emetteur_nom, f.emetteur_adresse, f.emetteur_code_postal, f.emetteur_ville, f.emetteur_siret,
    f.emetteur_siren, f.emetteur_tva_intracom, f.emetteur_pays_code, f.emetteur_iban,
    f.client_siret, f.client_siren, f.client_tva_intracom, f.client_pays_code, f.client_code_service, f.client_code_routage,
    f.facturation_adresse, f.facturation_code_postal, f.facturation_ville, f.facturation_pays_code,
    f.livraison_adresse, f.livraison_code_postal, f.livraison_ville, f.livraison_pays_code,
    'avoir', f.id, trim(p_motif), 'brouillon', false
  )
  returning id into v_avoir;

  insert into public.facture_lignes (
    facture_id, position, type, designation, quantite, prix_unitaire, unite, tva,
    unite_code, tva_categorie, tva_motif_exoneration, article_reference, montant_ht, commentaire, metier
  )
  select v_avoir, (row_number() over (order by l.position, l.cree_le, l.id))::int - 1, l.type, l.designation, l.quantite, l.prix_unitaire, l.unite, l.tva,
         l.unite_code, l.tva_categorie, l.tva_motif_exoneration, l.article_reference, l.montant_ht, l.commentaire, l.metier
    from public.facture_lignes l
   where l.facture_id = p_facture;

  -- Quitter « brouillon » : le déclencheur pose le numéro dans la série des avoirs.
  update public.factures set statut = 'impayée' where id = v_avoir returning numero into v_numero;
  if v_numero is null then
    raise exception 'La base n''a pas attribué de numéro à l''avoir : rien n''est enregistré.' using errcode = 'P0001';
  end if;
  return v_avoir;
end;
$$;

revoke all on function public.etablir_avoir(uuid, text) from public, anon;
grant execute on function public.etablir_avoir(uuid, text) to authenticated;
