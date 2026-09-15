-- Le bucket « terrain » existait sans être décrit nulle part : créé à la main,
-- ses policies aussi. Un environnement neuf n'avait donc aucun stockage, et
-- rien ne disait que les fichiers y sont cloisonnés par société — c'est
-- pourtant le premier segment du chemin qui en décide, et `uploadFile` le
-- construit ainsi (`<societeId>/<domaine>/<entityId>/…`).
insert into storage.buckets (id, name, public)
values ('terrain', 'terrain', false)
on conflict (id) do nothing;

drop policy if exists terrain_lecture on storage.objects;
create policy terrain_lecture on storage.objects for select to authenticated
  using (bucket_id = 'terrain' and est_membre(uuid_ou_null(split_part(name, '/', 1))));

drop policy if exists terrain_ajout on storage.objects;
create policy terrain_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'terrain' and peut_ecrire(uuid_ou_null(split_part(name, '/', 1))));

drop policy if exists terrain_maj on storage.objects;
create policy terrain_maj on storage.objects for update to authenticated
  using (bucket_id = 'terrain' and peut_ecrire(uuid_ou_null(split_part(name, '/', 1))));

drop policy if exists terrain_suppression on storage.objects;
create policy terrain_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'terrain' and peut_ecrire(uuid_ou_null(split_part(name, '/', 1))));

-- La référence du client, normalisée une seule fois, en base et côté écran.
-- `numero_bc` est un textarea multi-lignes : un bon peut en citer plusieurs,
-- seule la première fait référence. « Sans BC » et « En attente de BC » sont
-- des sentinelles de saisie ; un numéro SAV est de NOTRE série, pas de la
-- sienne. Envoyer l'un des trois dans un champ EN 16931 serait pire que vide.
create or replace function public.ref_bc_client(p_numero text)
returns text language sql immutable as $fn$
  select nullif(
    nullif(
      nullif(
        case when trim(coalesce(p_numero,'')) ~ '^SAV-' then ''
             else trim(split_part(trim(coalesce(p_numero,'')), E'\n', 1))
        end,
      ''),
    'Sans BC'),
  'En attente de BC');
$fn$;

-- La référence du bon telle que le client la connaît part enfin sur la facture.
-- `ref_bon_commande_client` existait, la facture électronique la lit (BT-13 de
-- l'EN 16931, via `operations/efacture.ts`) — et elle valait NULL sur les 428
-- factures de production. « Sans BC » et « En attente de BC » sont des
-- sentinelles de saisie, pas des références : les envoyer au client serait pire
-- que de ne rien envoyer.
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
  v_ref_client text;
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
     avec celle de sa fiche. Chacune retrouve ici sa colonne. */
  SELECT c.adresse, c.code_postal, c.ville
    INTO v_adresse_client, v_cp_client, v_ville_client
    FROM public.clients c WHERE c.id = v_bc.client_id;

  v_ref_client := public.ref_bc_client(v_bc.numero_bc);

  -- Pas de numero : il est attribue a l'emission de la facture.
  INSERT INTO public.factures (
    societe_id, numero, client_id, client_nom, date, statut,
    remise_pourcentage, bon_commande_id, ref_bon_commande_client,
    adresse, adresse_locataire, code_postal, ville,
    facturation_adresse, facturation_code_postal, facturation_ville,
    logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire,
    conducteur, interlocuteur,
    type_document, devise, conditions_reglement, mode_paiement
  )
  VALUES (
    v_societe, NULL, v_bc.client_id, v_bc.client_nom, current_date, 'brouillon',
    0, v_bc.id, v_ref_client,
    v_adresse_client, COALESCE(NULLIF(v_bc.adresse_locataire, ''), v_bc.adresse), v_bc.code_postal, v_bc.ville,
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
