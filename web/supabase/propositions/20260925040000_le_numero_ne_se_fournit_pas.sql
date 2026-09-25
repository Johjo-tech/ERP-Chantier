-- PROPOSITION — non appliquée en production (relecture 2, I-8).
--
-- `facture_attribuer_numero` rend la main dès qu'un numéro est PRÉSENT : un
-- INSERT qui fournit lui-même `numero` au statut « impayée » crée une facture
-- émise, sans ligne (BG-25 contourné) et hors de la série légale. Constaté avec
-- le compte secrétaire sur la base locale.
--
-- Seule exception légitime : la reprise de l'historique comptable, dont les
-- pièces arrivent avec LEUR numéro d'origine et un `legacy_id` préfixé
-- « compta: » (src/api/regles-import-factures.ts#PREFIXE_LEGACY). Toute autre
-- pièce reçoit son numéro de la base, et de la base seule.
--
-- Relecture 4, I1 : ce marqueur, le client le choisit lui-même. Écrire
-- « compta: » devant l'identifiant suffisait à un compte `factures/creer` (la
-- secrétaire) pour émettre une pièce numérotée hors série, sans ligne. Il est
-- donc réservé à l'ADMINISTRATEUR de la société — le poser (INSERT), le
-- retirer ou l'ajouter (UPDATE), et fournir un numéro sous lui — et une
-- reprise porte ses lignes comme toute pièce émise (BG-25). La reprise se
-- fait depuis le navigateur (pas de `service_role`) ; une session sans JWT
-- (maintenance, migration) n'est pas concernée. Conséquence pour l'écran
-- historique : « Reprendre un historique » échoue désormais pour la
-- secrétaire, avec le motif de la base (D-SQL-02).
-- Test : tests/rls/politiques.essai.ts (« [proposition] relecture 4 » : I1).
create or replace function public.facture_attribuer_numero()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_annee   integer;
  v_lignes  integer;
  v_fourni  boolean;
  v_reprise boolean := coalesce(new.legacy_id, '') like 'compta:%';
  v_admin   boolean := auth.uid() is null or coalesce(est_admin(new.societe_id), false);
begin
  v_fourni := coalesce(new.numero, '') <> ''
              and (tg_op = 'INSERT' or coalesce(old.numero, '') = '');

  if not v_admin
     and ((tg_op = 'INSERT' and v_reprise)
          or (tg_op = 'UPDATE' and v_reprise is distinct from (coalesce(old.legacy_id, '') like 'compta:%'))) then
    raise exception
      'La reprise d''un historique comptable (marqueur « compta: ») est réservée à l''administrateur de la société.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_fourni then
    if not v_reprise then
      raise exception
        'Le numéro d''une facture est attribué par la base à son émission : il ne se fournit pas.'
        using errcode = 'check_violation';
    end if;
    if not v_admin then
      raise exception
        'La reprise d''un historique comptable (marqueur « compta: ») est réservée à l''administrateur de la société.'
        using errcode = 'insufficient_privilege';
    end if;
    select count(*) into v_lignes
      from public.facture_lignes l
     where l.facture_id = new.id
       and coalesce(l.type, 'ligne') = 'ligne';
    if v_lignes = 0 then
      raise exception
        'Pièce reprise sans ligne : elle ne peut pas recevoir son numéro (règle BG-25). Écrivez ses lignes d''abord.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.statut = 'brouillon' then
    return new;
  end if;

  if coalesce(new.numero, '') <> '' then
    return new;
  end if;

  select count(*) into v_lignes
    from public.facture_lignes l
   where l.facture_id = new.id
     and coalesce(l.type, 'ligne') = 'ligne';

  if v_lignes = 0 then
    raise exception
      'Facture sans ligne : aucun numéro ne peut lui être attribué (règle BG-25 — une facture sans ligne ne peut pas être émise). Créez-la au statut « brouillon », ajoutez ses lignes, puis passez-la à « impayée ».'
      using errcode = 'check_violation';
  end if;

  v_annee := extract(year from coalesce(new.date, current_date))::integer;
  new.numero := numero_suivant_interne(new.societe_id, coalesce(new.type_document::text, 'facture'), v_annee);
  return new;
end;
$function$;
