-- PROPOSITION — non appliquée en production (DECISIONS D-008, D-029, D-FAC-10).
-- Complète 20260925030000_espace_client_en_lecture (à appliquer après elle).
--
-- Ce qui manquait à l'espace client (INVENTAIRE ESP-01 à ESP-03, ESP-10) :
--
--   1. LE SUIVI DES BONS. Le portail de l'ancienne app (mort, D-008) montrait au
--      bailleur ses bons de commande, colorés par avancement. Les bons ne se
--      lisent que par les vues terrain, réservées aux membres. On sert au client
--      une vue RÉDUITE : ni montant, ni note interne, ni description du
--      problème, ni conducteur, ni technicien — l'avancement, le lieu, la pièce
--      attendue et les tentatives de contact, comme l'ancien portail.
--   2. L'INTERLOCUTEUR. Chez un bailleur, chaque chargé d'opération ne suit que
--      ses dossiers. `acces_clients.interlocuteur` (NULL = tout le client)
--      restreint devis, factures et bons à ceux qui le citent. L'ancien écran
--      le faisait par un filtre d'affichage choisi dans une liste libre ; ici
--      c'est la RLS.
--   3. L'ÉTAT DE RÈGLEMENT de ses factures : le client lit les règlements de SES
--      factures émises, et donc leur solde (`v_facture_solde` est
--      security_invoker). Rien de plus.
--
-- Aucune politique d'écriture. Idempotent.
-- Validé par tests/rls/espace-client-bons.essai.ts (« [proposition] »).

alter table public.acces_clients add column if not exists interlocuteur text;
comment on column public.acces_clients.interlocuteur is
  'NULL ou vide : tout le client. Sinon, seules les pièces qui citent cet interlocuteur (égalité exacte, espaces de bord ignorés).';

-- Une pièce est « à moi » si elle cite un client de mon accès, dans la société
-- de ce client, et — si mon accès est nominatif — mon nom d'interlocuteur.
create or replace function public.est_mon_document(p_client uuid, p_societe uuid, p_interlocuteur text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(exists (
    select 1 from acces_clients a
    join profiles p on p.id = a.profile_id and p.actif
    join clients c on c.id = a.client_id and c.societe_id = a.societe_id
    where a.profile_id = auth.uid() and a.actif
      and a.client_id = p_client and a.societe_id = p_societe
      and (coalesce(trim(a.interlocuteur), '') = '' or trim(a.interlocuteur) = trim(coalesce(p_interlocuteur, '')))
  ), false);
$$;

revoke all on function public.est_mon_document(uuid, uuid, text) from public, anon;
grant execute on function public.est_mon_document(uuid, uuid, text) to authenticated;

-- Les politiques de lecture de 20260925030000, resserrées sur l'interlocuteur.
drop policy if exists espace_client_devis on public.devis;
create policy espace_client_devis on public.devis for select to authenticated
  using (statut <> 'brouillon' and public.est_mon_document(client_id, societe_id, interlocuteur));

drop policy if exists espace_client_devis_lignes on public.devis_lignes;
create policy espace_client_devis_lignes on public.devis_lignes for select to authenticated
  using (exists (select 1 from devis d where d.id = devis_lignes.devis_id
                 and d.statut <> 'brouillon' and public.est_mon_document(d.client_id, d.societe_id, d.interlocuteur)));

drop policy if exists espace_client_factures on public.factures;
create policy espace_client_factures on public.factures for select to authenticated
  using (numero is not null and public.est_mon_document(client_id, societe_id, interlocuteur));

drop policy if exists espace_client_facture_lignes on public.facture_lignes;
create policy espace_client_facture_lignes on public.facture_lignes for select to authenticated
  using (exists (select 1 from factures f where f.id = facture_lignes.facture_id
                 and f.numero is not null and public.est_mon_document(f.client_id, f.societe_id, f.interlocuteur)));

-- Les règlements de ses factures émises : c'est ce qui lui dit ce qu'il doit encore.
drop policy if exists espace_client_reglements on public.reglements;
create policy espace_client_reglements on public.reglements for select to authenticated
  using (exists (select 1 from factures f where f.id = reglements.facture_id
                 and f.numero is not null and public.est_mon_document(f.client_id, f.societe_id, f.interlocuteur)));

-- Le suivi de ses bons. Vue aux droits de son propriétaire (les bons ne sont pas
-- lisibles du client) qui filtre elle-même ; security_barrier empêche une
-- fonction de l'appelant de lire avant le filtre.
create or replace view public.v_espace_client_bons with (security_barrier = true) as
  select
    b.id,
    b.societe_id,
    b.client_id,
    b.numero_bc,
    b.interlocuteur,
    b.adresse,
    b.adresse_locataire,
    b.code_postal,
    b.ville,
    b.numero_logement,
    b.etage,
    b.precision_commune,
    b.occupant,
    b.ancien_locataire,
    b.nature_travaux,
    b.date_reception,
    coalesce(b.date_planifiee, t.premiere_date) as date_planifiee,
    b.heure_planifiee,
    b.date_planification_initiale,
    b.date_intervention_terminee,
    b.rappel_date,
    b.tentatives_contact,
    -- « Travaux réalisés » : au moins une tâche, et toutes réalisées ou validées.
    coalesce(t.nb > 0 and t.nb = t.faites, false) as travaux_faits,
    coalesce(t.piece_attendue, false) as piece_a_commander,
    t.piece_detail as piece_a_commander_detail,
    t.piece_date_commande
  from bons_commande b
  left join lateral (
    select
      count(*) as nb,
      count(*) filter (where pt.statut in ('realisee', 'validee')) as faites,
      min(pt.date_tache) as premiere_date,
      bool_or(coalesce(pt.piece_a_commander, false)) as piece_attendue,
      string_agg(pt.piece_description, ' ; ') filter (where pt.piece_a_commander and coalesce(pt.piece_description, '') <> '') as piece_detail,
      min(pt.piece_date_commande) filter (where pt.piece_a_commander) as piece_date_commande
    from planning_taches pt
    where pt.bon_commande_id = b.id
  ) t on true
  where public.est_mon_document(b.client_id, b.societe_id, b.interlocuteur);

comment on view public.v_espace_client_bons is
  'Espace client : ses bons, sans montant ni note interne. Proposition 20260926042000.';

revoke all on public.v_espace_client_bons from anon;
grant select on public.v_espace_client_bons to authenticated;

-- 4. L'EN-TÊTE DES PIÈCES. Le client ne lit pas `societes` (tout membre y a
--    accès, pas lui) : ses devis sortaient sans adresse ni SIRET d'émetteur.
--    L'identité LÉGALE de la société — celle que chaque pièce imprime de toute
--    façon — s'ajoute EN FIN de `v_mes_acces_clients` (définition vivante de
--    20260925030000, colonnes existantes inchangées).
create or replace view public.v_mes_acces_clients with (security_barrier = true) as
  select a.client_id, c.nom as client_nom, a.societe_id, s.nom as societe_nom,
    a.interlocuteur,
    s.raison_sociale_legale as societe_raison_sociale,
    s.forme_juridique as societe_forme_juridique,
    s.adresse as societe_adresse,
    s.code_postal as societe_code_postal,
    s.ville as societe_ville,
    s.telephone as societe_telephone,
    s.email as societe_email,
    s.siret as societe_siret,
    s.siren as societe_siren,
    s.tva_intracom as societe_tva_intracom,
    s.capital_social as societe_capital_social,
    s.rcs_numero as societe_rcs_numero,
    s.rcs_ville as societe_rcs_ville,
    s.code_naf as societe_code_naf
  from acces_clients a
  join profiles p on p.id = a.profile_id and p.actif
  join clients c on c.id = a.client_id and c.societe_id = a.societe_id
  join societes s on s.id = a.societe_id
  where a.profile_id = auth.uid() and a.actif;

revoke all on public.v_mes_acces_clients from anon;
grant select on public.v_mes_acces_clients to authenticated;
