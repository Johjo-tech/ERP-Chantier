-- Le cycle de vie d'une facture, tel que la plateforme le raconte.
--
-- `facture_cycle_vie` existait déjà mais ne portait pas de quoi reconnaître un
-- événement déjà importé. Sans cela, chaque synchronisation dupliquerait toute
-- l'histoire du document.

alter table public.facture_cycle_vie
  add column if not exists pdp_evenement_id text,
  add column if not exists code_plateforme text;

comment on column public.facture_cycle_vie.pdp_evenement_id is
  'Identifiant de l''événement chez la plateforme. Rend la synchronisation rejouable sans doublon.';
comment on column public.facture_cycle_vie.code_plateforme is
  'Le code brut reçu (« fr:211 »). Conservé même quand il n''a pas d''équivalent dans notre énumération.';

-- Un même événement ne s'importe qu'une fois.
create unique index if not exists facture_cycle_vie_evenement_unique
  on public.facture_cycle_vie (facture_id, pdp_evenement_id)
  where pdp_evenement_id is not null;

create index if not exists facture_cycle_vie_facture_idx
  on public.facture_cycle_vie (facture_id, date_statut desc);

-- Les factures entrantes viennent de la plateforme : le même identifiant ne
-- doit pas créer deux lignes si la synchronisation est rejouée.
create unique index if not exists factures_entrantes_pdp_unique
  on public.factures_entrantes (societe_id, pdp_identifiant)
  where pdp_identifiant is not null;
