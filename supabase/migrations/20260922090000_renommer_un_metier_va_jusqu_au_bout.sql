-- Renommer un métier doit aller jusqu'au bout, même sur un bon facturé.
--
-- Deux défauts se révèlent au moment de reprendre la casse des métiers
-- (CARRELAGE → Carrelage). Aucun des deux n'est visible tant qu'on ne renomme
-- pas : ils dorment dans les deux migrations de la veille.
--
-- 1. LE RENOMMAGE EST REFUSÉ. `bon_commande_facture_fige` gèle par liste
--    blanche tout ce qui n'y est pas nommé, et `metier`, `metiers` et
--    `montant_par_metier` n'y sont pas. Or `metier_renomme_partout` écrit
--    justement `bons_commande.metier`. Éprouvé sur la production : renommer
--    PEINTURE en Peinture chez KTA lève
--      « Ce bon de commande est facturé (FAC-2026-000011) : son contenu ne
--        peut plus changer (metier) »
--    sur le bon 221010. Le renommage entier est annulé, donc la reprise aussi.
--    Ce n'est pas un cas d'école : c'est le cas nominal.
--
-- 2. LE RENOMMAGE LAISSE DES CLÉS DERRIÈRE LUI. `schedule_par_metier` et
--    `montant_par_metier` sont des jsonb dont les CLÉS sont le libellé du
--    métier. `metier_renomme_partout` réécrit `metier` et le tableau `metiers`,
--    jamais ces clés. Après PEINTURE → Peinture, le bon annonce « Peinture »
--    et son planning répond encore à « PEINTURE » : date, heure, durée et
--    équipe deviendraient introuvables, et le bon retomberait dans
--    « Non planifiés ».
--    Aucun bon ne porte ces cartes aujourd'hui — vérifié, zéro ligne — donc
--    rien ne casserait dans l'immédiat. On le ferme avant que ce soit le cas.
--
-- On AMENDE plutôt qu'on ne réécrit : les deux migrations de la veille restent
-- telles qu'elles ont été appliquées.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. « Ces deux valeurs désignent-elles les mêmes métiers ? »
-- ──────────────────────────────────────────────────────────────────────────
-- Une seule question, posée une fois. Elle sert au gel du bon facturé pour
-- distinguer une RE-ORTHOGRAPHE d'un vrai changement de corps d'état.
--
-- Les trois formes que prennent les métiers dans le schéma :
--   'PEINTURE'                    le texte de `metier`
--   ["PEINTURE","SOL"]            le tableau de `metiers`
--   {"PEINTURE":120,"SOL":80}     les cartes par métier, où la CLÉ est le nom

create or replace function public.metiers_identiques_au_nom_pres(
  p_avant jsonb, p_apres jsonb
) returns boolean language sql immutable as $fn$
  select case
    when p_avant is null or p_apres is null then p_avant is not distinct from p_apres
    when jsonb_typeof(p_avant) is distinct from jsonb_typeof(p_apres) then false

    when jsonb_typeof(p_avant) = 'string' then
      public.metier_normalise(p_avant #>> '{}')
        is not distinct from public.metier_normalise(p_apres #>> '{}')

    -- L'ordre d'un tableau de métiers ne porte aucun sens : on trie avant de
    -- comparer, sinon recocher les mêmes métiers dans un autre ordre passerait
    -- pour une modification.
    when jsonb_typeof(p_avant) = 'array' then
      (select coalesce(jsonb_agg(n order by n), '[]'::jsonb)
         from (select coalesce(public.metier_normalise(e), '') n
                 from jsonb_array_elements_text(p_avant) e) a)
      = (select coalesce(jsonb_agg(n order by n), '[]'::jsonb)
           from (select coalesce(public.metier_normalise(e), '') n
                   from jsonb_array_elements_text(p_apres) e) b)

    -- Les VALEURS restent comparées telles quelles : re-orthographier une clé
    -- est permis, changer le montant qu'elle porte ne l'est pas.
    when jsonb_typeof(p_avant) = 'object' then
      (select coalesce(jsonb_object_agg(coalesce(public.metier_normalise(k), ''), v), '{}'::jsonb)
         from jsonb_each(p_avant) a(k, v))
      = (select coalesce(jsonb_object_agg(coalesce(public.metier_normalise(k), ''), v), '{}'::jsonb)
           from jsonb_each(p_apres) b(k, v))

    else p_avant is not distinct from p_apres
  end
$fn$;

comment on function public.metiers_identiques_au_nom_pres(jsonb, jsonb) is
  'Vrai quand deux valeurs désignent les mêmes métiers à l''orthographe près. '
  'Traite le texte, le tableau de métiers et les cartes dont la clé est un '
  'métier. Les valeurs des cartes, elles, sont comparées telles quelles.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Le gel du bon facturé laisse passer une re-orthographe
-- ──────────────────────────────────────────────────────────────────────────
-- Une EXEMPTION étroite, et non trois colonnes ajoutées à la liste blanche :
-- re-orthographier un métier ne change pas ce qui a été facturé — c'est le
-- même corps d'état, écrit autrement. Renommer PEINTURE en MENUISERIE reste
-- refusé, et le restera. C'est le même raisonnement que pour `conducteur`,
-- qu'un déclencheur réécrit lors d'un renommage de fiche.

create or replace function public.bon_commande_facture_fige()
returns trigger language plpgsql as $fn$
declare
  v_libres text[] := array[
    'statut', 'statut_workflow',
    'conducteur', 'conducteur_id',
    'technicien', 'interlocuteur', 'notes', 'tentatives_contact', 'rappel_date',
    'date_planifiee', 'date_planifiee_fin', 'heure_planifiee', 'duree_heures',
    'duree_dernier_jour', 'heure_dernier_jour', 'schedule_par_metier',
    'date_planification_initiale', 'date_intervention_terminee', 'en_attente_bc',
    'facturation_adresse', 'facturation_code_postal', 'facturation_ville',
    'piece_jointe_chemin', 'piece_jointe_nom', 'piece_jointe_mime',
    'maj_le', 'numero_interne'
  ];
  -- Ce qui désigne un métier, et qu'une re-orthographe peut donc traverser.
  v_porte_un_metier text[] := array['metier', 'metiers', 'montant_par_metier'];
  v_col      text;
  v_avant    jsonb := to_jsonb(old);
  v_apres    jsonb := to_jsonb(new);
  v_touches  text[] := '{}';
  v_numeros  text;
begin
  for v_col in select jsonb_object_keys(v_apres) loop
    if v_col = any(v_libres) then continue; end if;
    -- `is distinct from` et non `<>` : l'écran renvoie la ligne entière à
    -- chaque enregistrement, NULL compris, et réécrire une valeur à
    -- l'identique n'est pas une modification.
    if v_apres -> v_col is not distinct from v_avant -> v_col then continue; end if;
    -- Le même métier, autrement écrit : `metier_renomme_partout` passe par ici.
    if v_col = any(v_porte_un_metier)
       and public.metiers_identiques_au_nom_pres(v_avant -> v_col, v_apres -> v_col) then
      continue;
    end if;
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

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Le renommage emporte aussi les clés des cartes par métier
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.metier_renomme_partout()
returns trigger language plpgsql as $fn$
declare v_cle text := public.metier_normalise(old.libelle);
begin
  if new.libelle is not distinct from old.libelle then return new; end if;
  if v_cle is null then return new; end if;

  update public.bons_commande
     set metier = new.libelle
   where societe_id = old.societe_id and public.metier_normalise(metier) = v_cle;

  update public.bons_commande b
     set metiers = (
       select jsonb_agg(case when public.metier_normalise(m) = v_cle then new.libelle else m end)
         from jsonb_array_elements_text(b.metiers) m
     )
   where b.societe_id = old.societe_id
     and jsonb_typeof(b.metiers) = 'array'
     and exists (select 1 from jsonb_array_elements_text(b.metiers) m
                  where public.metier_normalise(m) = v_cle);

  -- LES CARTES PAR MÉTIER. Leur clé EST le libellé : sans ces deux blocs, le
  -- bon annoncerait « Peinture » pendant que son planning répondrait encore à
  -- « PEINTURE ». Les gardes ne sont pas du zèle : `jsonb_object_agg` sur un
  -- objet vide rend NULL, ce qui effacerait la planification au lieu de la
  -- renommer.
  update public.bons_commande b
     set schedule_par_metier = (
       select jsonb_object_agg(
                case when public.metier_normalise(k) = v_cle then new.libelle else k end, v)
         from jsonb_each(b.schedule_par_metier) e(k, v)
     )
   where b.societe_id = old.societe_id
     and jsonb_typeof(b.schedule_par_metier) = 'object'
     and exists (select 1 from jsonb_object_keys(b.schedule_par_metier) k
                  where public.metier_normalise(k) = v_cle);

  update public.bons_commande b
     set montant_par_metier = (
       select jsonb_object_agg(
                case when public.metier_normalise(k) = v_cle then new.libelle else k end, v)
         from jsonb_each(b.montant_par_metier) e(k, v)
     )
   where b.societe_id = old.societe_id
     and jsonb_typeof(b.montant_par_metier) = 'object'
     and exists (select 1 from jsonb_object_keys(b.montant_par_metier) k
                  where public.metier_normalise(k) = v_cle);

  update public.planning_taches
     set metier = new.libelle
   where societe_id = old.societe_id and public.metier_normalise(metier) = v_cle;

  update public.bon_commande_lignes l
     set metier = new.libelle
    from public.bons_commande b
   where b.id = l.bon_commande_id and b.societe_id = old.societe_id
     and public.metier_normalise(l.metier) = v_cle;

  update public.devis_lignes l
     set metier = new.libelle
    from public.devis d
   where d.id = l.devis_id and d.societe_id = old.societe_id
     and public.metier_normalise(l.metier) = v_cle;

  -- Les lignes de facture ÉMISE sont figées par ailleurs ; on ne touche donc
  -- qu'aux brouillons. Une facture partie chez le client dit ce qu'elle disait.
  update public.facture_lignes l
     set metier = new.libelle
    from public.factures f
   where f.id = l.facture_id and f.societe_id = old.societe_id
     and coalesce(f.numero, '') = ''
     and public.metier_normalise(l.metier) = v_cle;

  return new;
end;
$fn$;

comment on function public.metier_renomme_partout() is
  'Propage le renommage d''un métier à tout ce qui le désigne par son nom, '
  'y compris les CLÉS des cartes `schedule_par_metier` et `montant_par_metier`. '
  'Les lignes de facture émise sont laissées telles quelles.';
