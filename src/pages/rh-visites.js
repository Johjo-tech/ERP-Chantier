/**
 * Le suivi en santé au travail, à l'écran.
 *
 * PREMIER MORCEAU SORTI DU MONOLITHE, et pour une raison mesurable. Semgrep
 * écarte tout fichier de plus de 1 000 000 d'octets — sans un mot, le rapport
 * restant vert. `src/pages/index.html` a franchi ce seuil un jour et personne
 * ne l'a su. `app.js` en approchait à moins de 2 000 octets : la garde de
 * `taille-ecran.test.ts` a rougi avant le mur et demandait un découpage,
 * « pas un énième rabotage ». Le registre des visites médicales est parti le
 * premier parce qu'il se tient seul : un état, ses règles d'affichage, son
 * formulaire, et aucune attache au reste de l'écran.
 *
 * CE MODULE NE CONNAÎT PAS L'APPLICATION. Il reçoit d'elle, une fois au
 * chargement, les quelques noms dont il a besoin (`installerRhVisites`). La
 * dépendance ne va donc que dans un sens — `app.js` → ce module — et rien ici
 * ne peut remonter dans l'écran par surprise.
 *
 * `state` est un objet jamais réassigné : en garder la référence suffit, et
 * les deux fichiers voient bien le même.
 *
 * Ses fonctions se publient elles-mêmes sur `window`, comme celles d'`app.js` :
 * les attributs `onclick=` qu'elles produisent y sont résolus au moment du
 * clic, jamais avant. Les deux gardes — `vite.config.ts` et
 * `noms-publies-declares.test.ts` — lisent ce fichier au même titre que l'autre.
 */

/* Ce que l'écran prête à ce module. */
let state,
    esc,
    fmtDate,
    jsAttr,
    renderTab,
    showToast,
    recharger,
    todayISO,
    uid,
    openAttachmentPreview,
    reglagesCourants,
    dossierDuSalarie,
    refusDocumentRh;

export function installerRhVisites(contexte){
  ({ state, esc, fmtDate, jsAttr, renderTab, showToast, recharger, todayISO, uid, openAttachmentPreview, reglagesCourants, dossierDuSalarie, refusDocumentRh } = contexte);
}

/* ---------- Registre des visites médicales ----------

   Le suivi en santé au travail a quitté le dossier documentaire : une visite
   n'est pas un document, elle porte un type, un avis d'aptitude, des réserves
   et une échéance. Les deux dates de la fiche salarié restent, mais tenues par
   la base d'après la visite la plus récente — un déclencheur les réécrit à
   chaque enregistrement, d'où les champs grisés dans le formulaire.

   Le seuil est celui du médical (`visiteMedicale`, 45 j par défaut), pas celui
   des documents (30 j) : c'est le réglage de Paramètres › RH qui le dit. */

function seuilVisiteMedicale(){
  const seuils = reglagesCourants().seuils || {};
  return seuils.visiteMedicale != null ? seuils.visiteMedicale : 45;
}
function visitesDuSalarie(salarieId){
  return window.trierVisites(state.visitesRh.filter(v=>v.salarieId===salarieId));
}
/* L'échéance qui fait foi est la COLONNE de la fiche, pas le registre.
   Les deux disent la même chose dès qu'une visite est enregistrée — un
   déclencheur s'en charge. Mais avant cela, la colonne porte encore ce qui
   avait été saisi à la main, et c'est la seule échéance que l'entreprise
   possède : la recalculer depuis un registre vide la ferait disparaître.
   En production, le seul salarié était précisément dans ce cas. */
function echeanceVisite(salarieId){
  const s = state.salaries.find(x=>x.id===salarieId);
  return (s && s.visiteMedicaleProchaine) || null;
}
function etatVisiteDuSalarie(salarieId){
  return window.etatVisite(echeanceVisite(salarieId), todayISO(), seuilVisiteMedicale());
}

/* Les deux dates de la fiche, après une écriture au registre.

   `state.editing` est un clone figé pris à l'ouverture : les deux champs
   restaient vides sous les yeux de qui venait d'enregistrer la visite, pendant
   que le badge d'à côté, qui lit `state.salaries`, disait juste.

   Deux champs, pas un remplacement en bloc : `visitesAJoindre` et
   `habilitationsAJoindre` n'existent que là, avec les fichiers choisis. Les
   `input` sont reposés à la main — ils sont `disabled`, personne ne les relit,
   et aucun redessin n'est garanti derrière. */
export function resynchroniserDatesVisite(salarieId){
  const s = state.salaries.find(x=>x.id===salarieId);
  const e = state.editing;
  if(!s || !e || e.id !== salarieId) return;
  e.visiteMedicaleDate = s.visiteMedicaleDate || '';
  e.visiteMedicaleProchaine = s.visiteMedicaleProchaine || '';
  const derniere  = document.getElementById('sal_visiteMedicaleDate');
  const prochaine = document.getElementById('sal_visiteMedicaleProchaine');
  /* Les deux champs sont en `text` depuis qu'un champ date vide et grisé se
     lisait comme un champ cassé : on y repose donc ce que le gabarit y met,
     mis en forme, et non la date ISO brute. */
  if(derniere)  derniere.value  = e.visiteMedicaleDate
    ? fmtDate(e.visiteMedicaleDate) : 'Aucune visite au registre';
  if(prochaine) prochaine.value = e.visiteMedicaleProchaine
    ? fmtDate(e.visiteMedicaleProchaine) : 'Aucune échéance — enregistrez une visite ci-dessous';
}

/* Une fiche neuve n'a pas d'identifiant, et le panneau de visite a pourtant
   besoin d'une clé pour savoir sur quelle fiche il s'affiche. `undefined` n'en
   est pas une : elle traverse un attribut `onclick`, où `jsAttr` l'écrit sous
   la forme de la chaîne « undefined » — le panneau s'ouvrirait en mémoire sans
   jamais se montrer. Aucun uuid ne peut valoir cette sentinelle. */
const VISITE_FICHE_NEUVE = '__salarie_en_creation__';
export function cleRegistreVisites(salarie){
  return (salarie && salarie.id) || VISITE_FICHE_NEUVE;
}
let chargementVisitesRh = null;
export function visitesRhPretes(){
  return !chargementVisitesRh
    && state.visitesRhCharges
    && state.visitesRhSociete === state.societeId;
}
export function chargerVisitesRh(force){
  if(chargementVisitesRh) return chargementVisitesRh;
  if(!force && visitesRhPretes()) return Promise.resolve();
  /* Même défaut que le dossier documentaire, et il se réparait au même
     endroit : pendant un changement de société, `state.salaries` porte encore
     les fiches de celle qu'on quitte, la liste d'identifiants part vide, et
     retenir ce néant condamne le registre à rester vide toute la session. */
  if(state.chargementGlobal) return Promise.resolve();
  const societe = state.societeId;
  const ids = state.salaries.filter(s=>s.societeId===societe).map(s=>s.id);
  chargementVisitesRh = (async ()=>{
    try{
      state.visitesRh = await window.chargerVisitesMedicales(ids);
    }catch(err){
      console.error('Registre des visites illisible', err);
      state.visitesRh = [];
      showToast("Les visites médicales n'ont pas pu être chargées.");
    }finally{
      chargementVisitesRh = null;
      if(!state.chargementGlobal){
        state.visitesRhCharges = true;
        state.visitesRhSociete = societe;
      }
    }
    renderTab();
  })();
  return chargementVisitesRh;
}

/* La conformité RH d'un salarié : son dossier ET son suivi médical.
   Les deux se composent ici, et non dans une règle feuille — celles-ci
   n'importent que des types, et ne peuvent donc pas se connaître. */
export function conformiteRhDuSalarie(salarieId){
  const bilan = dossierDuSalarie(salarieId);
  const visite = etatVisiteDuSalarie(salarieId);
  /* « Pas d'échéance connue » vaut manquement : on ne sait pas si la personne
     est suivie, et c'est ce que l'inspection du travail viendra demander. */
  const manqueMedical = visite.etat === 'inconnue' || visite.etat === 'depassee';
  return { ...bilan, visite, manqueMedical, complet: bilan.complet && !manqueMedical };
}

function etatVisiteBadge(salarieId){
  const info = etatVisiteDuSalarie(salarieId);
  const echeance = echeanceVisite(salarieId);
  if(info.etat === 'depassee') return `<span class="badge danger">Dépassée depuis le ${fmtDate(echeance)}</span>`;
  if(info.etat === 'bientot') return `<span class="badge warn">À prévoir dans ${info.jours} j</span>`;
  if(info.etat === 'aJour') return `<span class="card-sub">Prochaine le ${fmtDate(echeance)}</span>`;
  return `<span class="badge danger" title="Aucune échéance connue : rien ne préviendra">Aucun suivi</span>`;
}
/**
 * Le suivi médical, dit en un coup d'œil dans la liste des collaborateurs.
 *
 * L'information existait — deux dates sur la fiche, un registre complet plus
 * bas — mais la liste n'en montrait rien : un « ⚠ à vérifier » générique,
 * partagé avec la carte BTP et les habilitations, qui n'apprenait pas ce qui
 * n'allait pas. Or c'est en parcourant la liste qu'on décide qui convoquer.
 *
 * Quatre états et non trois : « aucun suivi » n'est pas « à jour ». Un salarié
 * dont on ignore l'échéance vaut, pour l'inspection du travail, un salarié non
 * suivi — et c'est le cas le plus fréquent en pratique.
 *
 * Le seuil vient de Paramètres › RH (`visiteMedicale`, 45 jours par défaut) et
 * non d'un 60 codé en dur : il est déjà réglable, et deux seuils pour la même
 * échéance finiraient par se contredire.
 */
export function badgeVisiteMedicaleListe(salarieId){
  const info = etatVisiteDuSalarie(salarieId);
  const echeance = echeanceVisite(salarieId);
  const commun = 'margin-left:6px;';
  if(info.etat === 'depassee'){
    return `<span class="badge danger" style="${commun}" title="Visite médicale dépassée depuis le ${fmtDate(echeance)}">🩺 Visite expirée</span>`;
  }
  if(info.etat === 'bientot'){
    return `<span class="badge warn" style="${commun}" title="Prochaine visite médicale le ${fmtDate(echeance)}">🩺 À renouveler (${info.jours} j)</span>`;
  }
  if(info.etat === 'aJour'){
    return `<span class="badge success" style="${commun}" title="Prochaine visite médicale le ${fmtDate(echeance)}">🩺 À jour</span>`;
  }
  return `<span class="badge danger" style="${commun}" title="Aucune échéance connue : rien ne préviendra">🩺 Aucun suivi</span>`;
}
export function pastilleVisiteRh(salarieId){
  const info = etatVisiteDuSalarie(salarieId);
  if(info.etat === 'inconnue') return `<span class="doc-rh-pastille manquant" title="Aucune visite enregistrée">✕</span>`;
  if(info.etat === 'depassee') return `<span class="doc-rh-pastille expire" title="Échéance dépassée">!</span>`;
  if(info.etat === 'bientot') return `<span class="doc-rh-pastille bientot" title="Échéance proche">~</span>`;
  return `<span class="doc-rh-pastille ok" title="Suivi à jour">✓</span>`;
}
function visiteRhRowHTML(v){
  const t = window.typeVisite(v.type);
  const avis = window.avisAptitude(v.avis);
  const regime = window.regimeSuivi(v.suivi);
  const details = [regime.libelle, v.organisme, v.medecin]
    .filter(Boolean).map(esc).join(' · ');
  const couleurAvis = avis ? (avis.gravite==='danger'?'#a30f22':avis.gravite==='warn'?'#a56200':'#15803d') : 'inherit';
  return `<div class="chantier-file-row">
    <span style="flex:1; min-width:0;">
      ${t.icone} <strong>${esc(t.libelle)}</strong> <span class="card-sub">du ${fmtDate(v.dateVisite)}</span>
      ${avis? `<span style="color:${couleurAvis}; font-weight:700;"> · ${esc(avis.libelle)}</span>`:''}
      ${details? `<span class="card-sub">${details}</span>`:''}
      ${v.reserves? `<span class="card-sub">⚠ ${esc(v.reserves)}</span>`:''}
      ${v.notes? `<span class="card-sub">📝 ${esc(v.notes)}</span>`:''}
    </span>
    ${v.prochaineVisite? `<span class="card-sub">→ ${fmtDate(v.prochaineVisite)}</span>` : '<span class="card-sub">sans échéance</span>'}
    ${v.fichierChemin
      ? `<button class="btn small ghost" onclick="ouvrirAttestationVisiteEcran('${jsAttr(v.id)}')">📎 Attestation</button>`
      : '<span class="card-sub">sans attestation</span>'}
    <button class="btn small" onclick="ouvrirFormVisiteRh('${jsAttr(v.salarieId)}','${jsAttr(v.id)}')">Modifier</button>
    <button class="btn small danger" onclick="supprimerVisiteRhEcran('${jsAttr(v.id)}')">✕</button>
  </div>`;
}
/* Frère de `habilitationEnAttenteHTML`, et pour la même raison : une visite
   saisie à la création n'existe pas encore au registre.

   Il ne réutilise pas `visiteRhRowHTML` : les trois boutons de celui-ci
   cherchent la visite dans `state.visitesRh`, où celle-ci n'est pas. La croix
   ne ferait donc rien du tout, sans un mot — le pire des échecs. */
function visiteEnAttenteHTML(v){
  const t = window.typeVisite(v.saisie.type);
  const avis = window.avisAptitude(v.saisie.avis);
  return `<div class="chantier-file-row">
    <span style="flex:1; min-width:0;">
      ${t.icone} <strong>${esc(t.libelle)}</strong> <span class="card-sub">du ${fmtDate(v.saisie.dateVisite)}</span>
      ${avis? `<span class="card-sub"> · ${esc(avis.libelle)}</span>`:''}
    </span>
    ${v.saisie.prochaineVisite? `<span class="card-sub">→ ${fmtDate(v.saisie.prochaineVisite)}</span>` : '<span class="card-sub">sans échéance</span>'}
    <span class="card-sub">${v.fichierNom? '📎 '+esc(v.fichierNom) : 'sans attestation'}</span>
    <span class="badge warn" title="Sera enregistrée au registre à l'enregistrement de la fiche">à déposer</span>
    <button type="button" class="btn small" onclick="ouvrirFormVisiteRhEnAttente('${jsAttr(v.cle)}')">Modifier</button>
    <button type="button" class="btn small danger" onclick="retirerVisiteEnAttente('${jsAttr(v.cle)}')">✕</button>
  </div>`;
}
/* Le registre d'un salarié : son état, son historique, et de quoi compléter.
   Servi tel quel dans l'onglet Visites médicales et dans la fiche — y compris
   sur une fiche qui n'est pas encore enregistrée. */
export function visitesMedicalesHTML(salarie){
  const cle = cleRegistreVisites(salarie);
  const neuve = !salarie.id;
  /* Ce qui attend d'être déposé n'appartient qu'à la fiche ouverte : la même
     fonction sert l'onglet Visites médicales, où `state.editing` est le vide
     posé par `closeForm`. */
  const enAttente = (state.formOpen.salarie && state.editing && cleRegistreVisites(state.editing) === cle)
    ? (state.editing.visitesAJoindre || []) : [];
  const formIci = !!state.rhVisiteForm && state.rhVisiteForm.salarieId === cle;
  /* Un salarié qui n'existe pas encore n'a rien au registre : le chargement ne
     ramènerait rien, et le `renderTab()` de sa queue repeindrait la fiche
     depuis un `state.editing` vide — la saisie en cours partirait avec. */
  if(!neuve && !visitesRhPretes()){
    chargerVisitesRh();
    return '<div class="empty">Chargement du registre…</div>';
  }
  const visites = neuve ? [] : visitesDuSalarie(salarie.id);
  /* Une échéance sans registre : la date saisie à la main avant que le
     registre n'existe. Elle vaut, mais elle ne dit ni le type de visite ni
     l'avis rendu — le dire, plutôt que d'afficher un vide qui se lirait comme
     une absence de suivi. */
  const heritee = !neuve && !visites.length && echeanceVisite(salarie.id);
  const lignes = visites.map(visiteRhRowHTML).join('') + enAttente.map(visiteEnAttenteHTML).join('');
  /* `etatVisiteBadge` chercherait `undefined` dans `state.salaries` et
     annoncerait « aucun suivi » alors qu'une visite attend juste en dessous. */
  const entete = neuve
    ? (enAttente.length
      ? `<span class="badge warn">${enAttente.length} visite${enAttente.length>1?'s':''} à enregistrer avec la fiche</span>`
      : '<span class="card-sub">Saisissez ici la visite d\'embauche : elle partira avec la fiche.</span>')
    : etatVisiteBadge(salarie.id);
  return `
    <div class="card-sub">${entete}</div>
    <div style="margin-top:10px;">${lignes || (heritee
      ? `<div class="empty">Échéance reprise de l'ancienne saisie, sans visite au registre : ni type, ni avis, ni attestation. Enregistrez la prochaine visite pour repartir sur du solide.</div>`
      : '<div class="empty">Aucune visite enregistrée. Ce salarié n\'a pas de suivi médical traçable.</div>')}</div>
    ${formIci? formVisiteRhHTML() : `<button class="btn small primary" style="margin-top:10px;" onclick="ouvrirFormVisiteRh('${jsAttr(cle)}')">+ Enregistrer une visite</button>`}
  `;
}
/* On ne redessine que cette zone : `renderTab()` referait `salarieForm()`
   depuis `state.editing` — vide sur une création — et le nom, le poste et les
   dates déjà tapés disparaîtraient au clic sur « + Enregistrer une visite ».
   Même geste que `rafraichirZoneHabilitations`, et le même repli sur
   `renderTab` pour l'onglet Visites médicales, où la zone n'existe pas. */
export function rafraichirZoneVisites(){
  const zone = document.getElementById('suiviMedicalZone');
  if(zone) zone.innerHTML = visitesMedicalesHTML(state.editing);
  else renderTab();
}
function ouvrirFormVisiteRh(salarieId, visiteId){
  const v = visiteId ? state.visitesRh.find(x=>x.id===visiteId) : null;
  /* Le régime par défaut est celui de la visite précédente : il change
     rarement, et le resaisir à chaque fois inviterait à le laisser faux. */
  const precedente = v ? null : window.derniereVisite(visitesDuSalarie(salarieId));
  /* Calculés avant l'objet : l'échéance proposée en dépend. */
  const dateVisite = v? v.dateVisite : todayISO();
  const type = v? v.type : (precedente? 'periodique' : 'embauche');
  const suivi = v? v.suivi : (precedente? precedente.suivi : 'simple');
  state.rhVisiteForm = {
    salarieId, id: v? v.id : null,
    /* Renseignée quand on rouvre une visite encore en attente de dépôt : c'est
       elle qui distingue « modifier » de « ajouter une seconde ». */
    cleAttente: null,
    dateVisite, type, suivi,
    organisme: v? (v.organisme||'') : (precedente? (precedente.organisme||'') : ''),
    medecin: v? (v.medecin||'') : '',
    avis: v? (v.avis||'') : '',
    reserves: v? (v.reserves||'') : '',
    /* L'échéance est proposée DÈS L'OUVERTURE, et pas seulement quand on touche
       une des trois listes. Sans cela, le chemin du moindre effort — accepter la
       date du jour et les valeurs par défaut — laissait le champ vide, la base
       écrivait `prochaine_visite = NULL`, et le salarié qui venait d'être examiné
       affichait « 🩺 Aucun suivi ».
       `prochaineVisiteSuggeree` rend `null` pour une préreprise ou une visite à
       la demande : ces visites ne remettent aucun compteur à zéro, et le champ
       doit alors rester vide. */
    prochaineVisite: v
      ? (v.prochaineVisite||'')
      : (window.prochaineVisiteSuggeree(dateVisite, suivi, type) || ''),
    notes: v? (v.notes||'') : '',
    fichierNom: v? (v.fichierNom||'') : '',
    /* Une échéance déjà enregistrée a été décidée par quelqu'un : la
       proposition automatique ne doit pas la reprendre sous prétexte qu'on
       corrige le régime. */
    echeanceSaisieMain: !!(v && v.prochaineVisite)
  };
  rafraichirZoneVisites();
}
/* Rouvrir une visite encore en attente. Son attestation n'est pas remise dans
   le champ fichier — l'`input` est recréé vide — d'où le report du `File` dans
   `empilerVisiteEnAttente` : sans lui, « Modifier » puis « Enregistrer »
   perdrait la pièce en silence. */
function ouvrirFormVisiteRhEnAttente(cle){
  const v = (state.editing.visitesAJoindre||[]).find(x=>x.cle===cle);
  if(!v) return;
  state.rhVisiteForm = {
    salarieId: VISITE_FICHE_NEUVE, id: null, cleAttente: cle,
    ...v.saisie,
    fichierNom: v.fichierNom || '',
    echeanceSaisieMain: !!v.saisie.prochaineVisite
  };
  rafraichirZoneVisites();
}
function retirerVisiteEnAttente(cle){
  state.editing.visitesAJoindre = (state.editing.visitesAJoindre||[]).filter(x=>x.cle!==cle);
  if(state.rhVisiteForm && state.rhVisiteForm.cleAttente === cle) state.rhVisiteForm = null;
  rafraichirZoneVisites();
}
function fermerFormVisiteRh(){
  state.rhVisiteForm = null;
  rafraichirZoneVisites();
}
function formVisiteRhHTML(){
  const f = state.rhVisiteForm;
  return `<div class="form-panel" style="margin-top:12px;">
    <h3>${(f.id || f.cleAttente)? 'Modifier la visite' : 'Enregistrer une visite médicale'}</h3>
    <div class="field-grid">
      <div class="field"><label>Date de la visite</label><input type="date" id="visRh_dateVisite" value="${f.dateVisite||''}" onchange="onVisiteRhEcheanceChange()"></div>
      <div class="field"><label>Type de visite</label><select id="visRh_type" onchange="onVisiteRhEcheanceChange()">
        ${window.TYPES_VISITE.map(t=>`<option value="${t.code}" ${f.type===t.code?'selected':''}>${t.icone} ${esc(t.libelle)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Régime de suivi</label><select id="visRh_suivi" onchange="onVisiteRhEcheanceChange()">
        ${window.REGIMES_SUIVI.map(r=>`<option value="${r.code}" ${f.suivi===r.code?'selected':''}>${esc(r.libelle)}</option>`).join('')}
      ${/* La référence légale est rendue TOUT DE SUITE, et non au premier
            `onchange` : c'est elle qui justifie le délai proposé, et qui n'y
            touchait pas ne l'a jamais vue. Même cause que l'échéance vide. */''}
      </select><div class="card-sub" id="visRh_reference" style="margin-top:4px;">${esc(window.regimeSuivi(f.suivi).reference)}</div></div>
      <div class="field"><label>Avis d'aptitude</label><select id="visRh_avis">
        <option value="">— Non rendu —</option>
        ${window.AVIS_APTITUDE.map(a=>`<option value="${a.code}" ${f.avis===a.code?'selected':''}>${esc(a.libelle)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Service de santé au travail</label><input type="text" id="visRh_organisme" value="${esc(f.organisme)}" placeholder="Ex : AIST, APST BTP…"></div>
      <div class="field"><label>Médecin</label><input type="text" id="visRh_medecin" value="${esc(f.medecin)}"></div>
      <div class="field"><label>Prochaine visite</label><input type="date" id="visRh_prochaineVisite" value="${f.prochaineVisite||''}" onchange="onVisiteRhEcheanceMain()">
        <div class="card-sub" id="visRh_avertissement" style="margin-top:4px;${depassementRhHTML(f).style}">${esc(depassementRhHTML(f).texte)}</div></div>
      <div class="field full"><label>Réserves et aménagements</label><input type="text" id="visRh_reserves" value="${esc(f.reserves)}" placeholder="Ex : pas de port de charge supérieure à 15 kg"></div>
      <div class="field full"><label>Notes</label><input type="text" id="visRh_notes" value="${esc(f.notes)}"></div>
    </div>
    <div class="achat-salarie-zone">
      <label class="btn small" style="cursor:pointer;">📎 ${(f.id || f.cleAttente) && f.fichierNom? "Remplacer l'attestation" : "Joindre l'attestation"}<input type="file" id="visRh_fichier" accept=".pdf,image/*" style="display:none;" onchange="onFichierVisiteRhChange()"></label>
      <span class="card-sub" id="visRh_fichierNom">${f.fichierNom? esc(f.fichierNom) : 'PDF, JPEG, PNG ou WebP'}</span>
    </div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn primary" onclick="enregistrerVisiteRh()">Enregistrer</button>
      <button class="btn ghost" onclick="fermerFormVisiteRh()">Annuler</button>
    </div>
  </div>`;
}
/* Le panneau ne se redessine pas : le fichier déjà choisi vit dans l'élément
   `input`, et un redessin le perdrait sans le dire. On ne touche qu'aux deux
   textes d'aide et à l'échéance proposée. */
function onVisiteRhEcheanceChange(){
  const date = document.getElementById('visRh_dateVisite').value;
  const type = document.getElementById('visRh_type').value;
  const suivi = document.getElementById('visRh_suivi').value;
  document.getElementById('visRh_reference').textContent = window.regimeSuivi(suivi).reference;
  const champ = document.getElementById('visRh_prochaineVisite');
  /* La date proposée ne s'impose pas : le médecin a pu en écrire une autre sur
     l'avis, et c'est la sienne qui fait foi.

     Mais tant que personne n'a touché ce champ, la proposition suit le type et
     le régime — sinon, choisir la date PUIS passer en suivi renforcé laisserait
     les cinq ans du suivi simple, et l'écran proposerait un délai que la loi
     n'accorde pas à ce salarié. */
  if(date && !state.rhVisiteForm.echeanceSaisieMain){
    const suggeree = window.prochaineVisiteSuggeree(date, suivi, type);
    champ.value = suggeree || '';
  }
  onVisiteRhEcheanceSaisie();
}
/* L'utilisateur a posé lui-même l'échéance : la proposition ne la reprendra
   plus, quoi qu'il change ensuite. C'est la date de l'avis qui fait foi. */
function onVisiteRhEcheanceMain(){
  state.rhVisiteForm.echeanceSaisieMain = true;
  onVisiteRhEcheanceSaisie();
}
/**
 * L'avertissement de dépassement, au RENDU et non au premier `onchange`.
 *
 * Une échéance désormais proposée d'emblée, c'est une échéance qu'il faut
 * pouvoir juger d'emblée : sans cela, un délai au-delà du plafond légal
 * s'afficherait sans un mot tant que personne ne toucherait un champ.
 * `onVisiteRhEcheanceSaisie` dit la même chose après coup, et sur les mêmes
 * règles — les deux ne peuvent pas diverger.
 */
function depassementRhHTML(f){
  if(!f.dateVisite || !f.prochaineVisite) return { texte:'', style:'' };
  const verdict = window.depasseLePlafondLegal(f.dateVisite, f.prochaineVisite, f.suivi);
  if(!verdict.depasse) return { texte:'', style:'' };
  return {
    texte: `Au-delà du délai maximal (${fmtDate(verdict.plafond)}, ${verdict.regime.reference}).`,
    style: ' color:#a30f22;'
  };
}
function onVisiteRhEcheanceSaisie(){
  const date = document.getElementById('visRh_dateVisite').value;
  const suivi = document.getElementById('visRh_suivi').value;
  const prochaine = document.getElementById('visRh_prochaineVisite').value;
  const zone = document.getElementById('visRh_avertissement');
  if(!date || !prochaine){ zone.textContent = ''; zone.style.color = ''; return; }
  const verdict = window.depasseLePlafondLegal(date, prochaine, suivi);
  if(verdict.depasse){
    zone.textContent = `Au-delà du délai maximal (${fmtDate(verdict.plafond)}, ${verdict.regime.reference}).`;
    zone.style.color = '#a30f22';
  } else {
    zone.textContent = '';
    zone.style.color = '';
  }
}
function onFichierVisiteRhChange(){
  const fichier = (document.getElementById('visRh_fichier').files||[])[0];
  const zone = document.getElementById('visRh_fichierNom');
  if(!fichier){ zone.textContent = 'PDF, JPEG, PNG ou WebP'; return; }
  const verdict = window.verifierPieceJointe({ nom: fichier.name, type: fichier.type, taille: fichier.size });
  zone.textContent = verdict.ok ? fichier.name : verdict.motif;
}
async function enregistrerVisiteRh(){
  const f = state.rhVisiteForm;
  if(!f) return;
  const saisie = {
    dateVisite: document.getElementById('visRh_dateVisite').value,
    type: document.getElementById('visRh_type').value,
    suivi: document.getElementById('visRh_suivi').value,
    organisme: document.getElementById('visRh_organisme').value,
    medecin: document.getElementById('visRh_medecin').value,
    avis: document.getElementById('visRh_avis').value,
    reserves: document.getElementById('visRh_reserves').value,
    prochaineVisite: document.getElementById('visRh_prochaineVisite').value,
    notes: document.getElementById('visRh_notes').value
  };
  if(!saisie.dateVisite){ showToast('Indiquez la date de la visite.'); return; }
  if(saisie.prochaineVisite && saisie.prochaineVisite < saisie.dateVisite){
    /* La base le refuse aussi — mais lui laisser dire non produirait un
       message de contrainte, pas une phrase. */
    showToast('La prochaine visite ne peut pas précéder celle-ci.');
    return;
  }
  const fichier = (document.getElementById('visRh_fichier').files||[])[0] || null;
  if(fichier){
    const verdict = window.verifierPieceJointe({ nom: fichier.name, type: fichier.type, taille: fichier.size });
    if(!verdict.ok){ showToast(verdict.motif); return; }
  }
  /* Fiche neuve : ni écriture — la RLS du registre lit `salaries` — ni
     attestation, qui se range sous l'identifiant du salarié. La visite attend
     en mémoire, comme les habilitations. La bifurcation est ICI et pas plus
     haut : les trois garde-fous ci-dessus valent pour les deux chemins. */
  if(f.salarieId === VISITE_FICHE_NEUVE){
    empilerVisiteEnAttente(f, saisie, fichier);
    state.rhVisiteForm = null;
    rafraichirZoneVisites();
    showToast('Visite mise en attente : elle sera enregistrée avec la fiche.', 'success');
    return;
  }
  try{
    if(f.id) await window.majVisiteMedicale(f.id, saisie, fichier);
    else await window.ajouterVisiteMedicale(f.salarieId, saisie, fichier);
  }catch(err){
    console.error('Visite médicale refusée', err);
    showToast(refusDocumentRh(err));
    return;
  }
  state.rhVisiteForm = null;
  /* Séquentiel, et dans cet ordre. Le `Promise.all` d'avant laissait le
     `renderTab()` de la queue de `chargerVisitesRh` peindre avant que
     `recharger('salarie')` n'ait ramené les deux dates : visite enregistrée,
     et la fiche qui l'ignore. */
  await chargerVisitesRh(true);
  await recharger('salarie');
  resynchroniserDatesVisite(f.salarieId);
  rafraichirZoneVisites();
  showToast('Visite enregistrée.', 'success');
}
/* Le `File` est gardé tel quel, comme dans `ajouterHabilitationsChoisies` :
   `state.editing` ne part jamais à la sérialisation. `visitesAJoindre` ne doit
   en revanche JAMAIS entrer dans l'objet de `saveSalarie` — un `File` sérialisé
   devient `{}`, et `colonnesDe()` l'écarterait en silence. */
function empilerVisiteEnAttente(f, saisie, fichier){
  const e = state.editing;
  if(!e.visitesAJoindre) e.visitesAJoindre = [];
  const dejaLa = f.cleAttente ? e.visitesAJoindre.find(v=>v.cle===f.cleAttente) : null;
  if(dejaLa){
    dejaLa.saisie = saisie;
    /* Le champ fichier est recréé vide à chaque redessin : sans ce report,
       corriger une date ferait perdre l'attestation déjà choisie. */
    if(fichier){ dejaLa.fichier = fichier; dejaLa.fichierNom = fichier.name; }
    return;
  }
  e.visitesAJoindre.push({
    cle: uid(), saisie,
    fichier: fichier || null,
    fichierNom: fichier ? fichier.name : ''
  });
}
async function supprimerVisiteRhEcran(visiteId){
  const v = state.visitesRh.find(x=>x.id===visiteId);
  if(!v) return;
  if(!confirm('Retirer cette visite du registre ? L\'attestation sera supprimée.')) return;
  try{
    await window.supprimerVisiteMedicale(v);
  }catch(err){
    console.error('Visite non supprimée', err);
    showToast(refusDocumentRh(err));
    return;
  }
  /* Cas symétrique, et le plus trompeur : retirer la dernière visite rend les
     deux colonnes à `null`, et sans resynchronisation la fiche continuerait
     d'afficher une échéance qui n'existe plus. */
  await chargerVisitesRh(true);
  await recharger('salarie');
  resynchroniserDatesVisite(v.salarieId);
  rafraichirZoneVisites();
  showToast('Visite retirée du registre.', 'success');
}
async function ouvrirAttestationVisiteEcran(visiteId){
  const v = state.visitesRh.find(x=>x.id===visiteId);
  if(!v) return;
  try{
    const ouvert = await window.ouvrirAttestationVisite(v);
    if(!ouvert){ showToast("Cette visite n'a pas d'attestation jointe."); return; }
    openAttachmentPreview(ouvert.url, ouvert.nom, ouvert.mime, ouvert.urlTelechargement);
  }catch(err){
    console.error('Attestation illisible', v.fichierChemin, err);
    showToast("L'attestation n'a pas pu être ouverte.");
  }
}
export function renderRHVisites(){
  const salaries = state.salaries.filter(s=>s.societeId===state.societeId);
  if(!visitesRhPretes()){
    chargerVisitesRh();
    return '<div class="empty">Chargement du registre des visites…</div>';
  }
  const lignes = salaries.map(s=>({ s, visites: visitesDuSalarie(s.id), etat: etatVisiteDuSalarie(s.id) }));
  const compte = (etat) => lignes.filter(l=>l.etat.etat===etat).length;

  const filtre = state.rhVisiteFiltre||'';
  const liste = filtre ? lignes.filter(l=>l.etat.etat===filtre) : lignes;
  const ouvert = state.rhVisiteSalarieId ? lignes.find(l=>l.s.id===state.rhVisiteSalarieId) : null;

  return `
    <div class="page-head"><h1>Visites médicales</h1></div>
    <div class="card-sub" style="margin-bottom:14px;">Suivi en santé au travail : embauche, périodique, reprise. L'échéance de la dernière visite pilote l'alerte, et remplace les deux dates autrefois saisies sur la fiche.</div>
    <div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap;">
      <button class="btn small ${!filtre?'primary':''}" onclick="filtrerVisitesRh('')">Tous (${lignes.length})</button>
      <button class="btn small ${filtre==='depassee'?'primary':''}" onclick="filtrerVisitesRh('depassee')">Échéance dépassée (${compte('depassee')})</button>
      <button class="btn small ${filtre==='bientot'?'primary':''}" onclick="filtrerVisitesRh('bientot')">À prévoir (${compte('bientot')})</button>
      <button class="btn small ${filtre==='inconnue'?'primary':''}" onclick="filtrerVisitesRh('inconnue')">Jamais vus (${compte('inconnue')})</button>
      <button class="btn small ${filtre==='aJour'?'primary':''}" onclick="filtrerVisitesRh('aJour')">À jour (${compte('aJour')})</button>
    </div>
    ${salaries.length? `<div class="vehicule-liste-wrap">
      <table class="stats-table">
        <thead><tr>
          <th style="text-align:left;">Salarié</th><th></th><th>Dernière visite</th><th>Type</th>
          <th>Avis</th><th>Prochaine</th><th>Historique</th><th></th>
        </tr></thead>
        <tbody>
          ${liste.length? liste.map(({s, visites, etat})=>{
            const derniere = visites[0] || null;
            const avis = derniere ? window.avisAptitude(derniere.avis) : null;
            const couleur = avis ? (avis.gravite==='danger'?'#a30f22':avis.gravite==='warn'?'#a56200':'#15803d') : 'inherit';
            return `<tr>
              <td style="text-align:left;"><strong>${esc(s.prenom)} ${esc(s.nom)}</strong>${s.poste? ` <span class="card-sub">· ${esc(s.poste)}</span>`:''}</td>
              <td style="text-align:center;">${pastilleVisiteRh(s.id)}</td>
              <td>${derniere? fmtDate(derniere.dateVisite) : '—'}</td>
              <td>${derniere? esc(window.typeVisite(derniere.type).libelle) : '—'}</td>
              <td${avis? ` style="color:${couleur}; font-weight:700;"`:''}>${avis? esc(avis.libelle) : '—'}</td>
              <td>${etatVisiteBadge(s.id)}</td>
              <td>${visites.length || '—'}</td>
              <td><button class="btn small" onclick="ouvrirRegistreVisites('${jsAttr(s.id)}')">${state.rhVisiteSalarieId===s.id? 'Fermer':'Ouvrir'}</button></td>
            </tr>`;
          }).join('') : '<tr><td colspan="8" class="empty">Aucun salarié ne correspond à ce filtre.</td></tr>'}
        </tbody>
      </table>
    </div>` : '<div class="empty">Aucun salarié pour cette société.</div>'}
    ${ouvert? `<div class="card" style="margin-top:20px;">
      <div class="card-row">
        <div class="card-title">${esc(ouvert.s.prenom)} ${esc(ouvert.s.nom)} — suivi médical</div>
        <button class="btn small ghost" onclick="ouvrirRegistreVisites('${jsAttr(ouvert.s.id)}')">Fermer</button>
      </div>
      <div style="margin-top:10px;">${visitesMedicalesHTML(ouvert.s)}</div>
    </div>` : ''}
  `;
}
function filtrerVisitesRh(valeur){
  state.rhVisiteFiltre = valeur;
  renderTab();
}
function ouvrirRegistreVisites(salarieId){
  state.rhVisiteSalarieId = state.rhVisiteSalarieId===salarieId ? null : salarieId;
  if(state.rhVisiteForm && state.rhVisiteForm.salarieId!==state.rhVisiteSalarieId) state.rhVisiteForm = null;
  renderTab();
}


/* ─────────────────────────────────────────────────────────────────────────
   Ce que le HTML peut appeler dans ce module.

   Même règle que dans `app.js` : un module a sa propre portée, et un
   `onclick="…"` résout son nom sur `window`. Un nom oublié ici donne un
   bouton muet, sans erreur et sans test rouge.
   ───────────────────────────────────────────────────────────────────────── */
Object.assign(window, {
  badgeVisiteMedicaleListe,
  chargementVisitesRh,
  chargerVisitesRh,
  conformiteRhDuSalarie,
  echeanceVisite,
  enregistrerVisiteRh,
  etatVisiteBadge,
  etatVisiteDuSalarie,
  fermerFormVisiteRh,
  filtrerVisitesRh,
  formVisiteRhHTML,
  onFichierVisiteRhChange,
  onVisiteRhEcheanceChange,
  onVisiteRhEcheanceMain,
  onVisiteRhEcheanceSaisie,
  ouvrirAttestationVisiteEcran,
  ouvrirFormVisiteRh,
  ouvrirFormVisiteRhEnAttente,
  ouvrirRegistreVisites,
  pastilleVisiteRh,
  renderRHVisites,
  retirerVisiteEnAttente,
  seuilVisiteMedicale,
  supprimerVisiteRhEcran,
  visiteRhRowHTML,
  visitesDuSalarie,
  visitesMedicalesHTML,
  visitesRhPretes,
});
