-- L'invitation s'applique, même à un compte qui existait déjà.
--
-- Deux déclencheurs font vivre le circuit (20260911100000) : `handle_new_user`
-- à l'inscription, `accepter_invitations_apres_confirmation` à la confirmation
-- de l'adresse. Ils portent le MÊME corps, recopié mot pour mot. Deux copies
-- d'une règle de droits, c'est une divergence qui attend son heure.
--
-- Et il leur manque un cas, celui qui va se présenter dès le premier usage :
-- quelqu'un dont le compte existe et est DÉJÀ confirmé ne déclenchera ni l'un
-- (passé) ni l'autre (la transition a eu lieu). Son invitation resterait
-- « en_attente » pour toujours, sans que rien ne le dise. C'est le cas
-- ordinaire du salarié qui avait déjà un compte pour une autre société.
--
-- On extrait donc le corps une fois, et on le rend appelable — à la clé de
-- SERVICE seulement. Accordée à `authenticated`, cette fonction permettrait à
-- un compte NON confirmé de s'appliquer lui-même ses invitations, c'est-à-dire
-- de contourner exactement la preuve de possession de l'adresse sur laquelle
-- tout le circuit repose.

create or replace function public.appliquer_invitations(p_profile_id uuid)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_email text;
  v_inv record;
  v_appliquees integer := 0;
begin
  select p.email into v_email from public.profiles p where p.id = p_profile_id;
  if coalesce(v_email, '') = '' then
    return 0;
  end if;

  for v_inv in
    select * from public.invitations
     where lower(email) = lower(v_email) and statut = 'en_attente'
  loop
    insert into public.membres_societe (profile_id, societe_id, role, actif)
    values (p_profile_id, v_inv.societe_id, v_inv.role, true)
    on conflict (profile_id, societe_id)
      do update set role = excluded.role, actif = true;

    if v_inv.salarie_id is not null then
      update public.salaries set profile_id = p_profile_id where id = v_inv.salarie_id;
    end if;
    if v_inv.sous_traitant_id is not null then
      update public.sous_traitants set contact_profile_id = p_profile_id
       where id = v_inv.sous_traitant_id;
    end if;

    update public.invitations set statut = 'acceptee', maj_le = now() where id = v_inv.id;
    v_appliquees := v_appliquees + 1;
  end loop;

  return v_appliquees;
end;
$fn$;

comment on function public.appliquer_invitations(uuid) is
  'Applique les invitations en attente pour l''adresse de ce profil. Réservée '
  'au service_role : l''appeler soi-même contournerait la preuve de possession '
  'de l''adresse, seule garde du circuit. L''appelant doit avoir vérifié que '
  'le compte est confirmé.';

revoke all on function public.appliquer_invitations(uuid) from public;
revoke all on function public.appliquer_invitations(uuid) from anon;
revoke all on function public.appliquer_invitations(uuid) from authenticated;
grant execute on function public.appliquer_invitations(uuid) to service_role;

-- Les deux déclencheurs n'ont plus de corps propre.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  insert into public.profiles (id, email, nom)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'nom',
                   split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;

  -- Le rôle n'est accordé qu'à une adresse prouvée. Cette condition, et elle
  -- seule, empêche de s'attribuer un accès avec l'adresse d'un autre.
  if new.email is not null and new.email_confirmed_at is not null then
    perform public.appliquer_invitations(new.id);
  end if;
  return new;
end;
$fn$;

create or replace function public.accepter_invitations_apres_confirmation()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  insert into public.profiles (id, email, nom)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;

  perform public.appliquer_invitations(new.id);
  return new;
end;
$fn$;

-- ------------------------------------------------------ L'invitation se tient
--
-- La table est vide en production : poser ces garde-fous ne coûte rien
-- aujourd'hui, et l'occasion ne se représentera plus.

alter table public.invitations drop constraint if exists invitations_statut_connu;
alter table public.invitations add constraint invitations_statut_connu
  check (statut in ('en_attente', 'acceptee', 'annulee', 'expiree'));

-- La date du dernier envoi, pour refuser un renvoi précipité : le plafond de
-- mails d'Auth est global au projet, une salve le brûlerait pour tout le
-- monde, y compris pour les réinitialisations de mot de passe.
alter table public.invitations add column if not exists invitee_le timestamptz;

create index if not exists invitations_salarie_id_idx
  on public.invitations(salarie_id) where salarie_id is not null;

-- Un salarié n'a qu'une invitation en vol. Deux adresses en attente sur la
-- même fiche, et le premier des deux qui confirme prendrait la place.
create unique index if not exists invitations_une_par_salarie_en_attente
  on public.invitations(salarie_id)
  where salarie_id is not null and statut = 'en_attente';
