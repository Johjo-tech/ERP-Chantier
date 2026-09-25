-- Jeu d'essai de la comparaison des PDF (tests/visuel/pdf) — base LOCALE uniquement.
--
-- Trois pièces de la société ALPHA, lisibles par les DEUX applications :
--   « PDF PARITÉ — facture »   : chapitres, commentaire, deux taux, remise,
--                                acompte, retenue, échéance, référence client ;
--   « PDF PARITÉ — avoir »     : l'avoir qui la rectifie ;
--   « PDF PARITÉ — longue »    : 45 lignes, pour la découpe en pages.
-- Émises (numérotées par la base) : les imprimer n'écrit rien, ni dans l'une ni
-- dans l'autre application (seul un brouillon reçoit un cadenas).
-- Idempotent : une pièce déjà là n'est pas recréée.
do $$
declare
  v_soc constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_client constant uuid := 'a2000000-0000-0000-0000-000000000001';
  v_facture uuid;
  v_avoir uuid;
  v_longue uuid;
  i integer;
begin
  select id into v_facture from factures where societe_id = v_soc and client_nom = 'PDF PARITÉ — facture';
  if v_facture is null then
    insert into factures (societe_id, client_id, client_nom, interlocuteur, adresse, adresse_locataire, code_postal, ville,
                          logement_statut, occupant, etage, numero_logement, date, echeance, date_fin_execution,
                          remise_pourcentage, acomptes_deduits, retenue_garantie_pourcentage, conditions_reglement,
                          mode_paiement, ref_marche, ref_bon_commande_client, statut, type_document)
    values (v_soc, v_client, 'PDF PARITÉ — facture', 'M. Chargé d''affaires', '33 rue Mouton-Duvernet, 69003 Lyon',
            '14 rue Garibaldi', '69003', 'Lyon', 'occupé', 'Mme Dupont', '2', '12', '2026-09-15', '2026-10-15',
            '2026-09-10', 5, 150, 5, '30 jours net', 'cheque', 'M-2026-04', 'CMD-OPAC-7781', 'brouillon', 'facture')
    returning id into v_facture;
    insert into facture_lignes (facture_id, position, type, designation, quantite, prix_unitaire, unite, tva) values
      (v_facture, 0, 'chapitre', 'Plomberie', 0, 0, null, 0),
      (v_facture, 1, 'ligne', 'Remplacement du mitigeur de la cuisine', 1, 185.5, 'u', 10),
      (v_facture, 2, 'ligne', 'Reprise de l''évacuation PVC Ø40', 2.5, 42, 'ml', 10),
      (v_facture, 3, 'commentaire', 'Accès par la cour, clé chez la gardienne.', 0, 0, null, 0),
      (v_facture, 4, 'chapitre', 'Peinture', 0, 0, null, 0),
      (v_facture, 5, 'ligne', 'Peinture acrylique velours, deux couches', 18.4, 21.9, 'm²', 20),
      (v_facture, 6, 'ligne', 'Protection des sols', 1, 60, 'forfait', 20);
    update factures set statut = 'impayée' where id = v_facture;
  end if;

  select id into v_avoir from factures where societe_id = v_soc and client_nom = 'PDF PARITÉ — avoir';
  if v_avoir is null then
    insert into factures (societe_id, client_id, client_nom, adresse, date, remise_pourcentage, acomptes_deduits,
                          statut, type_document, facture_rectifiee_id, motif_rectification)
    values (v_soc, v_client, 'PDF PARITÉ — avoir', '33 rue Mouton-Duvernet, 69003 Lyon', '2026-09-20', 0, 0,
            'brouillon', 'avoir', v_facture, 'Travaux non conformes')
    returning id into v_avoir;
    insert into facture_lignes (facture_id, position, type, designation, quantite, prix_unitaire, unite, tva) values
      (v_avoir, 0, 'ligne', 'Reprise de l''évacuation PVC Ø40 — non réalisée', 2.5, 42, 'ml', 10);
    update factures set statut = 'impayée' where id = v_avoir;
  end if;

  select id into v_longue from factures where societe_id = v_soc and client_nom = 'PDF PARITÉ — longue';
  if v_longue is null then
    insert into factures (societe_id, client_id, client_nom, adresse, date, echeance, remise_pourcentage, acomptes_deduits,
                          statut, type_document, mode_paiement)
    values (v_soc, v_client, 'PDF PARITÉ — longue', '33 rue Mouton-Duvernet, 69003 Lyon', '2026-09-18', '2026-10-18', 0, 0,
            'brouillon', 'facture', 'virement')
    returning id into v_longue;
    for i in 0..44 loop
      insert into facture_lignes (facture_id, position, type, designation, quantite, prix_unitaire, unite, tva)
      values (v_longue, i, (case when i % 15 = 0 then 'chapitre' else 'ligne' end)::ligne_type,
              case when i % 15 = 0 then 'Lot ' || (i / 15 + 1) else 'Prestation n° ' || i || ' — fourniture et pose' end,
              case when i % 15 = 0 then 0 else (i % 4) + 1 end, case when i % 15 = 0 then 0 else 10 * i + 0.5 end,
              case when i % 15 = 0 then null else 'u' end, case when i % 15 = 0 then 0 else 20 end);
    end loop;
    update factures set statut = 'impayée' where id = v_longue;
  end if;
end $$;

select numero, client_nom, type_document, statut from factures where client_nom like 'PDF PARITÉ%' order by client_nom;
