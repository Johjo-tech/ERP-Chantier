# Règles métier de référence — ERP Chantier

Ce que la nouvelle application doit calculer et décider, règle par règle, avec la source dans
l'ancienne application et des **exemples chiffrés obtenus en exécutant l'ancien code**
(`inventaire-brut/*.md` §5, scripts `parite/cas.mts`, `inv/cas-app3.mjs`, `inv/app2/run.mjs`).
Chaque exemple est un cas de test prêt à écrire : entrée → sortie exacte.

Chaque règle se termine par sa **parité** :

- **Identique** — la nouvelle app reproduit le comportement, exemples compris ;
- **Écart proposé (D-xx)** — un défaut connu justifie de s'en écarter ; la décision prudente
  proposée est au §12 et doit être inscrite dans `DECISIONS.md` avant d'être codée.

Rappel d'architecture (`CLAUDE.md`) : les calculs qui engagent (numérotation, totaux, soldes,
transitions) **vivent en base**. Les règles ci-dessous décrivent aussi ce que l'écran calcule
pour l'affichage ; en cas de désaccord, la base fait foi.

Notations : `parseFloat(String(v ?? ""))`, non fini → 0, est le parseur commun des montants
(« `nombre()` »). Les montants sont des flottants JS côté client, des `numeric` côté base.

---

## 1. Lignes, TVA et totaux de document

### RM-01 — Montant HT d'une ligne

- **Source** : `src/api/regles-totaux.ts#montantLigneHt` ; SQL `facture_lignes.montant_ht`, `bc_generer_facture`.
- **Règle** : HT = `nombre(qte) × nombre(prixUnitaire)`, **avant remise**. Une ligne sans `type` est une `ligne`. `chapitre` et `commentaire` valent 0. TTC d'une ligne = HT × (1 + tva/100), avant remise.
- **Exemples** :

| Entrée | Sortie |
|---|---|
| 2 × 85,50 à 10 % | HT 171 ; TTC 188,1 |
| `{qte:"2", prixUnitaire:"50", tva:10}` | TTC 110 |
| 3 × 0,1 | 0.30000000000000004 (flottant brut) |
| `{qte:"1,5", pu:"100"}` | HT 100 (la virgule tronque : `parseFloat("1,5")` = 1) |
| `{qte:"abc", pu:10}` | 0 |
| chapitre ou commentaire 5 × 5 | 0 |

- **Parité** : identique pour le calcul ; **écart proposé (D-12)** sur la saisie : accepter la virgule décimale à l'écran (l'ancien champ `type=number` empêchait « 1,5 » d'arriver en chaîne).

### RM-02 — TVA multi-taux, calculée ligne par ligne

- **Source** : `regles-totaux.ts:131` (`totauxDocument`) ; vues `v_devis_totaux`, `v_facture_totaux`.
- **Règle** : le taux est porté **par ligne** (`l.tva`, en %). TVA du document = Σ (HT ligne × taux/100), sommée sans arrondi. HT = Σ HT lignes. TTC = HT + TVA. Seules les lignes de type `ligne` comptent. Un même document mêle couramment 10 % (rénovation) et 20 % (neuf).
- **Exemples** (lignes C1 : chapitre ; 2 × 85,50 @10 ; 1 × 45 @20 ; commentaire ; chapitre ; 3 × 12,333 @5,5) :

| Entrée | Sortie |
|---|---|
| `totauxDocument(C1, 0)` | htAvant 252.999 ; tva 28.134945000000002 ; ttc 281.133945 |
| `[chapitre, 3 × 33,33 @10, 1 × 100 @20, commentaire]` | ht 199.99 ; tva 29.999000000000002 ; ttc 229.989 |

- **Parité** : identique (voir RM-09 pour l'arrondi).

### RM-03 — Ventilation de la TVA par taux

- **Source** : `regles-totaux.ts#ventilationTvaAffichage` ; `app.js:3236, 4182`.
- **Règle** : un poste par taux rencontré, **trié par taux croissant** ; base = HT ligne × (1 − remise/100) ; une ligne dont la base vaut 0 est ignorée ; un taux **0 % portant une base apparaît** (autoliquidation lisible). Le détail s'affiche à l'écran et sur le PDF **seulement s'il y a plus d'un taux** ; sinon le libellé devient « Total TVA 20 % ».
- **Exemples** :

| Entrée | Ventilation |
|---|---|
| C1, remise 0 | `[{5.5, 36.999, 2.034945}, {10, 171, 17.1}, {20, 45, 9}]` |
| C1, remise 10 | `[{5.5, 33.2991, 1.8314505}, {10, 153.9, 15.39}, {20, 40.5, 8.1}]` |
| `[1 × 1250 @0, 1 × 0 @20]` | `[{taux 0, base 1250, montant 0}]` (la ligne à 0 € n'apparaît pas) |

- **Parité** : identique.

### RM-04 — Taux de TVA par défaut et taux proposés

- **Source** : `app.js:12563` (`tvaDefaut`), `app.js:12572` (`optionsTvaHTML`) ; `src/integrations/reglages.ts:65`.
- **Règle** : taux d'une ligne neuve = `reglages.documents.tvaDefaut`, **10 par défaut**. Taux proposés = `reglages.tauxTva`, défaut `[0, 2.1, 5.5, 10, 20]`, sinon `[tvaDefaut]`. Un taux enregistré qui n'est plus dans la liste reste proposé (ajouté puis trié). Lignes créées automatiquement (pré-facture, situation, préconisations) : `tvaDefaut()`. Travaux supplémentaires : 10 par défaut en base.
- **Exemples** : réglage absent → 10 ; `tvaDefaut` = `undefined` → `Number(undefined)` NaN → **0** ; `tvaDefaut` = `""` ou `null` → **0** sans erreur ; ligne existante à 7 % avec liste `[10, 20]` → `[7, 10, 20]`.
- **Parité** : identique pour 10 % et la conservation du taux historique ; **écart proposé (D-13)** : un réglage vide ou non numérique retombe sur 10 (défaut documenté), jamais sur 0.

### RM-05 — Taux zéro, autoliquidation, franchise en base

- **Source** : `regles-efacture.ts` (`REGIMES_TVA`, `mentionsLegales`), `app.js:5786` (factures ST), `app.js:12510`.
- **Règle** :
  - L'autoliquidation bâtiment (art. 283-2 nonies du CGI) est une **case société** ; elle ajoute une mention, elle ne change aucun calcul. La TVA des lignes concernées est saisie à 0 %.
  - Facture de sous-traitant : ligne à `tva: 0` + commentaire « TVA non applicable — autoliquidation (art. 283, 2 nonies du CGI) ».
  - Franchise en base (`regime_tva = franchise_en_base`) : aucune TVA, mention « TVA non applicable, art. 293 B du CGI » obligatoire.
  - Catégorie EN 16931 d'une ligne : `tvaCategorie` si posée, sinon `S` si taux > 0, `Z` sinon. Import historique : un taux 0 exige une catégorie parmi `E`, `AE`, `Z`, `O`.
- **Exemple** : vente de véhicule 8 500 € « sans TVA » → HT = TTC = 8 500, ventilation `[{0, 8500, 0}]`.
- **Parité** : identique.

### RM-06 — Codes TVA du catalogue importé

- **Source** : `src/api/regles-import-articles.ts`.
- **Règle** : colonne `FamilleTVA` (casse ignorée) : `INTER` → **10** ; `NORMA` → **20** ; `EXO` → **0** ; `"0"` → **0** ; tout autre code → **20 et signalement** ; colonne absente → 20 pour tout le fichier.
- **Exemples** : `A1;Tube 1/2";12,50;INTER;ML;BIEN;1` → tva 10, PU 12.5, unité vide (signalée), type bien, actif ; `NORMA`/`M2` → 20 / m² ; `EXO`/`PC` → 0 / pièce ; `TVA55` → 20 + signalement.
- **Parité** : identique.

### RM-07 — Mentions légales imprimées

- **Source** : `regles-efacture.ts#mentionsLegales`, `app.js:4248`.
- **Règle** : sur **facture seulement** (pas devis, pas BC) : pénalités de retard (défaut « …taux d'intérêt légal majoré de 10 points. »), « Indemnité forfaitaire pour frais de recouvrement : 40.00 € » (valeur société, défaut 40), franchise 293 B si régime, autoliquidation « article 283-2 nonies du CGI » si la case société, « TVA exigible à l'encaissement » si TVA sur encaissements, assurance décennale.
- **Parité** : identique, sauf **écart proposé (D-14)** : « 40,00 € » avec virgule (l'ancien texte imprime `toFixed(2)` avec un point).

### RM-08 — TVA et remise dans la facture électronique (EN 16931)

- **Source** : `regles-en16931.ts#deductionsDocument/ventilationTva/chargeEN16931`.
- **Règle** : la remise devient une **déduction par taux** (BG-20, code 95) = `centimes(base × pct/100)` ; assiette par taux = `centimes(base − déduction)` ; TVA par taux = `centimes(assiette × taux/100)` ; avoir : tout multiplié par −1 ; BR-CO-10 toléré à 0,01 €. **Ici on arrondit par taux**, contrairement à l'écran (RM-09).
- **Exemples** : lignes A 100 @20 et B 2 × 50 @10, remise 10 % → deux déductions de 10 (taux 10 puis 20) ; taux 10 : assiette 90.00, TVA 9.00 ; taux 20 : 90.00 / 18.00. Avoir identique → sum_lines −200.00, allowance −20.00, HT −180.00, TVA −27.00, TTC −207.00.
- **Parité** : identique ; noter qu'un écart d'un centime entre PDF (TVA non arrondie par taux) et XML (arrondie par taux) est **possible** (voir D-01).

---

## 2. Arrondis

### RM-09 — Aucun arrondi sur les totaux ; arrondi à l'affichage seulement

- **Source** : `regles-totaux.ts` (commentaire « Aucun arrondi ici ») ; `app.js:625` (`money`) ; vues SQL (schéma §4.1).
- **Règle** :
  - HT, TVA, TTC, ventilation, sous-totaux, remise et net à payer sont calculés **en flottant sans aucun arrondi**, ni par ligne ni au total.
  - L'arrondi a lieu **à l'affichage** par `Intl.NumberFormat('fr-FR', EUR)` (arrondi au plus proche, demi à l'écart de zéro, 2 décimales).
  - Les vues `v_devis_totaux`, `v_facture_totaux`, `v_facture_solde`, `v_chantier_avancement` n'arrondissent pas non plus (`numeric` non borné).
  - Conséquence assumée : la somme des montants **affichés** par ligne peut différer d'un centime du total affiché ; la ventilation, elle, somme exactement au total (même facteur de remise).
  - Stockage : `bons_commande.montant` et `reglements.montant` sont `numeric(14,2)` (Postgres arrondit à l'écriture) ; `quantite`, `prix_unitaire` en `numeric(14,4)` ; `montant_ht` des lignes non borné.
- **Exemples** : `totauxDocument(C1, 10).ttc` = 253.02055049999998 → affiché « 253,02 € » ; `money(0.005)` = « 0,01 € » ; 3 × 0,1 @20 → ht 0.30000000000000004, ttc 0.36000000000000004.
- **Parité** : identique pour les montants affichés ; **écart proposé (D-01)** sur la représentation interne.

### RM-10 — Deux arrondis au centime (règlements et avoirs)

- **Source** : `regles-reglements.ts#arrondiCentime` ; `regles-avoir.ts#centimes` ; `regles-filtres-reglements.ts#totalReglements` ; `regles-metiers.ts#montantsParMetier`.
- **Règle** :
  - `arrondiCentime(n)` = `sign(n) × round(|n| × 100 + Number.EPSILON × 100) / 100` : symétrique, corrige 1,005. Utilisé pour tout règlement saisi, total réglé, reste à payer, imputation d'un virement.
  - `centimes(n)` = `Math.round(n × 100) / 100` : sans correction. Utilisé pour l'imputation d'avoir, EN 16931, total des règlements filtrés, montants par métier.
  - Seuil « égal à zéro » : `EPSILON = 0,005`. Seuils de l'écran : reste « dû » si > 0,01 ; soldé / imputable si ≤ 0,004.
- **Exemples** :

| Entrée | `arrondiCentime` | `centimes` |
|---|---|---|
| 1.005 | 1.01 | 1 |
| −1.005 | −1.01 | −1 |
| 2.675 | 2.68 | 2.68 |
| `"abc"` | 0 | — |
| `"12,5"` | **12** (virgule non gérée) | — |

- **Parité** : **écart proposé (D-02)** : une seule fonction d'arrondi au centime (`arrondiCentime`) partout.

---

## 3. Remise, sous-totaux, montant d'un bon

### RM-11 — Remise globale

- **Source** : `regles-totaux.ts#totauxDocument` ; `app.js:3253-3290` (`onRemisePctInput`, `onRemiseMontantInput`) ; colonne `remise_pourcentage numeric(5,2)` CHECK 0-100.
- **Règle** :
  - Un **pourcentage global**, borné à [0, 100], appliqué comme facteur `1 − pct/100` au HT, à la TVA et au TTC. `remiseMontantHT` = HT avant × pct/100.
  - La remise **ne descend pas à la ligne** : colonnes HT/TTC par ligne et sous-totaux de chapitre sont **avant remise** ; Σ TTC lignes = `ttcAvant`, pas `ttc`.
  - Saisie par montant cible : pct = (1 − cible/base) × 100 avec base = HT (ou TTC) avant remise, **arrondi à 2 décimales**, borné [0, 100]. Le document obtenu n'atteint donc pas toujours la cible exacte.
- **Exemples** :

| Entrée | Sortie |
|---|---|
| C1, remise 10 | remiseMontantHT 25.2999 (25.299899999999997) ; ht 227.6991 ; tva 25.3214505 ; ttc 253.02055049999998 |
| remise 150 | remisePct **100** ; ht, tva, ttc = 0 ; ventilation `[]` |
| remise −5 | remisePct 0 |
| 1 × 1000 HT @20, cible HT 900 | 10 % (exact) |
| 1 × 1000 HT @20 (TTC 1 200), cible TTC 1 000 | **16,67 %** → TTC réel **999,96** |

- **Parité** : identique (la colonne `numeric(5,2)` impose de toute façon 2 décimales) ; afficher le montant réellement obtenu à côté de la cible.

### RM-12 — Sous-totaux de chapitre

- **Source** : `regles-totaux.ts#sousTotauxChapitres`.
- **Règle** : un sous-total par chapitre, dans l'ordre d'apparition, avant remise ; les commentaires ne comptent pas ; les lignes **avant le premier chapitre** ne sont dans aucun sous-total (mais bien dans le total) ; document sans chapitre → aucun sous-total.
- **Exemples** : C1 → `[216, 36.999]` ; `[1 × 5]` → `[]` ; `[1 × 5, chapitre, 2 × 3, chapitre]` → `[6, 0]`.
- **Parité** : identique.

### RM-13 — Montant d'un bon de commande

- **Source** : `app.js:8431-8520` (`saveBonCommande`), `app.js:8065, 8121`.
- **Règle** : montant = Σ des montants saisis par métier, ou montant global saisi ; **dès qu'une ligne est renseignée** (ligne avec désignation ou PU > 0), montant = HT des lignes (sans remise). Un bon **sans ligne garde son montant saisi**. Montant par métier sur le planning : `montantParMetier[metier]` sinon le montant du bon.
- **Exemples** : lignes `[3 × 0,1]` → 0.30000000000000004 envoyé, stocké 0.30 (`numeric(14,2)`) ; aucun ligne, montant saisi 2 110,29 → 2 110,29 conservé (12 bons en production, 25 323,48 €).
- **Parité** : identique ; arrondir au centime **avant** l'envoi (D-01) pour que l'écran et la base disent la même chose.

---

## 4. Net à payer et avoirs

### RM-14 — Net à payer : acomptes et retenue de garantie

- **Source** : `regles-totaux.ts#soldeAPayer`, `RETENUE_GARANTIE_USUELLE = 5` ; `app.js:6128, 4182`.
- **Règle** :
  - acomptes = max(0, acomptes déduits) ; retenue % bornée [0, 100] ; **retenue = TTC × % / 100** (sur le TTC : elle porte sur le montant du marché) ;
  - net à payer = **max(0, TTC − acomptes − retenue)** ; un net négatif n'existe pas (c'est un avoir qu'il faut établir) ;
  - la retenue n'est pas une remise : la créance reste entière ;
  - `retenue_garantie_pourcentage` : `null` = pas de retenue au marché (≠ 0) ; le taux usuel (loi du 16/07/1971) est 5 %, mais rien ne l'impose par défaut ;
  - ces deux champs sont **reconduits** d'une facture (duplication, reprise) mais **plus saisis** dans le formulaire ; le PDF affiche « Acompte déjà versé », « Retenue de garantie (5 %) » et **toujours** « Net à payer ».
- **Exemples** :

| Entrée | Sortie |
|---|---|
| TTC 1 200, acomptes 300, retenue 5 % | retenue 60 ; **net 840** ; `aDesDeductions` vrai |
| TTC 100, acomptes 150 | net 0 |
| TTC 1 200, acompte 2 000 | net 0 |
| TTC 1 200, retenue 150 % | bornée 100 → retenue 1 200, net 0 |

- **Parité** : identique. À noter : `v_facture_solde` et le statut de règlement **ignorent** acomptes et retenue (le reste à payer porte sur le TTC entier) — voir D-07.

### RM-15 — Sens d'un document : avoirs signés au calcul, stockés positifs

- **Source** : `regles-avoir.ts#estAvoir/signeDocument/totauxSignes/libelleDocument` ; `regles-verrouillage.ts#estAvoirDocument`.
- **Règle** : les montants d'un avoir sont **stockés positifs** ; c'est `type_document` qui donne le sens. Au calcul, `totauxSignes` négative htAvant, tvaAvant, ttcAvant, remiseMontantHT, ht, tva, ttc et la ventilation (base, montant) ; **`remisePct` n'est pas signé**. Titre imprimé : AVOIR / FACTURE D'ACOMPTE / FACTURE.
- **Exemples** :

| Entrée | Sortie |
|---|---|
| `totauxSignes(1 000 HT @20, "avoir")` | ht −1 000 ; tva −200 ; ttc −1 200 ; remisePct 0 ; ventilation base −1 000, montant −200 |
| 1 × 568,33 @20, avoir | ttc −681.996 |
| `estAvoir` : `avoir`, `Avoir`, `facture_avoir`, `facture`, `acompte`, `null` | vrai, vrai, vrai, faux, faux, faux |
| `libelleDocument` : `avoir`, `acompte`, `facture`, `null` | AVOIR, FACTURE D'ACOMPTE, FACTURE, FACTURE |

- **Parité** : identique sur le signe ; **écart proposé (D-04)** : une seule définition, `type_document === 'avoir'` (l'énumération `facture|avoir|acompte|note_frais` rend `includes` inutile).

---

## 5. Règlements, statut, imputation

### RM-16 — Statut de règlement affiché d'une pièce

- **Source** : `app.js:6482` (`reglementStatutFacture`), `app.js:5550` (`contexteFacture`).
- **Règle**, dans cet ordre :
  1. pièce historique (`legacy_id` de reprise) **et** `statut = payée` → « Réglée (reprise) » (avoir : « Imputé (reprise) »), reste 0, aucun règlement fabriqué ;
  2. avoir → statut d'**imputation** (RM-19) ;
  3. sinon `statutReglement(ttc, règlements)` (RM-17).
  Étiquettes de filtre : facture `payee` / `partiel` / `impayee` / `retard` ; avoir `avoir`, `avoir_impute` / `avoir_disponible` — **jamais** « impayée » ni « retard » pour un avoir.
- **Parité** : identique.

### RM-17 — Reste à payer, statut, saisie et répartition des règlements

- **Source** : `regles-reglements.ts` (verbatim : `inventaire-brut/couche-ts.md` §1.3) ; `app.js:11389` (`syncFactureStatut`).
- **Règle** :
  - total réglé = `arrondiCentime(Σ montants)` (en excluant le règlement en cours de modification) ; reste = `arrondiCentime(ttc − réglé)`, **0 si < 0,005** (un trop-perçu n'est pas une dette) ;
  - statut : reste < 0,005 → **Réglée** (testé **en premier** : une facture à 0 € est réglée) ; sinon réglé < 0,005 → **Non réglée** ; sinon **Partiellement réglée** ;
  - statut **en base** (`factures.statut` ∈ brouillon, impayée, envoyée, payée) : réglée → `payée`, tout le reste → `impayée` ; écrit seulement s'il change ;
  - refus de saisie : montant ≤ 0 « Le montant doit être supérieur à 0. » ; reste ≤ 0 « Cette facture est déjà entièrement réglée. » ; montant − reste > 0,005 « Le montant dépasse le reste à payer (N,NN €). » ; montant proposé = reste ;
  - virement groupé : factures de reste > 0 triées par **date** puis **numéro** (`localeCompare`), servies dans l'ordre sans dépasser leur reste, sans part nulle ; montant > total dû → refus « Le montant reçu dépasse le total dû (N,NN €). Un trop-perçu ne s'impute pas. ».
- **Exemples** :

| Entrée | Sortie |
|---|---|
| `statutReglement(1200, [])` | non_reglee, reste 1 200 |
| `statutReglement(1200, [500])` | partiellement_reglee, reste 700 |
| `statutReglement(1200, [1199.996])` | reglee |
| `statutReglement(0.1 + 0.2, [0.3])` | reglee |
| `statutReglement(0, [])` | reglee |
| `statutReglement(100, [150])` | reglee, payé 150 |
| `statutReglement(-682, [])` | reglee (d'où RM-19 pour les avoirs) |
| `resteAPayer(100, [30, "20.5"])` | 49.5 |
| `resteAPayer(1200, [r1 500, r2 200], sauf r1)` | 1 000 |
| `refusReglement({80, ttc 100, [a: 30]})` | « Le montant dépasse le reste à payer (70,00 €). » ; avec `idModifie: a` → accepté |
| `imputer(1100, [F3 01/03 300, F1 15/01 1 000, F2 15/01 250,55])` | F1 1 000 (reste 0), F2 100 (reste 150,55) ; F3 non servie |
| `imputer(250, [f3 01/03 FAC-3, f1 01/01 FAC-1, f2 01/01 FAC-0], 100 chacune)` | f2 100, f1 100, f3 50 |
| `refusImputation(1600, [300, 1000, 250,55])` | « …dépasse le total dû (1550,55 €)… » |
| `statutEnBase('partiellement_reglee')` | `impayée` |

- **Parité** : identique ; le statut stocké doit être posé **par la base** à terme (D-07).

### RM-18 — Retard et échéance dépassée

- **Source** : `app.js:6513` (`joursDepuisEcheance`), `app.js:6520`, `app.js:10741` ; `v_facture_solde.jours_retard`.
- **Règle** : jours = `round((aujourd'hui − (echeance || date)) / 86 400 000)` sur des dates **locales** à minuit. En retard ⇔ pas un avoir, reste > 0,01 et jours > 0. Badge : « En retard de N j », « Échéance aujourd'hui », « Échéance dans N j » ; rien si reste ≤ 0,01. Tableau de bord « factures échues » = statut stocké `impayée` hors avoirs et `echeance < aujourd'hui`. En base, `jours_retard` = `CURRENT_DATE − echeance` si reste > 0,01 (négatif avant l'échéance).
- **Exemples** : échéance J−3 → 3, « En retard de 3 j » ; échéance 01/09/2026 vue le 24/09/2026 → 23.
- **Parité** : identique.

### RM-19 — Imputation d'un avoir sur une facture

- **Source** : `regles-avoir.ts#resteAImputer/statutImputation/montantImputable/refusImputationAvoir` ; `queries/factures.ts:423` (`imputerAvoir`) ; `app.js:6411, 10975, 11000`.
- **Règle** :
  - crédit = |centimes(ttc avoir)| ; imputé = centimes(Σ règlements de l'avoir) ; reste = crédit − imputé, 0 si < 0,005 ; statut **Imputé** (reste nul) / **Disponible** (rien imputé) / **Partiellement imputé** ;
  - montant imputable = centimes(min(max(0, reste facture), max(0, reste avoir))) ; refusé si ≤ 0,004 ;
  - contrôles et messages, dans l'ordre : « Avoir introuvable. » → « Facture introuvable. » → « Ce document n'est pas un avoir. » → « Un avoir ne s'impute pas sur un autre avoir. » → facture sans numéro « Cette facture n'est pas émise : il n'y a rien à solder. » → clients différents (noms trimés, si les deux sont renseignés) « Cet avoir a été établi pour X : il ne peut pas solder une facture de Y. » → montant ≤ 0 → « Cet avoir est déjà entièrement imputé. » → « Cet avoir ne dispose plus que de N,NN €. » → reste facture ≤ 0 → « La facture ne doit plus que N,NN €. » ;
  - écriture : **deux règlements** de même montant et même date : sur la facture (mode `avoir`, référence = n° de l'avoir) et sur l'avoir (mode `imputation`, référence = n° de la facture) ; puis statut resynchronisé sur les deux pièces ;
  - lettrage : exactement 2 pièces sélectionnées, 1 avoir + 1 facture numérotée.
- **Exemples** : `resteAImputer(-682, [])` = 682 ; `resteAImputer(-682, [200])` = 482 ; `statutImputation(-682, [])` / `[200]` / `[682]` = disponible / partiellement_impute (imputé 200, reste 482, ttc −682) / impute ; `montantImputable(500, 682)` = 500 ; `(900, 682)` = 682 ; `(1000, 682.4)` = 682.4.
- **Parité** : identique (arrondi : D-02).

---

## 6. Délais de paiement et échéances

### RM-20 — Délai retenu

- **Source** : `regles-efacture.ts#delaiPaiementRetenu` ; SQL dans `bc_generer_facture`.
- **Règle** : délai du **client** (y compris **0** = à réception : `??`, pas `||`) → délai de la **société** (`reglages.documents.delaiPaiementJours` / `modeDelaiPaiement`) → **30 jours net**. Mode inconnu → `net`. Client B2C : « reception » proposé par défaut au changement de type.
- **Exemples** : `{delaiPaiementJours: 0}` → {0, net} ; client vide, société 45 fin de mois → {45, fin_de_mois} ; rien → {30, net}.
- **Parité** : identique.

### RM-21 — Calcul de l'échéance

- **Source** : `regles-efacture.ts#dateEcheance` (miroir de la fonction SQL `date_echeance`).
- **Règle** (en **UTC**, sur `AAAA-MM-JJ`) : `net` = date + N jours ; `fin_de_mois` = **dernier jour du mois de la facture + N jours** (`Date.UTC(a, mois + 1, N)`) ; date malformée → `""`. Échéance saisie à la main respectée ; recalcul seulement si l'échéance est « automatique ».
- **Exemples** :

| Date, délai | Échéance |
|---|---|
| 2026-01-15, 45 fin de mois | 2026-03-17 |
| 2026-01-31, 30 net | 2026-03-02 |
| 2026-01-31, 30 fin de mois | 2026-03-02 |
| 2026-12-15, 30 fin de mois | 2027-01-30 |
| 2026-12-15, 60 net | 2027-02-13 |
| 2026-02-10, 0 fin de mois | 2026-02-28 |
| 2024-02-10, 0 fin de mois | 2024-02-29 |
| `""` ou `15/01/2026` | `""` |

- **Parité** : identique. La convention « fin de mois puis + N jours » est l'une des deux lectures admises de L441-10 ; ne pas la changer sans décision (D-15), la RPC SQL en dépend.

### RM-22 — Libellé et préréglages du délai

- **Source** : `regles-efacture.ts#libelleDelaiPaiement/DELAIS_PREREGLES` ; SQL `libelle_delai_paiement`.
- **Règle** : préréglages `reception` (0 net), `net30`, `net45`, `net60`, `fdm30`, `fdm45`, `fdm60` ; autre valeur → « autre » conservé. Libellé figé sur la facture dans `conditions_reglement` (BT-20) avec `delai_paiement_jours`, `delai_paiement_mode`, `mode_paiement` (défaut virement).
- **Exemples** : 0 → « Paiement à réception » ; 30 net → « 30 jours net » ; 45 fdm → « 45 jours fin de mois ».
- **Parité** : identique.

### RM-23 — Plafonds légaux (art. L441-10) : signalés, jamais bloqués

- **Source** : `regles-efacture.ts#delaiHorsPlafond` (`PLAFOND_NET_JOURS = 60`, `PLAFOND_FIN_DE_MOIS_JOURS = 45`).
- **Exemples** : 61 net → « Au-delà des 60 jours nets de l'art. L441-10. » ; 60 net → rien ; 46 fdm → « Au-delà des 45 jours fin de mois de l'art. L441-10. ».
- **Parité** : identique (avertissement, pas de refus).

### RM-24 — Validité d'un devis

- **Source** : `app.js:3956` (`validiteDevis`).
- **Règle** : « Valable jusqu'au » = `dateEcheance(date, {jours: validiteDevisJours, mode: net})`, **30 j par défaut** ; rien si ≤ 0.
- **Exemple** : devis du 2026-09-24, 30 j → 2026-10-24.
- **Parité** : identique.

---

## 7. Identifiants et identité figée

### RM-30 — Identité de l'émetteur figée sur la facture

- **Source** : `regles-emetteur.ts#identiteEmetteur/identiteManquante` ; `app.js:4032, 11871`.
- **Règle** : 9 colonnes `emetteur_*` posées au plus tard à l'émission : nom = raison sociale légale sinon nom ; SIREN = siren sinon 9 premiers chiffres du SIRET ; pays défaut FR ; `""` → `null`. Le PDF lit ces colonnes **avant** les réglages courants (tél. et e-mail restent courants). Un avoir reprend l'identité **de la facture d'origine**.
- **Parité** : identique.

### RM-31 — SIREN, SIRET, TVA intracommunautaire

- **Source** : `regles-efacture.ts:185-197` (`sirenValide`, `siretValide`, `cleTvaFr`, `tvaIntracomFr`).
- **Règle** : SIREN 9 chiffres, SIRET 14, contrôle de Luhn ; exception La Poste (SIREN `356000000` : somme des chiffres du SIRET % 5 = 0). Clé TVA FR = (12 + 3 × (SIREN mod 97)) mod 97, sur 2 chiffres ; TVA = `FR` + clé + SIREN. Mal formé → refus d'enregistrer ; manquant → accepté.
- **Exemples** : 732829320 → FR44732829320 ; 552100554 → FR96552100554 ; 404833048 → FR83404833048 ; 12345678 (8 chiffres) → null.
- **Parité** : identique.

---

## 8. Numérotation

### RM-40 — Format, compteur, séries

- **Source** : SQL `numero_suivant_interne`, `prochain_numero` (schéma §5.1) ; `queries/parametres.ts#apercuNumero`.
- **Règle** :
  - format **`PREFIXE-AAAA-NNNNNN`** (6 chiffres depuis le 21/09/2026) ; compteur par (société, type, année) dans `compteurs`, incrément atomique par `INSERT … ON CONFLICT DO UPDATE` ; les compteurs repartent à 1 chaque année civile ;
  - préfixes par défaut : devis `DEV`, facture `FAC`, avoir `AV`, acompte `ACO`, sav `SAV`, intervention `INT`, sinon 3 premières lettres en capitales ; préfixe réglable par société (Réglages › Numérotation) ;
  - RPC `prochain_numero(p_societe, p_type, p_annee = année courante)` : exige `peut_ecrire` ; **refuse** `facture`, `avoir`, `acompte` (« attribué à son émission, pas à la demande ») ;
  - **devis** : numéro demandé **à la première écriture**, brouillon compris (un trou dans la série est toléré) ; **intervention** : à la création ; **SAV** : à la création.
- **Exemples** : aperçu `apercuNumero('FAC', 41, 2026)` → FAC-2026-000042 (valeur = dernier numéro attribué) ; premier devis 2026 → DEV-2026-000001.
- **Parité** : identique (la numérotation reste en base) ; voir D-10 pour la secrétaire.

### RM-41 — Numéros d'un bon de commande

- **Source** : SQL `bc_attribuer_numero_interne`, `ref_bc_client` ; `regles-bc.ts#refBonCommandeClient` ; `app.js:8271, 8431`.
- **Règle** : `numero_interne` = `BC-AAAA-NNNNNN`, posé par la base à l'INSERT, année = `date_reception` sinon `date` sinon aujourd'hui. `numero_bc` = **référence du client** (pas de série) ; vide → « En attente de BC » ou « Sans BC ». Référence client BT-13 = première ligne de `numero_bc`, en écartant `""`, `SAV-…`, « Sans BC », « En attente de BC ».
- **Exemples** : `"  BC-123 \nautre"` → `BC-123` ; `SAV-4`, `Sans BC`, `En attente de BC`, `""`, `null` → `null` ; `numeroBCSaisissable(" En attente de BC ")` → `""`.
- **Parité** : identique ; **écart proposé (D-16)** : la ligne de compteur `bon_commande` n'existe que pour 2026 (préfixe `BC`) → en 2027, `BON-2027-000001` ; ajouter `bon_commande → BC` aux préfixes par défaut.

### RM-42 — Numéro de facture : à l'émission, par la base

- **Source** : SQL `facture_attribuer_numero` (déclencheur `factures_numero_a_l_emission`), `facture_numero_immuable` ; `app.js:6242`.
- **Règle** :
  - un **brouillon n'a pas de numéro** ; le numéro est attribué au passage à tout statut ≠ `brouillon` si le numéro est vide ; l'écran ne le demande jamais (art. 242 nonies A) ;
  - refus si la facture n'a **aucune ligne de type `ligne`** (BG-25) : créer en brouillon, poser les lignes, puis émettre ;
  - série selon `type_document` (facture → FAC, avoir → AV, acompte → ACO) ; **année de la pièce** (`date`), pas du jour ;
  - numéro fourni (import) → conservé, compteur non consommé ;
  - un numéro attribué **ne change plus**, et une facture numérotée **ne se supprime pas** ;
  - `factures.statut` a pour défaut **`impayée`** : ne rien préciser = émettre.
- **Exemples** : facture brouillon datée du 28/12/2026 émise le 03/01/2027 → FAC-**2026**-… ; émission sans ligne → exception `check_violation` « Facture sans ligne : aucun numéro ne peut lui être attribué (règle BG-25…) ».
- **Parité** : identique.

### RM-43 — Avoir : conditions d'établissement

- **Source** : `regles-avoir.ts#refusAvoir`, `queries/factures.ts#createAvoir`.
- **Règle** : refus si facture introuvable, **sans numéro** (« modifiez-la directement »), si c'est **déjà un avoir** (« il faut refacturer »), ou si le motif trimé a **moins de 5 caractères**. L'avoir copie l'en-tête (sans devis, BC, intervention), l'identité émetteur de l'origine, les mêmes lignes en montants positifs, `facture_rectifiee_id`, `motif_rectification` ; numéroté dans la série **AV** à l'émission.
- **Parité** : identique.

### RM-44 — Factures de sous-traitant (`FST`)

- **Source** : `app.js:5717-5800`.
- **Règle actuelle** : unitaire `FST-` + `numeroBC` sans espaces (sinon `FST-` + 6 premiers caractères de l'id) ; groupée mensuelle `FST-M<AAAA-MM>` puis `-2`, `-3`… selon le nombre de factures déjà en mémoire commençant par ce préfixe ; naissent `impayée`.
- **Exemples** : `numeroBC = "BC 45 12"` → `FST-BC4512` ; le 24/09/2026 avec 0 / 1 / 2 factures `FST-M2026-09*` → `FST-M2026-09` / `FST-M2026-09-2` / `FST-M2026-09-3`.
- **Parité** : **écart proposé (D-05)** — numérotation côté client, non transactionnelle, comptée toutes sociétés confondues.

---

## 9. Statuts et transitions

### RM-50 — Devis

- **Source** : `app.js:4514, 4653` ; énumération `devis_statut`.
- **Règle** : `brouillon | envoyé | accepté | refusé`, défaut `brouillon`, reconduit à l'enregistrement. L'ancien écran n'offre **aucun geste** de transition. Transformer en facture est refusé si une facture porte déjà ce `devis_id` ; créer un BC est refusé si le devis est déjà lié. Taux de conversion du mois = acceptés / devis datés du mois (3 dont 1 → 33).
- **Parité** : identique sur les valeurs ; **écart proposé (D-17)** : ajouter les gestes « Marquer envoyé / accepté / refusé » (additif, sans effet sur les calculs).

### RM-51 — Facture : statuts et verrous

- **Source** : `regles-verrouillage.ts#verrouFacture` ; déclencheurs `factures_entete_figee`, `facture_lignes_figees` ; `app.js:4325, 11898, 11913`.
- **Règle** :
  - cycle : `brouillon` → (Émettre, admin|secrétaire) `impayée` + numéro → `payée` quand le reste est nul ; `envoyée` existe dans l'énumération mais n'est plus produite ;
  - verrou **`emise`** : numéro présent → irréversible (art. L441-9). En base : en-tête gelé sauf liste blanche (`statut`, `statut_cycle`, `depose_le`, `pdp_identifiant`, `pdp_transmission_id`, `verrouillee`, `conducteur(_id)`, `interlocuteur`, `chantier_id`, `facturation_*`, `identifiant_unique`, `numero`, `maj_le`) ; identité client (`client_id`, `client_siret/siren/tva_intracom/pays_code/code_service/code_routage`) complétable si vide ; lignes figées **même pour un admin** ;
  - verrou **`telechargee`** : `verrouillee = true` posé à l'impression ou à l'envoi par e-mail d'une facture **non numérotée**, avec l'instantané d'identité ; réversible (« Déverrouiller ») ;
  - priorité `emise` > `telechargee` > aucun.
- **Exemples** : `{numero: "FAC-2026-000012"}` → emise ; `{numero: "", verrouillee: true}` → telechargee ; `{numero: ""}` → aucun.
- **Parité** : identique.

### RM-52 — Bon de commande : verrou

- **Source** : `regles-verrouillage.ts#verrouBonCommande` ; déclencheurs `bons_commande_facture_fige`, `bons_commande_facture_indelebile`.
- **Règle** : un bon est figé dès qu'une facture **numérotée** le désigne (un brouillon ne verrouille pas) ; restent modifiables le circuit, le conducteur, l'agenda, le suivi interne, `facturation_*`, la pièce jointe, `numero_interne` ; `metier`, `metiers`, `montant_par_metier` seulement pour une ré-orthographe. Un bon facturé ne se supprime pas.
- **Parité** : identique.

### RM-53 — Circuit du bon de commande

- **Source** : RPC `bc_*` (schéma §5.3) ; `regles-bc.ts` ; `app.js:7055, 7069, 7082`.
- **Règle** :
  - `statut_workflow` : `en_cours → pret_a_chiffrer` (toutes tâches validées, ≥ 1) `→ chiffre` (admin ; refus s'il reste un travail `a_chiffrer`) `→ facture` (`bc_generer_facture`, admin|secrétaire) ; ou `→ cloture_gratuit` (admin, depuis tout sauf `facture`) ; hors circuit : `en_cours|pret_a_chiffrer → chiffre` (admin, journalisé). Ne change **que par RPC**.
  - Dérivés : `valideConducteur` = toutes les tâches validées et au moins une ; `valideDirecteur` = `statut_workflow ∈ {chiffre, facture}`.
  - Étape affichée : facture liée → Facturé ; validé directeur → À facturer ; validé conducteur → À valider directeur ; tâches terminées (`nbTaches > 0` et aucune non pointée) → À valider conducteur ; sinon Travaux à pointer.
  - File de validation : `hors_file` (validé directeur, ou 0 tâche) ; `pret` (validé conducteur) ; `travaux_en_cours` (au moins une tâche pointée) ; sinon `hors_file`.
- **Exemples** : `bcTachesTerminees({nbTaches: 0})` → faux ; `{2, []}` → vrai ; `{2, ['x']}` → faux ; `etapeValidation({3, nonPointées: ['a']})` → travaux_en_cours ; `{2, ['a', 'b']}` → hors_file ; `bcInterventionFaite({})` → faux ; `{datePlanifiee, dateOrigineFait: true}` → vrai.
- **Parité** : identique.

### RM-54 — Tâches de planning

- **Source** : `regles-taches.ts` ; RPC `tache_marquer_realisee`, `tache_valider`, `tache_sauvegarder_terrain`.
- **Règle** : naissance `planifiee` ; `planifiee|refusee → realisee` (terrain **de l'équipe** ; tâche sans équipe : encadrement) ; `realisee → validee|refusee` (admin|conducteur ; refus motivé) ; une tâche `validee` est close. Créneau : 08:00, 1 h par défaut, 1 à 8 h, modifiable si `planifiee|refusee`. Retour au planning refusé si une tâche est validée.
- **Parité** : identique.

### RM-55 — Travaux supplémentaires

- **Source** : `app.js:7266-7330, 8041, 8121` ; CHECK `tache_travaux_supplementaires.statut`.
- **Règle** : `a_chiffrer` → `chiffre` au premier prix (≥ 0, virgule acceptée, quantité 1 et unité `u` par défaut) → `integre` quand il devient une ligne du bon (écrire les lignes **d'abord**, le statut ensuite) ; `refuse` à la clôture gratuite. Origine `conducteur` si l'auteur est conducteur ou admin, sinon `technicien`.
- **Parité** : identique ; **écart proposé (D-18)** : la validation hors circuit doit aussi intégrer les travaux chiffrés.

---

## 10. Situations de travaux (avancement DPGF)

### RM-60 — Totaux du DPGF

- **Source** : `app.js:13162-13164, 13968-13969` ; vue `v_chantier_avancement`.
- **Règle** : total HT = Σ qte × PU (lignes non chapitres) ; déjà facturé = Σ qte × PU × avancement cumulé / 100 ; reste = total − facturé ; % d'avancement = `round(facturé / total × 100)` (0 si total nul). Ligne à 100 % non sélectionnable.
- **Exemple** : chapitre + 10 × 45,5 à 30 % + 2 × 1 200 à 100 % + 1 × (PU vide) → total 2 855 ; facturé 2 536,5 ; reste 318,5 ; % 89.
- **Parité** : identique.

### RM-61 — Montant d'une situation

- **Source** : `app.js:13305, 13326`.
- **Règle** : nouveau % = `max(déjà, min(100, parseFloat(saisie) || déjà))` ; à facturer = montant ligne × (nouveau − déjà) / 100 ; si rien à facturer sur toute la sélection → « Aucun avancement supplémentaire ». Boutons 25 / 50 / 75 / 100 %, seulement au-dessus du déjà facturé.
- **Exemples** :

| Montant ligne, déjà, saisie | Nouveau %, à facturer |
|---|---|
| 12 345,67 ; 0 % ; 33 | 33 ; **4074.0710999999997** |
| 1 000 ; 25 % ; 60 | 60 ; 350 |
| 1 000 ; 25 % ; 10 (baisse) | 25 ; 0 |
| 1 000 ; 25 % ; 0 | 25 ; 0 |
| 1 000 ; 25 % ; 150 | 100 ; 750 |

- **Parité** : formule identique ; **écart proposé (D-08)** sur l'arrondi et l'ordre des écritures.

### RM-62 — Facture de situation

- **Source** : `app.js:13315`.
- **Règle** : une ligne par ligne DPGF avancée : `{type: ligne, designation: "<désignation> (avancement X% → Y%)", qte: 1, prixUnitaire: à facturer, tva: tvaDefaut()}` ; facture **brouillon**, sans numéro (numérotée à l'émission), remise 0, échéance vide, `chantier_id`, notes « Situation de travaux — <nom du chantier> ». Pas de retenue de garantie, pas d'acompte, pas de rappel des situations antérieures ; le cumul vit dans `avancement_cumule`.
- **Parité** : identique pour la facture ; **écart proposé (D-08)**.

---

## 11. Droits, sociétés, portail, formats

### RM-70 — Indicateurs d'encaissement

- **Source** : `app-1.md §2.4`.
- **Règle** : impayés = Σ des restes des factures non réglées, **avoirs exclus** ; taux encaissé = `max(0, round((1 − impayés / Σ TTC signés) × 100))` (Σ TTC inclut les avoirs négatifs ; 1 si nul).
- **Exemple** : Σ TTC 10 000, impayés 2 500 → 75.
- **Parité** : identique ; **écart proposé (D-19)** pour le CA (brouillons exclus).

### RM-90 — Permissions

- **Source** : `role_permissions`, `a_permission`, `voit_les_prix`, `peut_ecrire` ; `integrations/permissions.ts`, `session.ts:624`, `regles-taches.ts:121`. Matrice complète : `INVENTAIRE.md` §1.6.
- **Règle** : un geste est permis si `a_permission(société, module, action)` ; la base refuse, l'écran masque ce qui serait refusé. Règles hors matrice : prix invisibles au technicien et au sous-traitant ; pré-facture modifiable par admin|secrétaire, validée par admin ; hors circuit, chiffrage validé, clôture gratuite : admin ; génération de facture : admin|secrétaire ; tâches : RM-54.
- **Exemples** : conducteur → `factures` voir seulement (pas de bouton Émettre) ; secrétaire → `bons_commande` voir + modifier, pas créer ; technicien → aucun onglet Devis, Factures, Clients, Catalogue.
- **Parité** : identique ; **écart proposé (D-10)** pour `peut_ecrire`.

### RM-91 — « Voir en tant que »

- **Source** : `session.ts:317` ; `app.js:101, 908`.
- **Règle** : réservé à l'admin réel ; rôle effectif = simulé ?? réel ; tous les masquages utilisent le rôle effectif ; la base continue d'appliquer le rôle réel. Mémorisé par navigateur.
- **Parité** : identique ; afficher un bandeau pendant la simulation (ajout).

### RM-92 — Multi-sociétés

- **Source** : schéma §1.1, §6.3 ; `session.ts#chargerSession`.
- **Règle** : un compte voit les sociétés dont il est membre actif (profil actif) ; rôle par société ; toutes les lectures sont restreintes à la société active ; changer de société recharge tout et ferme les formulaires ; numérotation, réglages, notifications et couleurs sont par société ; les pièces jointes sont rangées sous `<societe_id>/…`.
- **Parité** : identique.

### RM-93 — Accès client (portail)

- **Source** : `app.js:6529-6600, 12213` ; schéma §1.4, §6.5.
- **Règle actuelle** : **aucune** en base (pas de rôle client, pas de politique). L'écran mort prévoyait : un client ne voit que ses bons (et un interlocuteur que les siens), 4 couleurs d'état (vert : faits ; jaune : pièce à commander ; orange : planifié ; rouge : sinon ; tri rouge, jaune, orange, vert puis numéro), recherche limitée à 13 champs, **aucun montant ni note interne**.
- **Parité** : **écart proposé (D-09)**.

### RM-80 — Montants affichés

- **Source** : `app.js:625` (`money`), `app.js:626` (mode discret).
- **Règle** : `Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'})` ; valeur absente → 0 ; mode discret → `••• €`.
- **Exemples** : 1234.5 → « 1 234,50 € » (U+202F entre milliers, U+00A0 avant €) ; −682 → « -682,00 € » ; 0.005 → « 0,01 € » ; `undefined` → « 0,00 € ».
- **Parité** : identique.

### RM-81 — Dates

- **Source** : `app.js:781` (`todayISO`), `fmtDate` ; `CLAUDE.md`.
- **Règle** : « aujourd'hui » = composantes **locales** (`todayISO()`), jamais `toISOString()` (avant 1 h à Paris, il renvoie la veille) ; affichage `JJ/MM/AAAA`, vide → « — », forme inconnue rendue telle quelle ; échéances calculées en UTC pur (RM-21) ; regroupement par mois sur la chaîne `AAAA-MM`, pas par `new Date().getMonth()`.
- **Exemples** : `fmtDate('2026-09-24')` → 24/09/2026 ; `''` → — ; `'2026-09'` → 2026-09.
- **Parité** : identique.

### RM-82 — Taux et nombres saisis

- **Source** : `regles-totaux.ts#formaterTaux` ; `app.js:3524, 7652`.
- **Règle** : taux affiché « 5,5 % », « 20 % » ; champs **texte** jamais passés à `parseFloat` (désignation, commentaire, unité, code article, métier) ; montants saisis : virgule ou point.
- **Parité** : identique ; **écart** : colonne TVA du PDF en « 5,5 % » (l'ancien PDF imprime « 5.5% »).

---

## 12. Décisions proposées (à inscrire dans `DECISIONS.md`)

Décisions **prudentes** : ne rien changer à ce qui est légal ou stocké sans nécessité, corriger ce
qui perd des données ou contredit la base, et ajouter plutôt que modifier.

| Id | Règle | Défaut constaté | Décision proposée |
|---|---|---|---|
| D-01 | RM-09, RM-13 | Totaux en flottants, arrondis nulle part ; montant de BC arrondi en silence par `numeric(14,2)` ; PDF et Factur-X peuvent différer d'un centime | Calculer comme la base (même formule, aucun arrondi intermédiaire) ; arrondir au centime **une fois**, à l'affichage et avant tout envoi d'un montant stocké en `numeric(14,2)` ; tests de parité contre `v_facture_totaux` à 0,005 près. Ne pas changer la formule. |
| D-02 | RM-10 | Deux arrondis au centime (`arrondiCentime`, `centimes`) | Une seule fonction, `arrondiCentime`, partout (règlements, avoirs, filtres, métiers). Les cas ne diffèrent que sur les demi-centimes. |
| D-04 | RM-15 | `estAvoir` (`includes`) vs `estAvoirDocument` (`===`) | Comparer l'énumération : `type_document === 'avoir'`. |
| D-05 | RM-44 | Numéros `FST` calculés côté client, non transactionnels, toutes sociétés | Ne pas reproduire dans cette phase : afficher les factures ST existantes en lecture ; une série `FST` en base (compteur) sera décidée avec le module sous-traitant. |
| D-06 | FAC-91 | « Marquer payée » écrit `payée` sans règlement | Ne pas reproduire : « payée » découle d'un règlement enregistré. |
| D-07 | RM-14, RM-17 | Solde recalculé côté client ; `v_facture_solde` ignore acomptes, retenue et signe des avoirs | Reproduire `regles-reglements` à l'identique pour l'affichage ; ne pas reprendre `calculerSoldeFacture` ; ouvrir une migration pour que la base pose `factures.statut` (et que la vue traite les avoirs) avant d'en dépendre. |
| D-08 | RM-61, RM-62 | Avancement écrit avant la facture, sans contrôle ; PU non arrondi ; `chantier_avancement_factures` jamais écrite | Créer la facture brouillon **puis** l'avancement, idéalement dans une RPC transactionnelle ; arrondir le montant à facturer au centime (nouvelle pièce, pas de pièce existante modifiée) ; écrire `chantier_avancement_factures`. |
| D-09 | RM-93 | Portail client mort, sans rôle ni RLS | Écarter le module de cette phase (`[-]`) ; le concevoir plus tard **en base d'abord** (rôle ou table de rattachement compte ↔ client, vue sans montants), jamais par un sélecteur d'écran. |
| D-10 | RM-40, RM-90 | Secrétaire hors `peut_ecrire` : ne peut pas numéroter un devis ni écrire plusieurs référentiels | Migration : `prochain_numero` contrôle `a_permission(<module du type>, 'creer')` au lieu de `peut_ecrire` ; revoir les politiques fondées sur `peut_ecrire` module par module. En attendant, la nouvelle app affiche le refus de la base. |
| D-12 | RM-01 | Saisie « 1,5 » tronquée à 1 si elle arrive en chaîne | Accepter la virgule décimale à la saisie (conversion explicite) ; le calcul reste identique. |
| D-13 | RM-04 | Réglage TVA vide → 0 % silencieux | Retomber sur 10 % (défaut documenté) quand le réglage est vide ou invalide. |
| D-14 | RM-07 | « 40.00 € » avec un point dans les mentions | Formater en fr-FR (« 40,00 € »). Sans effet légal. |
| D-15 | RM-21 | Convention « fin de mois + N jours » | Garder à l'identique (la RPC SQL `date_echeance` est la même) ; la documenter à l'écran. |
| D-16 | RM-41 | Préfixe BC absent en 2027 (`BON-2027-…`) | Migration : préfixe par défaut `bon_commande → BC` dans `numero_suivant_interne`, avant le 01/01/2027. |
| D-17 | RM-50 | Aucun geste de transition de devis | Ajouter les gestes Envoyé / Accepté / Refusé (additif). |
| D-18 | RM-55 | Validation hors circuit sans intégration des travaux chiffrés | Intégrer les travaux chiffrés avant la validation hors circuit, comme la voie normale. |
| D-19 | RM-70 | CA calculé brouillons compris, « encaissé » = statut `payée` daté de la facture | Exclure les brouillons du CA ; CA encaissé = Σ règlements datés de la période. Changement d'indicateur : à annoncer. |
| D-20 | CHA-50, RH-20, VEH-20, VEH-21, PAR-20 | Données saisies sans colonne, perdues au rechargement (DPGF, to-do, prêts, entretiens, CT, absences, documents ST) | Écrire dans les tables filles qui existent déjà (`chantier_dpgf_lignes`, `chantier_todos`, `vehicule_prets`, `vehicule_entretiens`, `materiel_prets`, `salarie_absences`, `sous_traitant_documents`, `vehicules.date_controle_technique`) ; ne jamais filtrer un champ en silence. |
| D-21 | BC-95 | `bc_generer_facture` force le virement, ne recopie pas `conducteur_id`, forfait TVA 10 | Migration : recopier `clients.mode_paiement` et `conducteur_id` ; forfait au taux `tvaDefaut` de la société. |
