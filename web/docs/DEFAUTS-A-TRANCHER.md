# Défauts de l'ancienne application, à trancher par le client

Relevés en comparant l'ancienne application (`src/pages/app.js`) et la réécriture (`web/`). Aucun n'est
corrigé d'office : la nouvelle reste identique à l'ancienne tant que le client n'a pas testé et décidé. Pour
chaque défaut : l'écran, la reproduction pas à pas, ce que fait l'ancienne, ce qui serait juste — et, quand
elle diffère déjà, ce que fait la nouvelle aujourd'hui.

Reproductions sur la base LOCALE (`npm run base:locale`, puis `bash scripts/appliquer-jeux-visuels.sh`),
mot de passe des comptes d'essai : `motdepasse-local`.

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
- **Écrans** : Tableau de bord › pilotage (graphique « Chiffre d'affaires », « Total période ») ;
  Statistiques (tableau par équipe et par mois).
- **Reproduction** : compte `admin.alpha@erp.local` ; données : une facture BROUILLON chiffrée de la
  société ALPHA, datée du mois en cours (Factures › « + Nouvelle facture », client Mme Durand, une ligne à
  745,50 € HT, « 💾 Enregistrer le brouillon », sans émettre) ; ouvrir le tableau de bord, puis Statistiques.
- **Ancienne** : « Total période » augmente de 745,50 €, la colonne du mois dans Statistiques aussi
  (`computeRevenuePeriod` et les statistiques additionnent `computeDocTotals(f).ht` de TOUTES les factures,
  brouillons compris, sans regarder le statut). Un brouillon daté d'un autre mois ajoute même une colonne à
  Statistiques.
- **Juste** : une pièce non émise n'est pas du chiffre d'affaires : seules les factures émises (numérotées)
  comptent, avoirs en négatif.
- **Nouvelle aujourd'hui** : ne compte pas le brouillon (total inférieur de 745,50 € sur la même base).
  La nouvelle diffère donc de l'ancienne ; à trancher (voir aussi la section « Statistiques et tableaux de
  bord »).

### DEF-ECR-04 — Tableau de bord : la création d'un brouillon s'écrit « Mme Durand · null »
- **Écran** : Tableau de bord › pilotage, fil « Activité récente ».
- **Reproduction** : compte `admin.alpha@erp.local` ; créer une facture brouillon (Factures › « + Nouvelle
  facture », client Mme Durand, « 💾 Enregistrer le brouillon ») ; revenir au tableau de bord.
- **Ancienne** : l'événement « Facture créée » porte le sous-titre « Mme Durand · null » : `buildActivityFeed`
  écrit `${f.client} · ${f.numero}` et un brouillon n'a pas de numéro.
- **Juste** : « Mme Durand · Brouillon — non émise » (le libellé des cartes de facture), ou le nom seul.
- **Nouvelle aujourd'hui** : écrit « Mme Durand », sans « · null ». La nouvelle diffère de l'ancienne ; à
  trancher.
