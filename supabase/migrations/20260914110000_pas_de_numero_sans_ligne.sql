-- Un numéro ne s'accorde plus à une facture sans ligne.
--
-- 55 factures numérotées de production ne portent **aucune ligne**. Toutes au
-- nom de « CLIENT DE TEST », créées entre le 7 et le 9 septembre, dont 43 le
-- 8 : les suites d'intégration tournaient encore contre la vraie base. Elles
-- ont consommé des numéros de la série réelle — FAC-2026-0025, 0031, 0036…
-- On ne facture rien, et pourtant la pièce existe.
--
-- Rien ne l'empêchait. `facture_attribuer_numero` s'exécute `before insert` :
-- à cet instant la facture n'a aucune ligne, elles arrivent dans la requête
-- HTTP suivante. Le trigger ne pouvait donc rien vérifier.
--
-- La règle existe pourtant dans le code — `BG-25` de la norme EN 16931, « une
-- facture sans ligne ne peut pas être émise » — mais elle n'était consultée
-- qu'au moment d'envoyer la facture électronique, bien après l'attribution du
-- numéro. Le garde-fou était en aval du geste qu'il devait empêcher.
--
-- ## Ce qui change
--
-- Le numéro se mérite à l'émission, pas à l'insertion :
--
--   * une facture peut naître **brouillon** sans rien ;
--   * elle ne peut naître **émise** que si elle porte déjà des lignes — ce qui
--     est impossible en une seule insertion, donc une création directe au
--     statut « impayée » est refusée, avec le chemin à suivre dans le message ;
--   * elle passe à un statut émis, et c'est là que les lignes sont comptées.
--
-- `bc_generer_facture` crée déjà en brouillon : ce chemin ne bouge pas.
--
-- Les 55 factures existantes ne sont **pas** touchées : décision prise le
-- 14/09. Cette migration empêche seulement que le cas se reproduise.

create or replace function public.facture_attribuer_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_annee   integer;
  v_lignes  integer;
begin
  -- Un brouillon n'engage rien : il n'a pas de numéro, et s'il en portait un
  -- par erreur on ne le lui retire pas — ce serait perdre une référence déjà
  -- peut-être communiquée.
  if new.statut = 'brouillon' then
    return new;
  end if;

  if coalesce(new.numero, '') <> '' then
    return new;
  end if;

  /* Le compte des lignes facturables. À l'insertion il vaut zéro par
     construction : une facture et ses lignes ne peuvent pas arriver dans la
     même requête. C'est voulu — une pièce comptable naît brouillon, on la
     complète, puis on l'émet. */
  select count(*) into v_lignes
    from public.facture_lignes l
   where l.facture_id = new.id
     and coalesce(l.type, 'ligne') = 'ligne';

  if v_lignes = 0 then
    raise exception
      'Facture sans ligne : aucun numéro ne peut lui être attribué (règle BG-25 — une facture sans ligne ne peut pas être émise). Créez-la au statut « brouillon », ajoutez ses lignes, puis passez-la à « impayée ».'
      using errcode = 'check_violation';
  end if;

  -- L'année de la pièce, pas celle du jour : une facture datée du 31 décembre
  -- enregistrée le 2 janvier appartient à la série de l'exercice clos.
  v_annee := extract(year from coalesce(new.date, current_date))::integer;

  new.numero := numero_suivant_interne(
    new.societe_id,
    coalesce(new.type_document::text, 'facture'),
    v_annee
  );
  return new;
end;
$$;

comment on function public.facture_attribuer_numero() is
  'Attribue le numéro à l''émission, dans la transaction de l''enregistrement. Un brouillon reste sans numéro ; une facture sans ligne n''en reçoit aucun (BG-25).';
