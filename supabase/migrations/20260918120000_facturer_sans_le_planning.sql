-- Facturer un bon de commande sans passer par le planning — administrateur seul.
--
-- Certaines affaires n'ont pas à traverser le circuit du terrain : pas de tâche
-- planifiée, pas de pointage, pas d'arbitrage du conducteur — mais un bon à
-- chiffrer et à envoyer en facturation. Jusqu'ici l'écran le refusait, et
-- `bc_passer_pret_a_chiffrer` aussi : « Ce bon de commande n'a aucune tâche à
-- chiffrer ».
--
-- Le contournement existait pourtant déjà, par accident. `bc_chiffrage_valide`
-- ne lisait JAMAIS le statut de départ avant d'écrire « chiffre » : un
-- administrateur pouvait la joindre directement et sauter tout le circuit. Pire,
-- elle journalisait un `ancien_statut` écrit en dur —
--
--     VALUES (…, 'pret_a_chiffrer', 'chiffre', auth.uid());
--
-- — si bien qu'un bon facturé sans terrain était INDISCERNABLE d'un bon passé
-- par toutes les étapes. Une porte dérobée doublée d'un journal qui ment.
--
-- Cette migration fait deux choses, indissociables :
--
--   1. `bc_chiffrage_valide` reçoit la garde qui lui manquait — le bon doit être
--      en « prêt à chiffrer ». Sans elle, la porte nommée ouverte ci-dessous ne
--      serait qu'une décoration posée à côté d'un mur déjà percé.
--
--   2. `bc_chiffrage_valide_hors_circuit` ouvre ce même passage, mais NOMMÉ :
--      administrateur seul, sans exigence de tâche, et journalisant la vraie
--      transition.
--
-- La trace tombe alors toute seule, sans colonne nouvelle : le chemin nominal
-- passe forcément par « prêt à chiffrer ». Un `en_cours → chiffre` au journal
-- EST la marque du contournement.
--
-- Ce qui reste contrôlé dans les deux cas : le rôle, et les travaux
-- supplémentaires encore « à chiffrer ». Sauter le planning n'autorise pas à
-- facturer un montant que personne n'a arrêté.

-- 1. La garde manquante, et un journal qui dit vrai
create or replace function public.bc_chiffrage_valide(p_bc_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_societe    uuid;
  v_role       text;
  v_statut     text;
  v_a_chiffrer integer;
begin
  select societe_id, coalesce(statut_workflow, 'en_cours')
    into v_societe, v_statut
    from public.bons_commande
   where id = p_bc_id
     for update;

  if v_societe is null then
    raise exception 'Bon de commande introuvable' using errcode = 'P0002';
  end if;

  v_role := role_dans_societe(v_societe);
  if v_role is null or v_role <> 'admin' then
    raise exception 'Seul un administrateur peut valider le chiffrage'
      using errcode = '42501';
  end if;

  -- Le contrôle qui n'existait pas. Le message nomme les deux issues, pour que
  -- l'administrateur sache qu'il n'est pas dans une impasse.
  if v_statut <> 'pret_a_chiffrer' then
    raise exception 'Transition interdite : % -> chiffre. Le bon doit d''abord passer par « prêt à chiffrer » — ses tâches validées par le conducteur — ou être validé hors circuit.', v_statut
      using errcode = 'check_violation';
  end if;

  select count(*) into v_a_chiffrer
    from public.tache_travaux_supplementaires
   where bon_commande_id = p_bc_id and statut = 'a_chiffrer';

  if v_a_chiffrer > 0 then
    raise exception 'Des travaux supplementaires ne sont pas encore chiffres (% ligne(s))', v_a_chiffrer
      using errcode = 'P0001';
  end if;

  update public.bons_commande
     set statut_workflow = 'chiffre', maj_le = now()
   where id = p_bc_id;

  -- Le statut relu, non plus un littéral : c'est la garde ci-dessus qui rend
  -- les deux équivalents, et c'est elle qui pouvait manquer.
  insert into public.workflow_journal
    (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  values (v_societe, 'bon_commande', p_bc_id, v_statut, 'chiffre', auth.uid());
end;
$function$;

-- 2. La porte nommée
create or replace function public.bc_chiffrage_valide_hors_circuit(p_bc_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_societe    uuid;
  v_role       text;
  v_statut     text;
  v_a_chiffrer integer;
begin
  select societe_id, coalesce(statut_workflow, 'en_cours')
    into v_societe, v_statut
    from public.bons_commande
   where id = p_bc_id
     for update;

  if v_societe is null then
    raise exception 'Bon de commande introuvable' using errcode = 'P0002';
  end if;

  -- Même formulation que la fonction nominale : le refus doit se lire pareil
  -- des deux côtés, puisque l'écran montre le motif tel quel.
  v_role := role_dans_societe(v_societe);
  if v_role is null or v_role <> 'admin' then
    raise exception 'Seul un administrateur peut valider le chiffrage'
      using errcode = '42501';
  end if;

  -- Liste BLANCHE, comme sa jumelle — et non liste noire. La première version
  -- refusait « chiffre » et « facture » en nommant ce qu'elle interdisait :
  -- elle laissait donc passer « cloture_gratuit », l'affaire close sans suite
  -- facturable (geste commercial, erreur d'appel). Un bon offert au client
  -- serait revenu en facturation par cette porte, et son drapeau de gratuité
  -- avec lui. Nommer ce qu'on AUTORISE ferme aussi les états à venir.
  if v_statut not in ('en_cours', 'pret_a_chiffrer') then
    raise exception 'Ce bon de commande est « % » : il ne peut plus partir en facturation par ce chemin.', v_statut
      using errcode = 'check_violation';
  end if;

  -- Sauter le planning ne dispense pas d'arrêter les montants constatés sur le
  -- chantier : un travail « à chiffrer » partirait en facturation à zéro.
  select count(*) into v_a_chiffrer
    from public.tache_travaux_supplementaires
   where bon_commande_id = p_bc_id and statut = 'a_chiffrer';

  if v_a_chiffrer > 0 then
    raise exception 'Des travaux supplementaires ne sont pas encore chiffres (% ligne(s))', v_a_chiffrer
      using errcode = 'P0001';
  end if;

  update public.bons_commande
     set statut_workflow = 'chiffre', maj_le = now()
   where id = p_bc_id;

  -- LA trace. `en_cours → chiffre` n'existe par aucun autre chemin.
  insert into public.workflow_journal
    (societe_id, entite, entite_id, ancien_statut, nouveau_statut, auteur_id)
  values (v_societe, 'bon_commande', p_bc_id, v_statut, 'chiffre', auth.uid());
end;
$function$;

revoke execute on function public.bc_chiffrage_valide_hors_circuit(uuid) from public;
revoke execute on function public.bc_chiffrage_valide_hors_circuit(uuid) from anon;
grant execute on function public.bc_chiffrage_valide_hors_circuit(uuid) to authenticated;

comment on function public.bc_chiffrage_valide_hors_circuit(uuid) is
  'Envoie un bon de commande en facturation sans que le planning en atteste. Administrateur seul. Le journal porte la transition réelle — un en_cours -> chiffre est la marque de ce chemin.';
