-- Jeu d'essai des écrans « Modifier un brouillon » et « Consulter une facture
-- émise » de la comparaison visuelle — base LOCALE uniquement.
--
-- Ces deux écrans visaient des pièces que seuls les parcours e2e laissaient
-- derrière eux (un brouillon de Mme Durand, la facture FAC-2026-000025) : sur
-- une base neuve, aucune carte ne répondait et le clic expirait des deux côtés.
-- Les deux pièces portent l'interlocuteur « Témoin visuel », que la carte
-- affiche (« 👤 … ») dans l'une et l'autre application : c'est par lui que les
-- écrans les trouvent, quel que soit le numéro que la base leur a donné et
-- quoi que les parcours e2e aient créé à côté pour les mêmes clients.
-- Idempotent : une pièce déjà là n'est pas recréée.
do $$
declare
  v_soc constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_durand constant uuid := 'a2000000-0000-0000-0000-000000000002';
  v_tilleuls constant uuid := 'a2000000-0000-0000-0000-000000000003';
  v_brouillon uuid;
  v_emise uuid;
begin
  select id into v_brouillon from factures where societe_id = v_soc and interlocuteur = 'Témoin visuel' and client_id = v_durand;
  if v_brouillon is null then
    -- Un brouillon en cours de saisie, pas encore chiffré, créé il y a des mois : l'ancien compte
    -- les brouillons dans le chiffre d'affaires du tableau de bord et des statistiques
    -- (DEF-ECR-03) et en écrit la création « Mme Durand · null » dans le fil d'activité
    -- (DEF-ECR-04). Ces défauts sont à trancher par le client ; un écran de facturation n'a pas
    -- à les faire mesurer aux écrans du tableau de bord.
    insert into factures (societe_id, client_id, client_nom, interlocuteur, adresse, code_postal, ville, date, echeance,
                          remise_pourcentage, acomptes_deduits, conditions_reglement, mode_paiement, statut, type_document, cree_le)
    values (v_soc, v_durand, 'Mme Durand', 'Témoin visuel', '5 impasse des Lilas', '69100', 'Villeurbanne', '2026-09-22', '2026-10-22',
            0, 0, '30 jours net', 'virement', 'brouillon', 'facture', '2025-12-10 09:00+01')
    returning id into v_brouillon;
    -- Sans chapitre, comme le brouillon né du devis que l'écran mesurait : le métier d'un
    -- chapitre manque encore aux formulaires de devis et de facture (D-VIS2-01).
    insert into facture_lignes (facture_id, position, type, designation, quantite, prix_unitaire, unite, tva) values
      (v_brouillon, 0, 'ligne', 'Dépose de la baignoire', 1, 0, 'forfait', 10),
      (v_brouillon, 1, 'ligne', 'Receveur extra-plat 90 × 120', 1, 0, 'u', 10);
  end if;

  select id into v_emise from factures where societe_id = v_soc and interlocuteur = 'Témoin visuel' and client_id = v_tilleuls;
  if v_emise is null then
    insert into factures (societe_id, client_id, client_nom, interlocuteur, adresse, code_postal, ville, date, echeance,
                          remise_pourcentage, acomptes_deduits, conditions_reglement, mode_paiement, statut, type_document)
    values (v_soc, v_tilleuls, 'SCI Les Tilleuls', 'Témoin visuel', '8 avenue Foch', '69006', 'Lyon', '2026-09-12', '2026-10-12',
            0, 0, '30 jours net', 'virement', 'brouillon', 'facture')
    returning id into v_emise;
    insert into facture_lignes (facture_id, position, type, designation, quantite, prix_unitaire, unite, tva) values
      (v_emise, 0, 'ligne', 'Réfection de la cage d''escalier', 1, 1850, 'forfait', 10),
      (v_emise, 1, 'ligne', 'Remplacement de la minuterie', 2, 96, 'u', 20);
    -- L'émission : la base numérote en quittant le brouillon, comme `emettre_facture`.
    update factures set statut = 'impayée' where id = v_emise;
  end if;
end $$;

select numero, client_nom, statut from factures where interlocuteur = 'Témoin visuel' order by client_nom;
