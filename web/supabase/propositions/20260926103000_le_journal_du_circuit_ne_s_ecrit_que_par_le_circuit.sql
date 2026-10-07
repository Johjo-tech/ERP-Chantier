-- PROPOSITION — non appliquée en production (AUTH-73, D-TRV-05).
--
-- Défaut : `workflow_journal` accepte l'INSERT de tout membre
-- (`est_membre`) : n'importe qui — rôle « lecture » compris — y écrit une
-- fausse transition (« chiffré → facturé », motif inventé) que l'historique du
-- bon affiche comme vraie.
--
-- Or toutes les écritures légitimes passent par les RPC du circuit
-- (`bc_*`, `tache_marquer_realisee`, `tache_valider`), SECURITY DEFINER,
-- propriété de `postgres` : elles n'ont besoin d'aucune politique. Aucun écran
-- (ni `app.js`, ni `web/`) n'y écrit directement.
--
-- Correction : plus de politique INSERT, et les droits d'écriture retirés aux
-- rôles d'API. La lecture ne change pas.
-- Validé par : tests/rls/transversal.essai.ts (« [proposition] journal du circuit »),
-- tests/rls/circuit.essai.ts (les RPC écrivent toujours).
-- Idempotent.

drop policy if exists workflow_journal_insert on public.workflow_journal;
revoke insert, update, delete on public.workflow_journal from anon, authenticated;
