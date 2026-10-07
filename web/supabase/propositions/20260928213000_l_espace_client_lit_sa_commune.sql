-- PROPOSITION — non appliquée en production.
--
-- Défaut corrigé (D-MAIN-02, D-COR2-05) : les pièces imprimées depuis l'espace client sortaient SANS
-- commune. Le bloc « Client » (`adresseClientDuDocument`, production 2c21745) prend le code postal et la
-- ville sur la FICHE du client, faute d'être figés sur la pièce ; or le client n'a pas accès à la table
-- `clients` (D-FAC-10) — et ne doit pas l'avoir : la fiche porte le SIRET, les coordonnées de
-- facturation, les notes internes, le cadre de facturation.
--
-- Correction : la vue qu'il lit déjà (`v_mes_acces_clients`, une ligne par accès ACTIF de SON compte,
-- `a.profile_id = auth.uid()`) rend en plus le code postal et la ville de la fiche du client de cet
-- accès — et rien d'autre de la fiche. Aucune politique n'est ouverte sur `clients` ; un membre de la
-- société n'y gagne rien (la vue ne rend que les accès du compte connecté).
--
-- Deux colonnes AJOUTÉES EN FIN (règle des vues : « cannot drop columns from view ») ; le reste est la
-- définition de 20260926042000, inchangée. En production, repartir de la définition VIVANTE
-- (`select pg_get_viewdef('public.v_mes_acces_clients'::regclass, true);`) et n'y ajouter que les deux
-- dernières colonnes : si elle diffère de celle-ci, le `create or replace` ci-dessous échoue plutôt que
-- d'effacer une colonne — c'est voulu.
--
-- Validé par : tests/rls/espace-client-bons.essai.ts (« [proposition] … sa commune … »).
-- Essai à blanc (par un humain) :
--   begin;
--   \i 20260928213000_l_espace_client_lit_sa_commune.sql
--   select count(*), count(client_code_postal) from v_mes_acces_clients;  -- sous un compte client
--   rollback;

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
    s.code_naf as societe_code_naf,
    s.mention_penalites_retard as societe_mention_penalites_retard,
    s.indemnite_recouvrement as societe_indemnite_recouvrement,
    s.autoliquidation_batiment as societe_autoliquidation_batiment,
    s.tva_sur_encaissements as societe_tva_sur_encaissements,
    s.assurance_decennale_nom as societe_assurance_decennale_nom,
    s.assurance_decennale_police as societe_assurance_decennale_police,
    s.regime_tva as societe_regime_tva,
    -- La commune de SA fiche, pour le bloc « Client » de ses pièces : rien d'autre de la fiche.
    c.code_postal as client_code_postal,
    c.ville as client_ville
  from acces_clients a
  join profiles p on p.id = a.profile_id and p.actif
  join clients c on c.id = a.client_id and c.societe_id = a.societe_id
  join societes s on s.id = a.societe_id
  where a.profile_id = auth.uid() and a.actif;

-- `create or replace` garde les droits en place ; on les repose quand même, comme 20260926042000 :
-- une vue d'une seule jointure reste en lecture seule pour tous.
revoke all on public.v_mes_acces_clients from public, anon, authenticated;
grant select on public.v_mes_acces_clients to authenticated;
