-- Base du schéma, reprise du projet distant le 2026-09-09.
--
-- Les cinquante-cinq premières migrations n'ont jamais été versionnées : le
-- dépôt seul ne savait pas reconstruire cette base, et `supabase start`
-- échouait sur la première table manquante. Ce fichier comble le trou. Il est
-- daté avant tout le reste pour s'exécuter en premier ; les migrations qui
-- suivent se rejouent par-dessus sans dommage, toutes étant idempotentes.
--
-- Produit par `supabase db dump --linked`. Structure uniquement — aucune
-- donnée, aucun secret : les données réelles vivent dans `data-cloud.sql`,
-- qui reste hors de git.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."cadre_facturation" AS ENUM (
    'B2B_national',
    'B2B_international',
    'B2G',
    'B2C'
);


ALTER TYPE "public"."cadre_facturation" OWNER TO "postgres";


CREATE TYPE "public"."devis_statut" AS ENUM (
    'brouillon',
    'envoyé',
    'accepté',
    'refusé'
);


ALTER TYPE "public"."devis_statut" OWNER TO "postgres";


CREATE TYPE "public"."document_famille" AS ENUM (
    'dpgf',
    'cctp',
    'ppsps',
    'doe',
    'ccap',
    'avenant',
    'dgd'
);


ALTER TYPE "public"."document_famille" OWNER TO "postgres";


CREATE TYPE "public"."facture_statut" AS ENUM (
    'brouillon',
    'impayée',
    'envoyée',
    'payée'
);


ALTER TYPE "public"."facture_statut" OWNER TO "postgres";


CREATE TYPE "public"."facture_statut_cycle" AS ENUM (
    'brouillon',
    'deposee',
    'recue',
    'approuvee',
    'refusee',
    'paiement_transmis',
    'encaissee',
    'rejetee',
    'suspendue'
);


ALTER TYPE "public"."facture_statut_cycle" OWNER TO "postgres";


CREATE TYPE "public"."facture_type_document" AS ENUM (
    'facture',
    'avoir',
    'acompte',
    'note_frais'
);


ALTER TYPE "public"."facture_type_document" OWNER TO "postgres";


CREATE TYPE "public"."ligne_type" AS ENUM (
    'ligne',
    'chapitre',
    'commentaire'
);


ALTER TYPE "public"."ligne_type" OWNER TO "postgres";


CREATE TYPE "public"."logement_statut" AS ENUM (
    'occupé',
    'vacant',
    'commune'
);


ALTER TYPE "public"."logement_statut" OWNER TO "postgres";


CREATE TYPE "public"."metier_type" AS ENUM (
    'plomberie',
    'electricite',
    'etancheite'
);


ALTER TYPE "public"."metier_type" OWNER TO "postgres";


CREATE TYPE "public"."mode_paiement" AS ENUM (
    'virement',
    'cheque',
    'especes',
    'carte',
    'prelevement',
    'traite',
    'autre'
);


ALTER TYPE "public"."mode_paiement" OWNER TO "postgres";


CREATE TYPE "public"."role_membre" AS ENUM (
    'admin',
    'conducteur',
    'technicien',
    'lecture',
    'secretaire',
    'sous_traitant'
);


ALTER TYPE "public"."role_membre" OWNER TO "postgres";


CREATE TYPE "public"."tva_categorie" AS ENUM (
    'S',
    'Z',
    'E',
    'AE',
    'K',
    'G',
    'O'
);


ALTER TYPE "public"."tva_categorie" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."a_permission"("p_societe_id" "uuid", "p_module" "text", "p_action" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
      when 'vehicules' then p_action in ('voir', 'modifier')
      when 'tableau_de_bord' then p_action = 'voir'
      when 'clients' then p_action = 'voir'
      when 'devis' then p_action = 'voir'
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
$$;


ALTER FUNCTION "public"."a_permission"("p_societe_id" "uuid", "p_module" "text", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accepter_invitations_apres_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_inv record;
begin
  insert into profiles (id, email, nom)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;

  for v_inv in
    select * from invitations
    where lower(email) = lower(coalesce(new.email, '')) and statut = 'en_attente'
  loop
    insert into membres_societe (profile_id, societe_id, role, actif)
    values (new.id, v_inv.societe_id, v_inv.role, true)
    on conflict (profile_id, societe_id) do update set role = excluded.role, actif = true;

    if v_inv.salarie_id is not null then
      update salaries set profile_id = new.id where id = v_inv.salarie_id;
    end if;
    if v_inv.sous_traitant_id is not null then
      update sous_traitants set contact_profile_id = new.id where id = v_inv.sous_traitant_id;
    end if;

    update invitations set statut = 'acceptee' where id = v_inv.id;
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."accepter_invitations_apres_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."amorcer_premier_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if exists (select 1 from membres_societe) then
    return new;
  end if;

  insert into membres_societe (profile_id, societe_id, role, actif)
  select new.id, s.id, 'admin', true
  from societes s
  on conflict (profile_id, societe_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."amorcer_premier_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bc_chiffrage_valide"("p_bc_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_societe uuid;
  v_role text;
  v_a_chiffrer integer;
BEGIN
  SELECT societe_id INTO v_societe FROM public.bons_commande WHERE id = p_bc_id;
  IF v_societe IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = 'P0002';
  END IF;
  v_role := role_dans_societe(v_societe);
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Seul un administrateur peut valider le chiffrage' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_a_chiffrer
  FROM public.tache_travaux_supplementaires
  WHERE bon_commande_id = p_bc_id AND statut = 'a_chiffrer';

  IF v_a_chiffrer > 0 THEN
    RAISE EXCEPTION 'Des travaux supplementaires ne sont pas encore chiffres (% ligne(s))', v_a_chiffrer
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bons_commande
  SET statut_workflow = 'chiffre', maj_le = now()
  WHERE id = p_bc_id;

  INSERT INTO public.workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  VALUES (v_societe, 'bon_commande', p_bc_id, 'pret_a_chiffrer', 'chiffre', auth.uid());
END;
$$;


ALTER FUNCTION "public"."bc_chiffrage_valide"("p_bc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bc_cloturer_gratuit"("p_bc_id" "uuid", "p_motif" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_societe uuid;
  v_role text;
  v_ancien text;
BEGIN
  SELECT societe_id, statut_workflow INTO v_societe, v_ancien
  FROM public.bons_commande WHERE id = p_bc_id;
  IF v_societe IS NULL THEN
    RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = 'P0002';
  END IF;
  v_role := role_dans_societe(v_societe);
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Seul un administrateur peut cloturer en gratuite' USING ERRCODE = '42501';
  END IF;
  IF v_ancien = 'facture' THEN
    RAISE EXCEPTION 'Ce bon de commande est deja facture' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tache_travaux_supplementaires
  SET statut = 'refuse'
  WHERE bon_commande_id = p_bc_id AND statut = 'a_chiffrer';

  UPDATE public.bons_commande
  SET statut_workflow = 'cloture_gratuit',
      gratuite = true,
      gratuite_motif = NULLIF(btrim(COALESCE(p_motif, '')), ''),
      maj_le = now()
  WHERE id = p_bc_id;

  INSERT INTO public.workflow_journal (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id, motif)
  VALUES (v_societe, 'bon_commande', p_bc_id, v_ancien, 'cloture_gratuit', auth.uid(), p_motif);
END;
$$;


ALTER FUNCTION "public"."bc_cloturer_gratuit"("p_bc_id" "uuid", "p_motif" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bc_generer_facture"("p_bc_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_societe uuid;
  v_role text;
  v_bc public.bons_commande%ROWTYPE;
  v_facture_id uuid;
  v_ligne_position integer := 0;
  v_ts public.tache_travaux_supplementaires%ROWTYPE;
  v_bl public.bon_commande_lignes%ROWTYPE;
  v_nb_lignes integer;
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

  -- Pas de numero : il est attribue a l'emission de la facture.
  INSERT INTO public.factures (
    societe_id, numero, client_id, client_nom, date, statut,
    remise_pourcentage, bon_commande_id, adresse, adresse_locataire, code_postal, ville,
    logement_statut, occupant, etage, numero_logement, precision_commune, ancien_locataire,
    conducteur, interlocuteur,
    type_document, devise, conditions_reglement, mode_paiement
  )
  VALUES (
    v_societe, NULL, v_bc.client_id, v_bc.client_nom, current_date, 'brouillon',
    0, v_bc.id, v_bc.adresse, v_bc.adresse_locataire, v_bc.code_postal, v_bc.ville,
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
$$;


ALTER FUNCTION "public"."bc_generer_facture"("p_bc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bc_passer_pret_a_chiffrer"("p_bc_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_restantes int;
begin
  -- Chiffrer avant arbitrage revient à facturer des travaux non contrôlés
  select count(*) into v_restantes
    from planning_taches
   where bon_commande_id = p_bc_id
     and statut is distinct from 'validee';

  if v_restantes > 0 then
    raise exception '% tâche(s) ne sont pas validées', v_restantes
      using errcode = 'check_violation';
  end if;

  update bons_commande
     set statut_workflow = 'pret_a_chiffrer',
         maj_le          = now()
   where id = p_bc_id;
end;
$$;


ALTER FUNCTION "public"."bc_passer_pret_a_chiffrer"("p_bc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."code_unite"("p_unite" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN lower(p_unite) IN ('h', 'heure', 'heures') THEN 'HUR'
    WHEN lower(p_unite) IN ('m', 'mètre', 'metre', 'mètres', 'metres') THEN 'MTR'
    WHEN lower(p_unite) IN ('m2', 'm²', 'mètre carré', 'metre carre') THEN 'MTK'
    WHEN lower(p_unite) IN ('m3', 'm³', 'mètre cube', 'metre cube') THEN 'MTQ'
    WHEN lower(p_unite) IN ('kg') THEN 'KGM'
    WHEN lower(p_unite) IN ('l', 'litre', 'litres') THEN 'LTR'
    WHEN lower(p_unite) IN ('u', 'unité', 'unite', 'unités', 'unites', 'forfait') THEN 'C62'
    ELSE 'C62'
  END;
$$;


ALTER FUNCTION "public"."code_unite"("p_unite" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."est_admin"("p_societe" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select mon_role(p_societe) = 'admin';
$$;


ALTER FUNCTION "public"."est_admin"("p_societe" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."est_affecte_au_chantier"("p_chantier_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_societe uuid;
  v_role text;
begin
  select societe_id into v_societe from chantiers where id = p_chantier_id;
  if v_societe is null then
    return false;
  end if;
  v_role := role_dans_societe(v_societe);
  if v_role is null then
    return false;
  end if;
  -- Technicien et sous-traitant sont limites a leurs affectations.
  if v_role not in ('technicien', 'sous_traitant') then
    return true;
  end if;
  return exists (
    select 1 from chantier_affectations a
    where a.chantier_id = p_chantier_id and a.profile_id = auth.uid()
  );
end;
$$;


ALTER FUNCTION "public"."est_affecte_au_chantier"("p_chantier_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."est_membre"("p_societe" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (select 1 from mes_societes() s where s = p_societe);
$$;


ALTER FUNCTION "public"."est_membre"("p_societe" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_inv record;
begin
  insert into profiles (id, email, nom)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'nom', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;

  if new.email is not null and new.email_confirmed_at is not null then
    for v_inv in
      select * from invitations
      where lower(email) = lower(new.email) and statut = 'en_attente'
    loop
      insert into membres_societe (profile_id, societe_id, role, actif)
      values (new.id, v_inv.societe_id, v_inv.role, true)
      on conflict (profile_id, societe_id) do update set role = excluded.role, actif = true;

      if v_inv.salarie_id is not null then
        update salaries set profile_id = new.id where id = v_inv.salarie_id;
      end if;
      if v_inv.sous_traitant_id is not null then
        update sous_traitants set contact_profile_id = new.id where id = v_inv.sous_traitant_id;
      end if;

      update invitations set statut = 'acceptee' where id = v_inv.id;
    end loop;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mes_societes"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.societe_id from membres_societe m
  join profiles p on p.id = m.profile_id
  where m.profile_id = auth.uid() and m.actif and p.actif;
$$;


ALTER FUNCTION "public"."mes_societes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mon_role"("p_societe" "uuid") RETURNS "public"."role_membre"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.role from membres_societe m
  join profiles p on p.id = m.profile_id
  where m.profile_id = auth.uid() and m.societe_id = p_societe and m.actif and p.actif
  limit 1;
$$;


ALTER FUNCTION "public"."mon_role"("p_societe" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."peut_ecrire"("p_societe" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select mon_role(p_societe) in ('admin', 'conducteur', 'technicien');
$$;


ALTER FUNCTION "public"."peut_ecrire"("p_societe" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prochain_numero"("p_societe" "uuid", "p_type" "text", "p_annee" integer DEFAULT NULL::integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_annee integer := coalesce(p_annee, extract(year from current_date)::integer);
  v_valeur integer;
  v_prefixe text;
begin
  if not peut_ecrire(p_societe) then
    raise exception 'Droits insuffisants sur cette societe' using errcode = '42501';
  end if;
  insert into compteurs (societe_id, type, annee, valeur)
  values (p_societe, p_type, v_annee, 1)
  on conflict (societe_id, type, annee)
  do update set valeur = compteurs.valeur + 1, maj_le = now()
  returning valeur, prefixe into v_valeur, v_prefixe;
  if coalesce(v_prefixe, '') = '' then
    v_prefixe := case p_type
      when 'devis' then 'DEV' when 'facture' then 'FAC'
      when 'sav' then 'SAV' when 'intervention' then 'INT'
      else upper(left(p_type, 3)) end;
  end if;
  return format('%s-%s-%s', v_prefixe, v_annee, lpad(v_valeur::text, 4, '0'));
end;
$$;


ALTER FUNCTION "public"."prochain_numero"("p_societe" "uuid", "p_type" "text", "p_annee" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_dernier_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_admins integer;
begin
  if tg_op = 'UPDATE'
     and old.role = 'admin' and old.actif
     and (new.role <> 'admin' or not new.actif) then
    if old.profile_id = auth.uid() then
      raise exception 'Vous ne pouvez pas retirer votre propre role administrateur'
        using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' and old.role = 'admin' and old.actif then
    if old.profile_id = auth.uid() then
      raise exception 'Vous ne pouvez pas supprimer votre propre acces administrateur'
        using errcode = '42501';
    end if;
  else
    return case tg_op when 'DELETE' then old else new end;
  end if;

  select count(*) into v_admins
  from membres_societe
  where societe_id = old.societe_id and role = 'admin' and actif;

  if v_admins <= 1 then
    raise exception 'Une societe doit conserver au moins un administrateur actif'
      using errcode = '42501';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."proteger_dernier_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_table_fille"("p_table" "text", "p_colonne" "text", "p_parent" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_lecture text; v_ecriture text;
begin
  execute format('alter table %I enable row level security', p_table);
  v_lecture := format('exists (select 1 from %I p where p.id = %I.%I and est_membre(p.societe_id))',
    p_parent, p_table, p_colonne);
  v_ecriture := format('exists (select 1 from %I p where p.id = %I.%I and peut_ecrire(p.societe_id))',
    p_parent, p_table, p_colonne);
  execute format('create policy %I on %I for select to authenticated using (%s)', p_table || '_select', p_table, v_lecture);
  execute format('create policy %I on %I for insert to authenticated with check (%s)', p_table || '_insert', p_table, v_ecriture);
  execute format('create policy %I on %I for update to authenticated using (%s) with check (%s)', p_table || '_update', p_table, v_ecriture, v_ecriture);
  execute format('create policy %I on %I for delete to authenticated using (%s)', p_table || '_delete', p_table, v_lecture);
end;
$$;


ALTER FUNCTION "public"."rls_table_fille"("p_table" "text", "p_colonne" "text", "p_parent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_table_racine"("p_table" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  execute format('alter table %I enable row level security', p_table);
  execute format('create policy %I on %I for select to authenticated using (est_membre(societe_id))',
    p_table || '_select', p_table);
  execute format('create policy %I on %I for insert to authenticated with check (peut_ecrire(societe_id))',
    p_table || '_insert', p_table);
  execute format('create policy %I on %I for update to authenticated using (peut_ecrire(societe_id)) with check (peut_ecrire(societe_id))',
    p_table || '_update', p_table);
  execute format('create policy %I on %I for delete to authenticated using (peut_ecrire(societe_id))',
    p_table || '_delete', p_table);
end;
$$;


ALTER FUNCTION "public"."rls_table_racine"("p_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select m.role::text
  from membres_societe m
  join profiles p on p.id = m.profile_id
  where m.profile_id = auth.uid()
    and m.societe_id = p_societe_id
    and m.actif and p.actif
  limit 1;
$$;


ALTER FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_maj_le"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.maj_le := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_maj_le"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tache_marquer_realisee"("p_tache_id" "uuid", "p_commentaire" "text" DEFAULT NULL::"text", "p_date_realisation" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_statut text;
begin
  select statut into v_statut
    from planning_taches where id = p_tache_id
    for update;

  if v_statut is null then
    raise exception 'Tâche introuvable' using errcode = 'no_data_found';
  end if;

  -- Une tâche validée est close : la rouvrir effacerait l'arbitrage
  if v_statut not in ('planifiee', 'refusee') then
    raise exception 'Transition interdite : % -> realisee', v_statut
      using errcode = 'check_violation';
  end if;

  update planning_taches
     set statut       = 'realisee',
         realisee_le  = coalesce(p_date_realisation, current_date),
         realisee_par = auth.uid(),
         commentaire  = coalesce(p_commentaire, commentaire),
         refus_motif  = null,
         maj_le       = now()
   where id = p_tache_id;
end;
$$;


ALTER FUNCTION "public"."tache_marquer_realisee"("p_tache_id" "uuid", "p_commentaire" "text", "p_date_realisation" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tache_sauvegarder_terrain"("p_tache_id" "uuid", "p_commentaire" "text" DEFAULT NULL::"text", "p_piece_a_commander" boolean DEFAULT false, "p_piece_description" "text" DEFAULT NULL::"text", "p_croquis" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_societe uuid;
  v_role text;
  v_tech uuid;
BEGIN
  SELECT societe_id, technicien_id INTO v_societe, v_tech
  FROM public.planning_taches WHERE id = p_tache_id;
  IF v_societe IS NULL THEN
    RAISE EXCEPTION 'Tache introuvable' USING ERRCODE = 'P0002';
  END IF;
  v_role := role_dans_societe(v_societe);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Non membre de la societe' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('admin', 'conducteur', 'technicien') THEN
    RAISE EXCEPTION 'Role non autorise' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'technicien' AND v_tech IS NOT NULL AND v_tech <> auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez modifier que vos propres taches' USING ERRCODE = '42501';
  END IF;

  UPDATE public.planning_taches SET
    commentaire = COALESCE(p_commentaire, commentaire),
    piece_a_commander = p_piece_a_commander,
    piece_description = p_piece_description,
    croquis = p_croquis,
    maj_le = now()
  WHERE id = p_tache_id;
END;
$$;


ALTER FUNCTION "public"."tache_sauvegarder_terrain"("p_tache_id" "uuid", "p_commentaire" "text", "p_piece_a_commander" boolean, "p_piece_description" "text", "p_croquis" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tache_valider"("p_tache_id" "uuid", "p_ok" boolean, "p_motif" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_statut  text;
  v_societe uuid;
begin
  select statut, societe_id into v_statut, v_societe
    from planning_taches where id = p_tache_id
    for update;

  if v_statut is null then
    raise exception 'Tâche introuvable' using errcode = 'no_data_found';
  end if;

  -- On n'arbitre que ce que le terrain a déclaré fait
  if v_statut <> 'realisee' then
    raise exception 'Transition interdite : % -> arbitrage', v_statut
      using errcode = 'check_violation';
  end if;

  if not a_permission(v_societe, 'planning', 'modifier') then
    raise exception 'Rôle insuffisant pour arbitrer' using errcode = 'insufficient_privilege';
  end if;

  -- Sans motif, le technicien ne sait pas quoi reprendre
  if not p_ok and coalesce(btrim(p_motif), '') = '' then
    raise exception 'Un refus doit être motivé' using errcode = 'check_violation';
  end if;

  update planning_taches
     set statut      = case when p_ok then 'validee' else 'refusee' end,
         validee_le  = case when p_ok then now() else null end,
         validee_par = case when p_ok then auth.uid() else null end,
         refus_motif = case when p_ok then null else p_motif end,
         maj_le      = now()
   where id = p_tache_id;
end;
$$;


ALTER FUNCTION "public"."tache_valider"("p_tache_id" "uuid", "p_ok" boolean, "p_motif" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uuid_ou_null"("p_texte" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  return p_texte::uuid;
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."uuid_ou_null"("p_texte" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "code" "text",
    "designation" "text" NOT NULL,
    "unite" "text",
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "tva" numeric(5,2) DEFAULT 0 NOT NULL,
    "metier" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bon_commande_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bon_commande_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "type" "public"."ligne_type" DEFAULT 'ligne'::"public"."ligne_type" NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric DEFAULT 0 NOT NULL,
    "unite" "text",
    "tva" numeric DEFAULT 0 NOT NULL,
    "unite_code" "text",
    "tva_categorie" "public"."tva_categorie",
    "article_reference" "text",
    "commentaire" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bon_commande_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bon_commande_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bon_commande_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "chemin" "text" NOT NULL,
    "legende" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bon_commande_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bons_commande" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "client_id" "uuid",
    "client_nom" "text" NOT NULL,
    "interlocuteur" "text",
    "numero_bc" "text",
    "sans_bc" boolean DEFAULT false NOT NULL,
    "en_attente_bc" boolean DEFAULT false NOT NULL,
    "bon_commande_parent_id" "uuid",
    "devis_id" "uuid",
    "probleme_description" "text",
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "logement_statut" "public"."logement_statut",
    "occupant" "text",
    "etage" "text",
    "numero_logement" "text",
    "precision_commune" "text",
    "ancien_locataire" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "date_reception" "date",
    "date_planifiee" "date",
    "date_planifiee_fin" "date",
    "heure_planifiee" "text",
    "duree_heures" numeric(6,2),
    "date_fin_travaux" "date",
    "statut" "text",
    "metier" "text",
    "technicien" "text",
    "notes" "text",
    "montant" numeric(14,2) DEFAULT 0 NOT NULL,
    "montant_par_metier" "jsonb",
    "conducteur" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metiers" "jsonb",
    "schedule_par_metier" "jsonb",
    "heure_dernier_jour" "text",
    "duree_dernier_jour" numeric(6,2),
    "statut_workflow" "text" DEFAULT 'en_cours'::"text",
    "numero_interne" "text",
    "adresse_locataire" "text",
    "gratuite" boolean DEFAULT false NOT NULL,
    "gratuite_motif" "text",
    "montant_sous_traitant" numeric
);


ALTER TABLE "public"."bons_commande" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bons_commande"."schedule_par_metier" IS 'Planification par metier : { "<metier>": { technicien, datePlanifiee,
   datePlanifieeFin, heurePlanifiee, dureeHeures, ... } }. Utilise uniquement
   quand le bon couvre plusieurs metiers.';



COMMENT ON COLUMN "public"."bons_commande"."montant_sous_traitant" IS 'Montant HT convenu avec le sous-traitant. NULL tant qu''il n''est pas défini.';



CREATE TABLE IF NOT EXISTS "public"."chantier_achats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "fournisseur" "text",
    "date_achat" "date",
    "montant" numeric(14,2) DEFAULT 0 NOT NULL,
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_achats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_affectations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "role_sur_chantier" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_affectations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_avancement_factures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dpgf_ligne_id" "uuid" NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "avancement_avant" numeric(5,2) DEFAULT 0 NOT NULL,
    "avancement_apres" numeric(5,2) DEFAULT 0 NOT NULL,
    "montant_facture" numeric(14,2) DEFAULT 0 NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_avancement_factures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_comptes_rendus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "titre" "text",
    "date_compte_rendu" "date",
    "contenu" "text",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_comptes_rendus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_devis_complementaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "designation" "text",
    "montant" numeric(14,2) DEFAULT 0 NOT NULL,
    "date_document" "date",
    "devis_id" "uuid",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_devis_complementaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "famille" "public"."document_famille" NOT NULL,
    "nom" "text" NOT NULL,
    "date_document" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_dpgf_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "type" "public"."ligne_type" DEFAULT 'ligne'::"public"."ligne_type" NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric(14,4) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "unite" "text",
    "avancement_cumule" numeric(5,2) DEFAULT 0 NOT NULL,
    "devis_source_id" "uuid",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chantier_dpgf_lignes_avancement_cumule_check" CHECK ((("avancement_cumule" >= (0)::numeric) AND ("avancement_cumule" <= (100)::numeric)))
);


ALTER TABLE "public"."chantier_dpgf_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "date_visite" "date",
    "objet" "text",
    "observations" "text",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chantier_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "texte" "text" DEFAULT ''::"text" NOT NULL,
    "statut" "text" DEFAULT 'a_faire'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "date_prevue" "date",
    "salarie_id" "uuid",
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_todos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "client_id" "uuid",
    "client_nom" "text",
    "conducteur" "text",
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "type" "text",
    "date_debut" "date",
    "date_fin" "date",
    "infos_diverses" "text" DEFAULT ''::"text" NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "email" "text",
    "telephone" "text",
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "siren" "text",
    "siret" "text",
    "tva_intracom" "text",
    "pays_code" "text" DEFAULT 'FR'::"text",
    "code_service" "text",
    "code_routage" "text",
    "reference_engagement" "text",
    "numero_marche" "text",
    "facturation_adresse" "text",
    "facturation_code_postal" "text",
    "facturation_ville" "text",
    "facturation_pays_code" "text",
    "livraison_adresse" "text",
    "livraison_code_postal" "text",
    "livraison_ville" "text",
    "livraison_pays_code" "text",
    "contact_nom" "text",
    "contact_email" "text",
    "contact_telephone" "text",
    "cadre_facturation" "public"."cadre_facturation",
    "adresse_electronique_schema" "text",
    "adresse_electronique_valeur" "text",
    "eligibilite_statut" "text",
    "eligibilite_verifie_le" timestamp with time zone,
    "eligibilite_message" "text",
    "reference_acheteur" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compteurs" (
    "societe_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "annee" integer NOT NULL,
    "valeur" integer DEFAULT 0 NOT NULL,
    "prefixe" "text" DEFAULT ''::"text" NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compteurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conducteurs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "email" "text",
    "telephone" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conducteurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "numero" "text" NOT NULL,
    "client_id" "uuid",
    "client_nom" "text" NOT NULL,
    "interlocuteur" "text",
    "chantier_id" "uuid",
    "intervention_id" "uuid",
    "adresse" "text",
    "adresse_locataire" "text",
    "code_postal" "text",
    "ville" "text",
    "logement_statut" "public"."logement_statut",
    "occupant" "text",
    "etage" "text",
    "numero_logement" "text",
    "precision_commune" "text",
    "ancien_locataire" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "remise_pourcentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "statut" "public"."devis_statut" DEFAULT 'brouillon'::"public"."devis_statut" NOT NULL,
    "conducteur" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "devis_remise_pourcentage_check" CHECK ((("remise_pourcentage" >= (0)::numeric) AND ("remise_pourcentage" <= (100)::numeric)))
);


ALTER TABLE "public"."devis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devis_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "devis_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "type" "public"."ligne_type" DEFAULT 'ligne'::"public"."ligne_type" NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric(14,4) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "unite" "text",
    "tva" numeric(5,2) DEFAULT 0 NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unite_code" "text",
    "tva_categorie" "public"."tva_categorie",
    "article_reference" "text",
    "commentaire" "text"
);


ALTER TABLE "public"."devis_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents_legaux" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "type" "text",
    "date_validite" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents_legaux" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ereporting_depots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "periode" "text" NOT NULL,
    "flux" "text" DEFAULT 'transactions'::"text" NOT NULL,
    "regime" "text",
    "echeance" "date",
    "statut" "text" DEFAULT 'brouillon'::"text" NOT NULL,
    "nb_factures" integer DEFAULT 0 NOT NULL,
    "total_ht" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_tva" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_ttc" numeric(14,2) DEFAULT 0 NOT NULL,
    "pdp_depot_id" "text",
    "message" "text",
    "donnees" "jsonb",
    "transmis_le" timestamp with time zone,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ereporting_depots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facture_cycle_vie" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "statut" "public"."facture_statut_cycle" NOT NULL,
    "date_statut" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auteur_id" "uuid",
    "message" "text",
    "donnees" "jsonb",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."facture_cycle_vie" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facture_entrante_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facture_entrante_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric(14,3) DEFAULT 1 NOT NULL,
    "unite_code" "text",
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "tva" numeric(6,3) DEFAULT 20 NOT NULL,
    "tva_categorie" "public"."tva_categorie",
    "montant_ht" numeric(14,2),
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."facture_entrante_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facture_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "type" "public"."ligne_type" DEFAULT 'ligne'::"public"."ligne_type" NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric(14,4) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "unite" "text",
    "tva" numeric(5,2) DEFAULT 0 NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unite_code" "text",
    "tva_categorie" "public"."tva_categorie",
    "tva_motif_exoneration" "text",
    "article_reference" "text",
    "montant_ht" numeric,
    "commentaire" "text"
);


ALTER TABLE "public"."facture_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "numero" "text",
    "client_id" "uuid",
    "client_nom" "text" NOT NULL,
    "interlocuteur" "text",
    "devis_id" "uuid",
    "chantier_id" "uuid",
    "intervention_id" "uuid",
    "bon_commande_id" "uuid",
    "adresse" "text",
    "adresse_locataire" "text",
    "code_postal" "text",
    "ville" "text",
    "logement_statut" "public"."logement_statut",
    "occupant" "text",
    "etage" "text",
    "numero_logement" "text",
    "precision_commune" "text",
    "ancien_locataire" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "echeance" "date",
    "remise_pourcentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "statut" "public"."facture_statut" DEFAULT 'impayée'::"public"."facture_statut" NOT NULL,
    "conducteur" "text",
    "verrouillee" boolean DEFAULT false NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type_document" "public"."facture_type_document" DEFAULT 'facture'::"public"."facture_type_document" NOT NULL,
    "cadre_facturation" "public"."cadre_facturation" DEFAULT 'B2B_national'::"public"."cadre_facturation" NOT NULL,
    "devise" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "taux_change" numeric,
    "date_livraison" "date",
    "date_fin_execution" "date",
    "conditions_reglement" "text",
    "mode_paiement" "public"."mode_paiement",
    "escompte_pourcentage" numeric,
    "penalites_retard" "text",
    "indemnite_recouvrement" numeric,
    "ref_bon_commande_client" "text",
    "ref_contrat" "text",
    "ref_marche" "text",
    "facture_rectifiee_id" "uuid",
    "motif_rectification" "text",
    "acomptes_deduits" numeric DEFAULT 0 NOT NULL,
    "total_ht" numeric,
    "total_remise" numeric,
    "total_tva" numeric,
    "total_ttc" numeric,
    "net_a_payer" numeric,
    "ventilation_tva" "jsonb",
    "tva_categorie" "public"."tva_categorie",
    "tva_motif_exoneration" "text",
    "tva_sur_encaissements" boolean DEFAULT false,
    "statut_cycle" "public"."facture_statut_cycle" DEFAULT 'brouillon'::"public"."facture_statut_cycle" NOT NULL,
    "identifiant_unique" "text",
    "pdp_identifiant" "text",
    "pdp_transmission_id" "text",
    "depose_le" timestamp with time zone,
    "emetteur_nom" "text",
    "emetteur_siren" "text",
    "emetteur_siret" "text",
    "emetteur_tva_intracom" "text",
    "emetteur_adresse" "text",
    "emetteur_code_postal" "text",
    "emetteur_ville" "text",
    "emetteur_pays_code" "text",
    "emetteur_iban" "text",
    "client_siren" "text",
    "client_siret" "text",
    "client_tva_intracom" "text",
    "client_pays_code" "text",
    "client_code_service" "text",
    "client_code_routage" "text",
    "facturation_adresse" "text",
    "facturation_code_postal" "text",
    "facturation_ville" "text",
    "facturation_pays_code" "text",
    "livraison_adresse" "text",
    "livraison_code_postal" "text",
    "livraison_ville" "text",
    "livraison_pays_code" "text",
    CONSTRAINT "factures_remise_pourcentage_check" CHECK ((("remise_pourcentage" >= (0)::numeric) AND ("remise_pourcentage" <= (100)::numeric)))
);


ALTER TABLE "public"."factures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factures_entrantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "pdp_identifiant" "text",
    "pdp_transmission_id" "text",
    "numero" "text",
    "emetteur_nom" "text",
    "emetteur_siren" "text",
    "emetteur_siret" "text",
    "emetteur_tva_intracom" "text",
    "date_emission" "date",
    "echeance" "date",
    "devise" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "total_ht" numeric(14,2),
    "total_tva" numeric(14,2),
    "total_ttc" numeric(14,2),
    "net_a_payer" numeric(14,2),
    "type_document" "public"."facture_type_document" DEFAULT 'facture'::"public"."facture_type_document" NOT NULL,
    "statut_cycle" "public"."facture_statut_cycle" DEFAULT 'recue'::"public"."facture_statut_cycle" NOT NULL,
    "motif_refus" "text",
    "chantier_id" "uuid",
    "bon_commande_id" "uuid",
    "fichier_chemin" "text",
    "xml_brut" "text",
    "donnees" "jsonb",
    "recue_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."factures_entrantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fournisseur_controle_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fournisseur_id" "uuid" NOT NULL,
    "origine" "text" NOT NULL,
    "lot" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "quantite" numeric(14,4) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(14,4) DEFAULT 0 NOT NULL,
    "unite" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fournisseur_controle_lignes_origine_check" CHECK (("origine" = ANY (ARRAY['reference'::"text", 'facture'::"text"])))
);


ALTER TABLE "public"."fournisseur_controle_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fournisseurs_controle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fournisseurs_controle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_journal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "cible_type" "text",
    "cible_id" "uuid",
    "statut" "text" DEFAULT 'ok'::"text" NOT NULL,
    "code_http" integer,
    "message" "text",
    "requete" "jsonb",
    "reponse" "jsonb",
    "duree_ms" integer,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_journal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interlocuteurs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "fonction" "text",
    "email" "text",
    "telephone" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interlocuteurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_controles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "cle" "text" NOT NULL,
    "coche" boolean DEFAULT false NOT NULL,
    "precision_autre" "text"
);


ALTER TABLE "public"."intervention_controles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intervention_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "chemin" "text" NOT NULL,
    "legende" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervention_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interventions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "numero" "text",
    "client_id" "uuid",
    "client_nom" "text" NOT NULL,
    "interlocuteur" "text",
    "adresse" "text",
    "adresse_locataire" "text",
    "code_postal" "text",
    "ville" "text",
    "logement_statut" "public"."logement_statut",
    "occupant" "text",
    "etage" "text",
    "numero_logement" "text",
    "precision_commune" "text",
    "ancien_locataire" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "heure" "text",
    "metier" "public"."metier_type",
    "statut" "text",
    "constatations" "text",
    "preconisations" "text",
    "signature_chemin" "text",
    "conducteur" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interventions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."role_membre" DEFAULT 'lecture'::"public"."role_membre" NOT NULL,
    "salarie_id" "uuid",
    "sous_traitant_id" "uuid",
    "statut" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "cree_par" "uuid",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kv_store" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kv_store" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiel_prets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "materiel_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "personne" "text",
    "salarie_id" "uuid",
    "date_debut" "date",
    "date_fin" "date",
    "etat_depart" "text",
    "etat_retour" "text",
    "commentaire" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."materiel_prets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materiels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "categorie" "text",
    "etat_general" "text",
    "numero_serie" "text",
    "date_achat" "date",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."materiels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membres_societe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "role" "public"."role_membre" DEFAULT 'lecture'::"public"."role_membre" NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."membres_societe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "libelle" "text" NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."metiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdp_connexion_secrets" (
    "connexion_id" "uuid" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expire_le" timestamp with time zone,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pdp_connexion_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdp_connexions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "fournisseur" "text" DEFAULT 'superpdp'::"text" NOT NULL,
    "pdp_company_id" "text",
    "pdp_seller_number" "text",
    "adresse_electronique_valeur" "text",
    "adresse_electronique_schema" "text",
    "etat" "text" DEFAULT 'non_connecte'::"text" NOT NULL,
    "message" "text",
    "connecte_le" timestamp with time zone,
    "expire_le" timestamp with time zone,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pdp_connexions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdp_oauth_etats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "etat" "text" NOT NULL,
    "redirect_uri" "text",
    "profile_id" "uuid",
    "expire_le" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pdp_oauth_etats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_taches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "libelle" "text" DEFAULT ''::"text" NOT NULL,
    "date_tache" "date" NOT NULL,
    "heure_debut" "text",
    "heure_fin" "text",
    "technicien_id" "uuid",
    "sous_traitant_id" "uuid",
    "bon_commande_id" "uuid",
    "chantier_id" "uuid",
    "dpgf_ligne_id" "uuid",
    "quantite_planifiee" numeric(14,4),
    "metier" "text",
    "statut" "text" DEFAULT 'planifiee'::"text" NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commentaire" "text",
    "realisee_le" timestamp with time zone,
    "realisee_par" "uuid",
    "validee_le" timestamp with time zone,
    "validee_par" "uuid",
    "refus_motif" "text",
    "piece_a_commander" boolean DEFAULT false,
    "piece_description" "text",
    "croquis" "text",
    "piece_date_commande" "date",
    "piece_fournisseur" "text",
    "piece_recue_le" timestamp with time zone
);


ALTER TABLE "public"."planning_taches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nom" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reglements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "facture_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "montant" numeric(14,2) NOT NULL,
    "mode" "text",
    "reference" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reglements_montant_check" CHECK (("montant" > (0)::numeric))
);


ALTER TABLE "public"."reglements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "type" "text",
    "date_debut" "date",
    "date_fin" "date",
    "commentaire" "text",
    "justificatif_chemin" "text",
    "justificatif_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nb_jours" numeric,
    "motif" "text",
    "statut" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "approuve_par" "text",
    "date_approbation" "date"
);


ALTER TABLE "public"."salarie_absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_contacts_urgence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "lien_parente" "text",
    "telephone" "text",
    "email" "text",
    "adresse" "text",
    "principal" boolean DEFAULT false NOT NULL,
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salarie_contacts_urgence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_contrats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "type" "text" DEFAULT 'contrat'::"text" NOT NULL,
    "nom" "text",
    "date_document" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "salarie_contrats_type_check" CHECK (("type" = ANY (ARRAY['contrat'::"text", 'avenant'::"text"])))
);


ALTER TABLE "public"."salarie_contrats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "nom" "text",
    "type" "text" DEFAULT 'autre'::"text" NOT NULL,
    "numero_document" "text",
    "date_document" "date",
    "date_expiration" "date",
    "organisme" "text",
    "fichier_nom" "text",
    "fichier_chemin" "text",
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salarie_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_formations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "intitule" "text" NOT NULL,
    "organisme" "text",
    "date_debut" "date",
    "date_fin" "date",
    "duree_heures" numeric,
    "cout" numeric,
    "statut" "text" DEFAULT 'planifie'::"text" NOT NULL,
    "certificat_nom" "text",
    "certificat_chemin" "text",
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salarie_formations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_habilitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "date_obtention" "date",
    "date_expiration" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'habilitation'::"text" NOT NULL,
    "numero" "text",
    "organisme" "text",
    "statut" "text" DEFAULT 'valide'::"text" NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."salarie_habilitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salarie_rdv" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salarie_id" "uuid" NOT NULL,
    "titre" "text" NOT NULL,
    "type" "text" DEFAULT 'autre'::"text" NOT NULL,
    "date_debut" timestamp with time zone,
    "date_fin" timestamp with time zone,
    "lieu" "text",
    "organisme" "text",
    "statut" "text" DEFAULT 'planifie'::"text" NOT NULL,
    "rappel_envoye" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salarie_rdv" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "prenom" "text",
    "poste" "text",
    "email" "text",
    "telephone" "text",
    "date_entree" "date",
    "date_sortie" "date",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type_contrat" "text",
    "carte_btp_numero" "text",
    "carte_btp_validite" "date",
    "visite_medicale_date" "date",
    "visite_medicale_prochaine" "date",
    "technicien_id" "uuid",
    "salaire_mensuel_net" numeric(12,2),
    "cout_horaire_charge" numeric(10,2),
    "solde_cp_initial" numeric(8,2),
    "date_naissance" "date",
    "nationalite" "text",
    "sexe" "text",
    "lieu_naissance" "text",
    "situation_familiale" "text",
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "statut_cadre" "text",
    "temps_travail" "text",
    "iban" "text",
    "mutuelle" "text",
    "retraite" "text",
    "medecine_travail" "text",
    "manager_id" "uuid",
    "departement" "text",
    "photo_url" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "profile_id" "uuid",
    CONSTRAINT "salaries_sexe_check" CHECK (("sexe" = ANY (ARRAY['F'::"text", 'M'::"text"])))
);


ALTER TABLE "public"."salaries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."salaries"."date_naissance" IS 'Mention obligatoire du registre unique du personnel.';



CREATE TABLE IF NOT EXISTS "public"."societe_settings" (
    "societe_id" "uuid" NOT NULL,
    "infos_entreprise" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notifs_traitees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."societe_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."societes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "siret" "text",
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "telephone" "text",
    "email" "text",
    "logo_url" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raison_sociale_legale" "text",
    "forme_juridique" "text",
    "siren" "text",
    "tva_intracom" "text",
    "capital_social" numeric,
    "rcs_ville" "text",
    "rcs_numero" "text",
    "code_naf" "text",
    "pays_code" "text" DEFAULT 'FR'::"text",
    "iban" "text",
    "bic" "text",
    "assurance_decennale_nom" "text",
    "assurance_decennale_police" "text",
    "mention_penalites_retard" "text",
    "indemnite_recouvrement" numeric DEFAULT 40,
    "regime_tva" "text",
    "tva_sur_encaissements" boolean DEFAULT false,
    "autoliquidation_batiment" boolean DEFAULT false,
    "ereporting_regime" "text" DEFAULT 'mensuel'::"text",
    "adresse_electronique_valeur" "text",
    "adresse_electronique_schema" "text"
);


ALTER TABLE "public"."societes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sous_traitant_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sous_traitant_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "type" "text",
    "date_validite" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sous_traitant_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sous_traitants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "metier" "text",
    "email" "text",
    "telephone" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "siret" "text",
    "adresse" "text",
    "code_postal" "text",
    "ville" "text",
    "contact_nom" "text",
    "contact_email" "text",
    "contact_profile_id" "uuid",
    "metiers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "siren" "text",
    "tva_intracom" "text",
    "pays_code" "text" DEFAULT 'FR'::"text",
    "adresse_electronique_schema" "text",
    "adresse_electronique_valeur" "text"
);


ALTER TABLE "public"."sous_traitants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tache_travaux_supplementaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "bon_commande_id" "uuid" NOT NULL,
    "planning_tache_id" "uuid",
    "libelle" "text" NOT NULL,
    "unite" "text",
    "quantite" numeric DEFAULT 1,
    "prix_vente_ht" numeric,
    "tva" numeric DEFAULT 10,
    "origine" "text" DEFAULT 'technicien'::"text" NOT NULL,
    "statut" "text" DEFAULT 'a_chiffrer'::"text" NOT NULL,
    "cree_par" "uuid",
    "cree_le" timestamp with time zone DEFAULT "now"(),
    "maj_le" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tache_travaux_supplementaires_origine_check" CHECK (("origine" = ANY (ARRAY['technicien'::"text", 'conducteur'::"text"]))),
    CONSTRAINT "tache_travaux_supplementaires_statut_check" CHECK (("statut" = ANY (ARRAY['a_chiffrer'::"text", 'chiffre'::"text", 'refuse'::"text"])))
);


ALTER TABLE "public"."tache_travaux_supplementaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."techniciens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "metier" "text",
    "email" "text",
    "telephone" "text",
    "couleur" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metiers" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."techniciens" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_chantier_avancement" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "chantier_id",
    "c"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "montant_total",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."avancement_cumule") / (100)::numeric)), (0)::numeric) AS "montant_facture",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * ((100)::numeric - "l"."avancement_cumule")) / (100)::numeric)), (0)::numeric) AS "reste_a_facturer"
   FROM ("public"."chantiers" "c"
     LEFT JOIN "public"."chantier_dpgf_lignes" "l" ON ((("l"."chantier_id" = "c"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "c"."id", "c"."societe_id";


ALTER VIEW "public"."v_chantier_avancement" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_devis_totaux" WITH ("security_invoker"='true') AS
 SELECT "d"."id" AS "devis_id",
    "d"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "ht_avant",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) AS "tva_avant",
    "d"."remise_pourcentage",
    (COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "ht",
    (COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "tva",
    ((COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) + COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric)) * ((1)::numeric - ("d"."remise_pourcentage" / (100)::numeric))) AS "ttc"
   FROM ("public"."devis" "d"
     LEFT JOIN "public"."devis_lignes" "l" ON ((("l"."devis_id" = "d"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "d"."id", "d"."societe_id", "d"."remise_pourcentage";


ALTER VIEW "public"."v_devis_totaux" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_facture_totaux" WITH ("security_invoker"='true') AS
 SELECT "f"."id" AS "facture_id",
    "f"."societe_id",
    COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) AS "ht_avant",
    COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) AS "tva_avant",
    "f"."remise_pourcentage",
    (COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "ht",
    (COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "tva",
    ((COALESCE("sum"(("l"."quantite" * "l"."prix_unitaire")), (0)::numeric) + COALESCE("sum"(((("l"."quantite" * "l"."prix_unitaire") * "l"."tva") / (100)::numeric)), (0)::numeric)) * ((1)::numeric - ("f"."remise_pourcentage" / (100)::numeric))) AS "ttc"
   FROM ("public"."factures" "f"
     LEFT JOIN "public"."facture_lignes" "l" ON ((("l"."facture_id" = "f"."id") AND ("l"."type" = 'ligne'::"public"."ligne_type"))))
  GROUP BY "f"."id", "f"."societe_id", "f"."remise_pourcentage";


ALTER VIEW "public"."v_facture_totaux" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_facture_solde" WITH ("security_invoker"='true') AS
 SELECT "f"."id" AS "facture_id",
    "f"."societe_id",
    "t"."ttc",
    COALESCE("r"."paye", (0)::numeric) AS "paye",
    GREATEST((0)::numeric, ("t"."ttc" - COALESCE("r"."paye", (0)::numeric))) AS "reste",
        CASE
            WHEN (COALESCE("r"."paye", (0)::numeric) <= 0.004) THEN 'Impayée'::"text"
            WHEN (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) <= 0.01) THEN 'Payée'::"text"
            ELSE 'Partiel'::"text"
        END AS "etat",
    "f"."echeance",
        CASE
            WHEN (("f"."echeance" IS NOT NULL) AND (("t"."ttc" - COALESCE("r"."paye", (0)::numeric)) > 0.01)) THEN (CURRENT_DATE - "f"."echeance")
            ELSE NULL::integer
        END AS "jours_retard"
   FROM (("public"."factures" "f"
     JOIN "public"."v_facture_totaux" "t" ON (("t"."facture_id" = "f"."id")))
     LEFT JOIN ( SELECT "reglements"."facture_id",
            "sum"("reglements"."montant") AS "paye"
           FROM "public"."reglements"
          GROUP BY "reglements"."facture_id") "r" ON (("r"."facture_id" = "f"."id")));


ALTER VIEW "public"."v_facture_solde" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_cartes_carburant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "fournisseur" "text",
    "numero_carte" "text" DEFAULT ''::"text" NOT NULL,
    "date_emission" "date",
    "date_expiration" "date",
    "plafond_mensuel" numeric,
    "plafond_journalier" numeric,
    "statut" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicule_cartes_carburant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_consommations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "carte_id" "uuid",
    "date_plein" "date" DEFAULT CURRENT_DATE NOT NULL,
    "kilometrage" integer,
    "litres" numeric,
    "prix_litre" numeric,
    "montant_total" numeric,
    "station" "text",
    "type_carburant" "text",
    "notes" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicule_consommations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_controles_periodiques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "date_controle" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effectue_par_salarie_id" "uuid",
    "effectue_par" "text",
    "statut" "text" DEFAULT 'realise'::"text" NOT NULL,
    "pneus_etat" "text",
    "pneus_pression" "text",
    "pneus_notes" "text",
    "huile_niveau" "text",
    "huile_notes" "text",
    "adblue_niveau" "text",
    "adblue_notes" "text",
    "lave_glace_niveau" "text",
    "freins_ok" boolean,
    "eclairage_ok" boolean,
    "nettoyage_interieur" boolean,
    "nettoyage_exterieur" boolean,
    "gilet_securite" boolean,
    "triangle_securite" boolean,
    "kilometrage" integer,
    "notes" "text",
    "photos_url" "text"[],
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicule_controles_periodiques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "type" "text",
    "nom" "text",
    "date_document" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero_document" "text",
    "organisme" "text",
    "date_expiration" "date",
    "notes" "text"
);


ALTER TABLE "public"."vehicule_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_entretiens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "designation" "text" DEFAULT ''::"text" NOT NULL,
    "kilometrage" numeric(12,0),
    "montant" numeric(14,2) DEFAULT 0 NOT NULL,
    "date_entretien" "date",
    "fichier_chemin" "text",
    "fichier_nom" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type_entretien" "text",
    "statut" "text" DEFAULT 'realise'::"text" NOT NULL,
    "prestataire" "text",
    "prochain_entretien_date" "date",
    "prochain_entretien_km" integer,
    "notes" "text"
);


ALTER TABLE "public"."vehicule_entretiens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicule_prets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicule_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "personne" "text",
    "salarie_id" "uuid",
    "date_debut" "date",
    "date_fin" "date",
    "km_depart" numeric(12,0),
    "km_retour" numeric(12,0),
    "etat_depart" "jsonb",
    "etat_retour" "jsonb",
    "commentaire" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicule_prets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "legacy_id" "text",
    "nom" "text" NOT NULL,
    "immatriculation" "text",
    "marque" "text",
    "modele" "text",
    "kilometrage" numeric(12,0),
    "date_controle_technique" "date",
    "telepeage_numero" "text",
    "carte_carburant_numero" "text",
    "vendu" boolean DEFAULT false NOT NULL,
    "date_vente" "date",
    "prix_vente" numeric(14,2),
    "facture_vente_id" "uuid",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "maj_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type_vehicule" "text",
    "motorisation" "text",
    "taille_pneus" "text",
    "date_achat" "date",
    "tva_applicable" boolean,
    "telepeage_fournisseur" "text",
    "telepeage_validite" "date",
    "carte_carburant_fournisseur" "text",
    "carte_carburant_validite" "date",
    "conducteur_salarie_id" "uuid",
    "statut" "text" DEFAULT 'en_service'::"text" NOT NULL,
    "date_premiere_circulation" "date",
    "numero_serie" "text",
    "couleur" "text",
    "carburant" "text",
    "puissance_cv" integer,
    "nombre_places" integer,
    "poids_total" numeric,
    "notes" "text"
);


ALTER TABLE "public"."vehicules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_journal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "entite" "text" NOT NULL,
    "entite_id" "uuid" NOT NULL,
    "ancien_statut" "text",
    "nouveau_statut" "text",
    "auteur_id" "uuid",
    "motif" "text",
    "cree_le" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workflow_journal_entite_check" CHECK (("entite" = ANY (ARRAY['planning_tache'::"text", 'bon_commande'::"text"])))
);


ALTER TABLE "public"."workflow_journal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_articles" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "code" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_clients" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_counters" (
    "societe_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_devis" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "numero" "text",
    "client" "text",
    "statut" "text",
    "date" "date",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_devis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_documents" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_factures" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "numero" "text",
    "client" "text",
    "statut" "text",
    "date" "date",
    "echeance" "date",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_factures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_interlocuteurs" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_interlocuteurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_interventions" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "numero" "text",
    "client" "text",
    "statut" "text",
    "date" "date",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_interventions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_reglements" (
    "id" "text" NOT NULL,
    "societe_id" "text" NOT NULL,
    "facture_id" "text" NOT NULL,
    "montant" numeric,
    "date" "date",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_reglements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_obsolete_settings" (
    "societe_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zz_obsolete_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bon_commande_lignes"
    ADD CONSTRAINT "bon_commande_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bon_commande_photos"
    ADD CONSTRAINT "bon_commande_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_achats"
    ADD CONSTRAINT "chantier_achats_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_achats"
    ADD CONSTRAINT "chantier_achats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_affectations"
    ADD CONSTRAINT "chantier_affectations_chantier_id_profile_id_key" UNIQUE ("chantier_id", "profile_id");



ALTER TABLE ONLY "public"."chantier_affectations"
    ADD CONSTRAINT "chantier_affectations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_avancement_factures"
    ADD CONSTRAINT "chantier_avancement_factures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_comptes_rendus"
    ADD CONSTRAINT "chantier_comptes_rendus_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_comptes_rendus"
    ADD CONSTRAINT "chantier_comptes_rendus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_devis_complementaires"
    ADD CONSTRAINT "chantier_devis_complementaires_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_devis_complementaires"
    ADD CONSTRAINT "chantier_devis_complementaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_documents"
    ADD CONSTRAINT "chantier_documents_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_documents"
    ADD CONSTRAINT "chantier_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_dpgf_lignes"
    ADD CONSTRAINT "chantier_dpgf_lignes_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_dpgf_lignes"
    ADD CONSTRAINT "chantier_dpgf_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_inspections"
    ADD CONSTRAINT "chantier_inspections_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_inspections"
    ADD CONSTRAINT "chantier_inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_todos"
    ADD CONSTRAINT "chantier_todos_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantier_todos"
    ADD CONSTRAINT "chantier_todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantiers"
    ADD CONSTRAINT "chantiers_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."chantiers"
    ADD CONSTRAINT "chantiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compteurs"
    ADD CONSTRAINT "compteurs_pkey" PRIMARY KEY ("societe_id", "type", "annee");



ALTER TABLE ONLY "public"."conducteurs"
    ADD CONSTRAINT "conducteurs_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."conducteurs"
    ADD CONSTRAINT "conducteurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zz_obsolete_counters"
    ADD CONSTRAINT "counters_pkey" PRIMARY KEY ("societe_id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."devis_lignes"
    ADD CONSTRAINT "devis_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zz_obsolete_devis"
    ADD CONSTRAINT "devis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_societe_id_numero_key" UNIQUE ("societe_id", "numero");



ALTER TABLE ONLY "public"."documents_legaux"
    ADD CONSTRAINT "documents_legaux_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."documents_legaux"
    ADD CONSTRAINT "documents_legaux_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zz_obsolete_documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ereporting_depots"
    ADD CONSTRAINT "ereporting_depots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ereporting_depots"
    ADD CONSTRAINT "ereporting_depots_societe_id_periode_flux_key" UNIQUE ("societe_id", "periode", "flux");



ALTER TABLE ONLY "public"."facture_cycle_vie"
    ADD CONSTRAINT "facture_cycle_vie_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facture_entrante_lignes"
    ADD CONSTRAINT "facture_entrante_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facture_lignes"
    ADD CONSTRAINT "facture_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures_entrantes"
    ADD CONSTRAINT "factures_entrantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures_entrantes"
    ADD CONSTRAINT "factures_entrantes_societe_id_pdp_identifiant_key" UNIQUE ("societe_id", "pdp_identifiant");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_factures"
    ADD CONSTRAINT "factures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fournisseur_controle_lignes"
    ADD CONSTRAINT "fournisseur_controle_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fournisseurs_controle"
    ADD CONSTRAINT "fournisseurs_controle_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."fournisseurs_controle"
    ADD CONSTRAINT "fournisseurs_controle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_journal"
    ADD CONSTRAINT "integration_journal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interlocuteurs"
    ADD CONSTRAINT "interlocuteurs_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_interlocuteurs"
    ADD CONSTRAINT "interlocuteurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interlocuteurs"
    ADD CONSTRAINT "interlocuteurs_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_controles"
    ADD CONSTRAINT "intervention_controles_intervention_id_cle_key" UNIQUE ("intervention_id", "cle");



ALTER TABLE ONLY "public"."intervention_controles"
    ADD CONSTRAINT "intervention_controles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervention_photos"
    ADD CONSTRAINT "intervention_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interventions"
    ADD CONSTRAINT "interventions_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_interventions"
    ADD CONSTRAINT "interventions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interventions"
    ADD CONSTRAINT "interventions_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kv_store"
    ADD CONSTRAINT "kv_store_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."materiel_prets"
    ADD CONSTRAINT "materiel_prets_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."materiel_prets"
    ADD CONSTRAINT "materiel_prets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materiels"
    ADD CONSTRAINT "materiels_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."materiels"
    ADD CONSTRAINT "materiels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membres_societe"
    ADD CONSTRAINT "membres_societe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membres_societe"
    ADD CONSTRAINT "membres_societe_profile_id_societe_id_key" UNIQUE ("profile_id", "societe_id");



ALTER TABLE ONLY "public"."metiers"
    ADD CONSTRAINT "metiers_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."metiers"
    ADD CONSTRAINT "metiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metiers"
    ADD CONSTRAINT "metiers_societe_id_libelle_key" UNIQUE ("societe_id", "libelle");



ALTER TABLE ONLY "public"."pdp_connexion_secrets"
    ADD CONSTRAINT "pdp_connexion_secrets_pkey" PRIMARY KEY ("connexion_id");



ALTER TABLE ONLY "public"."pdp_connexions"
    ADD CONSTRAINT "pdp_connexions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pdp_connexions"
    ADD CONSTRAINT "pdp_connexions_societe_id_fournisseur_key" UNIQUE ("societe_id", "fournisseur");



ALTER TABLE ONLY "public"."pdp_oauth_etats"
    ADD CONSTRAINT "pdp_oauth_etats_etat_key" UNIQUE ("etat");



ALTER TABLE ONLY "public"."pdp_oauth_etats"
    ADD CONSTRAINT "pdp_oauth_etats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reglements"
    ADD CONSTRAINT "reglements_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."zz_obsolete_reglements"
    ADD CONSTRAINT "reglements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reglements"
    ADD CONSTRAINT "reglements_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_absences"
    ADD CONSTRAINT "salarie_absences_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."salarie_absences"
    ADD CONSTRAINT "salarie_absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_contacts_urgence"
    ADD CONSTRAINT "salarie_contacts_urgence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_contrats"
    ADD CONSTRAINT "salarie_contrats_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."salarie_contrats"
    ADD CONSTRAINT "salarie_contrats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_documents"
    ADD CONSTRAINT "salarie_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_formations"
    ADD CONSTRAINT "salarie_formations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_habilitations"
    ADD CONSTRAINT "salarie_habilitations_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."salarie_habilitations"
    ADD CONSTRAINT "salarie_habilitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salarie_rdv"
    ADD CONSTRAINT "salarie_rdv_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zz_obsolete_settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("societe_id");



ALTER TABLE ONLY "public"."societe_settings"
    ADD CONSTRAINT "societe_settings_pkey" PRIMARY KEY ("societe_id");



ALTER TABLE ONLY "public"."societes"
    ADD CONSTRAINT "societes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."societes"
    ADD CONSTRAINT "societes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sous_traitant_documents"
    ADD CONSTRAINT "sous_traitant_documents_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."sous_traitant_documents"
    ADD CONSTRAINT "sous_traitant_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sous_traitants"
    ADD CONSTRAINT "sous_traitants_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."sous_traitants"
    ADD CONSTRAINT "sous_traitants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tache_travaux_supplementaires"
    ADD CONSTRAINT "tache_travaux_supplementaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."techniciens"
    ADD CONSTRAINT "techniciens_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."techniciens"
    ADD CONSTRAINT "techniciens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_cartes_carburant"
    ADD CONSTRAINT "vehicule_cartes_carburant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_consommations"
    ADD CONSTRAINT "vehicule_consommations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_controles_periodiques"
    ADD CONSTRAINT "vehicule_controles_periodiques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_documents"
    ADD CONSTRAINT "vehicule_documents_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."vehicule_documents"
    ADD CONSTRAINT "vehicule_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_entretiens"
    ADD CONSTRAINT "vehicule_entretiens_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."vehicule_entretiens"
    ADD CONSTRAINT "vehicule_entretiens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicule_prets"
    ADD CONSTRAINT "vehicule_prets_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."vehicule_prets"
    ADD CONSTRAINT "vehicule_prets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_journal"
    ADD CONSTRAINT "workflow_journal_pkey" PRIMARY KEY ("id");



CREATE INDEX "articles_societe_id_code_idx" ON "public"."articles" USING "btree" ("societe_id", "code");



CREATE INDEX "articles_societe_id_idx" ON "public"."articles" USING "btree" ("societe_id");



CREATE INDEX "bon_commande_photos_bon_commande_id_position_idx" ON "public"."bon_commande_photos" USING "btree" ("bon_commande_id", "position");



CREATE INDEX "bons_commande_client_id_idx" ON "public"."bons_commande" USING "btree" ("client_id");



CREATE INDEX "bons_commande_devis_id_idx" ON "public"."bons_commande" USING "btree" ("devis_id");



CREATE UNIQUE INDEX "bons_commande_numero_interne_unique" ON "public"."bons_commande" USING "btree" ("societe_id", "numero_interne") WHERE ("numero_interne" IS NOT NULL);



CREATE INDEX "bons_commande_societe_id_date_idx" ON "public"."bons_commande" USING "btree" ("societe_id", "date" DESC);



CREATE INDEX "bons_commande_societe_id_date_planifiee_idx" ON "public"."bons_commande" USING "btree" ("societe_id", "date_planifiee");



CREATE INDEX "chantier_achats_chantier_id_idx" ON "public"."chantier_achats" USING "btree" ("chantier_id");



CREATE INDEX "chantier_avancement_factures_dpgf_ligne_id_idx" ON "public"."chantier_avancement_factures" USING "btree" ("dpgf_ligne_id");



CREATE INDEX "chantier_avancement_factures_facture_id_idx" ON "public"."chantier_avancement_factures" USING "btree" ("facture_id");



CREATE INDEX "chantier_comptes_rendus_chantier_id_idx" ON "public"."chantier_comptes_rendus" USING "btree" ("chantier_id");



CREATE INDEX "chantier_devis_complementaires_chantier_id_idx" ON "public"."chantier_devis_complementaires" USING "btree" ("chantier_id");



CREATE INDEX "chantier_documents_chantier_id_famille_idx" ON "public"."chantier_documents" USING "btree" ("chantier_id", "famille");



CREATE INDEX "chantier_dpgf_lignes_chantier_id_position_idx" ON "public"."chantier_dpgf_lignes" USING "btree" ("chantier_id", "position");



CREATE INDEX "chantier_dpgf_lignes_devis_source_id_idx" ON "public"."chantier_dpgf_lignes" USING "btree" ("devis_source_id");



CREATE INDEX "chantier_inspections_chantier_id_idx" ON "public"."chantier_inspections" USING "btree" ("chantier_id");



CREATE INDEX "chantier_todos_chantier_id_statut_position_idx" ON "public"."chantier_todos" USING "btree" ("chantier_id", "statut", "position");



CREATE INDEX "chantiers_client_id_idx" ON "public"."chantiers" USING "btree" ("client_id");



CREATE INDEX "chantiers_societe_id_date_debut_idx" ON "public"."chantiers" USING "btree" ("societe_id", "date_debut" DESC);



CREATE INDEX "clients_societe_id_idx" ON "public"."clients" USING "btree" ("societe_id");



CREATE INDEX "clients_societe_id_lower_idx" ON "public"."clients" USING "btree" ("societe_id", "lower"("nom"));



CREATE INDEX "conducteurs_societe_id_idx" ON "public"."conducteurs" USING "btree" ("societe_id");



CREATE INDEX "devis_chantier_id_idx" ON "public"."devis" USING "btree" ("chantier_id");



CREATE INDEX "devis_client_id_idx" ON "public"."devis" USING "btree" ("client_id");



CREATE INDEX "devis_lignes_devis_id_position_idx" ON "public"."devis_lignes" USING "btree" ("devis_id", "position");



CREATE INDEX "devis_societe_id_date_idx" ON "public"."devis" USING "btree" ("societe_id", "date" DESC);



CREATE INDEX "devis_societe_id_statut_idx" ON "public"."devis" USING "btree" ("societe_id", "statut");



CREATE INDEX "documents_legaux_date_validite_idx" ON "public"."documents_legaux" USING "btree" ("date_validite");



CREATE INDEX "documents_legaux_societe_id_idx" ON "public"."documents_legaux" USING "btree" ("societe_id");



CREATE INDEX "facture_cycle_vie_facture_idx" ON "public"."facture_cycle_vie" USING "btree" ("facture_id");



CREATE INDEX "facture_lignes_facture_id_position_idx" ON "public"."facture_lignes" USING "btree" ("facture_id", "position");



CREATE INDEX "factures_chantier_id_idx" ON "public"."factures" USING "btree" ("chantier_id");



CREATE INDEX "factures_client_id_idx" ON "public"."factures" USING "btree" ("client_id");



CREATE INDEX "factures_devis_id_idx" ON "public"."factures" USING "btree" ("devis_id");



CREATE UNIQUE INDEX "factures_identifiant_unique_idx" ON "public"."factures" USING "btree" ("societe_id", "identifiant_unique") WHERE ("identifiant_unique" IS NOT NULL);



CREATE INDEX "factures_societe_id_date_idx" ON "public"."factures" USING "btree" ("societe_id", "date" DESC);



CREATE INDEX "factures_societe_id_statut_idx" ON "public"."factures" USING "btree" ("societe_id", "statut");



CREATE UNIQUE INDEX "factures_societe_numero_unique_idx" ON "public"."factures" USING "btree" ("societe_id", "numero") WHERE (("numero" IS NOT NULL) AND ("numero" <> ''::"text"));



CREATE INDEX "fournisseur_controle_lignes_fournisseur_id_lower_idx" ON "public"."fournisseur_controle_lignes" USING "btree" ("fournisseur_id", "lower"("designation"));



CREATE INDEX "fournisseur_controle_lignes_fournisseur_id_origine_idx" ON "public"."fournisseur_controle_lignes" USING "btree" ("fournisseur_id", "origine");



CREATE INDEX "fournisseurs_controle_societe_id_idx" ON "public"."fournisseurs_controle" USING "btree" ("societe_id");



CREATE INDEX "idx_articles_societe" ON "public"."zz_obsolete_articles" USING "btree" ("societe_id");



CREATE INDEX "idx_bon_commande_lignes_bc" ON "public"."bon_commande_lignes" USING "btree" ("bon_commande_id", "position");



CREATE INDEX "idx_chantier_affectations_profil" ON "public"."chantier_affectations" USING "btree" ("profile_id");



CREATE INDEX "idx_clients_societe" ON "public"."zz_obsolete_clients" USING "btree" ("societe_id");



CREATE INDEX "idx_devis_client" ON "public"."zz_obsolete_devis" USING "btree" ("client");



CREATE INDEX "idx_devis_societe" ON "public"."zz_obsolete_devis" USING "btree" ("societe_id");



CREATE INDEX "idx_documents_societe" ON "public"."zz_obsolete_documents" USING "btree" ("societe_id");



CREATE INDEX "idx_factures_client" ON "public"."zz_obsolete_factures" USING "btree" ("client");



CREATE INDEX "idx_factures_entrantes_societe" ON "public"."factures_entrantes" USING "btree" ("societe_id", "recue_le" DESC);



CREATE INDEX "idx_factures_societe" ON "public"."zz_obsolete_factures" USING "btree" ("societe_id");



CREATE INDEX "idx_factures_statut" ON "public"."zz_obsolete_factures" USING "btree" ("statut");



CREATE INDEX "idx_integration_journal_societe" ON "public"."integration_journal" USING "btree" ("societe_id", "cree_le" DESC);



CREATE INDEX "idx_interlocuteurs_client" ON "public"."zz_obsolete_interlocuteurs" USING "btree" ("client_id");



CREATE INDEX "idx_interventions_client" ON "public"."zz_obsolete_interventions" USING "btree" ("client");



CREATE INDEX "idx_interventions_societe" ON "public"."zz_obsolete_interventions" USING "btree" ("societe_id");



CREATE UNIQUE INDEX "idx_invitations_societe_email" ON "public"."invitations" USING "btree" ("societe_id", "lower"("email"));



CREATE INDEX "idx_planning_taches_bc" ON "public"."planning_taches" USING "btree" ("bon_commande_id");



CREATE INDEX "idx_planning_taches_statut" ON "public"."planning_taches" USING "btree" ("societe_id", "statut");



CREATE INDEX "idx_reglements_facture" ON "public"."zz_obsolete_reglements" USING "btree" ("facture_id");



CREATE INDEX "idx_reglements_societe" ON "public"."zz_obsolete_reglements" USING "btree" ("societe_id");



CREATE INDEX "idx_salaries_profile" ON "public"."salaries" USING "btree" ("profile_id");



CREATE INDEX "idx_sous_traitants_profile" ON "public"."sous_traitants" USING "btree" ("contact_profile_id");



CREATE INDEX "idx_ts_bc" ON "public"."tache_travaux_supplementaires" USING "btree" ("bon_commande_id");



CREATE INDEX "idx_ts_tache" ON "public"."tache_travaux_supplementaires" USING "btree" ("planning_tache_id");



CREATE INDEX "idx_veh_cartes_vehicule" ON "public"."vehicule_cartes_carburant" USING "btree" ("vehicule_id");



CREATE INDEX "idx_veh_conso_vehicule" ON "public"."vehicule_consommations" USING "btree" ("vehicule_id");



CREATE INDEX "idx_veh_controles_vehicule" ON "public"."vehicule_controles_periodiques" USING "btree" ("vehicule_id");



CREATE INDEX "idx_wj_entite" ON "public"."workflow_journal" USING "btree" ("entite", "entite_id");



CREATE INDEX "interlocuteurs_client_id_idx" ON "public"."interlocuteurs" USING "btree" ("client_id");



CREATE INDEX "intervention_controles_intervention_id_idx" ON "public"."intervention_controles" USING "btree" ("intervention_id");



CREATE INDEX "intervention_photos_intervention_id_position_idx" ON "public"."intervention_photos" USING "btree" ("intervention_id", "position");



CREATE INDEX "interventions_client_id_idx" ON "public"."interventions" USING "btree" ("client_id");



CREATE INDEX "interventions_societe_id_date_idx" ON "public"."interventions" USING "btree" ("societe_id", "date" DESC);



CREATE INDEX "materiel_prets_materiel_id_date_debut_idx" ON "public"."materiel_prets" USING "btree" ("materiel_id", "date_debut" DESC);



CREATE INDEX "materiels_societe_id_idx" ON "public"."materiels" USING "btree" ("societe_id");



CREATE INDEX "membres_societe_profile_id_idx" ON "public"."membres_societe" USING "btree" ("profile_id");



CREATE INDEX "membres_societe_societe_id_idx" ON "public"."membres_societe" USING "btree" ("societe_id");



CREATE INDEX "planning_taches_societe_id_date_tache_idx" ON "public"."planning_taches" USING "btree" ("societe_id", "date_tache");



CREATE INDEX "planning_taches_sous_traitant_id_date_tache_idx" ON "public"."planning_taches" USING "btree" ("sous_traitant_id", "date_tache");



CREATE INDEX "planning_taches_technicien_id_date_tache_idx" ON "public"."planning_taches" USING "btree" ("technicien_id", "date_tache");



CREATE INDEX "reglements_facture_id_idx" ON "public"."reglements" USING "btree" ("facture_id");



CREATE INDEX "reglements_societe_id_date_idx" ON "public"."reglements" USING "btree" ("societe_id", "date" DESC);



CREATE INDEX "salarie_absences_salarie_id_date_debut_idx" ON "public"."salarie_absences" USING "btree" ("salarie_id", "date_debut");



CREATE INDEX "salarie_contrats_salarie_id_type_idx" ON "public"."salarie_contrats" USING "btree" ("salarie_id", "type");



CREATE INDEX "salarie_habilitations_date_expiration_idx" ON "public"."salarie_habilitations" USING "btree" ("date_expiration");



CREATE INDEX "salarie_habilitations_salarie_id_idx" ON "public"."salarie_habilitations" USING "btree" ("salarie_id");



CREATE INDEX "salaries_carte_btp_idx" ON "public"."salaries" USING "btree" ("carte_btp_validite");



CREATE INDEX "salaries_societe_id_idx" ON "public"."salaries" USING "btree" ("societe_id");



CREATE INDEX "salaries_visite_medicale_idx" ON "public"."salaries" USING "btree" ("visite_medicale_prochaine");



CREATE INDEX "sous_traitant_documents_date_validite_idx" ON "public"."sous_traitant_documents" USING "btree" ("date_validite");



CREATE INDEX "sous_traitant_documents_sous_traitant_id_idx" ON "public"."sous_traitant_documents" USING "btree" ("sous_traitant_id");



CREATE INDEX "sous_traitants_societe_id_idx" ON "public"."sous_traitants" USING "btree" ("societe_id");



CREATE INDEX "techniciens_societe_id_idx" ON "public"."techniciens" USING "btree" ("societe_id");



CREATE INDEX "vehicule_documents_vehicule_id_idx" ON "public"."vehicule_documents" USING "btree" ("vehicule_id");



CREATE INDEX "vehicule_entretiens_vehicule_id_date_entretien_idx" ON "public"."vehicule_entretiens" USING "btree" ("vehicule_id", "date_entretien" DESC);



CREATE INDEX "vehicule_prets_vehicule_id_date_debut_idx" ON "public"."vehicule_prets" USING "btree" ("vehicule_id", "date_debut" DESC);



CREATE INDEX "vehicules_carburant_validite_idx" ON "public"."vehicules" USING "btree" ("carte_carburant_validite");



CREATE INDEX "vehicules_date_controle_technique_idx" ON "public"."vehicules" USING "btree" ("date_controle_technique");



CREATE INDEX "vehicules_societe_id_idx" ON "public"."vehicules" USING "btree" ("societe_id");



CREATE INDEX "vehicules_telepeage_validite_idx" ON "public"."vehicules" USING "btree" ("telepeage_validite");



CREATE OR REPLACE TRIGGER "trg_absences_maj" BEFORE UPDATE ON "public"."salarie_absences" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_achats_maj" BEFORE UPDATE ON "public"."chantier_achats" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_amorcer_premier_admin" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."amorcer_premier_admin"();



CREATE OR REPLACE TRIGGER "trg_articles_maj" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_bons_commande_maj" BEFORE UPDATE ON "public"."bons_commande" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_chantier_affectations_maj" BEFORE UPDATE ON "public"."chantier_affectations" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_chantier_documents_maj" BEFORE UPDATE ON "public"."chantier_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_chantiers_maj" BEFORE UPDATE ON "public"."chantiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_clients_maj" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_conducteurs_maj" BEFORE UPDATE ON "public"."conducteurs" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_contrats_maj" BEFORE UPDATE ON "public"."salarie_contrats" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_cr_maj" BEFORE UPDATE ON "public"."chantier_comptes_rendus" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_devis_comp_maj" BEFORE UPDATE ON "public"."chantier_devis_complementaires" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_devis_maj" BEFORE UPDATE ON "public"."devis" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_documents_legaux_maj" BEFORE UPDATE ON "public"."documents_legaux" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_dpgf_maj" BEFORE UPDATE ON "public"."chantier_dpgf_lignes" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_entretiens_maj" BEFORE UPDATE ON "public"."vehicule_entretiens" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_ereporting_depots_maj" BEFORE UPDATE ON "public"."ereporting_depots" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_factures_entrantes_maj" BEFORE UPDATE ON "public"."factures_entrantes" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_factures_maj" BEFORE UPDATE ON "public"."factures" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_fournisseurs_maj" BEFORE UPDATE ON "public"."fournisseurs_controle" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_habilitations_maj" BEFORE UPDATE ON "public"."salarie_habilitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_inspections_maj" BEFORE UPDATE ON "public"."chantier_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_interlocuteurs_maj" BEFORE UPDATE ON "public"."interlocuteurs" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_interventions_maj" BEFORE UPDATE ON "public"."interventions" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_invitations_maj" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_mat_prets_maj" BEFORE UPDATE ON "public"."materiel_prets" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_materiels_maj" BEFORE UPDATE ON "public"."materiels" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_membres_maj" BEFORE UPDATE ON "public"."membres_societe" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_metiers_maj" BEFORE UPDATE ON "public"."metiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_pdp_connexion_secrets_maj" BEFORE UPDATE ON "public"."pdp_connexion_secrets" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_pdp_connexions_maj" BEFORE UPDATE ON "public"."pdp_connexions" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_planning_maj" BEFORE UPDATE ON "public"."planning_taches" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_profiles_maj" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_proteger_dernier_admin" BEFORE DELETE OR UPDATE ON "public"."membres_societe" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_dernier_admin"();



CREATE OR REPLACE TRIGGER "trg_reglements_maj" BEFORE UPDATE ON "public"."reglements" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_salarie_contacts_maj" BEFORE UPDATE ON "public"."salarie_contacts_urgence" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_salarie_documents_maj" BEFORE UPDATE ON "public"."salarie_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_salarie_formations_maj" BEFORE UPDATE ON "public"."salarie_formations" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_salarie_rdv_maj" BEFORE UPDATE ON "public"."salarie_rdv" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_salaries_maj" BEFORE UPDATE ON "public"."salaries" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_societe_settings_maj" BEFORE UPDATE ON "public"."societe_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_societes_maj" BEFORE UPDATE ON "public"."societes" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_sous_traitants_maj" BEFORE UPDATE ON "public"."sous_traitants" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_st_docs_maj" BEFORE UPDATE ON "public"."sous_traitant_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_techniciens_maj" BEFORE UPDATE ON "public"."techniciens" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_todos_maj" BEFORE UPDATE ON "public"."chantier_todos" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_veh_cartes_maj" BEFORE UPDATE ON "public"."vehicule_cartes_carburant" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_veh_conso_maj" BEFORE UPDATE ON "public"."vehicule_consommations" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_veh_controles_maj" BEFORE UPDATE ON "public"."vehicule_controles_periodiques" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_veh_docs_maj" BEFORE UPDATE ON "public"."vehicule_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_veh_prets_maj" BEFORE UPDATE ON "public"."vehicule_prets" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



CREATE OR REPLACE TRIGGER "trg_vehicules_maj" BEFORE UPDATE ON "public"."vehicules" FOR EACH ROW EXECUTE FUNCTION "public"."set_maj_le"();



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bon_commande_lignes"
    ADD CONSTRAINT "bon_commande_lignes_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bon_commande_photos"
    ADD CONSTRAINT "bon_commande_photos_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_bon_commande_parent_id_fkey" FOREIGN KEY ("bon_commande_parent_id") REFERENCES "public"."bons_commande"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bons_commande"
    ADD CONSTRAINT "bons_commande_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_achats"
    ADD CONSTRAINT "chantier_achats_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_affectations"
    ADD CONSTRAINT "chantier_affectations_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_affectations"
    ADD CONSTRAINT "chantier_affectations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_affectations"
    ADD CONSTRAINT "chantier_affectations_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_avancement_factures"
    ADD CONSTRAINT "chantier_avancement_factures_dpgf_ligne_id_fkey" FOREIGN KEY ("dpgf_ligne_id") REFERENCES "public"."chantier_dpgf_lignes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_avancement_factures"
    ADD CONSTRAINT "chantier_avancement_factures_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_comptes_rendus"
    ADD CONSTRAINT "chantier_comptes_rendus_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_devis_complementaires"
    ADD CONSTRAINT "chantier_devis_complementaires_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_devis_complementaires"
    ADD CONSTRAINT "chantier_devis_complementaires_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chantier_documents"
    ADD CONSTRAINT "chantier_documents_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_dpgf_lignes"
    ADD CONSTRAINT "chantier_dpgf_lignes_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_dpgf_lignes"
    ADD CONSTRAINT "chantier_dpgf_lignes_devis_source_id_fkey" FOREIGN KEY ("devis_source_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chantier_inspections"
    ADD CONSTRAINT "chantier_inspections_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_todos"
    ADD CONSTRAINT "chantier_todos_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_todos"
    ADD CONSTRAINT "chantier_todos_salarie_fk" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chantiers"
    ADD CONSTRAINT "chantiers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chantiers"
    ADD CONSTRAINT "chantiers_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compteurs"
    ADD CONSTRAINT "compteurs_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conducteurs"
    ADD CONSTRAINT "conducteurs_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_chantier_fk" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_intervention_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis_lignes"
    ADD CONSTRAINT "devis_lignes_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents_legaux"
    ADD CONSTRAINT "documents_legaux_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ereporting_depots"
    ADD CONSTRAINT "ereporting_depots_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_cycle_vie"
    ADD CONSTRAINT "facture_cycle_vie_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."facture_cycle_vie"
    ADD CONSTRAINT "facture_cycle_vie_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_entrante_lignes"
    ADD CONSTRAINT "facture_entrante_lignes_facture_entrante_id_fkey" FOREIGN KEY ("facture_entrante_id") REFERENCES "public"."factures_entrantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_lignes"
    ADD CONSTRAINT "facture_lignes_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_bon_commande_fk" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_chantier_fk" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures_entrantes"
    ADD CONSTRAINT "factures_entrantes_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures_entrantes"
    ADD CONSTRAINT "factures_entrantes_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures_entrantes"
    ADD CONSTRAINT "factures_entrantes_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_facture_rectifiee_id_fkey" FOREIGN KEY ("facture_rectifiee_id") REFERENCES "public"."factures"("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_intervention_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fournisseur_controle_lignes"
    ADD CONSTRAINT "fournisseur_controle_lignes_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs_controle"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fournisseurs_controle"
    ADD CONSTRAINT "fournisseurs_controle_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_journal"
    ADD CONSTRAINT "integration_journal_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interlocuteurs"
    ADD CONSTRAINT "interlocuteurs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_controles"
    ADD CONSTRAINT "intervention_controles_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intervention_photos"
    ADD CONSTRAINT "intervention_photos_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interventions"
    ADD CONSTRAINT "interventions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interventions"
    ADD CONSTRAINT "interventions_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "public"."sous_traitants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiel_prets"
    ADD CONSTRAINT "materiel_prets_materiel_id_fkey" FOREIGN KEY ("materiel_id") REFERENCES "public"."materiels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materiel_prets"
    ADD CONSTRAINT "materiel_prets_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materiels"
    ADD CONSTRAINT "materiels_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membres_societe"
    ADD CONSTRAINT "membres_societe_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membres_societe"
    ADD CONSTRAINT "membres_societe_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metiers"
    ADD CONSTRAINT "metiers_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdp_connexion_secrets"
    ADD CONSTRAINT "pdp_connexion_secrets_connexion_id_fkey" FOREIGN KEY ("connexion_id") REFERENCES "public"."pdp_connexions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdp_connexions"
    ADD CONSTRAINT "pdp_connexions_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdp_oauth_etats"
    ADD CONSTRAINT "pdp_oauth_etats_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pdp_oauth_etats"
    ADD CONSTRAINT "pdp_oauth_etats_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_chantier_id_fkey" FOREIGN KEY ("chantier_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_dpgf_ligne_id_fkey" FOREIGN KEY ("dpgf_ligne_id") REFERENCES "public"."chantier_dpgf_lignes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "public"."sous_traitants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_taches"
    ADD CONSTRAINT "planning_taches_technicien_id_fkey" FOREIGN KEY ("technicien_id") REFERENCES "public"."techniciens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reglements"
    ADD CONSTRAINT "reglements_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reglements"
    ADD CONSTRAINT "reglements_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_absences"
    ADD CONSTRAINT "salarie_absences_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_contacts_urgence"
    ADD CONSTRAINT "salarie_contacts_urgence_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_contrats"
    ADD CONSTRAINT "salarie_contrats_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_documents"
    ADD CONSTRAINT "salarie_documents_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_formations"
    ADD CONSTRAINT "salarie_formations_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_habilitations"
    ADD CONSTRAINT "salarie_habilitations_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salarie_rdv"
    ADD CONSTRAINT "salarie_rdv_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salaries"
    ADD CONSTRAINT "salaries_technicien_id_fkey" FOREIGN KEY ("technicien_id") REFERENCES "public"."techniciens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."societe_settings"
    ADD CONSTRAINT "societe_settings_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sous_traitant_documents"
    ADD CONSTRAINT "sous_traitant_documents_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "public"."sous_traitants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sous_traitants"
    ADD CONSTRAINT "sous_traitants_contact_profile_id_fkey" FOREIGN KEY ("contact_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sous_traitants"
    ADD CONSTRAINT "sous_traitants_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tache_travaux_supplementaires"
    ADD CONSTRAINT "tache_travaux_supplementaires_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "public"."bons_commande"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tache_travaux_supplementaires"
    ADD CONSTRAINT "tache_travaux_supplementaires_planning_tache_id_fkey" FOREIGN KEY ("planning_tache_id") REFERENCES "public"."planning_taches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tache_travaux_supplementaires"
    ADD CONSTRAINT "tache_travaux_supplementaires_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."techniciens"
    ADD CONSTRAINT "techniciens_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_cartes_carburant"
    ADD CONSTRAINT "vehicule_cartes_carburant_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_consommations"
    ADD CONSTRAINT "vehicule_consommations_carte_id_fkey" FOREIGN KEY ("carte_id") REFERENCES "public"."vehicule_cartes_carburant"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicule_consommations"
    ADD CONSTRAINT "vehicule_consommations_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_controles_periodiques"
    ADD CONSTRAINT "vehicule_controles_periodiques_effectue_par_salarie_id_fkey" FOREIGN KEY ("effectue_par_salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicule_controles_periodiques"
    ADD CONSTRAINT "vehicule_controles_periodiques_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_documents"
    ADD CONSTRAINT "vehicule_documents_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_entretiens"
    ADD CONSTRAINT "vehicule_entretiens_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicule_prets"
    ADD CONSTRAINT "vehicule_prets_salarie_id_fkey" FOREIGN KEY ("salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicule_prets"
    ADD CONSTRAINT "vehicule_prets_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_conducteur_salarie_id_fkey" FOREIGN KEY ("conducteur_salarie_id") REFERENCES "public"."salaries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_facture_vente_id_fkey" FOREIGN KEY ("facture_vente_id") REFERENCES "public"."factures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicules"
    ADD CONSTRAINT "vehicules_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_journal"
    ADD CONSTRAINT "workflow_journal_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."societes"("id") ON DELETE CASCADE;



ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "articles_delete" ON "public"."articles" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "articles_insert" ON "public"."articles" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "articles_select" ON "public"."articles" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "articles_update" ON "public"."articles" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."bon_commande_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bon_commande_lignes_delete" ON "public"."bon_commande_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_lignes"."bon_commande_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "bon_commande_lignes_insert" ON "public"."bon_commande_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_lignes"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "bon_commande_lignes_select" ON "public"."bon_commande_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_lignes"."bon_commande_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "bon_commande_lignes_update" ON "public"."bon_commande_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_lignes"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_lignes"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."bon_commande_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bon_commande_photos_delete" ON "public"."bon_commande_photos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_photos"."bon_commande_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "bon_commande_photos_insert" ON "public"."bon_commande_photos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_photos"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "bon_commande_photos_select" ON "public"."bon_commande_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_photos"."bon_commande_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "bon_commande_photos_update" ON "public"."bon_commande_photos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_photos"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bons_commande" "p"
  WHERE (("p"."id" = "bon_commande_photos"."bon_commande_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."bons_commande" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bons_commande_delete" ON "public"."bons_commande" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'bons_commande'::"text", 'supprimer'::"text"));



CREATE POLICY "bons_commande_insert" ON "public"."bons_commande" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'bons_commande'::"text", 'creer'::"text"));



CREATE POLICY "bons_commande_select" ON "public"."bons_commande" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "bons_commande_update" ON "public"."bons_commande" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'bons_commande'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'bons_commande'::"text", 'modifier'::"text"));



ALTER TABLE "public"."chantier_achats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_achats_delete" ON "public"."chantier_achats" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_achats"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_achats_insert" ON "public"."chantier_achats" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_achats"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_achats_select" ON "public"."chantier_achats" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_achats"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_achats_update" ON "public"."chantier_achats" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_achats"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_achats"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_affectations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_affectations_delete" ON "public"."chantier_affectations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_affectations"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_affectations_insert" ON "public"."chantier_affectations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_affectations"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_affectations_select" ON "public"."chantier_affectations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_affectations"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_affectations_update" ON "public"."chantier_affectations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_affectations"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_affectations"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_avancement_factures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_avancement_factures_delete" ON "public"."chantier_avancement_factures" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "chantier_avancement_factures"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_avancement_factures_insert" ON "public"."chantier_avancement_factures" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "chantier_avancement_factures"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_avancement_factures_select" ON "public"."chantier_avancement_factures" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "chantier_avancement_factures"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_avancement_factures_update" ON "public"."chantier_avancement_factures" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "chantier_avancement_factures"."facture_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "chantier_avancement_factures"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_comptes_rendus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_comptes_rendus_delete" ON "public"."chantier_comptes_rendus" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "c"
  WHERE (("c"."id" = "chantier_comptes_rendus"."chantier_id") AND "public"."a_permission"("c"."societe_id", 'rapports'::"text", 'supprimer'::"text")))));



CREATE POLICY "chantier_comptes_rendus_insert" ON "public"."chantier_comptes_rendus" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "c"
  WHERE (("c"."id" = "chantier_comptes_rendus"."chantier_id") AND "public"."a_permission"("c"."societe_id", 'rapports'::"text", 'creer'::"text")))));



CREATE POLICY "chantier_comptes_rendus_select" ON "public"."chantier_comptes_rendus" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_comptes_rendus"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_comptes_rendus_update" ON "public"."chantier_comptes_rendus" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "c"
  WHERE (("c"."id" = "chantier_comptes_rendus"."chantier_id") AND "public"."a_permission"("c"."societe_id", 'rapports'::"text", 'modifier'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "c"
  WHERE (("c"."id" = "chantier_comptes_rendus"."chantier_id") AND "public"."a_permission"("c"."societe_id", 'rapports'::"text", 'modifier'::"text")))));



ALTER TABLE "public"."chantier_devis_complementaires" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_devis_complementaires_delete" ON "public"."chantier_devis_complementaires" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_devis_complementaires"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_devis_complementaires_insert" ON "public"."chantier_devis_complementaires" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_devis_complementaires"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_devis_complementaires_select" ON "public"."chantier_devis_complementaires" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_devis_complementaires"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_devis_complementaires_update" ON "public"."chantier_devis_complementaires" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_devis_complementaires"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_devis_complementaires"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_documents_delete" ON "public"."chantier_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_documents"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_documents_insert" ON "public"."chantier_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_documents"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_documents_select" ON "public"."chantier_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_documents"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_documents_update" ON "public"."chantier_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_documents"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_documents"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_dpgf_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_dpgf_lignes_delete" ON "public"."chantier_dpgf_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_dpgf_lignes"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_dpgf_lignes_insert" ON "public"."chantier_dpgf_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_dpgf_lignes"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_dpgf_lignes_select" ON "public"."chantier_dpgf_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_dpgf_lignes"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_dpgf_lignes_update" ON "public"."chantier_dpgf_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_dpgf_lignes"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_dpgf_lignes"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_inspections_delete" ON "public"."chantier_inspections" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_inspections"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_inspections_insert" ON "public"."chantier_inspections" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_inspections"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_inspections_select" ON "public"."chantier_inspections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_inspections"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_inspections_update" ON "public"."chantier_inspections" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_inspections"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_inspections"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantier_todos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_todos_delete" ON "public"."chantier_todos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_todos"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_todos_insert" ON "public"."chantier_todos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_todos"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "chantier_todos_select" ON "public"."chantier_todos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_todos"."chantier_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "chantier_todos_update" ON "public"."chantier_todos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_todos"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chantiers" "p"
  WHERE (("p"."id" = "chantier_todos"."chantier_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."chantiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantiers_delete" ON "public"."chantiers" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'chantiers'::"text", 'supprimer'::"text"));



CREATE POLICY "chantiers_insert" ON "public"."chantiers" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'chantiers'::"text", 'creer'::"text"));



CREATE POLICY "chantiers_select" ON "public"."chantiers" FOR SELECT TO "authenticated" USING (("public"."est_membre"("societe_id") AND "public"."est_affecte_au_chantier"("id")));



CREATE POLICY "chantiers_update" ON "public"."chantiers" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'chantiers'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'chantiers'::"text", 'modifier'::"text"));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete" ON "public"."clients" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'clients'::"text", 'supprimer'::"text"));



CREATE POLICY "clients_insert" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'clients'::"text", 'creer'::"text"));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "clients_update" ON "public"."clients" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'clients'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'clients'::"text", 'modifier'::"text"));



ALTER TABLE "public"."compteurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compteurs_insert" ON "public"."compteurs" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "compteurs_select" ON "public"."compteurs" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "compteurs_update" ON "public"."compteurs" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."conducteurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conducteurs_delete" ON "public"."conducteurs" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "conducteurs_insert" ON "public"."conducteurs" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "conducteurs_select" ON "public"."conducteurs" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "conducteurs_update" ON "public"."conducteurs" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."devis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devis_delete" ON "public"."devis" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'devis'::"text", 'supprimer'::"text"));



CREATE POLICY "devis_insert" ON "public"."devis" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'devis'::"text", 'creer'::"text"));



ALTER TABLE "public"."devis_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devis_lignes_delete" ON "public"."devis_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."devis" "p"
  WHERE (("p"."id" = "devis_lignes"."devis_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "devis_lignes_insert" ON "public"."devis_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devis" "p"
  WHERE (("p"."id" = "devis_lignes"."devis_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "devis_lignes_select" ON "public"."devis_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."devis" "p"
  WHERE (("p"."id" = "devis_lignes"."devis_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "devis_lignes_update" ON "public"."devis_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."devis" "p"
  WHERE (("p"."id" = "devis_lignes"."devis_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devis" "p"
  WHERE (("p"."id" = "devis_lignes"."devis_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "devis_select" ON "public"."devis" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "devis_update" ON "public"."devis" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'devis'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'devis'::"text", 'modifier'::"text"));



ALTER TABLE "public"."documents_legaux" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_legaux_delete" ON "public"."documents_legaux" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "documents_legaux_insert" ON "public"."documents_legaux" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "documents_legaux_select" ON "public"."documents_legaux" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "documents_legaux_update" ON "public"."documents_legaux" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."ereporting_depots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ereporting_depots_delete" ON "public"."ereporting_depots" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'supprimer'::"text"));



CREATE POLICY "ereporting_depots_insert" ON "public"."ereporting_depots" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'creer'::"text"));



CREATE POLICY "ereporting_depots_select" ON "public"."ereporting_depots" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "ereporting_depots_update" ON "public"."ereporting_depots" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'modifier'::"text"));



ALTER TABLE "public"."facture_cycle_vie" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facture_cycle_vie_delete" ON "public"."facture_cycle_vie" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_cycle_vie"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_cycle_vie_insert" ON "public"."facture_cycle_vie" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_cycle_vie"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "facture_cycle_vie_select" ON "public"."facture_cycle_vie" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_cycle_vie"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_cycle_vie_update" ON "public"."facture_cycle_vie" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_cycle_vie"."facture_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_cycle_vie"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."facture_entrante_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facture_entrante_lignes_delete" ON "public"."facture_entrante_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures_entrantes" "p"
  WHERE (("p"."id" = "facture_entrante_lignes"."facture_entrante_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_entrante_lignes_insert" ON "public"."facture_entrante_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures_entrantes" "p"
  WHERE (("p"."id" = "facture_entrante_lignes"."facture_entrante_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "facture_entrante_lignes_select" ON "public"."facture_entrante_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures_entrantes" "p"
  WHERE (("p"."id" = "facture_entrante_lignes"."facture_entrante_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_entrante_lignes_update" ON "public"."facture_entrante_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures_entrantes" "p"
  WHERE (("p"."id" = "facture_entrante_lignes"."facture_entrante_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures_entrantes" "p"
  WHERE (("p"."id" = "facture_entrante_lignes"."facture_entrante_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."facture_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facture_lignes_delete" ON "public"."facture_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_lignes"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_lignes_insert" ON "public"."facture_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_lignes"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "facture_lignes_select" ON "public"."facture_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_lignes"."facture_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "facture_lignes_update" ON "public"."facture_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_lignes"."facture_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."factures" "p"
  WHERE (("p"."id" = "facture_lignes"."facture_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."factures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factures_delete" ON "public"."factures" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'factures'::"text", 'supprimer'::"text"));



ALTER TABLE "public"."factures_entrantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factures_entrantes_delete" ON "public"."factures_entrantes" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "factures_entrantes_insert" ON "public"."factures_entrantes" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "factures_entrantes_select" ON "public"."factures_entrantes" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "factures_entrantes_update" ON "public"."factures_entrantes" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "factures_insert" ON "public"."factures" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'factures'::"text", 'creer'::"text"));



CREATE POLICY "factures_select" ON "public"."factures" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "factures_update" ON "public"."factures" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'factures'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'factures'::"text", 'modifier'::"text"));



ALTER TABLE "public"."fournisseur_controle_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fournisseur_controle_lignes_delete" ON "public"."fournisseur_controle_lignes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fournisseurs_controle" "p"
  WHERE (("p"."id" = "fournisseur_controle_lignes"."fournisseur_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "fournisseur_controle_lignes_insert" ON "public"."fournisseur_controle_lignes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fournisseurs_controle" "p"
  WHERE (("p"."id" = "fournisseur_controle_lignes"."fournisseur_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "fournisseur_controle_lignes_select" ON "public"."fournisseur_controle_lignes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fournisseurs_controle" "p"
  WHERE (("p"."id" = "fournisseur_controle_lignes"."fournisseur_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "fournisseur_controle_lignes_update" ON "public"."fournisseur_controle_lignes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fournisseurs_controle" "p"
  WHERE (("p"."id" = "fournisseur_controle_lignes"."fournisseur_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fournisseurs_controle" "p"
  WHERE (("p"."id" = "fournisseur_controle_lignes"."fournisseur_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."fournisseurs_controle" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fournisseurs_controle_delete" ON "public"."fournisseurs_controle" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "fournisseurs_controle_insert" ON "public"."fournisseurs_controle" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "fournisseurs_controle_select" ON "public"."fournisseurs_controle" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "fournisseurs_controle_update" ON "public"."fournisseurs_controle" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."integration_journal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_journal_insert" ON "public"."integration_journal" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "integration_journal_select" ON "public"."integration_journal" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



ALTER TABLE "public"."interlocuteurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interlocuteurs_delete" ON "public"."interlocuteurs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "p"
  WHERE (("p"."id" = "interlocuteurs"."client_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "interlocuteurs_insert" ON "public"."interlocuteurs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "p"
  WHERE (("p"."id" = "interlocuteurs"."client_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "interlocuteurs_select" ON "public"."interlocuteurs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "p"
  WHERE (("p"."id" = "interlocuteurs"."client_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "interlocuteurs_update" ON "public"."interlocuteurs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "p"
  WHERE (("p"."id" = "interlocuteurs"."client_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "p"
  WHERE (("p"."id" = "interlocuteurs"."client_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."intervention_controles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intervention_controles_delete" ON "public"."intervention_controles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_controles"."intervention_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "intervention_controles_insert" ON "public"."intervention_controles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_controles"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "intervention_controles_select" ON "public"."intervention_controles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_controles"."intervention_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "intervention_controles_update" ON "public"."intervention_controles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_controles"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_controles"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."intervention_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intervention_photos_delete" ON "public"."intervention_photos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_photos"."intervention_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "intervention_photos_insert" ON "public"."intervention_photos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_photos"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "intervention_photos_select" ON "public"."intervention_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_photos"."intervention_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "intervention_photos_update" ON "public"."intervention_photos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_photos"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."interventions" "p"
  WHERE (("p"."id" = "intervention_photos"."intervention_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."interventions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interventions_delete" ON "public"."interventions" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'rapports'::"text", 'supprimer'::"text"));



CREATE POLICY "interventions_insert" ON "public"."interventions" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'rapports'::"text", 'creer'::"text"));



CREATE POLICY "interventions_select" ON "public"."interventions" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "interventions_update" ON "public"."interventions" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'rapports'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'rapports'::"text", 'modifier'::"text"));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_delete" ON "public"."invitations" FOR DELETE TO "authenticated" USING ("public"."est_admin"("societe_id"));



CREATE POLICY "invitations_insert" ON "public"."invitations" FOR INSERT TO "authenticated" WITH CHECK ("public"."est_admin"("societe_id"));



CREATE POLICY "invitations_select" ON "public"."invitations" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "invitations_update" ON "public"."invitations" FOR UPDATE TO "authenticated" USING ("public"."est_admin"("societe_id")) WITH CHECK ("public"."est_admin"("societe_id"));



ALTER TABLE "public"."kv_store" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materiel_prets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiel_prets_delete" ON "public"."materiel_prets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."materiels" "p"
  WHERE (("p"."id" = "materiel_prets"."materiel_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "materiel_prets_insert" ON "public"."materiel_prets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."materiels" "p"
  WHERE (("p"."id" = "materiel_prets"."materiel_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "materiel_prets_select" ON "public"."materiel_prets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."materiels" "p"
  WHERE (("p"."id" = "materiel_prets"."materiel_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "materiel_prets_update" ON "public"."materiel_prets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."materiels" "p"
  WHERE (("p"."id" = "materiel_prets"."materiel_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."materiels" "p"
  WHERE (("p"."id" = "materiel_prets"."materiel_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."materiels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materiels_delete" ON "public"."materiels" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'materiel'::"text", 'supprimer'::"text"));



CREATE POLICY "materiels_insert" ON "public"."materiels" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'materiel'::"text", 'creer'::"text"));



CREATE POLICY "materiels_select" ON "public"."materiels" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "materiels_update" ON "public"."materiels" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'materiel'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'materiel'::"text", 'modifier'::"text"));



CREATE POLICY "membres_delete" ON "public"."membres_societe" FOR DELETE TO "authenticated" USING ("public"."est_admin"("societe_id"));



CREATE POLICY "membres_insert" ON "public"."membres_societe" FOR INSERT TO "authenticated" WITH CHECK ("public"."est_admin"("societe_id"));



CREATE POLICY "membres_select" ON "public"."membres_societe" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."est_membre"("societe_id")));



ALTER TABLE "public"."membres_societe" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membres_update" ON "public"."membres_societe" FOR UPDATE TO "authenticated" USING ("public"."est_admin"("societe_id")) WITH CHECK ("public"."est_admin"("societe_id"));



ALTER TABLE "public"."metiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metiers_delete" ON "public"."metiers" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "metiers_insert" ON "public"."metiers" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "metiers_select" ON "public"."metiers" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "metiers_update" ON "public"."metiers" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."pdp_connexion_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pdp_connexions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pdp_connexions_delete" ON "public"."pdp_connexions" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'supprimer'::"text"));



CREATE POLICY "pdp_connexions_insert" ON "public"."pdp_connexions" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'creer'::"text"));



CREATE POLICY "pdp_connexions_select" ON "public"."pdp_connexions" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "pdp_connexions_update" ON "public"."pdp_connexions" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'facturation_electronique'::"text", 'modifier'::"text"));



ALTER TABLE "public"."pdp_oauth_etats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_taches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planning_taches_delete" ON "public"."planning_taches" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "planning_taches_insert" ON "public"."planning_taches" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "planning_taches_select" ON "public"."planning_taches" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "planning_taches_update" ON "public"."planning_taches" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."membres_societe" "m"
  WHERE (("m"."profile_id" = "profiles"."id") AND ("m"."societe_id" IN ( SELECT "public"."mes_societes"() AS "mes_societes")))))));



CREATE POLICY "profiles_select_membres" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."membres_societe" "m"
  WHERE (("m"."profile_id" = "profiles"."id") AND ("m"."societe_id" IN ( SELECT "public"."mes_societes"() AS "mes_societes")))))));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."reglements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reglements_delete" ON "public"."reglements" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'reglements'::"text", 'supprimer'::"text"));



CREATE POLICY "reglements_insert" ON "public"."reglements" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'reglements'::"text", 'creer'::"text"));



CREATE POLICY "reglements_select" ON "public"."reglements" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "reglements_update" ON "public"."reglements" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'reglements'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'reglements'::"text", 'modifier'::"text"));



ALTER TABLE "public"."salarie_absences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_absences_delete" ON "public"."salarie_absences" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_absences"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_absences_insert" ON "public"."salarie_absences" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_absences"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_absences_select" ON "public"."salarie_absences" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_absences"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_absences_update" ON "public"."salarie_absences" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_absences"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_absences"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_contacts_urgence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_contacts_urgence_delete" ON "public"."salarie_contacts_urgence" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contacts_urgence"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_contacts_urgence_insert" ON "public"."salarie_contacts_urgence" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contacts_urgence"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_contacts_urgence_select" ON "public"."salarie_contacts_urgence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contacts_urgence"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_contacts_urgence_update" ON "public"."salarie_contacts_urgence" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contacts_urgence"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contacts_urgence"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_contrats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_contrats_delete" ON "public"."salarie_contrats" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contrats"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_contrats_insert" ON "public"."salarie_contrats" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contrats"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_contrats_select" ON "public"."salarie_contrats" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contrats"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_contrats_update" ON "public"."salarie_contrats" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contrats"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_contrats"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_documents_delete" ON "public"."salarie_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_documents"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_documents_insert" ON "public"."salarie_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_documents"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_documents_select" ON "public"."salarie_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_documents"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_documents_update" ON "public"."salarie_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_documents"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_documents"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_formations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_formations_delete" ON "public"."salarie_formations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_formations"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_formations_insert" ON "public"."salarie_formations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_formations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_formations_select" ON "public"."salarie_formations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_formations"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_formations_update" ON "public"."salarie_formations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_formations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_formations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_habilitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_habilitations_delete" ON "public"."salarie_habilitations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_habilitations"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_habilitations_insert" ON "public"."salarie_habilitations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_habilitations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_habilitations_select" ON "public"."salarie_habilitations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_habilitations"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_habilitations_update" ON "public"."salarie_habilitations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_habilitations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_habilitations"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salarie_rdv" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salarie_rdv_delete" ON "public"."salarie_rdv" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_rdv"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_rdv_insert" ON "public"."salarie_rdv" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_rdv"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "salarie_rdv_select" ON "public"."salarie_rdv" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_rdv"."salarie_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "salarie_rdv_update" ON "public"."salarie_rdv" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_rdv"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."salaries" "p"
  WHERE (("p"."id" = "salarie_rdv"."salarie_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."salaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salaries_delete" ON "public"."salaries" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'rh'::"text", 'supprimer'::"text"));



CREATE POLICY "salaries_insert" ON "public"."salaries" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'rh'::"text", 'creer'::"text"));



CREATE POLICY "salaries_select" ON "public"."salaries" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "salaries_update" ON "public"."salaries" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'rh'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'rh'::"text", 'modifier'::"text"));



ALTER TABLE "public"."societe_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "societe_settings_delete" ON "public"."societe_settings" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'reglages'::"text", 'supprimer'::"text"));



CREATE POLICY "societe_settings_insert" ON "public"."societe_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'reglages'::"text", 'creer'::"text"));



CREATE POLICY "societe_settings_select" ON "public"."societe_settings" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "societe_settings_update" ON "public"."societe_settings" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'reglages'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'reglages'::"text", 'modifier'::"text"));



ALTER TABLE "public"."societes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "societes_select" ON "public"."societes" FOR SELECT TO "authenticated" USING ("public"."est_membre"("id"));



CREATE POLICY "societes_update" ON "public"."societes" FOR UPDATE TO "authenticated" USING ("public"."est_admin"("id")) WITH CHECK ("public"."est_admin"("id"));



ALTER TABLE "public"."sous_traitant_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sous_traitant_documents_delete" ON "public"."sous_traitant_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sous_traitants" "p"
  WHERE (("p"."id" = "sous_traitant_documents"."sous_traitant_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "sous_traitant_documents_insert" ON "public"."sous_traitant_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sous_traitants" "p"
  WHERE (("p"."id" = "sous_traitant_documents"."sous_traitant_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "sous_traitant_documents_select" ON "public"."sous_traitant_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sous_traitants" "p"
  WHERE (("p"."id" = "sous_traitant_documents"."sous_traitant_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "sous_traitant_documents_update" ON "public"."sous_traitant_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sous_traitants" "p"
  WHERE (("p"."id" = "sous_traitant_documents"."sous_traitant_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sous_traitants" "p"
  WHERE (("p"."id" = "sous_traitant_documents"."sous_traitant_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."sous_traitants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sous_traitants_delete" ON "public"."sous_traitants" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "sous_traitants_insert" ON "public"."sous_traitants" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "sous_traitants_select" ON "public"."sous_traitants" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "sous_traitants_update" ON "public"."sous_traitants" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."tache_travaux_supplementaires" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tache_travaux_supplementaires_delete" ON "public"."tache_travaux_supplementaires" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "tache_travaux_supplementaires_insert" ON "public"."tache_travaux_supplementaires" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "tache_travaux_supplementaires_select" ON "public"."tache_travaux_supplementaires" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "tache_travaux_supplementaires_update" ON "public"."tache_travaux_supplementaires" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."techniciens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "techniciens_delete" ON "public"."techniciens" FOR DELETE TO "authenticated" USING ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "techniciens_insert" ON "public"."techniciens" FOR INSERT TO "authenticated" WITH CHECK ("public"."peut_ecrire"("societe_id"));



CREATE POLICY "techniciens_select" ON "public"."techniciens" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "techniciens_update" ON "public"."techniciens" FOR UPDATE TO "authenticated" USING ("public"."peut_ecrire"("societe_id")) WITH CHECK ("public"."peut_ecrire"("societe_id"));



ALTER TABLE "public"."vehicule_cartes_carburant" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_cartes_carburant_delete" ON "public"."vehicule_cartes_carburant" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_cartes_carburant"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_cartes_carburant_insert" ON "public"."vehicule_cartes_carburant" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_cartes_carburant"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_cartes_carburant_select" ON "public"."vehicule_cartes_carburant" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_cartes_carburant"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_cartes_carburant_update" ON "public"."vehicule_cartes_carburant" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_cartes_carburant"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_cartes_carburant"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicule_consommations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_consommations_delete" ON "public"."vehicule_consommations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_consommations"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_consommations_insert" ON "public"."vehicule_consommations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_consommations"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_consommations_select" ON "public"."vehicule_consommations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_consommations"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_consommations_update" ON "public"."vehicule_consommations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_consommations"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_consommations"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicule_controles_periodiques" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_controles_periodiques_delete" ON "public"."vehicule_controles_periodiques" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_controles_periodiques"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_controles_periodiques_insert" ON "public"."vehicule_controles_periodiques" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_controles_periodiques"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_controles_periodiques_select" ON "public"."vehicule_controles_periodiques" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_controles_periodiques"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_controles_periodiques_update" ON "public"."vehicule_controles_periodiques" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_controles_periodiques"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_controles_periodiques"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicule_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_documents_delete" ON "public"."vehicule_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_documents"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_documents_insert" ON "public"."vehicule_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_documents"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_documents_select" ON "public"."vehicule_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_documents"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_documents_update" ON "public"."vehicule_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_documents"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_documents"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicule_entretiens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_entretiens_delete" ON "public"."vehicule_entretiens" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_entretiens"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_entretiens_insert" ON "public"."vehicule_entretiens" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_entretiens"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_entretiens_select" ON "public"."vehicule_entretiens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_entretiens"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_entretiens_update" ON "public"."vehicule_entretiens" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_entretiens"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_entretiens"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicule_prets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicule_prets_delete" ON "public"."vehicule_prets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_prets"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_prets_insert" ON "public"."vehicule_prets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_prets"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



CREATE POLICY "vehicule_prets_select" ON "public"."vehicule_prets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_prets"."vehicule_id") AND "public"."est_membre"("p"."societe_id")))));



CREATE POLICY "vehicule_prets_update" ON "public"."vehicule_prets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_prets"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vehicules" "p"
  WHERE (("p"."id" = "vehicule_prets"."vehicule_id") AND "public"."peut_ecrire"("p"."societe_id")))));



ALTER TABLE "public"."vehicules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicules_delete" ON "public"."vehicules" FOR DELETE TO "authenticated" USING ("public"."a_permission"("societe_id", 'vehicules'::"text", 'supprimer'::"text"));



CREATE POLICY "vehicules_insert" ON "public"."vehicules" FOR INSERT TO "authenticated" WITH CHECK ("public"."a_permission"("societe_id", 'vehicules'::"text", 'creer'::"text"));



CREATE POLICY "vehicules_select" ON "public"."vehicules" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



CREATE POLICY "vehicules_update" ON "public"."vehicules" FOR UPDATE TO "authenticated" USING ("public"."a_permission"("societe_id", 'vehicules'::"text", 'modifier'::"text")) WITH CHECK ("public"."a_permission"("societe_id", 'vehicules'::"text", 'modifier'::"text"));



ALTER TABLE "public"."workflow_journal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_journal_insert" ON "public"."workflow_journal" FOR INSERT TO "authenticated" WITH CHECK ("public"."est_membre"("societe_id"));



CREATE POLICY "workflow_journal_select" ON "public"."workflow_journal" FOR SELECT TO "authenticated" USING ("public"."est_membre"("societe_id"));



ALTER TABLE "public"."zz_obsolete_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_devis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_factures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_interlocuteurs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_interventions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_reglements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_obsolete_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."a_permission"("p_societe_id" "uuid", "p_module" "text", "p_action" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."a_permission"("p_societe_id" "uuid", "p_module" "text", "p_action" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."a_permission"("p_societe_id" "uuid", "p_module" "text", "p_action" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accepter_invitations_apres_confirmation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accepter_invitations_apres_confirmation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."amorcer_premier_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."amorcer_premier_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."bc_chiffrage_valide"("p_bc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bc_chiffrage_valide"("p_bc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bc_chiffrage_valide"("p_bc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bc_cloturer_gratuit"("p_bc_id" "uuid", "p_motif" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bc_cloturer_gratuit"("p_bc_id" "uuid", "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bc_cloturer_gratuit"("p_bc_id" "uuid", "p_motif" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bc_generer_facture"("p_bc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bc_generer_facture"("p_bc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bc_generer_facture"("p_bc_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bc_passer_pret_a_chiffrer"("p_bc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bc_passer_pret_a_chiffrer"("p_bc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bc_passer_pret_a_chiffrer"("p_bc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."code_unite"("p_unite" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."code_unite"("p_unite" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."code_unite"("p_unite" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."est_admin"("p_societe" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."est_admin"("p_societe" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."est_admin"("p_societe" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."est_affecte_au_chantier"("p_chantier_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."est_affecte_au_chantier"("p_chantier_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."est_affecte_au_chantier"("p_chantier_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."est_membre"("p_societe" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."est_membre"("p_societe" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."est_membre"("p_societe" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mes_societes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mes_societes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mes_societes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mon_role"("p_societe" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mon_role"("p_societe" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mon_role"("p_societe" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."peut_ecrire"("p_societe" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."peut_ecrire"("p_societe" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."peut_ecrire"("p_societe" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prochain_numero"("p_societe" "uuid", "p_type" "text", "p_annee" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prochain_numero"("p_societe" "uuid", "p_type" "text", "p_annee" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prochain_numero"("p_societe" "uuid", "p_type" "text", "p_annee" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_dernier_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_dernier_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_table_fille"("p_table" "text", "p_colonne" "text", "p_parent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_table_fille"("p_table" "text", "p_colonne" "text", "p_parent" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_table_racine"("p_table" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_table_racine"("p_table" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."role_dans_societe"("p_societe_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_maj_le"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_maj_le"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tache_marquer_realisee"("p_tache_id" "uuid", "p_commentaire" "text", "p_date_realisation" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."tache_marquer_realisee"("p_tache_id" "uuid", "p_commentaire" "text", "p_date_realisation" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tache_marquer_realisee"("p_tache_id" "uuid", "p_commentaire" "text", "p_date_realisation" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."tache_sauvegarder_terrain"("p_tache_id" "uuid", "p_commentaire" "text", "p_piece_a_commander" boolean, "p_piece_description" "text", "p_croquis" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tache_sauvegarder_terrain"("p_tache_id" "uuid", "p_commentaire" "text", "p_piece_a_commander" boolean, "p_piece_description" "text", "p_croquis" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tache_sauvegarder_terrain"("p_tache_id" "uuid", "p_commentaire" "text", "p_piece_a_commander" boolean, "p_piece_description" "text", "p_croquis" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tache_valider"("p_tache_id" "uuid", "p_ok" boolean, "p_motif" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tache_valider"("p_tache_id" "uuid", "p_ok" boolean, "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tache_valider"("p_tache_id" "uuid", "p_ok" boolean, "p_motif" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."uuid_ou_null"("p_texte" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."uuid_ou_null"("p_texte" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."uuid_ou_null"("p_texte" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_ou_null"("p_texte" "text") TO "anon";


















GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."bon_commande_lignes" TO "anon";
GRANT ALL ON TABLE "public"."bon_commande_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."bon_commande_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."bon_commande_photos" TO "anon";
GRANT ALL ON TABLE "public"."bon_commande_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."bon_commande_photos" TO "service_role";



GRANT ALL ON TABLE "public"."bons_commande" TO "anon";
GRANT ALL ON TABLE "public"."bons_commande" TO "authenticated";
GRANT ALL ON TABLE "public"."bons_commande" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_achats" TO "anon";
GRANT ALL ON TABLE "public"."chantier_achats" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_achats" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_affectations" TO "anon";
GRANT ALL ON TABLE "public"."chantier_affectations" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_affectations" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_avancement_factures" TO "anon";
GRANT ALL ON TABLE "public"."chantier_avancement_factures" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_avancement_factures" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_comptes_rendus" TO "anon";
GRANT ALL ON TABLE "public"."chantier_comptes_rendus" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_comptes_rendus" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_devis_complementaires" TO "anon";
GRANT ALL ON TABLE "public"."chantier_devis_complementaires" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_devis_complementaires" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_documents" TO "anon";
GRANT ALL ON TABLE "public"."chantier_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_documents" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_dpgf_lignes" TO "anon";
GRANT ALL ON TABLE "public"."chantier_dpgf_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_dpgf_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_inspections" TO "anon";
GRANT ALL ON TABLE "public"."chantier_inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_inspections" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_todos" TO "anon";
GRANT ALL ON TABLE "public"."chantier_todos" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_todos" TO "service_role";



GRANT ALL ON TABLE "public"."chantiers" TO "anon";
GRANT ALL ON TABLE "public"."chantiers" TO "authenticated";
GRANT ALL ON TABLE "public"."chantiers" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."compteurs" TO "anon";
GRANT ALL ON TABLE "public"."compteurs" TO "authenticated";
GRANT ALL ON TABLE "public"."compteurs" TO "service_role";



GRANT ALL ON TABLE "public"."conducteurs" TO "anon";
GRANT ALL ON TABLE "public"."conducteurs" TO "authenticated";
GRANT ALL ON TABLE "public"."conducteurs" TO "service_role";



GRANT ALL ON TABLE "public"."devis" TO "anon";
GRANT ALL ON TABLE "public"."devis" TO "authenticated";
GRANT ALL ON TABLE "public"."devis" TO "service_role";



GRANT ALL ON TABLE "public"."devis_lignes" TO "anon";
GRANT ALL ON TABLE "public"."devis_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."devis_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."documents_legaux" TO "anon";
GRANT ALL ON TABLE "public"."documents_legaux" TO "authenticated";
GRANT ALL ON TABLE "public"."documents_legaux" TO "service_role";



GRANT ALL ON TABLE "public"."ereporting_depots" TO "anon";
GRANT ALL ON TABLE "public"."ereporting_depots" TO "authenticated";
GRANT ALL ON TABLE "public"."ereporting_depots" TO "service_role";



GRANT ALL ON TABLE "public"."facture_cycle_vie" TO "anon";
GRANT ALL ON TABLE "public"."facture_cycle_vie" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_cycle_vie" TO "service_role";



GRANT ALL ON TABLE "public"."facture_entrante_lignes" TO "anon";
GRANT ALL ON TABLE "public"."facture_entrante_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_entrante_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."facture_lignes" TO "anon";
GRANT ALL ON TABLE "public"."facture_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."factures" TO "anon";
GRANT ALL ON TABLE "public"."factures" TO "authenticated";
GRANT ALL ON TABLE "public"."factures" TO "service_role";



GRANT ALL ON TABLE "public"."factures_entrantes" TO "anon";
GRANT ALL ON TABLE "public"."factures_entrantes" TO "authenticated";
GRANT ALL ON TABLE "public"."factures_entrantes" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseur_controle_lignes" TO "anon";
GRANT ALL ON TABLE "public"."fournisseur_controle_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseur_controle_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseurs_controle" TO "anon";
GRANT ALL ON TABLE "public"."fournisseurs_controle" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseurs_controle" TO "service_role";



GRANT ALL ON TABLE "public"."integration_journal" TO "anon";
GRANT ALL ON TABLE "public"."integration_journal" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_journal" TO "service_role";



GRANT ALL ON TABLE "public"."interlocuteurs" TO "anon";
GRANT ALL ON TABLE "public"."interlocuteurs" TO "authenticated";
GRANT ALL ON TABLE "public"."interlocuteurs" TO "service_role";



GRANT ALL ON TABLE "public"."intervention_controles" TO "anon";
GRANT ALL ON TABLE "public"."intervention_controles" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_controles" TO "service_role";



GRANT ALL ON TABLE "public"."intervention_photos" TO "anon";
GRANT ALL ON TABLE "public"."intervention_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_photos" TO "service_role";



GRANT ALL ON TABLE "public"."interventions" TO "anon";
GRANT ALL ON TABLE "public"."interventions" TO "authenticated";
GRANT ALL ON TABLE "public"."interventions" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."kv_store" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."kv_store" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."kv_store" TO "authenticated";



GRANT ALL ON TABLE "public"."materiel_prets" TO "anon";
GRANT ALL ON TABLE "public"."materiel_prets" TO "authenticated";
GRANT ALL ON TABLE "public"."materiel_prets" TO "service_role";



GRANT ALL ON TABLE "public"."materiels" TO "anon";
GRANT ALL ON TABLE "public"."materiels" TO "authenticated";
GRANT ALL ON TABLE "public"."materiels" TO "service_role";



GRANT ALL ON TABLE "public"."membres_societe" TO "anon";
GRANT ALL ON TABLE "public"."membres_societe" TO "authenticated";
GRANT ALL ON TABLE "public"."membres_societe" TO "service_role";



GRANT ALL ON TABLE "public"."metiers" TO "anon";
GRANT ALL ON TABLE "public"."metiers" TO "authenticated";
GRANT ALL ON TABLE "public"."metiers" TO "service_role";



GRANT ALL ON TABLE "public"."pdp_connexion_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."pdp_connexions" TO "anon";
GRANT ALL ON TABLE "public"."pdp_connexions" TO "authenticated";
GRANT ALL ON TABLE "public"."pdp_connexions" TO "service_role";



GRANT ALL ON TABLE "public"."pdp_oauth_etats" TO "service_role";



GRANT ALL ON TABLE "public"."planning_taches" TO "anon";
GRANT ALL ON TABLE "public"."planning_taches" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_taches" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reglements" TO "anon";
GRANT ALL ON TABLE "public"."reglements" TO "authenticated";
GRANT ALL ON TABLE "public"."reglements" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_absences" TO "anon";
GRANT ALL ON TABLE "public"."salarie_absences" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_absences" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_contacts_urgence" TO "anon";
GRANT ALL ON TABLE "public"."salarie_contacts_urgence" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_contacts_urgence" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_contrats" TO "anon";
GRANT ALL ON TABLE "public"."salarie_contrats" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_contrats" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_documents" TO "anon";
GRANT ALL ON TABLE "public"."salarie_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_documents" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_formations" TO "anon";
GRANT ALL ON TABLE "public"."salarie_formations" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_formations" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_habilitations" TO "anon";
GRANT ALL ON TABLE "public"."salarie_habilitations" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_habilitations" TO "service_role";



GRANT ALL ON TABLE "public"."salarie_rdv" TO "anon";
GRANT ALL ON TABLE "public"."salarie_rdv" TO "authenticated";
GRANT ALL ON TABLE "public"."salarie_rdv" TO "service_role";



GRANT ALL ON TABLE "public"."salaries" TO "anon";
GRANT ALL ON TABLE "public"."salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."salaries" TO "service_role";



GRANT ALL ON TABLE "public"."societe_settings" TO "anon";
GRANT ALL ON TABLE "public"."societe_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."societe_settings" TO "service_role";



GRANT ALL ON TABLE "public"."societes" TO "anon";
GRANT ALL ON TABLE "public"."societes" TO "authenticated";
GRANT ALL ON TABLE "public"."societes" TO "service_role";



GRANT ALL ON TABLE "public"."sous_traitant_documents" TO "anon";
GRANT ALL ON TABLE "public"."sous_traitant_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."sous_traitant_documents" TO "service_role";



GRANT ALL ON TABLE "public"."sous_traitants" TO "anon";
GRANT ALL ON TABLE "public"."sous_traitants" TO "authenticated";
GRANT ALL ON TABLE "public"."sous_traitants" TO "service_role";



GRANT ALL ON TABLE "public"."tache_travaux_supplementaires" TO "anon";
GRANT ALL ON TABLE "public"."tache_travaux_supplementaires" TO "authenticated";
GRANT ALL ON TABLE "public"."tache_travaux_supplementaires" TO "service_role";



GRANT ALL ON TABLE "public"."techniciens" TO "anon";
GRANT ALL ON TABLE "public"."techniciens" TO "authenticated";
GRANT ALL ON TABLE "public"."techniciens" TO "service_role";



GRANT ALL ON TABLE "public"."v_chantier_avancement" TO "anon";
GRANT ALL ON TABLE "public"."v_chantier_avancement" TO "authenticated";
GRANT ALL ON TABLE "public"."v_chantier_avancement" TO "service_role";



GRANT ALL ON TABLE "public"."v_devis_totaux" TO "anon";
GRANT ALL ON TABLE "public"."v_devis_totaux" TO "authenticated";
GRANT ALL ON TABLE "public"."v_devis_totaux" TO "service_role";



GRANT ALL ON TABLE "public"."v_facture_totaux" TO "anon";
GRANT ALL ON TABLE "public"."v_facture_totaux" TO "authenticated";
GRANT ALL ON TABLE "public"."v_facture_totaux" TO "service_role";



GRANT ALL ON TABLE "public"."v_facture_solde" TO "anon";
GRANT ALL ON TABLE "public"."v_facture_solde" TO "authenticated";
GRANT ALL ON TABLE "public"."v_facture_solde" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_cartes_carburant" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_cartes_carburant" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_cartes_carburant" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_consommations" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_consommations" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_consommations" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_controles_periodiques" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_controles_periodiques" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_controles_periodiques" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_documents" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_documents" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_entretiens" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_entretiens" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_entretiens" TO "service_role";



GRANT ALL ON TABLE "public"."vehicule_prets" TO "anon";
GRANT ALL ON TABLE "public"."vehicule_prets" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicule_prets" TO "service_role";



GRANT ALL ON TABLE "public"."vehicules" TO "anon";
GRANT ALL ON TABLE "public"."vehicules" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicules" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_journal" TO "anon";
GRANT ALL ON TABLE "public"."workflow_journal" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_journal" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_articles" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_clients" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_counters" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_devis" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_documents" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_factures" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_interlocuteurs" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_interventions" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_reglements" TO "service_role";



GRANT ALL ON TABLE "public"."zz_obsolete_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































