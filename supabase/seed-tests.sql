-- Comptes de rôle pour les tests, base locale uniquement.
--
-- Jusqu'ici toute la suite tournait sous un compte unique et administrateur :
-- elle prouvait que le chemin nominal marche, jamais qu'un autre est fermé.
-- Aucune garde de rôle n'était donc testée — ni « seul le conducteur
-- arbitre », ni « le terrain ne déclare que les tâches de son équipe ».
--
-- Ces comptes n'ont rien de réel : identifiants fixes, mot de passe trivial,
-- domaine `.local`. Ils ne valent que dans le conteneur, où ils sont recréés à
-- chaque `supabase db reset`. Le projet distant ne les voit jamais.
--
-- Ils sont versionnés, eux — contrairement au dump des données réelles — parce
-- qu'un test qui dépend d'un compte fabriqué à la main n'est pas reproductible.

do $$
declare
  v_societe uuid;
  v_comptes constant jsonb := jsonb_build_array(
    jsonb_build_object('id', '11111111-1111-1111-1111-111111111111', 'email', 'tech.a@local',      'nom', 'Technicien A', 'role', 'technicien'),
    jsonb_build_object('id', '44444444-4444-4444-4444-444444444444', 'email', 'tech.b@local',      'nom', 'Technicien B', 'role', 'technicien'),
    jsonb_build_object('id', '55555555-5555-5555-5555-555555555555', 'email', 'conducteur@local',  'nom', 'Conducteur',   'role', 'conducteur')
  );
  v_compte jsonb;
begin
  -- La société des tests d'intégration ; sans elle, rien à rattacher.
  select id into v_societe from public.societes where code = 'kta' limit 1;
  if v_societe is null then
    select id into v_societe from public.societes order by cree_le limit 1;
  end if;
  if v_societe is null then
    raise notice 'Aucune société : comptes de test non créés.';
    return;
  end if;

  for v_compte in select * from jsonb_array_elements(v_comptes) loop
    /* Les colonnes de jeton doivent valoir la chaîne vide, jamais NULL : le
       service d'authentification lit la ligne entière à la connexion et
       échoue sur « Database error querying schema » si l'une d'elles est
       nulle. Les comptes créés par l'API les initialisent ainsi. */
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, email_change,
      phone_change, phone_change_token, reauthentication_token
    )
    values (
      (v_compte->>'id')::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_compte->>'email',
      crypt('motdepasse-test', gen_salt('bf')),
      now(), now(), now(), '{}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;

    -- Sans identité « email », la connexion par mot de passe n'aboutit pas.
    insert into auth.identities (
      id, provider_id, user_id, provider, identity_data, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      (v_compte->>'id'),
      (v_compte->>'id')::uuid,
      'email',
      jsonb_build_object('sub', v_compte->>'id', 'email', v_compte->>'email', 'email_verified', true),
      now(), now()
    )
    on conflict do nothing;

    insert into public.profiles (id, nom)
    values ((v_compte->>'id')::uuid, v_compte->>'nom')
    on conflict (id) do update set nom = excluded.nom;

    insert into public.membres_societe (profile_id, societe_id, role, actif)
    values ((v_compte->>'id')::uuid, v_societe, (v_compte->>'role')::role_membre, true)
    on conflict do nothing;
  end loop;
end;
$$;
