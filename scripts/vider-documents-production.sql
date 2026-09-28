-- Remise à zéro des DOCUMENTS en production : devis, bons de commande,
-- factures et avoirs, pour les quatre sociétés.
--
-- Demandé le 2026-09-28, avant de reprendre l'historique comptable une seconde
-- fois : la première reprise avait laissé les avoirs disponibles, et ils
-- pouvaient solder une facture d'aujourd'hui. Le correctif est livré ; ce
-- fichier efface ce qui a été écrit avant lui.
--
-- CE QUI PART — 1 098 pièces au constat du 2026-09-28 :
--   devis · bons_commande · factures (avoirs compris)
--   et, par CASCADE : devis_lignes, bon_commande_lignes, bon_commande_photos,
--   planning_taches, tache_travaux_supplementaires, facture_lignes,
--   reglements, facture_cycle_vie, chantier_avancement_factures.
--
-- CE QUI RESTE, et c'est la différence avec `vider-donnees-production.sql` :
--   clients, chantiers, interventions, articles, salariés, techniciens,
--   conducteurs, véhicules, matériels, sociétés, réglages, droits, comptes.
--   Seuls les documents sont visés.
--
-- Deux liens deviennent NULL plutôt que de bloquer : `vehicules.facture_vente_id`
-- et `chantier_dpgf_lignes.devis_source_id`. C'est le comportement déclaré des
-- clés, pas un effet de bord.

begin;

-- ---------------------------------------------------------------- La garde
-- Ce fichier ne doit JAMAIS tourner sur la pile locale, qui porte les comptes
-- « @local ». Et si les quatre sociétés attendues n'y sont pas, la base visée
-- n'est pas celle qu'on croit : on s'arrête avant d'écrire.
do $$
declare v_codes int;
begin
  if exists (select 1 from auth.users where email like '%@local') then
    raise exception 'REFUS : base LOCALE (comptes « @local » présents).'
      using errcode = 'insufficient_privilege';
  end if;
  select count(*) into v_codes from societes where code in ('kta','chm','alkia','akt');
  if v_codes <> 4 then
    raise exception 'REFUS : % société(s) attendue(s) sur 4 — base inattendue.', v_codes
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ------------------------------------------------- Désarmer les deux verrous
-- `facture_numero_immuable` et `lignes_facture_emise_figees` refusent la
-- suppression d'une pièce numérotée, et ne testent aucun rôle : ils refusent
-- même à `postgres`. C'est leur raison d'être — art. L441-9. On les désarme le
-- temps de cette remise à zéro assumée, et on les rearme avant de valider.
alter table public.factures       disable trigger user;
alter table public.facture_lignes disable trigger user;

-- ------------------------------------------------------------- Les documents
-- Une instruction par table, jamais par lots : `factures.facture_rectifiee_id`
-- est en NO ACTION, et les avoirs désignent la facture qu'ils rectifient. Un
-- effacement global passe, un effacement par lots casserait sur la première
-- facture rectifiée encore désignée par son avoir.
delete from public.factures;
delete from public.devis;
delete from public.bons_commande;

-- Le journal du circuit ne porte aucune clé étrangère : rien ne l'emporte, et
-- ses lignes désignent des bons qui n'existent plus.
delete from public.workflow_journal;

-- ------------------------------------------------------------ Les compteurs
-- Par UPDATE, jamais par DELETE : la ligne porte le `prefixe` réglé, qu'un
-- DELETE perdrait — elle serait recréée vide par le `on conflict` de
-- `numero_suivant_interne()`, et les bons se renuméroteraient en « BON-… ».
update public.compteurs set valeur = 0, maj_le = now();

alter table public.factures       enable trigger user;
alter table public.facture_lignes enable trigger user;

commit;
