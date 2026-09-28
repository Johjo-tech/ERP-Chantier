# Défauts de l'ancienne application, conservés à l'identique — à trancher par le client

Consigne du client : `web/` reste **identique** à l'ancienne application, défauts compris. Chaque
défaut repéré est consigné ici pour que le client le teste lui-même et décide s'il faut le corriger.
Pour chacun : l'écran, comment le reproduire, ce que l'ancienne affiche, ce qui serait juste, et la
correction qui existait déjà dans `web/` pour la remettre vite si la réponse est « on corrige ».

Comptes de la base locale (mot de passe `motdepasse-local`) : `admin.alpha@erp.local`,
`secretaire.alpha@erp.local`, `conducteur.alpha@erp.local`, `technicien.alpha@erp.local`,
`soustraitant.alpha@erp.local`, `lecture.alpha@erp.local` (docs/RAPPORT-MATIN.md). Chaque
reproduction se fait à l'identique dans l'ancienne application et dans `web/` : les deux doivent
afficher la même chose.

Le catalogue réunit aussi, depuis sa quatrième section, les **autres** défauts connus de l'ancienne
application : ceux de la base de production que les migrations proposées corrigent (DEF-BDD), ceux
que `web/` corrige déjà et où il **diffère** donc aujourd'hui de l'ancienne (DEF-COR), et ceux qui
restent reproduits sans correction (DEF-REP). Chaque entrée renvoie à une décision
(`docs/DECISIONS.md`), un item de l'inventaire (`docs/INVENTAIRE.md`), un test ou une ligne de
code ; « à vérifier » signale ce que la lecture du code et de la documentation ne suffit pas à
établir.

Pour reproduire dans l'ancienne application : elle se lance à la racine du dépôt et se branche sur
la même base locale que `web/` (`tests/visuel/README.md`, adresse `http://127.0.0.1:5174` dans
l'environnement des agents).

## Récapitulatif

États : « identique à l'ancienne » (`web/` reproduit le défaut), « corrigé dans web/ » (`web/`
diffère de l'ancienne), « correction proposée en base » (migration de `supabase/propositions/`,
**jamais appliquée en production**). Gravité : sécurité / données perdues / calcul / affichage.

| Identifiant | Défaut (titre court) | État | Gravité |
|---|---|---|---|
| DEF-STA-01 | CA : brouillons et acomptes comptés | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-01 ») | calcul |
| DEF-STA-02 | « CA encaissé ce mois » ≠ encaissements | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-02 ») | calcul |
| DEF-STA-03 | Restant dû et taux d'encaissement : brouillons comptés | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-03 ») | calcul |
| DEF-STA-04 | Impayées / échues lues sur le statut stocké | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-04 ») | calcul |
| DEF-STA-05 | « Locataires à rappeler » : affaires closes | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-05 ») | calcul |
| DEF-STA-06 | Activité récente : « · null », lettrages en paiements | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-06 ») | affichage |
| DEF-STA-07 | Top clients par nom écrit | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-07 ») | calcul |
| DEF-STA-08 | Statistiques par étiquette du conducteur | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-08 ») | calcul |
| DEF-STA-09 | « En retard » : bons facturés, clos | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-09 ») | calcul |
| DEF-STA-10 | Barre rouge pleine « 0 / 0 » | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-10 ») | affichage |
| DEF-STA-11 | Travaux supplémentaires toujours à 0 | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-11 ») | calcul |
| DEF-STA-12 | Jamais « injoignable » | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-12 ») | calcul |
| DEF-STA-13 | Technicien : seul le jour du rendez-vous | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-13 ») | calcul |
| DEF-STA-14 | Sous-traitant : deux tuiles à zéro | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-14 et 19 ») | calcul |
| DEF-STA-15 | Infobulle 12 mois : année fausse | corrigé en production (66ea9e1), repris dans web/ — vérifié (`tests/parite/statistiques.essai.ts` « DEF-STA-15 ») | affichage |
| DEF-STA-16 | Infobulle : montant en mode discret | corrigé dans web/ (masqué, TRV-05) — vérifié (`tests/parite/statistiques.essai.ts` « DEF-STA-16 ») | affichage |
| DEF-STA-17 | Part du CA négative ou > 100 % | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-17 ») | calcul |
| DEF-STA-18 | Bons rangés par date de saisie | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-18 ») | calcul |
| DEF-STA-19 | Sous-traitant : salutation et bandeau génériques | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-14 et 19 », `components/tableaux.essai.tsx`) | affichage |
| DEF-ECR-01 | Rapport sans statut : pastille vide | corrigé dans web/ (30724e8) ; correction proposée en base (20260928212000) | affichage |
| DEF-ECR-02 | « 📦 Commandé » n'enregistre pas la date | corrigé dans web/ (vérifié, D-COR2-02) | données perdues |
| DEF-ECR-03 | Brouillon compté dans le CA (= STA-01) | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-01 / DEF-ECR-03 ») | calcul |
| DEF-ECR-04 | « Mme Durand · null » (= STA-06) | corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-06 / DEF-ECR-04 ») | affichage |
| DEF-BDD-01 | `prochain_numero` ouvert à une autre société | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-02 | Compte désactivé qui se réactive ; adresse d'un autre | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-03 | Suivi médical, notes et dossiers RH lisibles par tous | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-04 | Seau `terrain` : fichiers d'autrui lisibles et inscriptibles | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-05 | Facture numérotée à la main, hors série et sans ligne | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-06 | Lignes d'un bon facturé modifiables | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-07 | Bon créé directement « chiffré » | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-08 | Un bon facturé deux fois | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-09 | Le rôle lecture supprime dans les tables filles | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-10 | La secrétaire exclue de ce que la matrice lui donne (devis compris) | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-11 | Le technicien écrit achats, affectations, DPGF, référentiels | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-12 | L'admin ne relit pas le chantier qu'il crée | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-13 | Le sous-traitant lit les tâches et bons de ses confrères | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-14 | Journal du circuit falsifiable | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-15 | Fonctions de déclencheur exécutables par tous ; annuaire sans barrière | correction proposée en base — en partie prouvée (échoue sans / passe avec) | sécurité |
| DEF-BDD-16 | `v_facture_solde` : avoirs dus, acomptes ignorés | correction proposée en base — prouvée (échoue sans, passe avec) | calcul |
| DEF-BDD-17 | Règlements imputés par l'écran, pas par la base | correction proposée en base — prouvée (échoue sans, passe avec) | calcul |
| DEF-BDD-18 | Supprimer un brouillon de situation : DPGF rendu, facture debout | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-19 | Avoir en deux appels, cumul non borné | correction proposée en base — prouvée (échoue sans, passe avec) | calcul |
| DEF-BDD-20 | Imputation d'avoir retirée à moitié | correction proposée en base — prouvée (échoue sans, passe avec) | calcul |
| DEF-BDD-21 | Préfixes « BON-2027 » et « NOT- » | correction proposée en base — prouvée (échoue sans, passe avec) | affichage |
| DEF-BDD-22 | Champs du chantier sans colonne | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-23 | Le sous-traitant ne peut pointer aucune tâche | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-24 | Photos du terrain illisibles, effaçables par le rôle lecture | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-25 | Rapports : sous-traitant lit les internes ; lien au bon sans colonne | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-26 | Téléphone de l'occupant jamais servi au terrain | correction proposée en base — prouvée (échoue sans, passe avec) | affichage |
| DEF-BDD-27 | Prêts sans durée, deux prêts en cours, suppression par lecture | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-BDD-28 | Espace client inexistant en base | correction proposée en base — prouvée (échoue sans, passe avec) | sécurité |
| DEF-BDD-29 | Fériés d'Alsace-Moselle sans réglage | correction proposée en base — prouvée (échoue sans, passe avec) | affichage |
| DEF-BDD-30 | « Fait » de la cloche réservé aux réglages | correction proposée en base — prouvée (échoue sans, passe avec) | données perdues |
| DEF-COR-01 | Achats du chantier jamais relus (erreur 42703) | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-02 | DPGF, avancements et to-do perdus au rechargement | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-03 | Bon né du DPGF : lien perdu, conducteur vide, tâche en double | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-04 | Fichiers du chantier en data-URL | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-05 | DPGF : saisies perdues, « Planifier » muet, « 2,5 » lu 2 | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-06 | Ligne de DPGF facturée encore modifiable ou remplacée | corrigé — confirmé par le client (28/09) — remis le 28/09 | calcul |
| DEF-COR-07 | Achats, to-do : échecs d'écriture muets | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-08 | Situation de travaux : flottant, avancement avant la facture | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-09 | Montants en flottant (1,005 € → 1,00 €) | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-10 | Reste d'une facture à acomptes ou d'un avoir | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-11 | Statut payé/impayé et règlement groupé tenus par l'écran | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-12 | Avoir, imputation, suppression de situation en plusieurs requêtes | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-13 | « Émettre » enregistre d'abord la saisie | corrigé — confirmé par le client (28/09) — défaut absent de l'ancien (vérifié) | données perdues |
| DEF-COR-14 | Acheteur rattaché par le nom ; SIRET d'un autre client gardé | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-15 | Listes de règlement : brouillons à 0, « ✎ Modifier » muet | corrigé — confirmé par le client (28/09) — remis le 28/09 | affichage |
| DEF-COR-16 | Aucun geste pour changer le statut d'un devis | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-17 | Chapitres homonymes fusionnés | corrigé — confirmé par le client (28/09) — défaut absent de l'ancien (vérifié) | calcul |
| DEF-COR-18 | Hors circuit : travaux chiffrés hors chapitre ; chiffrage sans quantité | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-19 | File Validation : compteur faux, circuits clos | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-20 | Pièce commandée : une seule tâche, échec ignoré | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-21 | Case « Métiers réalisés » qui n'enregistre rien | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-22 | Boutons proposés que la base refuse | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-23 | Téléphone du locataire écrit, jamais relu | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-24 | « reçue le 25T16:29:20…/09/2026 » | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-25 | Planning : tâches et journées mal tenues au placement | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-26 | « Date faite » sans colonne ; « Terminée le » jamais effacée | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-27 | Photos du terrain perdues | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-28 | Rapport : brouillon imprimé, contrôles perdus, IA sans clé | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-29 | Prêts et entretiens perdus | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-30 | Date de contrôle technique jamais conservée | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-31 | Carte carburant : un code PIN fait refuser la fiche | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-32 | Factures d'achat et d'entretien du véhicule perdues | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-33 | Vente de véhicule : acheteur en texte libre | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-34 | Absences perdues, solde faux | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-35 | Documents de sous-traitant perdus | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-36 | Fiche conducteur retirée réactivée | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-37 | Seuils d'alerte codés en dur ; cloche en double | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-38 | Conducteur ou fournisseur supprimé au lieu d'être retiré | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-39 | Logo et documents légaux en data-URL | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-40 | Préfixe de numérotation à tiret accepté | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-41 | Code de référentiel sans accents | corrigé — confirmé par le client (28/09) — défaut absent de l'ancien (vérifié) | affichage |
| DEF-COR-42 | « Fait » de la cloche refusé au terrain | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-43 | « 1,5 » saisi lu 1 | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-44 | « …alors que le pays est . » | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-45 | Catalogue : virgule qui casse la recherche, familles tronquées | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-46 | Listes tronquées sans le dire | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-47 | Messages d'erreur en anglais | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-48 | La recherche perd le focus | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-49 | Rapport de rejets nommé `.pdf` | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-50 | Import de clients qui efface des champs | corrigé — confirmé par le client (28/09) | données perdues |
| DEF-COR-51 | Restauration de sauvegarde sans garde de rôle | corrigé — confirmé par le client (28/09) | sécurité |
| DEF-COR-52 | Factures de sous-traitant hors série, payées sans règlement | corrigé — confirmé par le client (28/09) | calcul |
| DEF-COR-53 | Portail client mort | corrigé — confirmé par le client (28/09) | sécurité |
| DEF-COR-54 | Réf. de bon client figée vide sans avertissement | corrigé — confirmé par le client (28/09) — remis le 28/09 | affichage |
| DEF-COR-55 | « Mon nom » inaccessible au terrain | corrigé — confirmé par le client (28/09) | affichage |
| DEF-COR-56 | Ordre des listes au gré de la base | corrigé — confirmé par le client (28/09) | affichage |
| DEF-REP-01 | Import d'articles : `1e3`, `0x10`, « 1 200,00 » | corrigé dans web/ (ad1087b) | calcul |
| DEF-REP-02 | Import de DPGF : « 1.234 » lu 1,234 | corrigé dans web/ (1376a23) | calcul |
| DEF-REP-03 | `articles.metier` ni saisi ni recopié | corrigé dans web/ (e37c56a) | affichage |
| DEF-REP-04 | Pièces imprimées : « 5.5% », avoir positif, SAV « BON DE COMMANDE » | corrigé dans web/ (95cfb34) | affichage |
| DEF-REP-05 | Nom du client absent des cartes de chantier | corrigé dans web/ (f38c3d4) | affichage |
| DEF-REP-06 | Sous-traitant non invitable | corrigé dans web/ (68a4961) ; fonction de bord proposée | affichage |
| DEF-REP-07 | Matériel : message « vide » même sur recherche | corrigé dans web/ (a406884) | affichage |
| DEF-REP-08 | Pré-facture : montants hors mode discret | corrigé dans web/ (89c7caf) | affichage |
| DEF-REP-09 | Textes périmés du cadre et de « nouveau mot de passe » | corrigé dans web/ (b57f363) | affichage |
| DEF-REP-10 | Deux statuts pour un bon | corrigé dans web/ (9b23235) ; colonne gardée (D-REP-10) | affichage |
| DEF-REP-11 | `extraire-bc` sans authentification | correction proposée (fonction de bord, 5cd0b69) | sécurité |
| DEF-REP-12 | Fonctions PDP : rôle non vérifié, secret comparé par `!==` | correction proposée (fonctions de bord, 5cd0b69) | sécurité |
| DEF-REP-13 | `inviter-salarie` : une seule page de 50 comptes | correction proposée (fonction de bord, 68a4961) | affichage |
| DEF-REP-14 | `bc_generer_facture` : virement forcé, TVA 10, sans conducteur | correction proposée en base (20260928200001) | calcul |
| DEF-REP-15 | Deux onglets, deux bons depuis le même devis | correction proposée en base (20260928200002) ; écran adapté (90bff00) | données perdues |
| DEF-REP-16 | Client ou conducteur d'une autre société sur un bon | correction proposée en base (20260928200003) | sécurité |
| DEF-REP-17 | Le terrain crée une fiche conducteur ou fournisseur | correction proposée en base (20260928200004) | sécurité |
| DEF-REP-18 | Clients, véhicules, annuaire lisibles par le sous-traitant | correction proposée en base (20260928200005), en partie (D-REP-18) | sécurité |
| DEF-REP-19 | Sept factures restées dans `kv_store` | correction proposée (procédure humaine, D-REP-19) | données perdues |
| DEF-REP-20 | Niveau d'abonnement non opposable | correction proposée en base (20260928200007) | sécurité |

## Statistiques et tableaux de bord

**Tranché le 28/09 : tout est CORRIGÉ** (D-STA-B-01, qui remplace D-STA-A-01 ; commit e0002ce). La nouvelle
application garde la forme de l'ancienne (HTML, libellés, tuiles, et les nouveautés de production du
28/09, D-MAIN-10) mais ne reproduit plus ces défauts : montants lus dans les vues de la base
(`v_facture_totaux`, `v_devis_totaux`, `v_facture_solde`) et additionnés en décimal exact dans le
navigateur (voie b ; la proposition `retirees/20260926080000` n'est pas remise). Preuve, défaut par
défaut : `tests/parite/statistiques.essai.ts` — sur un même cas, l'ancien évalué donne la valeur fausse et le nouveau la juste ; sur des
sociétés sans défaut en jeu, mêmes chiffres. Valeur juste aussi dans
`src/modules/statistiques/domain/domaine.essai.ts`. Chaque entrée garde sa description (reproduction,
ancienne, juste) ; l'état dit ce qui est fait.

### DEF-STA-01 — Le chiffre d'affaires compte les brouillons et les factures d'acompte
- **Écrans** : Accueil (admin, secrétaire, lecture) — graphique « Chiffre d'affaires (HT) », « Total
  période », « Sélectionner les dates », « Top clients (HT) » ; Statistiques — colonne « Chiffre
  d'affaires (HT) », « Répartition du chiffre d'affaires », « Chiffre d'affaires par équipe et par
  mois », tuile « Factures effectuées ».
- **Reproduire** : `admin.alpha` → noter « Total période » de l'accueil. Factures → Nouvelle facture,
  une ligne à 1 000 € HT, **enregistrer en brouillon sans émettre** → retour à l'accueil : le total a
  pris 1 000 €. Puis : une facture d'acompte de 300 € HT émise, et la facture de solde de 1 000 € HT
  qui la déduit → le total prend 1 300 €.
- **Ancienne** : toute pièce datée compte (brouillon, acompte, situation), l'avoir en négatif.
- **Juste** : seules les pièces émises ; l'acompte est déjà compris dans la facture de solde (le
  compter double le chiffre d'affaires).
- **Correction existante** : D-STA-02 (`stats_ht_compte`, commit `3f534d0`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-01 ») — pièces émises hors acompte, avoir en négatif (`domain/pieces.ts#htCompte`, HT de `v_facture_totaux`), partout où l'écran liste ; un devis n'est transformé que par une facture émise.

### DEF-STA-02 — « CA encaissé ce mois (HT) » ne dit pas ce qui est entré en caisse
- **Écrans** : Accueil — tuile « CA encaissé ce mois (HT) » et première ligne du « Résumé du mois »
  (et sa jauge).
- **Reproduire** : `secretaire.alpha` → une facture datée du mois DERNIER, émise, réglée
  aujourd'hui en entier : la tuile ne bouge pas. Une facture de ce mois réglée à moitié : la tuile ne
  bouge pas. Une facture de ce mois au statut « payée » : la tuile prend son montant **HT**.
- **Ancienne** : Σ HT des factures au statut stocké « payée » **datées** du mois (date de la facture),
  acomptes compris ; la jauge compare à la plus grande valeur mensuelle des six derniers mois.
- **Juste** : Σ des règlements datés du mois (TTC), hors lettrages d'avoir.
- **Correction existante** : D-STA-04 (« Encaissé ce mois (TTC) », `stats_indicateurs.encaisse_mois`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-02 ») — tuile « Encaissé ce mois (TTC) » = règlements datés du mois hors lettrage (modes `avoir` / `imputation`, règlements portés par un avoir) ; même mesure pour son rappel N-1 et la ligne du résumé.

### DEF-STA-03 — Restant dû et taux d'encaissement comptent les brouillons
- **Écrans** : Accueil — « Factures impayées … restant dû », « Taux d'encaissement » du résumé.
- **Reproduire** : `admin.alpha` → noter le restant dû. Créer une facture de 500 € HT (TVA 20 %) en
  brouillon : le restant dû prend 600 €, et le taux d'encaissement baisse. Une facture au statut
  « payée » **sans règlement** (hors reprise « compta: ») compte aussi comme due.
- **Ancienne** : restant dû = Σ des restes calculés sur les règlements de toutes les factures non-avoir,
  brouillons compris ; taux = 1 − restant dû / Σ TTC de TOUTES les pièces (brouillons, acomptes).
- **Juste** : seules les pièces émises doivent ; dénominateur sur les pièces émises.
- **Correction existante** : D-STA-11 (`v_facture_solde`, `stats_indicateurs.impayes / ttc_emis`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-03 ») — restant dû = Σ `v_facture_solde.du` ; taux d'encaissement sur le TTC des pièces émises.

### DEF-STA-04 — « Factures impayées » et « Factures échues » se lisent sur le statut stocké
- **Écrans** : Accueil — nombre de la tuile « Factures impayées », ligne « Factures échues à relancer ».
- **Reproduire** : `admin.alpha` → une facture émise dont le statut stocké vaut « envoyée » (reprise
  ou ancien règlement partiel) avec une échéance dépassée : ni comptée impayée ni échue, alors que
  son montant figure dans le restant dû. Une facture « payée » sans règlement : dans le restant dû,
  pas dans le nombre.
- **Ancienne** : nombre = statut « impayée » hors avoirs ; échue = statut « impayée » et échéance passée.
- **Juste** : ce qui doit encore (reste > 0) et, pour « échue », dont l'échéance est passée — le même
  critère que le montant.
- **Correction existante** : D-STA-11 (`stats_indicateurs.nb_impayees / nb_echues`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-04 ») — impayées = `du` > 0 ; échues = `en_retard` de la base (ce qu'ouvre le lien « en retard »).

### DEF-STA-05 — « Locataires à rappeler » relance des affaires closes
- **Écran** : Accueil (pilotage) — « À traiter ».
- **Reproduire** : `admin.alpha` → un bon avec un rappel à aujourd'hui, puis le clore sans facturation
  (ou le chiffrer) : il reste compté dans « Locataires à rappeler ». Le tableau du conducteur, lui, ne
  le compte plus.
- **Ancienne** : tout bon dont la date de rappel est passée ou du jour.
- **Juste** : seulement un bon encore ouvert (même règle que le tableau du conducteur).
- **Correction existante** : D-STA-06 (`aTraiterPilotage`, commit `3f534d0`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-05 ») — rappels des seuls bons ouverts, comme le conducteur.

### DEF-STA-06 — Activité récente : « · null » et lettrages présentés comme des paiements
- **Écran** : Accueil — « Activité récente ».
- **Reproduire** : `secretaire.alpha` → créer une facture et la laisser en brouillon : la ligne
  « Facture créée » se lit « Client · null ». Imputer un avoir sur une facture : deux lignes
  « Paiement reçu » apparaissent (l'une sur la facture, l'autre sur l'avoir, du même montant), alors
  qu'aucun argent n'est entré.
- **Ancienne** : le numéro absent est écrit « null » ; tout règlement, lettrage compris, est un paiement.
- **Juste** : pas de « null » ; un lettrage d'avoir n'est pas un paiement reçu.
- **Correction existante** : `stats_activite_recente` (commit `3f534d0`, D-STA-04).
- **Corrigé en production, en partie (0f6f60d)** : le fil suit désormais la DATE des pièces (plus
  `createdAt`), nomme la pièce (« Devis », « Facture », « Avoir », « Rapport d'intervention ») et
  écrit « brouillon » pour une facture sans numéro. Restent « null » : un devis sans numéro et le
  paiement qui cite une facture en brouillon ; et les lettrages restent des « Paiement reçu ».
  Repris à l'identique dans `web/` (D-MAIN-10, `activiteRecente`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-06 ») — plus de « · null » (devis sans numéro, paiement d'un brouillon : « brouillon ») ; un lettrage d'avoir ne figure plus au fil. Le reste de 0f6f60d est gardé.

### DEF-STA-07 — Top clients : par le nom écrit sur la facture
- **Écran** : Accueil — « Top clients (HT) ».
- **Reproduire** : `admin.alpha` → deux factures pour le même client dont le nom est écrit
  différemment sur la pièce (« OPAC du Rhône » / « OPAC du Rhone ») : deux lignes au classement. Une
  facture sans nom de client : une ligne sans nom.
- **Ancienne** : groupé par `client_nom` de la pièce, toutes factures (DEF-STA-01). Depuis 0f6f60d,
  le classement est borné à l'exercice (« Top clients 2026 (HT) ») avec le montant N-1 sous chaque
  nom — le groupement par nom écrit, lui, demeure. Repris dans `web/` (D-MAIN-10).
- **Juste** : groupé par la fiche client (`client_id`), le nom à défaut.
- **Correction existante** : D-STA-05 (`stats_par_client`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-07 ») — groupé par `client_id` (nom de la fiche), à défaut par le nom sans casse ni blancs ; borné à l'exercice avec N-1 (0f6f60d, gardé).

### DEF-STA-08 — Statistiques groupées par l'étiquette du conducteur
- **Écran** : Statistiques — tableau et graphiques par conducteur.
- **Reproduire** : `admin.alpha` → Statistiques, « Tout l'historique ». Une pièce reprise dont
  l'étiquette `conducteur` porte une autre graphie que la fiche (données historiques) fait une ligne à
  part ; un bon sans conducteur n'apparaît nulle part (pas de ligne « Sans conducteur ») ; une fiche de
  conducteur sans aucune pièce a sa ligne, à zéro.
- **Ancienne** : une ligne par NOM (fiches, puis étiquettes des bons, devis et factures de la période).
- **Juste** : par la référence `conducteur_id`, le nom de la fiche, et une ligne « Sans conducteur ».
- **Correction existante** : D-STA-05 (`stats_par_conducteur`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-08 ») — une ligne par `conducteur_id`, nom de la fiche, et « Sans conducteur ».

### DEF-STA-09 — « En retard » compte les bons facturés, clos ou terminés
- **Écran** : Statistiques — colonnes « Dans les temps » / « En retard », graphique « dans les temps /
  en retard ».
- **Reproduire** : `admin.alpha` → un bon avec une date de fin de travaux passée, entièrement réalisé,
  chiffré puis facturé : il reste « en retard » pour toujours.
- **Ancienne** : en retard = date de fin de travaux < aujourd'hui, quel que soit l'état du bon ; dans les
  temps = tous les autres (bons sans date compris).
- **Juste** : fin de travaux dépassée sur un bon encore ouvert.
- **Correction existante** : D-STA-05 (`stats_bon_ouvert`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-09 ») — retard sur un bon ouvert (ni chiffré, ni facturé, ni clos, aucune facture, terrain pas tout pointé).

### DEF-STA-10 — Barre rouge pleine pour un conducteur sans bon
- **Écran** : Statistiques — graphique « Bons de commande — dans les temps / en retard ».
- **Reproduire** : `admin.alpha` → une fiche de conducteur qui n'a aucun bon sur la période (choisir
  « Ce mois-ci ») : sa barre est entièrement rouge, avec « 0 / 0 ».
- **Ancienne** : 0 dans les temps sur « 1 » → 0 %, donc 100 % en retard.
- **Juste** : pas de barre (ou une barre neutre) quand il n'y a aucun bon.
- **Correction existante** : aucune (la version précédente de `web/` avait le même défaut).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-10 ») — barre vide (ni verte ni rouge) pour un conducteur sans bon ; « 0 / 0 » reste écrit.

### DEF-STA-11 — Travaux supplémentaires toujours à zéro
- **Écran** : Statistiques — colonne « Travaux supplémentaires », barre « Travaux suppl. ».
- **Reproduire** : `admin.alpha` → signaler un travail supplémentaire sur un bon (planning, fiche de
  pointage), le chiffrer : la colonne reste « 0% (0) — 0,00 € ».
- **Ancienne** : lit `travauxSupplementaires` sur le bon, un champ qu'aucune colonne ne porte.
- **Juste** : lire `tache_travaux_supplementaires` (nombre hors refusés, montant des chiffrés).
- **Correction existante** : D-STA-05 (`stats_par_conducteur.travaux / travaux_ht`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-11 ») — lus dans `tache_travaux_supplementaires` (nombre hors refusés, montant des chiffrés et intégrés).

### DEF-STA-12 — Un locataire n'est jamais « injoignable »
- **Écran** : Accueil du conducteur — « Locataires à contacter ».
- **Reproduire** : `conducteur.alpha` → un de ses bons sans rendez-vous ; noter trois tentatives
  d'appel (planning, « Contacts ») : la ligne ne dit jamais « 1 injoignable après 3 tentatives ».
- **Ancienne** : `parseInt` du tableau des tentatives → NaN → 0.
- **Juste** : compter les tentatives du tableau.
- **Correction existante** : STA-20 (`nombreDeTentatives` qui compte le tableau, commit `3f534d0`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-12 ») — la donnée existe : `tentatives_contact` se compte ; trois tentatives sans rendez-vous font un injoignable.

### DEF-STA-13 — Tableau du technicien : seul le jour du rendez-vous compte
- **Écran** : Accueil du technicien — « Mes interventions aujourd'hui », « Les six prochains jours »,
  « Aujourd'hui ».
- **Reproduire** : `admin.alpha` → un bon planifié hier pour l'équipe du technicien, avec une journée
  supplémentaire aujourd'hui (planning). `technicien.alpha` → l'accueil annonce « Rien de planifié
  aujourd'hui » alors que « Ma journée » montre l'intervention. Une tâche confiée à son équipe sur un
  bon dont la colonne « technicien » désigne une autre équipe n'apparaît pas non plus.
- **Ancienne** : bons dont la colonne `technicien` désigne l'équipe ; seule `date_planifiee` compte.
- **Juste** : les journées (tâches) de l'équipe, comme « Ma journée ».
- **Correction existante** : `domain/terrain.ts` du commit `3f534d0` (cartes du planning).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-13 ») — les cartes du planning de son équipe, journées supplémentaires et tâches confiées sur le bon d'une autre équipe comprises (`domain/terrain.ts`).

### DEF-STA-14 — Tableau du sous-traitant : deux tuiles toujours à zéro
- **Écran** : Accueil du sous-traitant.
- **Reproduire** : `soustraitant.alpha` → « Mes devis » et « Mes factures impayées » valent 0 quoi qu'il
  arrive ; « Factures ALPHA prêtes » compte ses bons validés avec un montant sous-traitant, mais aucun
  écran ne permet d'établir ces factures (D-FAC-09).
- **Ancienne** : les champs `sousTraitantEmetteur` des devis et factures n'ont pas de colonne.
- **Juste** : lui montrer sa journée (le tableau du terrain), puisque devis et factures de
  sous-traitant n'existent pas.
- **Correction existante** : D-STA-09 (tableau du terrain pour le sous-traitant, commit `3f534d0`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-14 ») — le sous-traitant reçoit le tableau de sa journée, par son entreprise ; les trois tuiles de factures et devis sont retirées.

### DEF-STA-15 — Graphique sur 12 mois : l'année de l'infobulle est fausse
- **Écran** : Accueil — graphique « Chiffre d'affaires (HT) », période « 12 mois ».
- **Reproduire** : `admin.alpha` → survoler la barre d'un mois de l'an dernier (par exemple octobre
  quand on est en septembre) : l'infobulle annonce « octobre 2026 » au lieu de « octobre 2025 »
  (et « octobre 2025 » pour la barre grise, au lieu de 2024).
- **Ancienne** : l'année de la dernière barre est appliquée à toutes.
- **Juste** : l'année de chaque mois.
- **Correction existante** : `GraphiqueCA.tsx` du commit `3f534d0` (`p.annee`).
- **Corrigé en production (66ea9e1)** : chaque barre porte l'année de son mois, et la légende dit
  « Période » / « Un an plus tôt » quand la fenêtre est à cheval sur deux années. `web/` suit
  (`barresGraphique`, `legendeGraphique`, D-MAIN-10) : plus rien à trancher.
- **État** : vérifié le 28/09 (`tests/parite/statistiques.essai.ts` « DEF-STA-15 ») : rien à changer.

### DEF-STA-16 — L'infobulle du graphique montre les montants en mode discret
- **Écran** : Accueil — graphique, mode discret activé.
- **Reproduire** : activer le mode discret, survoler une barre : l'ancienne affiche le montant en clair.
- **Ancienne** : `money()` au lieu de `moneyDisplay()` dans l'infobulle.
- **Juste** : « ••• € ».
- **Dans `web/`** : NON reproduit — le mode discret masque tout montant d'écran (TRV-05, garde-fou
  `tests/garde-fous.essai.ts`). À trancher : reproduire le défaut ou garder le masque.
- **État** : le masque reste (D-STA-B-01, point 16) ; vérifié (`tests/parite/statistiques.essai.ts` « DEF-STA-16 », `components/format.ts#formatMontant` suit le mode discret).

### DEF-STA-17 — La part du chiffre d'affaires ignore les avoirs… à l'envers
- **Écran** : Statistiques — « Répartition du chiffre d'affaires ».
- **Reproduire** : `admin.alpha` → un conducteur dont les avoirs dépassent les factures sur la période
  (« Ce mois-ci ») : sa part est négative, et celles des autres dépassent 100 % au total ; sa barre
  n'a pas de largeur valable.
- **Ancienne** : `Math.round(ca / total × 100)` sur un total qui compte les négatifs.
- **Juste** : ne répartir que les chiffres d'affaires positifs.
- **Correction existante** : `repartition()` de `domain/statistiques.ts` du commit `3f534d0`.
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-17 ») — seuls les chiffres d'affaires non négatifs se répartissent.

### DEF-STA-18 — Les bons se rangent dans la période par leur date de SAISIE
- **Écran** : Statistiques — tuile « Bons de commande », colonnes par conducteur, période « Cette année »
  ou « Ce mois-ci ».
- **Reproduire** : `admin.alpha` → saisir aujourd'hui un bon reçu le mois dernier (date de réception du
  mois dernier) : il compte dans « Ce mois-ci », quand devis et factures se rangent par leur date.
- **Ancienne** : bons filtrés sur `cree_le` ; devis et factures sur `date`.
- **Juste** : à décider (date du bon ou de réception).
- **Correction existante** : aucune (la proposition retirée filtrait elle aussi sur `cree_le`).
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-18 ») — rangés par la date de commande du bon, à défaut sa réception, à défaut sa saisie (D-STA-B-01, point 18).

### DEF-STA-19 — Sous-traitant : « Bonjour 👋 Sous-traitant » et « Sélectionnez votre nom dans Réglages »
- **Écran** : Accueil du sous-traitant.
- **Reproduire** : `soustraitant.alpha` → l'accueil salue « Bonjour 👋 Sous-traitant » et affiche le
  bandeau « Sélectionnez votre nom dans Réglages pour ne voir que vos documents. », à chaque
  ouverture ; « Factures ALPHA prêtes » compte tous les bons que la base lui laisse lire.
- **Ancienne** : le sous-traitant « actuel » ne se choisit qu'à la main dans Réglages, et rien ne le
  retient : il vaut « » à chaque ouverture. `web/` n'a pas ce réglage ; il reproduit l'ouverture.
- **Juste** : le reconnaître par son compte (`mon_sous_traitant`, comme le planning) : son nom en
  salutation, pas de bandeau.
- **Correction existante** : aucune pour ce tableau (le planning de `web/` le reconnaît déjà par son
  compte : `planning.data.monSousTraitantId`, à passer à `tableauSousTraitant`).

## Écrans
- **État** : corrigé (commit e0002ce, `tests/parite/statistiques.essai.ts` « DEF-STA-19 ») — reconnu par son compte (`monSousTraitantId`) : son nom en salutation, plus de bandeau.

### DEF-ECR-01 — Rapports : un rapport sans statut porte une pastille vide
- **Écran** : Rapports / recherche de fuite › liste.
- **Reproduction** : compte `admin.alpha@erp.local` ; données : le rapport « PDF PARITÉ — rapport »
  (INT-2026-000001) du jeu `tests/visuel/pdf/jeu-pdf.sql`, créé sans statut (`interventions.statut` NULL,
  la colonne n'a pas de défaut) — cas d'un rapport repris ou écrit hors de l'écran ; ouvrir le menu
  « Rapports ».
- **Ancienne** : à droite de la carte, après « LOGEMENT OCCUPÉ », une pastille grise VIDE (`<span class="badge
  gray">` sans texte : `esc(i.statut)` d'un statut absent).
- **Juste** : une pastille qui dit quelque chose — le statut par défaut d'un rapport (« en cours »), ou pas
  de pastille du tout ; et, en base, un défaut sur la colonne pour qu'un rapport ne naisse pas sans statut.
- **Nouvelle aujourd'hui** : identique à l'ancienne (pastille grise vide, D-VIS2-02). Elle affichait
  « EN COURS » avant d'être alignée.
- **État (28/09, « corrige tout »)** : **corrigé** — la carte affiche le statut qu'un rapport reçoit à sa
  naissance, pastille jaune « en cours » (`interventions/domain/rapport.ts#statutDuRapport`, commit
  30724e8 ; test `interventions/components/rapports.essai.tsx`, « un rapport sans statut porte le statut
  d'un rapport neuf… », qui échoue sur l'ancien rendu). **Correction proposée en base** : défaut
  `'en cours'` sur `interventions.statut` (`supabase/propositions/20260928212000_un_rapport_nait_en_cours.sql`,
  test RLS `tests/rls/interventions.essai.ts` « [proposition] un rapport écrit hors de l'écran naît
  « en cours » », écrit, non lancé). Écart visuel attendu noté sur l'écran `rapports` (`tests/visuel/ecrans.ts`).
  D-COR2-01.

### DEF-ECR-02 — Pièces en commande : « 📦 Commandé » n'enregistre pas la date de commande
- **Écran** : Pièces en commande (bon « Sans BC » de Mme Durand, une pièce à commander).
- **Reproduction** : compte `conducteur.alpha@erp.local` ; données : le jeu d'essai de la base locale (le bon
  « Sans BC » porte la pièce « Mitigeur thermostatique 1/2 ») ; menu « Pièces en commande », déplier la carte
  du bon (« ▸ »), cliquer « 📦 Commandé ».
- **Ancienne** : la bulle annonce « 📦 Pièce commandée — classée dans le dossier … », mais la pièce ne change
  pas de section : elle reste sous « À commander », sans date de commande — la date n'est pas enregistrée
  (relevé en D-E2E-04). Recharger la page le confirme.
- **Juste** : la date de commande est enregistrée (`planning_taches.piece_date_commande` des tâches du bon qui
  portent la pièce), la pièce passe dans
  « 🚚 Commandées — par fournisseur », dans le dossier de son fournisseur, avec « commandée le JJ/MM/AAAA »
  et le bouton « ✓ Pièce arrivée — Renvoyer au planning ».
- **Nouvelle aujourd'hui** : fait ce qui est juste — la date est enregistrée, la pièce est reclassée dans le
  dossier « — Fournisseur non renseigné — », sa carte reste ouverte et dit « commandée le … » (parcours
  `tests/e2e/commandes.e2e.ts`, « pièces : le conducteur commande… »). La nouvelle diffère donc de l'ancienne
  sur ce point ; à confirmer par le client.
- **État (28/09, « corrige tout »)** : **corrigé** (vérifié, rien à changer) — `ZonePieceCarte` écrit
  `piece_date_commande = todayISO()` (date de Paris) par `commandes/api/pieces.ts#modifierCommandePiece`, sur
  toutes les tâches du bon qui portent la pièce ; zéro ligne écrite = refus qui remonte. Preuves : test
  `commandes/api/pieces.essai.ts` (nouveau : filtres de l'écriture, refus), `commandes/components/pieces.essai.tsx`
  (« le conducteur marque commandé… »), relu en base `tests/rls/commandes.essai.ts` (« pièces (BC-19, BC-21) »),
  parcours `tests/e2e/commandes.e2e.ts`. D-COR2-02.

### DEF-ECR-03 — Tableau de bord et Statistiques : un brouillon compte dans le chiffre d'affaires
Même défaut que **DEF-STA-01** (reproduction et correction y sont décrites). **Corrigé** (commit e0002ce,
D-STA-B-01, `tests/parite/statistiques.essai.ts` « DEF-STA-01 / DEF-ECR-03 ») : un brouillon n'augmente plus « Total période » ni la
colonne du mois de Statistiques ; l'ancienne, elle, le compte toujours.

### DEF-ECR-04 — Tableau de bord : la création d'un brouillon s'écrit « Mme Durand · null »
Même défaut que **DEF-STA-06** (reproduction et correction y sont décrites). Depuis D-STA-A-01, la
nouvelle écrivait elle aussi « Mme Durand · null ». **Corrigé en production (0f6f60d)** pour la
facture — elle s'écrit « Mme Durand · brouillon » — et repris dans `web/`. **Corrigé pour le reste**
(commit e0002ce, D-STA-B-01, `tests/parite/statistiques.essai.ts` « DEF-STA-06 / DEF-ECR-04 ») : le paiement qui cite un brouillon et le devis
sans numéro s'écrivent « brouillon » ; l'ancienne garde « · null ».

## Base de données et sécurité (production)

Défauts de la base de production, trouvés en la reconstruisant en local
(`docs/RAPPORT-MATIN.md`, « À lire en premier : défauts de sécurité de la PRODUCTION »). Chacun est
corrigé par une migration **proposée** de `supabase/propositions/` — **aucune n'est appliquée en
production** ; elles ne le seront que par un humain, après essai à blanc
(`docs/migrations-proposees.md`, « Comment les appliquer »). Les deux applications partageant la même
base, appliquer une proposition corrige le défaut **dans les deux** : ce sont des décisions à
prendre pour la production, pas des écarts entre l'ancienne et la nouvelle. Les 34 propositions
actives sont toutes rattachées ci-dessous (la n° 22, statistiques, est retirée : D-STA-A-01).

**Comment constater en local.** La base locale de `web/` reçoit toutes les propositions
(`npm run base:locale`) : les tests RLS marqués `[proposition]` y **passent**, et prouvent la
correction. Le défaut lui-même se voit en faisant tourner les mêmes tests contre une base construite
**sans** les propositions, à l'image de la production :
`npx supabase stop --no-backup && SANS_PROPOSITIONS=1 npm run base:locale && npm run test:rls`.
**Fait le 28/09 pour les trente entrées** (ligne « Preuve » de chacune ; détail et chiffres dans
`docs/tests-rls.md`, « Écart avec la production ») : sans les propositions, 127 cas échouent et
30 ne démarrent pas (espace client, statistiques) ; avec, les 287 passent. Vingt-neuf défauts sont
prouvés ; un seul ne l'est qu'en partie (DEF-BDD-15 : le droit EXECUTE des fonctions de déclencheur
n'existe qu'en production et ne se reproduit pas en local). Trois tests qui passaient des deux côtés
alors qu'ils devaient prouver un défaut ont été renforcés (DEF-BDD-09, 25, 30) ; deux ont été
ajoutés (DEF-BDD-15).

### DEF-BDD-01 — `prochain_numero()` sert une autre société
- **Risque** : `peut_ecrire()` rend NULL pour un non-membre ; `if not peut_ecrire(...)` laisse alors
  passer : un compte d'une AUTRE société (ou un client) consomme et lit la série de devis.
- **Constater** : `tests/rls/numerotation.essai.ts`, « [proposition] prochain_numero ne sert que les
  membres autorisés » (échoue contre la fonction actuelle — vérifié).
- **Proposition** : n° 2, `20260925015000_peut_ecrire_ne_rend_jamais_null.sql`.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`numerotation.essai.ts`, les trois cas de « prochain_numero ne sert que les membres autorisés »), passe avec.

### DEF-BDD-02 — Un compte désactivé se réactive ; chacun prend l'adresse d'un autre
- **Risque** : `profiles_update_self` sans restriction de colonne : un compte coupé
  (`profiles.actif = false`) se réactive par un PATCH de son profil ; chacun s'attribue l'adresse
  d'un autre (annuaire, `inviter-salarie`). Politique SELECT en double (AUTH-74).
- **Constater** : `tests/rls/comptes.essai.ts`, « [proposition] un compte ne touche pas à son propre
  `actif`… », « [proposition] un compte ne s'attribue pas l'adresse d'un autre… » (échouent contre
  la base actuelle — vérifié).
- **Proposition** : n° 8, `20260926010000_profil_seul_le_nom_se_modifie.sql` — D-SOC-09.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`comptes.essai.ts`, « un compte ne touche pas à son propre `actif` » et « un compte ne s'attribue pas l'adresse d'un autre »), passe avec.

### DEF-BDD-03 — Données de santé et dossiers RH lisibles par tout membre
- **Risque** : `v_salaries_annuaire` montre à tout membre (technicien, sous-traitant, lecture) les
  dates du suivi médical et les notes (RGPD art. 9) ; le seau `terrain` laisse tout membre lire
  `<société>/salaries/…` (contrats, pièces d'identité, RIB, attestations), et empêche la secrétaire
  (`rh / modifier`) d'y déposer. Aucune contrainte `fin >= début` sur les absences.
- **Constater** : `tests/rls/rh.essai.ts`, « [proposition] l'annuaire tait aussi le suivi médical et
  les notes hors RH », « [proposition] le dossier RH du seau `terrain` suit `rh / modifier` »,
  « [proposition] une absence qui finit avant de commencer est refusée par la base ».
- **Proposition** : n° 20, `20260926060000_les_donnees_rh_restent_aux_rh.sql` — D-RH-01. **Effet sur
  l'ancien écran** : le conducteur n'y voit plus le badge de visite (D-RH-01). Non tranché : M8 (le
  technicien et son propre dossier, `migrations-proposees.md`, relecture 4).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`rh.essai.ts`, « l'annuaire tait aussi le suivi médical et les notes hors RH », « une absence qui finit avant de commencer est refusée », « la secrétaire dépose et retire une pièce du dossier », « le technicien et le sous-traitant ne lisent ni ne déposent sous `salaries/` »), passe avec.

### DEF-BDD-04 — Seau `terrain` : le terrain lit et dépose hors de ses affaires
- **Risque** : la lecture du seau ne se juge que par société : un technicien ou un sous-traitant qui
  connaît un chemin lit le document d'un chantier où il n'est pas affecté, le dossier RH d'un
  collègue, la photo d'un confrère ; l'écriture est aussi large.
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] seau terrain : le terrain ne lit
  que ses fichiers » ; `tests/rls/politiques.essai.ts`, « relecture 4 — I3 ».
- **Proposition** : n° 23, `20260926100000_le_terrain_ne_lit_que_ses_fichiers.sql` (dépend des n° 16
  et 18) — D-TRV-02, D-SQL-06.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transversal.essai.ts`, les quatre cas de « seau terrain : le terrain ne lit que ses fichiers » ; `politiques.essai.ts`, les deux cas de « relecture 4 — I3 »), passe avec.

### DEF-BDD-05 — Une facture qui fournit son numéro est acceptée hors série et sans ligne
- **Risque** : un INSERT (ou l'UPDATE d'un brouillon) qui fournit `numero` crée une facture émise hors
  série légale et sans ligne (constaté avec le compte secrétaire).
- **Constater** : `tests/rls/numerotation.essai.ts`, « [proposition] le numéro d'une facture ne se
  fournit pas », « [proposition] la reprise de l'historique comptable est réservée à
  l'administrateur… » ; `tests/rls/import-export.essai.ts` (ligne 102) ;
  `tests/rls/politiques.essai.ts`, « relecture 4 — I1 ».
- **Proposition** : n° 5, `20260925040000_le_numero_ne_se_fournit_pas.sql` — D-SQL-02, D-FAC-12.
  **Effet sur l'ancien écran** : « Reprendre un historique » échoue désormais pour la secrétaire,
  motif de la base affiché (D-SQL-02, décision métier à valider).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`numerotation.essai.ts`, les trois cas de « le numéro d'une facture ne se fournit pas » ; `import-export.essai.ts`, « la secrétaire… ne pose pas le marqueur « compta: » » ; `politiques.essai.ts`, les deux cas de « relecture 4 — I1 »), passe avec.

### DEF-BDD-06 — Les lignes d'un bon facturé restent modifiables
- **Risque** : `bon_commande_facture_fige` protège l'en-tête d'un bon facturé, pas ses lignes : un
  conducteur les modifie, supprime ou complète après émission de la facture.
- **Constater** : `tests/rls/commandes.essai.ts`, « les lignes d'un bon dont la facture est émise sont
  figées ; en brouillon, non (I3) » ; `tests/rls/politiques.essai.ts`, « relecture 4 — I8 ».
- **Proposition** : n° 6, `20260925050000_les_lignes_d_un_bon_facture_sont_figees.sql` — D-SQL-07.
  **À contrôler avant** : la requête des positions non contiguës (`migrations-proposees.md`, n° 6) —
  l'enregistrement de ces bons échouerait dans l'ancien écran.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`commandes.essai.ts`, « les lignes d'un bon dont la facture est émise sont figées » ; `politiques.essai.ts`, « relecture 4 — I8 » (la suppression d'une ligne passe sans la proposition)), passe avec.

### DEF-BDD-07 — Un bon peut naître directement « chiffré »
- **Risque** : `circuit_etat_reserve` ne veille qu'à l'UPDATE : un INSERT saute le circuit.
- **Constater** : `tests/rls/commandes.essai.ts`, « un bon créé « chiffré » naît quand même au début
  du circuit (I4) ».
- **Proposition** : n° 7, `20260925060000_un_bon_nait_au_debut_du_circuit.sql` — D-051 (ramené à
  `en_cours`, pas refusé : l'ancien écran envoie la clé).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`commandes.essai.ts`, « un bon créé « chiffré » naît quand même au début du circuit »), passe avec.

### DEF-BDD-08 — Deux onglets facturent deux fois le même bon
- **Risque** : `bc_generer_facture` ne verrouille pas le bon et ne refuse pas un bon déjà facturé.
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] un bon ne se
  facture qu'une fois (I9) » (le cas déterministe échoue contre la fonction actuelle — vérifié ; la
  course elle-même n'est pas reproduite de façon fiable, D-R4-06).
- **Proposition** : n° 35, `20260926133000_le_bon_ne_se_facture_qu_une_fois.sql` — D-R4-06. Relever
  `pg_get_functiondef` en production avant d'appliquer.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transactions-facturation.essai.ts`, « une facture porte déjà ce bon : la base refuse d'en créer une seconde » et « deux « Créer la facture » simultanés : une seule facture » (la course a donné deux factures cette fois-ci ; elle reste non déterministe, D-R4-06)), passe avec.

### DEF-BDD-09 — Le rôle lecture supprime dans les tables filles
- **Risque** : politiques DELETE sous `est_membre()` : le rôle **lecture** (et tout membre) supprime
  interlocuteurs, lignes de DPGF, traces d'avancement, to-do, documents et inspections de chantier,
  photos de bon, prêts et entretiens, documents de sous-traitant, `facture_cycle_vie`,
  `facture_entrante_lignes`, `fournisseur_controle_lignes` (AUTH-71).
- **Constater** : `tests/rls/filles.essai.ts`, « [proposition] le rôle lecture ne supprime pas un
  interlocuteur » ; `tests/rls/chantiers.essai.ts`, « [proposition] le rôle lecture ne supprime ni
  un point de to-do, ni un document » ; `tests/rls/transversal.essai.ts`, « [proposition]
  suppression des filles restantes » ; `tests/rls/auth-roles.essai.ts`, « [proposition] suppression
  = « module / supprimer » (AUTH-71) » (relevé automatique de `pg_policy`) ;
  `tests/rls/vehicules.essai.ts` et `rh.essai.ts` (cas « le rôle lecture ne supprime pas… »).
- **Propositions** : n° 1, 10, 17, 20, 21, 24, 30 — D-TRV-03, D-AUTH-06, D-VEH-01.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`filles.essai.ts`, « le rôle lecture ne supprime pas un interlocuteur » ; `chantiers.essai.ts`, « le rôle lecture ne supprime ni un point de to-do, ni un document » ; `transversal.essai.ts`, « suppression des filles restantes » ; `auth-roles.essai.ts`, « aucune politique de suppression n'est ouverte à « tout membre » » (23 politiques relevées sans la proposition) et « plus de suppression par peut_ecrire() » ; `vehicules.essai.ts`, « le rôle lecture ne supprime pas un entretien » et « …pas un prêt de matériel » ; `rh.essai.ts`, « le rôle lecture n'efface plus les documents d'un sous-traitant ». Le cas du prêt de matériel passait AUSSI sans la proposition : il n'y avait aucun prêt à effacer — renforcé le 28/09 (le prêt est posé avec les seules colonnes de production, puis relu)), passe avec.

### DEF-BDD-10 — La secrétaire ne peut pas ce que la matrice lui donne (devis compris)
- **Risque** : la secrétaire n'est pas dans `peut_ecrire()` : elle a `devis / creer` mais
  `prochain_numero` le lui refuse — **elle ne peut enregistrer aucun devis** (DEV-50) ; ni
  interlocuteur, ni équipe, sous-traitant, fiche conducteur, référentiel, document légal,
  contrôle fournisseur (AUTH-70).
- **Constater** : `tests/rls/filles.essai.ts`, « [proposition] la secrétaire obtient un numéro de
  devis », « [proposition] la secrétaire (clients/modifier) ajoute un interlocuteur » ;
  `tests/rls/auth-roles.essai.ts`, « [proposition] la secrétaire écrit ce que la matrice lui donne
  (AUTH-70) » ; `tests/rls/rh.essai.ts` (équipe, fiche conducteur).
- **Propositions** : n° 1, 3 (`20260925020000_la_secretaire_numerote_ses_devis.sql`), 30 — D-018,
  D-AUTH-05. Reproduire dans l'ancienne : `secretaire.alpha` → Devis → nouveau devis → enregistrer :
  refus à l'enregistrement (à vérifier à l'écran ; le refus de `prochain_numero` est prouvé par le test).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`filles.essai.ts`, « la secrétaire obtient un numéro de devis » et « la secrétaire (clients/modifier) ajoute un interlocuteur » ; `auth-roles.essai.ts`, les quatre cas de « la secrétaire écrit ce que la matrice lui donne » (42501 sans la proposition) ; `rh.essai.ts`, « l'administrateur crée une équipe… ; la secrétaire… »), passe avec.

### DEF-BDD-11 — Le terrain écrit ce que la matrice ne lui donne pas
- **Risque** : le technicien écrit dans le DPGF, ajoute un interlocuteur, une dépense qu'il ne peut
  pas relire, affecte un collègue à un chantier ; il efface une fiche conducteur, un fournisseur, un
  métier ; il note un entretien de véhicule (`véhicules : voir`).
- **Constater** : `tests/rls/filles.essai.ts`, « [proposition] le technicien n'écrit pas dans le
  DPGF », « [proposition] le technicien n'ajoute pas d'interlocuteur » ;
  `tests/rls/chantiers.essai.ts`, « [proposition] achats et affectations : « chantiers /
  modifier » » ; `tests/rls/auth-roles.essai.ts` (ligne 115) ; `tests/rls/vehicules.essai.ts`,
  « [proposition] le technicien (voir) ne note pas d'entretien ».
- **Propositions** : n° 1, 10, 21, 30 — D-AUTH-06. Reste ouvert : la CRÉATION par le terrain
  (DEF-REP-17).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`filles.essai.ts`, « le technicien n'écrit pas dans le DPGF », « le technicien n'ajoute pas d'interlocuteur » ; `chantiers.essai.ts`, « le technicien n'ajoute pas de dépense », « le technicien n'affecte personne » ; `auth-roles.essai.ts`, « ni le technicien ni le conducteur n'effacent une fiche conducteur ou un métier » ; `vehicules.essai.ts`, « le technicien (voir) ne note pas d'entretien »), passe avec.

### DEF-BDD-12 — L'administrateur se voit refuser le chantier qu'il vient de créer
- **Risque** : `chantiers_select` appelle `est_affecte_au_chantier(id)`, qui relit la ligne — invisible
  pendant un `insert … returning` : refus 42501 à la création.
- **Constater** : `tests/rls/auth-roles.essai.ts`, « [proposition] filles du chantier : l'affectation
  en toutes lettres (AUTH-72) » (« l'administrateur relit le chantier qu'il crée » ; échoue contre la
  base actuelle — vérifié).
- **Proposition** : n° 30, `20260926110000_la_matrice_ouvre_les_referentiels_a_qui_elle_les_donne.sql`
  — D-AUTH-07. L'ancien écran enregistre aussi par `upsert(row).select().single()`
  (`src/integrations/html-adapter.ts:1837-1841`) : il devrait subir le même refus — **à vérifier**
  sur la production, qui a divergé de la base locale.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`auth-roles.essai.ts`, « l'administrateur relit le chantier qu'il crée, dans la même requête (insert … select) »), passe avec. Le refus de l'ancien écran en production reste à constater là-bas (base divergente).

### DEF-BDD-13 — Le sous-traitant lit les tâches et les bons de ses confrères
- **Risque** : `planning_taches`, `v_bons_commande_terrain`, `v_bon_commande_lignes_terrain` et
  `sous_traitants` lisibles par tout membre : une entreprise extérieure voit le travail, les
  adresses et les téléphones confiés à ses concurrents (AUTH-72).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] tâches du sous-traitant » ;
  `tests/rls/politiques.essai.ts`, « relecture 4 — I4 et I5 ».
- **Proposition** : n° 25, `20260926102000_le_sous_traitant_ne_lit_que_ses_taches.sql` — D-TRV-04,
  D-SQL-06. Ce qu'elle laisse ouvert : DEF-REP-18.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transversal.essai.ts`, « le sous-traitant ne lit que SES tâches » ; `politiques.essai.ts`, « relecture 4 — I4 et I5 » ; `commandes.essai.ts`, « le sous-traitant ne lit pas un bon qui ne lui est pas confié »), passe avec.

### DEF-BDD-14 — Le journal du circuit accepte de fausses transitions
- **Risque** : `workflow_journal` accepte l'INSERT de tout membre (AUTH-73).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] journal du circuit » ;
  `tests/rls/circuit.essai.ts` (les RPC écrivent toujours).
- **Proposition** : n° 26, `20260926103000_le_journal_du_circuit_ne_s_ecrit_que_par_le_circuit.sql` —
  D-TRV-05.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transversal.essai.ts`, « aucun membre n'y écrit une transition à la main, pas même l'administrateur »), passe avec.

### DEF-BDD-15 — Fonctions de déclencheur exécutables par tous ; annuaire sans `security_barrier`
- **Risque** : EXECUTE rendu à PUBLIC sur les fonctions de déclencheur créées après le 24/09
  (AUTH-75) ; `v_salaries_annuaire` a perdu `security_barrier` (AUTH-76, constaté : `reloptions` vide).
- **Constater** : non observable par l'API — `tests/rls/transversal.essai.ts`, « [proposition]
  fonctions de déclencheur et annuaire » (relevé du catalogue du conteneur local, en lecture seule :
  requête de l'en-tête du fichier, 0 ligne attendue, et `reloptions` de `v_salaries_annuaire`).
- **Proposition** : n° 27, `20260926104000_fonctions_de_declencheur_sans_execute_public.sql` —
  D-TRV-06 (à rejouer après toute proposition qui crée un déclencheur ou refait la vue).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : **en partie prouvé.** Barrière de l'annuaire : échoue sans (`transversal.essai.ts`, « l'annuaire des salariés garde sa barrière de sécurité », test ajouté le 28/09 : `reloptions` vide), passe avec. EXECUTE des fonctions de déclencheur : **non prouvé** — le test ajouté (« aucune fonction de déclencheur du schéma public n'est exécutable par anon ou authenticated ») passe des deux côtés : les 21 fonctions de déclencheur de la base reconstruite viennent des migrations du dépôt, qui retirent déjà ce droit ; celles qu'AUTH-75 vise ont été créées en production par le tableau de bord et n'ont pas de fichier. Le défaut ne se reproduit donc pas en local ; le test garde les propositions elles-mêmes (qui créent des déclencheurs), et le constat en production se fait par la requête de l'en-tête de la proposition.

### DEF-BDD-16 — `v_facture_solde` fait d'un avoir une dette et ignore les acomptes
- **Risque** : la vue ignore le signe des avoirs (un crédit y est « Impayée » et s'additionne aux
  dettes), teste « Impayée » avant le reste (une facture à 0 € reste due à vie), ignore acomptes et
  retenue, fait redevenir dues les reprises « payées », compte le retard en UTC sur la seule
  échéance (FAC-93).
- **Constater** : `tests/rls/facturation.essai.ts`, « [proposition] v_facture_solde dit vrai » ;
  `tests/rls/politiques.essai.ts`, « relecture 4 — B3 », « relecture 4 — I2 ».
- **Proposition** : n° 12, `20260926040000_le_solde_d_une_facture_dit_vrai.sql` (s'arrête d'elle-même
  si la définition vivante diffère) — D-FAC-01, D-SQL-03, D-SQL-04. Côté écran de `web/` : DEF-COR-10.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`facturation.essai.ts`, les cinq cas de « v_facture_solde dit vrai » ; `politiques.essai.ts`, les deux cas de « relecture 4 — B3 » et « relecture 4 — I2 »), passe avec.

### DEF-BDD-17 — Les règlements sont imputés par l'écran, pas par la base
- **Risque** : statut payé/impayé recalé par l'écran après chaque règlement ; règlement groupé
  découpé à l'écran puis inséré facture par facture (un échec au milieu laisse un virement à
  moitié imputé) ; lettrage d'avoir contrôlé seulement à l'écran.
- **Constater** : `tests/rls/facturation.essai.ts`, « [proposition] le statut stocké suit les
  règlements (déclencheur) », « [proposition] enregistrer_reglement_groupe… », « [proposition]
  imputer_avoir… » ; `tests/rls/politiques.essai.ts`, « M6 ».
- **Proposition** : n° 13, `20260926041000_les_reglements_s_imputent_en_base.sql` — D-FAC-02. Côté
  écran de `web/` : DEF-COR-11.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`facturation.essai.ts`, « réglée → payée ; règlement retiré → impayée », les trois cas d'« enregistrer_reglement_groupe » qui écrivent, les deux cas d'« imputer_avoir » ; `politiques.essai.ts`, « M6 »), passe avec. Le cas « le rôle lecture n'écrit aucun règlement » passe des deux côtés : c'est une garde de non-régression, pas une preuve.

### DEF-BDD-18 — Supprimer un brouillon de situation rend l'avancement même si la suppression échoue
- **Risque** : l'écran rend l'avancement au DPGF PUIS supprime la facture ; un refus de la seconde
  étape laisse le DPGF rendu et la facture debout — l'avancement se refacture. La secrétaire (sans
  « chantiers / modifier ») ne peut pas supprimer son brouillon de situation.
- **Origine** : risque relevé sur l'écran de `web/` à la relecture 4 ; la base n'offre pas le
  geste d'un seul tenant, mais l'enchaînement de l'ancien écran est **à vérifier** (DEF-COR-12).
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] supprimer un
  brouillon de situation : tout ou rien (B2, I2) ».
- **Proposition** : n° 32, `20260926130000_supprimer_un_brouillon_de_facture_d_un_seul_geste.sql` —
  D-R4-03.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transactions-facturation.essai.ts`, les cinq cas de « supprimer un brouillon de situation : tout ou rien »), passe avec.

### DEF-BDD-19 — L'avoir s'établit en deux appels, sans borne
- **Risque** : créer puis émettre en deux appels laisse un avoir brouillon orphelin à chaque échec
  d'émission ; rien ne borne le cumul (deux onglets = deux avoirs totaux).
- **Origine** : risque relevé sur l'écran de `web/` à la relecture 4 ; la base n'offre pas le
  geste d'un seul tenant, mais l'enchaînement de l'ancien écran est **à vérifier** (DEF-COR-12).
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] établir un avoir
  d'un seul geste (I6) ».
- **Proposition** : n° 33, `20260926131000_l_avoir_s_etablit_d_un_seul_geste.sql` — D-R4-04.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transactions-facturation.essai.ts`, les deux cas d'« établir un avoir d'un seul geste »), passe avec.

### DEF-BDD-20 — « Retirer » une imputation d'avoir n'en supprime qu'une moitié
- **Risque** : facture redevenue due avec le crédit resté consommé, ou l'inverse.
- **Origine** : risque relevé sur l'écran de `web/` à la relecture 4 ; la base n'offre pas le
  geste d'un seul tenant, mais l'enchaînement de l'ancien écran est **à vérifier** (DEF-COR-12).
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] annuler une
  imputation : les deux moitiés ensemble (I8) ».
- **Proposition** : n° 34, `20260926132000_une_imputation_s_annule_entiere.sql` — D-R4-05.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transactions-facturation.essai.ts`, les deux cas d'« annuler une imputation : les deux moitiés ensemble »), passe avec.

### DEF-BDD-21 — Bons « BON-2027-… », notes de frais « NOT-… »
- **Risque** : le préfixe « BC » n'existe que par une ligne `compteurs` de 2026 : en 2027 les bons
  naîtraient « BON-2027-… » (BC-94) ; une note de frais sort « NOT-… » (FAC-98).
- **Constater** : `tests/rls/circuit.essai.ts`, « [proposition] préfixe des bons (BC-94) » ;
  `tests/rls/facturation.essai.ts`, « [proposition] préfixes de numérotation complets ». La base
  locale le montre déjà : un bon créé localement reçoit `BON-2026-…` (D-046).
- **Propositions** : n° 11 et 15 (`20260926030000`, `20260926043000`, appliquer la 15 APRÈS la 11) —
  D-FAC-07.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`circuit.essai.ts`, « un bon créé reçoit un numéro « BC- » » ; `facturation.essai.ts`, « une note de frais sort « NDF-… » »), passe avec.

### DEF-BDD-22 — Ce que l'écran chantier saisit n'a pas de colonne
- **Risque** : `chantiers.statut`, `notes`, cinq champs PPSPS, `chantier_comptes_rendus.vu`,
  `chantier_dpgf_lignes.metier` n'existent pas : saisis puis perdus en silence.
- **Constater** : `tests/rls/chantiers.essai.ts`, « [proposition] les champs saisis ont leur colonne ».
- **Proposition** : n° 9, `20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql` — D-CHA-09
  (côté ancien : une entrée `SNAKE_OVERRIDES` pour `ppspsCoordinateurSPS`).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`chantiers.essai.ts`, les quatre cas de « les champs saisis ont leur colonne » (colonnes absentes : `chantiers.statut`, `chantier_dpgf_lignes.metier`…) ; aussi `chantiers-api.essai.ts` (trois cas), `transversal.essai.ts` « D-CHA-04 » et `chantiers.essai.ts` « planifier une quantité », qui écrivent ces colonnes), passe avec.

### DEF-BDD-23 — Le sous-traitant ne peut pointer aucune de ses tâches
- **Risque** : `est_de_l_equipe` ignore le sous-traitant : « Valider les travaux » lui est proposé,
  la base refuse ; pas de montant « Votre montant » sans ouvrir la vue ; pas de travail
  supplémentaire sur ses bons. Le terrain peut aussi poser un prix sur un signalement (B2).
- **Constater** : `tests/rls/planning.essai.ts`, « [proposition] sous-traitant, photos et téléphone
  du terrain » (« le sous-traitant pointe les tâches de SON entreprise… », « …lit SON montant… »,
  « …signale un travail supplémentaire sur son bon… ») ; `tests/rls/politiques.essai.ts`,
  « relecture 4 — B2 ».
- **Proposition** : n° 16, `20260926050000_le_sous_traitant_pointe_ses_taches.sql` — D-PLN-05, D-SQL-05.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`planning.essai.ts`, « le sous-traitant pointe les tâches de SON entreprise », « …lit SON montant », « …signale un travail supplémentaire sur son bon » ; `politiques.essai.ts`, les deux premiers cas de « relecture 4 — B2 »), passe avec.

### DEF-BDD-24 — Photos du terrain illisibles au terrain, effaçables par le rôle lecture
- **Risque** : `bon_commande_photos` vérifie la société par une sous-requête sur `bons_commande`,
  illisible au terrain ; suppression ouverte au rôle lecture ; seau fermé au sous-traitant.
- **Constater** : `tests/rls/planning.essai.ts`, « le technicien dépose et lit une photo du bon ; le
  rôle lecture ne peut pas l'effacer ».
- **Proposition** : n° 17, `20260926051000_les_photos_du_terrain.sql` — D-PLN-06. Côté écran : DEF-COR-27.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`planning.essai.ts`, « le technicien dépose et lit une photo du bon ; le rôle lecture ne peut pas l'effacer » (refus RLS au dépôt sans la proposition)), passe avec.

### DEF-BDD-25 — Rapports : le sous-traitant lit les rapports internes
- **Risque** : aucun filtre sous-traitant (PLN-52) ; lien au bon, émetteur sous-traitant, signature
  du technicien sans colonne ; numéro posé par l'écran.
- **Constater** : `tests/rls/interventions.essai.ts`, « [proposition] émetteur sous-traitant et
  visibilité (PLN-52) », « [proposition] un rapport par bon (PLN-20) », « [proposition] le technicien
  rédige… » ; `tests/rls/politiques.essai.ts`, « M3 ».
- **Proposition** : n° 18, `20260926052000_rapports_d_intervention_complets.sql` (dépend du n° 16) —
  D-PLN-07 (sans elle, `web/` lit sans ces colonnes et refuse le lien au bon en le disant).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`interventions.essai.ts`, « un rapport interne, écrit avec les seules colonnes de production, reste invisible au sous-traitant » — ajouté le 28/09 : les autres cas du fichier tombent sans la proposition sur la colonne `bon_commande_id` absente avant d'avoir rien dit de la visibilité ; ils prouvent le lien au bon manquant, pas la fuite — ; plus les cinq autres cas du fichier et `politiques.essai.ts` « M3 »), passe avec.

### DEF-BDD-26 — Le téléphone de l'occupant n'arrive jamais au terrain
- **Risque** : la vue terrain ne sert pas `telephone_locataire` (BC-93) : le lien `tel:` de la carte
  ne s'affiche jamais.
- **Constater** : `tests/rls/planning.essai.ts`, « le terrain lit le téléphone de l'occupant, que la
  vue ne sert pas ».
- **Proposition** : n° 19, `20260926053000_le_terrain_joint_le_locataire.sql` — D-PLN-10.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`planning.essai.ts`, « le terrain lit le téléphone de l'occupant, que la vue ne sert pas »), passe avec.

### DEF-BDD-27 — Prêts sans durée, deux prêts en cours, droits des filles du parc
- **Risque** : aucune colonne de durée prévue ; deux prêts en cours possibles pour un même objet ;
  prêts, entretiens et documents d'un véhicule sous `peut_ecrire` (la secrétaire ne prête pas un
  véhicule, le technicien note un entretien, le rôle lecture supprime) ; aucune politique Storage
  pour `<société>/vehicules/…`.
- **Constater** : `tests/rls/vehicules.essai.ts` (neuf cas `[proposition]`, dont « la secrétaire
  prête un véhicule, avec sa durée prévue », « un second prêt en cours du même véhicule est
  refusé ») et `tests/rls/vehicules-api.essai.ts` — échouent contre la base actuelle (vérifié).
- **Proposition** : n° 21, `20260926070000_vehicules_et_materiel_gardent_leurs_prets.sql` —
  D-VEH-01 à 03. Côté écran : DEF-COR-29.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`vehicules.essai.ts`, les neuf cas `[proposition]` ; `vehicules-api.essai.ts`, quatre cas sur cinq), passe avec. « La vente émet une facture numérotée… » passe des deux côtés (non-régression).

### DEF-BDD-28 — Pas d'espace client en base
- **Risque** : aucun rôle ni politique pour un client ; le portail de l'ancien écran est mort
  (ESP-30). Les propositions l'ouvrent en lecture seule ; sans les droits retirés sur les vues, tout
  compte aurait pu créer un chantier chez une autre société (relecture 4, B1).
- **Constater** : `tests/rls/espace-client.essai.ts`, `tests/rls/espace-client-bons.essai.ts`,
  `tests/rls/transversal.essai.ts` (« [proposition] accès clients gérés par l'administrateur »),
  `tests/rls/politiques.essai.ts` (« relecture 4 — B1 »).
- **Propositions** : n° 4, 14, 29 — D-008, D-029, D-FAC-10, D-TRV-08, D-SQL-01. Non tranchés : M4, M7
  (`migrations-proposees.md`, relecture 4).
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans, passe avec — `transversal.essai.ts`, les trois cas d'« accès clients gérés par l'administrateur » ; `politiques.essai.ts`, « relecture 4 — B1 » ; `numerotation.essai.ts`, « un compte client (non membre) n'obtient aucun numéro ». `espace-client.essai.ts` (11 cas) et `espace-client-bons.essai.ts` (8 cas) échouent sans la proposition **au démarrage du fichier** : le compte client ne peut pas exister sans `acces_clients` (le jeu d'essai le signale : « acces_clients absente »), aucun cas ne s'exécute ; avec, les 19 passent.

### DEF-BDD-29 — Rien ne dit qu'une société est en Alsace-Moselle
- **Risque** : Vendredi saint et 26 décembre absents du planning (PLN-53).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] Alsace-Moselle ».
- **Proposition** : n° 28, `20260926105000_jours_feries_d_alsace_moselle.sql` — D-TRV-07.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`transversal.essai.ts`, « la colonne existe, faux par défaut ; seul l'administrateur la change »), passe avec.

### DEF-BDD-30 — « Fait » de la cloche réservé à qui modifie les réglages
- **Risque** : l'ancien range `notifsTraitees` dans `societe_settings.infos_entreprise`, que seul
  « réglages / modifier » écrit : un conducteur ou un technicien qui coche « fait » échoue, et chaque
  coche réécrit tout le JSON des réglages.
- **Constater** : `tests/rls/notifications.essai.ts`, « [proposition] notifications traitées par
  société ».
- **Proposition** : n° 31, `20260926120000_notifications_traitees_par_societe.sql` (reprise des clés
  existantes par un INSERT) — D-CLI-05. Côté écran : DEF-COR-42.
- **Preuve (28/09, `SANS_PROPOSITIONS=1` puis base complète)** : prouvé : échoue sans (`notifications.essai.ts`, les cinq cas de « notifications traitées par société »), passe avec. « L'auteur est posé par la base » passait AUSSI sans la table (il comparait `undefined` à l'identifiant du technicien) — renforcé le 28/09 : il exige l'auteur réel.

## Corrections déjà actives dans web/

Ici, la nouvelle application **diffère aujourd'hui** de l'ancienne : un défaut de l'ancienne a été
corrigé, écarté ou contourné par une décision écrite. Pour chaque entrée : l'écran, la reproduction
dans l'ancienne, ce que fait chacune, la décision, et ce qu'il faudrait **défaire** pour revenir à
l'identique si le client répond « on garde l'ancien ». Quand la correction de `web/` s'appuie sur une
proposition de base (DEF-BDD), revenir à l'identique côté écran ne dépend pas d'elle, mais appliquer
la proposition change aussi l'ancien écran.

Rappel : un geste de l'ancienne qui écrit dans un champ **sans colonne** semble réussir, puis la
valeur disparaît au rechargement (le pont filtre les champs inconnus : `colonnesDe`, CLAUDE.md
« Pièges rencontrés ») — d'où le geste de reproduction récurrent « recharger la page (F5) ».

**Vérification du 28/09** (décision du client : « corrige tout », toutes ces corrections sont
gardées). Chaque entrée a été relue sur le code du 28/09 et porte une ligne « État » : où vit la
correction et le test qui la tient. Trois corrections avaient été défaites quand les écrans ont
été refaits à l'identique le 26/09 et sont remises, chacune avec un test qui échoue sans elle
(DEF-COR-06, 15, 54) ; une quatrième ne tenait pas ce que l'entrée annonçait (DEF-COR-56, ordre à
date égale). Des tests ont été ajoutés là où une correction n'en avait pas (DEF-COR-07, 12, 15, 16,
21, 28, 48). Les « à vérifier » sont tranchés par le code de l'ancien ; trois défauts n'existent pas
dans l'ancien (DEF-COR-13, 17, 41 — D-BDD2-05).

### DEF-COR-01 — Les achats d'un chantier ne sont jamais relus (erreur 42703)
- **Écran** : Chantiers › fiche › « Achats » (et totaux « facturé − achats »).
- **Reproduire (ancienne)** : `admin.alpha` → Chantiers → une fiche (« Salle de bains Durand ») →
  ajouter un achat → recharger. Relever la requête `chantier_achats` dans l'onglet réseau.
- **Ancienne** : le pont lit les achats en triant sur `position`
  (`src/integrations/html-adapter.ts:1644`, fonction `attacher`, appelée pour les achats à la ligne
  800, déclarés à la ligne 288) ; `chantier_achats` n'a pas de colonne `position` — ni en local ni en
  production (`src/api/database.types.ts`, `src/api/columns.ts:14`) : la requête tombe (42703), les
  achats restent vides et le bandeau « Certaines données n'ont pas pu être chargées
  (chantier_achats) » s'affiche. Relevé par la sonde `tests/visuel/sonde.visuel.ts` (D-ECR-CHA-11).
  Le DPGF, les to-do, documents et inspections ne sont, eux, **pas lus du tout** par le pont (seule
  la fille `achats` est déclarée, ligne 288) : voir DEF-COR-02 et DEF-COR-04. En production, les
  achats ne s'afficheraient donc jamais — **à vérifier** sur la production (constat fait sur le code
  et la base locale). **À vérifier** aussi : `tests/visuel/outils.ts` (commentaire de
  `NEUTRALISATIONS`) attribue le même bandeau à une table absente de la base locale, ce que contredit
  D-ECR-CHA-11 ; et si l'ajout d'un achat s'écrit malgré l'échec de relecture.
- **Nouvelle** : lit `chantier_achats` (triés par `cree_le`) et les affiche.
- **Décision** : D-ECR-CHA-11 (écart chiffré dans les seuils de la comparaison visuelle).
- **Revenir à l'identique** : ne plus lire les achats dans `modules/chantiers/api/achats.ts`
  (liste vide) et faire afficher le bandeau d'échec de lecture pour `chantier_achats`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `modules/chantiers/api/achats.ts` lit `chantier_achats` (triés par `date_achat`, pas `cree_le`) ; tests `chantiers/components/fiche.essai.tsx` « l'admin voit DPGF chiffré et achats », `tests/rls/chantiers-api.essai.ts` (lecture des achats). **Tranché** : l'ancien trie les filles sur `position` (`src/integrations/html-adapter.ts:1644`) et `chantier_achats` n'a pas cette colonne en production (`src/api/columns.ts:14`, généré depuis elle) : la lecture tombe toujours (42703), `noterEchecDeLecture` affiche le bandeau (l. 1653). L'ajout s'écrit bien (`remplacerEnfants`, l. 1868) — mais sur la liste `achats: []` posée faute de lecture (l. 776), si bien qu'enregistrer le chantier REMPLACE les achats existants par ceux de la session.

### DEF-COR-02 — DPGF, avancements et to-do disparaissent au rechargement
- **Écran** : Chantiers › fiche › DPGF chiffré, To-do.
- **Reproduire (ancienne)** : `conducteur.alpha` → une fiche chantier → « + Ligne » dans le DPGF,
  saisir quantité et prix, enregistrer ; ajouter un point de to-do ; recharger.
- **Ancienne** : `dpgfLignes` et `todoList` n'ont pas de colonne dans `chantiers` et le pont ne
  déclare que la fille `achats` : DPGF, avancements, parts planifiées et to-do disparaissent au
  rechargement (CHA-50 ; `src/api/columns.ts:23`, colonnes de `chantiers`).
- **Nouvelle** : DPGF dans `chantier_dpgf_lignes`, to-do dans `chantier_todos`, parts planifiées dans
  `planning_taches` (`tests/rls/chantiers-api.essai.ts`).
- **Décision** : D-CHA-04, D-ECR-CHA-11 ; INVENTAIRE CHA-50.
- **Revenir à l'identique** : ne pas écrire ni lire ces tables (`modules/chantiers/api/dpgf.ts`,
  `todos.ts`, `planification.ts`), garder les saisies en mémoire jusqu'au rechargement — c'est-à-dire
  perdre les données. Déconseillé ; à trancher explicitement.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `chantiers/api/dpgf.ts`, `todos.ts`, `planification.ts` ; tests `tests/rls/chantiers-api.essai.ts` « import de DPGF, planification d'une part… », `tests/rls/chantiers.essai.ts` (to-do).

### DEF-COR-03 — Bon né du DPGF : lien perdu, conducteur vide, tâche en double
- **Écran** : Chantiers › DPGF › « 📅 Planifier une quantité » ; Planning.
- **Reproduire (ancienne)** : `conducteur.alpha` → fiche chantier → planifier une quantité d'une
  ligne → ouvrir le bon créé (Bons de commande) : pas de conducteur ; recharger : la part planifiée
  n'est plus rattachée à la ligne ; poser ce bon au planning : une seconde tâche naît.
- **Ancienne** : pose `chantierId`, `dpgfLigneId`, `qtePlanifiee` sur le bon, sans colonne, et
  `conducteur: ''` sans `conducteurId` (CHA-51) ; au planning, cherche une tâche du même jour et du
  même métier et crée une seconde tâche (D-TRV-01).
- **Nouvelle** : bon avec `conducteur_id` du chantier, puis tâche sans date qui porte `chantier_id`,
  `dpgf_ligne_id`, `quantite_planifiee` ; le planning date cette tâche au lieu d'en créer une
  (`tests/rls/transversal.essai.ts`, `tests/rls/chantiers-api.essai.ts`).
- **Décision** : D-CHA-04, D-TRV-01.
- **Revenir à l'identique** : dans `modules/chantiers/api/planification.ts`, ne plus créer la tâche
  liée ni poser `conducteur_id` ; dans `planning/domain/planification.ts#planPoser`, ne plus adopter
  la tâche sans date.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `chantiers/api/planification.ts` (conducteur du chantier, tâche liée), `planning/domain/planification.ts#planPoser` ; tests `tests/rls/transversal.essai.ts` « D-CHA-04 », `tests/rls/chantiers.essai.ts` « planifier une quantité », `planning/domain/planning.essai.ts` (D-CHA-04).

### DEF-COR-04 — Fichiers du chantier en data-URL dans le JSON
- **Écran** : Chantiers › fiche › Documents.
- **Reproduire (ancienne)** : `conducteur.alpha` → fiche chantier → déposer un PDF → recharger ;
  retirer un fichier (aucune confirmation).
- **Ancienne** : fichiers en data-URL dans le JSON du chantier (CHA-56) ; `chantiers` n'a pas de
  colonne JSON (`src/api/columns.ts:23`) : conservation **à vérifier**.
- **Nouvelle** : seau `terrain`, chemin `<société>/chantiers/<chantier>/…`, ligne dans
  `chantier_documents`, URL signée ; retrait confirmé.
- **Décision** : D-CHA-10, D-ECR-CHA-08.
- **Revenir à l'identique** : `modules/chantiers/api/documents.ts` et `stockage.ts` — écrire le
  fichier en data-URL sur le chantier ; retirer la confirmation de `BlocDocuments.tsx`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : seau `terrain` (`chantiers/api/stockage.ts`), confirmation du retrait (`FichiersChantier.tsx`, `Fichiers.tsx`) ; tests `tests/rls/chantiers-api.essai.ts` « dépôt puis retrait d'un compte-rendu », `chantiers/domain/regles.essai.ts` (chemin des fichiers). **Tranché** : l'ancien pose le fichier en data-URL dans l'objet chantier (`handleChantierFileAdd`, `app.js:13694-13710`) puis `stSet('chantier:…')` ; `chantiers` n'a aucune colonne pour ces listes (`src/api/columns.ts:23`) et `colonnesDe()` les écarte : le fichier disparaît au `recharger('chantier')` qui suit. Retrait sans confirmation (`removeChantierFile`, l. 13711).

### DEF-COR-05 — Saisie du DPGF : saisies perdues, « Planifier » muet, « 2,5 » lu 2
- **Écran** : Chantiers › DPGF chiffré, fenêtre « Planifier une quantité ».
- **Reproduire (ancienne)** : `conducteur.alpha` → fiche chantier → modifier une ligne sans
  enregistrer, puis « + Ligne » : la modification est perdue (CHA-53) ; après « + Ligne » ou « ✕ »,
  cliquer 📅 : rien ne s'ouvre (CHA-52) ; planifier « 2,5 » : 2 est retenu.
- **Ancienne** : « + Ligne / + Chapitre » redessinent sans relire le DOM (`app.js:14049-14098`) ;
  `openPlanifierQteModal('', i)` oublie le chantier (`app.js:14083`) ; `confirmPlanifierQte` lit la
  saisie par `parseFloat` (`app.js:14400`).
- **Nouvelle** : saisies tenues à part (`BlocDpgf#modifiees`), chaque ligne porte son identifiant,
  « 2,5 » lu 2,5 (`lib/money.ts#montant`) — `fiche.essai.tsx`.
- **Décision** : D-CHA-03, D-ECR-CHA-11 ; INVENTAIRE CHA-52, CHA-53.
- **Revenir à l'identique** : lire la saisie par `parseFloat` dans `DialoguePlanifier.tsx`, vider les
  saisies en cours à l'ajout d'une ligne ; le bouton muet ne se reproduit pas sans casser le geste.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `chantiers/components/fiche.essai.tsx` « une saisie en place survit à « + Ligne » », `chantiers/domain/regles.essai.ts` « une virgule française est lue » (« 2,5 »).

### DEF-COR-06 — Une ligne de DPGF facturée reste modifiable, ou remplacée
- **Écran** : Chantiers › DPGF (modification, « Reprendre un devis », import).
- **Reproduire (ancienne)** : `admin.alpha` → fiche chantier → facturer une situation à 50 % d'une
  ligne → changer sa quantité : le montant de la situation émise est réécrit après coup ;
  réenregistrer le devis d'origine : les lignes venues de ce devis sont retirées, facturées comprises ;
  importer un DPGF : tout est remplacé sans annonce.
- **Ancienne** : aucune garde (D-CHA-05, D-CHA-06, IMP-31).
- **Nouvelle** : ligne facturée ou planifiée figée (quantité et prix), reprise d'un devis depuis le
  DPGF et refusée si une ligne est figée, import qui garde les lignes figées et annonce ce qu'il
  remplace.
- **Décision** : D-CHA-05, D-CHA-06, D-CHA-07.
- **Revenir à l'identique** : retirer les gardes de `modules/chantiers/domain/dpgf.ts`,
  `devis-vers-dpgf.ts`, `saisie-dpgf.ts` et de `ImportDpgf.tsx` / `RepriseDevis.tsx` ; recopier les
  lignes du devis à chaque enregistrement du devis (geste qui n'existe plus dans `web/`).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **défaite au passage « identique » du 26/09, remise le 28/09** pour une part : l'annonce « L'import remplace les N ligne(s) actuelle(s) du DPGF ; M ligne(s) déjà facturée(s) ou planifiée(s) sont conservées » (D-CHA-07) avait disparu de la modale refaite à l'identique (dbdd146). Remise dans `ImportDpgf.tsx`, seulement quand le DPGF a des lignes (sur un DPGF vide la modale reste celle de l'ancien). Test qui échoue sans : `chantiers/components/import-dpgf.essai.tsx`. Les gardes (lignes figées, reprise refusée) étaient en place : `chantiers/domain/regles.essai.ts` « DPGF : lignes figées… », « reprise d'un devis… (D-CHA-06) ».

### DEF-COR-07 — Achats, to-do : un échec d'écriture ne se dit pas
- **Écran** : Chantiers › fiche (achats, to-do…).
- **Reproduire (ancienne)** : `lecture.alpha` (ou une coupure réseau) → tenter d'ajouter un point de
  to-do : aucun message.
- **Ancienne** : retours d'écriture ignorés, `catch` muets (`app.js` 13566, 13733, 13880 — CHA-54).
- **Nouvelle** : chaque écriture affiche son erreur et relit la table (`useFiche#useEcriture`).
- **Décision** : INVENTAIRE CHA-54 (règle du dépôt : aucun `catch` muet).
- **Revenir à l'identique** : non recommandé ; il faudrait taire les erreurs dans
  `modules/chantiers/hooks`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place (`onError` de chaque écriture, `BlocTodo.tsx`, `BlocAchats.tsx`, `DetailTodo.tsx`) ; test ajouté le 28/09, qui échoue sans : `chantiers/components/fiche.essai.tsx` « un ajout refusé par la base se dit, et la saisie n'est pas perdue ».

### DEF-COR-08 — Situation de travaux : montant flottant, avancement écrit avant la facture
- **Écran** : Chantiers › DPGF › « Facturer la sélection » (page Situation de travaux).
- **Reproduire (ancienne)** : `admin.alpha` → chantier « Salle de bains Durand » → facturer 33,333 %
  trois fois : 10 000,30 € pour 10 000 € ; saisir un pourcentage quelconque : accepté ; provoquer un
  échec de la facture (droit, réseau) : l'avancement reste consommé ; deux onglets : deux
  facturations du même avancement ; la facture a une échéance vide et une note « Situation de travaux
  — <nom> » perdue.
- **Ancienne** : `montant × Δ% / 100` en flottant brut (4074.0710999999997), avancement du chantier
  écrit AVANT la facture, sans contrôle, `chantier_avancement_factures` jamais écrite (FAC-97,
  FAC-62, `app.js:13315`).
- **Nouvelle** : montant de chaque ligne au centime, avancement à 2 décimales, facture puis trace puis
  cumul écrit sous condition de l'avancement lu, tout défait si une ligne a bougé, avancement rendu
  à la suppression du brouillon ; échéance calculée depuis le délai du client
  (`facturation/api/operations.ts#facturerSituation`, `tests/parite/facturation.essai.ts`).
- **Décision** : D-027, D-FAC-13 ; D-R4-03 pour la suppression (DEF-BDD-18).
- **Revenir à l'identique** : écrire l'avancement avant la facture, en flottant, sans condition, et
  laisser l'échéance vide — soit rouvrir la double facturation. À trancher explicitement.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `facturation/api/operations.ts#facturerSituation` (facture d'abord, avancement écrit sous condition de l'avancement lu, échéance calculée) ; tests `tests/parite/facturation.essai.ts` « au centime là où l'ancien rendait 4074.0710999999997 (D-027) », `facturation/hooks/suppression-situation.essai.tsx`, `tests/rls/transactions-facturation.essai.ts`.

### DEF-COR-09 — Montants en flottant : 1,005 € s'affiche 1,00 €
- **Écran** : tous (lignes, totaux, bons, règlements, facture électronique, PDF).
- **Reproduire (ancienne)** : `admin.alpha` → Devis → une ligne 1 × 1,005 € : total « 1,00 € » ;
  facture électronique d'une ligne 2,90 € à 5 % : TVA 0,14 €.
- **Ancienne** : calcul flottant, jamais arrondi avant l'affichage ; deux arrondis au centime
  concurrents (`arrondiCentime` 1,005 → 1,01, `centimes` 1,005 → 1 — FAC-95) ; montant d'un bon
  arrondi en silence par `numeric(14,2)` (BC-98).
- **Nouvelle** : décimal exact (`big.js`, `lib/money.ts`), arrondi au centime « demi s'éloignant de
  zéro » au bord : 1,01 € ; TVA 0,15 € ; au plus 1 centime d'écart, sur un demi-centime exact
  (`tests/parite/facturation.essai.ts`, `efacture.essai.ts`, `commandes.essai.ts`). Seule exception :
  les tableaux de bord et statistiques, qui calculent en flottant comme l'ancien (D-STA-A-01).
- **Décision** : D-006, D-044, D-EFA-02, D-CLI-12, D-PDF-03 (« Restent »).
- **Revenir à l'identique** : remplacer `lib/money.ts` par le calcul flottant de l'ancien et lever le
  garde-fou « pas de flottant pour l'argent » (`tests/garde-fous.essai.ts`). Changement transverse.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `src/lib/money.essai.ts` « arrondit le demi-centime en s'éloignant de zéro, comme Postgres », `tests/parite/totaux.essai.ts`, `efacture.essai.ts`, garde-fou `tests/garde-fous.essai.ts`.

### DEF-COR-10 — Reste d'une facture à acomptes, d'un avoir
- **Écran** : Factures (liste, fiche), Règlements (par facture, dossiers), espace client.
- **Reproduire (ancienne)** : `secretaire.alpha` → une facture de 1 000 € avec 400 € d'acompte et
  550 € réglés : « reste 450,00 € » ; un avoir apparaît comme dû.
- **Ancienne** : solde recalculé à l'écran (`calculerSoldeFacture`, remise appliquée au TTC,
  `toFixed(2)` — FAC-92), ou lu dans `v_facture_solde` actuelle (FAC-93) ; BT-113 de la facture
  électronique calculé sur ce solde (EFA-22).
- **Nouvelle** : « reste 50,00 € » — tout solde se lit dans `v_facture_solde` **corrigée**
  (`facturation/api/soldes.ts`), BT-113 aussi (`efacture/api/emission.ts`).
- **Décision** : D-FAC-01, D-ECR-FAC-02 ; dépend de la proposition n° 12 (DEF-BDD-16), sans laquelle
  la production renvoie les colonnes d'avant.
- **Revenir à l'identique** : recalculer le solde à l'écran comme `calculerSoldeFacture`
  (`src/api/operations/workflows.ts`), ou ne pas appliquer la proposition n° 12.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : tout solde lu dans `v_facture_solde` (`facturation/api/soldes.ts`, `efacture/api/emission.ts`) ; tests `tests/rls/facturation.essai.ts` « v_facture_solde dit vrai » (prouvé contre la base sans proposition, DEF-BDD-16).

### DEF-COR-11 — Statut payé/impayé et règlement groupé tenus par l'écran
- **Écran** : Règlements (unitaire, groupé, imputation d'avoir).
- **Reproduire (ancienne)** : `secretaire.alpha` → un virement réparti sur trois factures, avec un
  refus au milieu (droit, réseau) : une partie seulement est imputée ; le statut est réécrit par
  l'écran.
- **Ancienne** : découpage à l'écran puis un INSERT par facture ; statut recalé par l'écran
  (`ajouterReglementEtMajStatut`) ; lettrage contrôlé à l'écran seulement.
- **Nouvelle** : l'écran montre la répartition, la base impute (`enregistrer_reglement_groupe`,
  `imputer_avoir`, déclencheur de statut — `facturation/api/reglements.ts`).
- **Décision** : D-FAC-02 ; dépend de la proposition n° 13 (DEF-BDD-17).
- **Revenir à l'identique** : réinsérer facture par facture et réécrire le statut depuis l'écran dans
  `facturation/api/reglements.ts`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `facturation/api/reglements.ts` (`enregistrer_reglement_groupe`, `imputer_avoir`), aucun statut écrit par l'écran ; tests `tests/rls/facturation.essai.ts`, `facturation/components/reglements.essai.tsx` « règlement groupé : la répartition se voit avant de valider, la base impute ».

### DEF-COR-12 — Avoir, imputation, suppression d'un brouillon de situation : plusieurs requêtes
- **Écran** : Factures (« Créer un avoir », « Supprimer »), Règlements (« Retirer »).
- **Reproduire (ancienne)** : `admin.alpha` → créer un avoir total sur une facture depuis deux
  onglets ; « Retirer » une imputation d'avoir puis relire les deux pièces ; supprimer un brouillon
  de situation que la base refuse de supprimer, puis relire le DPGF.
- **Ancienne** : **à vérifier**. Les décisions décrivent le défaut sur l'écran de `web/` avant sa
  relecture 4 (deux appels créer puis émettre, suppression d'une seule moitié, avancement rendu
  avant la suppression) ; la base de production n'offre aucune fonction qui fasse ces gestes d'un
  seul tenant (DEF-BDD-18 à 20), mais aucune décision ne dit que l'ancien écran les enchaîne de la
  même façon.
- **Nouvelle** : un appel à la base chacun (`etablir_avoir`, `annuler_imputation`,
  `supprimer_brouillon_facture` — `facturation/api/factures.ts`, `reglements.ts`) ; « Annuler
  l'imputation » remplace « Retirer » ; un second avoir total est refusé.
- **Décision** : D-R4-03, D-R4-04, D-R4-05 ; propositions n° 32 à 34 (DEF-BDD-18 à 20).
- **Revenir à l'identique** : rétablir les gestes de l'ancien dans ces deux fichiers (à relever dans
  `app.js` d'abord) et le libellé « Retirer ».
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : un appel chacun (`etablir_avoir`, `annuler_imputation`, `supprimer_brouillon_facture`). Le libellé est revenu à celui de l'ancien au passage du 26/09 (« Supprimer » / « ✕ », avec sa confirmation), le geste reste d'un seul appel. Tests : `facturation/hooks/suppression-situation.essai.tsx` (suppression refusée sans toucher au DPGF ; et, ajouté le 28/09, « une moitié d'imputation part par un seul appel… », qui échoue sans), `tests/rls/transactions-facturation.essai.ts`. **Tranché** sur l'ancien : l'avoir passe par `createAvoir` → `createFacture` (`src/api/queries/factures.ts:259`, puis l. 150-163 : en-tête, lignes, émission — trois requêtes) sans aucune borne sur le cumul ; retirer une moitié d'imputation est un `deleteItem('reglement')` d'une seule ligne (`app.js:3722-3758`), la jumelle reste ; supprimer un brouillon de situation est un simple `stDelete` de la facture, sans rendre l'avancement (que l'ancien ne conserve de toute façon pas, DEF-COR-02).

### DEF-COR-13 — « Émettre » enregistre d'abord la saisie en cours
- **Écran** : Factures › fiche d'un brouillon (« Émettre »).
- **Reproduire (ancienne)** : `secretaire.alpha` → modifier un brouillon sans enregistrer → « 🧾 Émettre »
  → relire la facture émise.
- **Ancienne** : **à vérifier** — D-028 (relecture 2, I-4) dit qu'une modification non enregistrée
  pouvait être perdue sous un numéro définitif, sans préciser si c'était le cas de l'ancien écran.
  Le cadenas posé à l'impression et à l'e-mail d'un brouillon existe déjà dans l'ancien (FAC-12,
  `app.js:4325, 11871, 11898`) : ce n'est pas un écart.
- **Nouvelle** : « Émettre » enregistre puis émet ce qui est à l'écran ; `emettreFacture` n'agit que
  sur un brouillon et `modifierBrouillon` refuse un brouillon verrouillé entre-temps (D-R4-07).
- **Décision** : D-028, D-FAC-05, D-R4-07.
- **Revenir à l'identique** : selon le constat dans l'ancien ; les gardes de D-R4-07 n'ont pas
  d'effet visible tant qu'un seul onglet travaille.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **Tranché : le défaut n'existe pas dans l'ancien, aucun écart.** « 🧾 Émettre » y est sur la carte de la liste (`boutonsFactureHTML`, `app.js:6092`) et la liste disparaît dès que le formulaire est ouvert (`app.js:5341-5342`) : on ne peut pas émettre avec une saisie en cours. `web/` fait de même depuis le 26/09 (l'émission est revenue sur la carte, `ActionsCarteFacture.tsx`, et `PageFacture.tsx` montre le formulaire À LA PLACE de la liste). Restent les gardes de D-R4-07, sans effet visible : `emettreFacture` n'agit que sur un brouillon (`facturation/api/factures.ts:173`), test `facturation/api/gardes-facture.essai.ts`.

### DEF-COR-14 — Acheteur rattaché par le nom ; le SIRET d'un autre client survit
- **Écran** : Devis, Factures (en-tête client).
- **Reproduire (ancienne)** : `admin.alpha` → une facture brouillon pour un client avec SIRET → changer
  de client pour un client sans SIRET → enregistrer : l'ancien SIRET reste sur la pièce. Deux clients
  homonymes : la pièce se rattache au premier trouvé.
- **Ancienne** : `rattacherClient` retrouve la fiche par le nom (`resolveClientByNom`, `ilike` —
  CLI-50) et `poser` garde une valeur quand la fiche est vide.
- **Nouvelle** : fiche choisie par `client_id` ; l'identité de la fiche est recopiée à chaque
  enregistrement d'un brouillon, une valeur vide efface l'ancienne (`identiteDuClient`).
- **Décision** : D-CLI-03 ; INVENTAIRE CLI-50.
- **Revenir à l'identique** : rattacher par le nom et ne recopier que les valeurs non vides dans
  `clients/api/clients.ts#identiteDuClient`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `clients/api/clients.ts#identiteDuClient`, recopiée à chaque enregistrement (`facturation/api/factures.ts:115, 149`) ; test `tests/rls/clients-api.essai.ts` (identité suivie au changement de client : le SIRET de l'ancien client s'efface).

### DEF-COR-15 — Listes de règlement : brouillons à 0, « ✎ Modifier » sans effet, « ✕ Effacer » en retard
- **Écran** : Factures › Règlements (« Par facture », dossiers, « Tous les règlements »).
- **Reproduire (ancienne)** : `secretaire.alpha` → Règlements → « Par facture » : les brouillons sont
  listés à 0 ; « Tous les règlements » → « ✎ Modifier » : rien ne s'ouvre ; poser un filtre : « ✕
  Effacer » n'apparaît qu'au rendu suivant.
- **Ancienne** : brouillons listés ; `formOpen.reglement` posé sans zone d'affichage dans cette vue ;
  seule la liste est redessinée au choix d'un filtre.
- **Nouvelle** : ni brouillons ; « ✎ Modifier » ouvre la saisie au-dessus de la liste ; « ✕ Effacer »
  paraît aussitôt.
- **Décision** : D-FAC-17, D-ECR-FAC-05, D-ECR-FAC-07.
- **Revenir à l'identique** : relister les brouillons, retirer l'ouverture de la saisie depuis « Tous
  les règlements », n'afficher « ✕ Effacer » qu'au rendu suivant.
- **Corrigé en production (97287c3, 28/09/2026)** — le dossier d'un client : une facture SANS
  NUMÉRO y recevait un encaissement, et le déclencheur la numérotait alors hors de tout ordre
  chronologique (art. 242 nonies A, annexe II du CGI). L'ancienne ne la rend plus « payable » (ni
  case, ni « + Règlement », ni clic), la titre « Brouillon — non émise » (au lieu d'un titre vide) et
  dit en une ligne pourquoi et où l'émettre. `web/`, qui listait lui aussi le brouillon dans le
  dossier avec sa case et son bouton, reprend le correctif à l'identique
  (`facturation/components/PageDossierClient.tsx`, test `reglements.essai.tsx` « un brouillon ne
  s'encaisse pas ») : plus d'écart ici, rien à trancher.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **défaite au passage « identique » du 26/09, remise le 28/09** pour une part : « Par facture » listait de nouveau les brouillons (la liste de l'écran, `domain/reglementsEcran.ts`, avait repris le filtre de l'ancien). Remis ; test qui échoue sans : `facturation/domain/reglementsEcran.essai.ts`. En place : « ✎ Modifier » de « Tous les règlements » ouvre la saisie (test ajouté dans `reglements.essai.tsx` « Tous les règlements… »), « ✕ Effacer » paraît aussitôt (état React). Écart visuel attendu sur « Par facture » : `tests/visuel/ecrans-facturation.ts`.

### DEF-COR-16 — Aucun geste pour passer un devis à « envoyé », « accepté », « refusé »
- **Écran** : Devis › formulaire d'un devis existant.
- **Reproduire (ancienne)** : `admin.alpha` → ouvrir un devis : aucun champ ni bouton de statut ; le
  statut reste « brouillon », alors que le tableau de bord compte les devis « envoyé ».
- **Ancienne** : statut reconduit, jamais modifiable (DEV-22, DEV-51).
- **Nouvelle** : champ « Statut » dans la grille « Client & contact », sous `devis / modifier`.
- **Décision** : D-021, D-ECR-FAC-10.
- **Revenir à l'identique** : retirer le champ de `devis/components/PageEditionDevis.tsx`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : champ « Statut » de `devis/components/PageEditionDevis.tsx` ; test ajouté le 28/09 : `devis/components/devis.essai.tsx` « un devis existant porte un champ Statut ; un devis neuf, non ».

### DEF-COR-17 — Deux chapitres homonymes n'ont qu'un sous-total
- **Écran** : Devis, Factures, Bons (lignes et pièces imprimées).
- **Reproduire (ancienne)** : `admin.alpha` → un devis avec deux chapitres « Plomberie » séparés :
  les sous-totaux sont fusionnés.
- **Ancienne** : `devisChapterTotals` groupe par nom (`app.js:2820` — DEV-53).
- **Nouvelle** : sous-totaux par position (`documents/domain/totaux.ts#sousTotauxChapitres`).
- **Décision** : INVENTAIRE DEV-53 (pas de D- dédiée — à vérifier si une décision doit la porter).
- **Revenir à l'identique** : grouper par nom dans `sousTotauxChapitres`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **Tranché : le défaut n'existe pas à l'écran de l'ancien, aucun écart.** Ses sous-totaux de chapitre sont PAR POSITION (`computeChapterSubtotals` → `sousTotauxChapitres` de `src/api/regles-totaux.ts`, `app.js:3344-3360`), comme ceux de `web/` — `tests/parite/totaux.essai.ts` compare les deux. `devisChapterTotals` (groupé par nom, `app.js:2919`) ne sert qu'à préremplir le montant par métier d'un bon depuis son devis (`app.js:18775`), où additionner deux chapitres « Plomberie » est le résultat voulu ; `web/` y fait de même (`commandes/domain/metiers.ts#totauxDesChapitres`).

### DEF-COR-18 — Hors circuit, les travaux chiffrés tombent hors chapitre ; chiffrage sans quantité
- **Écran** : Bons › pré-facture (validation directeur).
- **Reproduire (ancienne)** : `admin.alpha` → un bon hors circuit avec un travail supplémentaire chiffré
  → valider : le travail arrive en fin de facture sans chapitre ; chiffrer un travail depuis la
  fiche : quantité et unité ne partent pas.
- **Ancienne** : validation hors circuit sans intégration (`app.js:8204` — BC-91) ;
  `chiffrerTravailSupplementaire(id, prix)` sans quantité ni unité (BC-92).
- **Nouvelle** : les travaux chiffrés rejoignent le chapitre de leur métier dans les deux chemins ;
  prix, quantité et unité toujours envoyés (`commandes/api/circuit.ts`).
- **Décision** : D-BC-05 ; INVENTAIRE BC-92.
- **Revenir à l'identique** : ne pas intégrer les travaux hors circuit et n'envoyer que le prix.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `commandes/api/circuit.ts` ; tests `tests/rls/circuit.essai.ts` « …chiffre prix + quantité + unité… », « hors circuit : … les travaux chiffrés sont intégrés aussi ».

### DEF-COR-19 — File « Validation » : compteur faux, circuits clos affichés
- **Écran** : Factures › Validation.
- **Reproduire (ancienne)** : `admin.alpha` → Validation : le compteur annonce des bons que le filtre
  fait disparaître ; un SAV clos gratuitement avec une tâche pointée reste « en cours ».
- **Ancienne** : compteur avec `travaux_en_cours`, filtre `valideConducteur && !valideDirecteur`
  (`app.js:5152, 5541` — BC-96) ; `etapeValidation` ignore `cloture_gratuit`.
- **Nouvelle** : chaque compteur est celui de sa liste, circuits clos écartés
  (`commandes/domain/files.ts#fileValidation`).
- **Décision** : D-BC-11, D-R4-02.
- **Revenir à l'identique** : recompter comme l'ancien et ne plus écarter les circuits clos dans
  `files.ts`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `commandes/domain/files.ts#fileValidation` ; tests `commandes/domain/circuit.essai.ts` « file de validation : compteur et filtre lisent la même règle ; clos gratuit… exclus », `commandes/components/circuit.essai.tsx` « le compteur de chaque filtre est celui de sa liste ».

### DEF-COR-20 — Pièce commandée : une seule tâche écrite, échec ignoré
- **Écran** : Pièces en commande.
- **Reproduire (ancienne)** : voir DEF-ECR-02 ; en plus, `secretaire.alpha` (sans `planning /
  modifier`) → changer le fournisseur d'une pièce : aucun message, rien n'est écrit.
- **Ancienne** : `updatePieceCommandeChamp` ignore le retour de `stSet` (`app.js:7077-7084` — BC-97) ;
  le pont vise une seule tâche, la date se relit parfois sur une autre (D-043).
- **Nouvelle** : écriture de `piece_date_commande` / `piece_fournisseur` sur toutes les tâches du bon
  qui portent la pièce ; un échec (0 ligne écrite) remonte (`commandes/api/pieces.ts`).
- **Décision** : D-043, D-ECR-BC-03 ; DEF-ECR-02.
- **Revenir à l'identique** : écrire une seule tâche et taire l'échec.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `commandes/api/pieces.ts` (toutes les tâches du bon qui portent la pièce ; 0 ligne écrite = refus) ; test `tests/rls/commandes.essai.ts` « pièces (BC-19, BC-21) » (la secrétaire est refusée, en clair).

### DEF-COR-21 — Case « Métiers réalisés » qui n'enregistre rien
- **Écran** : Bons › carte dépliée.
- **Reproduire (ancienne)** : `conducteur.alpha` → cocher un métier réalisé → recharger : décoché.
- **Ancienne** : `toggleBCMetierFait` (`app.js:8353`) écrit `metiersFait`, sans colonne (BC-90).
- **Nouvelle** : pas de case ; l'état par métier se lit sur les tâches (panneau du circuit).
- **Décision** : D-BC-08.
- **Revenir à l'identique** : remettre une case sans effet durable.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : aucune case ; l'état de chaque métier se lit sur ses tâches (`planning/components/EnAttente.tsx`) ; test ajouté le 28/09 : `planning/components/planning.essai.tsx` « la carte dépliée dit l'état de chaque tâche, et n'offre aucune case sans effet ».

### DEF-COR-22 — Des boutons que la base refuse sont proposés
- **Écrans** : Bons (pré-facture), Planning (cartes), Clients, Factures (sous-onglets), barre mobile.
- **Reproduire (ancienne)** : `secretaire.alpha` → pré-facture → chiffrer un travail supplémentaire :
  refus de la base ; `technicien.alpha` → planning → 📞 / 📅 d'une carte : refus ; `lecture.alpha` →
  Clients → « + Nouveau client », « Supprimer le client » ; planning : ✕, heure, durée, poignée
  cliquables et refusés ; Factures : Validation, À facturer, Règlements montrés à tout rôle ; barre
  mobile non filtrée (`app.js:114`, AUTH-78).
- **Ancienne** : boutons affichés, refus au clic.
- **Nouvelle** : masqués ou présentés en lecture, selon la matrice (règle du dépôt : « l'interface ne
  fait que masquer ce qui serait de toute façon refusé »).
- **Décision** : D-BC-06, D-PLN-13, D-ECR-PLN-03, D-ECR-CHA-06, D-ECR-CHA-14, D-ECR-FAC-01, D-014.
- **Revenir à l'identique** : retirer les conditions `usePermission` / `<Can>` de ces écrans.
- **Corrigé en production (97287c3, 28/09/2026)** — même règle, côté bons : « Supprimer » restait
  affiché, grisé, sur la carte d'un bon facturé que `bons_commande_facture_indelebile` refusera
  toujours de supprimer. L'ancienne ne l'affiche plus du tout ; `web/`, qui le grisait comme elle,
  fait de même (`commandes/components/CarteBon.tsx`, test `commandes.essai.tsx` « un bon facturé
  n'affiche pas « Supprimer » ») : pas d'écart.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `clients/components/clients.essai.tsx` « bouton « + Nouveau client » pour %s », `planning/components/planning.essai.tsx` « le rôle lecture voit le planning sans aucun réglage », `commandes/components/pieces.essai.tsx` « la secrétaire voit les pièces sans pouvoir agir », `devis/components/devis.essai.tsx` « le rôle lecture… », `app/Layout.essai.tsx` (menus par rôle), `commandes.essai.tsx` « un bon facturé n'affiche pas « Supprimer » ».

### DEF-COR-23 — Téléphone du locataire : écrit par l'ancienne, jamais relu
- **Écran** : Bons › formulaire, section « Lieu & locataire ».
- **Reproduire (ancienne)** : `conducteur.alpha` → saisir le téléphone du locataire → enregistrer →
  rouvrir : champ vide (la vue ne le sert pas), la colonne porte pourtant la valeur (D-041).
- **Ancienne** : écrit `telephone_locataire` ; `v_bons_commande_terrain` ne l'expose pas (BC-93) ;
  réenregistrer le bon avec le champ vide efface la valeur.
- **Nouvelle** : le champ s'affiche mais la colonne n'est jamais envoyée ; le terrain lit le numéro
  par `telephones_locataires` (proposition n° 19, DEF-BDD-26).
- **Décision** : D-041, D-ECR-BC-04, D-PLN-10.
- **Revenir à l'identique** : envoyer `telephone_locataire` à l'enregistrement du bon (avec le risque
  d'effacement ci-dessus).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : la colonne n'est jamais envoyée ; test `commandes/domain/enregistrement.essai.ts` (`telephone_locataire` absent de l'en-tête écrit), lecture par `telephones_locataires` (`tests/rls/planning.essai.ts`).

### DEF-COR-24 — « reçue le 25T16:29:20.875085+00:00/09/2026 »
- **Écran** : Planning › colonne « Non planifiés » (pièce reçue).
- **Reproduire (ancienne)** : `admin.alpha` → un bon dont la pièce a été reçue (« ✓ Pièce arrivée »)
  → Planning : la ligne de la pièce.
- **Ancienne** : `pieceAttendueLigne` passe l'horodatage `piece_recue_le` à `fmtDate`
  (`app.js:9432`).
- **Nouvelle** : « reçue le 25/09/2026 ».
- **Décision** : D-ECR-PLN-05.
- **Revenir à l'identique** : formater l'horodatage brut comme l'ancien.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `planning/components/InfosCarte.tsx` passe par `formatDateFr`, qui lit le jour d'un horodatage ; test `src/lib/dates.essai.ts` « formatDateFr » (« 2026-09-24T10:00:00Z » → « 24/09/2026 »).

### DEF-COR-25 — Planning : tâches et journées mal tenues au placement
- **Écran** : Planning (glisser-déposer, « + Autre date », « Non planifiés »). D-PLN-16 ne dit pas si l'équipe
  redemandée à chaque dépôt vient de l'ancien ou d'une version antérieure de `web/` : **à vérifier**.
- **Reproduire (ancienne)** : `admin.alpha` → déplacer une carte posée à une autre date : la tâche
  reste à l'ancienne date et réapparaît en « Suppl. » ; « + Autre date » sur un bon multi-métiers :
  journée créée pour tous les métiers ; déposer une carte qui a déjà une équipe : l'équipe est
  redemandée ; étirer une carte sur midi : l'heure de midi peut compter deux fois ; un bon qui ne
  porte que `metiers: ["Sol"]` : carte sans métier, hors filtre ; un bon facturé reste dans « Non
  planifiés » ; déposer dans « Non planifiés » une carte faite : déplanifiée sans contrôle.
- **Ancienne** : tâche créée au premier pointage ou à l'ouverture de la fiche (sans équipe) ;
  `dropUnsched` sans contrôle (`app.js:10313`, PLN-50) ; `calculerSpanRows` non inversible.
- **Nouvelle** : la tâche naît à la planification avec son équipe ; déplacer une carte déplace sa
  journée ; journée supplémentaire par métier ; affectation connue reprise ; `dureeDesCases`
  inverse exacte ; métier de la clé, puis `metier`, puis premier de `metiers` ; circuits clos hors
  « Non planifiés » ; déplanification contrôlée (`planning/domain/planification.ts`).
- **Décision** : D-PLN-02, D-PLN-03, D-PLN-04, D-PLN-08, D-PLN-15, D-PLN-16, D-PLN-17 ; INVENTAIRE PLN-50.
- **Revenir à l'identique** : une par une dans `planning/domain/planification.ts`, `grille.ts`,
  `cartes.ts` ; chacune est indépendante.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `planning/domain/planning.essai.ts` (D-PLN-02 à 04, D-PLN-08, PLN-50, `affectationConnue`), `planning/components/planning.essai.tsx` « une carte faite ne se retire pas du planning ». **Tranché** (D-PLN-16) : c'est bien l'ancien — `dropOnHour` ouvre le choix de l'équipe dès que la colonne n'en désigne pas (`if(assigneeField && !assigneeValue)`, `app.js:10501`), sans regarder l'équipe que la carte porte déjà.

### DEF-COR-26 — « Date faite » sans colonne ; « Terminée le » jamais effacée
- **Écran** : Planning › fiche d'intervention (technicien), fenêtre « Valider les travaux »
  (sous-traitant).
- **Reproduire (ancienne)** : `technicien.alpha` → Planning → une carte de son équipe → cocher « Cette
  date est terminée » → enregistrer → recharger : décochée. Décocher une intervention terminée :
  « Terminée le » reste.
- **Ancienne** : écrit `dateOrigineFait`, sans colonne (`app.js:9735`, `10231`) ;
  `saveTechnicienIntervention` ne remet pas `dateInterventionTerminee` à vide (`app.js:10114`,
  PLN-54).
- **Nouvelle** : la case reflète les tâches déclarées faites et est désactivée ; la journée se clôt par
  « ✓ Travaux terminés » (`tache_marquer_realisee`) ; « Terminée le » se dérive des tâches.
- **Décision** : D-PLN-05, D-PLN-14, D-ECR-PLN-06, D-ECR-PLN-07 ; le pointage du sous-traitant dépend
  de la proposition n° 16 (DEF-BDD-23).
- **Revenir à l'identique** : rendre la case active et l'écrire dans un champ qui ne persiste pas ;
  écrire « Terminée le » à la main.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; test `planning/domain/planning.essai.ts` (PLN-54) ; pointage du sous-traitant : `tests/rls/planning.essai.ts` (DEF-BDD-23).

### DEF-COR-27 — Photos du terrain perdues à l'enregistrement
- **Écran** : Planning › fiche d'intervention (photos).
- **Reproduire (ancienne)** : `technicien.alpha` → ajouter une photo à une intervention → enregistrer
  → recharger : la photo a disparu.
- **Ancienne** : `technicienPhotos` sans colonne.
- **Nouvelle** : photo au seau `terrain` + ligne `bon_commande_photos`, écrite dès l'ajout.
- **Décision** : D-PLN-06, D-ECR-PLN-06 ; proposition n° 17 (DEF-BDD-24) pour que le terrain relise ses
  photos.
- **Revenir à l'identique** : ne plus écrire les photos (les garder en mémoire).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : photo écrite dès l'ajout (`planning/api/planning.ts#ajouterPhoto`) ; test `tests/rls/planning.essai.ts` « le technicien dépose et lit une photo du bon ».

### DEF-COR-28 — Rapport : brouillon imprimé, contrôles perdus au rechargement, IA sans clé
- **Écran** : Rapports › assistant et aperçu.
- **Reproduire (ancienne)** : `technicien.alpha` → rédiger un rapport sans l'enregistrer → « Imprimer /
  PDF » : il s'imprime sans exister en base ; cocher des contrôles, enregistrer, recharger, imprimer :
  « Contrôles réalisés » a disparu du PDF ; « ✨ Générer / améliorer avec l'IA » : échec.
- **Ancienne** : imprime le brouillon ; l'adaptateur ne relit pas `intervention_controles` ;
  `generateRapportIA` appelle le fournisseur depuis le navigateur sans clé (`app.js:11678`, PLN-51).
- **Nouvelle** : enregistre puis ouvre l'aperçu ; imprime les contrôles enregistrés ; le bouton IA dit
  que la génération n'est pas disponible.
- **Décision** : D-ECR-PLN-08, D-PDF-09, D-PLN-11, D-ECR-PLN-09.
- **Revenir à l'identique** : imprimer sans enregistrer, ne pas relire les contrôles au PDF ; l'appel
  sans clé ne se reproduit pas utilement.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests ajoutés le 28/09 : `interventions/components/etape-rapport.essai.tsx` (impression et e-mail passent par l'enregistrement ; le bouton IA le dit). Contrôles relus au PDF : `tests/rls/interventions.essai.ts` « le technicien rédige… contrôles… ».

### DEF-COR-29 — Prêts et entretiens (véhicules, matériel) perdus au rechargement
- **Écran** : Véhicules › fiche (prêts, entretiens) ; Matériel › fiche (prêts).
- **Reproduire (ancienne)** : `admin.alpha` → Véhicules → une fiche → « Prêter » (schéma, emprunteur)
  → recharger : le prêt a disparu ; idem pour un entretien et un prêt de matériel.
- **Ancienne** : `prets`, `entretiens` rangés sur la fiche, sans colonne ; les tables
  `vehicule_prets`, `vehicule_entretiens`, `materiel_prets` restent vides (VEH-20).
- **Nouvelle** : écrits dans leurs tables, durée prévue dans `duree_jours`, un seul prêt en cours
  (`vehicules/api/prets.ts`, `entretiens.ts`, `materiel/api/materiels.ts`).
- **Décision** : D-VEH-01, D-VEH-02 ; proposition n° 21 (DEF-BDD-27).
- **Revenir à l'identique** : ne plus écrire ces tables — soit perdre les prêts. À trancher explicitement.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `tests/rls/vehicules.essai.ts`, `tests/rls/vehicules-api.essai.ts` (prêts, entretiens, prêts de matériel).

### DEF-COR-30 — Date de contrôle technique jamais conservée
- **Écran** : Véhicules › formulaire, liste (« EXPIRÉ », « DANS n J »).
- **Reproduire (ancienne)** : `admin.alpha` → Véhicules → modifier → « Prochain contrôle technique »
  → enregistrer → recharger : « — ».
- **Ancienne** : champ `veh_prochainCT` (`app.js:15180`) → `prochain_c_t`, colonne inexistante (la
  vraie est `date_controle_technique` — VEH-21) ; la liste lit `v.prochainCT` (`app.js:14959`).
- **Nouvelle** : écrit et lit `date_controle_technique` ; l'étiquette suit le seuil des réglages.
- **Décision** : INVENTAIRE VEH-21, D-VEH-04 (pas de D- dédiée pour la colonne).
- **Revenir à l'identique** : ne plus écrire la colonne — la date se perd.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `vehicules/domain/vehicules.essai.ts`, `tests/parite/vehicules.essai.ts`, `tests/rls/vehicules.essai.ts` (VEH-21). **Tranché** : le formulaire de l'ancien écrit `prochainCT`, que `toSnake` (`src/integrations/html-adapter.ts:59`) rend `prochain_c_t` — colonne absente de `vehicules` en production (`src/api/columns.ts:79`, qui a `date_controle_technique`) : `colonnesDe()` l'écarte, la date se perd ; la liste lit `v.prochainCT` (`app.js:15114-15124`) et affiche « — ». L'ancien le reconnaît lui-même pour ses alertes (`app.js:631`).

### DEF-COR-31 — Carte carburant : un code PIN fait refuser toute la fiche
- **Écran** : Véhicules › fiche › carte carburant.
- **Reproduire (ancienne)** : `admin.alpha` → saisir « 1234 » dans « Validité / code PIN » → enregistrer.
- **Ancienne** : champ texte écrit dans une colonne `date` : l'enregistrement entier est refusé.
- **Nouvelle** : champ date.
- **Décision** : D-VEH-05.
- **Revenir à l'identique** : champ texte libre « Validité / code PIN ».
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; test `vehicules/domain/vehicules.essai.ts` (D-VEH-05).

### DEF-COR-32 — Factures d'achat et d'entretien du véhicule perdues
- **Écran** : Véhicules › fiche (« + Ajouter » facture d'achat, facture d'entretien).
- **Reproduire (ancienne)** : `admin.alpha` → déposer une facture d'achat → recharger.
- **Ancienne** : `factureAchatFiles` sans colonne (`app.js:15021-15023`) ; facture d'entretien en
  data-URL, perdue ; pas de politique Storage pour `<société>/vehicules/…`.
- **Nouvelle** : `vehicule_documents` + seau, `vehicule_entretiens.fichier_chemin`.
- **Décision** : D-VEH-03 ; politiques Storage de la proposition n° 21.
- **Revenir à l'identique** : ne plus déposer ces fichiers.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `tests/rls/vehicules.essai.ts` « la secrétaire dépose la facture d'achat d'un véhicule », `tests/rls/vehicules-api.essai.ts` « entretien avec facture jointe ».

### DEF-COR-33 — Vente de véhicule : acheteur en texte libre, phrase inexacte
- **Écran** : Véhicules › « Vendre ce véhicule ».
- **Reproduire (ancienne)** : `admin.alpha` → vendre un véhicule : acheteur saisi en texte, TVA 20 ou
  0 ; la fenêtre annonce une facture « modifiable ensuite dans l'onglet Factures » alors qu'elle est
  émise aussitôt ; la note « Vente de véhicule » est perdue.
- **Ancienne** : facture émise d'emblée, client sans fiche (`app.js:15344` — FAC-96).
- **Nouvelle** : acheteur = fiche du répertoire, taux de la liste des réglages, brouillon → véhicule
  vendu → émission par la base, une seule fois ; phrase exacte.
- **Décision** : D-FAC-11, D-VEH-06, D-ECR-PAR-02.
- **Revenir à l'identique** : texte libre et taux 20/0 dans `vehicules/api/vente.ts` et la fenêtre.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `vehicules/domain/vehicules.essai.ts` (D-VEH-06), `tests/rls/vehicules-api.essai.ts` « la vente émet une facture numérotée par la base, et ne se fait qu'une fois ».

### DEF-COR-34 — Absences perdues, solde de congés faux
- **Écran** : RH › fiche salarié › congés.
- **Reproduire (ancienne)** : `admin.alpha` → RH → un salarié → ajouter un congé payé → recharger.
- **Ancienne** : `absences` posées sur la fiche, sans colonne ; `salarie_absences` inutilisée ; écrit
  à chaque frappe (RH-20).
- **Nouvelle** : une ligne `salarie_absences` par absence, actée (`statut = 'approuvee'`), solde
  enregistré avec la fiche.
- **Décision** : D-RH-02 ; contrainte `fin >= début` de la proposition n° 20.
- **Revenir à l'identique** : ne plus écrire `salarie_absences`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `rh/domain/rh.essai.ts`, `tests/rls/rh.essai.ts` (RH-20).

### DEF-COR-35 — Documents de sous-traitant perdus
- **Écran** : Réglages › Intervenants › sous-traitant (documents à échéance).
- **Reproduire (ancienne)** : `admin.alpha` → un sous-traitant → déposer une attestation décennale →
  recharger.
- **Ancienne** : `documents` (data-URL) sur la fiche, sans colonne (PAR-20).
- **Nouvelle** : `sous_traitant_documents` + `<société>/sous-traitants/<id>/`.
- **Décision** : D-RH-08, D-SOC-14.
- **Revenir à l'identique** : ne plus écrire la table.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `tests/rls/auth-roles.essai.ts` « sous-traitant et son document », `tests/rls/rh.essai.ts` « le rôle lecture n'efface plus les documents d'un sous-traitant ».

### DEF-COR-36 — Une fiche conducteur retirée se réactive ; le rôle est redemandé
- **Écran** : RH › fiche salarié › « Conducteur de travaux ».
- **Reproduire (ancienne)** : `admin.alpha` → décocher « Conducteur de travaux » d'un salarié →
  enregistrer → rouvrir : la case est cochée ; enregistrer : la fiche est réactivée. Tant que le
  compte n'est pas conducteur, chaque enregistrement redemande le rôle.
- **Ancienne** : case cochée dès qu'une fiche existe, même retirée.
- **Nouvelle** : case selon `actif` ; rôle proposé une fois, au passage à « coché ».
- **Décision** : D-RH-09, D-RH-10.
- **Revenir à l'identique** : cocher dès qu'une fiche existe, redemander à chaque enregistrement
  (`rh/domain/intervenants.ts#planConducteur`, `PageFicheSalarie.tsx`).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; test `rh/domain/rh.essai.ts` (`planConducteur` : fiche retirée, rien à faire).

### DEF-COR-37 — Seuils d'alerte codés en dur ; cloche en double ou pour des bons facturés
- **Écrans** : RH (liste), Véhicules (liste, échéances), cloche.
- **Reproduire (ancienne)** : `admin.alpha` → Réglages › RH : carte BTP à 90 jours → RH : l'alerte
  reste à 30 jours ; une habilitation qui expire : deux lignes dans la cloche ; un bon facturé à date
  de fin passée : il sonne « en retard » ; « Échéances » d'un véhicule : nommé par `nom`, vide.
- **Ancienne** : 30 jours en dur pour la carte BTP, les habilitations, le CT, les documents de
  sous-traitant ; `alertesSalarie` appelée sans les seuils ; habilitation comptée aussi comme document.
- **Nouvelle** : seuils des Réglages partout, une ligne par habilitation, retard seulement si les
  travaux restent à faire, véhicule nommé par sa plaque, CT dans les échéances.
- **Décision** : D-RH-04, D-VEH-04, D-CLI-06.
- **Revenir à l'identique** : remettre les 30 jours en dur et les règles de l'ancienne cloche
  (`notifications`, `rh`, `vehicules/domain/echeances.ts`).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `rh/domain/rh.essai.ts` (D-RH-04), `vehicules/domain/vehicules.essai.ts` et `tests/parite/vehicules.essai.ts` (D-VEH-04), `tests/parite/notifications.essai.ts` (D-CLI-06).

### DEF-COR-38 — Conducteur ou fournisseur supprimé au lieu d'être retiré
- **Écran** : Réglages › Intervenants (conducteurs, fournisseurs).
- **Reproduire (ancienne)** : `admin.alpha` → « Supprimer » un conducteur cité par des bons.
- **Ancienne** : la fiche est effacée ; bons, devis, factures perdent leur conducteur (PAR-06).
- **Nouvelle** : « Retirer » (`actif = false`), « Retiré », remise d'un clic.
- **Décision** : D-ECR-PAR-12.
- **Revenir à l'identique** : bouton « Supprimer » qui efface la fiche.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `reglages/domain/reglages.essai.ts`, `rh/components/rh.essai.tsx`, `tests/rls/rh.essai.ts` (PAR-06).

### DEF-COR-39 — Logo et documents légaux en data-URL dans les réglages
- **Écran** : Réglages › Identité visuelle, Documents légaux.
- **Reproduire (ancienne)** : `admin.alpha` → déposer un logo et une attestation : ils vont dans
  `societe_settings.infos_entreprise` (data-URL).
- **Ancienne** : data-URL dans le JSON (SOC-51) ; `documents_legaux` et `societes.logo_url` inutilisés.
- **Nouvelle** : seau `terrain` (`<société>/societe/`, `<société>/documents-legaux/`), table
  `documents_legaux`, `societes.logo_url` ; les pièces héritées restent visibles en lecture.
- **Décision** : D-SOC-02, D-SOC-05.
- **Revenir à l'identique** : écrire les data-URL dans `infos_entreprise`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `reglages/domain/reglages.essai.ts`, `societes/domain/societe.essai.ts` (SOC-51), `tests/rls/reglages.essai.ts` (documents légaux au seau).

### DEF-COR-40 — Préfixe de numérotation à tiret accepté
- **Écran** : Réglages › Numérotation.
- **Reproduire (ancienne)** : `admin.alpha` → préfixe « DE-V » : accepté, numéros
  « DE-V-2026-000001 » ambigus ; chaque baisse de compteur se confirme une à une.
- **Ancienne** : tout préfixe de 8 caractères.
- **Nouvelle** : lettres, chiffres, `_` ; une confirmation groupée.
- **Décision** : D-SOC-10.
- **Revenir à l'identique** : accepter tout préfixe, une confirmation par série.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; test `reglages/domain/reglages.essai.ts` « un préfixe porte lettres et chiffres, sans tiret ».

### DEF-COR-41 — Code de référentiel sans accents
- **Écran** : Réglages › Listes de choix.
- **Reproduire (ancienne)** : `admin.alpha` → ajouter « Location de matériel » : code
  « location_de_mat_riel ».
- **Ancienne** : repli sans `normaliserEntree` (PAR-21).
- **Nouvelle** : « location_de_materiel » (`reglages/domain/listes.ts#codeDepuisLibelle`).
- **Décision** : INVENTAIRE PAR-21 (pas de D- dédiée).
- **Revenir à l'identique** : retirer `normaliserEntree` du repli.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **Tranché : le défaut n'existe pas en pratique, aucun écart.** L'ancien calcule le code par `window.normaliserEntree(libelle)` (`app.js:17930-17932`), que la couche TypeScript pose toujours (`src/integrations/session.ts:726`) et qui retire les accents (`src/api/regles-referentiels.ts:36`) : « location_de_materiel ». Le repli sans accents n'est pris que si cette fonction manquait. `web/` donne le même code : `reglages/domain/reglages.essai.ts` (`codeDepuisLibelle`).

### DEF-COR-42 — « Fait » de la cloche refusé au conducteur et au technicien
- **Écran** : cloche de l'en-tête.
- **Reproduire (ancienne)** : `conducteur.alpha` → cloche → marquer une alerte « fait » : échec
  (réglages non modifiables) ; `admin.alpha` : chaque coche réécrit tout le JSON des réglages.
- **Ancienne** : `notifsTraitees` dans `societe_settings.infos_entreprise`.
- **Nouvelle** : table `notifications_traitees` (`notifications/api/notifications.ts`).
- **Décision** : D-CLI-05 ; proposition n° 31 (DEF-BDD-30).
- **Revenir à l'identique** : écrire `notifsTraitees` dans les réglages.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `notifications/api/notifications.ts` ; test `tests/rls/notifications.essai.ts` (prouvé contre la base sans proposition, DEF-BDD-30).

### DEF-COR-43 — Saisie : « 1,5 » lu 1
- **Écran** : tout champ numérique (quantités, prix, pourcentages).
- **Reproduire (ancienne)** : `admin.alpha` → une ligne de devis, quantité « 1,5 » : 1 retenu.
- **Ancienne** : `parseFloat("1,5")` = 1.
- **Nouvelle** : virgule française comme séparateur décimal (`lib/money.ts#montant`).
- **Décision** : D-013, D-CHA-03.
- **Revenir à l'identique** : lire par `parseFloat`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `src/lib/money.essai.ts` « admet la virgule française et les espaces de milliers », `src/lib/nombres.essai.ts`. Les champs `type="number"` des règlements rendent toujours un point : `parseFloat` y reste juste.

### DEF-COR-44 — « …alors que le pays est . »
- **Écran** : Clients, Réglages › Organisation (contrôle du n° de TVA).
- **Reproduire (ancienne)** : `admin.alpha` → fiche client, pays vide, n° de TVA étranger.
- **Ancienne** : `verifierEntite` compare à `paysCode ?? "FR"` : un pays `""` produit « …alors que le
  pays est . ».
- **Nouvelle** : pays vide = France (`tests/parite/identifiants.essai.ts`).
- **Décision** : D-012.
- **Revenir à l'identique** : comparer à `paysCode ?? "FR"`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; test `tests/parite/identifiants.essai.ts` (D-012).

### DEF-COR-45 — Catalogue : une virgule casse la recherche ; familles tronquées
- **Écran** : Catalogue.
- **Reproduire (ancienne)** : `admin.alpha` → chercher « Tube 1/2, cuivre » : la liste tombe en
  erreur ; au-delà de 1 000 articles, familles incomplètes ; retirer le dernier article de la dernière
  page : erreur 416 ; filtre « Retirés » vide : « Le catalogue est vide ».
- **Ancienne** : `or=(code.ilike.%x%,designation.ilike.%x%)` sans guillemets ; une seule page de
  familles (`max_rows`).
- **Nouvelle** : valeur entre guillemets, familles lues par pages, dernière page servie, « Aucun
  article ne correspond. ».
- **Décision** : D-023, D-024, D-ECR-CHA-03.
- **Revenir à l'identique** : filtre sans guillemets, une page de familles, message « Le catalogue est
  vide ».
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `articles/domain/article.essai.ts` « une virgule ou une parenthèse ne casse pas le filtre PostgREST », `tests/rls/articles.essai.ts` « …supporte virgules et parenthèses », `articles/components/articles.essai.tsx` (« Aucun article ne correspond. ») ; familles lues par pages (`articles/api`).

### DEF-COR-46 — Listes tronquées sans le dire
- **Écrans** : clients, chantiers, devis, factures, règlements, salariés, cloche.
- **Reproduire (ancienne)** : au-delà du plafond de lignes du serveur, une liste s'afficherait
  coupée — **à vérifier** : le pont a déjà `refuserSiTronque` (`html-adapter.ts`, collections et
  filles) ; l'écart porte sur les lectures hors du pont.
- **Ancienne** : lectures directes non paginées (familles du catalogue, D-024).
- **Nouvelle** : `lib/lecture.ts#lireTout` (compte exact, pages ; sinon erreur `ListeTronquee`).
- **Décision** : D-CLI-07, D-R4-08 ; INVENTAIRE TRV-10.
- **Revenir à l'identique** : sans objet côté affichage tant que les listes tiennent sous le plafond.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `lib/lecture.ts#lireTout` ; tests `src/lib/lecture.essai.ts`, `src/lib/listes-tronquees.essai.ts`, `tests/rls/clients-api.essai.ts` (TRV-10). **Tranché** : le pont de l'ancien refuse déjà une collection ou une fille tronquée (`refuserSiTronque`, `html-adapter.ts:679`, appelé l. 758 et 1659) ; le défaut ne vaut que pour ses lectures hors du pont — les familles du catalogue (DEF-COR-45).

### DEF-COR-47 — Messages d'erreur en anglais
- **Écrans** : Connexion, lecture automatique d'un bon, refus de la base.
- **Reproduire (ancienne)** : se connecter avec un mauvais mot de passe : message anglais de Supabase ;
  lecture automatique refusée : « Edge Function returned a non-2xx status code ».
- **Ancienne** : message brut.
- **Nouvelle** : messages en français ; motif rédigé par la base affiché (`details`, `hint`, `message`).
- **Décision** : D-AUTH-04, D-VIS-03, D-ECR-BC-10.
- **Revenir à l'identique** : afficher `error.message` brut.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `lib/erreurs.ts` ; tests `src/lib/erreurs.essai.ts`, `tests/e2e/parcours.e2e.ts` (« Adresse e-mail ou mot de passe incorrect. »), `ocr/components/lecture.essai.tsx`.

### DEF-COR-48 — La recherche perd le focus à chaque frappe
- **Écrans** : listes avec recherche (chantiers, clients, catalogue…).
- **Reproduire (ancienne)** : taper dans la recherche : la zone se redessine, le champ perd le focus.
- **Décision** : D-ECR-CHA-05.
- **Revenir à l'identique** : redessiner le champ (non recommandé).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place (champs React contrôlés, jamais redessinés) ; test ajouté le 28/09 : `facturation/components/recherche-croisee.essai.tsx` (le champ garde le focus et sa saisie).

### DEF-COR-49 — Rapport de rejets d'import nommé `.pdf`
- **Écrans** : imports (catalogue, clients, factures).
- **Reproduire (ancienne)** : importer un fichier avec rejets → « 📄 Rapport » : un CSV nommé `….pdf`.
- **Ancienne** : `telechargerBlob` ajoute `.pdf` à tout.
- **Nouvelle** : `.csv`.
- **Décision** : D-PDF-07.
- **Revenir à l'identique** : nommer le fichier `.pdf`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : `import-articles-rapport.csv`, `import-clients-rapport.csv`, `import-factures-rapport.csv` (`PageImportArticles.tsx:14`, `PageImportClients.tsx:51`, `PageImportFactures.tsx:69`).

### DEF-COR-50 — Import de clients : une mise à jour efface les champs absents
- **Écran** : Clients › import.
- **Reproduire (ancienne)** : `admin.alpha` → importer un export partiel (nom et SIRET seulement) d'un
  client existant : e-mail, adresse, type effacés.
- **Ancienne** : réécrit toute la fiche d'un client rapproché, cases vides comprises.
- **Nouvelle** : n'envoie que les valeurs renseignées, jamais le nom, le type ni `eligibilite_*`
  (`tests/rls/import-export.essai.ts`).
- **Décision** : D-EFA-07.
- **Revenir à l'identique** : envoyer toute la ligne à la mise à jour.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `tests/parite/import-clients.essai.ts`, `tests/rls/import-export.essai.ts` (D-EFA-07).

### DEF-COR-51 — Restauration de sauvegarde sans garde de rôle
- **Écran** : Réglages › « ⬆ Importer une sauvegarde ».
- **Reproduire (ancienne)** : tout rôle qui ouvre l'écran → importer un JSON de sauvegarde : il réécrit
  les collections, pièces numérotées comprises (`app.js:399-430`, IMP-40).
- **Nouvelle** : export seulement ; le bouton mène à Import / export.
- **Décision** : D-EFA-08, D-ECR-PAR-09.
- **Revenir à l'identique** : réintroduire la restauration par écrasement (la base refuse désormais de
  modifier les pièces figées).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `import-export/components/import.essai.tsx`, `tests/rls/import-export.essai.ts` (IMP-40).

### DEF-COR-52 — Factures de sous-traitant : numéros hors série, « payées » sans règlement
- **Écrans** : Factures (« Mes factures / Factures <société> » du sous-traitant).
- **Reproduire (ancienne)** : `soustraitant.alpha` → établir une facture (chemin exact à vérifier) : numéro `FST-…` calculé à
  l'écran, émise d'emblée ; « Marquer payée » écrit `payée` sans règlement ; les champs
  `sousTraitantEmetteur`, `bonCommandeKTAId(s)` sont filtrés à l'écriture (sans colonne).
- **Ancienne** : `app.js:5725-5727`, `5786`, `5832` (FAC-90, FAC-91).
- **Nouvelle** : pas de facture de sous-traitant (facture d'achat, relève de la réception PDP).
- **Décision** : D-FAC-09 ; tableau du sous-traitant : DEF-STA-14.
- **Revenir à l'identique** : recréer ces vues et la numérotation à l'écran.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place (aucune facture de sous-traitant) ; tests `statistiques/domain/domaine.essai.ts`, `tests/parite/statistiques.essai.ts` (tuiles du sous-traitant, STA-14). **Tranché**, chemin exact dans l'ancien : `soustraitant.alpha` → Factures → « Factures <société> » (`renderFacturesKTAHTML`) → « ➕ Récupérer ma facture pré-remplie » (`creerFactureDepuisBCKTA`, `app.js:5976`, numéro `FST-<n° BC>`) ou sélection + « 🧾 Facturer la sélection (facture mensuelle regroupée) » (`creerFactureGroupeeST`, `app.js:5907`, numéro `FST-M<AAAAMM>` compté à l'écran) : la pièce naît `impayée`, numérotée par l'écran ; « Marquer payée » : `marquerFactureSTPayee` (l. 6022). Les numéros de ligne cités plus haut ont glissé.

### DEF-COR-53 — Portail client mort
- **Écran** : espace client.
- **Reproduire (ancienne)** : aucun chemin n'y mène (`state.currentRole === 'client'` jamais posé).
- **Ancienne** : portail inatteignable, cloisonnement par un sélecteur libre (ESP-30).
- **Nouvelle** : espace client en lecture seule sur la RLS (`client.opac@erp.local`).
- **Décision** : D-008, D-029, D-FAC-10, D-ECR-PAR-14 ; propositions n° 4, 14, 29 (DEF-BDD-28).
- **Revenir à l'identique** : ne pas ouvrir l'espace client.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place ; tests `tests/rls/espace-client.essai.ts`, `espace-client-bons.essai.ts` (prouvés contre la base sans proposition, DEF-BDD-28).

### DEF-COR-54 — Réf. de bon de commande client figée vide sans avertissement
- **Écran** : Factures › « Émettre ».
- **Reproduire (ancienne)** : `secretaire.alpha` → émettre une facture sans réf. de bon client : elle
  est figée vide, sans avertissement préalable.
- **Nouvelle** : même règle (la base fige l'en-tête), avec « Émettre sans réf. de bon de commande
  client ? Elle sera figée vide ».
- **Décision** : INVENTAIRE FAC-100 (pas de D- dédiée).
- **Revenir à l'identique** : retirer la confirmation de `FormulaireFacture.tsx`.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — **défaite au passage « identique » du 26/09, remise le 28/09** : l'avertissement de la réf. figée vide était dans le bouton « Émettre » du formulaire, que d6a2283 a retiré (l'émission est revenue sur la carte, comme dans l'ancien). Remis dans la question de l'ancien, gardée mot pour mot, seulement quand la référence manque (`ActionsCarteFacture.tsx`, `AVERTISSEMENT_REF_VIDE`) ; boîte du navigateur, hors captures. Test qui échoue sans : `facturation/components/recherche-croisee.essai.tsx` « émettre sans réf. de bon de commande client ». **Tranché** sur l'ancien : `emettreLaFacture` (`app.js:6483-6491`) ne dit rien de la référence.

### DEF-COR-55 — « Mon nom » inaccessible au technicien et au sous-traitant
- **Écran** : Réglages › Mon compte / `/mon-compte`.
- **Reproduire (ancienne)** : `technicien.alpha` : pas d'accès aux Réglages, donc à « Mon nom ».
- **Nouvelle** : `/mon-compte` (nom, mot de passe) ouvert à tous.
- **Décision** : D-SOC-06, D-ECR-PAR-08.
- **Revenir à l'identique** : retirer « Mon compte » du menu du nom pour ces rôles.
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place : route `/mon-compte` hors de toute garde de module, « Mon compte » dans le menu du nom pour tous (`MenuUtilisateur.tsx`) ; test `auth-roles/components/compte.essai.tsx` « ouvert au technicien : il renomme son compte ».

### DEF-COR-56 — L'ordre des listes suit l'ordre physique de la base
- **Écrans** : Bons (cartes), fiche chantier (devis, factures), « Tous les règlements ».
- **Reproduire (ancienne)** : l'ordre des cartes change au gré des mises à jour (`v_bons_commande_terrain`
  lue sans `order`).
- **Nouvelle** : ordre stable (date décroissante, numéro, identifiant).
- **Décision** : D-ECR-BC-09, D-ECR-CHA-10, D-ECR-FAC-06.
- **Revenir à l'identique** : non reproductible de façon fiable (ordre non déterminé).
- **État (28/09)** : corrigé — confirmé par le client (28/09). Vérifié sur le code actuel — en place pour les bons (date, numéro interne) et les règlements (identifiant, D-ECR-FAC-06) ; la fiche chantier ne triait que par date : départage par numéro puis identifiant ajouté le 28/09 (`chantiers/api/liens.ts`), test qui échoue sans : `chantiers/api/liens.essai.ts`.

## Défauts de l'ancienne reproduits sans correction

En plus des sections « Statistiques et tableaux de bord » et « Écrans » : défauts que `web/`
reproduit à l'identique (parité ou exigence « identique »), et défauts de production qu'aucune
proposition rédigée ne corrige encore (« Migrations à écrire ensuite » de
`docs/migrations-proposees.md`, fonctions de bord hors de `web/`). Pour chacun : ce qu'il faudrait
faire si le client répond « on corrige ».

### DEF-REP-01 — Import d'articles : `1e3` vaut 1000, `0x10` vaut 16, « 1 200,00 » illisible
- **Écran** : Catalogue › import.
- **Reproduire** : importer un fichier dont un prix vaut `1e3`, un autre `0x10`, un autre
  « 1 200,00 » : 1 000 €, 16 €, 0 € signalé — dans les deux applications.
- **Pourquoi gardé** : même fichier, même résultat (`tests/parite/import-articles.essai.ts`, 600
  fichiers tirés).
- **Corriger** : refuser exposant et hexadécimal des deux côtés, ou consigner l'écart (D-022).
- **État (28/09)** : corrigé dans web/ — commit ad1087b ; `lirePrix` (`articles/domain/import.ts`) lit « 1 200,00 », refuse `1e3` et `0x10` ; test `tests/parite/import-articles.essai.ts` (« prix lus de travers par l'ancien » : l'ancien, évalué tel quel, rend le défaut, le nouveau le juste). D-REP-01.

### DEF-REP-02 — Import de DPGF : « 1.234 » lu 1,234, séparateur deviné sur la 1re ligne
- **Écran** : Chantiers › DPGF › import.
- **Reproduire** : un CSV avec « 1.234 » en quantité ; un fichier dont la 1re ligne contient une
  virgule et le séparateur est `;`.
- **Pourquoi gardé** : des fichiers préparés pour l'ancien liraient autrement (IMP-31, D-EFA-09) ;
  seul le remplacement sans annonce est tempéré (DEF-COR-06).
- **Corriger** : `chantiers/domain/import-dpgf.ts`, avec un écart consigné.
- **État (28/09)** : corrigé dans web/ — commit 1376a23 ; « 1.234 » vaut 1 234, séparateur deviné sur dix lignes (`devinerSeparateur`) ; test `tests/parite/chantiers.essai.ts` (« écart voulu »). D-REP-02.

### DEF-REP-03 — `articles.metier` ni saisi ni recopié sur la ligne
- **Écran** : Catalogue, lignes de devis / factures / bons.
- **Reproduire** : un article dont `metier` est renseigné en base → l'ajouter à un devis : le métier
  n'est pas repris.
- **Décision** : D-025 (INVENTAIRE ART-50). **Corriger** : saisir le métier sur la fiche article et le
  recopier sur la ligne.
- **État (28/09)** : corrigé dans web/ — commit e37c56a ; champ « Métier » sur la fiche article, recopié par `appliquerArticle` ; tests `articles/domain/article.essai.ts`, `articles/components/articles.essai.tsx`. Écart visuel : `tests/visuel/ecrans-chantiers.ts` (fiche article). D-REP-03.

### DEF-REP-04 — Pièces imprimées : « 5.5% », « 2.5 », avoir en positif, SAV intitulé « BON DE COMMANDE »
- **Écran** : aperçus et PDF des devis, factures, bons.
- **Reproduire** : un devis à 5,5 % et une quantité 2,5 → PDF : « 5.5% », « 2.5 » ; un avoir : montants
  positifs sous le titre AVOIR ; un SAV : « BON DE COMMANDE ».
- **Décision** : D-PDF-03 (DEV-52 écarté) — le client a exigé la pièce de l'ancien à l'identique.
  **Corriger** : la correction abandonnée est décrite en D-FAC-03 (avoir en négatif) et DEV-52
  (« 5,5 % »).
- **État (28/09)** : corrigé dans web/ — commit 95cfb34 ; « 2,5 », « 5,5 % », avoir en négatif (`sens`), SAV intitulé « SAV » ; tests `tests/parite/impression.essai.ts` (« écarts voulus » + `ecartVoulu` sur 4 000 tirages), `commandes/domain/impression.essai.ts`, `facturation/domain/duplication.essai.ts`. Recomparé le 28/09 (PDF, aperçus, pré-facture) : seuils mesurés dans `tests/visuel/pdf/comparer-pdf.ts` ; la TVA de ligne prend une espace insécable, sans quoi « % » passait à la ligne dans la pré-facture (D-VIS3-01). D-REP-04.

### DEF-REP-05 — Le nom du client n'apparaît pas sur les chantiers
- **Écran** : Chantiers › liste (cartes) et bandeau de la fiche.
- **Reproduire** : `admin.alpha` → Chantiers : aucune carte ne porte le client.
- **Ancienne** : lit un champ texte `client` que la base ne remplit pas.
- **Décision** : D-ECR-CHA-07 (révisée : l'affichage de `client_nom` a été retiré). **Corriger** :
  afficher `client_nom`.
- **État (28/09)** : corrigé dans web/ — commit f38c3d4 ; `client_nom` sur la carte et dans le bandeau ; test `chantiers/components/fiche.essai.tsx`. Écart visuel : `tests/visuel/ecrans-chantiers.ts` (seuils mesurés par écran, D-VIS3-02). D-REP-05.

### DEF-REP-06 — Un sous-traitant ne peut pas recevoir de compte par invitation
- **Écran** : Réglages › Comptes (et fiche RH).
- **Reproduire** : tenter d'inviter un sous-traitant : rôle absent ; la fonction `inviter-salarie`
  refuse `sous_traitant` et exige un salarié (AUTH-79).
- **Décision** : D-SOC-08. **Corriger** : décision produit et évolution de la fonction de bord (hors
  `web/`), `invitations.sous_traitant_id` existe déjà.
- **État (28/09)** : corrigé dans web/ — commit 68a4961 ; Réglages › Comptes : « Sous-traitants sans compte », rôle fixé ; test `comptes/components/comptes.essai.tsx`. Fonction de bord proposée : `supabase/propositions/fonctions/inviter-salarie` (prérequis au déploiement) ; test RLS `tests/rls/fonctions-proposees.essai.ts` (écrit, non lancé). D-REP-06.

### DEF-REP-07 — Matériel : « Aucun matériel pour l'instant. » même quand la recherche écarte tout
- **Écran** : Matériel › liste.
- **Reproduire** : chercher un mot absent : le message dit qu'il n'y a aucun matériel.
- **Décision** : D-ECR-PAR-04. **Corriger** : « Aucun matériel ne correspond. » quand la recherche filtre.
- **État (28/09)** : corrigé dans web/ — commit a406884 ; test `materiel/components/materiel.essai.tsx`. D-REP-07.

### DEF-REP-08 — Pré-facture : les montants restent en clair en mode discret
- **Écran** : Bons › pré-facture (fenêtre).
- **Reproduire** : activer le mode discret → ouvrir une pré-facture : les montants suivent `money()`.
- **Décision** : D-ECR-BC-11 (« comme l'ancien »). **Corriger** : `formatEurosEcran` dans la fenêtre
  (le document imprimé garderait ses montants, D-CLI-04). À rapprocher de DEF-STA-16, où `web/` a fait
  le choix inverse.
- **État (28/09)** : corrigé dans web/ — commit 89c7caf ; totaux et sous-totaux de la fenêtre par `formatEurosEcran` ; test `commandes/components/circuit.essai.tsx` (« en mode discret »). D-REP-08.

### DEF-REP-09 — Textes périmés du cadre et de « nouveau mot de passe »
- **Écrans** : pied du menu ; page « nouveau mot de passe ».
- **Reproduire** : le pied dit « Données partagées avec toute personne ayant ce lien. » (périmé) ; la
  page « nouveau mot de passe » garde un `login-card` que sa feuille ne style pas.
- **Décision** : D-VIS-04, D-VIS-03 (« identique d'abord »). **Corriger** : retirer ou réécrire la
  phrase ; styler la carte.
- **État (28/09)** : corrigé dans web/ — commit b57f363 ; pied « Données réservées aux comptes de votre société. », carte `login-container` ; tests `app/Layout.essai.tsx`, `auth-roles/components/compte.essai.tsx`. Pied masqué des deux côtés dans la comparaison visuelle. D-REP-09.

### DEF-REP-10 — Deux statuts pour un bon
- **Écran** : Bons de commande (pastille grise « en attente » sur la carte).
- **Reproduire** : tout bon affiche « en attente » quel que soit son avancement ; seul
  `statut_workflow` dit où il en est.
- **Décision** : D-BC-13, D-ECR-BC-01 (INVENTAIRE BC-99). **Corriger** : ne plus afficher `statut`, puis
  le retirer du schéma.
- **État (28/09)** : corrigé dans web/ — commit 9b23235 ; pastille `statut` retirée des cartes ; tests `commandes/components/commandes.essai.tsx`, `circuit.essai.tsx` (« cartes des files »). Écart visuel : `tests/visuel/ecrans.ts` (`PASTILLES_LISTE`, seuils mesurés par écran, D-VIS3-02). Colonne gardée tant que l'application historique l'écrit (D-REP-10).

### DEF-REP-11 — `extraire-bc` ne vérifie ni l'utilisateur ni la société
- **Gravité** : sécurité — un JWT `anon` suffit à consommer le quota Mistral (OCR-40).
- **Constater** : lecture de `supabase/functions/extraire-bc` (hors `web/`) ; aucun test automatisé.
- **Décision** : D-BC-15. Côté `web/`, l'écran exige `bons_commande / creer` ET la fonctionnalité
  `ocr` — masquage seulement. **Corriger** : vérifier le JWT et l'appartenance dans la fonction
  (prérequis de mise en service, `migrations-proposees.md`).
- **État (28/09)** : correction proposée — copie corrigée `supabase/propositions/fonctions/extraire-bc` (commit 5cd0b69), jamais déployée ; test RLS `tests/rls/fonctions-proposees.essai.ts` (« extraire-bc », écrit, non lancé). D-REP-11.

### DEF-REP-12 — Fonctions PDP : rôle non vérifié ; secret du webhook comparé par `!==`
- **Gravité** : sécurité — un compte `lecture` peut déposer une facture, un technicien connecter ou
  déconnecter la plateforme (EFA-20) ; `pdp-webhook` compare son secret avec `!==`, sans
  `verify_jwt=false` déclaré (EFA-21).
- **Décision** : D-EFA-05. `web/` masque « Transmettre » sans `factures / modifier`. **Corriger** (hors
  `web/`) : `a_permission('factures','modifier')` dans la fonction, comparaison à temps constant,
  `verify_jwt` déclaré. Aussi : un second dépôt après expiration du délai n'est gardé que par la
  fonction (D-R4-11, M7) — comportement de l'ancien **à vérifier**.
- **État (28/09)** : correction proposée — copies corrigées des fonctions PDP (`supabase/propositions/fonctions/pdp-*`, commit 5cd0b69) : `a_permission` par fonction, webhook à temps constant, `verify_jwt = false` à déclarer à la racine ; test RLS `tests/rls/fonctions-proposees.essai.ts` (« fonctions PDP », écrit, non lancé). Second dépôt après expiration : inchangé (409 sur `pdp_identifiant`). D-REP-12.

### DEF-REP-13 — `inviter-salarie` ne cherche que dans une page de 50 comptes
- **Constater** : `listUsers()` sur une seule page (AUTH-77) : au-delà de 50 comptes, un compte
  existant peut ne pas être trouvé.
- **Décision** : D-SOC-13. **Corriger** (hors `web/`) : pagination ou recherche par adresse.
- **État (28/09)** : correction proposée — `compteParAdresse` dans la copie corrigée d'`inviter-salarie` (commit 68a4961) ; test RLS `tests/rls/fonctions-proposees.essai.ts` (« au-delà de la 1re page », écrit, non lancé). D-REP-13.

### DEF-REP-14 — Facture née du bon : virement forcé, TVA 10 en dur, conducteur non recopié
- **Écran** : Bons › « 🧾 Créer la facture » (les deux applications appellent `bc_generer_facture`).
- **Reproduire** : un client réglant par chèque → facture du bon : mode « virement », ligne forfait à
  10 %, sans conducteur.
- **Décision** : D-BC-14, D-ECR-BC-07 (INVENTAIRE BC-95). **Corriger** : migration « à écrire »
  (`migrations-proposees.md`), à combiner avec le n° 35 qui refait la même fonction.
- **État (28/09)** : correction proposée en base — `supabase/propositions/20260928200001_la_facture_du_bon_reprend_le_client.sql` (commit 700de3e, après le n° 35) ; test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé). D-REP-14.

### DEF-REP-15 — Deux onglets créent deux bons depuis le même devis
- **Écran** : Devis › « Créer un bon de commande ».
- **Constater** : aucun index unique sur `bons_commande(devis_id)`. `web/` rattrape l'échec des lignes
  (le bon créé s'ouvre, D-R4-07) mais la course reste (D-R4-11).
- **Corriger** : RPC `bon_depuis_devis` et index unique partiel, après examen des doublons (« à écrire »).
- **État (28/09)** : correction proposée en base — `20260928200002_un_devis_un_bon.sql` (index unique partiel, garde des doublons) ; écran adapté (commit 90bff00 : le 23505 devient « déjà lié au bon … », test `devis/api/bon-depuis-devis-course.essai.ts`) ; test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé). D-REP-15.

### DEF-REP-16 — Un bon accepte un client ou un conducteur d'une autre société
- **Gravité** : sécurité (cohérence entre sociétés). L'écran ne les propose pas ; la base ne le refuse
  pas (relecture 3, M1).
- **Corriger** : contrainte ou déclencheur « à écrire » (`migrations-proposees.md`).
- **État (28/09)** : correction proposée en base — `20260928200003_un_document_reste_dans_sa_societe.sql` (commit 700de3e ; bons et devis) ; test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé). D-REP-16.

### DEF-REP-17 — Le terrain peut encore CRÉER une fiche conducteur ou un fournisseur
- **Gravité** : sécurité — l'insertion reste ouverte à `peut_ecrire()` (technicien compris), par l'API ;
  la proposition n° 30 n'a retiré que la suppression.
- **Décision** : D-AUTH-06 (à fermer après vérification qu'aucun geste de l'écran historique n'en
  dépend). **Corriger** : migration « à écrire ».
- **État (28/09)** : correction proposée en base — `20260928200004_le_terrain_ne_cree_ni_conducteur_ni_fournisseur.sql` (commit 700de3e ; vérifié qu'aucun geste de l'écran n'en dépend) ; test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé). D-REP-17.

### DEF-REP-18 — Clients, véhicules, annuaire… lisibles par tout membre, sous-traitant compris
- **Gravité** : sécurité — sous `est_membre(societe_id)` : `clients`, `conducteurs`, `techniciens`,
  `fournisseurs`, `factures_entrantes`, `vehicules`, `materiels`, `referentiels`, `societe_settings`,
  `workflow_journal`, `v_salaries_annuaire` (colonnes sensibles masquées).
- **Constater** : `select tablename from pg_policies where cmd = 'SELECT' and qual ~
  '^est_membre\(societe_id\)$';` (`migrations-proposees.md`, n° 25, « Reste ouvert »).
- **Corriger** : à trancher par le métier (RAPPORT-MATIN, « Décisions à valider »).
- **État (28/09)** : correction proposée en base, **en partie** — `20260928200005_le_sous_traitant_ne_lit_pas_la_gestion.sql` (commit 700de3e) ferme `fournisseurs`, `factures_entrantes`, `vehicules`, `workflow_journal` au sous-traitant ; `clients`, `conducteurs`, `techniciens`, `materiels`, `referentiels`, `societe_settings`, `v_salaries_annuaire` restent lus parce que ses écrans les lisent (décision prudente D-REP-18, à re-trancher par le métier). Test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé).

### DEF-REP-19 — Sept factures réelles restées dans `kv_store`
- **Gravité** : données — FAC-2026-0007 à 0013 (ALPES ISERE HABITAT) : trou dans la série légale
  (FAC-99).
- **Décision** : D-FAC-12. **Corriger** : reprise en production par un humain, `legacy_id` « compta: ».
- **État (28/09)** : correction proposée — procédure humaine documentée (`docs/migrations-proposees.md`, « Reprise des sept factures du kv_store ») ; aucune migration : les données ne sont lisibles qu'en production (D-REP-19). **Non corrigé d'ici.**

### DEF-REP-20 — Le niveau d'abonnement n'est pas opposable
- **Constater** : aucune colonne ne le porte ; les deux écrans ne font que masquer (D-009, D-R4-09).
- **Corriger** : `societes.niveau_abonnement` puis une vérification en base (« à écrire »).
- **État (28/09)** : correction proposée en base — `20260928200007_le_niveau_d_abonnement_est_opposable.sql` (commit 700de3e ; NULL = tout ouvert, posé par le service) ; test RLS `tests/rls/corrections-reproduites.essai.ts` (écrit, non lancé). D-REP-20.

