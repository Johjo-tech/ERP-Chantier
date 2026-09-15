-- L'adresse de facturation voyage avec le bon, pas avec le client.
--
-- Un bailleur facture rarement à son siège : le bon porte un bloc « adresse de
-- facturation », souvent un service comptable, parfois propre au marché. La
-- ranger sur la fiche client obligerait à la réécrire dès qu'un marché change,
-- et à choisir laquelle garder quand deux bons du même client en portent deux.
--
-- `factures` a déjà ses colonnes `facturation_*` — la facture électronique les
-- lit en priorité (`operations/efacture.ts`). Il manquait le maillon amont : le
-- bon n'avait nulle part où mettre ce qu'il lisait.

alter table public.bons_commande
  add column if not exists facturation_adresse     text,
  add column if not exists facturation_code_postal text,
  add column if not exists facturation_ville       text;

comment on column public.bons_commande.facturation_adresse is
  'Où la facture doit être envoyée, tel que le bon le dit — service comptable, '
  'centre de gestion. Vide = le siège du client fait foi.';

-- La vue du terrain énumère ses colonnes une à une : sans cette recréation,
-- l'écriture fonctionnerait et la lecture ne rendrait toujours rien.
create or replace view public.v_bons_commande_terrain
with (security_barrier = true) as
SELECT id,
    societe_id,
    legacy_id,
    client_id,
    client_nom,
    interlocuteur,
    numero_bc,
    sans_bc,
    en_attente_bc,
    bon_commande_parent_id,
    devis_id,
    probleme_description,
    adresse,
    code_postal,
    ville,
    logement_statut,
    occupant,
    etage,
    numero_logement,
    precision_commune,
    ancien_locataire,
    date,
    date_reception,
    date_planifiee,
    date_planifiee_fin,
    heure_planifiee,
    duree_heures,
    date_fin_travaux,
    statut,
    metier,
    technicien,
    notes,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant
            ELSE NULL::numeric
        END AS montant,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant_par_metier
            ELSE NULL::jsonb
        END AS montant_par_metier,
    conducteur,
    cree_le,
    maj_le,
    metiers,
    schedule_par_metier,
    heure_dernier_jour,
    duree_dernier_jour,
    statut_workflow,
    numero_interne,
    adresse_locataire,
    gratuite,
    gratuite_motif,
        CASE
            WHEN voit_les_prix(societe_id) THEN montant_sous_traitant
            ELSE NULL::numeric
        END AS montant_sous_traitant,
    facturation_adresse,
    facturation_code_postal,
    facturation_ville
   FROM bons_commande s
  WHERE est_membre(societe_id);

-- La facture reprend ce que le bon a lu. Le reste de la fonction est inchangé :
-- seules trois colonnes s'ajoutent à l'INSERT.
CREATE OR REPLACE FUNCTION public.bc_generer_facture(p_bc_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_societe uuid;
  v_role text;
  v_bc public.bons_commande%ROWTYPE;
  v_facture_id uuid;
  v_ligne_position integer := 0;
  v_ts public.tache_travaux_supplementaires%ROWTYPE;
  v_bl public.bon_commande_lignes%ROWTYPE;
  v_nb_lignes integer;
  v_adresse_client text;
  v_cp_client text;
  v_ville_client text;
BEGIN
  SELECT * INTO v_bc FROM public.bons_commande WHERE id = p_bc_id;
  IF v_bc.id IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = 'P0002';
  END IF;
  v_societe := v_bc.societe_id;
  v_role := role_dans_societe(v_societe);
  IF v_role IS NULL OR v_role NOT IN ('admin', 'secretaire') THEN
    RAISE EXCEPTION 'Seul un administrateur ou secretaire peut generer la facture' USING ERRCODE = '42501';
  END IF;
  IF v_bc.statut_workflow <> 'chiffre' THEN
    RAISE EXCEPTION 'Le bon de commande doit etre au statut chiffre avant facturation' USING ERRCODE = 'P0001';
  END IF;

  /* L'adresse d'un bon de commande est celle du CHANTIER : le champ porte le
     libelle « Adresse d'intervention » dans le formulaire. Sur une facture,
     `adresse` designe l'adresse du CLIENT — le formulaire l'ecrase toujours
     avec celle de sa fiche. Recopier l'une dans l'autre faisait donc passer
     le lieu des travaux pour le siege du client, et laissait le bloc « Lieu
     d'intervention » vide sur le document imprime.
     Chacune retrouve ici sa colonne. */
  SELECT c.adresse, c.code_postal, c.ville
    INTO v_adresse_client, v_cp_client, v_ville_client
    FROM public.clients c WHERE c.id = v_bc.client_id;

  -- Pas de numero : il est attribue a l'emission de la facture.
  INSERT INTO public.factures (
    societe_id, numero, client_id, client_nom, date, statut,
    remise_pourcentage, bon_commande_id, adresse, adresse_locataire, code_postal, ville,
    facturation_adresse, facturation_code_postal, facturation_ville,
    logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire,
    conducteur, interlocuteur,
    type_document, devise, conditions_reglement, mode_paiement
  )
  VALUES (
    v_societe, NULL, v_bc.client_id, v_bc.client_nom, current_date, 'brouillon',
    0, v_bc.id, v_adresse_client, COALESCE(NULLIF(v_bc.adresse_locataire, ''), v_bc.adresse), v_bc.code_postal, v_bc.ville,
    NULLIF(v_bc.facturation_adresse, ''), NULLIF(v_bc.facturation_code_postal, ''), NULLIF(v_bc.facturation_ville, ''),
    v_bc.logement_statut, v_bc.occupant, v_bc.etage, v_bc.numero_logement, v_bc.precision_commune, v_bc.ancien_locataire,
    v_bc.conducteur, v_bc.interlocuteur,
    'facture', 'EUR', '30 jours', 'virement'
  )
  RETURNING id INTO v_facture_id;

  SELECT COUNT(*) INTO v_nb_lignes FROM public.bon_commande_lignes WHERE bon_commande_id = p_bc_id;

  IF v_nb_lignes > 0 THEN
    FOR v_bl IN
      SELECT * FROM public.bon_commande_lignes
      WHERE bon_commande_id = p_bc_id
      ORDER BY position, cree_le
    LOOP
      INSERT INTO public.facture_lignes (
        facture_id, position, type, designation, quantite, prix_unitaire, unite, tva,
        unite_code, tva_categorie, montant_ht, commentaire, article_reference
      )
      VALUES (
        v_facture_id, v_ligne_position, v_bl.type, v_bl.designation,
        v_bl.quantite, v_bl.prix_unitaire, v_bl.unite, v_bl.tva,
        COALESCE(v_bl.unite_code, code_unite(COALESCE(v_bl.unite, 'forfait'))),
        COALESCE(v_bl.tva_categorie, 'S'),
        CASE WHEN v_bl.type = 'ligne' THEN v_bl.quantite * v_bl.prix_unitaire ELSE 0 END,
        v_bl.commentaire, v_bl.article_reference
      );
      v_ligne_position := v_ligne_position + 1;
    END LOOP;
  ELSE
    INSERT INTO public.facture_lignes (
      facture_id, position, type, designation, quantite, prix_unitaire, unite, tva,
      unite_code, tva_categorie, montant_ht
    )
    VALUES (
      v_facture_id, v_ligne_position, 'ligne',
      'Travaux - BC ' || COALESCE(v_bc.numero_bc, ''),
      1, COALESCE(v_bc.montant, 0), 'forfait', 10,
      'C62', 'S', COALESCE(v_bc.montant, 0)
    );
    v_ligne_position := v_ligne_position + 1;
  END IF;

  FOR v_ts IN
    SELECT * FROM public.tache_travaux_supplementaires
    WHERE bon_commande_id = p_bc_id AND statut = 'chiffre'
  LOOP
    INSERT INTO public.facture_lignes (
      facture_id, position, type, designation, quantite, prix_unitaire, unite, tva,
      unite_code, tva_categorie, montant_ht
    )
    VALUES (
      v_facture_id, v_ligne_position, 'ligne',
      v_ts.libelle,
      COALESCE(v_ts.quantite, 1), COALESCE(v_ts.prix_vente_ht, 0), COALESCE(v_ts.unite, 'forfait'), COALESCE(v_ts.tva, 10),
      COALESCE(code_unite(COALESCE(v_ts.unite, 'forfait')), 'C62'), 'S',
      COALESCE(v_ts.quantite, 1) * COALESCE(v_ts.prix_vente_ht, 0)
    );
    v_ligne_position := v_ligne_position + 1;
  END LOOP;

  UPDATE public.bons_commande
  SET statut_workflow = 'facture', maj_le = now()
  WHERE id = p_bc_id;

  INSERT INTO public.workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  VALUES (v_societe, 'bon_commande', p_bc_id, 'chiffre', 'facture', auth.uid());

  RETURN v_facture_id;
END;
$function$;
