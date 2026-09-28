-- PROPOSITION — non appliquée en production (DEF-REP-14, D-REP-14 ; D-BC-14, BC-95).
--
-- La facture née du bon (« 🧾 Créer la facture », les deux applications) :
--   - posait le mode de règlement « virement » en dur, même pour un client qui
--     règle par chèque ou prélèvement → `clients.mode_paiement`, « virement »
--     à défaut ;
--   - ne recopiait pas `conducteur_id` : la facture n'avait pas de conducteur,
--     et les statistiques par conducteur la perdaient → recopié du bon ;
--   - chiffrait la ligne forfait (bon sans lignes) et les travaux sans TVA à
--     10 % en dur → la TVA par défaut de la société (Réglages › Documents,
--     `tvaDefaut`), 10 si elle est illisible.
--
-- À APPLIQUER APRÈS le n° 35 (20260926133000), dont ce fichier reprend le corps
-- tel quel (verrou FOR UPDATE, refus d'une seconde facture) : les deux refont la
-- même fonction. La garde ci-dessous s'arrête si la fonction en place n'est pas
-- celle du n° 35 — relever alors `pg_get_functiondef` en production et reporter
-- seulement les trois changements, jamais forcer.
--
-- Idempotent (create or replace). Validé par tests/rls/corrections-reproduites.essai.ts
-- (« [proposition] la facture du bon reprend le client »), écrit, non lancé.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.bc_generer_facture(uuid)'::regprocedure) into v_def;
  if position('Une facture existe deja pour ce bon de commande' in v_def) = 0 then
    raise exception 'bc_generer_facture n''est pas celle du n° 35 (20260926133000) : appliquer le n° 35 d''abord, ou reporter les changements sur la définition vivante.';
  end if;
end $$;

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
  v_soc public.societes%ROWTYPE;
  v_facture_id uuid;
  v_ligne_position integer := 0;
  v_ts public.tache_travaux_supplementaires%ROWTYPE;
  v_bl public.bon_commande_lignes%ROWTYPE;
  v_nb_lignes integer;
  v_adresse_client text;
  v_cp_client text;
  v_ville_client text;
  v_ref_client text;
  v_delai_jours integer;
  v_delai_mode public.delai_paiement_mode;
  v_defaut_jours integer;
  v_defaut_mode text;
  v_jours integer;
  v_mode public.delai_paiement_mode;
  v_mode_paiement public.mode_paiement;
  v_tva_brute text;
  v_tva_defaut numeric;
BEGIN
  /* FOR UPDATE : deux appels simultanes (deux onglets, deux personnes) se
     suivent ; le second relit le bon deja passe a « facture » et s'arrete
     (relecture 4, I9). */
  SELECT * INTO v_bc FROM public.bons_commande WHERE id = p_bc_id FOR UPDATE;
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
  IF EXISTS (SELECT 1 FROM public.factures f WHERE f.bon_commande_id = p_bc_id) THEN
    RAISE EXCEPTION 'Une facture existe deja pour ce bon de commande : ouvrez-la depuis le bon.' USING ERRCODE = 'P0001';
  END IF;

  /* L'adresse d'un bon de commande est celle du CHANTIER ; sur une facture,
     `adresse` designe le CLIENT. Chacune retrouve ici sa colonne. Le delai de
     paiement vient du meme SELECT : il n'y a pas de raison d'y revenir. */
  SELECT c.adresse, c.code_postal, c.ville, c.delai_paiement_jours, c.delai_paiement_mode, c.mode_paiement
    INTO v_adresse_client, v_cp_client, v_ville_client, v_delai_jours, v_delai_mode, v_mode_paiement
    FROM public.clients c WHERE c.id = v_bc.client_id;

  /* Le defaut de la societe vit dans les reglages, unique endroit ou il se
     saisit. Le dupliquer en colonne obligerait a le synchroniser. */
  SELECT COALESCE((ss.infos_entreprise->'reglages'->'documents'->>'delaiPaiementJours')::int, 30),
         COALESCE(ss.infos_entreprise->'reglages'->'documents'->>'modeDelaiPaiement', 'net'),
         ss.infos_entreprise->'reglages'->'documents'->>'tvaDefaut'
    INTO v_defaut_jours, v_defaut_mode, v_tva_brute
    FROM public.societe_settings ss WHERE ss.societe_id = v_societe;

  /* DEF-REP-14 : la TVA par defaut de la societe (Reglages > Documents), et non
     10 en dur. Illisible ou absente : 10, le defaut des reglages de l'ecran. */
  v_tva_defaut := CASE WHEN btrim(COALESCE(v_tva_brute, '')) ~ '^[0-9]+([.,][0-9]+)?$'
                       THEN replace(btrim(v_tva_brute), ',', '.')::numeric ELSE 10 END;

  /* COALESCE et non un test de verite : un client paye parfois A RECEPTION,
     donc zero jour, et zero doit gagner contre le defaut. */
  v_jours := COALESCE(v_delai_jours, v_defaut_jours, 30);
  v_mode  := COALESCE(v_delai_mode, v_defaut_mode::public.delai_paiement_mode, 'net');

  v_ref_client := public.ref_bc_client(v_bc.numero_bc);

  /* L'identite de l'emetteur AU JOUR DE L'EMISSION. Une facture emise ne se
     reecrit pas : demenager ou changer de SIRET ne doit pas reecrire l'entete
     des factures deja parties. L'ecran le faisait deja a l'enregistrement
     (`instantaneIdentite`) ; ce chemin-ci ne le faisait pas, et ses factures
     suivaient donc les reglages courants pour toujours. */
  SELECT * INTO v_soc FROM public.societes WHERE id = v_societe;

  -- Pas de numero : il est attribue a l'emission de la facture.
  INSERT INTO public.factures (
    societe_id, numero, client_id, client_nom, date, echeance, statut,
    remise_pourcentage, bon_commande_id, ref_bon_commande_client,
    adresse, adresse_locataire, code_postal, ville,
    facturation_adresse, facturation_code_postal, facturation_ville,
    logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire,
    conducteur, conducteur_id, interlocuteur,
    type_document, devise, conditions_reglement, mode_paiement,
    emetteur_nom, emetteur_adresse, emetteur_code_postal, emetteur_ville,
    emetteur_siret, emetteur_siren, emetteur_tva_intracom, emetteur_pays_code,
    emetteur_iban
  )
  VALUES (
    v_societe, NULL, v_bc.client_id, v_bc.client_nom, current_date,
    public.date_echeance(current_date, v_jours, v_mode), 'brouillon',
    0, v_bc.id, v_ref_client,
    v_adresse_client, COALESCE(NULLIF(v_bc.adresse_locataire, ''), v_bc.adresse), v_bc.code_postal, v_bc.ville,
    NULLIF(v_bc.facturation_adresse, ''), NULLIF(v_bc.facturation_code_postal, ''), NULLIF(v_bc.facturation_ville, ''),
    v_bc.logement_statut, v_bc.occupant, v_bc.etage, v_bc.numero_logement, v_bc.precision_commune, v_bc.ancien_locataire,
    /* DEF-REP-14 : le conducteur du bon suit sur sa facture — par sa fiche,
       seule a faire foi ; l'etiquette `conducteur` est tenue par la base. */
    v_bc.conducteur, v_bc.conducteur_id, v_bc.interlocuteur,
    /* DEF-REP-14 : le mode de reglement du client (cheque, prelevement...) ;
       « virement » seulement s'il n'en a pas. */
    'facture', 'EUR', public.libelle_delai_paiement(v_jours, v_mode), COALESCE(v_mode_paiement, 'virement'),
    /* La raison sociale d'abord : c'est elle qui doit figurer sur la facture,
       `nom` n'etant qu'un libelle de navigation. Le SIREN se deduit du SIRET
       quand il n'est pas saisi — ses neuf premiers chiffres, par definition. */
    COALESCE(NULLIF(v_soc.raison_sociale_legale, ''), v_soc.nom),
    NULLIF(v_soc.adresse, ''), NULLIF(v_soc.code_postal, ''), NULLIF(v_soc.ville, ''),
    NULLIF(v_soc.siret, ''),
    COALESCE(NULLIF(v_soc.siren, ''), NULLIF(left(COALESCE(v_soc.siret, ''), 9), '')),
    NULLIF(v_soc.tva_intracom, ''), COALESCE(NULLIF(v_soc.pays_code, ''), 'FR'),
    NULLIF(v_soc.iban, '')
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
      1, COALESCE(v_bc.montant, 0), 'forfait', v_tva_defaut,
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
      COALESCE(v_ts.quantite, 1), COALESCE(v_ts.prix_vente_ht, 0), COALESCE(v_ts.unite, 'forfait'), COALESCE(v_ts.tva, v_tva_defaut),
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
