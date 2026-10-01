-- Les devis déjà numérotés n'ont jamais été de vrais brouillons : l'ancien
-- écran donnait un numéro dès la première sauvegarde. Ils gardent ce numéro et
-- prennent l'état qui leur correspond désormais.
--
-- Dans un fichier à part, et appliquée APRÈS le déploiement du code : l'écran
-- d'avant ne connaît pas « émis », et y faire passer les devis pendant qu'il
-- est encore servi casserait la liste le temps que Vercel publie.

update public.devis
   set statut = 'émis'
 where statut = 'brouillon'
   and coalesce(numero, '') <> '';
