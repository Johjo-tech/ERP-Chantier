-- Facturation électronique : identifier les entités.
--
-- Depuis le 1er septembre 2026, toute entreprise doit pouvoir **recevoir** une
-- facture électronique ; l'émission devient obligatoire pour les TPE/PME au
-- 1er septembre 2027.
--
-- Les tables `clients` et `societes` portent déjà toutes les colonnes
-- nécessaires — elles ne sont simplement jamais renseignées par l'interface.
-- Deux manques réels subsistent, et c'est tout l'objet de cette migration.

-- 1. Les sous-traitants nous facturent.
--
-- `factures_entrantes` identifie son émetteur par `emetteur_siren` /
-- `emetteur_siret` / `emetteur_tva_intracom`. La table `sous_traitants` n'a que
-- `siret` : une facture entrante arrivant avec un SIREN ne peut être rapprochée
-- d'aucun sous-traitant. Sans ces colonnes, la réception reste aveugle.

alter table public.sous_traitants
  add column if not exists siren text,
  add column if not exists tva_intracom text,
  add column if not exists pays_code text default 'FR',
  add column if not exists adresse_electronique_schema text,
  add column if not exists adresse_electronique_valeur text;

comment on column public.sous_traitants.siren is
  'SIREN — clé de rapprochement avec factures_entrantes.emetteur_siren.';
comment on column public.sous_traitants.adresse_electronique_schema is
  'Schéma de codification de l''adresse électronique : 0009 = SIRET, 0225 = SIREN.';

-- 2. Référence acheteur (BT-10).
--
-- Obligatoire en marché public, où Chorus Pro la nomme « code service
-- exécutant » — ce cas est déjà couvert par `clients.code_service`. Mais les
-- acheteurs privés réclament couramment leur propre référence interne, et
-- aucune colonne ne la porte au niveau du client. Les deux bailleurs sociaux
-- de la base sont précisément dans ce cas.

alter table public.clients
  add column if not exists reference_acheteur text;

comment on column public.clients.reference_acheteur is
  'BT-10 — référence que l''acheteur exige de voir sur ses factures.';

-- 3. Pays par défaut.
--
-- BT-40 (pays du vendeur) et BT-55 (pays de l'acheteur) sont obligatoires en
-- EN 16931 : un pays absent invalide la facture entière. Les lignes existantes
-- sont toutes à 'FR' ; le défaut évite qu'une ligne future parte à NULL.
-- Pas de `not null` : une contrainte rétroactive casserait les reprises de
-- données historiques.

alter table public.clients        alter column pays_code set default 'FR';
alter table public.societes       alter column pays_code set default 'FR';
alter table public.sous_traitants alter column pays_code set default 'FR';
