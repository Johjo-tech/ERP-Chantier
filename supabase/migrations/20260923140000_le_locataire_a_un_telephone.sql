-- Le numéro du locataire, sur le devis et le bon de commande.
--
-- Demandé en réunion (point #10), laissé « à préciser » faute de savoir sur
-- QUELS documents il devait figurer. La réponse : devis, bon de commande, et
-- les cartes du planning — celles que le technicien lit avant de partir.
--
-- PAS SUR LA FACTURE, et c'est délibéré. Une facture part chez le bailleur et
-- se conserve dix ans : le numéro personnel d'un locataire n'a rien à y faire.
-- `factures` ne reçoit donc pas la colonne, et `bc_generer_facture` n'a rien à
-- recopier — il ne copie que les colonnes qu'il nomme.
--
-- Les quatre tables de documents portent déjà le bloc du locataire — `occupant`,
-- `adresse_locataire`, `ancien_locataire`, `etage`, `numero_logement`,
-- `logement_statut`. Il n'y manquait que le moyen de le joindre.
--
-- RLS : rien à faire. Une colonne ajoutée à une table héritée de ses politiques
-- est couverte par elles ; `devis` et `bons_commande` sont déjà cloisonnés par
-- `societe_id`. Aucune politique nouvelle, donc aucune occasion d'en écrire une
-- plus large que les autres.
--
-- Texte libre, et non un format contraint : on saisit ici des numéros dictés au
-- téléphone — « 06 12 34 56 78 », « 04.90.12.34.56 », parfois deux séparés par
-- une barre. Un `check` sur le format ferait échouer l'enregistrement d'un bon
-- entier pour une espace de trop, et c'est le bon qui compte.

alter table public.devis
  add column if not exists telephone_locataire text;

alter table public.bons_commande
  add column if not exists telephone_locataire text;

comment on column public.devis.telephone_locataire is
  'Numéro pour joindre le locataire avant l''intervention. Texte libre : les '
  'numéros sont dictés, pas normalisés. Ne part pas sur la facture.';

comment on column public.bons_commande.telephone_locataire is
  'Numéro pour joindre le locataire avant l''intervention. Lu sur les cartes du '
  'planning par le technicien. Texte libre ; ne part pas sur la facture.';
