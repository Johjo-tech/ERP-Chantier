-- La facture désigne son acheteur, pas seulement son nom.
--
-- L'écran ne connaît ses clients que par leur nom ; la base a une fiche avec un
-- SIRET. Le pont n'écrivait que `client_nom`, si bien que les factures nées de
-- l'écran n'avaient aucun lien vers la fiche — et donc rien pour désigner
-- l'acheteur au sens de l'EN 16931. `manquesPourEmettre` répondait « le client
-- doit être joignable », et la plateforme les aurait refusées.
--
-- Seule `bc_generer_facture` posait le lien : 393 factures numérotées sur 1 792.
--
-- Le pont le pose désormais à l'enregistrement. Ce rattrapage s'occupe des
-- factures déjà émises, que l'application ne peut plus corriger elle-même
-- depuis que leur en-tête est gelé.

-- Le gel refuse toute retouche d'en-tête ; ici on ne change pas ce que la
-- facture DIT, on rétablit ce qu'elle a toujours désigné. Il est donc suspendu
-- le temps du rattrapage, et uniquement sur des colonnes restées vides.
alter table public.factures disable trigger factures_entete_figee;

update public.factures f
   set client_id            = c.id,
       client_siret         = coalesce(nullif(f.client_siret, ''), c.siret),
       client_siren         = coalesce(nullif(f.client_siren, ''), c.siren),
       client_tva_intracom  = coalesce(nullif(f.client_tva_intracom, ''), c.tva_intracom),
       client_pays_code     = coalesce(nullif(f.client_pays_code, ''), c.pays_code),
       client_code_service  = coalesce(nullif(f.client_code_service, ''), c.code_service),
       client_code_routage  = coalesce(nullif(f.client_code_routage, ''), c.code_routage)
  from public.clients c
 where c.societe_id = f.societe_id
   and c.nom = f.client_nom
   and f.client_id is null;

-- Les factures déjà liées mais sans identifiants recopiés : même traitement,
-- sans toucher au lien.
update public.factures f
   set client_siret         = coalesce(nullif(f.client_siret, ''), c.siret),
       client_siren         = coalesce(nullif(f.client_siren, ''), c.siren),
       client_tva_intracom  = coalesce(nullif(f.client_tva_intracom, ''), c.tva_intracom),
       client_pays_code     = coalesce(nullif(f.client_pays_code, ''), c.pays_code)
  from public.clients c
 where c.id = f.client_id
   and coalesce(f.client_siret, '') = ''
   and coalesce(f.client_siren, '') = '';

alter table public.factures enable trigger factures_entete_figee;

-- Le devis mérite le même lien : il devient facture, et repartir d'un nom seul
-- reproduirait le trou.
update public.devis d
   set client_id = c.id
  from public.clients c
 where c.societe_id = d.societe_id
   and c.nom = d.client_nom
   and d.client_id is null;
