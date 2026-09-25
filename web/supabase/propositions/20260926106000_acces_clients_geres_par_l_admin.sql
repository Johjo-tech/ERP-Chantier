-- PROPOSITION — non appliquée en production (D-TRV-08).
--
-- Besoin : l'espace client (20260925030000, 20260926042000) n'a aucun écran
-- de gestion. `acces_clients` s'écrit par l'administrateur (politique
-- `acces_clients_ecriture`), mais il ne peut ni TROUVER le compte du client
-- (`profiles` ne lui montre que les membres de ses sociétés — un client n'en
-- est jamais membre, D-008), ni AFFICHER à qui un accès est ouvert.
--
-- Deux fonctions, réservées à l'administrateur de la société (`est_admin`),
-- SECURITY DEFINER pour lire `profiles` sans l'ouvrir :
--   * `acces_clients_de_la_societe(société)` : les accès, avec le client, le
--     nom et l'adresse du compte ;
--   * `ouvrir_acces_client(client, email, interlocuteur)` : cherche le compte
--     par son adresse (sans casse), ouvre l'accès ou le rouvre. Rend
--     'ouvert' | 'rouvert' | 'deja_ouvert' | 'compte_absent' | 'compte_membre'.
--     Un compte MEMBRE de la société est refusé : il voit déjà tout, et un
--     accès client ne le restreindrait pas — l'écran le dit au lieu de
--     laisser croire à un portail.
-- Fermer, rouvrir, retirer : écriture directe de `acces_clients` (politique
-- existante, admin seul).
--
-- La création du COMPTE d'un client (auth) demande la clé de service : hors de
-- cette proposition, comme `inviter-salarie` pour les salariés (D-TRV-08).
-- Dépend de : 20260925030000, 20260926042000 (colonne `interlocuteur`).
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] accès clients »).
-- Idempotent.

create or replace function public.acces_clients_de_la_societe(p_societe uuid)
 returns table (
   id uuid, client_id uuid, client_nom text, profile_id uuid, compte_nom text,
   compte_email text, interlocuteur text, actif boolean, cree_le timestamptz
 )
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not coalesce(est_admin(p_societe), false) then
    raise exception 'Seul un administrateur de la société gère les accès clients.' using errcode = '42501';
  end if;
  return query
    select a.id, a.client_id, c.nom, a.profile_id, p.nom, p.email, a.interlocuteur, a.actif, a.cree_le
      from acces_clients a
      join clients c on c.id = a.client_id
      join profiles p on p.id = a.profile_id
     where a.societe_id = p_societe
     order by c.nom, p.email;
end;
$function$;

create or replace function public.ouvrir_acces_client(p_client uuid, p_email text, p_interlocuteur text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_societe uuid;
  v_profil uuid;
  v_acces acces_clients%rowtype;
begin
  select societe_id into v_societe from clients where id = p_client;
  if v_societe is null or not coalesce(est_admin(v_societe), false) then
    raise exception 'Seul un administrateur de la société gère les accès clients.' using errcode = '42501';
  end if;
  select id into v_profil from profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_profil is null then
    return 'compte_absent';
  end if;
  if exists (select 1 from membres_societe m where m.profile_id = v_profil and m.societe_id = v_societe) then
    return 'compte_membre';
  end if;
  select * into v_acces from acces_clients where profile_id = v_profil and client_id = p_client;
  if not found then
    insert into acces_clients (profile_id, client_id, societe_id, actif, interlocuteur)
    values (v_profil, p_client, v_societe, true, nullif(trim(p_interlocuteur), ''));
    return 'ouvert';
  end if;
  if v_acces.actif then
    return 'deja_ouvert';
  end if;
  update acces_clients set actif = true, interlocuteur = nullif(trim(p_interlocuteur), '') where id = v_acces.id;
  return 'rouvert';
end;
$function$;

revoke execute on function public.acces_clients_de_la_societe(uuid) from public, anon;
revoke execute on function public.ouvrir_acces_client(uuid, text, text) from public, anon;
grant execute on function public.acces_clients_de_la_societe(uuid) to authenticated;
grant execute on function public.ouvrir_acces_client(uuid, text, text) to authenticated;
