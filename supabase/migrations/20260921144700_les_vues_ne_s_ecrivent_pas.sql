-- Les vues de lecture ne s'écrivent plus.
--
-- Quatre vues du schéma public n'ont pas `security_invoker` : elles s'exécutent
-- donc avec les droits de leur PROPRIÉTAIRE, `postgres`, pour qui la RLS ne
-- s'applique pas. Or Supabase accorde par défaut tous les droits à `anon` et
-- `authenticated` sur tout objet du schéma. Sur une table, la RLS reprend la
-- main derrière et le défaut est sans conséquence. Sur une vue à droits du
-- propriétaire, il n'y a plus rien derrière.
--
-- Prouvé plutôt que déduit, sur la base locale, avec la seule clé anonyme —
-- celle qui est inlinée en clair dans le paquet servi au navigateur, donc
-- publique par construction :
--
--     POST /rest/v1/v_bons_commande_terrain
--     {"societe_id":"…","client_nom":"INTRUSION ANONYME","date":"2026-09-21"}
--     → HTTP 201, et la ligne se retrouve dans `bons_commande`.
--
-- Sans être connecté. Il suffisait de connaître un identifiant de société.
--
-- LE REMÈDE EST LA RÉVOCATION, PAS `security_invoker`. Poser l'option
-- corrigerait aussi l'écriture, mais elle changerait la LECTURE : ces vues
-- existent précisément pour donner au terrain une projection que la table ne
-- lui accorde pas. La basculer la veille d'une livraison, c'est risquer de
-- fermer aux techniciens ce qu'ils doivent voir. On retire l'écriture, et rien
-- d'autre.
--
-- Sans effet sur l'application : le registre de `html-adapter.ts` le dit en
-- toutes lettres à propos de `vueLecture` — « L'écriture, elle, vise toujours
-- la table. » Le SELECT reste donc intact.
--
-- Les quatre autres vues (v_chantier_avancement, v_devis_totaux,
-- v_facture_solde, v_facture_totaux) portent `security_invoker = true` : la RLS
-- s'y applique déjà, elles ne sont pas concernées.

revoke insert, update, delete, truncate
    on public.v_bons_commande_terrain            from anon, authenticated;
revoke insert, update, delete, truncate
    on public.v_bon_commande_lignes_terrain      from anon, authenticated;
revoke insert, update, delete, truncate
    on public.v_travaux_supplementaires_terrain  from anon, authenticated;
revoke insert, update, delete, truncate
    on public.v_salaries_annuaire                from anon, authenticated;

comment on view public.v_bons_commande_terrain is
  'Projection de lecture pour le terrain. Droits du propriétaire (pas de security_invoker) : l''écriture y est RÉVOQUÉE pour anon et authenticated depuis le 2026-09-21, un INSERT anonyme y ayant créé un bon de commande réel. L''écriture vise la table.';

-- NOTE DU 23/09/2026 — renommée depuis `20260921110000_les_vues_ne_s_ecrivent_pas.sql`.
--
-- Elle partageait son horodatage avec `le_chapitre_porte_son_metier`. Le registre
-- `supabase_migrations.schema_migrations` ne retient qu'une ligne par version :
-- les deux fichiers se présentaient sous la même, et le script de déploiement,
-- qui résout `ls supabase/migrations/<version>_*.sql | head -1`, ne pouvait en
-- voir qu'un seul. Les deux effets sont bien en production — la colonne `metier`
-- sur les trois tables de lignes, et l'écriture révoquée sur les quatre vues
-- sans `security_invoker` — mais un environnement reconstruit depuis les
-- migrations en aurait sauté un, en silence.
--
-- L'horodatage retenu est l'heure à laquelle le fichier a réellement été écrit.
-- La rejouer est sans effet : `revoke` sur un droit déjà retiré ne lève pas,
-- vérifié sur la production dans une transaction annulée.
