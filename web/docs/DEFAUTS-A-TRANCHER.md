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
