-- Un devis enregistré, numéroté, et que personne n'a encore vu.
--
-- Le cycle voulu : on travaille un brouillon SANS numéro, puis « Enregistrer
-- le devis » lui en attribue un — et il n'a alors aucun statut à afficher tant
-- qu'il n'est pas parti chez le client. Aucune des quatre valeurs existantes
-- ne dit cela : « brouillon » n'a pas de numéro, « envoyé » est déjà parti.
--
-- Seule dans son fichier : PostgreSQL refuse d'utiliser une valeur d'énumération
-- dans la transaction qui l'a créée. La migration suivante s'en sert.

alter type public.devis_statut add value if not exists 'émis' after 'brouillon';
