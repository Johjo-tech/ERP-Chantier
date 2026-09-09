-- Découper les adresses reprises de l'ancien magasin.
--
-- La facture électronique transmet la voie, le code postal et la commune
-- séparément (BT-50, BT-52, BT-53). L'application les saisit ainsi depuis
-- longtemps — le formulaire client a trois champs et une autocomplétion qui
-- les remplit — mais les fiches reprises de `kv_store` portent tout dans
-- `adresse` : « 21 AVENUE DE CONSTANTINE 38100 GRENOBLE ».
--
-- Le validateur Mustangproject l'a relevé sur une facture réelle : commune et
-- code postal absents de la partie acheteur.
--
-- La règle est la même qu'en TypeScript (`regles-adresse.ts`), et elle est
-- volontairement prudente :
--
--   * un code postal est un groupe de cinq chiffres qui n'ouvre pas l'adresse
--     — sinon c'est un numéro de voie — et qui est suivi d'au moins un mot,
--     la commune ;
--   * on ne remplit que ce qui est vide : une commune saisie n'est jamais
--     remplacée par une commune devinée ;
--   * sans code postal reconnaissable, on ne touche à rien. Une adresse fausse
--     partirait sur une facture ; une adresse incomplète se voit et se corrige.

-- Le motif : ce qui précède, les cinq chiffres, ce qui suit.
create or replace function public.decouper_adresse(p_adresse text)
returns table (rue text, code_postal text, ville text)
language sql
immutable
as $$
  with normalisee as (
    select btrim(regexp_replace(coalesce(p_adresse, ''), '\s+', ' ', 'g')) as texte
  ),
  capture as (
    select texte,
           (regexp_match(texte, '^(.*\S)[\s,]+(\d{5})[\s,]+(\S.*)$'))  as parties
      from normalisee
  )
  select
    case when parties is null then nullif(texte, '') else btrim(parties[1], ' ,') end,
    case when parties is null then null else parties[2] end,
    case when parties is null then null else btrim(parties[3], ' ,') end
  from capture;
$$;

comment on function public.decouper_adresse is
  'Sépare voie / code postal / commune. Ne devine rien sans code postal — miroir de src/api/regles-adresse.ts.';

-- ---------------------------------------------------------------------------
-- La réparation, appelable plutôt qu'écrite une fois.
--
-- Une migration s'exécute avant le chargement des données : sur la base
-- distante, où les fiches existent déjà, une simple série d'`update` suffirait.
-- En local, la copie est chargée *après* les migrations, et la réparation
-- passerait sur une base vide. D'où une fonction, appelée ici pour le distant
-- et depuis le seed pour le local — une seule implémentation, deux moments.
--
-- `update ... from f(cible.colonne)` est refusé par Postgres : une fonction ne
-- peut être corrélée à la table mise à jour qu'à travers un LATERAL, d'où la
-- CTE qui calcule d'abord, puis rejoint sur l'identifiant.

create or replace function public.reparer_adresses()
returns table (entite text, reparees integer)
language plpgsql
as $$
declare
  v_table text;
  v_n     integer;
begin
  -- Les trois tables qui portent une adresse postale transmise sur facture :
  -- l'acheteur (BT-52/53), le vendeur (BT-37/38), et le sous-traitant qui nous
  -- facture à son tour.
  foreach v_table in array array['clients', 'societes', 'sous_traitants'] loop
    execute format($f$
      with decoupe as (
        select t.id, d.rue, d.code_postal, d.ville
          from public.%I t
          cross join lateral public.decouper_adresse(t.adresse) d
         where coalesce(t.code_postal, '') = ''
           and coalesce(t.ville, '') = ''
           and d.code_postal is not null
      )
      update public.%I t
         set adresse     = x.rue,
             code_postal = x.code_postal,
             ville       = x.ville,
             maj_le      = now()
        from decoupe x
       where x.id = t.id
    $f$, v_table, v_table);
    get diagnostics v_n = row_count;
    entite := v_table;
    reparees := v_n;
    return next;
  end loop;
end;
$$;

comment on function public.reparer_adresses is
  'Découpe les adresses d''un bloc en voie / code postal / commune. Idempotente.';

select * from public.reparer_adresses();
