-- L'achat de chantier s'enregistre enfin.
--
-- CE QUI SE PASSAIT. `addChantierAchat` empilait l'achat dans `c.achats[]`
-- puis appelait `stSet('chantier:'+id, c)`. Or le pont déclare
-- `chantier: { table: "chantiers" }` SANS table fille, et `chantiers` n'a pas
-- de colonne `achats` : `colonnesDe()` écartait le tableau en silence.
-- L'écran affichait « Achat enregistré. », et rien ne partait. Au rechargement
-- suivant, la saisie avait disparu.
--
-- La table `chantier_achats` existait pourtant — designation, montant,
-- fournisseur, date_achat, fichier — mais elle n'était écrite que par une
-- requête du code TypeScript, jamais par l'écran. Il lui manque trois colonnes
-- que l'écran saisit et qui n'avaient nulle part où aller.
--
-- 0 chantier et 0 achat en local comme en production : personne n'a encore
-- perdu de saisie, et il n'y a rien à reprendre.
--
-- RLS : rien à écrire. `chantier_achats` est déjà cloisonnée, et les colonnes
-- ajoutées héritent de ses politiques.

alter table public.chantier_achats
  add column if not exists categorie  text,
  add column if not exists salarie_id uuid references public.salaries(id) on delete set null,
  add column if not exists heures     numeric;

comment on column public.chantier_achats.categorie is
  'Le CODE de l''entrée du référentiel, domaine « categorie_achat » — pas son '
  'libellé. C''est le code que l''écran teste (« salarie » ouvre les champs '
  'salarié et heures), et c''est ce qui permet de renommer « Salarié » en '
  '« Main-d''œuvre » sans toucher aux dépenses déjà saisies.';

comment on column public.chantier_achats.salarie_id is
  'Renseigné pour un achat de main-d''œuvre. `on delete set null` : une fiche '
  'RH supprimée ne doit pas emporter la dépense du chantier.';

comment on column public.chantier_achats.heures is
  'Heures passées, pour un achat de main-d''œuvre. Le montant reste saisi : '
  'il n''est pas recalculé depuis le coût horaire, qui change avec le temps.';

-- Les achats d'un chantier se lisent toujours ensemble, et par date.
create index if not exists chantier_achats_par_chantier
  on public.chantier_achats (chantier_id, date_achat);
