# Inventaire de parité — ERP Chantier (ancienne app → `web/`)

Checklist de ce que l'ancienne application fait réellement, relevée le 24/09/2026 dans
`src/pages/app.js` (20 298 lignes), `src/api/**`, `src/integrations/**` et `supabase/**`.
C'est **elle** qui dit ce qui manque à la nouvelle application. Le détail (code verbatim,
vecteurs chiffrés, numéros de ligne complets) est dans [`inventaire-brut/`](inventaire-brut/) ;
les règles de calcul prescriptives sont dans [`regles-metier.md`](regles-metier.md).

## Comment la lire

- Une section par **module cible** de la nouvelle app (dossier `web/src/modules/<module>`).
  Les modules après « Hors périmètre de cette nuit » ne sont pas visés tout de suite, mais leurs
  lignes restent ici pour que rien ne se perde.
- Dans chaque section : **Écrans et fonctionnalités**, **Règles métier**, **Données**,
  **Cas limites et corrections cachées**, **Défauts connus de l'ancienne app**.
- Chaque ligne porte un **identifiant stable** (`CLI-07`) : on ne renumérote jamais, on ajoute
  à la suite. Un test ou un commit qui couvre une ligne cite son identifiant.
- **Source** : `app.js:NNNN` = `src/pages/app.js`, ligne ; les fichiers TS sont cités depuis
  `src/` ; `schéma §x` et `ts §x` renvoient aux sections de `inventaire-brut/schema.md` et
  `inventaire-brut/couche-ts.md` ; `RM-xx` renvoie à `regles-metier.md`.

### Légende

| Case | Sens |
|---|---|
| `- [ ]` | à faire |
| `- [x]` | fait — la ligne cite sa **preuve** (nom du test, ou écran + geste qui le montre) |
| `- [~]` | partiel — la ligne dit ce qui manque |
| `- [-]` | volontairement écarté — renvoi obligatoire à une entrée de `DECISIONS.md` |

Pour les « Défauts connus », `- [ ]` signifie « **décision à prendre** » : soit on corrige
(la ligne passe à `[x]` avec son test), soit on reproduit à l'identique ou on écarte (`[-]`,
avec l'entrée `DECISIONS.md`). Aucune ligne n'est cochée à ce jour.

---

## 1. auth-roles — connexion, rôles, droits

### Écrans et fonctionnalités

- [ ] **AUTH-01** Connexion e-mail + mot de passe (`signInWithPassword`) ; succès → `location.replace('/')` (pas `href` : « Précédent » ne ramène pas au formulaire). _Source : `pages/login.html:256-359`_
- [ ] **AUTH-02** Session déjà ouverte à l'arrivée sur la page de connexion → redirection immédiate vers l'app. _Source : `login.html`_
- [ ] **AUTH-03** « Mot de passe oublié ? » → `resetPasswordForEmail` vers `/nouveau-mot-de-passe.html` ; message **neutre** (« Si un compte existe pour X, un lien… »). _Source : `api/client.ts#demanderReinitialisation`, `login.html`_
- [ ] **AUTH-04** Page « nouveau mot de passe » ouverte par la session `recovery`. _Source : `pages/nouveau-mot-de-passe.html`_
- [ ] **AUTH-05** Cartouche de connexion : date du jour, **aucune société** affichée (on ne sait pas encore chez qui l'on entre). _Source : `login.html`_
- [ ] **AUTH-06** Garde de route : pas de session → `/login.html`. _Source : `integrations/auth-guard.ts#protectRoute`, `main.ts`_
- [ ] **AUTH-07** Démarrage ordonné : matrice des droits installée → sociétés visibles → rôle par société → annuaire des comptes → rendu. _Source : `main.ts`, `integrations/session.ts#chargerSession`_
- [ ] **AUTH-08** Compte sans société → « Ce compte n'est rattaché à aucune société. Demandez une invitation à un administrateur. » _Source : `main.ts`_
- [ ] **AUTH-09** Délai de démarrage de 15 s → message « La couche de données n'a pas répondu… ». _Source : `app.js:19126-19187`_
- [ ] **AUTH-10** Session expirée (PGRST301 / 401 / JWT) détectée au chargement → retour à la connexion ; `SIGNED_OUT` vide le cache. _Source : `app.js:557`, `main.ts#watchAuthState`_
- [ ] **AUTH-11** Déconnexion depuis le menu utilisateur. _Source : `app.js:1308` (`logOut` → `seDeconnecter`)_
- [ ] **AUTH-12** Menu utilisateur : nom, rôle, version construite copiable. _Source : `app.js:895, 902, 908`_
- [ ] **AUTH-13** « Voir en tant que » : l'**admin réel** seul simule un autre rôle (6 rôles, icônes) ; mémorisé dans `localStorage["erp.role.simule"]`, restauré au changement de société, effacé si le rôle réel n'est pas admin. _Source : `app.js:101, 908` ; `session.ts:317`_
- [ ] **AUTH-14** Le rôle simulé ne change **rien** en base (RLS au rôle réel) : il ne sert qu'à masquer. Bandeau visible quand on simule (absent de l'ancienne app — décidé : D-010). _Source : `session.ts:317`_
- [ ] **AUTH-15** Menu latéral filtré : onglet visible ⇔ `voir` sur son module (table §1.6). _Source : `app.js:93` (`navPourRole`), `integrations/permissions.ts#MODULE_PAR_NAV`_
- [ ] **AUTH-16** Onglet courant non autorisé après changement de rôle/société → premier onglet autorisé. _Source : `app.js:19126-19187`_
- [ ] **AUTH-17** « Mon nom » (Réglages › Mon compte) → `profiles.nom` (politique `profiles_update_self`). _Source : `app.js:12277`, `queries/acces.ts#definirMonNom`_
- [ ] **AUTH-18** Invitation d'un salarié à créer son compte (zone de la fiche salarié) : envoyer, renvoyer, annuler ; visible seulement avec `utilisateurs/creer` (admin). _Source : `app.js:16391, 16431, 16460`_
- [ ] **AUTH-19** Rôle proposé à l'invitation : `conducteur` si une fiche conducteur existe, sinon `technicien` ; rôles invitables : technicien, conducteur, secrétaire, lecture, admin (admin avec confirmation) ; `sous_traitant` exclu. _Source : `app.js#roleProposePourSalarie`, Edge `inviter-salarie`_
- [ ] **AUTH-20** Changer le rôle d'un compte (`membres_societe.role`), issues `change | inchange | absent | refuse` ; proposé par `confirm` quand on coche « Conducteur de travaux ». _Source : `app.js:16183`, `queries/acces.ts#definirRoleDuCompte`_

### Règles métier

- [ ] **AUTH-30** Six rôles, énumération `role_membre` : `admin` Administrateur, `secretaire` Secrétaire, `conducteur` Conducteur de travaux, `technicien` Technicien, `lecture` Lecture seule, `sous_traitant` Sous-traitant (entreprise). **Il n'existe pas de rôle `client`.** _Source : schéma §1.4, `app.js:84`_
- [ ] **AUTH-31** Rôle **par société** (`membres_societe(profile_id, societe_id, role, actif)`, unique par couple) ; un compte peut appartenir à plusieurs sociétés avec des rôles différents. _Source : schéma §1.3_
- [ ] **AUTH-32** Accès effectif ⇔ `membres_societe.actif` **et** `profiles.actif` ; désactiver le profil coupe toutes les sociétés d'un coup. _Source : schéma §5.2 `role_dans_societe`, §6.3_
- [ ] **AUTH-33** La matrice `role_permissions(role, module, action)` (actions `voir|creer|modifier|supprimer`) est **lue en base** au démarrage ; lecture tronquée ou vide = refus de démarrer ; `peut()` lève tant qu'elle n'est pas installée. _Source : `integrations/permissions.ts`, `queries/acces.ts#listRolePermissions`_
- [ ] **AUTH-34** Reproduire la matrice complète (184 lignes) du tableau §1.6 ; elle ne s'écrit que par migration. _Source : migrations `20260911110000`, `20260914120000` ; schéma §5.2_
- [ ] **AUTH-35** `voitLesPrix(role)` = rôle ∉ {technicien, sous_traitant} (miroir SQL `voit_les_prix`) : aucun montant affiché au terrain. _Source : `permissions.ts`, schéma §5.2_
- [ ] **AUTH-36** `actionsFacturation` : `peutModifierPrefacture` = admin, secrétaire ; `peutValiderPrefacture` = admin ; `peutFacturer` = admin, secrétaire ; `peutFacturerHorsCircuit` = admin. _Source : `session.ts:624`_
- [ ] **AUTH-37** `actionsTache(statut, rôle, appartenance)` : planifier = admin|conducteur ; saisir/clôturer = terrain **de l'équipe** (ou encadrement), tâche non validée ; arbitrer = admin|conducteur sur tâche `realisee`. _Source : `api/regles-taches.ts:121`_
- [ ] **AUTH-38** Tous les tests d'interface (`autorise`, `affichePrix`, `actionsTache`, `actionsFacturation`) utilisent le **rôle effectif** (simulé ?? réel). _Source : `session.ts`_
- [ ] **AUTH-39** La base fait autorité : l'interface **masque** ce qui serait refusé, elle ne protège rien ; un refus de la base s'affiche avec son motif (`dernierRefus` = `details || hint || message`). _Source : `CLAUDE.md`, `html-adapter.ts`_
- [ ] **AUTH-40** Dernier admin protégé : on ne retire pas son propre rôle admin, on ne supprime pas son propre accès, une société garde au moins un admin actif. _Source : déclencheur `trg_proteger_dernier_admin`, schéma §1.3_
- [ ] **AUTH-41** Premier profil créé quand `membres_societe` est vide → admin de **toutes** les sociétés. _Source : `amorcer_premier_admin`, schéma §1.3_
- [ ] **AUTH-42** Circuit d'inscription : profil créé par déclencheur (`nom` = métadonnée ou partie locale de l'e-mail) ; invitations appliquées à la confirmation de l'adresse (membre, rôle, `salaries.profile_id` ou `sous_traitants.contact_profile_id`, invitation `acceptee`). _Source : schéma §1.3_
- [ ] **AUTH-43** Invitation : refus si le salarié a déjà un compte, si l'adresse appartient à un autre salarié, ou renvoi à moins de 10 min ; une seule invitation `en_attente` par salarié ; unicité `(societe, lower(email))`. _Source : Edge `inviter-salarie`, schéma §1.3, §8.3_
- [ ] **AUTH-44** Le compte d'une personne se relie par `salaries.profile_id` (équipe du technicien), `conducteurs.profile_id` (unique par société : tableau de bord du conducteur), `sous_traitants.contact_profile_id`. _Source : schéma §1.3, `CLAUDE.md`_

### Données

- [ ] **AUTH-50** Tables `profiles` (id = `auth.users.id`, nom, email, actif), `membres_societe`, `invitations` (statut `en_attente|acceptee|annulee|expiree`, `invitee_le`), `role_permissions`. _Source : schéma §1.3, §2.8_
- [ ] **AUTH-51** Fonctions : `mon_role(p_societe)`, `role_dans_societe`, `mes_societes()`, `est_membre`, `est_admin`, `peut_ecrire`, `voit_les_prix`, `a_permission(societe, module, action)`, `est_affecte_au_chantier`, `est_de_l_equipe`, `tache_a_une_equipe`. _Source : schéma §1.4, §5.2_
- [ ] **AUTH-52** Edge Function `inviter-salarie` : `{salarie_id, email, role}` → `{etat: invitee|confirmation_renvoyee|rattachee}` ou `{erreur}` (400/403/404/409/429/500/502). _Source : schéma §8.3_

### Cas limites et corrections cachées

- [ ] **AUTH-60** Le parcours sous-traitant était inatteignable : 24 comparaisons testaient `"soustraitant"` au lieu de `"sous_traitant"`. Tester le rôle par sa valeur d'énumération, jamais par un libellé. _Source : `app.js:17929`_
- [ ] **AUTH-61** Le planning et les réglages lisent `state.currentRole` directement, le reste `roleEffectif()` : un seul point d'accès au rôle dans la nouvelle app. _Source : `app-2.md §2.8`_
- [ ] **AUTH-62** Salutation « Aissa Choumane » affichée pour tout le monde, puis nom refabriqué depuis l'e-mail : afficher `profiles.nom` (`nomAffichable`). _Source : `app.js:1665`_
- [ ] **AUTH-63** « Jean-Pierre » devenait « Jean Pierre » : la mise en forme de casse est réservée aux adresses. _Source : `app.js:964`_

### Défauts connus de l'ancienne app

- [ ] **AUTH-70** La **secrétaire n'est pas dans `peut_ecrire`** : elle ne peut pas appeler `prochain_numero` (donc **pas numéroter un devis**, alors qu'elle a `devis/creer`), ni écrire référentiels, fournisseurs, conducteurs, sous-traitants, métiers, équipes, documents légaux, interlocuteurs, le bucket `terrain`, les photos/contrôles d'intervention, les filles de véhicule. _Source : schéma §10.3-1_
- [ ] **AUTH-71** Suppression trop large dans les tables filles (`rls_table_fille`) : **tout membre, `lecture` compris**, peut supprimer photos et contrôles d'intervention, documents/inspections/todos de chantier, interlocuteurs, documents sous-traitant, filles de véhicule, prêts de matériel, `facture_cycle_vie`. _Source : schéma §10.3-2_
- [ ] **AUTH-72** `chantier_documents|inspections|todos|comptes_rendus` et `planning_taches` ignorent `est_affecte_au_chantier` : technicien et sous-traitant lisent tout. _Source : schéma §10.3-3, §6.5_
- [ ] **AUTH-73** `workflow_journal` accepte l'INSERT de tout membre (fausses transitions possibles). _Source : schéma §10.3-9_
- [ ] **AUTH-74** Deux politiques SELECT identiques sur `profiles`. _Source : schéma §10.3-10_
- [ ] **AUTH-75** Fonctions de déclencheur créées après le 24/09 : `EXECUTE` rendu à `PUBLIC` faute d'`ALTER DEFAULT PRIVILEGES`. _Source : schéma §5.4, §10.3-12_
- [ ] **AUTH-76** `v_salaries_annuaire` a probablement perdu `security_barrier` (recréée sans `WITH` le 21/09) — à vérifier par `pg_class.reloptions`. _Source : schéma §4.2_
- [ ] **AUTH-77** `inviter-salarie` cherche le compte par `listUsers()` sur **une seule page** (50) : un compte existant peut ne pas être trouvé. _Source : schéma §8.3_
- [ ] **AUTH-78** Barre mobile (`MOBILE_NAV`) **non filtrée** par les droits (décidé : un seul menu filtré, D-014). _Source : `app.js:114`_
- [ ] **AUTH-79** Un sous-traitant ne peut pas être invité par l'écran (Edge refuse `sous_traitant`) alors que `invitations.sous_traitant_id` existe : comment un sous-traitant obtient-il son compte ? _Source : schéma §1.3, §8.3_
- [ ] **AUTH-80** `docs/AUTHENTICATION.md` périmé (`membres_societe.user_id`, `created_at`, 4 rôles) : ne pas s'en servir. _Source : schéma §10.2_

### 1.6 Matrice `role_permissions` (état final des migrations)

V voir · C créer · M modifier · S supprimer · — rien. Total 184 lignes (admin 72, secrétaire 45,
conducteur 33, lecture 17, technicien 10, sous-traitant 7).

| Module | admin | secretaire | conducteur | technicien | sous_traitant | lecture |
|---|---|---|---|---|---|---|
| tableau_de_bord | VCMS | V | V | V | V | V |
| chantiers | VCMS | V | VCMS | V | V | V |
| planning | VCMS | V | VCMS | V | V | V |
| bons_commande | VCMS | V M | VCMS | — | — | V |
| devis | VCMS | VCMS | VCM | — | — | V |
| factures | VCMS | VCMS | V | — | — | V |
| facturation_electronique | VCMS | VCMS | — | — | — | V |
| reglements | VCMS | VCMS | — | — | — | V |
| clients | VCMS | VCMS | V | — | — | V |
| rapports | VCMS | V | VCMS | VCM | VCM | V |
| materiel | VCMS | V | VCMS | V M | V | V |
| controle_fournisseurs | VCMS | VCMS | V | — | — | V |
| rh | VCMS | VCMS | V | V | — | V |
| vehicules | VCMS | VCMS | V M | V | — | V |
| statistiques | VCMS | V | V | — | — | V |
| reglages | VCMS | V | V | — | — | V |
| articles | VCMS | VCMS | V | — | — | V |
| utilisateurs | VCMS | — | — | — | — | — |

Onglet → module (`MODULE_PAR_NAV`) : dashboard→tableau_de_bord · bonsCommande→bons_commande ·
piecesCommande→bons_commande · devis · factures · interventions (« Rapports »)→rapports ·
planning · chantiers · clients · catalogue→articles · rh · sousTraitants→rh · vehicules ·
materiel · controle→controle_fournisseurs · reglements · statistiques · parametres
(« Réglages »)→reglages · plus→tableau_de_bord.

Règles hors matrice, codées en dur : `voitLesPrix` (AUTH-35), `actionsFacturation` (AUTH-36),
`actionsTache` (AUTH-37), `peut_ecrire` = admin|conducteur|technicien (AUTH-70),
`bc_chiffrage_valide*` et `bc_cloturer_gratuit` = admin seul, `bc_generer_facture` =
admin|secrétaire. Les modules `tableau_de_bord`, `statistiques` et `utilisateurs` ne servent
qu'à l'interface (aucune politique RLS ne les cite).

- [ ] **AUTH-90** La matrice ci-dessus est-elle toujours celle de la production ? Relire `role_permissions` en base avant de figer les tests (la table a pu évoluer depuis les migrations). _Source : `app-3.md §1.1`_

---

## 2. societes — multi-sociétés et identité légale

### Écrans et fonctionnalités

- [ ] **SOC-01** Sélecteur de société (menu société) : liste des sociétés où l'on est membre, bascule ; refus si non membre. _Source : `app.js:872, 1320` ; `session.ts#choisirSociete`_
- [ ] **SOC-02** Changer de société vide les recherches, ferme les formulaires, recharge toutes les collections de la nouvelle société. _Source : `app.js:1320`_
- [ ] **SOC-03** Société courante au démarrage : la première par ordre alphabétique du nom (session) ; l'ancien écran partait de `'kta'` puis retombait sur la première. _Source : `session.ts#chargerSession`, `app.js:19126`_
- [ ] **SOC-04** Couleur d'accent par société appliquée à l'écran et aux documents (`paletteSociete`, contraste AA 4,5 ; défauts `#FF6A1A` / `#182233`). _Source : `app.js#appliquerCouleurSociete`, `api/regles-theme.ts`_
- [ ] **SOC-05** Réglages › Organisation : identité légale (raison sociale, forme, capital, RCS, NAF, SIREN/SIRET, TVA intracom, adresse, pays), régime de TVA, e-reporting, TVA sur encaissements, autoliquidation bâtiment, pénalités, indemnité de recouvrement (40 € par défaut), décennale, adresse électronique de réception, IBAN/BIC. _Source : `app.js:12354`_
- [ ] **SOC-06** Bandeau de complétude de la société (`completudeSociete`, `recommandationsSociete`). _Source : `app.js:12354`, `api/regles-efacture.ts`_
- [ ] **SOC-07** Enregistrement par **fusion** : un champ absent de l'onglet affiché est conservé, pas vidé ; `verifierEntite` bloque ce qui est mal formé. _Source : `app.js:13030`_
- [ ] **SOC-08** Logo de la société (aujourd'hui data-URL dans les réglages). _Source : `app-2.md §1.13`_
- [ ] **SOC-09** Documents légaux de la société (nom, date de validité, fichier) : alerte à ≤ 30 j, « EXPIRÉ » passé. _Source : `app.js:12957, 19111`_

### Règles métier

- [ ] **SOC-20** Toute table racine porte `societe_id uuid NOT NULL` ; les filles héritent par jointure au parent ; `interlocuteurs` n'a pas de `societe_id` (lu via `clients!inner(societe_id)`). _Source : schéma §1.1_
- [ ] **SOC-21** Les lectures sont restreintes à la **société active** (sinon la RLS rend toutes celles du membre) ; chaque liste filtre sur la société active. _Source : `html-adapter.ts#definirSocieteActive`, `app-1.md §2.9`_
- [ ] **SOC-22** Stockage cloisonné par le 1er segment du chemin `<societe_id>/…` (lecture `est_membre`, écriture `peut_ecrire`). _Source : schéma §1.1, §6.3_
- [ ] **SOC-23** Champs d'identité en **colonnes** de `societes` (liste blanche `CHAMPS_SOCIETE`), le reste dans `societe_settings.infos_entreprise` (jsonb, dont `reglages` fusionné avec les défauts) ; `notifs_traitees` à part. _Source : `html-adapter.ts`, ts §3.3_
- [ ] **SOC-24** L'identité de l'émetteur est **figée sur la facture** à l'émission (9 colonnes `emetteur_*`) : changer le SIRET de la société ne réécrit pas les anciennes factures. _Source : `api/regles-emetteur.ts`, `app.js:4032, 11871`_
- [ ] **SOC-25** Création d'une société : aucune politique INSERT/DELETE (service_role seulement) ; à la création, 8 métiers standard et 28 entrées de référentiel sont posés par déclencheur. _Source : schéma §1.2_
- [ ] **SOC-26** Numérotation indépendante par (société, type, année). _Source : schéma §5.1_

### Données

- [ ] **SOC-30** `societes` (code unique court `kta`, nom, identité légale, `indemnite_recouvrement` 40, `regime_tva`, `tva_sur_encaissements`, `autoliquidation_batiment`, `ereporting_regime`, `adresse_electronique_*`, IBAN/BIC), `societe_settings(infos_entreprise, notifs_traitees)`. RLS : SELECT membre, UPDATE admin. _Source : schéma §1.2_
- [ ] **SOC-31** Quatre sociétés en production : KTA, CHM, AKT, Alkia. _Source : schéma §1.2, `app.js:37`_

### Cas limites et corrections cachées

- [ ] **SOC-40** La couleur KTA était appliquée avant le chargement : appliquer la couleur **après** avoir su la société. _Source : `app-2.md §4-22`_
- [ ] **SOC-41** Changer de société pendant qu'un formulaire est ouvert : l'ancien code posait `editing = null` et un rendu pouvait lever. _Source : `app.js:1320`_
- [ ] **SOC-42** Les chargements RH (dossiers, visites, invitations) sont indexés par société et ne partent pas pendant le chargement global (sinon dossiers vides toute la session). _Source : `app-3.md §4`_

### Défauts connus de l'ancienne app

- [ ] **SOC-50** Liste de repli des sociétés et société par défaut `'kta'` **codées en dur**. _Source : `app.js:37`, `app.js:19126`_
- [ ] **SOC-51** Logo et documents légaux stockés en data-URL dans le JSON des réglages (poids, pas de bucket). _Source : `app-2.md §1.13`_

---

## 3. clients — clients et interlocuteurs

### Écrans et fonctionnalités

- [ ] **CLI-01** Liste des clients ; la recherche porte aussi sur les interlocuteurs ; actions Modifier, + interlocuteur, Supprimer. _Source : `app.js:16779`_
- [ ] **CLI-02** Fiche client : type de client (cadre de facturation), nom avec autocomplétion de l'annuaire des entreprises, SIRET/SIREN (`chercherSiret`), TVA intracom (bouton de calcul), adresse avec autocomplétion BAN, pays. _Source : `app.js:17044`_
- [ ] **CLI-03** Blocs affichés selon le cadre (`sectionsEfactureVisibles`) : immatriculation, facture électronique (schéma, adresse, code de routage, référence acheteur BT-10), marché public (code service, n° d'engagement, n° de marché), pays. Particulier (B2C) : ni annuaire ni SIRET. _Source : `app.js:17044`, `regles-efacture.ts`_
- [ ] **CLI-04** Règlement : délai prédéfini (réception, 30/45/60 net, 30/45/60 fin de mois) ou libre en jours + mode net/fin de mois ; mode de paiement. _Source : `app.js:3056-3110`_
- [ ] **CLI-05** Adresses de facturation et de livraison, service comptabilité (contact), notes, bandeau de complétude. _Source : `app.js:17044`_
- [ ] **CLI-06** Code postal (5 chiffres) → ville proposée par `geo.api.gouv.fr/communes`. _Source : `app.js:2900`_
- [ ] **CLI-07** Interlocuteur : nom (obligatoire), fonction, téléphone, e-mail. _Source : `app.js:16996-17043`_
- [ ] **CLI-08** Import de clients (voir IMP-10 à IMP-15), bouton visible si `clients` créer **et** modifier. _Source : `app.js:16779, 16811-16995`_

### Règles métier

- [ ] **CLI-20** Nom obligatoire ; `verifierEntite` **refuse ce qui est mal formé** (clé SIRET fausse) mais jamais ce qui manque. _Source : `app.js:17514`_
- [ ] **CLI-21** SIREN/SIRET valides par Luhn, exception La Poste (SIREN `356000000`, somme % 5). _Source : `regles-efacture.ts#sirenValide/siretValide`, RM-31_
- [ ] **CLI-22** TVA intracom FR calculée : clé = (12 + 3 × (SIREN mod 97)) mod 97, sur 2 chiffres. _Source : `regles-efacture.ts:185-197`, RM-31_
- [ ] **CLI-23** Annuaire : écrase nom, adresse, CP, ville, SIREN ; ne remplit TVA, NAF, forme juridique, gérant, adresse électronique **que si vides** ; entreprise radiée → avertissement, pas de blocage ; cadre « acheteur public » seulement **proposé**. _Source : `app.js#appliquerEtablissement`_
- [ ] **CLI-24** Le délai de paiement n'est remis au défaut du cadre **que lorsqu'on change de type**, jamais à l'ouverture ; B2C → « Paiement à réception ». _Source : `app.js:17044`, `CLE_DELAI_PAR_CADRE`_
- [ ] **CLI-25** Délai du client prioritaire sur celui de la société, `0` (à réception) compris. _Source : `regles-efacture.ts#delaiPaiementRetenu`, RM-20_
- [ ] **CLI-26** À l'écriture d'un document, `client_id`, `client_siret`, `client_siren`, `client_tva_intracom`, `client_pays_code`, `client_code_service`, `client_code_routage`, `cadre_facturation` sont recopiés depuis la fiche **de même nom**. _Source : `html-adapter.ts#rattacherClient`_

### Données

- [ ] **CLI-30** `clients` : nom, adresse découpée, email, téléphone, siren, siret, tva_intracom, pays_code (FR), code_service, code_routage, reference_engagement, numero_marche, reference_acheteur, `facturation_*`, `livraison_*`, `contact_*`, `cadre_facturation`, `adresse_electronique_*`, `eligibilite_*`, `delai_paiement_jours` (≥ 0), `delai_paiement_mode`, `mode_paiement`. _Source : schéma §2.1_
- [ ] **CLI-31** `interlocuteurs(client_id, nom, fonction, email, telephone)`. Sur les documents, l'interlocuteur est un **texte**, pas une clé. _Source : schéma §2.1-2.2_
- [ ] **CLI-32** Lecture `clientsRapprochables` (id, nom, siret, siren, cadre, délai) pour l'OCR et les imports ; `resolveClientByNom` = `ilike nom`. _Source : `queries/clients.ts`_

### Cas limites et corrections cachées

- [ ] **CLI-40** Recherche d'entreprise désactivée pour un particulier (« laurent johan » ramenait cinq SIRET). _Source : `app-3.md §4`_
- [ ] **CLI-41** `eligibiliteStatut/Message/VerifieLe` n'ont aucun champ à l'écran : ils sont **reportés** à l'enregistrement, pas écrasés. _Source : `app.js:17514`_
- [ ] **CLI-42** `client.delaiPaiement` n'existait pas : 30 j en dur, 428 factures sans échéance ; lire `delaiPaiementJours` + mode. _Source : `app.js:2924`_

### Défauts connus de l'ancienne app

- [ ] **CLI-50** Rattachement document → fiche client **par nom** (`rattacherClient`, `resolveClientByNom ilike`) : homonymes et renommages cassent le lien. Proposer : sélectionner la fiche, écrire `client_id`, garder `client_nom` en étiquette. _Source : `html-adapter.ts`_
- [ ] **CLI-51** Suppression d'un client : aucune garde d'usage dans l'écran (les clés des documents sont `SET NULL`). _Source : schéma §2.2_

---

## 4. chantiers — chantiers, DPGF, achats, to-do

### Écrans et fonctionnalités

- [ ] **CHA-01** Liste en cartes : filtres recherche, conducteur, type (réhabilitation / neuf) ; total DPGF, % d'avancement facturé, nombre de comptes-rendus, devis, factures. _Source : `app.js:13100-13230`_
- [ ] **CHA-02** Formulaire chantier : nom, client, conducteur, adresse, type, dates ; champs PPSPS (lot, maître d'ouvrage, maître d'œuvre, SPS, effectif) ; les tableaux annexes sont conservés. _Source : `app.js:13232`_
- [ ] **CHA-03** Fiche chantier : comptes-rendus (drapeau `vu`), informations diverses (enregistrées au `blur`), inspections, PPSPS, DOE, DPGF, to-do, devis complémentaires, factures, achats. _Source : `app.js:13356`_
- [ ] **CHA-04** Pièces du marché : DPGF (analyse automatique si xlsx/xls/csv, sinon archive), CCTP, CCAP, Avenant, DGD. _Source : `app.js:14099, 14131`_
- [ ] **CHA-05** Générer le PPSPS en Word à partir de la société et du chantier. _Source : `app.js:13538`_
- [ ] **CHA-06** Tableau « DPGF chiffré — suivi d'avancement », repliable : + Ligne, + Chapitre, Enregistrer les lignes, Facturer la sélection ; pied Total DPGF HT / Déjà facturé / Reste à facturer. _Source : `app.js:13966, 14008`_
- [ ] **CHA-07** Ligne DPGF : case de sélection (désactivée à 100 %), désignation, badge du devis source, quantité, PU, montant, % cumulé, métier, suivi « planifié/total », bouton 📅 Planifier. _Source : `app.js:14013`_
- [ ] **CHA-08** Import DPGF CSV/Excel avec correspondance des colonnes (voir IMP-30). _Source : `app.js:13848, 13938`_
- [ ] **CHA-09** « Planifier une quantité » d'une ligne DPGF → crée un bon de commande pour cette part. _Source : `app.js:14290, 14323`_
- [ ] **CHA-10** Ouvrir la tâche dans le planning (bascule et filtre sur le n° du bon). _Source : `app.js:14356`_
- [ ] **CHA-11** Achats : totaux par catégorie avec barre de %, filtre, ajout (catégorie, désignation, montant HT, date) ; catégorie « salarié » : salarié + heures → montant. _Source : `app.js:14173, 14257, 14278`_
- [ ] **CHA-12** Factures du chantier (`chantier_id`) : TTC, statut, PDF, envoi. _Source : `app.js:14368`_
- [ ] **CHA-13** Devis complémentaires : création préremplie (client, adresse, CP, ville, chantier), fichiers. _Source : `app.js:14391, 14413`_
- [ ] **CHA-14** To-do en kanban À faire / En cours / Fait, glisser-déposer, barre de progression, détail (texte, date prévue, salarié, notes) ; retard = date passée et non fait. _Source : `app.js:14429-14565`_
- [ ] **CHA-15** Devis rattaché à un chantier : ses lignes (hors commentaires / sans désignation) sont copiées dans le DPGF avec `avancementCumule 0` et `devisSourceId`. _Source : `app.js:4697`_

### Règles métier

- [ ] **CHA-20** Total DPGF HT = Σ qte × PU hors chapitres ; déjà facturé = Σ qte × PU × avancement/100 ; % = arrondi entier. Exemple dans RM-60. _Source : `app.js:13162-13164, 13968`_
- [ ] **CHA-21** Planifier une quantité : restante = max(0, total − déjà planifié) ; saisie ≤ 0 refusée ; plafonnée à la restante ; montant = qte × PU ; suffixe « (q/total) » si partiel ; métier obligatoire sur la ligne. Exemples : 10 × 45,5, déjà 5, saisie 8 → 5, 227,5, « (5/10) ». _Source : `app.js:14323`_
- [ ] **CHA-22** Achat salarié : montant = heures × coût horaire chargé, affiché `toFixed(2)` (32,50 × 7,5 = « 243.75 ») ; répartition % = arrondi entier par catégorie. _Source : `app.js:14176-14178, 14241`_
- [ ] **CHA-23** Catégories d'achat = référentiel `categorie_achat` (valeur stockée = **code**, libellé renommable), repli `fournitures | salarie | soustraitant`. _Source : `app.js:14141`_
- [ ] **CHA-24** Terrain (technicien, sous-traitant) : ne voit que les chantiers **affectés** (`chantier_affectations`) ; tables financières du chantier fermées sans `chantiers/modifier`. _Source : schéma §1.4, §6.4_
- [ ] **CHA-25** Écriture = `chantiers/modifier` (admin, conducteur) ; lecture pour qui voit `chantiers`. _Source : `app-3.md §1.3`_

### Données

- [ ] **CHA-30** `chantiers` + filles `chantier_dpgf_lignes` (`avancement_cumule` 0-100, `devis_source_id`), `chantier_todos`, `chantier_documents` (`famille` ∈ dpgf, cctp, ppsps, doe, ccap, avenant, dgd), `chantier_achats` (`date_achat`, `categorie`, `salarie_id`, `heures`), `chantier_inspections`, `chantier_comptes_rendus`, `chantier_devis_complementaires`, `chantier_affectations`. _Source : schéma §2.4_
- [ ] **CHA-31** Vue `v_chantier_avancement` (montant_total, montant_facture, reste_a_facturer, sans arrondi). _Source : schéma §4.1_
- [ ] **CHA-32** `chantier_avancement_factures(dpgf_ligne_id, facture_id, avancement_avant/apres, montant_facture)` existe mais **n'est pas écrite** par l'app. _Source : schéma §2.4_

### Cas limites et corrections cachées

- [ ] **CHA-40** La date d'achat part sous `dateAchat` (`date_achat`) : sous le nom `date`, elle était écartée sans bruit. _Source : `app.js:14268`_
- [ ] **CHA-41** Fichiers de chantier limités à 8 Mo. _Source : `app.js:13472`_

### Défauts connus de l'ancienne app

- [ ] **CHA-50** **Perte silencieuse** : `dpgfLignes` et `todoList` n'ont pas de colonne dans `chantiers` et le pont ne déclare que la fille `achats` : DPGF, avancements, `tachesPlanifiees` et to-do **disparaissent au rechargement**. Les tables `chantier_dpgf_lignes` et `chantier_todos` existent. _Source : `app-3.md §4-1`_
- [ ] **CHA-51** Bon créé depuis le DPGF : `chantierId`, `dpgfLigneId`, `qtePlanifiee` sans colonne dans `bons_commande` (le lien est perdu ; `planning_taches` a `dpgf_ligne_id`/`quantite_planifiee`) ; `conducteur:''` sans `conducteurId`. _Source : `app-3.md §4-6`_
- [ ] **CHA-52** Après « + Ligne » ou « ✕ », les boutons 📅 Planifier appellent `openPlanifierQteModal('', i)` et ne font rien (`chantierId` oublié). _Source : `app.js:14083`_
- [ ] **CHA-53** « + Ligne / + Chapitre » ne capturent pas le DOM : les saisies non enregistrées des autres lignes sont perdues. _Source : `app.js:14049-14098`_
- [ ] **CHA-54** Achats, to-do, etc. ignorent le retour d'écriture (aucun message d'échec) ; `catch` muets 13566, 13733, 13880. _Source : `app-3.md §4`, `app-2.md §4`_
- [ ] **CHA-55** Pour un conducteur (`rh` voir), `coutHoraireCharge` arrive NULL par la vue : le calcul automatique d'un achat salarié ne se déclenche pas. _Source : `app-3.md §4`_
- [ ] **CHA-56** Fichiers de chantier en data-URL dans le JSON du chantier (au lieu du bucket). _Source : `app-2.md §1.14`_

---

## 5. devis

### Écrans et fonctionnalités

- [ ] **DEV-01** Liste : filtres recherche, conducteur, logement, client, interlocuteur, statut ; carte avec Imprimer, E-mail, Dupliquer, Transformer en facture, Créer un BC, Supprimer. _Source : `app.js:4347, 4552`_
- [ ] **DEV-02** Formulaire : client (obligatoire), interlocuteur, date, conducteur (par id), lieu & locataire (statut du logement), lignes, remise. _Source : `app.js:4586`_
- [ ] **DEV-03** Éditeur de lignes commun (devis, facture, BC) : types `ligne`, `chapitre`, `commentaire` ; colonnes HT **et** TTC par ligne ; ajouter, dupliquer (copie profonde sans id), supprimer (au moins une ligne vide reste), glisser-déposer. _Source : `app.js:2493-3530`_
- [ ] **DEV-04** Ligne par défaut `{type:'ligne', qte:1, unite:'u', prixUnitaire:0, tva:tvaDefaut()}`. _Source : `app.js:2376`_
- [ ] **DEV-05** Sous-totaux de chapitre affichés, recalculés par index. _Source : `app.js:3300`, `regles-totaux.ts#sousTotauxChapitres`_
- [ ] **DEV-06** Détail de TVA par taux affiché **seulement s'il y a plus d'un taux** ; sinon « Total TVA 20 % ». _Source : `app.js:3236, 4182`_
- [ ] **DEV-07** Remise saisie en %, en HT cible ou en TTC cible. _Source : `app.js:3253-3290`, RM-11_
- [ ] **DEV-08** Unités : référentiel `unite`, repli `u, pièce, h, forfait, m, m², m³, ml, mm, jour` ; unité inconnue conservée. _Source : `app.js:2471, 2486`_
- [ ] **DEV-09** Taux proposés : réglage `tauxTva`, sinon `[tvaDefaut()]` ; un taux enregistré absent de la liste reste proposé. _Source : `app.js:12572`_
- [~] **DEV-10** Code article dans la ligne : recherche au clavier (250 ms), sélection, création d'article depuis la ligne (voir ART-10). _Source : `app.js:2546-2690`_ — Partiel : `articles/components/ChoixArticle` (clavier ↑ ↓ Entrée Tab Échap, 250 ms, création depuis la ligne) — reste à l'intégrer dans `LigneEditable`.
- [ ] **DEV-11** Enregistrer / Enregistrer le brouillon (sans fermer). _Source : `app.js:2437, 4653`_
- [ ] **DEV-12** Dupliquer → nouveau brouillon daté du jour. _Source : `app.js:4714`_
- [ ] **DEV-13** Transformer en facture → facture brouillon préremplie, `echeance ''` ; refus si une facture porte déjà ce `devisId`. _Source : `app.js:4754`_
- [ ] **DEV-14** Créer un bon de commande depuis le devis ; refus si déjà lié ; montant = HT du devis. _Source : `app.js:4766`_
- [ ] **DEV-15** PDF du devis : « Valable jusqu'au », signature « Bon pour accord » du client seul, pas de mentions légales de facture. _Source : `app.js:3956, 3962, 4032, 4248`_
- [ ] **DEV-16** Envoi par e-mail (téléchargement du PDF, `mailto:`, copie du texte). _Source : `app.js:11816-11949`_
- [ ] **DEV-17** Devis depuis un rapport d'intervention : une ligne de préconisation = une ligne de devis, « x25 m² » en fin de ligne lu comme quantité + unité. _Source : `app.js:4277`, `parsePreconisationsEnLignes`_
- [ ] **DEV-18** Sous-traitant : ne voit que ses devis (`sousTraitantEmetteur`), qui est posé sur ses créations ; les autres rôles ne voient que les devis sans émetteur sous-traitant. _Source : `app.js:4347, 4678`_

### Règles métier

- [ ] **DEV-20** Totaux par `totauxDocument` : TVA par ligne, remise globale, **aucun arrondi** stocké. RM-01 à RM-12. _Source : `regles-totaux.ts:131`_
- [ ] **DEV-21** Numéro `DEV-AAAA-NNNNNN` attribué **à la première écriture**, brouillon compris (`prochain_numero(societe,'devis')`) ; trou de série toléré. RM-40. _Source : `app.js:4653`, schéma §5.1_
- [ ] **DEV-22** Statuts `brouillon | envoyé | accepté | refusé` ; défaut `brouillon` ; **aucun geste de transition** dans l'écran (le statut est reconduit). RM-50. _Source : `app.js:4514, 4653`_
- [ ] **DEV-23** Validité = date + `validiteDevisJours` (30 par défaut) en jours nets ; rien si ≤ 0. RM-24. _Source : `app.js:3956`_
- [ ] **DEV-24** Adresse du devis = adresse du **client** ; lieu d'intervention = `adresseLocataire`, CP, ville. _Source : `app.js:4653`_
- [ ] **DEV-25** Champs du logement nettoyés selon le statut : occupant si `occupé` ; étage + n° si `occupé`/`vacant` ; précision si `commune` ; ancien locataire si `vacant`. _Source : `app.js:4643`_
- [ ] **DEV-26** Conducteur écrit par id **et** nom (sans le nom, retirer le conducteur laissait l'étiquette) ; ancien document sans id : retrouvé par nom, insensible à la casse. _Source : `app.js#conducteurDuSelect`, `conducteurIdDe`_
- [ ] **DEV-27** Devis accepté → facture (opération TS) : recopie client, interlocuteur, conducteur, remise, `devis_id`, `intervention_id`, `chantier_id`, adresse et logement ; lignes sans id ; `date = aujourd'hui`. _Source : `operations/workflows.ts#accepterDevisEtCreerFacture`_
- [ ] **DEV-28** Taux de conversion du mois = acceptés / devis datés du mois, arrondi entier (3 dont 1 accepté → 33). _Source : `app-1.md §5.6`_

### Données

- [ ] **DEV-30** `devis` (numero unique par société, `client_id` SET NULL, `client_nom` NOT NULL, interlocuteur texte, `chantier_id`, `intervention_id`, adresse + bloc locataire, `date`, `remise_pourcentage` 0-100, `statut devis_statut`, `conducteur`, `conducteur_id`). _Source : schéma §2.2_
- [ ] **DEV-31** `devis_lignes` (`position`, `type`, `designation` NOT NULL '', `quantite` numeric(14,4), `prix_unitaire` numeric(14,4), `unite`, `tva` numeric(5,2) NOT NULL, `article_reference`, `commentaire`, `montant_ht` sans arrondi, `metier`). _Source : schéma §2.2_
- [ ] **DEV-32** Vue `v_devis_totaux` (ht_avant, tva_avant, ht, tva, ttc — sans arrondi). _Source : schéma §4.1_

### Cas limites et corrections cachées

- [ ] **DEV-40** `articleReference` passait par `parseFloat` (« PLB-001 » → 0) : c'est un champ texte, comme `designation`, `commentaire`, `unite`, `metier`. _Source : `app.js:3524`_
- [ ] **DEV-41** Sous-totaux de chapitre figés (classe CSS inexistante) : recalcul à chaque saisie. _Source : `app.js:3300`_
- [ ] **DEV-42** Quantité saisie « 1,5 » en chaîne → `parseFloat` = **1** (virgule tronque) ; l'ancien champ était `type=number`. La nouvelle saisie accepte la virgule (D-013). _Source : `app-1.md §4.3`_
- [~] **DEV-43** Choisir un article ne change **jamais** la quantité ; la description de l'article devient le commentaire de ligne ; copie, pas lien. _Source : `app.js:2546`_ — Partiel : `articles/domain/ligne.ts#appliquerArticle` (quantité et id intouchés, copie, commentaire manuel préservé) testé — reste l'intégration.

### Défauts connus de l'ancienne app

- [ ] **DEV-50** La secrétaire ne peut pas numéroter un devis (`prochain_numero` exige `peut_ecrire`). Voir AUTH-70. _Source : schéma §10.3-1_
- [ ] **DEV-51** Aucun geste pour passer un devis en `envoyé` / `accepté` / `refusé` dans l'écran relevé. _Source : `app-1.md §2.6`_
- [ ] **DEV-52** Colonne TVA du PDF imprimée brute « 5.5% » (point, sans espace) au lieu de « 5,5 % ». _Source : `app-1.md §4.3`_
- [ ] **DEV-53** `devisChapterTotals` fusionne deux chapitres homonymes ; `devisSelectOptions` exclut les devis déjà liés à un BC. _Source : `app.js:2820`, `app-1.md §4.2-11`_

---

## 6. articles — catalogue

### Écrans et fonctionnalités

- [x] **ART-01** Liste paginée **côté serveur** : recherche code/désignation (250 ms), filtres Actifs / Retirés / Tous, type (prestation / bien), famille. _Source : `app.js:18739-19105`, `queries/articles.ts`_ — Preuve : `src/modules/articles/components/articles.essai.tsx` (« liste paginée côté serveur »), `tests/rls/articles.essai.ts` (« pagination serveur »).
- [x] **ART-02** Fiche article : code et désignation obligatoires, famille, description, type, unité, PV HT, prix d'achat, TVA (défaut `tvaDefaut()`), géré en stock. _Source : `app.js:18739-19105`_ — Preuve : `domain/article.essai.ts`, `src/modules/articles/components/articles.essai.tsx` (« fiche article »).
- [x] **ART-03** Retirer / Remettre — **jamais de suppression** (des documents citent le code). _Source : `queries/articles.ts#desactiverArticle`_ — Preuve : `src/modules/articles/components/articles.essai.tsx` (« retirer demande confirmation », « aucun bouton de suppression »), `tests/rls/articles.essai.ts` (« retirer cache l'article »).
- [x] **ART-04** Code en double → « Le code « X » existe déjà dans le catalogue. » _Source : `app-3.md §1.3`_ — Preuve : `src/modules/articles/components/articles.essai.tsx` (« code en double »), `tests/rls/articles.essai.ts` (« crée, refuse le code en double »).
- [x] **ART-05** Import du catalogue (voir IMP-01 à IMP-06), aperçu, rapport de rejets. _Source : `integrations/catalogue.ts`_ — Preuve : `components/import.essai.tsx`, `tests/parite/import-articles.essai.ts`, `tests/rls/articles.essai.ts` (« import par lots »).
- [x] **ART-06** Écriture si `articles/modifier` (admin, secrétaire). _Source : `app-3.md §1.3`_ — Preuve : `src/modules/articles/components/articles.essai.tsx` (« catalogue — droits »), `tests/rls/articles.essai.ts` (« qui lit le catalogue »).
- [~] **ART-10** Depuis une ligne de document : chercher un article (`chercherArticlesLigne`), l'appliquer, ou créer l'article à partir de la ligne. _Source : `app.js:2610, 2655, 2679`_ — Partiel : `ChoixArticle`, `appliquerArticle` et `brouillonDepuisLigne` livrés et testés (`saisie-ligne.essai.tsx`, `domain/article.essai.ts`) ; reste à les brancher dans l'éditeur de lignes du module `documents`.

### Règles métier

- [x] **ART-20** `getArticleParCode` ne rend que les articles **actifs**. _Source : `queries/articles.ts`_ — Preuve : `tests/rls/articles.essai.ts` (« retirer cache l'article à la saisie des lignes »).
- [x] **ART-21** Codes TVA de l'import : `INTER` → 10, `NORMA` → 20, `EXO` → 0, `"0"` → 0 (casse ignorée) ; inconnu → 20 **et** signalement ; colonne absente → 20 partout. RM-06. _Source : `api/regles-import-articles.ts`_ — Preuve : `tests/parite/import-articles.essai.ts` (« codes TVA du catalogue »).
- [x] **ART-22** Unicité `(societe_id, code)` ; import par upsert sur ce couple, par lots de 200. _Source : schéma §2.1, `queries/articles.ts`_ — Preuve : `tests/rls/articles.essai.ts` (« crée, puis met à jour », « un lot refusé n'arrête pas les autres »).

### Données

- [x] **ART-30** `articles` : code, designation (index trigramme), unite, `prix_unitaire numeric(14,4)`, `tva numeric(5,2)`, metier, description, `type_article` (`bien|service`, défaut service), `prix_achat`, actif, famille, gere_en_stock. RLS par la matrice `articles`. _Source : schéma §2.1_ — Preuve : schéma Zod `schemaArticle` (validé à chaque lecture), `tests/rls/articles.essai.ts`.

### Cas limites et corrections cachées

- [x] **ART-40** Le terrain n'a aucun accès aux articles (prix). _Source : schéma §6.4_ — Preuve : `tests/rls/articles.essai.ts` (« le technicien et le sous-traitant ne lisent AUCUN article »), `src/modules/articles/components/articles.essai.tsx` (« le technicien n'a pas accès »).

### Défauts connus de l'ancienne app

- [-] **ART-50** `articles.metier` existe mais n'est ni saisi ni recopié sur la ligne. _Source : schéma §2.1 (à confirmer à l'usage)_ — Reproduit : ni saisi ni recopié ; l'import ne l'envoie pas, donc ne l'efface pas (DECISIONS D-025).

---

## 7. commandes — bons de commande, SAV, pièces

### Écrans et fonctionnalités

- [~] **BC-01** Liste : filtres recherche, conducteur, type (BC / SAV), mode de création (normal / sans BC / en attente de BC), logement, métier, client, interlocuteur. _Source : `app.js:6617, 6707, 6736`_ — Partiel : recherche, type BC/SAV, mode (normal / sans BC / en attente) et conducteur (`src/modules/commandes/components/commandes.essai.tsx`, « le filtre de mode trie ») ; manquent logement et métier (client et interlocuteur passent par la recherche).
- [ ] **BC-02** Carte repliée par défaut, une seule ouverte à la fois ; boutons contact 📞 / 💬 / 📅. _Source : `app.js:6776, 6796, 6808`_
- [~] **BC-03** Pastille d'étape : Facturé, À facturer, À valider — directeur, À valider — conducteur, Travaux à pointer ; stepper en 4 étapes. _Source : `app.js:7082, 7095, 7100`_ — Partiel : pastille d'étape sur la liste et la fiche (`BadgeEtape`, parité `tests/parite/commandes.essai.ts`) ; pas de stepper en 4 étapes (écrans de validation non repris).
- [x] **BC-04** Formulaire, trois modes à la création : Nouveau BC / Sans BC / En attente de BC. _Source : `app.js:4783, 8275, 8301`_ — Preuve : `src/modules/commandes/components/commandes.essai.tsx` (« hors brouillon, adresse et ligne… »), `tests/e2e/commandes.e2e.ts` (« bon en attente de BC »).
- [~] **BC-05** Sections : client, interlocuteur, devis lié ; adresse de facturation différente (dépliée si remplie) ; n° de BC (texte multi-lignes), référence chantier, date de réception, date de fin de travaux ; pièce jointe ; lieu et locataire ; conducteur, nature, métiers, notes ; chiffrage (montant global ou par métier, puis lignes avec TVA par ligne). _Source : `app.js:8275`_ — Partiel : client, interlocuteur, n° de BC multi-lignes, référence chantier, dates de réception et de fin, lieu et logement, conducteur, nature, notes, lignes avec TVA par ligne, montant global. Manquent devis lié, adresse de facturation différente, pièce jointe, métiers.
- [x] **BC-06** Boutons Enregistrer / Enregistrer le brouillon (sans contrôle d'adresse ni de lignes) / Annuler ; anti double clic. _Source : `app.js:8431`_ — Preuve : `src/modules/commandes/components/commandes.essai.tsx` (brouillon enregistré sans adresse ni ligne) ; boutons désactivés pendant l'envoi (anti double clic) ; « Retour à la liste » tient lieu d'Annuler.
- [x] **BC-07** Bon verrouillé → formulaire en **consultation**. _Source : `app.js:8275`, `regles-verrouillage.ts#verrouBonCommande`_ — Preuve : `src/modules/commandes/components/commandes.essai.tsx` (« un bon facturé (facture numérotée) est figé… »).
- [x] **BC-08** « BC reçu » : saisir le n° du client sur un bon en attente → `enAttenteBC=false`, toast « le numéro partira sur sa facture ». _Source : `app.js:6998-7011`_ — Preuve : `src/modules/commandes/components/commandes.essai.tsx` (« BC reçu »), `tests/e2e/commandes.e2e.ts`.
- [ ] **BC-09** Pièce jointe du bon du client : PDF/JPEG/PNG/WebP ≤ 14 Mo, HEIC converti en JPEG, rangée dans le bucket `terrain` ; retirer = `pieceJointeChemin=null` explicite ; aperçu flottant (image/PDF, URL signée). _Source : `app.js:4826-4853, 1143, 1166`, `regles-piece-jointe.ts`_
- [~] **BC-10** Lecture automatique (OCR) d'un bon — voir section OCR. _Source : `app.js:18275`_ — Partiel : point d'entrée prêt — `/commandes/nouveau` accepte `location.state.prefill` (`PreRemplissageBon`, validé par Zod ; test « accepte un préremplissage »). La lecture elle-même reste à brancher.
- [~] **BC-11** Montant : simple, ou ventilé par métier (prérempli par les totaux des chapitres du devis lié, en mots entiers) ; lecture seule dès qu'une ligne a du contenu ; sans chapitre → « ⚠ Aucun chapitre … montant à saisir manuellement ». _Source : `app.js:18504, 18532`, `app-3.md §2.9`_ — Partiel : montant simple, en lecture seule dès qu'une ligne a du contenu (`BlocMontantBon`, `src/modules/commandes/components/commandes.essai.tsx`) ; pas de ventilation par métier ni de préremplissage depuis un devis.
- [ ] **BC-12** Métiers du bon (cases), métier d'un chapitre (« Déduit du titre » / « Aucun métier » / un nom), toast « le bon se planifiera en N interventions » si ≥ 2 métiers. _Source : `app.js:3178, 3335, 18569-18660`_
- [ ] **BC-13** Créer un SAV depuis un bon (un seul SAV par bon) : « Ce qui ne va pas », jusqu'à 5 photos, sans n° de BC ni devis. _Source : `app.js:4950, 8275`_
- [ ] **BC-14** Clôturer sans facturation (SAV non terminé, admin) ; motif par défaut « Reprise sous garantie ». _Source : `app.js:4885`_
- [x] **BC-15** Créer la facture du bon (exige la validation directeur ; refus si déjà facturé). _Source : `app.js:4912`_ — Preuve : `tests/rls/commandes.essai.ts` (« chiffré → la secrétaire génère… »), `tests/e2e/commandes.e2e.ts` (« bon chiffré »), `src/modules/commandes/components/commandes.essai.tsx` (« Créer la facture »).
- [ ] **BC-16** Modale « Validation conducteur » : tâches réelles, blocages affichés, bouton actif seulement sans blocage ; travaux supplémentaires (ajouter, retirer, demander le prix si l'on voit les prix). _Source : `app.js:7136-7353`_
- [ ] **BC-17** Modale « Pré-facture / Validation directeur » : tableau de chiffrage éditable (métier, code, désignation, qté/unité, PU HT), travaux supplémentaires placés dans le chapitre de leur métier, reste en « Travaux supplémentaires constatés sur le chantier », glisser-déposer, totaux, sous-totaux par métier (si ≥ 2 groupes), comptes-rendus terrain, pièce de référence (bon du client / fiche interne / devis) en plein écran. _Source : `app.js:7366-8233`_
- [ ] **BC-18** Pré-facture : Valider (admin) ou « hors circuit » (admin, avec `confirm` du TTC) ; avertissement si le bon est encore « en attente de BC » (la référence sera figée sur la facture). _Source : `app.js:8146, 8204`_
- [x] **BC-19** Pièces à commander : date de commande, fournisseur, « commandée ». _Source : `app.js:6971, 6979`_ — Preuve : `src/modules/commandes/components/pieces.essai.tsx` (« marque commandée »), `tests/rls/commandes.essai.ts` (« commandée : écriture directe… »). Voir D-043.
- [x] **BC-20** Onglet « Pièces en commande » : À commander (sans date de commande) / Commandées, regroupées en dossiers par fournisseur (« — Fournisseur non renseigné — »). _Source : `app.js:14790-14848`_ — Preuve : `src/modules/commandes/components/pieces.essai.tsx` (« trois onglets ; les commandées rangées par fournisseur »). Onglet « Reçues » ajouté (D-043).
- [~] **BC-21** Pièce reçue → RPC `bc_piece_recue`, rechargement, bascule sur Planning › technicien. _Source : `app.js:7021`_ — Partiel : RPC `bc_piece_recue` et rechargement (`tests/rls/commandes.essai.ts`, `tests/e2e/commandes.e2e.ts`) ; pas de bascule sur Planning › technicien (module planning non repris).

### Règles métier

- [x] **BC-30** Hors brouillon, un bon exige une **adresse d'intervention** et **au moins une ligne de travaux** (type ligne, désignation non vide ; le prix n'est pas exigé) ; client obligatoire toujours. _Source : `regles-bc.ts:431` (`manquesBonCommande`), `app.js:8431`_ — Preuve : `tests/parite/commandes.essai.ts` (« manquesBonCommande »), `domain/enregistrement.essai.ts`, `src/modules/commandes/components/commandes.essai.tsx`.
- [x] **BC-31** `numero_bc` = référence **du client** (texte, plusieurs numéros possibles) ; vide → sentinelle « En attente de BC » ou « Sans BC » ; un numéro saisi fait sortir du mode sans BC / en attente. `numero_interne` `BC-AAAA-NNNNNN` posé par la base à la création. RM-41. _Source : `app.js:8271, 8431`, schéma §5.1_ — Preuve : `domain/regles.essai.ts` (« numéro du bon »), `tests/rls/commandes.essai.ts` (« numéro interne … posés par la base »).
- [x] **BC-32** Référence client BT-13 = **première ligne** de `numero_bc`, en écartant `""`, `SAV-…`, « Sans BC », « En attente de BC » (`'  BC-123 \nautre'` → `BC-123`). _Source : `regles-bc.ts#refBonCommandeClient`, SQL `ref_bc_client`_ — Preuve : `tests/parite/commandes.essai.ts` (« refBonCommandeClient »).
- [x] **BC-33** Montant du bon : Σ des montants par métier, ou montant global saisi ; **dès qu'une ligne est renseignée**, montant = HT des lignes (sans arrondi côté client). Un bon **sans ligne garde son montant saisi** (12 bons, 25 323,48 €). RM-13. _Source : `app.js:8431-8520`_ — Preuve : `tests/parite/commandes.essai.ts` (« montant du bon »), `domain/regles.essai.ts`. Arrondi au bord : D-044.
- [x] **BC-34** Lignes enregistrées = toutes, s'il existe au moins une ligne renseignée ; sinon `[]`. _Source : `app.js:8431`_ — Preuve : `domain/enregistrement.essai.ts` (brouillon sans ligne renseignée → `[]`).
- [~] **BC-35** `statut` libre hérité (défaut « en attente » ; en cours, terminé, annulé) ; `metier` = premier métier coché. _Source : `app.js:8431`_ — Partiel : `statut` « en attente » posé à la création et jamais réécrit ensuite ; `metier` non géré (métiers du bon non repris).
- [x] **BC-36** Circuit `statut_workflow` : `en_cours → pret_a_chiffrer → chiffre → facture`, ou `cloture_gratuit` ; ne change **que par RPC** (déclencheur `bons_commande_etat_reserve`). RM-53. _Source : schéma §5.3, §7_ — Preuve : jamais envoyé par `api/bons.ts` ; `tests/rls/commandes.essai.ts` (« statut_workflow ne se modifie pas en direct »).
- [ ] **BC-37** Tâches : `planifiee → realisee` (équipe), `realisee → validee | refusee` (conducteur/admin, refus motivé), `refusee → realisee` ; une tâche validée ne se rouvre pas. RM-54. _Source : `regles-taches.ts`, schéma §5.3_
- [ ] **BC-38** Blocages de la validation conducteur : `aucune_tache`, `metiers_sans_tache`, `taches_non_pointees`. _Source : `regles-bc.ts#blocagesValidationConducteur`_
- [ ] **BC-39** Blocages du chiffrage, dans cet ordre : `deja_facture` → `cloture_gratuit` → `deja_chiffre` → (sauf hors circuit) `aucune_tache` / `taches_non_validees` → `travaux_non_chiffres` → `lignes_sans_prix` ; message : 5 détails puis « et N autre(s) » ; `deja_chiffre` et `deja_facture` s'affichent comme gestes accomplis. _Source : `regles-bc.ts#blocagesChiffrage`, `app.js:7480, 8001`_
- [x] **BC-40** Étape affichée (`etapeWorkflow`) : facture liée → Facturé ; `valideDirecteur` → À facturer ; `valideConducteur` → Directeur ; tâches terminées → Conducteur ; sinon Terrain. _Source : `app.js:7082`_ — Preuve : `tests/parite/commandes.essai.ts` (source d'`etapeWorkflow` extraite d'app.js, D-045), `domain/workflow.essai.ts`.
- [x] **BC-41** `bcTachesTerminees` : `nbTaches > 0` et aucune tâche non pointée (un bon **sans tâche n'est pas terminé**). _Source : `app.js:7055`_ — Preuve : `tests/parite/commandes.essai.ts` (`bcTachesTerminees`), `domain/workflow.essai.ts` (« un bon sans tâche n'est pas terminé »).
- [x] **BC-42** File Validation (`etapeValidation`) : `hors_file` si validé directeur ou 0 tâche ; `pret` si validé conducteur ; `travaux_en_cours` si au moins une tâche pointée ; sinon `hors_file`. « À facturer » = validé directeur sans facture liée. _Source : `regles-bc.ts#etapeValidation`_ — Preuve : `tests/parite/commandes.essai.ts` (`etapeValidation`).
- [x] **BC-43** Champs **dérivés des tâches** au chargement : `metiersFait`, `dateOrigineFait`, `nbTaches`, `tachesNonPointees`, `valideConducteur` (toutes validées, ≥ 1 tâche), `valideDirecteur` (`statut_workflow ∈ {chiffre, facture}`), état de la pièce ; **recharger** après tout geste sur une tâche. _Source : `html-adapter.ts#reconstituerWorkflow`, `app.js:9953`, `CLAUDE.md`_ — Preuve : `domain/workflow.ts#circuitDuBon`, recalculé à chaque lecture (`api/bons.ts#avecCircuit`) ; tout geste recharge la collection (`hooks/useBons.ts#useRecharger`) ; `domain/workflow.essai.ts`.
- [ ] **BC-44** Circuit clos = `chiffre | facture | cloture_gratuit` ou une facture liée ; « en attente planning » = pas SAV, circuit ouvert, non validé conducteur. _Source : `app.js:1613, 8836`_
- [x] **BC-45** Verrou : un bon est figé dès qu'une facture **numérotée** le désigne (liste blanche : circuit, conducteur, agenda, suivi interne, `facturation_*`, pièce jointe, `numero_interne` ; ré-orthographe de métier tolérée) ; un bon facturé ne se supprime pas. RM-52. _Source : schéma §7, `regles-verrouillage.ts`_ — Preuve : `tests/parite/commandes.essai.ts` (`verrouBonCommande`), `src/modules/commandes/components/commandes.essai.tsx` (bon figé).
- [ ] **BC-46** Travaux supplémentaires : `a_chiffrer` → `chiffre` (premier prix saisi, prix ≥ 0, virgule acceptée) → `integre` (devenu ligne du bon) ; `refuse` à la clôture gratuite ; origine `conducteur` si l'auteur est conducteur/admin, sinon `technicien` ; TVA 10 par défaut. _Source : `app.js:7266-7330, 8041`, schéma §2.3_
- [ ] **BC-47** Validation directeur : 1) prix des travaux chiffrés (quantité 1 et unité `u` par défaut), 2) lignes du bon **puis** statut `integre`, 3) `bc_chiffrage_valide` (après `bc_passer_pret_a_chiffrer` si `en_cours`). _Source : `app.js:8065, 8121, 8146`_
- [ ] **BC-48** `bc_chiffrage_valide` refuse s'il reste un travail `a_chiffrer` ; hors circuit : `en_cours|pret_a_chiffrer → chiffre` sans planning, tracé au journal. _Source : schéma §5.3_
- [x] **BC-49** `bc_generer_facture` (admin|secrétaire) : facture **brouillon sans numéro** ; `adresse` = client, `adresse_locataire` = lieu des travaux ; `ref_bon_commande_client` = `ref_bc_client(numero_bc)` ; délai client > société > 30 j net, échéance et conditions calculées ; émetteur figé ; lignes du bon dans l'ordre puis travaux `chiffre` ; sans ligne : forfait « Travaux - BC … » au montant du bon, TVA 10. _Source : schéma §5.3_ — Preuve : `tests/rls/commandes.essai.ts` (facture brouillon sans numéro, référence client, lieu en `adresse_locataire`, refus au conducteur et au second appel).
- [ ] **BC-50** Clôture gratuite (admin) : toute valeur sauf `facture` → `cloture_gratuit`, `gratuite=true`, travaux `a_chiffrer` → `refuse`, motif journalisé. _Source : schéma §5.3_
- [ ] **BC-51** SAV : nouveau bon `SAV-AAAA-NNNNNN` (`prochain_numero('sav')`), `bon_commande_parent_id` = bon d'origine, en-tête recopié (sauf id, dates, legacy_id, numéros). _Source : `queries/bonCommande.ts#createSAV`, `app.js:379`_
- [x] **BC-52** Pièce reçue (RPC) : refusée si une tâche est validée ; retire le drapeau pièce, vide `date_tache` des tâches et les dates de planification du bon (y compris par métier), journalise `piece_en_commande → a_replanifier`. _Source : schéma §5.3_ — Preuve : `tests/rls/commandes.essai.ts` (drapeau levé, `date_tache` vidée, refus sur un bon chiffré avec le motif de la base).
- [ ] **BC-53** Métier d'une ligne : `NULL` = lu sur le titre du chapitre ; un nom ; ou `(aucun)` = refus délibéré ; **jamais `""`** ; précédence « choisi > exact > contenu en mots entiers > approchant (Levenshtein ≤ 2 sur mots ≥ 6) » dans `metierDeLaLigne`, lue par l'écran **et** le planning. _Source : `regles-metiers.ts`, `CLAUDE.md`_
- [ ] **BC-54** Métiers disponibles = métiers déclarés + métiers employés sur les bons de la société. _Source : `app.js:18569`_
- [ ] **BC-55** Montants par métier = `montantsParMetier` (arrondi au centime à chaque ajout). _Source : `regles-metiers.ts`_
- [x] **BC-56** Le terrain ne voit ni `montant`, ni `montant_par_metier`, ni `montant_sous_traitant`, ni PU des lignes, ni prix des travaux supplémentaires (vues `*_terrain`). _Source : schéma §4.2_ — Preuve : `tests/rls/commandes.essai.ts` (« le technicien lit les bons et leurs lignes, sans AUCUN montant », sous-traitant idem), `src/modules/commandes/components/commandes.essai.tsx` (« le technicien voit les bons SANS montant »).

### Données

- [~] **BC-60** `bons_commande` (61 colonnes) : `numero_interne`, `numero_bc`, `sans_bc`, `en_attente_bc`, client, interlocuteur, `devis_id`, `bon_commande_parent_id`, lieu + locataire (`telephone_locataire`), `facturation_*`, dates (réception, planifiée, fin, fin de travaux, terminée, rappel), `metier`, `metiers` jsonb, `schedule_par_metier`, `montant_par_metier`, `montant numeric(14,2)`, `montant_sous_traitant`, `statut`, `statut_workflow`, `gratuite(_motif)`, `tentatives_contact` jsonb, `reference_chantier`, `nature_travaux`, `piece_jointe_*`, `conducteur(_id)`. _Source : schéma §2.3_ — Partiel : colonnes lues et écrites par `domain/bon.ts#schemaBon` / `enteteAEnregistrer` ; non gérées : `facturation_*`, `piece_jointe_*`, planification, `metiers`, `montant_par_metier`, `tentatives_contact`, `gratuite*`.
- [x] **BC-61** Lecture par les vues `v_bons_commande_terrain` et `v_bon_commande_lignes_terrain` (masquage des prix) ; écriture dans les tables. _Source : schéma §4.2, `CLAUDE.md`_ — Preuve : `api/bons.ts` (lecture par les vues, écriture par les tables), `tests/rls/commandes.essai.ts`. D-040.
- [ ] **BC-62** `bon_commande_lignes` (+ `montant_ht`, `metier`), `bon_commande_photos(chemin, legende, position)`, `planning_taches`, `tache_travaux_supplementaires` (+ vue terrain), `workflow_journal`. _Source : schéma §2.3_
- [~] **BC-63** RPC : `bc_piece_recue`, `tache_sauvegarder_terrain`, `tache_marquer_realisee`, `tache_valider`, `bc_passer_pret_a_chiffrer`, `bc_chiffrage_valide`, `bc_chiffrage_valide_hors_circuit`, `bc_generer_facture` (→ uuid), `bc_cloturer_gratuit`. _Source : schéma §5.3_ — Partiel : `bc_generer_facture`, `bc_piece_recue` appelées (et `bc_chiffrage_valide_hors_circuit` dans les tests) ; les RPC de tâches et de chiffrage relèvent des écrans de validation, non repris.

### Cas limites et corrections cachées

- [x] **BC-70** Valider la dernière tâche n'apparaissait pas dans Facturation › Validation : recharger la collection des bons après chaque geste de tâche. _Source : `app.js:9953`, `CLAUDE.md`_ — Preuve : `hooks/useBons.ts#useRecharger` invalide toute la collection après chaque geste ; `tests/e2e/commandes.e2e.ts` (la pièce reçue passe aussitôt dans « Reçues »).
- [ ] **BC-71** Les boutons Valider / Hors circuit de la pré-facture sont refermés à chaque ouverture et à chaque erreur (le contournement restait visible sur le bon suivant). _Source : `app.js:7366`_
- [ ] **BC-72** Pré-facture : « PLB-001 » et « PEINTURE » passaient par `parseFloat` ; métier vidé = suppression de la clé, jamais `""`. _Source : `app.js:7652`_
- [ ] **BC-73** Pièce du client : `pieceJointeChemin` (depuis le 15/09) **ou** `pieceJointeData` historique ; URL signée une seule fois. _Source : `app.js:7824, 7838`_
- [x] **BC-74** `numeroBC` éditable même en attente ou sans BC (sinon le bon en attente n'avait aucune issue). _Source : `app-2.md §4-11`_ — Preuve : `SectionBon` (numéro saisissable dans les trois modes), `tests/e2e/commandes.e2e.ts` (« BC reçu » sur un bon en attente).
- [ ] **BC-75** Une colonne dérivée envoyée à l'écriture faisait voir toutes les lignes comme modifiées → delete + insert refusé par la facture figée : `montant_ht` exclu de la comparaison des lignes. _Source : `CLAUDE.md`, `html-adapter.ts#enfantsIdentiques`_
- [ ] **BC-76** Retour de pièce : vider les champs côté client ne servait à rien (les tâches gardaient leur date) → RPC. _Source : `app.js:7012`_
- [x] **BC-77** Facture depuis un BC : recopiait l'adresse du chantier dans `adresse` (client) et perdait CP/ville ; naissait « impayée ». _Source : `app.js:4912`_ — Preuve : la facture naît par `bc_generer_facture` : brouillon, adresse du client en `adresse`, lieu en `adresse_locataire` (`tests/rls/commandes.essai.ts`).
- [ ] **BC-78** Rapport lié à un BC : facturait en forçant `valideDirecteur` ; passage obligé par la pré-facture (hors circuit : admin). _Source : `app.js:4277`_
- [ ] **BC-79** BC sans tâche éternellement « à valider » : exclu par `circuitTermine`. _Source : `app.js:1629`_
- [ ] **BC-80** Référence client du BC imprimée seulement si numéro interne (788/826 muets) → toujours. _Source : `app.js:3932`_

### Défauts connus de l'ancienne app

- [ ] **BC-90** Cases « Métiers réalisés » (`toggleBCMetierFait`) écrivent `metiersFait`, **sans colonne** : rien ne persiste. _Source : `app.js:8234, 8247`_
- [ ] **BC-91** Validation **hors circuit** n'intègre pas les travaux chiffrés : ils arrivent en fin de facture sans chapitre. _Source : `app.js:8204`_
- [ ] **BC-92** `chiffrerTravailSupplementaire(id, prix)` (7316) ne transmet ni quantité ni unité, contrairement à l'appel de 8074. _Source : `queries/planning.ts:533`_
- [-] **BC-93** `v_bons_commande_terrain` **n'expose pas `telephone_locataire`** : écrit, jamais relu. _Source : schéma §10.1-1_ — Écarté côté écran : le téléphone n'est ni lu ni écrit (pour ne pas l'effacer) ; correction de la vue à proposer — DECISIONS D-041.
- [ ] **BC-94** Préfixe `BC` défini par une ligne `compteurs` de **2026** seulement : en 2027, `BON-2027-000001`. _Source : schéma §10.3-4_
- [ ] **BC-95** `bc_generer_facture` force `mode_paiement = 'virement'` (ignore `clients.mode_paiement`), ne recopie pas `conducteur_id`, ligne forfait TVA 10 codée en dur. _Source : schéma §10.3-6_
- [ ] **BC-96** Vue Validation incohérente : le compteur inclut `travaux_en_cours`, le filtre ne garde que `valideConducteur && !valideDirecteur` : filtrer fait disparaître des bons. _Source : `app.js:5152, 5541`_
- [x] **BC-97** `updatePieceCommandeChamp` ignore l'échec d'écriture. _Source : `app.js:6971`_ — Preuve : `api/pieces.ts#marquerCommandee` lève sur 0 ligne écrite ; `tests/rls/commandes.essai.ts` (refus à la secrétaire). D-043.
- [x] **BC-98** `montant` calculé en flottant brut côté client, arrondi silencieusement par `numeric(14,2)` à l'écriture. _Source : `app.js:8081, 8130, 8493`, schéma §2.3_ — Preuve : `tests/parite/commandes.essai.ts` (« montant du bon ») ; DECISIONS D-044.
- [ ] **BC-99** `statut` texte libre hérité à côté de `statut_workflow` : deux statuts pour un bon. _Source : schéma §2.3_

---

## 8. facturation — factures, avoirs, règlements, situations de travaux

### Écrans et fonctionnalités — factures

- [ ] **FAC-01** Sous-onglets : Factures, Avoirs, Validation, À facturer, Règlements ; pour un sous-traitant : Mes factures, Factures « <société> », Règlements. Filtres propres à chaque vue. _Source : `app.js:5125-5166, 5427`_
- [ ] **FAC-02** Liste : filtres + étiquettes `payee` / `partiel` / `impayee` / `retard` ; avoirs : `avoir`, `avoir_impute`, `avoir_disponible` (jamais « impayée » ni « retard ») ; badges règlement, avoir, retard. _Source : `app.js:5550, 5859`_
- [ ] **FAC-03** Badge de délai : « En retard de N j », « Échéance aujourd'hui », « Échéance dans N j » ; rien si reste ≤ 0,01. _Source : `app.js:6513, 6520`_
- [ ] **FAC-04** Formulaire facture : client (obligatoire), interlocuteur, date, conducteur, lieu & locataire, lignes, remise, conditions de paiement (délai préréglé ou libre, mode net/fin de mois), mode de paiement, échéance calculée **ou** saisie à la main, date de fin d'exécution, réf. marché, réf. BC client, devis d'origine. _Source : `app.js:5949, 3001-3110`_
- [ ] **FAC-05** Enregistrer / Enregistrer le brouillon ; « Enregistrer » **masqué** sur une facture émise ; refus local si verrou `emise`. _Source : `app.js:6013, 6067`_
- [ ] **FAC-06** Bouton « 🧾 Émettre » : facture sans numéro, pas un avoir, `peutFacturer` (admin, secrétaire). _Source : `app.js:5922, 6242`_
- [ ] **FAC-07** Dupliquer (pas un avoir) → brouillon sans numéro, liens d'origine coupés, échéance recalculée. _Source : `app.js:6170`_
- [ ] **FAC-08** Supprimer : désactivé si émise ; motif du refus de la base affiché, rechargement. _Source : `app.js:3581`_
- [ ] **FAC-09** Déverrouiller (verrou `telechargee` seulement), avec confirmation. _Source : `app.js:11913`_
- [ ] **FAC-10** PDF : titre AVOIR / FACTURE D'ACOMPTE / FACTURE ; émetteur **figé** prioritaire (nom, adresse + CP + ville, SIRET, TVA, IBAN ; tél./e-mail courants) ; méta (échéance, devis d'origine, marché, facture rectifiée, motif) ; totaux (détail TVA si > 1 taux, remise, acompte, retenue, **Net à payer toujours**) ; bloc règlement (IBAN/BIC si réglage `afficherIban`, échéance, conditions ou « Règlement par <mode> ») ; mentions légales **sur facture seulement** ; aucune signature. _Source : `app.js:3962, 4032, 4141, 4182, 4222, 4248`_
- [ ] **FAC-11** Génération PDF A4 : pied légal en texte réel sur chaque page (police 7 → 4,5 pt), pas de 2e page vide, resserrement si la dernière page < 12 %. _Source : `app.js:3765, 3794, 3840`_
- [ ] **FAC-12** Imprimer ou ouvrir l'e-mail d'une facture **non numérotée** pose le cadenas `verrouillee` et fige l'instantané d'identité ; facture numérotée : rien (déjà figée). _Source : `app.js:4325, 11871, 11898`_
- [ ] **FAC-13** E-mail : un avoir est intitulé « avoir », montant `|TTC|` « en votre faveur ». _Source : `app.js:11932`_
- [ ] **FAC-14** Validation / À facturer : bons regroupés par client (dossiers) avec leur étape. _Source : `app.js:5658`_
- [ ] **FAC-15** Facture depuis un devis, depuis un BC (pré-facture validée), depuis un rapport, depuis une vente de véhicule, depuis une situation (FAC-60). _Source : `app.js:4754, 4912, 4277, 15344, 13315`_
- [ ] **FAC-16** Factures sous-traitant (vue ST) : factures « KTA » prêtes (montant ST défini, non couvertes), création unitaire ou groupée mensuelle, « Marquer payée ». _Source : `app.js:5717-5832`_

### Écrans et fonctionnalités — avoirs

- [ ] **FAC-20** « Établir un avoir » sur une facture **numérotée** : motif choisi dans la liste ou libre (≥ 5 caractères). _Source : `app.js:6297, 6331`_
- [ ] **FAC-21** Motifs proposés : Erreur de facturation (quantité ou montant) ; Prestation non réalisée ; Travaux non conformes ; Remise commerciale accordée après facturation ; Erreur de destinataire ; Double facturation ; Annulation de la commande ; + saisie libre. _Source : `regles-avoir.ts#MOTIFS_AVOIR`_
- [ ] **FAC-22** « Régler par un avoir » depuis une facture (avoir numéroté, même client, reste > 0). _Source : `app.js:6411, 6458`_
- [ ] **FAC-23** Lettrage dans le dossier client : cocher exactement 1 avoir + 1 facture numérotée → « 🔗 Lettrer ». _Source : `app.js:10975, 11000`_

### Écrans et fonctionnalités — règlements

- [ ] **FAC-30** Vue **Par client** : total dû par client (sans avoirs), badge Retard, filtre d'état. _Source : `app.js:10593, 10767`_
- [ ] **FAC-31** Vue **Par facture** : filtres état (`non_reglee`, `partiellement_reglee`, `reglee`, `en_retard`), client, échéance du… au (sur `echeance || date`) ; tris retard, reste, échéance, client ; cartouche « reste à encaisser » ; avoirs exclus. _Source : `app.js:10838`_
- [ ] **FAC-32** Vue **Tous les règlements** : filtres du, au, client, mode (dont « Avoir »), chantier, rapproché (référence présente) ; critères dans l'URL `#factures/reglements?…` relus au démarrage ; total affiché. _Source : `app.js:10677, 10881`, `regles-filtres-reglements.ts`_
- [ ] **FAC-33** **Dossier client** : cases sur les factures payables et les avoirs à imputer ; barre de sélection (total, « Règlement » groupé ou « Lettrer ») ; « + Règlement », « Régler par un avoir » ; historique modifier ✎ / supprimer ✕. _Source : `app.js:11034`_
- [ ] **FAC-34** Règlement **unitaire** : avoirs exclus du sélecteur, montant proposé = reste, mode tiré de la facture sinon défaut, aide « Total · déjà réglé · reste ». _Source : `app.js:11315, 11355`_
- [ ] **FAC-35** Règlement **groupé** : montant modifiable, répartition affichée avant validation, un règlement par facture servie (même date, mode, référence). _Source : `app.js:11168, 11203, 11227`_

### Règles métier

- [ ] **FAC-40** Totaux par ligne et taux, remise globale, aucun arrondi stocké ; signe négatif des avoirs appliqué au calcul seulement (montants stockés positifs). RM-01 à RM-15. _Source : `regles-totaux.ts`, `regles-avoir.ts`_
- [ ] **FAC-41** Numéro attribué **par la base à l'émission** (passage hors `brouillon`), jamais demandé à l'écran ; `FAC-`, `AV-`, `ACO-` + année **de la pièce** + 6 chiffres ; refus sans ligne de type `ligne` (BG-25) ; numéro immuable ; facture numérotée insupprimable. RM-42. _Source : schéma §5.1_
- [ ] **FAC-42** `factures.statut` a pour **défaut `impayée`** : ne rien préciser = émettre. Toute création passe par `brouillon` → lignes → changement de statut. _Source : ts §3.4, `app.js:6134`_
- [ ] **FAC-43** Verrous : `emise` (numéro présent, irréversible, art. L441-9) > `telechargee` (`verrouillee`, réversible) > aucun. En base : en-tête figé sauf liste blanche (statut, cycle PDP, `verrouillee`, conducteur, interlocuteur, chantier, `facturation_*`…), identité client complétable si vide, lignes figées même pour un admin. RM-51. _Source : `regles-verrouillage.ts`, schéma §7_
- [ ] **FAC-44** Statut en base ∈ {brouillon, impayée, envoyée, payée} : réglée → `payée`, partielle ou non réglée → `impayée` ; écrit seulement s'il change. RM-17. _Source : `app.js:11389`, `regles-reglements.ts#statutEnBase`_
- [ ] **FAC-45** Statut de règlement (affiché) : pièce historique `payée` → « Réglée (reprise) » ; avoir → statut d'imputation ; sinon `statutReglement`. RM-16. _Source : `app.js:6482`_
- [ ] **FAC-46** Retard ⇔ facture (pas avoir), reste > 0,01 et jours depuis `echeance || date` > 0. RM-18. _Source : `app.js:10741, 6513`_
- [ ] **FAC-47** Échéance = f(date, délai, mode) en UTC ; délai client > société > 30 j net ; libellé figé dans `conditions_reglement` (BT-20) ; dépassement de L441-10 **signalé, jamais bloqué**. RM-20 à RM-23. _Source : `regles-efacture.ts`_
- [ ] **FAC-48** Net à payer = max(0, TTC − acomptes − retenue), retenue sur le **TTC** ; `acomptesDeduits` et `retenueGarantiePourcentage` sont **reconduits**, plus saisis (`null` = pas de retenue ≠ 0). RM-14. _Source : `regles-totaux.ts#soldeAPayer`, `app.js:6128`_
- [ ] **FAC-49** Toutes les clés de la facture sont **toujours envoyées** (une clé absente serait écrite NULL). _Source : `app.js:6067`, `CLAUDE.md`_
- [ ] **FAC-50** Avoir : refusé si facture sans numéro (« modifiez-la directement »), si c'est déjà un avoir (« il faut refacturer »), si motif < 5 caractères ; copie de l'en-tête (sans devis/BC/intervention), identité émetteur **de la facture d'origine**, mêmes lignes positives, `facture_rectifiee_id`, `motif_rectification`. RM-43. _Source : `regles-avoir.ts#refusAvoir`, `queries/factures.ts#createAvoir`_
- [ ] **FAC-51** Imputation d'un avoir : contrôles et messages dans l'ordre de `refusImputationAvoir` ; écrit **deux règlements** liés (facture : mode `avoir`, réf. = n° avoir ; avoir : mode `imputation`, réf. = n° facture), même montant, même date. RM-19. _Source : `queries/factures.ts:423`, `regles-avoir.ts`_
- [ ] **FAC-52** Règlement : refus si montant ≤ 0, facture soldée, montant > reste + 0,005 ; en modification, le règlement modifié est exclu. RM-17. _Source : `regles-reglements.ts#refusReglement`_
- [ ] **FAC-53** Virement groupé : imputé de la plus ancienne à la plus récente (date, puis numéro) ; jamais plus que le reste ; pas de part nulle ; trop-perçu **refusé**. RM-17. _Source : `regles-reglements.ts#imputer/refusImputation`_
- [ ] **FAC-54** Modes de règlement : virement (défaut), chèque, prélèvement, carte, espèces ; libellés historiques (« Virement », « CB ») lus sans reprise. _Source : `regles-efacture.ts#MODES_REGLEMENT`, `app-2.md §4-19`_
- [ ] **FAC-55** Facture ST unitaire `FST-<numeroBC sans espaces>` (ou `FST-<6 car. id>`) ; groupée `FST-MAAAA-MM` puis `-2`, `-3`… ; naissent `impayée`. RM-44. _Source : `app.js:5717-5800`_

### Situations de travaux (avancement DPGF)

- [ ] **FAC-60** « Facturer la sélection » (lignes DPGF non soldées) : modale avec % par ligne, boutons 25/50/75/100 % au-dessus du déjà facturé, total rafraîchi. _Source : `app.js:13261, 13299`_
- [ ] **FAC-61** Nouveau % = max(déjà, min(100, saisie)) ; à facturer = montant ligne × (nouveau − déjà)/100 ; refus « Aucun avancement supplémentaire » si rien. RM-61. _Source : `app.js:13305, 13326`_
- [ ] **FAC-62** Chaque ligne de situation : `{ligne, "<désignation> (avancement X% → Y%)", qte 1, PU = à facturer, tva = tvaDefaut()}` ; facture **brouillon** non numérotée, remise 0, échéance vide, `chantierId`, notes « Situation de travaux — <nom> ». RM-62. _Source : `app.js:13315`_
- [ ] **FAC-63** Le cumul vit dans `chantier_dpgf_lignes.avancement_cumule` ; pas de rappel des situations précédentes ni de retenue sur la facture. _Source : `app-2.md §2.5`_

### Données

- [ ] **FAC-70** `factures` (86 colonnes : numéro, liens, client figé, adresse client vs `adresse_locataire`, émetteur figé, dates et conditions, `remise_pourcentage`, `acomptes_deduits`, `retenue_garantie_pourcentage`, `statut`, `type_document` ∈ facture|avoir|acompte|note_frais, `cadre_facturation`, `statut_cycle`, `pdp_*`, `verrouillee`, `ref_bon_commande_client`, `ref_marche`, `motif_rectification`, `facture_rectifiee_id`). _Source : schéma §2.2_
- [ ] **FAC-71** `facture_lignes` (comme `devis_lignes` + `tva_motif_exoneration`) ; `tva` écrite **0 si absente, jamais NULL** ; `unite_code` et `tva_categorie` non écrits (dérivés). _Source : ts §3.3_
- [ ] **FAC-72** Totaux lus dans `v_facture_totaux` (les colonnes `total_*`, `net_a_payer`, `ventilation_tva` sont des **vestiges** : 351/410 factures à 0). _Source : schéma §2.2, §4.1_
- [ ] **FAC-73** `v_facture_solde` (ttc, paye, reste ≥ 0, etat Impayée/Payée/Partiel à 0,004/0,01, jours_retard). _Source : schéma §4.1_
- [ ] **FAC-74** `reglements(facture_id, societe_id, date, montant numeric(14,2) > 0, mode texte, reference)`. _Source : schéma §2.2_

### Cas limites et corrections cachées

- [ ] **FAC-80** `emettreFacture` n'était appelée par aucun bouton : 46 brouillons sans numéro. _Source : `app.js:5922`_
- [ ] **FAC-81** Facture sans statut partait « impayée » → numérotée à la 1re sauvegarde : défaut `brouillon` côté écran. _Source : `app.js:6134`_
- [ ] **FAC-82** « Enregistrer » actif sur facture émise → 23001 silencieux ; et chaque impression d'une facture émise donnait 23001 (cadenas). _Source : `app.js:6013, 11898`_
- [ ] **FAC-83** Pièces historiques (`legacy_id`) au statut `payée` : 362 792 € de créances fantômes → « Réglée (reprise) », aucun règlement fabriqué. _Source : `app.js:6482`_
- [ ] **FAC-84** Un avoir mesuré comme une facture affichait « RÉGLÉE, reste 0 » (`statutReglement(-682, [])` = réglée) : statut d'imputation séparé. _Source : `app.js:6482`_
- [ ] **FAC-85** Avoir compté dans les impayés du tableau de bord (il naît `impayée` en base) ; facture à moitié réglée absente du dû. _Source : `app.js:1588, 2043`_
- [ ] **FAC-86** Règlements : le partiel était rangé « envoyée » ; encaissement posé sur un avoir ; reste d'avoir ajouté aux dus ; formulaire unitaire ouvert par rien ; règlement groupé soldait tout. _Source : `app-2.md §4-18`_
- [ ] **FAC-87** Filtrer dans l'onglet Avoirs vidait l'écran ; 5 fonctions de filtre en double écrasaient les bonnes. _Source : `app.js:5612, 5859`_
- [ ] **FAC-88** Adresse de l'émetteur sans CP/ville, IBAN courant sur une facture ancienne : colonnes `emetteur_*`. _Source : `app.js:4032`_
- [ ] **FAC-89** `legacy_id` des factures unique **globalement** (préfixe `compta:` pour l'import). _Source : ts §3.4_

### Défauts connus de l'ancienne app

- [ ] **FAC-90** Numéros `FST-…` calculés **côté client**, hors compteur, non transactionnels ; `FST-M` compte **toutes** les factures en mémoire (toutes sociétés, tous sous-traitants). _Source : `app.js:5725-5727`_
- [ ] **FAC-91** Factures ST créées directement `impayée` sans passer par l'émission ; « Marquer payée » écrit `payée` **sans règlement**. _Source : `app.js:5786, 5832`_
- [ ] **FAC-92** `calculerSoldeFacture` / `ajouterReglementEtMajStatut` recalculent le solde **côté client** (remise appliquée au TTC, `toFixed(2)`) au lieu de lire la base ; `efacture.preparerEmission` s'en sert pour BT-113. _Source : `operations/workflows.ts`, ts §0-3_
- [ ] **FAC-93** `v_facture_solde` ignore acomptes, retenue, escompte et le **signe des avoirs**. _Source : schéma §4.1, §10.3-7_
- [ ] **FAC-94** Deux définitions de l'avoir : `estAvoir` (`includes("avoir")`) vs `estAvoirDocument` (`trim() === "avoir"`). _Source : `regles-avoir.ts`, `regles-verrouillage.ts`_
- [ ] **FAC-95** Deux arrondis au centime : `arrondiCentime` (1,005 → 1,01) vs `centimes` (1,005 → 1). RM-10, décidé : D-006. _Source : `regles-reglements.ts`, `regles-avoir.ts`_
- [ ] **FAC-96** Vente de véhicule : facture **émise d'emblée** (`impayée`), client en texte libre sans fiche, TVA 20 ou 0 seulement. _Source : `app.js:15344`_
- [ ] **FAC-97** Situation : avancement du chantier écrit **avant** la facture, sans contrôle ; PU non arrondi (4074.0710999999997) ; saisie 0 = revient au déjà facturé ; ni retenue ni rappel des situations ; `chantier_avancement_factures` jamais écrite. _Source : `app.js:13315`, schéma §2.4_
- [ ] **FAC-98** `note_frais` numérotée `NOT-AAAA-…` faute de préfixe. _Source : schéma §10.3-5_
- [ ] **FAC-99** 7 factures réelles FAC-2026-0007 à 0013 (ALPES ISERE HABITAT) encore dans `kv_store` fermée : trou dans la série légale. _Source : schéma §2.8, §10.3-13_
- [ ] **FAC-100** `refBonCommandeClient` est figée dès la numérotation, même vide (d'où l'avertissement « en attente de BC »). _Source : `app-2.md §4-9`_

---

## 9. ocr — lecture automatique des bons de commande

### Écrans et fonctionnalités

- [ ] **OCR-01** « Importer un bon » : PDF / image / HEIC ; ouvre un formulaire vierge puis lance la lecture. _Source : `app.js:18275, 18378`_
- [ ] **OCR-02** Écran de lecture : étapes (Préparation du document → Envoi → Lecture par le modèle), chronomètre à la seconde sans re-rendu, durée annoncée, « Annuler la lecture ». _Source : `app.js:18341`, `regles-ocr.ts`_
- [ ] **OCR-03** Trois issues distinctes, avec toast et écran persistant : annulé, délai dépassé, échec ; « ↻ Réessayer » ou « Saisir à la main ». _Source : `app-3.md §4`_
- [ ] **OCR-04** Résultat : formulaire du bon **prérempli**, avertissements affichés ; **rien n'est enregistré automatiquement** ; pièce jointe retenue pour le bon. _Source : `integrations/ocr.ts#versSaisieBonCommande`_
- [ ] **OCR-05** Rapprochement du client lu avec les fiches : exact → inclusion unique → score de mots ≥ 0,8 unique ; sinon 8 suggestions. _Source : `integrations/ocr.ts#rapprocherClient`_

### Règles métier

- [ ] **OCR-10** Préparation : PDF, JPEG, PNG, WebP acceptés ; image hors format ou > 3 Mo → JPEG qualité 0,85, côté max 2200 px ; PDF > 14 Mo refusé. _Source : `integrations/ocr.ts#preparer`_
- [ ] **OCR-11** Délais : bascule envoi → analyse à 2 s ; « plus long que d'habitude » à 45 s ; durée habituelle 30 s ; délai client 120 s (`TimeoutError`). _Source : `regles-ocr.ts`_
- [ ] **OCR-12** Correspondance : `sansBC = !numeroBC` ; `dateReception = dateBC ?? aujourd'hui` ; `logementStatut` ∈ {occupé, vacant, commune} sinon ignoré ; `montant = montantTotalHT` ; lignes `id = ocr-<ts>-<i>`. _Source : `integrations/ocr.ts`_
- [ ] **OCR-13** Avertissements complétés par `essentielsDeLecture` : n° de BC, adresse du chantier, ≥ 1 ligne de travaux. _Source : `regles-bc.ts#essentielsDeLecture`_
- [ ] **OCR-14** Normalisation des noms de client : sans accents, majuscules, retrait SA/SAS/SASU/SARL/EURL/SCI/OPH/HLM/SA HLM/OFFICE PUBLIC DE L HABITAT ; mots > 2 lettres hors DE/DU/DES/LA/LE/LES/ET/L/D. _Source : `integrations/ocr.ts`_

### Données

- [ ] **OCR-20** Edge Function `extraire-bc` : `{fichierBase64, mimeType}` → `{extraction}` ; Mistral OCR (`mistral-ocr-latest`) puis extraction JSON stricte (`mistral-medium-latest`, `temperature 0`) ; budget 50 s + 45 s, 110 s total, une reprise sur 429/5xx ; erreurs 400/405/413/500/502/503/504. Ne touche pas la base. _Source : schéma §8.1_
- [ ] **OCR-21** Contrat `ExtractionBC` (client, numeroBC, dateBC, referenceChantier, natureTravaux, dateFinTravaux, interlocuteur, adresse/CP/ville du lieu, facturation*, numeroLogement, logementStatut, occupant, etage, notes, montantTotalHT, lignes[type, designation, qte, unite, prixUnitaire, tva], avertissements). _Source : `supabase/functions/_shared/contrat-bc.ts`_

### Cas limites et corrections cachées

- [ ] **OCR-30** Le 14/09 : bouton relancé plusieurs fois, promesse jamais résolue → issues nommées (`AbortError`, `TimeoutError`) et bouton neutralisé. _Source : `app-3.md §4`_
- [ ] **OCR-31** Écart au contrat détecté (`ecartsDeForme`) → avertissement « Lecture partiellement incertaine ». _Source : schéma §8.1_

### Défauts connus de l'ancienne app

- [ ] **OCR-40** `extraire-bc` ne vérifie ni l'utilisateur ni la société : un JWT `anon` suffit à consommer le quota Mistral. _Source : schéma §8.1, §10.3-11_
- [ ] **OCR-41** L'OCR ne remplit que `numero_bc` (référence client), jamais `numero_interne` — conforme, mais à expliciter à l'écran. _Source : schéma §10.3-15_

---

## 10. espace-client — accès client en lecture seule

État réel : **inexistant en base**. Aucun rôle `client` dans `role_membre`, aucune politique RLS
pour un tiers, aucun lien de partage. L'ancien `app.js` contient un **portail mort** (il teste
`state.currentRole === 'client'`, valeur jamais posée par `roleEffectif`).

### Écrans et fonctionnalités (portail mort, à décider)

- [ ] **ESP-01** Portail « bons de commande du client » : bons de `currentClientNom` (+ interlocuteur), 4 tuiles couleur, liste triée. _Source : `app.js:6562, 6574`_
- [ ] **ESP-02** Couleur d'un bon : vert (travaux faits ou `dateInterventionTerminee`) > jaune (pièce à commander) > orange (date planifiée) > rouge ; tri rouge, jaune, orange, vert, puis `numeroBC`. _Source : `app.js:6529`_
- [ ] **ESP-03** Recherche restreinte à 13 champs (`CHAMPS_CHERCHES_PORTAIL`) pour ne pas révéler les notes internes. _Source : `app.js:6549`_
- [ ] **ESP-04** Réglages du rôle client : choix de l'organisme et de l'interlocuteur dans une **liste libre, sans contrôle**. _Source : `app.js:12213`_

### Règles métier

- [ ] **ESP-10** Un client ne voit **que ses** bons (et, par interlocuteur, que les siens), sans aucun montant ni note interne — à garantir **en base** (RLS ou vue dédiée), pas par l'écran. _Source : `app.js:12213` (intention), schéma §6.5_
- [ ] **ESP-11** Il n'y a pas de rôle client : créer un rôle, une table de rattachement compte ↔ client (et interlocuteur), des politiques, ou écarter le module. Décidé : table `acces_clients` + `mes_clients()`, lecture seule, pas de rôle de membre (D-008). _Source : schéma §1.4, ts §2.2_

### Données

- [ ] **ESP-20** Aucune table, vue ni politique aujourd'hui. Le seul tiers avec un compte est le **sous-traitant** (`sous_traitants.contact_profile_id`). _Source : schéma §6.5_

### Défauts connus de l'ancienne app

- [ ] **ESP-30** Le portail n'est atteignable par aucun chemin, et s'il l'était, le cloisonnement ne tiendrait que par un sélecteur libre. Ne pas reproduire tel quel (D-008). _Source : `app-1.md §4.2-7`, `app-2.md §4`_

---

# Hors périmètre de cette nuit

Modules à reprendre plus tard. Les lignes restent ici pour la parité ; les règles qu'ils
partagent avec les modules ci-dessus (tâches, prix masqués, numérotation) sont déjà citées.

## 11. planning, interventions, rapports

### Écrans et fonctionnalités

- [ ] **PLN-01** Vues Planning technicien / sous-traitant / En attente technicien / En attente sous-traitant ; technicien : vue technicien imposée, sans « Non planifiés » ni glisser-déposer ; sous-traitant : « Mon planning », montants masqués sauf « Votre montant : X HT ». _Source : `app.js:8795-8830`_
- [ ] **PLN-02** Calendrier 6 semaines, heures 8-16, pause à 12, week-ends et jours fériés grisés ; filtres conducteur, métier, équipe/sous-traitant, logement (dont « problème »), recherche multi-mots, client, interlocuteur ; la recherche saute à la semaine du premier résultat. _Source : `app.js:8631, 8850, 8868`_
- [ ] **PLN-03** Un élément par (bon × métier) si plusieurs métiers (`bcId::METIER`, planification par `scheduleParMetier`, montant par métier). _Source : `app.js:8718, 8778`_
- [ ] **PLN-04** Poser au planning (glisser ou rapide) : équipe **obligatoire** (modale), durée 1 h par défaut ; échec d'écriture → toast et rechargement. _Source : `app.js:10241-10379`_
- [ ] **PLN-05** Déplanifier (refus si intervention faite, retire les dates supplémentaires sauf journées pointées), avancer d'un jour, régler heure / durée (1-8 h) / date de fin / équipe, étirer par la poignée (Échap annule). _Source : `app.js:10313-10550`_
- [ ] **PLN-06** Dates supplémentaires : ajout (refus doublon / date d'origine, tri), retrait par suppression de la tâche (refus si pointée). _Source : `app.js:10141-10206`_
- [ ] **PLN-07** Contacts : tentatives (appel/SMS, date, heure), rappel programmé (≥ aujourd'hui), annulation ; lien `tel:` du locataire. _Source : `app.js:9247-9400`_
- [ ] **PLN-08** Fiche technicien d'une carte : commentaire, pièce à commander, photos, croquis, contacts ; boutons Enregistrer mes constats / Travaux terminés / Valider-Refuser selon `actionsTache` ; motif de lecture seule. _Source : `app.js:9685-10134`_
- [ ] **PLN-09** Fiche sous-traitant : date faite, commentaire, photos, travaux supplémentaires. _Source : `app.js:9564-9639`_
- [ ] **PLN-10** Annotation de photo : flèche, carré, cercle, texte, zone hachurée ; vert si préconisation, rouge sinon ; JPEG 0,85. _Source : `app.js:8945-9245`_
- [ ] **PLN-11** Impression du planning en paysage. _Source : `app.js:5050`_
- [ ] **PLN-20** Rapports d'intervention : liste (filtres sous-traitant, recherche, conducteur, logement), assistant 4 étapes (infos, contrôles par métier, photos ≤ 3 + signatures, rapport), lien/délien d'un BC (un rapport par BC), transformer en devis ou facture, PDF, e-mail. _Source : `app.js:11405-11985, 2729-2790`_
- [ ] **PLN-21** Numéro `INT-AAAA-NNNNNN` à la création ; signature nulle si logement vacant ou partie commune ; statut « en cours » par défaut. _Source : `app.js:11951`_

### Règles métier

- [ ] **PLN-30** Matérialisation d'une tâche par (bon, date, métier, équipe) ; tâches orphelines rattachées à la première carte (BC-2026-0866). _Source : `app.js:9730`_
- [ ] **PLN-31** Appartenance : compte → salarié → `technicien_id` (équipe) ; tâche sans équipe : arbitrage au conducteur. _Source : `app.js:9833-9848`, SQL `est_de_l_equipe`_
- [ ] **PLN-32** Créneau : heure 08:00 et 1 h par défaut, 1 à 8 h, modifiable seulement `planifiee|refusee` ; retour au planning refusé si une tâche est validée (« ouvrez un SAV »). _Source : `regles-taches.ts`_
- [ ] **PLN-33** Carte « faite » (`bcInterventionFaite`) : non déplaçable si datée ; déplaçable si faite sans date. _Source : `app.js:7069, 10217`_
- [ ] **PLN-34** Jours fériés calculés (Pâques) ; `calculerSpanRows` avec pause. _Source : `app-2.md §5.1`_

### Données

- [ ] **PLN-40** `planning_taches` (date nullable = à replanifier, heure_debut/fin, équipe, sous-traitant, bon, chantier, dpgf_ligne, métier, statut, réalisation/validation, refus, pièce, croquis) ; `interventions` (+ `intervention_controles`, `intervention_photos`) ; `metier_type` à 3 valeurs. _Source : schéma §2.3-2.4_

### Défauts connus

- [ ] **PLN-50** `dropUnsched` déplanifie sans contrôler l'intervention faite ni recharger ; plusieurs réglages ignorent l'échec d'écriture. _Source : `app.js:10313`, `app-2.md §4`_
- [ ] **PLN-51** `generateRapportIA` appelle `api.anthropic.com` **depuis le navigateur sans clé** : échoue par construction. _Source : `app.js:11678`_
- [ ] **PLN-52** Recherche des rapports sans le filtre sous-traitant : un sous-traitant voit les rapports internes. _Source : `app.js:11422-11436`_
- [ ] **PLN-53** Jours fériés : ni Vendredi saint ni 26/12 (Alsace-Moselle) ; liste non triée. _Source : `app-2.md §4`_
- [ ] **PLN-54** `saveTechnicienIntervention` ne remet pas `dateInterventionTerminee` à vide quand on décoche. _Source : `app.js:10114`_

## 12. rh — salariés, équipes, documents, visites, congés

- [ ] **RH-01** Salariés : recherche, filtre métier, badges (à vérifier, visite, absent, dossier incomplet, sans compte), coût horaire et salaire affichés si droit. _Source : `app.js:15400`_
- [ ] **RH-02** Équipes = lignes `techniciens` ; membres = salariés actifs dont `technicien_id` pointe dessus ; « Aucun membre. Cette équipe ne peut rien déclarer. » _Source : `app.js:15443, 15496`_
- [ ] **RH-03** Registre unique du personnel (art. L.1221-13), tri par entrée, impression paysage. _Source : `app.js:15505, 15538`_
- [ ] **RH-04** Documents RH : matrice de conformité, filtres, dossier, dépôt dans `salarie_documents` + bucket `terrain` (`<societe>/salaries/<id>/`). _Source : `app.js:15739-15916`_
- [ ] **RH-05** Fiche salarié (identité, poste référentiel ou libre, équipe, « Conducteur de travaux », compte, contrat, coûts, dates d'entrée/sortie, carte BTP, habilitations, dossier, suivi médical, congés). _Source : `app.js:16201, 16639`_
- [ ] **RH-06** Cocher « Conducteur de travaux » crée/active une fiche `conducteurs` (jamais supprimée, `actif:false` au décochage) et propose le rôle `conducteur`. _Source : `app.js:16145, 16183`_
- [ ] **RH-07** Visites médicales : types, régimes (60/36/48 mois, intermédiaire 24), avis, échéance proposée, dépassement du plafond = avertissement ; la colonne `visite_medicale_prochaine` fait foi. _Source : `rh-visites.js`, `regles-visite-medicale.ts`_
- [ ] **RH-08** Congés : solde = initial − Σ CP ; jours ouvrés = hors sam./dim. (fériés comptés) ; fin < début refusée. _Source : `app.js:16009-16073`_
- [ ] **RH-09** Dossier incomplet si une pièce obligatoire manque (contrat, DPAE, pièce d'identité, carte BTP, RIB) **ou** si un document quelconque est expiré. _Source : `regles-documents-rh.ts`_
- [ ] **RH-10** Seuils : documents 30 j, visites 45 j (réglages) ; carte BTP / habilitations 30 j codés en dur dans la liste. _Source : `app.js:15648`, `app-3.md §4`_
- [ ] **RH-11** Données sensibles masquées par `v_salaries_annuaire` sans `rh/modifier`. _Source : schéma §4.2_
- [ ] **RH-20** Défaut : `absences` sans colonne (table `salarie_absences` inutilisée) → perdues, solde faux ; écrit à chaque `onchange`. _Source : `app-3.md §4-4`_
- [ ] **RH-21** Défaut : `nom2`, `nom3`, `type` des équipes perdus (seul `nom` a une colonne). _Source : `app-3.md §4`_

## 13. vehicules et materiel

- [ ] **VEH-01** Véhicules : filtres En service / Vendus / Tous, liste (plaque, type, motorisation, pneus, km, CT « EXPIRÉ » / « DANS n J » à ≤ 30 j), fiche, facture d'achat, télépéage, carte carburant. _Source : `app.js:14849-15130`_
- [ ] **VEH-02** Immatriculation obligatoire, en capitales, unique par société ; libellé = plaque · marque modèle (ou surnom). _Source : `app.js:15065, 15127`_
- [ ] **VEH-03** Entretien (le km monte si supérieur), prêts avec schéma SVG, retour. _Source : `app.js:15167-15280`_
- [ ] **VEH-04** Vente → facture (voir FAC-96). _Source : `app.js:15331-15374`_
- [ ] **VEH-05** Matériel : liste, fiche (catégorie, état, n° de série, achat), prêts (actif tant que pas de retour réel), rendu. _Source : `app.js:14566-14790`_
- [ ] **VEH-20** Défaut : `prets`, `entretiens` sans colonne (tables `vehicule_prets`, `vehicule_entretiens`, `materiel_prets` inutilisées) → perdus. _Source : `app-3.md §4-2`_
- [ ] **VEH-21** Défaut : `prochainCT` → `prochain_c_t` inexistant (colonne réelle `date_controle_technique`) : date de CT jamais conservée. _Source : `app-3.md §4-3`_

## 14. statistiques et tableaux de bord

- [ ] **STA-01** Tableau de bord par rôle : sous-traitant, technicien (aucun montant, journée ≤ 8 cartes, à pointer), conducteur (aucun montant, hors délai / SAV / à valider / sans RDV, mesures 90 j), pilotage (admin, secrétaire, lecture). _Source : `app.js:1395-2150`_
- [ ] **STA-02** Pilotage : recherche globale, actions rapides, tuiles CA encaissé / devis en attente / impayés / à facturer, « À traiter », CA HT 6/12 mois vs N-1, activité récente, top 5 clients, période personnalisée. _Source : `app.js:1446-2043`_
- [ ] **STA-03** Taux encaissé = max(0, round((1 − impayés/Σ TTC signés) × 100)). RM-70. _Source : `app-1.md §2.4`_
- [ ] **STA-04** Indicateurs conducteur : période 90 j, tentatives injoignable 3, taux SAV (< 10 bon), délai tenu (≥ 80 bon), prise en charge, exécution. _Source : `app.js:1829-1901`_
- [ ] **STA-05** Statistiques par conducteur et par équipe/mois (BC, SAV, retard, devis acceptés/transformés, CA HT). _Source : `app.js:11988-12212`_
- [ ] **STA-20** Défaut : « injoignables » jamais déclenché (`parseInt` d'un tableau). _Source : `app.js:1865`_
- [ ] **STA-21** Défaut : CA = factures **brouillons comprises** ; CA encaissé = statut `payée` daté du mois de la facture, pas du règlement. _Source : `app-1.md §4.2-9`_
- [ ] **STA-22** Défaut : statistiques groupées par **nom** de conducteur ; travaux supplémentaires lus sur un tableau sans colonne (toujours 0) ; retard compté même pour un bon facturé ; mois calculé par `new Date()` local. _Source : `app-2.md §4`_

## 15. reglages

- [ ] **PAR-01** Rubriques : Société (Organisation, Identité visuelle, Documents légaux) ; Documents (Devis & factures, Numérotation) ; Référentiels (Listes de choix, Intervenants, RH, Véhicules, Conduite, Notifications) ; Mon compte. _Source : `app.js:12277`_
- [ ] **PAR-02** Devis & factures : validité des devis (30), délai de paiement (30 net), TVA par défaut (10), taux proposés (`0, 2.1, 5.5, 10, 20`, valeurs ≥ 0), textes, IBAN, afficher l'IBAN ; relecture après enregistrement. _Source : `app.js:12867`, `integrations/reglages.ts`_
- [ ] **PAR-03** Numérotation : compteurs par type (DEV, FAC, INT, SAV — pas de série BC), aperçu `PREFIXE-AAAA-NNNNNN`, avertissement si le compteur baisse, modifiable avec `reglages/modifier`. _Source : `app.js:12784-12859`_
- [ ] **PAR-04** Listes de choix (métiers, catégories/états de matériel, catégories d'achat, unités, pièces courantes) : code posé à la création puis figé, positions, déplacement. _Source : `app.js:17566-17730`_
- [ ] **PAR-05** Métiers (palette de 19 couleurs, position ; suppression refusée si employé ; renommage propagé partout sauf factures émises). _Source : `app.js:17727-17830`, schéma §7_
- [ ] **PAR-06** Intervenants : conducteurs (compte lié), fournisseurs (`actif` toujours envoyé), sous-traitants (documents à échéance), équipes. _Source : `app.js:17848-18717`_
- [ ] **PAR-07** Seuils : véhicule carte 30, CT 30, document légal 30, carte BTP 60, visite 45, habilitation 60, conducteur sans RDV 7. _Source : `integrations/alertes.ts#SEUILS`_
- [ ] **PAR-20** Défaut : `sousTraitant.documents` et `document.notes` sans colonne → perdus. _Source : `app-3.md §4-5`_
- [ ] **PAR-21** Défaut : repli du code de référentiel sans `normaliserEntree` casse les accents (« location_de_mat_riel »). _Source : `app-3.md §5`_

## 16. facturation électronique (PDP, Factur-X)

- [ ] **EFA-01** Transmettre une facture numérotée à la plateforme (pas B2C, pas étranger, pas pièce historique), irréversible, `confirm`. _Source : `app.js:4735`_
- [ ] **EFA-02** Charge EN 16931 : types 380 / 381 / 386, codes unité UNECE (défaut C62), catégories TVA (`S` si > 0, sinon `Z`), remise → déductions BG-20 par taux (code 95), BR-CO-10 à 0,01 €, avoir en négatif. RM-08. _Source : `regles-en16931.ts`_
- [ ] **EFA-03** Manques pour émettre : BT-1, BT-2, SIREN/SIRET émetteur, BT-27, BT-44, BT-49 (si e-facture), BT-55, ≥ 1 ligne, BR-CO-10. _Source : `regles-en16931.ts#manquesPourEmettre`_
- [ ] **EFA-04** XML CII (`factur-x.xml`, profil EN 16931) intégré au PDF (PDF/A, sRGB) au téléchargement d'une facture numérotée. _Source : `integrations/facturx.ts`_
- [ ] **EFA-05** Mentions légales : pénalités, indemnité 40 €, franchise 293 B, autoliquidation 283-2 nonies, TVA sur encaissements, décennale. RM-07. _Source : `regles-efacture.ts#mentionsLegales`_
- [ ] **EFA-06** Edge Functions SUPER PDP : `pdp-oauth-start/callback`, `pdp-disconnect`, `pdp-check-eligibility`, `pdp-emit-invoice`, `pdp-sync-events`, `pdp-post-lifecycle`, `pdp-receive`, `pdp-invoice-file`, `pdp-ereporting`, `pdp-webhook`. _Source : schéma §8.4_
- [ ] **EFA-07** Tables `pdp_connexions`, `pdp_connexion_secrets` (service seul), `pdp_oauth_etats`, `facture_cycle_vie`, `factures_entrantes(_lignes)`, `ereporting_depots`, `integration_journal`. _Source : schéma §2.7_
- [ ] **EFA-20** Défaut : les fonctions PDP ne vérifient **pas le rôle** (un compte `lecture` peut déposer, un technicien connecter/déconnecter). _Source : schéma §8.4_
- [ ] **EFA-21** Défaut : `pdp-webhook` compare le secret avec `!==` ; `verify_jwt=false` non déclaré dans `config.toml`. _Source : schéma §8.4_
- [ ] **EFA-22** Défaut : BT-113 calculé avec le solde recalculé côté client (FAC-92). _Source : ts §4.2_

## 17. import / export

- [x] **IMP-01** Import d'articles : `;` uniquement, encodage constaté (BOM UTF-8/16, UTF-8 strict, sinon Windows-1252), colonnes par nom, requises `CodeArticle`, `Libelle1` ; nombre de champs = en-tête (sinon « les colonnes seraient décalées »). _Source : `regles-import-articles.ts`_ — Preuve : `tests/parite/import-articles.essai.ts`.
- [x] **IMP-02** Mapping articles : désignation = Libelle1 sinon 80 car. de BlocNote ; PV HT à virgule ; `BIEN` → bien ; `Actif = "1"` ; `GereEnStock = "1"` ; famille = FamilleArt1. _Source : idem_ — Preuve : `tests/parite/import-articles.essai.ts`.
- [x] **IMP-03** TVA `INTER`→10, `NORMA`→20, `EXO`/`0`→0, inconnu→20 signalé (RM-06). _Source : idem_ — Preuve : `tests/parite/import-articles.essai.ts` (cas nommés).
- [x] **IMP-04** Unités UNI→u, M→m, M2→m², M3→m³, HR→h, PC→pièce, MM→mm, JOUR→jour ; inconnue (`ML`) → vide + signalement. _Source : idem_ — Preuve : `tests/parite/import-articles.essai.ts` (« unités du fichier »).
- [x] **IMP-05** Code répété dans le fichier : premier gardé ; créés / mis à jour comptés. _Source : idem_ — Preuve : `tests/parite/import-articles.essai.ts`, `components/import.essai.tsx`, `tests/rls/articles.essai.ts`.
- [x] **IMP-06** Rapport de rejets CSV. _Source : `regles-csv.ts#rapportRejetsCsv`_ — Preuve : `tests/parite/import-articles.essai.ts` (« le rapport téléchargé »), `components/import.essai.tsx`.
- [ ] **IMP-10** Import de clients : CSV RFC 4180 `;`, colonnes type Vertuoza (« Nom de l'entreprise » requise), colonnes versées en notes, colonnes écartées (BIC, IBAN, TVA ambiguë…). _Source : `regles-import-clients.ts`_
- [ ] **IMP-11** Pays FRANCE→FR, BELGIQUE/BELGIUM→BE, SUISSE→CH, LUXEMBOURG→LU, ALLEMAGNE→DE, ESPAGNE→ES, ITALIE→IT, défaut FR. _Source : idem_
- [ ] **IMP-12** Conditions : « réception/comptant/immédiat » → 0 net ; sinon premier nombre ; « fin de mois »/« fdm » → fin de mois (« 30 jours fin de mois » → 30 fdm ; « 45j » → 45 net). _Source : idem_
- [ ] **IMP-13** Rapprochement : SIRET unique → mise à jour ; sinon nom normalisé ; plusieurs → ambigu ; sinon création ; aperçu (à créer, à mettre à jour, rejetés, ambigus, signalés, corrections d'annuaire, types déduits). _Source : idem, `app.js:16811-16995`_
- [ ] **IMP-14** Écriture : créations par lots de 200 à **clés uniformisées** (piège `columns=`), mises à jour une par une ; rapport CSV. _Source : `queries/clients.ts`_
- [ ] **IMP-20** Import de factures historiques : en-têtes (requis) + lignes (facultatif, sinon ligne unique « Facturation (historique) ») ; séparateur `;` ou `,` ; dates ISO seulement ; alias de colonnes. _Source : `regles-import-factures.ts`_
- [ ] **IMP-21** Contrôles à 0,011 : signe du HT vs type ; HT×taux − TVA ; HT+TVA − TTC ; Σ lignes = HT ; numéro unique ; un rejet interdit toute écriture. _Source : idem_
- [ ] **IMP-22** Taux 0 % : catégorie obligatoire E / AE / Z / O ; montants stockés en valeur absolue ; `legacy_id = "compta:" + numero` ; statut `payée` ; écriture brouillon → lignes → numéro + statut. _Source : idem, `queries/factures-import.ts`_
- [ ] **IMP-23** Bouton visible si `factures` créer **et** modifier. _Source : `app.js:5195`_
- [ ] **IMP-30** Import DPGF CSV/Excel : feuille avec le plus de cellules numériques, lignes à ignorer devinées, rôles de colonnes devinés par en-tête, ligne sans quantité ni prix = chapitre. _Source : `app.js:13848, 13938`_
- [ ] **IMP-31** Défaut DPGF : `"1.234"` lu 1,234 ; `;` retenu seulement si la 1re ligne n'a aucune virgule ; pas de `""` ; colonne prix jamais devinée par le contenu ; import remplace tout l'avancement sans confirmation. _Source : `app-2.md §4`_
- [ ] **IMP-40** Export JSON « sauvegarde » de la société (`terrain-sauvegarde-AAAA-MM-JJ.json`, `version: 2`) ; import JSON de restauration **sans garde de rôle** dans l'écran. _Source : `app.js:399-430`_

---

## 18. Transversal (formats, navigation, robustesse)

- [ ] **TRV-01** Montants : `Intl.NumberFormat('fr-FR', EUR)` — milliers en espace fine insécable U+202F, virgule, « € » précédé de U+00A0 ; `money(undefined)` = « 0,00 € ». RM-80. _Source : `app.js:625`_
- [ ] **TRV-02** Dates : `JJ/MM/AAAA`, vide → « — » ; jamais `toISOString()` pour « aujourd'hui » (`todayISO`/`dateISO` en composantes locales). RM-81. _Source : `app.js:781`, `CLAUDE.md`_
- [ ] **TRV-03** Taux : « 5,5 % » (`formaterTaux`). _Source : `regles-totaux.ts`_
- [ ] **TRV-04** `""` de l'écran → `null` pour énumérations, dates, numériques ; champ sans colonne filtré avant envoi ; valeur hors énumération → `null`. _Source : `html-adapter.ts#normaliser`, `CLAUDE.md`_
- [ ] **TRV-05** Mode discret : tous les montants remplacés par `••• €`. _Source : `app.js:626, 773`_
- [ ] **TRV-06** Recherche insensible aux accents, multi-mots ; montants cherchables (formatés et `toFixed(2)`) ; Entrée fait défiler les résultats ; redessin différé 300 ms. _Source : `app.js:2151-2330, 4383-4460, 5585`_
- [ ] **TRV-07** Croisement facture ↔ BC par référence client normalisée, avec « d'où vient la correspondance ». _Source : `app.js:2179-2279`, `regles-liens-facture-bc.ts`_
- [ ] **TRV-08** Historique navigateur : « Précédent » revient à l'onglet / formulaire. _Source : `app.js:1086-1110`_
- [ ] **TRV-09** Notifications : véhicules, habilitations, documents légaux, dossiers RH, BC en retard, documents sous-traitants (≤ 30 j), rappels ; « fait » mémorisé par société. _Source : `app.js:627-760`_
- [ ] **TRV-10** Chargement tolérant : une table en échec garde ses données précédentes et s'annonce par un bandeau ; une lecture **tronquée** (plafond de lignes) est un refus, jamais une liste partielle. _Source : `app.js:523, 557`, `html-adapter.ts#chargerCollection`_
- [ ] **TRV-11** Menu épinglé mémorisé (préférence locale). _Source : `app.js:1267`_
- [ ] **TRV-12** Aucune URL/clé en dur ; rien de secret en `VITE_`. _Source : `app.js:224`, `CLAUDE.md`_
- [ ] **TRV-13** Échappement des attributs : `&` encodé en premier (injection prouvée) ; retours à la ligne non échappés dans l'ancien `jsAttr`. _Source : `app.js:835`_
- [ ] **TRV-14** Aucun `catch` muet ; aucun nombre magique (8 Mo, 30 j, 3/5 photos, 900 px, JPEG 0,6/0,85…). _Source : `CLAUDE.md`, `app-2.md §4`_
- [ ] **TRV-15** Bibliothèques PDF/XLSX/Word embarquées (pas de CDN : faille xlsx 0.18.5, pas d'`integrity`). _Source : `app-3.md §0`_

---

## 19. Tables, vues, RPC et Edge Functions — récapitulatif

« Lu / écrit » = colonnes réellement utilisées par l'ancienne app (pont `html-adapter`,
`queries/*`, RPC). ✗ = existe mais **inutilisé** par l'app.

| Objet | Usage | Colonnes réellement lues / écrites | Module cible |
|---|---|---|---|
| `societes` | Tenant, identité légale | L/E : colonnes `CHAMPS_SOCIETE` (adresse, CP, ville, tél., e-mail, siret, siren, nom, tva_intracom, raison_sociale_legale, forme_juridique, code_naf, capital_social, rcs_*, pays_code, regime_tva, ereporting_regime, tva_sur_encaissements, autoliquidation_batiment, indemnite_recouvrement, mention_penalites_retard, assurance_decennale_*, adresse_electronique_*, iban, bic) ; L : code, uuid | societes |
| `societe_settings` | Réglages jsonb | L/E : `infos_entreprise` (dont `reglages`), `notifs_traitees` | societes, reglages |
| `profiles` | Compte | L : id, nom, email ; E : nom | auth-roles |
| `membres_societe` | Appartenance + rôle | L : profile_id, societe_id, role, actif ; E : role | auth-roles |
| `invitations` | Invitations | L : tout ; E : statut (`annulee`) ; création par Edge | auth-roles |
| `role_permissions` | Matrice | L : role, module, action (count exact) | auth-roles |
| `clients` | Clients | L/E : toutes les colonnes du formulaire + `eligibilite_*` reportés ; L (rapprochement) : id, nom, siret, siren, cadre, délai | clients |
| `interlocuteurs` | Contacts | L/E : client_id, nom, fonction, telephone, email | clients |
| `devis` / `devis_lignes` | Devis | L/E : en-tête complet ; lignes type, designation, commentaire, quantite, prix_unitaire, tva, unite, article_reference, metier, position, `montant_ht` (écrit) | devis |
| `v_devis_totaux` | Totaux devis | L : ht, tva, ttc (queries seulement ; l'écran recalcule) | devis |
| `factures` / `facture_lignes` | Factures, avoirs | L/E : en-tête (voir FAC-70), `verrouillee`, `emetteur_*`, `client_*` ; ✗ `total_*`, `net_a_payer`, `ventilation_tva` ; lignes comme devis (`unite_code`, `tva_categorie` non écrits sauf import) | facturation |
| `v_facture_totaux` | Totaux facture | L : ht, tva, ttc (imputation, e-facture, Edge PDP) | facturation |
| `v_facture_solde` | Solde | L : queries (l'écran recalcule le statut) | facturation |
| `reglements` | Encaissements | L/E : facture_id, date, montant, mode, reference | facturation |
| `compteurs` | Numérotation | L/E : type, annee, valeur, prefixe | reglages |
| `bons_commande` | BC, SAV | E : voir BC-60 (+ planning : dates, heures, durée, schedule_par_metier, tentatives_contact, rappel_date, montant_sous_traitant, pièce) ; L par la vue | commandes |
| `v_bons_commande_terrain` | Lecture BC (prix masqués) | L : `select *` (sans `telephone_locataire`) | commandes |
| `bon_commande_lignes` / `v_bon_commande_lignes_terrain` | Lignes BC | E table, L vue | commandes |
| `bon_commande_photos` | Photos SAV | L/E : chemin, legende, position | commandes |
| `planning_taches` | Tâches | L : tout (dérivés du BC) ; E : via RPC + création/suppression | commandes, planning |
| `tache_travaux_supplementaires` / `v_travaux_supplementaires_terrain` | Travaux sup. | L/E : bon_commande_id, planning_tache_id, libelle, quantite, unite, prix_vente_ht, tva, origine, statut | commandes |
| `workflow_journal` | Journal du circuit | E par RPC ; ✗ en lecture à l'écran | commandes |
| `chantiers` | Chantiers | L/E : nom, client, conducteur(_id), adresse, type, dates, infos_diverses, PPSPS | chantiers |
| `chantier_achats` | Achats | L/E : categorie, designation, montant, date_achat, salarie_id, heures | chantiers |
| `chantier_dpgf_lignes`, `chantier_todos`, `chantier_documents`, `chantier_inspections`, `chantier_comptes_rendus`, `chantier_devis_complementaires` | Filles chantier | ✗ par l'écran (lues par `queries/chantiers.ts` seulement) — cause de CHA-50 | chantiers |
| `chantier_affectations` | Visibilité terrain | ✗ écran ; lue par RLS | chantiers |
| `chantier_avancement_factures` | Historique des situations | ✗ | facturation |
| `v_chantier_avancement` | Avancement | ✗ écran (recalculé) | chantiers |
| `articles` | Catalogue | L/E : toutes | articles |
| `interventions` (+ `_photos`, `_controles`) | Rapports | L/E : en-tête, constatations, preconisations, signature_chemin ; photos | planning |
| `conducteurs` | Conducteurs | L/E : nom, telephone, email, profile_id, salarie_id, actif | reglages |
| `techniciens` | Équipes | L/E : nom, metiers, metier, couleur | rh, planning |
| `metiers`, `referentiels` | Listes | L/E : libelle, couleur, position ; domaine, libelle, code, couleur, icone, position | reglages |
| `fournisseurs` | Annuaire | L/E : nom, specialite, contact_nom, telephone, email, adresse, CP, ville, siret, notes, actif | reglages |
| `sous_traitants` / `sous_traitant_documents` | Sous-traitants | L/E : nom, contacts, siret, siren, tva, adresse, metiers ; documents ✗ | reglages |
| `documents_legaux` | Documents société | L/E : nom, date_validite (`notes` perdu) | societes |
| `salaries` / `v_salaries_annuaire` | Salariés | E table, L vue | rh |
| `salarie_documents`, `salarie_visites_medicales` | Dossier RH | L/E | rh |
| `salarie_absences`, `_habilitations`, `_contrats`, `_formations`, `_contacts_urgence`, `_rdv` | RH | ✗ par l'écran | rh |
| `vehicules` / `materiels` | Parc | L/E : en-tête (sans CT) ; filles ✗ | vehicules |
| `pdp_*`, `factures_entrantes`, `facture_cycle_vie`, `ereporting_depots`, `integration_journal` | PDP | Edge Functions | e-facture |
| `fournisseurs_controle` (+ lignes) | Contrôle de prix | ✗ (dormante) | — |
| `kv_store`, `zz_obsolete_*` | Vestiges fermés | ✗ (7 factures à rapatrier) | import |
| RPC `prochain_numero(p_societe, p_type, p_annee)` | Numéro devis / SAV / intervention | exige `peut_ecrire` ; refuse facture/avoir/acompte | devis, commandes |
| RPC `mon_role`, `a_permission` | Session, droits | — | auth-roles |
| RPC `tache_*` (3), `bc_*` (6) | Circuit BC | voir BC-63 | commandes |
| Déclencheurs `facture_attribuer_numero`, `bc_attribuer_numero_interne` | Numérotation à l'émission / création | — | facturation, commandes |
| Edge `extraire-bc` | OCR | `{fichierBase64, mimeType}` | ocr |
| Edge `inviter-salarie` | Invitations | `{salarie_id, email, role}` | auth-roles |
| Edge `pdp-*` (11) | Facture électronique | voir EFA-06 | e-facture |
| Edge `prochain-numero` | **Cassée** (table `counters` absente, service_role sans contrôle, non atomique, préfixe RAP) : à ne pas utiliser | — | — |
| Storage bucket `terrain` | Pièces jointes BC, RH | chemin `<societe>/<domaine>/<id>/<ts>_<nom>`, URL signées 1 h | transversal |
| API `api-adresse.data.gouv.fr`, `recherche-entreprises.api.gouv.fr`, `geo.api.gouv.fr` | Annuaires publics | appel navigateur sans clé | clients |

---

## Décompte

| Section | Préfixe | Items |
|---|---|---|
| auth-roles | AUTH | 54 |
| societes | SOC | 23 |
| clients | CLI | 23 |
| chantiers | CHA | 33 |
| devis | DEV | 38 |
| articles | ART | 13 |
| commandes | BC | 73 |
| facturation | FAC | 72 |
| ocr | OCR | 16 |
| espace-client | ESP | 8 |
| planning / interventions / rapports | PLN | 24 |
| rh | RH | 13 |
| vehicules / materiel | VEH | 7 |
| statistiques / tableaux de bord | STA | 8 |
| reglages | PAR | 9 |
| facturation électronique | EFA | 10 |
| import / export | IMP | 18 |
| transversal | TRV | 15 |
| **Total** | | **457** |
