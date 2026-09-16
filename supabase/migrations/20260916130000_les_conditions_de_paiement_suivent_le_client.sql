-- Les conditions de paiement se paramètrent par client, et la facture les fige.
--
-- Le délai (jours + mode) était déjà sur le client depuis `20260916100000`.
-- Manquaient le moyen de paiement — le même pour tous, lu dans un réglage de
-- société — et surtout la trace du délai SUR la facture : seule l'échéance
-- calculée y était écrite. Changer le délai d'un client rendait donc
-- impossible de savoir sous quelle condition une ancienne facture avait été
-- émise, et de recalculer son échéance si sa date bougeait.

-- 1. Le moyen de paiement du client, dans l'énumération que la facture porte
--    déjà : un client qui paie par chèque ne doit pas se traduire en un code
--    que `factures.mode_paiement` refuserait.
alter table public.clients
  add column if not exists mode_paiement public.mode_paiement;

comment on column public.clients.mode_paiement is
  'Moyen de paiement convenu avec ce client, recopié sur ses factures. '
  'NULL = non convenu, le virement fait foi.';

-- 2. La facture garde le délai qui l'a produite, pas seulement sa conséquence.
alter table public.factures
  add column if not exists delai_paiement_jours integer,
  add column if not exists delai_paiement_mode  public.delai_paiement_mode;

do $$ begin
  alter table public.factures
    add constraint factures_delai_paiement_jours_positif
    check (delai_paiement_jours is null or delai_paiement_jours >= 0);
exception when duplicate_object then null; end $$;

comment on column public.factures.delai_paiement_jours is
  'Le délai sous lequel CETTE facture a été émise, figé à la création. '
  'Le client peut changer ensuite : la facture, elle, ne bouge plus.';
comment on column public.factures.delai_paiement_mode is
  'Comment ces jours se comptent. Avec delai_paiement_jours, permet de '
  'recalculer `echeance` quand la date de facture change.';

-- 3. Les clients existants : Net 30 jours, règlement par virement.
--
--    NULL signifiait « le réglage de la société fait foi », et ce défaut vaut
--    justement 30 jours nets — la valeur écrite ici ne change donc rien au
--    comportement d'aujourd'hui. Elle rend le paramétrage explicite, ce que
--    demande la fiche client ; l'écran garde une entrée « réglage de la
--    société » pour revenir au comportement hérité.
update public.clients
   set delai_paiement_jours = 30
 where delai_paiement_jours is null;

update public.clients
   set delai_paiement_mode = 'net'
 where delai_paiement_mode is null;

update public.clients
   set mode_paiement = 'virement'
 where mode_paiement is null;

-- 4. Les factures déjà émises : on reprend le délai de leur client. À défaut,
--    on laisse vide plutôt que d'inventer une condition qui n'a pas été celle
--    de l'émission — `echeance` et `conditions_reglement` restent la trace.
update public.factures f
   set delai_paiement_jours = c.delai_paiement_jours,
       delai_paiement_mode  = coalesce(c.delai_paiement_mode, 'net')
  from public.clients c
 where c.id = f.client_id
   and f.delai_paiement_jours is null;

update public.factures f
   set mode_paiement = coalesce(c.mode_paiement, 'virement')
  from public.clients c
 where c.id = f.client_id
   and f.mode_paiement is null;
