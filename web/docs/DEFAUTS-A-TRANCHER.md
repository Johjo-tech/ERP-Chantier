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
| DEF-STA-01 | CA : brouillons et acomptes comptés | identique à l'ancienne | calcul |
| DEF-STA-02 | « CA encaissé ce mois » ≠ encaissements | identique à l'ancienne | calcul |
| DEF-STA-03 | Restant dû et taux d'encaissement : brouillons comptés | identique à l'ancienne | calcul |
| DEF-STA-04 | Impayées / échues lues sur le statut stocké | identique à l'ancienne | calcul |
| DEF-STA-05 | « Locataires à rappeler » : affaires closes | identique à l'ancienne | calcul |
| DEF-STA-06 | Activité récente : « · null », lettrages en paiements | identique à l'ancienne | affichage |
| DEF-STA-07 | Top clients par nom écrit | identique à l'ancienne | calcul |
| DEF-STA-08 | Statistiques par étiquette du conducteur | identique à l'ancienne | calcul |
| DEF-STA-09 | « En retard » : bons facturés, clos | identique à l'ancienne | calcul |
| DEF-STA-10 | Barre rouge pleine « 0 / 0 » | identique à l'ancienne | affichage |
| DEF-STA-11 | Travaux supplémentaires toujours à 0 | identique à l'ancienne | calcul |
| DEF-STA-12 | Jamais « injoignable » | identique à l'ancienne | calcul |
| DEF-STA-13 | Technicien : seul le jour du rendez-vous | identique à l'ancienne | calcul |
| DEF-STA-14 | Sous-traitant : deux tuiles à zéro | identique à l'ancienne | calcul |
| DEF-STA-15 | Infobulle 12 mois : année fausse | identique à l'ancienne | affichage |
| DEF-STA-16 | Infobulle : montant en mode discret | corrigé dans web/ | affichage |
| DEF-STA-17 | Part du CA négative ou > 100 % | identique à l'ancienne | calcul |
| DEF-STA-18 | Bons rangés par date de saisie | identique à l'ancienne | calcul |
| DEF-STA-19 | Sous-traitant : salutation et bandeau génériques | identique à l'ancienne | affichage |
| DEF-ECR-01 | Rapport sans statut : pastille vide | identique à l'ancienne | affichage |
| DEF-ECR-02 | « 📦 Commandé » n'enregistre pas la date | corrigé dans web/ | données perdues |
| DEF-ECR-03 | Brouillon compté dans le CA (= STA-01) | identique à l'ancienne | calcul |
| DEF-ECR-04 | « Mme Durand · null » (= STA-06) | identique à l'ancienne | affichage |
| DEF-BDD-01 | `prochain_numero` ouvert à une autre société | correction proposée en base | sécurité |
| DEF-BDD-02 | Compte désactivé qui se réactive ; adresse d'un autre | correction proposée en base | sécurité |
| DEF-BDD-03 | Suivi médical, notes et dossiers RH lisibles par tous | correction proposée en base | sécurité |
| DEF-BDD-04 | Seau `terrain` : fichiers d'autrui lisibles et inscriptibles | correction proposée en base | sécurité |
| DEF-BDD-05 | Facture numérotée à la main, hors série et sans ligne | correction proposée en base | sécurité |
| DEF-BDD-06 | Lignes d'un bon facturé modifiables | correction proposée en base | sécurité |
| DEF-BDD-07 | Bon créé directement « chiffré » | correction proposée en base | sécurité |
| DEF-BDD-08 | Un bon facturé deux fois | correction proposée en base | sécurité |
| DEF-BDD-09 | Le rôle lecture supprime dans les tables filles | correction proposée en base | sécurité |
| DEF-BDD-10 | La secrétaire exclue de ce que la matrice lui donne (devis compris) | correction proposée en base | données perdues |
| DEF-BDD-11 | Le technicien écrit achats, affectations, DPGF, référentiels | correction proposée en base | sécurité |
| DEF-BDD-12 | L'admin ne relit pas le chantier qu'il crée | correction proposée en base | données perdues |
| DEF-BDD-13 | Le sous-traitant lit les tâches et bons de ses confrères | correction proposée en base | sécurité |
| DEF-BDD-14 | Journal du circuit falsifiable | correction proposée en base | sécurité |
| DEF-BDD-15 | Fonctions de déclencheur exécutables par tous ; annuaire sans barrière | correction proposée en base | sécurité |
| DEF-BDD-16 | `v_facture_solde` : avoirs dus, acomptes ignorés | correction proposée en base | calcul |
| DEF-BDD-17 | Règlements imputés par l'écran, pas par la base | correction proposée en base | calcul |
| DEF-BDD-18 | Supprimer un brouillon de situation : DPGF rendu, facture debout | correction proposée en base | données perdues |
| DEF-BDD-19 | Avoir en deux appels, cumul non borné | correction proposée en base | calcul |
| DEF-BDD-20 | Imputation d'avoir retirée à moitié | correction proposée en base | calcul |
| DEF-BDD-21 | Préfixes « BON-2027 » et « NOT- » | correction proposée en base | affichage |
| DEF-BDD-22 | Champs du chantier sans colonne | correction proposée en base | données perdues |
| DEF-BDD-23 | Le sous-traitant ne peut pointer aucune tâche | correction proposée en base | données perdues |
| DEF-BDD-24 | Photos du terrain illisibles, effaçables par le rôle lecture | correction proposée en base | données perdues |
| DEF-BDD-25 | Rapports : sous-traitant lit les internes ; lien au bon sans colonne | correction proposée en base | sécurité |
| DEF-BDD-26 | Téléphone de l'occupant jamais servi au terrain | correction proposée en base | affichage |
| DEF-BDD-27 | Prêts sans durée, deux prêts en cours, suppression par lecture | correction proposée en base | données perdues |
| DEF-BDD-28 | Espace client inexistant en base | correction proposée en base | sécurité |
| DEF-BDD-29 | Fériés d'Alsace-Moselle sans réglage | correction proposée en base | affichage |
| DEF-BDD-30 | « Fait » de la cloche réservé aux réglages | correction proposée en base | données perdues |
| DEF-COR-01 | Achats du chantier jamais relus (erreur 42703) | corrigé dans web/ | données perdues |
| DEF-COR-02 | DPGF, avancements et to-do perdus au rechargement | corrigé dans web/ | données perdues |
| DEF-COR-03 | Bon né du DPGF : lien perdu, conducteur vide, tâche en double | corrigé dans web/ | données perdues |
| DEF-COR-04 | Fichiers du chantier en data-URL | corrigé dans web/ | données perdues |
| DEF-COR-05 | DPGF : saisies perdues, « Planifier » muet, « 2,5 » lu 2 | corrigé dans web/ | données perdues |
| DEF-COR-06 | Ligne de DPGF facturée encore modifiable ou remplacée | corrigé dans web/ | calcul |
| DEF-COR-07 | Achats, to-do : échecs d'écriture muets | corrigé dans web/ | données perdues |
| DEF-COR-08 | Situation de travaux : flottant, avancement avant la facture | corrigé dans web/ | calcul |
| DEF-COR-09 | Montants en flottant (1,005 € → 1,00 €) | corrigé dans web/ | calcul |
| DEF-COR-10 | Reste d'une facture à acomptes ou d'un avoir | corrigé dans web/ | calcul |
| DEF-COR-11 | Statut payé/impayé et règlement groupé tenus par l'écran | corrigé dans web/ | calcul |
| DEF-COR-12 | Avoir, imputation, suppression de situation en plusieurs requêtes (ancien à vérifier) | corrigé dans web/ | données perdues |
| DEF-COR-13 | « Émettre » enregistre d'abord la saisie (ancien à vérifier) | corrigé dans web/ | données perdues |
| DEF-COR-14 | Acheteur rattaché par le nom ; SIRET d'un autre client gardé | corrigé dans web/ | données perdues |
| DEF-COR-15 | Listes de règlement : brouillons à 0, « ✎ Modifier » muet | corrigé dans web/ | affichage |
| DEF-COR-16 | Aucun geste pour changer le statut d'un devis | corrigé dans web/ | affichage |
| DEF-COR-17 | Chapitres homonymes fusionnés | corrigé dans web/ | calcul |
| DEF-COR-18 | Hors circuit : travaux chiffrés hors chapitre ; chiffrage sans quantité | corrigé dans web/ | calcul |
| DEF-COR-19 | File Validation : compteur faux, circuits clos | corrigé dans web/ | affichage |
| DEF-COR-20 | Pièce commandée : une seule tâche, échec ignoré | corrigé dans web/ | données perdues |
| DEF-COR-21 | Case « Métiers réalisés » qui n'enregistre rien | corrigé dans web/ | données perdues |
| DEF-COR-22 | Boutons proposés que la base refuse | corrigé dans web/ | affichage |
| DEF-COR-23 | Téléphone du locataire écrit, jamais relu | corrigé dans web/ | données perdues |
| DEF-COR-24 | « reçue le 25T16:29:20…/09/2026 » | corrigé dans web/ | affichage |
| DEF-COR-25 | Planning : tâches et journées mal tenues au placement | corrigé dans web/ | données perdues |
| DEF-COR-26 | « Date faite » sans colonne ; « Terminée le » jamais effacée | corrigé dans web/ | données perdues |
| DEF-COR-27 | Photos du terrain perdues | corrigé dans web/ | données perdues |
| DEF-COR-28 | Rapport : brouillon imprimé, contrôles perdus, IA sans clé | corrigé dans web/ | données perdues |
| DEF-COR-29 | Prêts et entretiens perdus | corrigé dans web/ | données perdues |
| DEF-COR-30 | Date de contrôle technique jamais conservée | corrigé dans web/ | données perdues |
| DEF-COR-31 | Carte carburant : un code PIN fait refuser la fiche | corrigé dans web/ | données perdues |
| DEF-COR-32 | Factures d'achat et d'entretien du véhicule perdues | corrigé dans web/ | données perdues |
| DEF-COR-33 | Vente de véhicule : acheteur en texte libre | corrigé dans web/ | données perdues |
| DEF-COR-34 | Absences perdues, solde faux | corrigé dans web/ | données perdues |
| DEF-COR-35 | Documents de sous-traitant perdus | corrigé dans web/ | données perdues |
| DEF-COR-36 | Fiche conducteur retirée réactivée | corrigé dans web/ | données perdues |
| DEF-COR-37 | Seuils d'alerte codés en dur ; cloche en double | corrigé dans web/ | affichage |
| DEF-COR-38 | Conducteur ou fournisseur supprimé au lieu d'être retiré | corrigé dans web/ | données perdues |
| DEF-COR-39 | Logo et documents légaux en data-URL | corrigé dans web/ | données perdues |
| DEF-COR-40 | Préfixe de numérotation à tiret accepté | corrigé dans web/ | affichage |
| DEF-COR-41 | Code de référentiel sans accents | corrigé dans web/ | affichage |
| DEF-COR-42 | « Fait » de la cloche refusé au terrain | corrigé dans web/ | données perdues |
| DEF-COR-43 | « 1,5 » saisi lu 1 | corrigé dans web/ | calcul |
| DEF-COR-44 | « …alors que le pays est . » | corrigé dans web/ | affichage |
| DEF-COR-45 | Catalogue : virgule qui casse la recherche, familles tronquées | corrigé dans web/ | affichage |
| DEF-COR-46 | Listes tronquées sans le dire | corrigé dans web/ | données perdues |
| DEF-COR-47 | Messages d'erreur en anglais | corrigé dans web/ | affichage |
| DEF-COR-48 | La recherche perd le focus | corrigé dans web/ | affichage |
| DEF-COR-49 | Rapport de rejets nommé `.pdf` | corrigé dans web/ | affichage |
| DEF-COR-50 | Import de clients qui efface des champs | corrigé dans web/ | données perdues |
| DEF-COR-51 | Restauration de sauvegarde sans garde de rôle | corrigé dans web/ | sécurité |
| DEF-COR-52 | Factures de sous-traitant hors série, payées sans règlement | corrigé dans web/ | calcul |
| DEF-COR-53 | Portail client mort | corrigé dans web/ | sécurité |
| DEF-COR-54 | Réf. de bon client figée vide sans avertissement | corrigé dans web/ | affichage |
| DEF-COR-55 | « Mon nom » inaccessible au terrain | corrigé dans web/ | affichage |
| DEF-COR-56 | Ordre des listes au gré de la base | corrigé dans web/ | affichage |
| DEF-REP-01 | Import d'articles : `1e3`, `0x10`, « 1 200,00 » | identique à l'ancienne | calcul |
| DEF-REP-02 | Import de DPGF : « 1.234 » lu 1,234 | identique à l'ancienne | calcul |
| DEF-REP-03 | `articles.metier` ni saisi ni recopié | identique à l'ancienne | affichage |
| DEF-REP-04 | Pièces imprimées : « 5.5% », avoir positif, SAV « BON DE COMMANDE » | identique à l'ancienne | affichage |
| DEF-REP-05 | Nom du client absent des cartes de chantier | identique à l'ancienne | affichage |
| DEF-REP-06 | Sous-traitant non invitable | identique à l'ancienne | affichage |
| DEF-REP-07 | Matériel : message « vide » même sur recherche | identique à l'ancienne | affichage |
| DEF-REP-08 | Pré-facture : montants hors mode discret | identique à l'ancienne | affichage |
| DEF-REP-09 | Textes périmés du cadre et de « nouveau mot de passe » | identique à l'ancienne | affichage |
| DEF-REP-10 | Deux statuts pour un bon | identique à l'ancienne | affichage |
| DEF-REP-11 | `extraire-bc` sans authentification | identique à l'ancienne | sécurité |
| DEF-REP-12 | Fonctions PDP : rôle non vérifié, secret comparé par `!==` | identique à l'ancienne | sécurité |
| DEF-REP-13 | `inviter-salarie` : une seule page de 50 comptes | identique à l'ancienne | affichage |
| DEF-REP-14 | `bc_generer_facture` : virement forcé, TVA 10, sans conducteur | identique à l'ancienne | calcul |
| DEF-REP-15 | Deux onglets, deux bons depuis le même devis | identique à l'ancienne | données perdues |
| DEF-REP-16 | Client ou conducteur d'une autre société sur un bon | identique à l'ancienne | sécurité |
| DEF-REP-17 | Le terrain crée une fiche conducteur ou fournisseur | identique à l'ancienne | sécurité |
| DEF-REP-18 | Clients, véhicules, annuaire lisibles par le sous-traitant | identique à l'ancienne | sécurité |
| DEF-REP-19 | Sept factures restées dans `kv_store` | identique à l'ancienne | données perdues |
| DEF-REP-20 | Niveau d'abonnement non opposable | identique à l'ancienne | sécurité |

## Statistiques et tableaux de bord

Décision : D-STA-A-01. Chaque défaut ci-dessous a son cas nommé dans
`tests/parite/statistiques.essai.ts` (source de `app.js` évaluée, comparaison au flottant près) et
dans `src/modules/statistiques/domain/domaine.essai.ts`. **Corrections disponibles** : l'état
corrigé complet du module est celui du commit `3f534d0` (`git show 3f534d0:web/src/modules/statistiques/…`),
avec la proposition `supabase/propositions/retirees/20260926080000_statistiques_de_pilotage.sql`
(fonctions `stats_*`) à remettre dans `supabase/propositions/` ; les décisions D-STA-01 à D-STA-11
décrivent chaque correction.

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

### DEF-STA-03 — Restant dû et taux d'encaissement comptent les brouillons
- **Écrans** : Accueil — « Factures impayées … restant dû », « Taux d'encaissement » du résumé.
- **Reproduire** : `admin.alpha` → noter le restant dû. Créer une facture de 500 € HT (TVA 20 %) en
  brouillon : le restant dû prend 600 €, et le taux d'encaissement baisse. Une facture au statut
  « payée » **sans règlement** (hors reprise « compta: ») compte aussi comme due.
- **Ancienne** : restant dû = Σ des restes calculés sur les règlements de toutes les factures non-avoir,
  brouillons compris ; taux = 1 − restant dû / Σ TTC de TOUTES les pièces (brouillons, acomptes).
- **Juste** : seules les pièces émises doivent ; dénominateur sur les pièces émises.
- **Correction existante** : D-STA-11 (`v_facture_solde`, `stats_indicateurs.impayes / ttc_emis`).

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

### DEF-STA-05 — « Locataires à rappeler » relance des affaires closes
- **Écran** : Accueil (pilotage) — « À traiter ».
- **Reproduire** : `admin.alpha` → un bon avec un rappel à aujourd'hui, puis le clore sans facturation
  (ou le chiffrer) : il reste compté dans « Locataires à rappeler ». Le tableau du conducteur, lui, ne
  le compte plus.
- **Ancienne** : tout bon dont la date de rappel est passée ou du jour.
- **Juste** : seulement un bon encore ouvert (même règle que le tableau du conducteur).
- **Correction existante** : D-STA-06 (`aTraiterPilotage`, commit `3f534d0`).

### DEF-STA-06 — Activité récente : « · null » et lettrages présentés comme des paiements
- **Écran** : Accueil — « Activité récente ».
- **Reproduire** : `secretaire.alpha` → créer une facture et la laisser en brouillon : la ligne
  « Facture créée » se lit « Client · null ». Imputer un avoir sur une facture : deux lignes
  « Paiement reçu » apparaissent (l'une sur la facture, l'autre sur l'avoir, du même montant), alors
  qu'aucun argent n'est entré.
- **Ancienne** : le numéro absent est écrit « null » ; tout règlement, lettrage compris, est un paiement.
- **Juste** : pas de « null » ; un lettrage d'avoir n'est pas un paiement reçu.
- **Correction existante** : `stats_activite_recente` (commit `3f534d0`, D-STA-04).

### DEF-STA-07 — Top clients : par le nom écrit sur la facture
- **Écran** : Accueil — « Top clients (HT) ».
- **Reproduire** : `admin.alpha` → deux factures pour le même client dont le nom est écrit
  différemment sur la pièce (« OPAC du Rhône » / « OPAC du Rhone ») : deux lignes au classement. Une
  facture sans nom de client : une ligne sans nom.
- **Ancienne** : groupé par `client_nom` de la pièce, toutes factures (DEF-STA-01).
- **Juste** : groupé par la fiche client (`client_id`), le nom à défaut.
- **Correction existante** : D-STA-05 (`stats_par_client`).

### DEF-STA-08 — Statistiques groupées par l'étiquette du conducteur
- **Écran** : Statistiques — tableau et graphiques par conducteur.
- **Reproduire** : `admin.alpha` → Statistiques, « Tout l'historique ». Une pièce reprise dont
  l'étiquette `conducteur` porte une autre graphie que la fiche (données historiques) fait une ligne à
  part ; un bon sans conducteur n'apparaît nulle part (pas de ligne « Sans conducteur ») ; une fiche de
  conducteur sans aucune pièce a sa ligne, à zéro.
- **Ancienne** : une ligne par NOM (fiches, puis étiquettes des bons, devis et factures de la période).
- **Juste** : par la référence `conducteur_id`, le nom de la fiche, et une ligne « Sans conducteur ».
- **Correction existante** : D-STA-05 (`stats_par_conducteur`).

### DEF-STA-09 — « En retard » compte les bons facturés, clos ou terminés
- **Écran** : Statistiques — colonnes « Dans les temps » / « En retard », graphique « dans les temps /
  en retard ».
- **Reproduire** : `admin.alpha` → un bon avec une date de fin de travaux passée, entièrement réalisé,
  chiffré puis facturé : il reste « en retard » pour toujours.
- **Ancienne** : en retard = date de fin de travaux < aujourd'hui, quel que soit l'état du bon ; dans les
  temps = tous les autres (bons sans date compris).
- **Juste** : fin de travaux dépassée sur un bon encore ouvert.
- **Correction existante** : D-STA-05 (`stats_bon_ouvert`).

### DEF-STA-10 — Barre rouge pleine pour un conducteur sans bon
- **Écran** : Statistiques — graphique « Bons de commande — dans les temps / en retard ».
- **Reproduire** : `admin.alpha` → une fiche de conducteur qui n'a aucun bon sur la période (choisir
  « Ce mois-ci ») : sa barre est entièrement rouge, avec « 0 / 0 ».
- **Ancienne** : 0 dans les temps sur « 1 » → 0 %, donc 100 % en retard.
- **Juste** : pas de barre (ou une barre neutre) quand il n'y a aucun bon.
- **Correction existante** : aucune (la version précédente de `web/` avait le même défaut).

### DEF-STA-11 — Travaux supplémentaires toujours à zéro
- **Écran** : Statistiques — colonne « Travaux supplémentaires », barre « Travaux suppl. ».
- **Reproduire** : `admin.alpha` → signaler un travail supplémentaire sur un bon (planning, fiche de
  pointage), le chiffrer : la colonne reste « 0% (0) — 0,00 € ».
- **Ancienne** : lit `travauxSupplementaires` sur le bon, un champ qu'aucune colonne ne porte.
- **Juste** : lire `tache_travaux_supplementaires` (nombre hors refusés, montant des chiffrés).
- **Correction existante** : D-STA-05 (`stats_par_conducteur.travaux / travaux_ht`).

### DEF-STA-12 — Un locataire n'est jamais « injoignable »
- **Écran** : Accueil du conducteur — « Locataires à contacter ».
- **Reproduire** : `conducteur.alpha` → un de ses bons sans rendez-vous ; noter trois tentatives
  d'appel (planning, « Contacts ») : la ligne ne dit jamais « 1 injoignable après 3 tentatives ».
- **Ancienne** : `parseInt` du tableau des tentatives → NaN → 0.
- **Juste** : compter les tentatives du tableau.
- **Correction existante** : STA-20 (`nombreDeTentatives` qui compte le tableau, commit `3f534d0`).

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

### DEF-STA-14 — Tableau du sous-traitant : deux tuiles toujours à zéro
- **Écran** : Accueil du sous-traitant.
- **Reproduire** : `soustraitant.alpha` → « Mes devis » et « Mes factures impayées » valent 0 quoi qu'il
  arrive ; « Factures ALPHA prêtes » compte ses bons validés avec un montant sous-traitant, mais aucun
  écran ne permet d'établir ces factures (D-FAC-09).
- **Ancienne** : les champs `sousTraitantEmetteur` des devis et factures n'ont pas de colonne.
- **Juste** : lui montrer sa journée (le tableau du terrain), puisque devis et factures de
  sous-traitant n'existent pas.
- **Correction existante** : D-STA-09 (tableau du terrain pour le sous-traitant, commit `3f534d0`).

### DEF-STA-15 — Graphique sur 12 mois : l'année de l'infobulle est fausse
- **Écran** : Accueil — graphique « Chiffre d'affaires (HT) », période « 12 mois ».
- **Reproduire** : `admin.alpha` → survoler la barre d'un mois de l'an dernier (par exemple octobre
  quand on est en septembre) : l'infobulle annonce « octobre 2026 » au lieu de « octobre 2025 »
  (et « octobre 2025 » pour la barre grise, au lieu de 2024).
- **Ancienne** : l'année de la dernière barre est appliquée à toutes.
- **Juste** : l'année de chaque mois.
- **Correction existante** : `GraphiqueCA.tsx` du commit `3f534d0` (`p.annee`).

### DEF-STA-16 — L'infobulle du graphique montre les montants en mode discret
- **Écran** : Accueil — graphique, mode discret activé.
- **Reproduire** : activer le mode discret, survoler une barre : l'ancienne affiche le montant en clair.
- **Ancienne** : `money()` au lieu de `moneyDisplay()` dans l'infobulle.
- **Juste** : « ••• € ».
- **Dans `web/`** : NON reproduit — le mode discret masque tout montant d'écran (TRV-05, garde-fou
  `tests/garde-fous.essai.ts`). À trancher : reproduire le défaut ou garder le masque.

### DEF-STA-17 — La part du chiffre d'affaires ignore les avoirs… à l'envers
- **Écran** : Statistiques — « Répartition du chiffre d'affaires ».
- **Reproduire** : `admin.alpha` → un conducteur dont les avoirs dépassent les factures sur la période
  (« Ce mois-ci ») : sa part est négative, et celles des autres dépassent 100 % au total ; sa barre
  n'a pas de largeur valable.
- **Ancienne** : `Math.round(ca / total × 100)` sur un total qui compte les négatifs.
- **Juste** : ne répartir que les chiffres d'affaires positifs.
- **Correction existante** : `repartition()` de `domain/statistiques.ts` du commit `3f534d0`.

### DEF-STA-18 — Les bons se rangent dans la période par leur date de SAISIE
- **Écran** : Statistiques — tuile « Bons de commande », colonnes par conducteur, période « Cette année »
  ou « Ce mois-ci ».
- **Reproduire** : `admin.alpha` → saisir aujourd'hui un bon reçu le mois dernier (date de réception du
  mois dernier) : il compte dans « Ce mois-ci », quand devis et factures se rangent par leur date.
- **Ancienne** : bons filtrés sur `cree_le` ; devis et factures sur `date`.
- **Juste** : à décider (date du bon ou de réception).
- **Correction existante** : aucune (la proposition retirée filtrait elle aussi sur `cree_le`).

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

### DEF-ECR-03 — Tableau de bord et Statistiques : un brouillon compte dans le chiffre d'affaires
Même défaut que **DEF-STA-01** (reproduction et correction y sont décrites). Depuis D-STA-A-01, la
nouvelle le reproduit à l'identique : un brouillon chiffré augmente « Total période » et la colonne du
mois de Statistiques dans les deux applications.

### DEF-ECR-04 — Tableau de bord : la création d'un brouillon s'écrit « Mme Durand · null »
Même défaut que **DEF-STA-06** (reproduction et correction y sont décrites). Depuis D-STA-A-01, la
nouvelle écrit elle aussi « Mme Durand · null ».

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
correction. Le défaut lui-même se voit en faisant tourner le même test contre une base qui n'a pas
la proposition — il échoue. Cela n'a été **vérifié** que pour les n° 2, 8, 21, 30 (insert … select
d'un chantier) et 35 (mentions « échoue contre la base actuelle (vérifié) » de
`migrations-proposees.md`) ; pour les autres, l'échec sans la proposition est annoncé par l'en-tête
des fichiers de test mais **à vérifier** (tâche « Faire tourner les tests RLS aussi SANS les
propositions » du rapport, non faite). Commande : `npm run test:rls` (dans `web/`, base locale
démarrée).

### DEF-BDD-01 — `prochain_numero()` sert une autre société
- **Risque** : `peut_ecrire()` rend NULL pour un non-membre ; `if not peut_ecrire(...)` laisse alors
  passer : un compte d'une AUTRE société (ou un client) consomme et lit la série de devis.
- **Constater** : `tests/rls/numerotation.essai.ts`, « [proposition] prochain_numero ne sert que les
  membres autorisés » (échoue contre la fonction actuelle — vérifié).
- **Proposition** : n° 2, `20260925015000_peut_ecrire_ne_rend_jamais_null.sql`.

### DEF-BDD-02 — Un compte désactivé se réactive ; chacun prend l'adresse d'un autre
- **Risque** : `profiles_update_self` sans restriction de colonne : un compte coupé
  (`profiles.actif = false`) se réactive par un PATCH de son profil ; chacun s'attribue l'adresse
  d'un autre (annuaire, `inviter-salarie`). Politique SELECT en double (AUTH-74).
- **Constater** : `tests/rls/comptes.essai.ts`, « [proposition] un compte ne touche pas à son propre
  `actif`… », « [proposition] un compte ne s'attribue pas l'adresse d'un autre… » (échouent contre
  la base actuelle — vérifié).
- **Proposition** : n° 8, `20260926010000_profil_seul_le_nom_se_modifie.sql` — D-SOC-09.

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

### DEF-BDD-04 — Seau `terrain` : le terrain lit et dépose hors de ses affaires
- **Risque** : la lecture du seau ne se juge que par société : un technicien ou un sous-traitant qui
  connaît un chemin lit le document d'un chantier où il n'est pas affecté, le dossier RH d'un
  collègue, la photo d'un confrère ; l'écriture est aussi large.
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] seau terrain : le terrain ne lit
  que ses fichiers » ; `tests/rls/politiques.essai.ts`, « relecture 4 — I3 ».
- **Proposition** : n° 23, `20260926100000_le_terrain_ne_lit_que_ses_fichiers.sql` (dépend des n° 16
  et 18) — D-TRV-02, D-SQL-06.

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

### DEF-BDD-06 — Les lignes d'un bon facturé restent modifiables
- **Risque** : `bon_commande_facture_fige` protège l'en-tête d'un bon facturé, pas ses lignes : un
  conducteur les modifie, supprime ou complète après émission de la facture.
- **Constater** : `tests/rls/commandes.essai.ts`, « les lignes d'un bon dont la facture est émise sont
  figées ; en brouillon, non (I3) » ; `tests/rls/politiques.essai.ts`, « relecture 4 — I8 ».
- **Proposition** : n° 6, `20260925050000_les_lignes_d_un_bon_facture_sont_figees.sql` — D-SQL-07.
  **À contrôler avant** : la requête des positions non contiguës (`migrations-proposees.md`, n° 6) —
  l'enregistrement de ces bons échouerait dans l'ancien écran.

### DEF-BDD-07 — Un bon peut naître directement « chiffré »
- **Risque** : `circuit_etat_reserve` ne veille qu'à l'UPDATE : un INSERT saute le circuit.
- **Constater** : `tests/rls/commandes.essai.ts`, « un bon créé « chiffré » naît quand même au début
  du circuit (I4) ».
- **Proposition** : n° 7, `20260925060000_un_bon_nait_au_debut_du_circuit.sql` — D-051 (ramené à
  `en_cours`, pas refusé : l'ancien écran envoie la clé).

### DEF-BDD-08 — Deux onglets facturent deux fois le même bon
- **Risque** : `bc_generer_facture` ne verrouille pas le bon et ne refuse pas un bon déjà facturé.
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] un bon ne se
  facture qu'une fois (I9) » (le cas déterministe échoue contre la fonction actuelle — vérifié ; la
  course elle-même n'est pas reproduite de façon fiable, D-R4-06).
- **Proposition** : n° 35, `20260926133000_le_bon_ne_se_facture_qu_une_fois.sql` — D-R4-06. Relever
  `pg_get_functiondef` en production avant d'appliquer.

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

### DEF-BDD-13 — Le sous-traitant lit les tâches et les bons de ses confrères
- **Risque** : `planning_taches`, `v_bons_commande_terrain`, `v_bon_commande_lignes_terrain` et
  `sous_traitants` lisibles par tout membre : une entreprise extérieure voit le travail, les
  adresses et les téléphones confiés à ses concurrents (AUTH-72).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] tâches du sous-traitant » ;
  `tests/rls/politiques.essai.ts`, « relecture 4 — I4 et I5 ».
- **Proposition** : n° 25, `20260926102000_le_sous_traitant_ne_lit_que_ses_taches.sql` — D-TRV-04,
  D-SQL-06. Ce qu'elle laisse ouvert : DEF-REP-18.

### DEF-BDD-14 — Le journal du circuit accepte de fausses transitions
- **Risque** : `workflow_journal` accepte l'INSERT de tout membre (AUTH-73).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] journal du circuit » ;
  `tests/rls/circuit.essai.ts` (les RPC écrivent toujours).
- **Proposition** : n° 26, `20260926103000_le_journal_du_circuit_ne_s_ecrit_que_par_le_circuit.sql` —
  D-TRV-05.

### DEF-BDD-15 — Fonctions de déclencheur exécutables par tous ; annuaire sans `security_barrier`
- **Risque** : EXECUTE rendu à PUBLIC sur les fonctions de déclencheur créées après le 24/09
  (AUTH-75) ; `v_salaries_annuaire` a perdu `security_barrier` (AUTH-76, constaté : `reloptions` vide).
- **Constater** : non observable par l'API — contrôle SQL de l'en-tête du fichier (0 ligne attendue)
  et `select reloptions from pg_class where relname = 'v_salaries_annuaire'`.
- **Proposition** : n° 27, `20260926104000_fonctions_de_declencheur_sans_execute_public.sql` —
  D-TRV-06 (à rejouer après toute proposition qui crée un déclencheur ou refait la vue).

### DEF-BDD-16 — `v_facture_solde` fait d'un avoir une dette et ignore les acomptes
- **Risque** : la vue ignore le signe des avoirs (un crédit y est « Impayée » et s'additionne aux
  dettes), teste « Impayée » avant le reste (une facture à 0 € reste due à vie), ignore acomptes et
  retenue, fait redevenir dues les reprises « payées », compte le retard en UTC sur la seule
  échéance (FAC-93).
- **Constater** : `tests/rls/facturation.essai.ts`, « [proposition] v_facture_solde dit vrai » ;
  `tests/rls/politiques.essai.ts`, « relecture 4 — B3 », « relecture 4 — I2 ».
- **Proposition** : n° 12, `20260926040000_le_solde_d_une_facture_dit_vrai.sql` (s'arrête d'elle-même
  si la définition vivante diffère) — D-FAC-01, D-SQL-03, D-SQL-04. Côté écran de `web/` : DEF-COR-10.

### DEF-BDD-17 — Les règlements sont imputés par l'écran, pas par la base
- **Risque** : statut payé/impayé recalé par l'écran après chaque règlement ; règlement groupé
  découpé à l'écran puis inséré facture par facture (un échec au milieu laisse un virement à
  moitié imputé) ; lettrage d'avoir contrôlé seulement à l'écran.
- **Constater** : `tests/rls/facturation.essai.ts`, « [proposition] le statut stocké suit les
  règlements (déclencheur) », « [proposition] enregistrer_reglement_groupe… », « [proposition]
  imputer_avoir… » ; `tests/rls/politiques.essai.ts`, « M6 ».
- **Proposition** : n° 13, `20260926041000_les_reglements_s_imputent_en_base.sql` — D-FAC-02. Côté
  écran de `web/` : DEF-COR-11.

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

### DEF-BDD-19 — L'avoir s'établit en deux appels, sans borne
- **Risque** : créer puis émettre en deux appels laisse un avoir brouillon orphelin à chaque échec
  d'émission ; rien ne borne le cumul (deux onglets = deux avoirs totaux).
- **Origine** : risque relevé sur l'écran de `web/` à la relecture 4 ; la base n'offre pas le
  geste d'un seul tenant, mais l'enchaînement de l'ancien écran est **à vérifier** (DEF-COR-12).
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] établir un avoir
  d'un seul geste (I6) ».
- **Proposition** : n° 33, `20260926131000_l_avoir_s_etablit_d_un_seul_geste.sql` — D-R4-04.

### DEF-BDD-20 — « Retirer » une imputation d'avoir n'en supprime qu'une moitié
- **Risque** : facture redevenue due avec le crédit resté consommé, ou l'inverse.
- **Origine** : risque relevé sur l'écran de `web/` à la relecture 4 ; la base n'offre pas le
  geste d'un seul tenant, mais l'enchaînement de l'ancien écran est **à vérifier** (DEF-COR-12).
- **Constater** : `tests/rls/transactions-facturation.essai.ts`, « [proposition] annuler une
  imputation : les deux moitiés ensemble (I8) ».
- **Proposition** : n° 34, `20260926132000_une_imputation_s_annule_entiere.sql` — D-R4-05.

### DEF-BDD-21 — Bons « BON-2027-… », notes de frais « NOT-… »
- **Risque** : le préfixe « BC » n'existe que par une ligne `compteurs` de 2026 : en 2027 les bons
  naîtraient « BON-2027-… » (BC-94) ; une note de frais sort « NOT-… » (FAC-98).
- **Constater** : `tests/rls/circuit.essai.ts`, « [proposition] préfixe des bons (BC-94) » ;
  `tests/rls/facturation.essai.ts`, « [proposition] préfixes de numérotation complets ». La base
  locale le montre déjà : un bon créé localement reçoit `BON-2026-…` (D-046).
- **Propositions** : n° 11 et 15 (`20260926030000`, `20260926043000`, appliquer la 15 APRÈS la 11) —
  D-FAC-07.

### DEF-BDD-22 — Ce que l'écran chantier saisit n'a pas de colonne
- **Risque** : `chantiers.statut`, `notes`, cinq champs PPSPS, `chantier_comptes_rendus.vu`,
  `chantier_dpgf_lignes.metier` n'existent pas : saisis puis perdus en silence.
- **Constater** : `tests/rls/chantiers.essai.ts`, « [proposition] les champs saisis ont leur colonne ».
- **Proposition** : n° 9, `20260926020000_le_chantier_garde_ce_que_l_ecran_saisit.sql` — D-CHA-09
  (côté ancien : une entrée `SNAKE_OVERRIDES` pour `ppspsCoordinateurSPS`).

### DEF-BDD-23 — Le sous-traitant ne peut pointer aucune de ses tâches
- **Risque** : `est_de_l_equipe` ignore le sous-traitant : « Valider les travaux » lui est proposé,
  la base refuse ; pas de montant « Votre montant » sans ouvrir la vue ; pas de travail
  supplémentaire sur ses bons. Le terrain peut aussi poser un prix sur un signalement (B2).
- **Constater** : `tests/rls/planning.essai.ts`, « [proposition] sous-traitant, photos et téléphone
  du terrain » (« le sous-traitant pointe les tâches de SON entreprise… », « …lit SON montant… »,
  « …signale un travail supplémentaire sur son bon… ») ; `tests/rls/politiques.essai.ts`,
  « relecture 4 — B2 ».
- **Proposition** : n° 16, `20260926050000_le_sous_traitant_pointe_ses_taches.sql` — D-PLN-05, D-SQL-05.

### DEF-BDD-24 — Photos du terrain illisibles au terrain, effaçables par le rôle lecture
- **Risque** : `bon_commande_photos` vérifie la société par une sous-requête sur `bons_commande`,
  illisible au terrain ; suppression ouverte au rôle lecture ; seau fermé au sous-traitant.
- **Constater** : `tests/rls/planning.essai.ts`, « le technicien dépose et lit une photo du bon ; le
  rôle lecture ne peut pas l'effacer ».
- **Proposition** : n° 17, `20260926051000_les_photos_du_terrain.sql` — D-PLN-06. Côté écran : DEF-COR-27.

### DEF-BDD-25 — Rapports : le sous-traitant lit les rapports internes
- **Risque** : aucun filtre sous-traitant (PLN-52) ; lien au bon, émetteur sous-traitant, signature
  du technicien sans colonne ; numéro posé par l'écran.
- **Constater** : `tests/rls/interventions.essai.ts`, « [proposition] émetteur sous-traitant et
  visibilité (PLN-52) », « [proposition] un rapport par bon (PLN-20) », « [proposition] le technicien
  rédige… » ; `tests/rls/politiques.essai.ts`, « M3 ».
- **Proposition** : n° 18, `20260926052000_rapports_d_intervention_complets.sql` (dépend du n° 16) —
  D-PLN-07 (sans elle, `web/` lit sans ces colonnes et refuse le lien au bon en le disant).

### DEF-BDD-26 — Le téléphone de l'occupant n'arrive jamais au terrain
- **Risque** : la vue terrain ne sert pas `telephone_locataire` (BC-93) : le lien `tel:` de la carte
  ne s'affiche jamais.
- **Constater** : `tests/rls/planning.essai.ts`, « le terrain lit le téléphone de l'occupant, que la
  vue ne sert pas ».
- **Proposition** : n° 19, `20260926053000_le_terrain_joint_le_locataire.sql` — D-PLN-10.

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

### DEF-BDD-28 — Pas d'espace client en base
- **Risque** : aucun rôle ni politique pour un client ; le portail de l'ancien écran est mort
  (ESP-30). Les propositions l'ouvrent en lecture seule ; sans les droits retirés sur les vues, tout
  compte aurait pu créer un chantier chez une autre société (relecture 4, B1).
- **Constater** : `tests/rls/espace-client.essai.ts`, `tests/rls/espace-client-bons.essai.ts`,
  `tests/rls/transversal.essai.ts` (« [proposition] accès clients gérés par l'administrateur »),
  `tests/rls/politiques.essai.ts` (« relecture 4 — B1 »).
- **Propositions** : n° 4, 14, 29 — D-008, D-029, D-FAC-10, D-TRV-08, D-SQL-01. Non tranchés : M4, M7
  (`migrations-proposees.md`, relecture 4).

### DEF-BDD-29 — Rien ne dit qu'une société est en Alsace-Moselle
- **Risque** : Vendredi saint et 26 décembre absents du planning (PLN-53).
- **Constater** : `tests/rls/transversal.essai.ts`, « [proposition] Alsace-Moselle ».
- **Proposition** : n° 28, `20260926105000_jours_feries_d_alsace_moselle.sql` — D-TRV-07.

### DEF-BDD-30 — « Fait » de la cloche réservé à qui modifie les réglages
- **Risque** : l'ancien range `notifsTraitees` dans `societe_settings.infos_entreprise`, que seul
  « réglages / modifier » écrit : un conducteur ou un technicien qui coche « fait » échoue, et chaque
  coche réécrit tout le JSON des réglages.
- **Constater** : `tests/rls/notifications.essai.ts`, « [proposition] notifications traitées par
  société ».
- **Proposition** : n° 31, `20260926120000_notifications_traitees_par_societe.sql` (reprise des clés
  existantes par un INSERT) — D-CLI-05. Côté écran : DEF-COR-42.

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

### DEF-COR-07 — Achats, to-do : un échec d'écriture ne se dit pas
- **Écran** : Chantiers › fiche (achats, to-do…).
- **Reproduire (ancienne)** : `lecture.alpha` (ou une coupure réseau) → tenter d'ajouter un point de
  to-do : aucun message.
- **Ancienne** : retours d'écriture ignorés, `catch` muets (`app.js` 13566, 13733, 13880 — CHA-54).
- **Nouvelle** : chaque écriture affiche son erreur et relit la table (`useFiche#useEcriture`).
- **Décision** : INVENTAIRE CHA-54 (règle du dépôt : aucun `catch` muet).
- **Revenir à l'identique** : non recommandé ; il faudrait taire les erreurs dans
  `modules/chantiers/hooks`.

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

### DEF-COR-16 — Aucun geste pour passer un devis à « envoyé », « accepté », « refusé »
- **Écran** : Devis › formulaire d'un devis existant.
- **Reproduire (ancienne)** : `admin.alpha` → ouvrir un devis : aucun champ ni bouton de statut ; le
  statut reste « brouillon », alors que le tableau de bord compte les devis « envoyé ».
- **Ancienne** : statut reconduit, jamais modifiable (DEV-22, DEV-51).
- **Nouvelle** : champ « Statut » dans la grille « Client & contact », sous `devis / modifier`.
- **Décision** : D-021, D-ECR-FAC-10.
- **Revenir à l'identique** : retirer le champ de `devis/components/PageEditionDevis.tsx`.

### DEF-COR-17 — Deux chapitres homonymes n'ont qu'un sous-total
- **Écran** : Devis, Factures, Bons (lignes et pièces imprimées).
- **Reproduire (ancienne)** : `admin.alpha` → un devis avec deux chapitres « Plomberie » séparés :
  les sous-totaux sont fusionnés.
- **Ancienne** : `devisChapterTotals` groupe par nom (`app.js:2820` — DEV-53).
- **Nouvelle** : sous-totaux par position (`documents/domain/totaux.ts#sousTotauxChapitres`).
- **Décision** : INVENTAIRE DEV-53 (pas de D- dédiée — à vérifier si une décision doit la porter).
- **Revenir à l'identique** : grouper par nom dans `sousTotauxChapitres`.

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

### DEF-COR-21 — Case « Métiers réalisés » qui n'enregistre rien
- **Écran** : Bons › carte dépliée.
- **Reproduire (ancienne)** : `conducteur.alpha` → cocher un métier réalisé → recharger : décoché.
- **Ancienne** : `toggleBCMetierFait` (`app.js:8353`) écrit `metiersFait`, sans colonne (BC-90).
- **Nouvelle** : pas de case ; l'état par métier se lit sur les tâches (panneau du circuit).
- **Décision** : D-BC-08.
- **Revenir à l'identique** : remettre une case sans effet durable.

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

### DEF-COR-24 — « reçue le 25T16:29:20.875085+00:00/09/2026 »
- **Écran** : Planning › colonne « Non planifiés » (pièce reçue).
- **Reproduire (ancienne)** : `admin.alpha` → un bon dont la pièce a été reçue (« ✓ Pièce arrivée »)
  → Planning : la ligne de la pièce.
- **Ancienne** : `pieceAttendueLigne` passe l'horodatage `piece_recue_le` à `fmtDate`
  (`app.js:9432`).
- **Nouvelle** : « reçue le 25/09/2026 ».
- **Décision** : D-ECR-PLN-05.
- **Revenir à l'identique** : formater l'horodatage brut comme l'ancien.

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

### DEF-COR-27 — Photos du terrain perdues à l'enregistrement
- **Écran** : Planning › fiche d'intervention (photos).
- **Reproduire (ancienne)** : `technicien.alpha` → ajouter une photo à une intervention → enregistrer
  → recharger : la photo a disparu.
- **Ancienne** : `technicienPhotos` sans colonne.
- **Nouvelle** : photo au seau `terrain` + ligne `bon_commande_photos`, écrite dès l'ajout.
- **Décision** : D-PLN-06, D-ECR-PLN-06 ; proposition n° 17 (DEF-BDD-24) pour que le terrain relise ses
  photos.
- **Revenir à l'identique** : ne plus écrire les photos (les garder en mémoire).

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

### DEF-COR-30 — Date de contrôle technique jamais conservée
- **Écran** : Véhicules › formulaire, liste (« EXPIRÉ », « DANS n J »).
- **Reproduire (ancienne)** : `admin.alpha` → Véhicules → modifier → « Prochain contrôle technique »
  → enregistrer → recharger : « — ».
- **Ancienne** : champ `veh_prochainCT` (`app.js:15180`) → `prochain_c_t`, colonne inexistante (la
  vraie est `date_controle_technique` — VEH-21) ; la liste lit `v.prochainCT` (`app.js:14959`).
- **Nouvelle** : écrit et lit `date_controle_technique` ; l'étiquette suit le seuil des réglages.
- **Décision** : INVENTAIRE VEH-21, D-VEH-04 (pas de D- dédiée pour la colonne).
- **Revenir à l'identique** : ne plus écrire la colonne — la date se perd.

### DEF-COR-31 — Carte carburant : un code PIN fait refuser toute la fiche
- **Écran** : Véhicules › fiche › carte carburant.
- **Reproduire (ancienne)** : `admin.alpha` → saisir « 1234 » dans « Validité / code PIN » → enregistrer.
- **Ancienne** : champ texte écrit dans une colonne `date` : l'enregistrement entier est refusé.
- **Nouvelle** : champ date.
- **Décision** : D-VEH-05.
- **Revenir à l'identique** : champ texte libre « Validité / code PIN ».

### DEF-COR-32 — Factures d'achat et d'entretien du véhicule perdues
- **Écran** : Véhicules › fiche (« + Ajouter » facture d'achat, facture d'entretien).
- **Reproduire (ancienne)** : `admin.alpha` → déposer une facture d'achat → recharger.
- **Ancienne** : `factureAchatFiles` sans colonne (`app.js:15021-15023`) ; facture d'entretien en
  data-URL, perdue ; pas de politique Storage pour `<société>/vehicules/…`.
- **Nouvelle** : `vehicule_documents` + seau, `vehicule_entretiens.fichier_chemin`.
- **Décision** : D-VEH-03 ; politiques Storage de la proposition n° 21.
- **Revenir à l'identique** : ne plus déposer ces fichiers.

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

### DEF-COR-34 — Absences perdues, solde de congés faux
- **Écran** : RH › fiche salarié › congés.
- **Reproduire (ancienne)** : `admin.alpha` → RH → un salarié → ajouter un congé payé → recharger.
- **Ancienne** : `absences` posées sur la fiche, sans colonne ; `salarie_absences` inutilisée ; écrit
  à chaque frappe (RH-20).
- **Nouvelle** : une ligne `salarie_absences` par absence, actée (`statut = 'approuvee'`), solde
  enregistré avec la fiche.
- **Décision** : D-RH-02 ; contrainte `fin >= début` de la proposition n° 20.
- **Revenir à l'identique** : ne plus écrire `salarie_absences`.

### DEF-COR-35 — Documents de sous-traitant perdus
- **Écran** : Réglages › Intervenants › sous-traitant (documents à échéance).
- **Reproduire (ancienne)** : `admin.alpha` → un sous-traitant → déposer une attestation décennale →
  recharger.
- **Ancienne** : `documents` (data-URL) sur la fiche, sans colonne (PAR-20).
- **Nouvelle** : `sous_traitant_documents` + `<société>/sous-traitants/<id>/`.
- **Décision** : D-RH-08, D-SOC-14.
- **Revenir à l'identique** : ne plus écrire la table.

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

### DEF-COR-38 — Conducteur ou fournisseur supprimé au lieu d'être retiré
- **Écran** : Réglages › Intervenants (conducteurs, fournisseurs).
- **Reproduire (ancienne)** : `admin.alpha` → « Supprimer » un conducteur cité par des bons.
- **Ancienne** : la fiche est effacée ; bons, devis, factures perdent leur conducteur (PAR-06).
- **Nouvelle** : « Retirer » (`actif = false`), « Retiré », remise d'un clic.
- **Décision** : D-ECR-PAR-12.
- **Revenir à l'identique** : bouton « Supprimer » qui efface la fiche.

### DEF-COR-39 — Logo et documents légaux en data-URL dans les réglages
- **Écran** : Réglages › Identité visuelle, Documents légaux.
- **Reproduire (ancienne)** : `admin.alpha` → déposer un logo et une attestation : ils vont dans
  `societe_settings.infos_entreprise` (data-URL).
- **Ancienne** : data-URL dans le JSON (SOC-51) ; `documents_legaux` et `societes.logo_url` inutilisés.
- **Nouvelle** : seau `terrain` (`<société>/societe/`, `<société>/documents-legaux/`), table
  `documents_legaux`, `societes.logo_url` ; les pièces héritées restent visibles en lecture.
- **Décision** : D-SOC-02, D-SOC-05.
- **Revenir à l'identique** : écrire les data-URL dans `infos_entreprise`.

### DEF-COR-40 — Préfixe de numérotation à tiret accepté
- **Écran** : Réglages › Numérotation.
- **Reproduire (ancienne)** : `admin.alpha` → préfixe « DE-V » : accepté, numéros
  « DE-V-2026-000001 » ambigus ; chaque baisse de compteur se confirme une à une.
- **Ancienne** : tout préfixe de 8 caractères.
- **Nouvelle** : lettres, chiffres, `_` ; une confirmation groupée.
- **Décision** : D-SOC-10.
- **Revenir à l'identique** : accepter tout préfixe, une confirmation par série.

### DEF-COR-41 — Code de référentiel sans accents
- **Écran** : Réglages › Listes de choix.
- **Reproduire (ancienne)** : `admin.alpha` → ajouter « Location de matériel » : code
  « location_de_mat_riel ».
- **Ancienne** : repli sans `normaliserEntree` (PAR-21).
- **Nouvelle** : « location_de_materiel » (`reglages/domain/listes.ts#codeDepuisLibelle`).
- **Décision** : INVENTAIRE PAR-21 (pas de D- dédiée).
- **Revenir à l'identique** : retirer `normaliserEntree` du repli.

### DEF-COR-42 — « Fait » de la cloche refusé au conducteur et au technicien
- **Écran** : cloche de l'en-tête.
- **Reproduire (ancienne)** : `conducteur.alpha` → cloche → marquer une alerte « fait » : échec
  (réglages non modifiables) ; `admin.alpha` : chaque coche réécrit tout le JSON des réglages.
- **Ancienne** : `notifsTraitees` dans `societe_settings.infos_entreprise`.
- **Nouvelle** : table `notifications_traitees` (`notifications/api/notifications.ts`).
- **Décision** : D-CLI-05 ; proposition n° 31 (DEF-BDD-30).
- **Revenir à l'identique** : écrire `notifsTraitees` dans les réglages.

### DEF-COR-43 — Saisie : « 1,5 » lu 1
- **Écran** : tout champ numérique (quantités, prix, pourcentages).
- **Reproduire (ancienne)** : `admin.alpha` → une ligne de devis, quantité « 1,5 » : 1 retenu.
- **Ancienne** : `parseFloat("1,5")` = 1.
- **Nouvelle** : virgule française comme séparateur décimal (`lib/money.ts#montant`).
- **Décision** : D-013, D-CHA-03.
- **Revenir à l'identique** : lire par `parseFloat`.

### DEF-COR-44 — « …alors que le pays est . »
- **Écran** : Clients, Réglages › Organisation (contrôle du n° de TVA).
- **Reproduire (ancienne)** : `admin.alpha` → fiche client, pays vide, n° de TVA étranger.
- **Ancienne** : `verifierEntite` compare à `paysCode ?? "FR"` : un pays `""` produit « …alors que le
  pays est . ».
- **Nouvelle** : pays vide = France (`tests/parite/identifiants.essai.ts`).
- **Décision** : D-012.
- **Revenir à l'identique** : comparer à `paysCode ?? "FR"`.

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

### DEF-COR-46 — Listes tronquées sans le dire
- **Écrans** : clients, chantiers, devis, factures, règlements, salariés, cloche.
- **Reproduire (ancienne)** : au-delà du plafond de lignes du serveur, une liste s'afficherait
  coupée — **à vérifier** : le pont a déjà `refuserSiTronque` (`html-adapter.ts`, collections et
  filles) ; l'écart porte sur les lectures hors du pont.
- **Ancienne** : lectures directes non paginées (familles du catalogue, D-024).
- **Nouvelle** : `lib/lecture.ts#lireTout` (compte exact, pages ; sinon erreur `ListeTronquee`).
- **Décision** : D-CLI-07, D-R4-08 ; INVENTAIRE TRV-10.
- **Revenir à l'identique** : sans objet côté affichage tant que les listes tiennent sous le plafond.

### DEF-COR-47 — Messages d'erreur en anglais
- **Écrans** : Connexion, lecture automatique d'un bon, refus de la base.
- **Reproduire (ancienne)** : se connecter avec un mauvais mot de passe : message anglais de Supabase ;
  lecture automatique refusée : « Edge Function returned a non-2xx status code ».
- **Ancienne** : message brut.
- **Nouvelle** : messages en français ; motif rédigé par la base affiché (`details`, `hint`, `message`).
- **Décision** : D-AUTH-04, D-VIS-03, D-ECR-BC-10.
- **Revenir à l'identique** : afficher `error.message` brut.

### DEF-COR-48 — La recherche perd le focus à chaque frappe
- **Écrans** : listes avec recherche (chantiers, clients, catalogue…).
- **Reproduire (ancienne)** : taper dans la recherche : la zone se redessine, le champ perd le focus.
- **Décision** : D-ECR-CHA-05.
- **Revenir à l'identique** : redessiner le champ (non recommandé).

### DEF-COR-49 — Rapport de rejets d'import nommé `.pdf`
- **Écrans** : imports (catalogue, clients, factures).
- **Reproduire (ancienne)** : importer un fichier avec rejets → « 📄 Rapport » : un CSV nommé `….pdf`.
- **Ancienne** : `telechargerBlob` ajoute `.pdf` à tout.
- **Nouvelle** : `.csv`.
- **Décision** : D-PDF-07.
- **Revenir à l'identique** : nommer le fichier `.pdf`.

### DEF-COR-50 — Import de clients : une mise à jour efface les champs absents
- **Écran** : Clients › import.
- **Reproduire (ancienne)** : `admin.alpha` → importer un export partiel (nom et SIRET seulement) d'un
  client existant : e-mail, adresse, type effacés.
- **Ancienne** : réécrit toute la fiche d'un client rapproché, cases vides comprises.
- **Nouvelle** : n'envoie que les valeurs renseignées, jamais le nom, le type ni `eligibilite_*`
  (`tests/rls/import-export.essai.ts`).
- **Décision** : D-EFA-07.
- **Revenir à l'identique** : envoyer toute la ligne à la mise à jour.

### DEF-COR-51 — Restauration de sauvegarde sans garde de rôle
- **Écran** : Réglages › « ⬆ Importer une sauvegarde ».
- **Reproduire (ancienne)** : tout rôle qui ouvre l'écran → importer un JSON de sauvegarde : il réécrit
  les collections, pièces numérotées comprises (`app.js:399-430`, IMP-40).
- **Nouvelle** : export seulement ; le bouton mène à Import / export.
- **Décision** : D-EFA-08, D-ECR-PAR-09.
- **Revenir à l'identique** : réintroduire la restauration par écrasement (la base refuse désormais de
  modifier les pièces figées).

### DEF-COR-52 — Factures de sous-traitant : numéros hors série, « payées » sans règlement
- **Écrans** : Factures (« Mes factures / Factures <société> » du sous-traitant).
- **Reproduire (ancienne)** : `soustraitant.alpha` → établir une facture (chemin exact à vérifier) : numéro `FST-…` calculé à
  l'écran, émise d'emblée ; « Marquer payée » écrit `payée` sans règlement ; les champs
  `sousTraitantEmetteur`, `bonCommandeKTAId(s)` sont filtrés à l'écriture (sans colonne).
- **Ancienne** : `app.js:5725-5727`, `5786`, `5832` (FAC-90, FAC-91).
- **Nouvelle** : pas de facture de sous-traitant (facture d'achat, relève de la réception PDP).
- **Décision** : D-FAC-09 ; tableau du sous-traitant : DEF-STA-14.
- **Revenir à l'identique** : recréer ces vues et la numérotation à l'écran.

### DEF-COR-53 — Portail client mort
- **Écran** : espace client.
- **Reproduire (ancienne)** : aucun chemin n'y mène (`state.currentRole === 'client'` jamais posé).
- **Ancienne** : portail inatteignable, cloisonnement par un sélecteur libre (ESP-30).
- **Nouvelle** : espace client en lecture seule sur la RLS (`client.opac@erp.local`).
- **Décision** : D-008, D-029, D-FAC-10, D-ECR-PAR-14 ; propositions n° 4, 14, 29 (DEF-BDD-28).
- **Revenir à l'identique** : ne pas ouvrir l'espace client.

### DEF-COR-54 — Réf. de bon de commande client figée vide sans avertissement
- **Écran** : Factures › « Émettre ».
- **Reproduire (ancienne)** : `secretaire.alpha` → émettre une facture sans réf. de bon client : elle
  est figée vide, sans avertissement préalable.
- **Nouvelle** : même règle (la base fige l'en-tête), avec « Émettre sans réf. de bon de commande
  client ? Elle sera figée vide ».
- **Décision** : INVENTAIRE FAC-100 (pas de D- dédiée).
- **Revenir à l'identique** : retirer la confirmation de `FormulaireFacture.tsx`.

### DEF-COR-55 — « Mon nom » inaccessible au technicien et au sous-traitant
- **Écran** : Réglages › Mon compte / `/mon-compte`.
- **Reproduire (ancienne)** : `technicien.alpha` : pas d'accès aux Réglages, donc à « Mon nom ».
- **Nouvelle** : `/mon-compte` (nom, mot de passe) ouvert à tous.
- **Décision** : D-SOC-06, D-ECR-PAR-08.
- **Revenir à l'identique** : retirer « Mon compte » du menu du nom pour ces rôles.

### DEF-COR-56 — L'ordre des listes suit l'ordre physique de la base
- **Écrans** : Bons (cartes), fiche chantier (devis, factures), « Tous les règlements ».
- **Reproduire (ancienne)** : l'ordre des cartes change au gré des mises à jour (`v_bons_commande_terrain`
  lue sans `order`).
- **Nouvelle** : ordre stable (date décroissante, numéro, identifiant).
- **Décision** : D-ECR-BC-09, D-ECR-CHA-10, D-ECR-FAC-06.
- **Revenir à l'identique** : non reproductible de façon fiable (ordre non déterminé).

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

### DEF-REP-02 — Import de DPGF : « 1.234 » lu 1,234, séparateur deviné sur la 1re ligne
- **Écran** : Chantiers › DPGF › import.
- **Reproduire** : un CSV avec « 1.234 » en quantité ; un fichier dont la 1re ligne contient une
  virgule et le séparateur est `;`.
- **Pourquoi gardé** : des fichiers préparés pour l'ancien liraient autrement (IMP-31, D-EFA-09) ;
  seul le remplacement sans annonce est tempéré (DEF-COR-06).
- **Corriger** : `chantiers/domain/import-dpgf.ts`, avec un écart consigné.

### DEF-REP-03 — `articles.metier` ni saisi ni recopié sur la ligne
- **Écran** : Catalogue, lignes de devis / factures / bons.
- **Reproduire** : un article dont `metier` est renseigné en base → l'ajouter à un devis : le métier
  n'est pas repris.
- **Décision** : D-025 (INVENTAIRE ART-50). **Corriger** : saisir le métier sur la fiche article et le
  recopier sur la ligne.

### DEF-REP-04 — Pièces imprimées : « 5.5% », « 2.5 », avoir en positif, SAV intitulé « BON DE COMMANDE »
- **Écran** : aperçus et PDF des devis, factures, bons.
- **Reproduire** : un devis à 5,5 % et une quantité 2,5 → PDF : « 5.5% », « 2.5 » ; un avoir : montants
  positifs sous le titre AVOIR ; un SAV : « BON DE COMMANDE ».
- **Décision** : D-PDF-03 (DEV-52 écarté) — le client a exigé la pièce de l'ancien à l'identique.
  **Corriger** : la correction abandonnée est décrite en D-FAC-03 (avoir en négatif) et DEV-52
  (« 5,5 % »).

### DEF-REP-05 — Le nom du client n'apparaît pas sur les chantiers
- **Écran** : Chantiers › liste (cartes) et bandeau de la fiche.
- **Reproduire** : `admin.alpha` → Chantiers : aucune carte ne porte le client.
- **Ancienne** : lit un champ texte `client` que la base ne remplit pas.
- **Décision** : D-ECR-CHA-07 (révisée : l'affichage de `client_nom` a été retiré). **Corriger** :
  afficher `client_nom`.

### DEF-REP-06 — Un sous-traitant ne peut pas recevoir de compte par invitation
- **Écran** : Réglages › Comptes (et fiche RH).
- **Reproduire** : tenter d'inviter un sous-traitant : rôle absent ; la fonction `inviter-salarie`
  refuse `sous_traitant` et exige un salarié (AUTH-79).
- **Décision** : D-SOC-08. **Corriger** : décision produit et évolution de la fonction de bord (hors
  `web/`), `invitations.sous_traitant_id` existe déjà.

### DEF-REP-07 — Matériel : « Aucun matériel pour l'instant. » même quand la recherche écarte tout
- **Écran** : Matériel › liste.
- **Reproduire** : chercher un mot absent : le message dit qu'il n'y a aucun matériel.
- **Décision** : D-ECR-PAR-04. **Corriger** : « Aucun matériel ne correspond. » quand la recherche filtre.

### DEF-REP-08 — Pré-facture : les montants restent en clair en mode discret
- **Écran** : Bons › pré-facture (fenêtre).
- **Reproduire** : activer le mode discret → ouvrir une pré-facture : les montants suivent `money()`.
- **Décision** : D-ECR-BC-11 (« comme l'ancien »). **Corriger** : `formatEurosEcran` dans la fenêtre
  (le document imprimé garderait ses montants, D-CLI-04). À rapprocher de DEF-STA-16, où `web/` a fait
  le choix inverse.

### DEF-REP-09 — Textes périmés du cadre et de « nouveau mot de passe »
- **Écrans** : pied du menu ; page « nouveau mot de passe ».
- **Reproduire** : le pied dit « Données partagées avec toute personne ayant ce lien. » (périmé) ; la
  page « nouveau mot de passe » garde un `login-card` que sa feuille ne style pas.
- **Décision** : D-VIS-04, D-VIS-03 (« identique d'abord »). **Corriger** : retirer ou réécrire la
  phrase ; styler la carte.

### DEF-REP-10 — Deux statuts pour un bon
- **Écran** : Bons de commande (pastille grise « en attente » sur la carte).
- **Reproduire** : tout bon affiche « en attente » quel que soit son avancement ; seul
  `statut_workflow` dit où il en est.
- **Décision** : D-BC-13, D-ECR-BC-01 (INVENTAIRE BC-99). **Corriger** : ne plus afficher `statut`, puis
  le retirer du schéma.

### DEF-REP-11 — `extraire-bc` ne vérifie ni l'utilisateur ni la société
- **Gravité** : sécurité — un JWT `anon` suffit à consommer le quota Mistral (OCR-40).
- **Constater** : lecture de `supabase/functions/extraire-bc` (hors `web/`) ; aucun test automatisé.
- **Décision** : D-BC-15. Côté `web/`, l'écran exige `bons_commande / creer` ET la fonctionnalité
  `ocr` — masquage seulement. **Corriger** : vérifier le JWT et l'appartenance dans la fonction
  (prérequis de mise en service, `migrations-proposees.md`).

### DEF-REP-12 — Fonctions PDP : rôle non vérifié ; secret du webhook comparé par `!==`
- **Gravité** : sécurité — un compte `lecture` peut déposer une facture, un technicien connecter ou
  déconnecter la plateforme (EFA-20) ; `pdp-webhook` compare son secret avec `!==`, sans
  `verify_jwt=false` déclaré (EFA-21).
- **Décision** : D-EFA-05. `web/` masque « Transmettre » sans `factures / modifier`. **Corriger** (hors
  `web/`) : `a_permission('factures','modifier')` dans la fonction, comparaison à temps constant,
  `verify_jwt` déclaré. Aussi : un second dépôt après expiration du délai n'est gardé que par la
  fonction (D-R4-11, M7) — comportement de l'ancien **à vérifier**.

### DEF-REP-13 — `inviter-salarie` ne cherche que dans une page de 50 comptes
- **Constater** : `listUsers()` sur une seule page (AUTH-77) : au-delà de 50 comptes, un compte
  existant peut ne pas être trouvé.
- **Décision** : D-SOC-13. **Corriger** (hors `web/`) : pagination ou recherche par adresse.

### DEF-REP-14 — Facture née du bon : virement forcé, TVA 10 en dur, conducteur non recopié
- **Écran** : Bons › « 🧾 Créer la facture » (les deux applications appellent `bc_generer_facture`).
- **Reproduire** : un client réglant par chèque → facture du bon : mode « virement », ligne forfait à
  10 %, sans conducteur.
- **Décision** : D-BC-14, D-ECR-BC-07 (INVENTAIRE BC-95). **Corriger** : migration « à écrire »
  (`migrations-proposees.md`), à combiner avec le n° 35 qui refait la même fonction.

### DEF-REP-15 — Deux onglets créent deux bons depuis le même devis
- **Écran** : Devis › « Créer un bon de commande ».
- **Constater** : aucun index unique sur `bons_commande(devis_id)`. `web/` rattrape l'échec des lignes
  (le bon créé s'ouvre, D-R4-07) mais la course reste (D-R4-11).
- **Corriger** : RPC `bon_depuis_devis` et index unique partiel, après examen des doublons (« à écrire »).

### DEF-REP-16 — Un bon accepte un client ou un conducteur d'une autre société
- **Gravité** : sécurité (cohérence entre sociétés). L'écran ne les propose pas ; la base ne le refuse
  pas (relecture 3, M1).
- **Corriger** : contrainte ou déclencheur « à écrire » (`migrations-proposees.md`).

### DEF-REP-17 — Le terrain peut encore CRÉER une fiche conducteur ou un fournisseur
- **Gravité** : sécurité — l'insertion reste ouverte à `peut_ecrire()` (technicien compris), par l'API ;
  la proposition n° 30 n'a retiré que la suppression.
- **Décision** : D-AUTH-06 (à fermer après vérification qu'aucun geste de l'écran historique n'en
  dépend). **Corriger** : migration « à écrire ».

### DEF-REP-18 — Clients, véhicules, annuaire… lisibles par tout membre, sous-traitant compris
- **Gravité** : sécurité — sous `est_membre(societe_id)` : `clients`, `conducteurs`, `techniciens`,
  `fournisseurs`, `factures_entrantes`, `vehicules`, `materiels`, `referentiels`, `societe_settings`,
  `workflow_journal`, `v_salaries_annuaire` (colonnes sensibles masquées).
- **Constater** : `select tablename from pg_policies where cmd = 'SELECT' and qual ~
  '^est_membre\(societe_id\)$';` (`migrations-proposees.md`, n° 25, « Reste ouvert »).
- **Corriger** : à trancher par le métier (RAPPORT-MATIN, « Décisions à valider »).

### DEF-REP-19 — Sept factures réelles restées dans `kv_store`
- **Gravité** : données — FAC-2026-0007 à 0013 (ALPES ISERE HABITAT) : trou dans la série légale
  (FAC-99).
- **Décision** : D-FAC-12. **Corriger** : reprise en production par un humain, `legacy_id` « compta: ».

### DEF-REP-20 — Le niveau d'abonnement n'est pas opposable
- **Constater** : aucune colonne ne le porte ; les deux écrans ne font que masquer (D-009, D-R4-09).
- **Corriger** : `societes.niveau_abonnement` puis une vérification en base (« à écrire »).
