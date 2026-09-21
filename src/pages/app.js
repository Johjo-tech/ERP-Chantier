/**
 * L'application, sortie de `index.html`.
 *
 * Elle y vivait dans un <script> classique, que Vite traite comme du texte : ni
 * minifié, ni relu par TypeScript, ni analysé par Semgrep, et retéléchargé en
 * entier à chaque mise en ligne puisqu'il voyageait dans le document HTML.
 *
 * Elle est désormais un module. Un module a sa PROPRE portée : les 1070 noms
 * de premier niveau ne deviennent plus des globales, or 795 attributs
 * `onclick=` les appellent par leur nom. Le bloc en fin de fichier les publie
 * donc explicitement, et une garde de construction vérifie que tout ce que le
 * HTML appelle s'y trouve — sans quoi la page se chargerait et cesserait
 * simplement de répondre, sans la moindre erreur.
 */

/* Alimenté au démarrage par les sociétés que la RLS rend visibles
   (voir src/integrations/session.ts). La liste ci-dessous n'est qu'un repli
   d'affichage si le pont n'a pas encore répondu. */
let SOCIETES = [
  {id:'kta', nom:'KTA Plomberie'},
  {id:'alkia', nom:'Alkia Menuiserie Serrurerie'},
  {id:'chm', nom:'CHM Entretien'},
  {id:'akt', nom:'AKT Elec'}
];
const ICONS = {
  /* Le catalogue n'en avait aucune : `ICONS.catalogue` valant `undefined`, le
     SVG sortait vide et le libellé glissait à la place du pictogramme. */
  catalogue:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h7"/>',
  dashboard:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  chantiers:'<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  rh:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M21 21v-2a5 5 0 0 0-3.5-4.77"/>',
  statistiques:'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
  vehicules:'<path d="M3 17h1a2 2 0 0 0 4 0h8a2 2 0 0 0 4 0h1v-5l-2-5H6L3 12v5z"/><circle cx="7.5" cy="17" r="1.7"/><circle cx="17.5" cy="17" r="1.7"/><path d="M3 12h15"/>',
  materiel:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  piecesCommande:'<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 12h6"/>',
  clients:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  devis:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  factures:'<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M9 12h6"/><path d="M9 16h4"/><circle cx="9" cy="8" r="1"/>',
  interventions:'<path d="M12 2s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
  reglements:'<circle cx="12" cy="12" r="9"/><path d="M9 12.5l2 2 4-4.5"/>',
  bonsCommande:'<path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  planning:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
  parametres:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1.2 1.5 1.4h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
const NAV = [
  {id:'dashboard', label:'Tableau de bord'},
  {id:'bonsCommande', label:'Bons de commande'},
  {id:'devis', label:'Devis'},
  {id:'factures', label:'Factures'},
  {id:'interventions', label:'Rapports'},
  {id:'planning', label:'Planning'},
  {id:'chantiers', label:'Chantiers'},
  {id:'clients', label:'Clients'},
  {id:'catalogue', label:'Catalogue'},
  {id:'rh', label:'RH'},
  {id:'vehicules', label:'Véhicules'},
  {id:'materiel', label:'Matériel'},
  {id:'piecesCommande', label:'Pièces en commande'},
  {id:'statistiques', label:'Statistiques'},
  {id:'parametres', label:'Réglages'}
];
/* Rôles de l'énumération `role_membre` de la base. Les onglets ne sont plus
   déclarés ici : c'est la matrice de droits (src/integrations/permissions.ts,
   miroir de la fonction SQL `a_permission`) qui décide. */
const ROLES = {
  admin: { label:'Administrateur' },
  secretaire: { label:'Secrétaire' },
  conducteur: { label:'Conducteur de travaux' },
  technicien: { label:'Technicien' },
  lecture: { label:'Lecture seule' },
  sous_traitant: { label:'Sous-traitant (entreprise)' },
};
function libelleRole(role){ return (ROLES[role]||{}).label || 'Sans rôle'; }
function navPourRole(){
  const autorises = window.ongletsAutorises
    ? window.ongletsAutorises(NAV.map(n=>n.id))
    : NAV.map(n=>n.id);
  return NAV.filter(n=>autorises.includes(n.id));
}
/* Simulation d'affichage, réservée aux administrateurs et sans effet sur la
   base : la RLS continue de s'appliquer avec le rôle réel. */
async function setRole(role){
  if(!window.simulerRole || !window.simulerRole(role==='admin' ? null : role)){
    showToast("Seul un administrateur peut simuler un autre rôle.");
    return;
  }
  state.currentRole = window.roleEffectif ? window.roleEffectif() : role;
  document.body.classList.toggle('role-technicien', state.currentRole==='technicien');
  toggleUserMenu();
  const autorises = navPourRole().map(n=>n.id);
  if(autorises.length && !autorises.includes(state.tab)) state.tab = autorises[0];
  renderShell();
  renderTab();
}
const MOBILE_NAV = [
  {id:'dashboard', label:'Tableau de bord'},
  {id:'devis', label:'Devis'},
  {id:'factures', label:'Factures'},
  {id:'interventions', label:'Rapports'},
  {id:'plus', label:'Plus'}
];
const METIERS = [
  {value:'plomberie', label:'Plomberie'},
  {value:'electricite', label:'Électricité'},
  {value:'etancheite', label:'Étanchéité'}
];
const CONTROLES_PAR_METIER = {
  plomberie: [
    {key:'alim_froide', label:'Alimentation eau froide'},
    {key:'alim_chaude', label:'Alimentation eau chaude'},
    {key:'evacuations', label:'Évacuations'},
    {key:'appareils', label:'Appareils sanitaires'},
    {key:'joints', label:'Joints (silicone, faïence)'},
    {key:'colonne', label:'Colonne / gaine technique'},
    {key:'pression', label:'Test de pression'},
    {key:'compteur', label:'Compteur d\u2019eau'},
    {key:'autre', label:'Autre contrôle'}
  ],
  electricite: [
    {key:'tableau', label:'Tableau électrique'},
    {key:'disjoncteurs', label:'Disjoncteurs / différentiels'},
    {key:'prises', label:'Prises et interrupteurs'},
    {key:'eclairage', label:'Éclairage'},
    {key:'mise_terre', label:'Mise à la terre'},
    {key:'continuite', label:'Continuité des circuits'},
    {key:'isolement', label:'Isolement électrique'},
    {key:'autre', label:'Autre contrôle'}
  ],
  etancheite: [
    {key:'revetement', label:'Revêtement d\u2019étanchéité'},
    {key:'releves', label:'Relevés d\u2019étanchéité'},
    {key:'evacuations_ep', label:'Évacuations eaux pluviales'},
    {key:'joints_dilatation', label:'Joints de dilatation'},
    {key:'infiltrations', label:'Traces d\u2019infiltration'},
    {key:'ventilation', label:'Ventilation / points singuliers'},
    {key:'autre', label:'Autre contrôle'}
  ]
};
function defaultControles(){ return {}; }
function nowHeureFR(){
  const d = new Date();
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function heureOptions(current){
  const sel = current || nowHeureFR();
  let opts = '';
  for(let h=0; h<24; h++){
    for(let m=0; m<60; m+=1){
      const v = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
      opts += `<option value="${v}" ${v===sel?'selected':''}>${v}</option>`;
    }
  }
  return opts;
}

let state = {
  societeId: 'kta', tab: 'dashboard', plusTab: 'clients', reglagesTab: 'organisation', currentRole: null, devisSearch: '', factureSearch: '', interventionSearch: '', bonCommandeSearch: '', reglementsClient: null, globalSearch: '', ghostMode: false, viewingDoc: null, searchCycle: null, emailModalCtx: null, dashRevenuePeriod: '6m', reglementSelection: [], planningWeekStart: null,
  devisConducteurFilter: '', devisStatutFilter: '', factureConducteurFilter: '',
  factureLogementFilter: '', factureClientFilter: '', factureInterlocuteurFilter: '',
  factureMetierFilter: '', factureReglementFilter: '',
  facturePeriode: 'tout', facturePeriodeDebut: '', facturePeriodeFin: '', interventionConducteurFilter: '', bonCommandeConducteurFilter: '', planningConducteurFilter: '', bonCommandeTechnicienFilter: '', planningTechnicienFilter: '', planningSousTraitantFilter: '', planningMetierFilter: '', bonCommandeTypeFilter: '',
  devis: [], factures: [], interventions: [], bonsCommande: [], clients: [], documents: [], reglements: [], interlocuteurs: [], conducteurs: [], techniciens: [], metiersPerso: [], sousTraitants: [], chantiers: [], salaries: [], vehicules: [], materiels: [], settings: {}, viewingChantier: null, viewingVehicule: null, viewingMateriel: null, chantierTypeFilter: '', chantierAchatsFiltre: '',
  formOpen: {devis:false, facture:false, intervention:false, client:false, article:false, document:false, reglement:false, interlocuteur:false, reglementBulk:false, bonCommande:false, conducteur:false, technicien:false, metierPerso:false, sousTraitant:false, chantier:false, salarie:false, vehicule:false, materiel:false},
  editing: {type:null, id:null, lignes:[]},
  /* Le dossier documentaire des salariés. À part du reste : il ne transite pas
     par le pont kv_store — `salarie` y est déclaré sans table fille, donc un
     tableau posé sur la fiche est écarté à l'écriture. Il se charge et
     s'enregistre par `src/integrations/documents-rh.ts`. */
  documentsRh: [], documentsRhCharges: false, documentsRhSociete: null, rhDocFiltre: '', rhDocSalarieId: null, rhDocForm: null,
  /* Le registre des visites médicales, et les invitations en attente : même
     raison d'être à part du pont, même indexation par société. */
  visitesRh: [], visitesRhCharges: false, visitesRhSociete: null, rhVisiteFiltre: '', rhVisiteSalarieId: null, rhVisiteForm: null,
  invitations: [], invitationsCharges: false, invitationsSociete: null,
  /* Une entrée par listing, au lieu d'une propriété d'état par écran : c'est
     ce qui permet à `barreRecherche` et `filtrerListe` de rester génériques. */
  recherches: {}
};

/* ---------- Stockage (Supabase) ---------- */
/* L'ADRESSE VIENT DE LA CONSTRUCTION, plus d'une constante écrite ici.

   Ces deux valeurs servent au repli hérité vers `kv_store`, celui qui opère
   quand le pont n'a pas pu se charger. Écrites en dur, elles visaient la
   PRODUCTION — depuis n'importe quel build. Un essai local dont le pont
   échouait écrivait donc dans la base du client, et dans `kv_store`, la seule
   table encore ouverte en écriture à un visiteur anonyme.

   L'écran est un module depuis qu'il a quitté le HTML : Vite y remplace
   `import.meta.env`, exactement comme dans la couche TypeScript. Un build local
   parle au local, un build de production à la production. */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY;
const memoryStore = new Map();
let hasRealStorage = true;
function supabaseHeaders(extra){
  return Object.assign({
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  }, extra||{});
}
async function stGet(key){
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: supabaseHeaders() });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    hasRealStorage = true;
    if(!rows.length) return null;
    return rows[0].value;
  }catch(e){
    console.error('stGet error', e);
    hasRealStorage = false;
    return memoryStore.has(key) ? JSON.parse(memoryStore.get(key)) : null;
  }
}
async function stSet(key, val){
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?on_conflict=key`, {
      method: 'POST',
      headers: supabaseHeaders({'Prefer': 'resolution=merge-duplicates,return=representation'}),
      body: JSON.stringify({ key, value: val, updated_at: new Date().toISOString() })
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    hasRealStorage = true;
    memoryStore.set(key, JSON.stringify(val));
    return (data && data.length) ? data[0] : { key, value: val };
  }catch(e){
    console.error('stSet error', e);
    hasRealStorage = false;
    memoryStore.set(key, JSON.stringify(val));
    return null;
  }
}
function showToast(msg, type, duration){
  let el = document.getElementById('toastBox');
  if(!el){ el = document.createElement('div'); el.id = 'toastBox'; document.body.appendChild(el); }
  clearTimeout(el._hideTimer);
  clearTimeout(el._removeTimer);
  el.classList.remove('show');
  el.className = 'toast ' + (type||'error');
  el.textContent = msg;
  el.style.display = 'block';
  requestAnimationFrame(()=>{ requestAnimationFrame(()=> el.classList.add('show')); });
  el._hideTimer = setTimeout(()=>{
    el.classList.remove('show');
    el._removeTimer = setTimeout(()=>{ el.style.display = 'none'; }, 250);
  }, duration || 6000);
}
/**
 * Pourquoi l'enregistrement a échoué — le motif de la base, pas une supposition.
 *
 * Ce message annonçait une panne de connexion Supabase et renvoyait vers
 * « l'aperçu Claude.ai ». Il était faux la plupart du temps : sur une base
 * vivante, un échec d'écriture vient presque toujours d'un REFUS — une facture
 * émise qu'on rouvre, un droit manquant, un champ obligatoire vide. Le
 * déclencheur écrit alors une phrase qui dit quoi faire, et elle partait dans la
 * console pendant que l'utilisateur lisait qu'il avait un problème de réseau.
 *
 * Il mentionnait de surcroît un aperçu qui ne veut rien dire pour le client.
 */
/**
 * Le cadre de facturation d'un document — la fiche d'abord, le document ensuite.
 *
 * Même ordre que `versDestinataire` côté serveur, et pour la même raison :
 * `factures.cadre_facturation` est NOT NULL avec un défaut, donc elle vaut
 * « entreprise française » sur toute facture antérieure au jour où on s'est mis
 * à l'écrire. La fiche client est la seule source qui dise la vérité.
 */
function cadreDuDocument(doc){
  if(!doc) return null;
  const fiche = state.clients.find(c=>c.societeId===doc.societeId && c.nom===doc.client);
  return (fiche && fiche.cadreFacturation) || doc.cadreFacturation || null;
}

/** Ce document emprunte-t-il une plateforme, ou relève-t-il de l'e-reporting ? */
function passeParUnePlateforme(doc){
  return !window.relveDeLaFactureElectronique
    || window.relveDeLaFactureElectronique(cadreDuDocument(doc));
}

function saveFailedMessage(){
  const motif = window.dernierRefus && window.dernierRefus();
  if(motif) return "Enregistrement refusé : " + motif;
  return "L'enregistrement a échoué. Vérifiez votre connexion, puis réessayez — rien n'a été modifié.";
}
async function stDelete(key){
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: supabaseHeaders()
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    hasRealStorage = true;
    memoryStore.delete(key);
    return { key, deleted: true };
  }catch(e){
    console.error('stDelete error', e);
    memoryStore.delete(key);
    return null;
  }
}
async function stListKeys(prefix){
  try{
    const url = prefix
      ? `${SUPABASE_URL}/rest/v1/kv_store?key=like.${encodeURIComponent(prefix)}*&select=key`
      : `${SUPABASE_URL}/rest/v1/kv_store?select=key`;
    const res = await fetch(url, { headers: supabaseHeaders() });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    hasRealStorage = true;
    return rows.map(r => r.key);
  }catch(e){
    console.error('stListKeys error', e);
    hasRealStorage = false;
    return [...memoryStore.keys()].filter(k => !prefix || k.startsWith(prefix));
  }
}
async function loadPrefix(prefix){ const keys = await window.stListKeys(prefix); const vals = await Promise.all(keys.map(k => window.stGet(k))); return vals.filter(Boolean); }

async function nextNumero(societeId, type){
  const key = 'counters:' + societeId;
  let c = await window.stGet(key);
  if(!c) c = {devis:0, facture:0, intervention:0, bonCommande:0, sav:0};
  c[type] = (c[type]||0) + 1;
  await window.stSet(key, c);
  const year = new Date().getFullYear();
  const codes = {devis:'DEV', facture:'FAC', intervention:'RAP', bonCommande:'BC'};
  /* Six chiffres, comme `numero_suivant_interne` en base. Ce repli n'attribue
     plus rien depuis la fermeture de `kv_store`, mais un numéro d'une autre
     largeur serait un faux indice le jour où quelqu'un en retrouverait un. */
  return `${codes[type]}-${year}-${String(c[type]).padStart(6,'0')}`;
}
async function nextSAVNumero(societeId){
  const key = 'counters:' + societeId;
  let c = await window.stGet(key);
  if(!c) c = {devis:0, facture:0, intervention:0, bonCommande:0, sav:0};
  c.sav = (c.sav||0) + 1;
  await window.stSet(key, c);
  return 'SAV-' + c.sav;
}
/**
 * La sauvegarde des données, telle que le bouton la demande.
 *
 * `exportAllData` existe en DEUX exemplaires : celui d'ici, qui sérialise la
 * mémoire de l'écran, et celui de l'adaptateur, qui relit la base et prend un
 * code de société. L'adaptateur substitue le sien sur `window` — c'est donc lui
 * qui répond, et le bouton l'appelait sans argument : `resolveSocieteId(undefined)`
 * levait « Société « undefined » introuvable », et la sauvegarde ne partait pas.
 *
 * On passe donc le code, et par une fonction nommée plutôt que depuis
 * l'attribut : l'appel a un endroit où être lu, et l'échec un endroit où être dit.
 */
async function exporterMesDonnees(){
  try{
    await window.exportAllData(state.societeId);
  }catch(err){
    console.error('Export impossible', err);
    showToast("La sauvegarde n'a pas pu être créée : " + ((err && err.message) || 'erreur inconnue'), 'danger', 6000);
  }
}

async function exportAllData(){
  const data = {
    version: 1, exportedAt: new Date().toISOString(),
    clients: state.clients, devis: state.devis, factures: state.factures,
    interventions: state.interventions, reglements: state.reglements, bonsCommande: state.bonsCommande, conducteurs: state.conducteurs, techniciens: state.techniciens,
    /* Le catalogue ne vit plus en mémoire : on le demande ici, sinon la
       sauvegarde repartirait sans lui, sans le dire. */
    articles: await window.catalogueComplet(),
    documents: state.documents, interlocuteurs: state.interlocuteurs,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terrain-sauvegarde-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
  showToast('Sauvegarde téléchargée — gardez ce fichier pour le réimporter plus tard.', 'success');
}
async function importAllData(file){
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const collections = {
      clients:'client', devis:'devis', factures:'facture', interventions:'intervention',
      reglements:'reglement', bonsCommande:'bonCommande', conducteurs:'conducteur', techniciens:'technicien', articles:'article', documents:'document', interlocuteurs:'interlocuteur'
    };
    let count = 0;
    for(const key in collections){
      const prefix = collections[key];
      const arr = data[key] || [];
      for(const item of arr){
        if(!item || !item.id) continue;
        const r = await window.stSet(prefix+':'+item.id, item);
        if(r) count++;
      }
    }
    if(data.settings){
      for(const socId in data.settings){
        await window.stSet('settings:'+socId, data.settings[socId]);
      }
    }
    await loadAll();
    renderShell();
    renderTab();
    showToast(`${count} enregistrement(s) restauré(s) avec succès.`, 'success', 4000);
  }catch(err){
    console.error('Import error', err);
    showToast("Ce fichier de sauvegarde est invalide ou corrompu.");
  }
}
/* ---------- Ce que porte chaque collection ----------
   Une seule table, utilisée par `loadAll` ET par `recharger` : écrire le tri à
   deux endroits, c'est se garantir que la liste rechargée après un
   enregistrement finira par s'ordonner autrement que celle du démarrage.

   Le plus récent d'abord. On prend la première date renseignée parmi celles qui
   font sens pour le document — un bon de commande n'a pas de `date`, il a une
   date de réception — et `createdAt` départage les ex æquo. */
const parNom = (a,b)=> (a.nom||'').localeCompare(b.nom||'');
const COLLECTIONS_ETAT = {
  'devis':        { champ:'devis',         ranger: v => trierParDate(v, ['date']) },
  'facture':      { champ:'factures',      ranger: v => trierParDate(v, ['date']) },
  'intervention': { champ:'interventions', ranger: v => trierParDate(v, ['date']) },
  'bonCommande':  { champ:'bonsCommande',  ranger: v => trierParDate(v, ['dateReception','datePlanifiee','date']) },
  'client':       { champ:'clients',       ranger: v => v.sort(parNom) },
  'document':     { champ:'documents',     ranger: v => v.sort((a,b)=> (a.dateValidite||'9999').localeCompare(b.dateValidite||'9999')) },
  'reglement':    { champ:'reglements',    ranger: v => trierParDate(v, ['date']) },
  'interlocuteur':{ champ:'interlocuteurs',ranger: v => v.sort(parNom) },
  'conducteur':   { champ:'conducteurs',   ranger: v => v.sort(parNom) },
  'technicien':   { champ:'techniciens',   ranger: v => v },
  'metierPerso':  { champ:'metiersPerso',  ranger: v => v },
  'sousTraitant': { champ:'sousTraitants', ranger: v => v },
  'chantier':     { champ:'chantiers',     ranger: v => trierParDate(v, ['dateDebut']) },
  'salarie':      { champ:'salaries',      ranger: v => v.sort(parNom) },
  'vehicule':     { champ:'vehicules',     ranger: v => v.sort(parNom) },
  'materiel':     { champ:'materiels',     ranger: v => v.sort(parNom) },
};

/**
 * Recharge les collections nommées, et elles seules.
 *
 * Un enregistrement ne touche qu'une ou deux tables ; le rechargement complet
 * qui le suivait en retéléchargeait seize — 67 requêtes, 3,7 Mo et 5,1 s en
 * production, après CHAQUE écriture. On nomme donc ce qu'on a touché.
 *
 * Volontairement sans les réglages ni la couleur : ce sont deux requêtes par
 * société, pour des données qu'un enregistrement de facture ne change pas.
 * `refreshNotifBadge` reste, il ne lit que la mémoire.
 *
 *   await recharger('facture');                 // une facture enregistrée
 *   await recharger('reglement', 'facture');    // un règlement change aussi le statut
 */
async function recharger(...prefixes){
  const connus = prefixes.filter(p => COLLECTIONS_ETAT[p]);
  const valeurs = await Promise.all(connus.map(p => loadPrefix(p + ':')));
  connus.forEach((p, i) => {
    const def = COLLECTIONS_ETAT[p];
    state[def.champ] = def.ranger(valeurs[i]);
  });
  refreshNotifBadge();
}

async function loadAll(){
  /* Avant toute requête : le pont ne ramènera que cette société. Sans cela il
     téléchargeait aussi les documents des sociétés qu'on n'affiche pas. */
  if(window.definirSocieteActive) window.definirSocieteActive(state.societeId);
  /* `article:` ne figure pas dans la table : le catalogue peut compter un
     millier de références, et l'ouverture télécharge déjà seize tables
     entières. Il se consulte par requête, depuis l'onglet Catalogue et depuis
     la saisie d'une ligne. Le registre des collections du pont le connaît
     toujours — la restauration d'une sauvegarde en a besoin. */
  await recharger(...Object.keys(COLLECTIONS_ETAT));
  state.settings = {};
  await Promise.all(SOCIETES.map(async s => { const v = await window.stGet('settings:' + s.id); if(v) state.settings[s.id] = v; }));
  /* La couleur se pose ici parce que c'est la ligne au-dessus qui l'apporte :
     tout chemin qui recharge les réglages la repose, démarrage compris. La
     rattacher à `init()` ne suffisait pas — cette fonction ne va pas toujours
     jusqu'au bout. Le changement de société, lui, ne passe pas par ici et
     garde son propre appel. */
  appliquerCouleurSociete();
  refreshNotifBadge();
}

/* ---------- Helpers ---------- */
function money(n){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0); }
function moneyDisplay(n){ return state.ghostMode ? '••• €' : money(n); }
function computeNotifications(){
  const soc = state.societeId;
  const notifs = [];
  /* Véhicules et RH : le calcul vit dans src/integrations/alertes.ts, calé sur
     les colonnes réelles. L'ancien code lisait `v.prochainCT` et
     `s.habilitations[]`, qui n'existent pas en base — ces alertes ne se
     déclenchaient jamais. */
  const versNotif = (a, icon, onglet) => ({
    id: a.id, icon, urgent: a.niveau === 'danger',
    texte: `${a.libelle} — ${a.jours < 0 ? 'expiré' : `dans ${a.jours} j`}${a.echeance ? ` (${fmtDate(a.echeance)})` : ''}`,
    onclick: `setTab('${onglet}')`
  });

  state.vehicules.filter(v=>v.societeId===soc).forEach(v=>{
    window.alertesVehicule(v).forEach(a=> notifs.push(versNotif(a, '🚐', 'vehicules')));
  });

  state.salaries.filter(s=>s.societeId===soc).forEach(s=>{
    window.alertesSalarie(s, s.habilitations||[]).forEach(a=> notifs.push(versNotif(a, '👷', 'rh')));
  });

  state.documents.filter(d=>d.societeId===soc).forEach(d=>{
    window.alertesDocument(d).forEach(a=> notifs.push(versNotif(a, '📑', 'parametres')));
  });

  /* Le dossier documentaire des salariés : carte BTP, titre de séjour, visite
     médicale… Le seuil est celui des documents légaux, réglable dans
     Paramètres › RH. Rien tant que les dossiers ne sont pas chargés — l'onglet
     RH les demande à son ouverture. */
  if(dossiersRhPrets() && soc===state.societeId){
    const today = todayISO(), seuil = seuilDocumentRh();
    const nomDe = id => { const s = state.salaries.find(x=>x.id===id); return s? [s.prenom,s.nom].filter(Boolean).join(' ') : 'Salarié'; };
    state.documentsRh.forEach(d=>{
      const info = window.etatDocumentRh(d, today, seuil);
      if(info.etat!=='expire' && info.etat!=='bientot') return;
      notifs.push({
        id:`docrh_${d.id}`, icon:'📁', urgent: info.etat==='expire',
        texte: `${nomDe(d.salarieId)} — ${window.libelleDocumentRh(d)} ${info.jours<0? 'expiré' : `dans ${info.jours} j`} (${fmtDate(d.dateExpiration)})`,
        onclick: `setTab('rh')`
      });
    });
  }
  // Bons de commande en retard
  const today = todayISO();
  state.bonsCommande.filter(b=>b.societeId===soc && b.dateFinTravaux && b.dateFinTravaux<today).forEach(b=>{
    notifs.push({ id:`bc_retard_${b.id}`, icon:'📦', urgent:true, texte: `${b.numeroBC||b.client||'BC'} — en retard (échéance ${fmtDate(b.dateFinTravaux)})`, onclick:`setTab('bonsCommande')` });
  });
  // Documents sous-traitants
  state.sousTraitants.filter(st=>st.societeId===soc).forEach(st=>{
    (st.documents||[]).forEach(d=>{
      const j = joursAvant(d.dateExpiration);
      if(j!=null && j<=30){
        notifs.push({ id:`stdoc_${st.id}_${d.id}`, icon:'📑', urgent: j<0, texte: `${st.nom} — ${d.type} ${j<0?'expiré':`dans ${j} j`}`, onclick:`setTab('parametres')` });
      }
    });
  });
  // Rappels de locataires (congés, indisponibilité...)
  state.bonsCommande.filter(b=>b.societeId===soc && b.rappelDate).forEach(b=>{
    const j = joursAvant(b.rappelDate);
    if(j!=null && j<=0){
      notifs.push({ id:`rappel_${b.id}`, icon:'🔄', urgent: true, texte: `Rappeler ${b.client} — ${j<0? 'prévu le '+fmtDate(b.rappelDate) : "aujourd'hui"}`, onclick:`setTab('bonsCommande')` });
    }
  });
  const traitees = (state.settings[soc]||{}).notifsTraitees || [];
  const notifsActives = notifs.filter(n=>!traitees.includes(n.id));
  notifsActives.sort((a,b)=> (b.urgent?1:0)-(a.urgent?1:0));
  return notifsActives;
}
function refreshNotifBadge(){
  const notifs = computeNotifications();
  const n = notifs.length;
  ['notifBadgeDesktop','notifBadgeMobile'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    if(n>0){ el.textContent = n>99?'99+':n; el.style.display='flex'; el.classList.toggle('is-urgent', notifs.some(x=>x.urgent)); }
    else { el.style.display='none'; }
  });
}
function renderNotifPanelContent(){
  const notifs = computeNotifications();
  if(!notifs.length) return `<div class="notif-empty">🎉 Aucune alerte en cours</div>`;
  if(state.notifPanelExpanded){
    return `
      <div class="notif-panel-header">
        <span>${notifs.length} alerte${notifs.length>1?'s':''}</span>
        <button class="btn small ghost" onclick="event.stopPropagation(); state.notifPanelExpanded=false; refreshNotifPanelDOM();">← Retour</button>
      </div>
      <div class="notif-list-check">
        ${notifs.map(n=>`
          <label class="notif-item-check ${n.urgent?'is-urgent':''}" onclick="event.stopPropagation();">
            <input type="checkbox" class="notif-checkbox" data-id="${n.id}">
            <span class="notif-item-icon">${n.icon}</span>
            <span class="notif-item-texte">${esc(n.texte)}</span>
          </label>`).join('')}
      </div>
      <div class="notif-panel-footer">
        <button class="btn small primary" onclick="event.stopPropagation(); marquerNotifsCocheesFaites();">✓ Marquer comme fait</button>
      </div>
    `;
  }
  const premiers = notifs.slice(0,5);
  return `
    ${premiers.map(n=>`<div class="notif-item ${n.urgent?'is-urgent':''}" onclick="${n.onclick}; closeNotifPanel();">
      <span class="notif-item-icon">${n.icon}</span>
      <span class="notif-item-texte">${esc(n.texte)}</span>
    </div>`).join('')}
    <button class="notif-see-all" onclick="event.stopPropagation(); state.notifPanelExpanded=true; refreshNotifPanelDOM();">
      <span class="notif-see-all-plus">+</span> Liste des notifications à faire (${notifs.length})
    </button>
  `;
}
function refreshNotifPanelDOM(){
  document.querySelectorAll('.notif-panel').forEach(p=>{ p.innerHTML = renderNotifPanelContent(); });
}
async function marquerNotifsCocheesFaites(){
  const ids = [...document.querySelectorAll('.notif-checkbox:checked')].map(cb=>cb.dataset.id);
  if(!ids.length){ showToast('Cochez au moins une alerte.'); return; }
  const soc = state.societeId;
  if(!state.settings[soc]) state.settings[soc] = {};
  const traitees = new Set(state.settings[soc].notifsTraitees || []);
  ids.forEach(id=>traitees.add(id));
  state.settings[soc].notifsTraitees = [...traitees];
  await window.stSet('settings:'+soc, state.settings[soc]);
  refreshNotifBadge();
  refreshNotifPanelDOM();
  showToast(`${ids.length} alerte(s) marquée(s) comme faite(s).`, 'success');
}
function toggleNotifPanel(ev){
  ev.stopPropagation();
  const panels = document.querySelectorAll('.notif-panel');
  const willOpen = !panels[0] || getComputedStyle(panels[0]).display === 'none';
  if(willOpen) state.notifPanelExpanded = false;
  panels.forEach(p=>{ p.style.display = willOpen? 'block':'none'; if(willOpen) p.innerHTML = renderNotifPanelContent(); });
}
function closeNotifPanel(){
  document.querySelectorAll('.notif-panel').forEach(p=> p.style.display='none');
}
document.addEventListener('mousedown', (ev)=>{
  if(ev.target.closest('.notif-wrap')) return;
  if(ev.target.closest('#navDesktop') || ev.target.closest('#bottomnav')) return;
  closeNotifPanel();
});
function toggleGhostMode(checked){
  state.ghostMode = checked;
  document.querySelectorAll('.ghost-toggle input').forEach(el=> el.checked = checked);
  renderTab();
  showToast(checked ? 'Mode discret activé' : 'Mode discret désactivé', 'success', 2000);
}
/* Date civile locale : toISOString() bascule en UTC et renvoie la veille
   avant 01h/02h à Paris. */
function todayISO(){ return dateLocaleISO(new Date()); }

/* Tri antéchronologique : première date renseignée parmi `champs`, puis
   `createdAt` pour départager. Les documents sans date passent en dernier
   plutôt que de remonter en tête. */
function trierParDate(liste, champs){
  const cle = d => {
    for(const c of champs){ if(d[c]) return String(d[c]); }
    return '';
  };
  return [...liste].sort((a,b)=>{
    const diff = cle(b).localeCompare(cle(a));
    if(diff !== 0) return diff;
    return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
  });
}
function dateLocaleISO(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtDate(d){ if(!d) return '—'; const p = d.split('-'); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function societeName(id){ const s = SOCIETES.find(x=>x.id===id); return s? s.nom : id; }
/* L'arithmétique des documents vit dans `regles-totaux.ts`, où elle est testée.
   Ce qui reste ici n'est qu'un raccourci de nom : ce fichier n'a aucun test, et
   ce qui décide de ce qui est facturé n'a rien à y faire. L'objet rendu porte
   en plus `ventilation`, le détail de TVA par taux. */
function computeTotalsAvecRemise(lignes, remisePct){
  return window.totauxDocument(lignes, remisePct);
}
function computeTotals(lignes){
  const t = window.totauxDocument(lignes, 0);
  return {ht: t.ht, tva: t.tva, ttc: t.ttc};
}
function computeDocTotals(doc){
  /* Un avoir porte des montants POSITIFS, comme la facture qu'il rectifie :
     c'est son type qui dit le sens, et l'export de la facture électronique
     s'appuie déjà là-dessus pour signer. Le signe s'applique donc ici, à
     l'unique endroit par où passent tous les montants affichés — listes,
     tableau de bord, chiffre d'affaires, reste à payer. Le poser plus haut
     obligerait à le poser vingt-quatre fois, et à n'en oublier aucune : un
     avoir compté positif gonflerait les impayés de son propre montant. */
  return window.totauxSignes(
    computeTotalsAvecRemise(doc.lignes, doc.remisePourcentage||0),
    doc.typeDocument
  );
}
function esc(s){ return (s===undefined||s===null?'':s).toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function jsAttr(s){
  return (s===undefined||s===null?'':s).toString()
    /* `&` EN PREMIER, et c'est tout le correctif. Le navigateur décode les
       entités d'un attribut AVANT d'en lire le JavaScript : une valeur portant
       `&#39;` arrivait ici intacte, ressortait intacte, et se rouvrait en
       apostrophe au décodage — refermant la chaîne et livrant le reste à
       l'exécution. Prouvé dans Chromium : `Dupont&#39;,alert(1),&#39;` appelait
       bien `alert`. Encodé d'abord, `&#39;` devient `&amp;#39;`, que le
       décodage rend comme le texte `&#39;` : inerte.

       Il doit rester en tête : placé après, il transformerait les `&` que les
       règles suivantes viennent d'écrire (`&quot;`, `&lt;`, `&gt;`) en
       `&amp;quot;`, qui s'afficheraient littéralement.

       Les 34 appels de cette fonction sont en contexte d'attribut — vérifié —
       où le décodage a lieu ; ailleurs, `&amp;` se verrait. */
    .replace(/&/g, '&amp;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function badgeClass(statut){
  const map = {'brouillon':'gray','envoyé':'info','envoyée':'info','accepté':'success','payée':'success','terminée':'success','reçu':'success','refusé':'danger','impayée':'danger','annulé':'danger','en cours':'yellow'};
  return map[statut] || 'gray';
}
function arrKeyFor(type){ return {devis:'devis',facture:'factures',intervention:'interventions',bonCommande:'bonsCommande',client:'clients',article:'articles',document:'documents',reglement:'reglements',interlocuteur:'interlocuteurs',conducteur:'conducteurs',technicien:'techniciens',metierPerso:'metiersPerso',sousTraitant:'sousTraitants',chantier:'chantiers',salarie:'salaries',vehicule:'vehicules',materiel:'materiels'}[type]; }

/* ---------- Rendu de la coquille ---------- */
/* Menu utilisateur : sociétés réellement accessibles, et simulation de rôle
   réservée à l'administrateur (sans effet sur la base, la RLS fait foi). */
/* Les sociétés où ce compte est membre, telles que la base les donne.
   Une seule fonction les rend, pour le seul endroit qui les propose : le nom
   de société, en haut. Elles vivaient aussi dans le menu sous le nom de
   l'utilisateur — deux chemins vers le même geste, qui auraient fini par ne
   plus dire la même chose. */
function optionsSocietesHTML(){
  const societes = window.societesAccessibles ? window.societesAccessibles() : [];
  if(!societes.length){
    return `<div style="padding:8px 12px; color:var(--danger); font-size:11.5px;">Aucune société rattachée à ce compte.</div>`;
  }
  /* Le sélecteur s'affiche même avec une seule société : sinon on ne distingue
     pas « je n'ai accès qu'à une société » de « le sélecteur est cassé ». */
  return `<div class="user-menu-section-title">Société</div>`
    + societes.map(soc =>
        `<button onclick="changerSociete('${jsAttr(soc.id)}')">${soc.id===state.societeId?'✓ ':''}${esc(soc.nom)}<small style="display:block; color:var(--text-dim); font-size:10.5px;">${esc(soc.id)} · ${esc(libelleRole(soc.role))}</small></button>`
      ).join('')
    + (societes.length === 1
        ? `<div style="padding:6px 12px; color:var(--text-dim); font-size:11px; line-height:1.4;">Une seule société vous est rattachée. Pour en obtenir d'autres, un administrateur doit vous ajouter dans <b>membres_societe</b>.</div>`
        : '');
}

/** Le nom de la société active, pour le bouton qui l'affiche. */
function nomSocieteActive(){
  const societes = window.societesAccessibles ? window.societesAccessibles() : [];
  const active = societes.find(s => s.id === state.societeId);
  return active ? active.nom : (societeName(state.societeId) || '—');
}

function versionConstruite(){
  const m = document.querySelector('meta[name="version-construite"]');
  return m ? m.content : 'inconnue';
}

/* Copiable d'un clic : une version qu'on doit recopier à la main arrive
   toujours tronquée. */
function copierVersion(){
  const v = versionConstruite();
  if(navigator.clipboard) navigator.clipboard.writeText(v);
  showToast('Version copiée : ' + v, 'success', 4000);
}

function renderUserMenu(){
  const estAdmin = window.roleReel && window.roleReel() === 'admin';
  const htmlRoles = estAdmin
    ? `<div class="user-menu-section-title">Voir en tant que</div>` +
      [['admin','👑 Administrateur'],['secretaire','📋 Secrétaire'],['conducteur','🦺 Conducteur de travaux'],
       ['technicien','🔧 Technicien'],['sous_traitant','🏗️ Sous-traitant'],['lecture','👀 Lecture seule']]
      .map(([id,label]) => `<button onclick="setRole('${jsAttr(id)}')">${state.currentRole===id?'✓ ':''}${label}</button>`).join('')
    : '';

  ['userMenuRoles','userMenuRolesMobile'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = htmlRoles;
  });

  /* La version construite, posée dans la page par Vite. Sans elle, impossible
     de distinguer « le correctif n'est pas livré » de « le navigateur garde
     une vieille copie » — les deux se ressemblent exactement. */
  document.querySelectorAll('.user-menu-version').forEach(el=>{
    el.textContent = 'version ' + versionConstruite();
  });

  /* Les deux barres — large et étroite — portent le même sélecteur : ne
     traiter que celle qu'on a sous les yeux laisserait l'autre inerte. */
  const societes = optionsSocietesHTML();
  const nom = nomSocieteActive();
  ['societeMenuDesktop','societeMenuMobile'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = societes;
  });
  /* Le libellé portait « KTA Plomberie » écrit en dur dans la page : il
     mentait dès qu'on changeait de société. */
  ['companyLabelDesktop','companyLabelMobile'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = nom;
  });

  const nomCompte = nomAffichable();
  if(nomCompte){
    document.querySelectorAll('.user-menu-name').forEach(el=>{
      const badge = el.querySelector('.role-badge');
      el.textContent = nomCompte;
      /* Le rôle reste sous le nom : c'est ce qui distingue un administrateur
         d'un technicien d'un coup d'œil. */
      if(badge) el.appendChild(badge);
      el.title = window.utilisateurCourant ? window.utilisateurCourant() : '';
    });
  }
}

/* Le nom du compte connecté, tel qu'on le montre.

   `profiles.nom` retombe sur l'adresse quand personne ne l'a renseigné, et la
   barre latérale affichait « laurent.johan1@… » à longueur de journée. Tant
   que la personne n'a pas donné son nom, on présente au moins quelque chose de
   lisible — sans jamais inventer : « laurent.johan1 » devient « Laurent
   Johan1 », et l'adresse complète reste en infobulle. */
function nomAffichable(){
  const brut = (window.nomIntervenant && window.monCompteId
    ? window.nomIntervenant(window.monCompteId()) : '') || '';
  const source = (brut && brut !== 'un utilisateur') ? brut
    : ((window.utilisateurCourant && window.utilisateurCourant()) || '');
  if(!source) return '';
  const sansDomaine = source.includes('@') ? source.split('@')[0] : source;
  return sansDomaine
    .split(/[._-]+/).filter(Boolean)
    .map(m => m.charAt(0).toUpperCase() + m.slice(1))
    .join(' ');
}

function renderShell(){
  const roleLabel = libelleRole(state.currentRole);
  ['roleBadgeDesktop','roleBadgeMobile'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = roleLabel;
  });
  renderUserMenu();
  document.getElementById('navDesktop').innerHTML = navPourRole().map(n=>`
    <button class="nav-item ${n.id===state.tab?'active':''}" onclick="setTab('${jsAttr(n.id)}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n.id]}</svg>
      <span>${n.label}</span>
    </button>`).join('');
  document.getElementById('bottomnav').innerHTML = MOBILE_NAV.map(n=>{
    const isActive = n.id==='plus' ? (state.tab==='plus'||state.tab==='parametres') : n.id===state.tab;
    return `
    <button class="nav-item ${isActive?'active':''}" onclick="setTab('${jsAttr(n.id)}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n.id]}</svg>
      <span>${n.label.split(' ')[0]}</span>
    </button>`;
  }).join('');
}
/* ---------- Historique du navigateur ----------
   Sans entrée d'historique, « Précédent » sort de l'application. On en pose
   une à chaque changement d'onglet et à chaque ouverture de formulaire : le
   bouton Précédent ramène alors au listing plutôt qu'à la page de connexion. */

function etatNavigation(){
  const form = Object.keys(state.formOpen).find(k => state.formOpen[k]) || null;
  return { tab: state.tab, form };
}

function pousserHistorique(remplacer){
  const e = etatNavigation();
  const url = '#' + e.tab + (e.form ? '/' + e.form : '');
  history[remplacer ? 'replaceState' : 'pushState'](e, '', url);
}

/* Restaure un état sans le repousser : on répond ici à un Précédent. */
function appliquerEtatNavigation(e){
  state.tab = e.tab || 'dashboard';
  Object.keys(state.formOpen).forEach(k => state.formOpen[k] = false);
  if(e.form){
    state.formOpen[e.form] = true;
  } else {
    state.editing = { type:null, id:null, lignes:[] };
  }
  renderShell();
  renderTab();
}

window.addEventListener('popstate', ev => {
  // Une entrée sans état vient d'ailleurs que de l'app : on la laisse passer
  if(ev.state) appliquerEtatNavigation(ev.state);
});

function setTab(id){
  if(state.tab === id && !etatNavigation().form){ return; }
  state.tab = id;
  Object.keys(state.formOpen).forEach(k => state.formOpen[k] = false);
  pousserHistorique();
  renderShell();
  renderTab();
}
async function openAttachmentPreviewFor(kind, id){
  const resolved = resolvePlanningItem(kind, id);
  if(resolved) await ouvrirBonDuClient(resolved.bc.id);
}

/* Depuis une facture : le document du client s'il existe, la fiche du bon
   sinon. Le repli est le comportement d'avant, à l'identique. */
async function ouvrirBonCommandeOrigine(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(b && (b.pieceJointeChemin || b.pieceJointeData)) return ouvrirBonDuClient(bcId);
  goToBonCommande(bcId);
}

/* Le point d'entrée unique pour consulter le bon reçu du client, quel que soit
   l'écran. Le repli sur la data-URL couvre les pièces déposées avant que le
   document ne parte au stockage. */
async function ouvrirBonDuClient(bcId){
  if(await ouvrirPieceJointeBC(bcId)) return;
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(b && b.pieceJointeData) openAttachmentPreview(b.pieceJointeData, b.pieceJointeNom);
}

/* Le bon du client vit dans un bucket privé : son URL se demande, elle ne se
   déduit pas d'un chemin. Rend vrai si le document a pu être ouvert — les
   appelants s'en servent pour décider de leur repli. */
async function ouvrirPieceJointeBC(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b || !b.pieceJointeChemin) return false;
  try{
    const [url, urlTelechargement] = await Promise.all([
      window.urlPieceJointe(b.pieceJointeChemin),
      window.urlTelechargementPieceJointe(b.pieceJointeChemin)
    ]);
    openAttachmentPreview(url, b.pieceJointeNom || 'Bon de commande', b.pieceJointeMime, urlTelechargement);
    return true;
  }catch(err){
    /* Le chemin désigne un objet disparu, ou les droits ont changé. Le dire :
       un aperçu qui ne s'ouvre pas sans un mot laisse croire à un clic raté. */
    console.error('Pièce jointe illisible', b.pieceJointeChemin, err);
    showToast("Le document du client n'a pas pu être ouvert.");
    return false;
  }
}
/* `source` est soit une data-URL — le cas historique — soit une URL signée, ce
   que rend un bucket privé. `mime` et `urlTelechargement` ne servent qu'au
   second cas : une URL signée ne porte pas son type, et l'attribut `download`
   est ignoré par le navigateur sur un autre domaine — le fichier s'ouvrirait
   dans un onglet au lieu de s'enregistrer. */
function openAttachmentPreview(source, nom, mime, urlTelechargement){
  if(!source) return;
  const modal = document.getElementById('attachmentPreviewModal');
  const body = document.getElementById('attachmentPreviewBody');
  const title = document.getElementById('attachmentPreviewTitle');
  const dl = document.getElementById('attachmentPreviewDownload');
  title.textContent = nom || 'Pièce jointe';
  dl.href = urlTelechargement || source;
  dl.download = nom || 'piece-jointe';
  const mode = window.apercuDe(source, mime, nom);
  if(mode === 'image'){
    body.innerHTML = `<img src="${esc(source)}" draggable="false">`;
  } else if(mode === 'pdf'){
    body.innerHTML = `<iframe src="${esc(source)}"></iframe>`;
  } else {
    body.innerHTML = `<div class="empty">Aperçu non disponible pour ce type de fichier — utilisez le téléchargement.</div>`;
  }
  if(!modal.style.left && !modal.style.right){
    modal.style.right = '24px';
    modal.style.bottom = '24px';
  }
  modal.style.display = 'flex';
}
function closeAttachmentPreview(){
  document.getElementById('attachmentPreviewModal').style.display = 'none';
  document.getElementById('attachmentPreviewBody').innerHTML = '';
}
let attachmentDragState = null;
function startDragAttachmentFloat(ev){
  const modal = document.getElementById('attachmentPreviewModal');
  const rect = modal.getBoundingClientRect();
  modal.style.left = rect.left+'px';
  modal.style.top = rect.top+'px';
  modal.style.right = 'auto';
  modal.style.bottom = 'auto';
  attachmentDragState = { offsetX: ev.clientX - rect.left, offsetY: ev.clientY - rect.top };
  document.addEventListener('mousemove', onDragAttachmentFloat);
  document.addEventListener('mouseup', endDragAttachmentFloat);
}
function onDragAttachmentFloat(ev){
  if(!attachmentDragState) return;
  const modal = document.getElementById('attachmentPreviewModal');
  modal.style.left = Math.max(0, ev.clientX - attachmentDragState.offsetX)+'px';
  modal.style.top = Math.max(0, ev.clientY - attachmentDragState.offsetY)+'px';
}
function endDragAttachmentFloat(){
  attachmentDragState = null;
  document.removeEventListener('mousemove', onDragAttachmentFloat);
  document.removeEventListener('mouseup', endDragAttachmentFloat);
}
let attachmentResizeState = null;
function startResizeAttachmentFloat(ev){
  ev.preventDefault();
  ev.stopPropagation();
  const modal = document.getElementById('attachmentPreviewModal');
  const rect = modal.getBoundingClientRect();
  modal.style.left = rect.left+'px';
  modal.style.top = rect.top+'px';
  modal.style.right = 'auto';
  modal.style.bottom = 'auto';
  attachmentResizeState = { startX: ev.clientX, startY: ev.clientY, startW: rect.width, startH: rect.height, startLeft: rect.left, startTop: rect.top };
  document.addEventListener('mousemove', onResizeAttachmentFloat);
  document.addEventListener('mouseup', endResizeAttachmentFloat);
}
function onResizeAttachmentFloat(ev){
  if(!attachmentResizeState) return;
  const modal = document.getElementById('attachmentPreviewModal');
  const dx = ev.clientX - attachmentResizeState.startX;
  const dy = ev.clientY - attachmentResizeState.startY;
  const newW = Math.max(280, attachmentResizeState.startW - dx);
  const newH = Math.max(280, attachmentResizeState.startH - dy);
  modal.style.width = newW+'px';
  modal.style.height = newH+'px';
  modal.style.left = (attachmentResizeState.startLeft + (attachmentResizeState.startW - newW))+'px';
  modal.style.top = (attachmentResizeState.startTop + (attachmentResizeState.startH - newH))+'px';
}
function endResizeAttachmentFloat(){
  attachmentResizeState = null;
  document.removeEventListener('mousemove', onResizeAttachmentFloat);
  document.removeEventListener('mouseup', endResizeAttachmentFloat);
}
/* Le menu se replie tout seul : `openForm` le referme à chaque ouverture de
   formulaire, et le planning le masque pour récupérer la largeur. Cette
   préférence l'en empêche.

   Elle vit dans le stockage du navigateur — une préférence d'affichage, propre
   à cette machine, qui n'a rien à faire en base. Un stockage refusé (navigation
   privée, réglage du navigateur) ne doit pas empêcher l'application de
   fonctionner : on retombe alors sur le comportement d'origine. */
const CLE_MENU_EPINGLE = 'erp.menu.epingle';

function menuEpingle(){
  try{ return localStorage.getItem(CLE_MENU_EPINGLE) === '1'; }
  catch(e){ return false; }
}

function toggleMenuEpingle(coche){
  try{ localStorage.setItem(CLE_MENU_EPINGLE, coche ? '1' : '0'); }
  catch(e){ console.warn('Préférence de menu non conservée par le navigateur', e); }
  appliquerEpinglageMenu();
  showToast(coche ? 'Le menu reste ouvert.' : 'Le menu se repliera à nouveau.', 'success', 2000);
}

/* Appelée au démarrage et au basculement, jamais à chaque rendu : sans quoi un
   clic sur ☰ pour fermer serait aussitôt défait. Le geste explicite garde la
   main sur la préférence. */
function appliquerEpinglageMenu(){
  const epingle = menuEpingle();
  const el = document.getElementById('menuEpingleToggle');
  if(el) el.checked = epingle;
  if(epingle){
    document.body.classList.remove('sidebar-collapsed');
    // Le planning masque la barre par une autre règle : il faut la forcer.
    document.body.classList.add('sidebar-forced');
  }
}

function toggleSidebarForced(){
  if(document.body.classList.contains('is-planning-view')){
    document.body.classList.toggle('sidebar-forced');
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
}
function toggleUserMenu(ev){
  if(ev) ev.stopPropagation();
  document.querySelectorAll('.user-menu').forEach(m=>m.classList.toggle('open', false));
  const wrap = ev ? ev.currentTarget.closest('.user-menu-wrap') : null;
  const menu = wrap ? wrap.querySelector('.user-menu') : null;
  if(menu) menu.classList.add('open');
}
document.addEventListener('click', ()=>{ document.querySelectorAll('.user-menu').forEach(m=>m.classList.remove('open')); });
async function logOut(){
  document.querySelectorAll('.user-menu').forEach(m=>m.classList.remove('open'));
  try{
    await window.seDeconnecter();
    // `watchAuthState` renvoie vers /login.html dès la session fermée
  }catch(e){
    console.error('Déconnexion impossible', e);
    showToast('Déconnexion impossible — réessayez.');
  }
}

/* Bascule de société : refusée si la RLS ne donne pas accès. */
async function changerSociete(code){
  document.querySelectorAll('.user-menu').forEach(m=>m.classList.remove('open'));
  if(code === state.societeId) return;
  if(!window.choisirSociete || !window.choisirSociete(code)){
    showToast("Vous n'avez pas accès à cette société.");
    return;
  }
  state.societeId = code;
  /* Les recherches en cours portaient sur les fiches de l'autre société :
     les garder afficherait une liste filtrée sans que la barre, hors écran,
     explique pourquoi. */
  state.recherches = {};
  state.currentRole = window.roleEffectif();
  appliquerCouleurSociete();
  document.body.classList.toggle('role-technicien', state.currentRole==='technicien');
  const autorises = navPourRole().map(n=>n.id);
  if(autorises.length && !autorises.includes(state.tab)) state.tab = autorises[0];
  renderShell();
  renderTab();

  /* Les données en mémoire sont celles de l'ancienne société : on les remplace
     par celles de la nouvelle. Un formulaire ouvert est abandonné — il portait
     sur une société qu'on vient de quitter. */
  Object.keys(state.formOpen).forEach(k => { state.formOpen[k] = false; });
  state.editing = null;
  showToast('Chargement de ' + societeName(code) + '…');
  await loadAll();
  renderShell();
  renderTab();
}
function setPlusTab(id){ state.plusTab = id; renderTab(); }
function renderPlus(){
  return `
    <div class="plus-subnav">
      <button class="plus-subnav-btn ${state.plusTab==='clients'?'active':''}" onclick="setPlusTab('clients')">Clients</button>
      <button class="plus-subnav-btn ${state.plusTab==='bonsCommande'?'active':''}" onclick="setPlusTab('bonsCommande')">Bons de commande</button>
      <button class="plus-subnav-btn ${state.plusTab==='planning'?'active':''}" onclick="setPlusTab('planning')">Planning</button>
      <button class="plus-subnav-btn ${state.plusTab==='parametres'?'active':''}" onclick="setPlusTab('parametres')">Réglages</button>
    </div>
    ${state.plusTab==='parametres' ? renderParametres() : state.plusTab==='bonsCommande' ? renderBonsCommande() : state.plusTab==='planning' ? renderPlanning() : renderClients()}
  `;
}
function renderTab(){
  const renderers = {dashboard:renderDashboard, chantiers:renderChantiers, clients:renderClients, devis:renderDevis, factures:renderFactures, interventions:renderInterventions, bonsCommande:renderBonsCommande, planning:renderPlanning, rh:renderRH, vehicules:renderVehicules, materiel:renderMateriel, piecesCommande:renderPiecesCommande, statistiques:renderStatistiques, parametres:renderParametres, plus:renderPlus, catalogue:renderCatalogue};
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = renderers[state.tab]();
  contentEl.classList.toggle('is-planning', state.tab==='planning');
  document.body.classList.toggle('is-planning-view', state.tab==='planning');
  if(state.tab!=='planning' && !menuEpingle()) document.body.classList.remove('sidebar-forced');
  const isWide = state.tab==='devis' || state.tab==='factures' || state.tab==='interventions' || state.tab==='dashboard' || state.tab==='bonsCommande' || state.tab==='planning' || state.tab==='clients' || state.tab==='chantiers' || state.tab==='rh' || state.tab==='vehicules' || state.tab==='materiel' || state.tab==='piecesCommande' || state.tab==='statistiques' || state.tab==='catalogue';
  contentEl.classList.toggle('content-wide', isWide);
  if(state.tab==='interventions' && state.formOpen.intervention && (state.editing.step||1)===3){
    setTimeout(initSignaturePad, 30);
  }
}

/* ---------- Tableau de bord ---------- */
function buildMonthsBack(n){
  const now = new Date();
  const list = [];
  for(let i=n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    list.push({year:d.getFullYear(), month:d.getMonth(), label:d.toLocaleDateString('fr-FR',{month:'short'}), fullLabel:d.toLocaleDateString('fr-FR',{month:'long'})});
  }
  return list;
}
function buildYTDMonths(){
  const now = new Date();
  const list = [];
  for(let m=0; m<=now.getMonth(); m++){
    const d = new Date(now.getFullYear(), m, 1);
    list.push({year:now.getFullYear(), month:m, label:d.toLocaleDateString('fr-FR',{month:'short'}), fullLabel:d.toLocaleDateString('fr-FR',{month:'long'})});
  }
  return list;
}
function monthsForPeriod(period){
  if(period==='3m') return buildMonthsBack(3);
  if(period==='12m') return buildMonthsBack(12);
  if(period==='ytd') return buildYTDMonths();
  return buildMonthsBack(6);
}
function computeRevenuePeriod(factures, monthsList){
  const current = monthsList.map(()=>0);
  const previous = monthsList.map(()=>0);
  factures.forEach(f=>{
    if(!f.date) return;
    const y = parseInt(f.date.slice(0,4), 10);
    const m = parseInt(f.date.slice(5,7), 10) - 1;
    if(isNaN(y) || isNaN(m)) return;
    const t = computeDocTotals(f).ht;
    monthsList.forEach((mo,idx)=>{
      if(y===mo.year && m===mo.month) current[idx] += t;
      if(y===mo.year-1 && m===mo.month) previous[idx] += t;
    });
  });
  const data = monthsList.map((mo,i)=>({label:mo.label, fullLabel:mo.fullLabel, current:current[i], previous:previous[i]}));
  const total = current.reduce((a,b)=>a+b,0);
  const lastYear = monthsList.length? monthsList[monthsList.length-1].year : new Date().getFullYear();
  return { data, total, currentYear:lastYear, prevYear:lastYear-1 };
}
function setDashRevenuePeriod(period){
  if(period === 'custom'){
    openRevenueCustomModal();
    return;
  }
  state.dashRevenuePeriod = period;
  renderTab();
}
function openRevenueCustomModal(){
  const resultBox = document.getElementById('revenueCustomResult');
  if(resultBox) resultBox.innerHTML = '';
  const today = todayISO();
  const firstOfMonth = today.slice(0,8)+'01';
  const fromEl = document.getElementById('revenue_date_from');
  const toEl = document.getElementById('revenue_date_to');
  if(fromEl) fromEl.value = firstOfMonth;
  if(toEl) toEl.value = today;
  document.getElementById('revenueCustomModal').classList.add('open');
}
function closeRevenueCustomModal(){
  document.getElementById('revenueCustomModal').classList.remove('open');
  const sel = document.querySelector('.dash-period-select');
  if(sel) sel.value = state.dashRevenuePeriod || '6m';
}
function closeRevenueCustomModalOnBackdrop(ev){
  if(ev.target === ev.currentTarget) closeRevenueCustomModal();
}
function computeCustomRevenue(){
  const from = document.getElementById('revenue_date_from').value;
  const to = document.getElementById('revenue_date_to').value;
  const resultBox = document.getElementById('revenueCustomResult');
  if(!from || !to){ showToast('Choisissez les deux dates.'); return; }
  if(from > to){ showToast('La date de début doit être avant la date de fin.'); return; }
  const soc = state.societeId;
  const matching = state.factures.filter(f=>f.societeId===soc && f.date && f.date>=from && f.date<=to);
  const total = matching.reduce((s,f)=>s+computeDocTotals(f).ht,0);
  resultBox.innerHTML = `
    <div class="summary-row" style="margin-top:18px;"><span>Du ${fmtDate(from)} au ${fmtDate(to)}</span></div>
    <div style="font-size:28px; font-weight:800; color:var(--text); font-family:'JetBrains Mono',monospace; margin-top:6px;">${moneyDisplay(total)}</div>
    <div class="card-sub" style="margin-top:4px;">${matching.length} facture${matching.length>1?'s':''}</div>
  `;
}
function showRevenueTooltip(ev, label, amount){
  let tip = document.getElementById('revenueTooltip');
  const card = ev.currentTarget.closest('.dash-revenue-card');
  if(!card) return;
  if(!tip){ tip = document.createElement('div'); tip.id = 'revenueTooltip'; card.appendChild(tip); }
  else if(tip.parentElement !== card){ card.appendChild(tip); }
  tip.innerHTML = `<b>${esc(label)}</b><br>${esc(amount)}`;
  tip.style.display = 'block';
  const cardRect = card.getBoundingClientRect();
  let left = ev.clientX - cardRect.left + 14;
  let top = ev.clientY - cardRect.top - 44;
  if(left + 140 > cardRect.width) left = ev.clientX - cardRect.left - 154;
  if(top < 0) top = ev.clientY - cardRect.top + 18;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function hideRevenueTooltip(){
  const tip = document.getElementById('revenueTooltip');
  if(tip) tip.style.display = 'none';
}
function renderYearlyComparisonSVG(yearly){
  const { currentYear, prevYear, data } = yearly;
  const w = 960, h = 300, padT = 40, padB = 34, padL = 16, padR = 16;
  const max = Math.max(1, ...data.map(d=>Math.max(d.current, d.previous)));
  const groupW = (w-padL-padR)/data.length;
  const barW = Math.min(20, groupW*0.32);
  const gapBars = 4;
  let bars = '';
  data.forEach((d,i)=>{
    const groupCenter = padL + i*groupW + groupW/2;
    const hPrev = d.previous>0 ? Math.max(2,(h-padT-padB)*(d.previous/max)) : 0;
    const hCurr = d.current>0 ? Math.max(2,(h-padT-padB)*(d.current/max)) : 0;
    const xPrev = groupCenter - barW - gapBars/2;
    const xCurr = groupCenter + gapBars/2;
    const yPrev = h-padB-hPrev;
    const yCurr = h-padB-hCurr;
    const prevLabel = `${d.fullLabel} ${prevYear}`.replace(/'/g,"\\'");
    const currLabel = `${d.fullLabel} ${currentYear}`.replace(/'/g,"\\'");
    const prevAmount = money(d.previous).replace(/'/g,"\\'");
    const currAmount = money(d.current).replace(/'/g,"\\'");
    bars += `<rect x="${xPrev.toFixed(1)}" y="${padT}" width="${barW.toFixed(1)}" height="${(h-padT-padB).toFixed(1)}" fill="transparent" style="cursor:pointer;" onmousemove="showRevenueTooltip(event,'${jsAttr(prevLabel)}','${jsAttr(prevAmount)}')" onmouseleave="hideRevenueTooltip()"/>
    <rect x="${xCurr.toFixed(1)}" y="${padT}" width="${barW.toFixed(1)}" height="${(h-padT-padB).toFixed(1)}" fill="transparent" style="cursor:pointer;" onmousemove="showRevenueTooltip(event,'${jsAttr(currLabel)}','${jsAttr(currAmount)}')" onmouseleave="hideRevenueTooltip()"/>
    <rect x="${xPrev.toFixed(1)}" y="${yPrev.toFixed(1)}" width="${barW.toFixed(1)}" height="${hPrev.toFixed(1)}" rx="3" fill="var(--text-dim)" opacity="0.32" pointer-events="none"/>
    <rect x="${xCurr.toFixed(1)}" y="${yCurr.toFixed(1)}" width="${barW.toFixed(1)}" height="${hCurr.toFixed(1)}" rx="3" fill="var(--accent)" pointer-events="none"/>`;
    bars += `<text x="${groupCenter.toFixed(1)}" y="${h-padB+22}" text-anchor="middle" font-size="12.5" fill="var(--text-dim)">${d.label}</text>`;
  });
  const legend = `
    <g transform="translate(${(w-230).toFixed(1)}, 10)">
      <rect x="0" y="2" width="13" height="13" rx="3" fill="var(--accent)"/>
      <text x="19" y="12.5" font-size="13.5" fill="var(--text)">${currentYear}</text>
      <rect x="75" y="2" width="13" height="13" rx="3" fill="var(--text-dim)" opacity="0.32"/>
      <text x="94" y="12.5" font-size="13.5" fill="var(--text)">${prevYear}</text>
    </g>`;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block;">${bars}${legend}</svg>`;
}
function computeStatusBreakdown(factures){
  const counts = {payée:0, partiel:0, impayée:0};
  factures.forEach(f=>{
    const st = reglementStatutFacture(f);
    if(st.cle==='reglee') counts.payée++;
    else if(st.cle==='partiellement_reglee') counts.partiel++;
    else counts.impayée++;
  });
  return counts;
}
function renderDonutSVG(counts){
  const total = counts.payée+counts.partiel+counts.impayée;
  if(!total) return '<div class="empty">Pas encore de factures.</div>';
  const colors = {payée:'#12875A', partiel:'#8A6D00', impayée:'#D9363E'};
  const labels = {payée:'Payées', partiel:'Partielles', impayée:'Impayées'};
  const r = 52, cx = 62, cy = 62, strokeW = 20;
  const circumference = 2*Math.PI*r;
  let cumulative = 0, circles = '';
  ['payée','partiel','impayée'].forEach(key=>{
    const val = counts[key];
    if(!val) return;
    const frac = val/total;
    const dash = frac*circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[key]}" stroke-width="${strokeW}" stroke-dasharray="${dash.toFixed(1)} ${(circumference-dash).toFixed(1)}" stroke-dashoffset="${(-cumulative).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    cumulative += dash;
  });
  const legend = ['payée','partiel','impayée'].filter(k=>counts[k]>0).map(k=>
    `<div style="display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--text-dim);"><span style="width:10px; height:10px; border-radius:3px; background:${colors[k]}; display:inline-block; flex-shrink:0;"></span>${labels[k]} <b style="color:var(--text); margin-left:2px;">${counts[k]}</b></div>`
  ).join('');
  return `<div style="display:flex; align-items:center; gap:22px;"><svg viewBox="0 0 124 124" style="width:110px; height:110px; flex-shrink:0;">${circles}</svg><div style="display:flex; flex-direction:column; gap:8px;">${legend}</div></div>`;
}
function relativeTime(iso){
  if(!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff/60000);
  if(min < 1) return "à l'instant";
  if(min < 60) return `il y a ${min} min`;
  const h = Math.floor(min/60);
  if(h < 24) return `il y a ${h} h`;
  const d = Math.floor(h/24);
  if(d < 7) return `il y a ${d} j`;
  return fmtDate(iso.slice(0,10));
}
function initials(name){
  const parts = (name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return parts.slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
function buildActivityFeed(soc){
  const events = [];
  state.devis.filter(d=>d.societeId===soc && d.createdAt).forEach(d=>{
    events.push({icon:'devis', color:'success', date:d.createdAt, label:'Devis créé', sub:`${d.client} · ${d.numero}`, amount:computeDocTotals(d).ht, id:d.id, goFn:`goToDevis('${d.id}')`});
  });
  state.factures.filter(f=>f.societeId===soc && f.createdAt).forEach(f=>{
    events.push({icon:'factures', color:'info', date:f.createdAt, label:'Facture créée', sub:`${f.client} · ${f.numero}`, amount:computeDocTotals(f).ht, id:f.id, goFn:`goToFacture('${f.id}')`});
  });
  state.interventions.filter(i=>i.societeId===soc && i.createdAt).forEach(i=>{
    events.push({icon:'interventions', color:'warn', date:i.createdAt, label:'Rapport créé', sub:`${i.client} · ${i.numero||''}`, amount:null, id:i.id, goFn:`goToIntervention('${i.id}')`});
  });
  state.reglements.filter(r=>r.societeId===soc && r.createdAt).forEach(r=>{
    const f = state.factures.find(x=>x.id===r.factureId);
    events.push({icon:'reglements', color:'success', date:r.createdAt, label:'Paiement reçu', sub:f? `${f.client} · ${f.numero}` : '', amount:r.montant, id:r.id, goFn: f? `goToFacture('${f.id}')` : ''});
  });
  return events.sort((a,b)=> new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,6);
}
function computeTopClients(factures){
  const totals = {};
  factures.forEach(f=>{
    const t = computeDocTotals(f).ht;
    totals[f.client] = (totals[f.client]||0) + t;
  });
  return Object.entries(totals).map(([client, total])=>({client, total})).sort((a,b)=>b.total-a.total).slice(0,5);
}
function renderTopClientsHTML(factures){
  const top = computeTopClients(factures);
  if(!top.length) return '<div class="empty">Pas encore de factures.</div>';
  const max = Math.max(...top.map(t=>t.total));
  return top.map((t,i)=>`
    <div class="topclient-row cliquable" role="button" tabindex="0" title="Ouvrir le dossier de règlements de ${esc(t.client)}"
         onclick="ouvrirClientDepuisDashboard('${jsAttr(t.client)}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirClientDepuisDashboard('${jsAttr(t.client)}');}">
      <span class="topclient-rank">${i+1}</span>
      <div class="topclient-mid">
        <div class="topclient-name">${esc(t.client)}</div>
        <div class="progress-bar" style="margin-top:5px;"><div class="progress-fill" style="width:${Math.round(t.total/max*100)}%; background:var(--accent);"></div></div>
      </div>
      <div class="topclient-amount">${moneyDisplay(t.total)}</div>
    </div>`).join('');
}
function computeMonthSummary(soc){
  const ym = todayISO().slice(0,7);
  const factures = state.factures.filter(f=>f.societeId===soc);
  const devisDuMois = state.devis.filter(d=>d.societeId===soc && (d.date||'').slice(0,7)===ym);
  const caMois = factures.filter(f=>f.statut==='payée' && (f.date||'').slice(0,7)===ym).reduce((s,f)=>s+computeDocTotals(f).ht,0);
  const yearly = computeRevenuePeriod(factures, buildMonthsBack(6));
  const maxMois = Math.max(1, ...yearly.data.map(m=>Math.max(m.current, m.previous)));
  const devisAcceptes = devisDuMois.filter(d=>d.statut==='accepté').length;
  const tauxConversion = devisDuMois.length? Math.round(devisAcceptes/devisDuMois.length*100) : 0;
  /* Sur le statut stocké, une facture réglée à moitié échappait au total dû.
     Le reste à payer le dit sans intermédiaire. */
  const impayeesMontant = factures.reduce((s,f)=>{ const st=reglementStatutFacture(f); return s + (st.cle==='reglee' ? 0 : st.reste); },0);
  const totalFacture = factures.reduce((s,f)=>s+computeDocTotals(f).ttc,0) || 1;
  const tauxEncaisse = Math.max(0, Math.round((1 - impayeesMontant/totalFacture)*100));
  return { caMois, caMoisPct: Math.min(100, Math.round(caMois/maxMois*100)), tauxConversion, devisCount: devisDuMois.length, tauxEncaisse, impayeesMontant };
}
/* `fiche` restreint le décompte à un conducteur. Absente, on compte toute la
   société — c'est ce qu'attendent le pilotage et l'écran d'accueil. */
function computeDashTraiter(soc, fiche){
  const today = todayISO();
  const bcs = state.bonsCommande.filter(b=>b.societeId===soc
    && (!fiche || b.conducteurId === fiche.id));
  const enAttenteConducteur = bcs.filter(b=>!b.valideConducteur && !b.bonCommandeId).length;
  const aValiderDirecteur = bcs.filter(b=>b.valideConducteur && !b.valideDirecteur).length;
  const aFacturerList = bcs.filter(b=>b.valideDirecteur && !state.factures.some(f=>f.bonCommandeId===b.id));
  const aFacturer = aFacturerList.length;
  const aFacturerMontant = aFacturerList.reduce((s,b)=> s + (b.lignes? computeTotalsAvecRemise(b.lignes,0).ht : (parseFloat(b.montant)||0)), 0);
  const rappelsAujourdhui = bcs.filter(b=>b.rappelDate && b.rappelDate<=today).length;
  const facturesEchues = state.factures.filter(f=>f.societeId===soc && f.statut==='impayée' && f.echeance && f.echeance<today).length;
  return { enAttenteConducteur, aValiderDirecteur, aFacturer, aFacturerMontant, rappelsAujourdhui, facturesEchues };
}
function sousTraitantActuel(){
  return state.currentSousTraitant || '';
}
function facturesDuSousTraitant(){
  return state.factures.filter(f=>f.societeId===state.societeId && f.sousTraitantEmetteur && (!sousTraitantActuel() || f.sousTraitantEmetteur===sousTraitantActuel()));
}
function bcFacturesKTA(){
  const st = sousTraitantActuel();
  return state.bonsCommande.filter(b=>b.societeId===state.societeId && b.sousTraitant && (!st || b.sousTraitant===st) && b.valideConducteur);
}
/* ---------- Tuiles partagées ----------
   Les trois tableaux de bord de métier montrent les mêmes tuiles, dans le même
   habillage que celui du pilotage : une deuxième écriture du même HTML aurait
   fini par ne plus lui ressembler. */
/* Le tableau de bord de pilotage saluait « Aissa Choumane » en toutes lettres :
   tout le monde était accueilli sous ce nom. */
function salutation(){
  const qui = (window.utilisateurCourant && window.utilisateurCourant()) || '';
  const nom = qui.includes('@') ? qui.split('@')[0].replace(/[._-]+/g, ' ') : qui;
  return 'Bonjour 👋' + (nom ? ' ' + nom : '');
}

/**
 * Une tuile du tableau de bord.
 *
 * `sous`, `ton` et `titre` sont facultatifs — la moitié des appels s'en passe.
 * Sans cette annotation, TypeScript déduit le contrat du déstructurage et les
 * exige toutes les sept, ce qui rendait onze erreurs sur des appels corrects.
 *
 * @param {{icone: string, libelle: string, valeur: string|number,
 *          destination: string, sous?: string, ton?: string, titre?: string}} tuile
 */
function tuileDashboard({ icone, libelle, valeur, sous, ton, destination, titre }){
  const classe = 'stat-card cliquable' + (ton ? ' ' + ton : '');
  return `<div class="${classe}" role="button" tabindex="0" title="${esc(titre||libelle)}"
      onclick="ouvrirDepuisDashboard('${jsAttr(destination)}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirDepuisDashboard('${jsAttr(destination)}');}">
    <div class="stat-card-top"><span class="stat-icon" style="background:var(--${ton==='danger'?'danger':ton==='warn'?'accent':'info'}-soft); color:var(--${ton==='danger'?'danger':ton==='warn'?'accent-2':'info'});">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icone}</svg></span></div>
    <div class="stat-label">${esc(libelle)}</div>
    <div class="stat-num">${valeur}</div>
    ${sous ? `<div class="stat-subamount">${sous}</div>` : ''}
  </div>`;
}

function enteteDashboard(titre, sousTitre){
  const dateLabel = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  return `<div class="dash-greetrow">
      <div>
        <h1 class="dash-greeting">${esc(titre)}</h1>
        <div class="dash-subtitle">${esc(sousTitre)}</div>
      </div>
      <div class="dash-date-pill">${dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)}</div>
    </div>`;
}

/* ---------- Le technicien ----------
   Son écran ne porte pas un euro : `voitLesPrix()` le lui refuse, et son
   travail ne s'évalue pas en chiffre d'affaires. Ce qu'il lui faut, c'est ce
   qu'il a à faire aujourd'hui. */

/** Les bons confiés à l'équipe du compte qui regarde. */
function mesBonsTechnicien(){
  const equipe = monEquipeId();
  const bons = state.bonsCommande.filter(b=>b.societeId===state.societeId);
  if(!equipe) return bons;   // équipe inconnue : mieux vaut tout montrer que rien
  const libelles = state.techniciens.filter(x=>x.id===equipe).map(x=>technicienLabel(x));
  return bons.filter(b=> b.technicien === equipe || libelles.includes(b.technicien));
}

/* Un aperçu, pas la journée entière : au-delà, l'écran devient un mur et le
   planning fait mieux le travail. */
const JOURNEE_VISIBLE = 8;

function renderDashboardTechnicien(){
  const today = todayISO();
  const finSemaine = dateLocaleISO(new Date(Date.now() + 6*86400000));
  const miens = mesBonsTechnicien();
  const duJour = miens.filter(b=>b.datePlanifiee === today);
  const laSemaine = miens.filter(b=>b.datePlanifiee && b.datePlanifiee > today && b.datePlanifiee <= finSemaine);
  /* « À pointer » : la date est passée et tous les métiers ne sont pas
     déclarés faits. C'est le retard tel que le terrain le vit. */
  const aPointer = miens.filter(b=>{
    if(!b.datePlanifiee || b.datePlanifiee >= today) return false;
    const metiers = (b.metiers && b.metiers.length) ? b.metiers : (b.metier ? [b.metier] : []);
    const faits = b.metiersFait || {};
    return !metiers.length || metiers.some(m=>!faits[m]);
  });
  const pieces = miens.filter(b=>b.pieceACommander && !b.pieceACommanderDateCommande);

  return `
    ${enteteDashboard(salutation(), "Votre journée sur le terrain — " + societeName(state.societeId))}
    <div class="grid-stats grid-stats-4">
      ${tuileDashboard({icone:ICONS.planning, libelle:"Mes interventions aujourd'hui", valeur:duJour.length,
        ton: duJour.length?'warn':'', destination:'planning', titre:'Ouvrir le planning'})}
      ${tuileDashboard({icone:ICONS.planning, libelle:'Les six prochains jours', valeur:laSemaine.length,
        destination:'planning', titre:'Ouvrir le planning'})}
      ${tuileDashboard({icone:ICONS.bonsCommande, libelle:'Travaux à pointer', valeur:aPointer.length,
        ton: aPointer.length?'danger':'', destination:'planning', titre:'Ouvrir le planning'})}
      ${tuileDashboard({icone:ICONS.bonsCommande, libelle:'Pièces que j’ai signalées', valeur:pieces.length,
        destination:'pieces', titre:'Voir les pièces en commande'})}
    </div>
    <div class="section-title-row"><span class="section-title" style="margin:0;">Aujourd’hui</span></div>
    <div class="card traiter-card">
      ${duJour.length ? duJour
        /* L'heure d'abord : une journée de terrain se lit dans l'ordre où elle
           se vit, pas dans celui où les bons ont été saisis. */
        .slice().sort((x,y)=>(x.heurePlanifiee||'99:99').localeCompare(y.heurePlanifiee||'99:99'))
        .slice(0, JOURNEE_VISIBLE).map(b=>`
        <div class="traiter-row cliquable" role="button" tabindex="0"
             onclick="ouvrirDepuisDashboard('planning')"
             onkeydown="if(event.key==='Enter'){ouvrirDepuisDashboard('planning');}">
          <span class="traiter-ico" style="background:var(--info-soft);">🔧</span>
          <span class="traiter-label">${esc(b.client||'—')}${b.adresse? ' — '+esc(b.adresse):''}</span>
          ${b.heurePlanifiee? `<span class="traiter-count">${esc(b.heurePlanifiee)}</span>` : ''}
          <span class="traiter-chev">›</span>
        </div>`).join('')
        : '<div class="empty">🎉 Rien de planifié aujourd’hui.</div>'}
      ${duJour.length > JOURNEE_VISIBLE ? `
        <div class="traiter-row cliquable" role="button" tabindex="0"
             onclick="ouvrirDepuisDashboard('planning')"
             onkeydown="if(event.key==='Enter'){ouvrirDepuisDashboard('planning');}">
          <span class="traiter-ico" style="background:var(--accent-soft);">→</span>
          <span class="traiter-label">Voir les ${duJour.length - JOURNEE_VISIBLE} autres dans le planning</span>
          <span class="traiter-chev">›</span>
        </div>` : ''}
    </div>
  `;
}

/* ---------- Le conducteur de travaux ----------
   Il voit les montants, mais le chiffre d'affaires et le classement des
   clients ne sont pas son métier : ce qu'il arbitre, ce sont des validations,
   des retards et des pièces qui manquent. */
/* La fiche conducteur du compte connecté, sur le modèle de `monEquipeId()`
   pour le terrain. Sans elle, « mes bons » n'a pas de sens : le tableau de
   bord montrait les validations de toute la société. */
function maFicheConducteur(){
  const moi = window.monCompteId && window.monCompteId();
  if(!moi) return null;
  return state.conducteurs.find(c => c.profileId === moi && c.societeId === state.societeId) || null;
}

function renderDashboardConducteur(){
  const soc = state.societeId;
  const today = todayISO();
  const fiche = maFicheConducteur();
  /* Sans fiche rattachée, on ne peut pas distinguer ses affaires : on montre
     tout, et on le DIT — un écran qui filtre en silence ferait croire à un
     conducteur qu'il n'a rien à valider. */
  const bons = state.bonsCommande.filter(b=>b.societeId===soc
    && (!fiche || b.conducteurId === fiche.id));
  const traiter = computeDashTraiter(soc, fiche);
  const enRetard = bons.filter(b=>b.dateFinTravaux && b.dateFinTravaux < today
    && !state.factures.some(f=>f.bonCommandeId===b.id));
  const piecesAttendues = bons.filter(b=>b.pieceACommander && !b.pieceACommanderDateCommande);
  const nonPlanifies = bons.filter(b=>!b.datePlanifiee && !b.valideDirecteur);

  return `
    ${enteteDashboard(salutation(), fiche
      ? 'Vos chantiers en cours — ' + societeName(soc)
      : 'Tous les chantiers — ' + societeName(soc))}
    ${fiche? '' : `<div class="card" style="border-color:var(--accent); background:var(--accent-soft); margin-bottom:16px;">👤 Votre compte n'est rattaché à aucune fiche de conducteur : cet écran montre les affaires de <b>toute la société</b>. Un administrateur peut faire le lien dans <b>Réglages › Intervenants</b>.</div>`}
    <div class="grid-stats grid-stats-4">
      ${tuileDashboard({icone:ICONS.bonsCommande, libelle:'Bons à valider', valeur:traiter.enAttenteConducteur,
        ton: traiter.enAttenteConducteur?'warn':'', destination:'aValider', titre:'Voir les bons en attente de validation'})}
      ${tuileDashboard({icone:ICONS.planning, libelle:'Travaux en retard', valeur:enRetard.length,
        ton: enRetard.length?'danger':'', destination:'planning', titre:'Ouvrir le planning'})}
      ${tuileDashboard({icone:ICONS.bonsCommande, libelle:'Pièces à commander', valeur:piecesAttendues.length,
        destination:'pieces', titre:'Voir les pièces en commande'})}
      ${tuileDashboard({icone:ICONS.bonsCommande, libelle:'À facturer', valeur:traiter.aFacturer,
        sous: moneyDisplay(traiter.aFacturerMontant) + ' HT', destination:'aFacturer',
        titre:'Voir les bons de commande à facturer'})}
    </div>
    <div class="section-title-row"><span class="section-title" style="margin:0;">À traiter</span></div>
    <div class="card traiter-card">
      ${traiter.enAttenteConducteur || traiter.aValiderDirecteur || nonPlanifies.length || traiter.rappelsAujourdhui ? `
      ${traiter.enAttenteConducteur? `<div class="traiter-row" onclick="ouvrirDepuisDashboard('aValider')"><span class="traiter-ico" style="background:var(--info-soft);">🦺</span><span class="traiter-label">Bons de commande à valider</span><span class="traiter-count">${traiter.enAttenteConducteur}</span><span class="traiter-chev">›</span></div>`:''}
      ${nonPlanifies.length? `<div class="traiter-row" onclick="ouvrirDepuisDashboard('planning')"><span class="traiter-ico" style="background:var(--accent-soft);">📅</span><span class="traiter-label">Bons non planifiés</span><span class="traiter-count">${nonPlanifies.length}</span><span class="traiter-chev">›</span></div>`:''}
      ${traiter.rappelsAujourdhui? `<div class="traiter-row" onclick="ouvrirDepuisDashboard('planning')"><span class="traiter-ico" style="background:#EDE4FF;">🔄</span><span class="traiter-label">Locataires à rappeler</span><span class="traiter-count">${traiter.rappelsAujourdhui}</span><span class="traiter-chev">›</span></div>`:''}
      ${traiter.aValiderDirecteur? `<div class="traiter-row" onclick="ouvrirDepuisDashboard('impayees')"><span class="traiter-ico" style="background:var(--success-soft);">✍️</span><span class="traiter-label">En attente du directeur</span><span class="traiter-count">${traiter.aValiderDirecteur}</span><span class="traiter-chev">›</span></div>`:''}
      ` : '<div class="empty">🎉 Rien à traiter — tout est à jour.</div>'}
    </div>
  `;
}

function renderDashboardSousTraitant(){
  const mesFactures = facturesDuSousTraitant();
  const impayees = mesFactures.filter(f=>f.statut==='impayée').length;
  const devisST = state.devis.filter(d=>d.societeId===state.societeId && d.sousTraitantEmetteur && (!sousTraitantActuel() || d.sousTraitantEmetteur===sousTraitantActuel()));
  const facturesKTAPretes = bcFacturesKTA().filter(b=>b.montantSousTraitant!=null && !factureSTQuiCouvre(b.id)).length;
  const dateLabel = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  return `
    <div class="dash-greetrow">
      <div>
        <h1 class="dash-greeting">Bonjour 👋 ${esc(sousTraitantActuel()||'Sous-traitant')}</h1>
        <div class="dash-subtitle">Votre espace sous-traitant — ${esc(societeName(state.societeId))}</div>
      </div>
      <div class="dash-date-pill">${dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)}</div>
    </div>
    ${!sousTraitantActuel()? `<div class="card" style="border-color:var(--accent); background:var(--accent-soft); margin-bottom:16px;">👤 Sélectionnez votre nom dans <b>Réglages</b> pour ne voir que vos documents.</div>`:''}
    <div class="grid-stats">
      <div class="stat-card cliquable ${facturesKTAPretes?'warn':''}" role="button" tabindex="0" onclick="state.facturesView='factureskta'; setTab('factures')" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;){event.preventDefault();state.facturesView='factureskta'; setTab('factures')}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--accent-soft); color:var(--accent-2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.bonsCommande}</svg></span></div><div class="stat-label">Factures ${esc(societeName(state.societeId))} prêtes</div><div class="stat-num">${facturesKTAPretes}</div></div>
      <div class="stat-card cliquable" role="button" tabindex="0" onclick="setTab('devis')" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;){event.preventDefault();setTab(&#39;devis&#39;);}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--info-soft); color:var(--info);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.devis}</svg></span></div><div class="stat-label">Mes devis</div><div class="stat-num">${devisST.length}</div></div>
      <div class="stat-card cliquable ${impayees?'danger':''}" role="button" tabindex="0" onclick="setTab('factures')" onkeydown="if(event.key===&#39;Enter&#39;||event.key===&#39; &#39;){event.preventDefault();setTab('factures')}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--danger-soft); color:var(--danger);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.factures}</svg></span></div><div class="stat-label">Mes factures impayées</div><div class="stat-num">${impayees}</div></div>
    </div>
  `;
}
/* ---------- Ce que le tableau de bord sait ouvrir ----------
   Les quatre tuiles, le classement des clients et le résumé du mois affichaient
   des chiffres qui appelaient le clic sans rien faire. Chaque destination est
   décrite ici, une seule fois : un `onclick` bricolé dans chaque bloc aurait
   fini par ouvrir un écran filtré autrement que ce que le chiffre annonçait. */
const DESTINATIONS_DASHBOARD = {
  caEncaisse:    { tab:'factures', etat:{ facturesView:'liste', factureReglementFilter:'payee', facturePeriode:'mois' } },
  devisEnAttente:{ tab:'devis',    etat:{ devisStatutFilter:'envoyé' } },
  impayees:      { tab:'factures', etat:{ facturesView:'liste', factureReglementFilter:'impayee', facturePeriode:'tout' } },
  aFacturer:     { tab:'factures', etat:{ facturesView:'afacturer' } },
  reglements:    { tab:'factures', etat:{ facturesView:'reglements', reglementsClient:null } },
  aValider:      { tab:'planning',  etat:{ planningView:'attente' } },
  planning:      { tab:'planning',  etat:{} },
  pieces:        { tab:'piecesCommande', etat:{} },
  chantiers:     { tab:'chantiers', etat:{} },
};

function ouvrirDepuisDashboard(cle){
  const d = DESTINATIONS_DASHBOARD[cle];
  if(!d) return;
  Object.assign(state, d.etat);
  setTab(d.tab);
}

/* Un client du classement : on ouvre son dossier de règlements, pas la liste
   entière — c'est le montant qu'il doit qu'on vient de regarder. */
function ouvrirClientDepuisDashboard(nom){
  Object.assign(state, DESTINATIONS_DASHBOARD.reglements.etat);
  state.reglementsClient = nom;
  state.reglementSelection = [];
  setTab('factures');
}

/* Un tableau de bord par métier.

   Les six rôles recevaient le même écran : un technicien, dont la navigation
   est réduite à sept onglets et à qui `voitLesPrix()` refuse tout montant,
   lisait « CA encaissé 386 843 € » et le classement des clients. Ce n'est ni
   son métier ni son affaire.

   Le pilotage — chiffre d'affaires, impayés, top clients — reste celui de
   l'administrateur, de la secrétaire et de la lecture seule : c'est
   exactement ce qu'ils ont à surveiller. */
function renderDashboard(){
  if(estSousTraitant()) return renderDashboardSousTraitant();
  if(state.currentRole === 'technicien') return renderDashboardTechnicien();
  if(state.currentRole === 'conducteur') return renderDashboardConducteur();
  const soc = state.societeId;
  const devis = state.devis.filter(d=>d.societeId===soc);
  const factures = state.factures.filter(f=>f.societeId===soc);
  const interventions = state.interventions.filter(i=>i.societeId===soc);
  const devisEnAttente = devis.filter(d=>d.statut==='envoyé');
  const devisEnAttenteMontant = devisEnAttente.reduce((s,d)=>s+computeDocTotals(d).ht,0);
  const impayees = factures.filter(f=>f.statut==='impayée');
  const enCours = interventions.filter(i=>i.statut==='en cours').length;
  const dateLabel = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  const activity = buildActivityFeed(soc);
  const summary = computeMonthSummary(soc);
  const traiter = computeDashTraiter(soc);
  const period = state.dashRevenuePeriod || '6m';
  const revenuePeriod = computeRevenuePeriod(factures, monthsForPeriod(period));
  const totalTraiter = traiter.enAttenteConducteur + traiter.aValiderDirecteur + traiter.aFacturer + traiter.rappelsAujourdhui + traiter.facturesEchues;
  return `
    <div class="dash-topbar">
      <div class="dash-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="globalSearchInput" value="${esc(state.globalSearch||'')}" placeholder="Rechercher (clients, devis, factures…)" oninput="onGlobalSearchInput(this.value)" onkeydown="globalSearchEnterCycle(event)">
      </div>
    </div>
    <div class="dash-greetrow">
      <div>
        <h1 class="dash-greeting">${esc(salutation())}</h1>
        <div class="dash-subtitle">Voici un aperçu de votre activité aujourd'hui</div>
      </div>
      <div class="dash-date-pill">${dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)}</div>
    </div>
    <div id="globalSearchResults">${state.globalSearch && state.globalSearch.trim() ? globalSearchResultsHTML(state.globalSearch) : ''}</div>
    <div id="dashboardNormalContent" style="display:${state.globalSearch && state.globalSearch.trim() ? 'none':''};">
    ${quickActionsHTML()}
    <div class="grid-stats grid-stats-4">
      <div class="stat-card success cliquable" role="button" tabindex="0" title="Voir les factures réglées ce mois" onclick="ouvrirDepuisDashboard('caEncaisse')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirDepuisDashboard('caEncaisse');}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--success-soft); color:var(--success);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.factures}</svg></span></div><div class="stat-label">CA encaissé ce mois (HT)</div><div class="stat-num stat-num-money">${moneyDisplay(summary.caMois)}</div></div>
      <div class="stat-card cliquable" role="button" tabindex="0" title="Voir les devis en attente de réponse" onclick="ouvrirDepuisDashboard('devisEnAttente')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirDepuisDashboard('devisEnAttente');}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--info-soft); color:var(--info);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.devis}</svg></span></div><div class="stat-label">Devis en attente</div><div class="stat-num">${devisEnAttente.length}</div><div class="stat-subamount">${moneyDisplay(devisEnAttenteMontant)} HT</div></div>
      <div class="stat-card ${impayees.length?'danger':''} cliquable" role="button" tabindex="0" title="Voir les factures impayées" onclick="ouvrirDepuisDashboard('impayees')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirDepuisDashboard('impayees');}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--danger-soft); color:var(--danger);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.factures}</svg></span></div><div class="stat-label">Factures impayées</div><div class="stat-num">${impayees.length}</div><div class="stat-subamount">${moneyDisplay(summary.impayeesMontant)} restant dû</div></div>
      <div class="stat-card ${traiter.aFacturer?'warn':''} cliquable" role="button" tabindex="0" title="Voir les bons de commande à facturer" onclick="ouvrirDepuisDashboard('aFacturer')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ouvrirDepuisDashboard('aFacturer');}"><div class="stat-card-top"><span class="stat-icon" style="background:var(--accent-soft); color:var(--accent-2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.bonsCommande}</svg></span></div><div class="stat-label">À facturer</div><div class="stat-num">${traiter.aFacturer}</div><div class="stat-subamount">${moneyDisplay(traiter.aFacturerMontant)} HT</div></div>
    </div>
    <div class="dash-workrow">
      <div class="dash-workcol-main">
        <div class="section-title-row"><span class="section-title" style="margin:0;">À traiter ${totalTraiter? `<span class="dossier-badge" style="margin-left:6px;">${totalTraiter}</span>`:''}</span></div>
        <div class="card traiter-card">
          ${totalTraiter===0? '<div class="empty">🎉 Rien à traiter — tout est à jour.</div>' : `
          ${traiter.enAttenteConducteur? `<div class="traiter-row" onclick="state.planningView='attente'; setTab('planning')"><span class="traiter-ico" style="background:var(--info-soft);">🦺</span><span class="traiter-label">Bons de commande à valider <b>(conducteur)</b></span><span class="traiter-count">${traiter.enAttenteConducteur}</span><span class="traiter-chev">›</span></div>`:''}
          ${traiter.aValiderDirecteur? `<div class="traiter-row" onclick="state.facturesView='validation'; setTab('factures')"><span class="traiter-ico" style="background:var(--accent-soft);">✍️</span><span class="traiter-label">Bons de commande à valider <b>(directeur)</b></span><span class="traiter-count">${traiter.aValiderDirecteur}</span><span class="traiter-chev">›</span></div>`:''}
          ${traiter.aFacturer? `<div class="traiter-row" onclick="state.facturesView='afacturer'; setTab('factures')"><span class="traiter-ico" style="background:var(--success-soft);">🧾</span><span class="traiter-label">Bons de commande à facturer</span><span class="traiter-count">${traiter.aFacturer}</span><span class="traiter-chev">›</span></div>`:''}
          ${traiter.rappelsAujourdhui? `<div class="traiter-row" onclick="setTab('planning')"><span class="traiter-ico" style="background:#EDE4FF;">🔄</span><span class="traiter-label">Locataires à rappeler</span><span class="traiter-count">${traiter.rappelsAujourdhui}</span><span class="traiter-chev">›</span></div>`:''}
          ${traiter.facturesEchues? `<div class="traiter-row" onclick="setTab('factures')"><span class="traiter-ico" style="background:var(--danger-soft);">⏰</span><span class="traiter-label">Factures échues à relancer</span><span class="traiter-count">${traiter.facturesEchues}</span><span class="traiter-chev">›</span></div>`:''}
          `}
        </div>
      </div>
    </div>
    <div class="dash-revenue-full">
      <div class="section-title-row" style="margin-top:0;">
        <span class="section-title" style="margin:0;">Chiffre d'affaires (HT)</span>
        <div class="dash-revenue-controls">
          <span class="dash-revenue-total">Total période : <b>${moneyDisplay(revenuePeriod.total)}</b></span>
          <select class="dash-period-select" onchange="setDashRevenuePeriod(this.value)">
            <option value="6m" ${period==='6m'?'selected':''}>6 mois</option>
            <option value="12m" ${period==='12m'?'selected':''}>12 mois</option>
            <option value="custom">Sélectionner les dates</option>
          </select>
        </div>
      </div>
      <div class="card dash-revenue-card">${renderYearlyComparisonSVG(revenuePeriod)}</div>
    </div>
    <div class="dash-columns3">
      <div class="dash-col">
        <div class="section-title-row"><span class="section-title" style="margin:0;">Activité récente</span></div>
        <div class="card activity-card">
          ${activity.length? activity.map(a=>`
            <div class="activity-row" ${a.goFn? `onclick="${a.goFn}" style="cursor:pointer;"`:''}>
              <span class="activity-icon ${a.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[a.icon]}</svg></span>
              <div class="activity-mid"><div class="activity-label">${esc(a.label)}</div><div class="activity-sub">${esc(a.sub)}</div></div>
              <div class="activity-right">${a.amount!=null? `<div class="activity-amount">${moneyDisplay(a.amount)}</div>`:''}<div class="activity-time">${relativeTime(a.date)}</div></div>
            </div>`).join('') : '<div class="empty">Aucune activité récente.</div>'}
        </div>
      </div>
      <div class="dash-col">
        <div class="section-title-row"><span class="section-title" style="margin:0;">Top clients (HT)</span></div>
        <div class="card activity-card topclient-card">
          ${renderTopClientsHTML(factures)}
        </div>
      </div>
      <div class="dash-col">
        <div class="section-title-row"><span class="section-title" style="margin:0;">Résumé du mois</span></div>
        <div class="card">
          <div class="summary-row cliquable" role="button" tabindex="0" title="Voir les factures réglées ce mois" onclick="ouvrirDepuisDashboard('caEncaisse')"><span>Chiffre d'affaires encaissé (HT)</span><b>${moneyDisplay(summary.caMois)}</b></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${summary.caMoisPct}%; background:var(--success);"></div></div>
          <div class="summary-row cliquable" style="margin-top:16px;" role="button" tabindex="0" title="Voir les devis" onclick="ouvrirDepuisDashboard('devisEnAttente')"><span>Taux de conversion devis</span><b>${summary.tauxConversion}%</b></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${summary.tauxConversion}%; background:var(--info);"></div></div>
          <div class="summary-row cliquable" style="margin-top:16px;" role="button" tabindex="0" title="Voir les règlements" onclick="ouvrirDepuisDashboard('reglements')"><span>Taux d'encaissement</span><b>${summary.tauxEncaisse}%</b></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${summary.tauxEncaisse}%; background:var(--accent);"></div></div>
        </div>
      </div>
    </div>
    </div>
  `;
}
/* Les montants dépendent des totaux et de la remise, calculés ici ; le reste
   du texte cherchable vient du module. */
function montantsCherchables(doc){
  const t = computeDocTotals(doc);
  return [money(t.ht), money(t.ttc), t.ht.toFixed(2), t.ttc.toFixed(2)];
}
function devisSearchHaystack(d){ return window.texteDocument(d, montantsCherchables(d)); }
function factureSearchHaystack(f){ return window.texteDocument(f, montantsCherchables(f)); }
function interventionSearchHaystack(i){
  const metierLabel = (METIERS.find(m=>m.value===i.typePanne)||{}).label || '';
  return window.texteDocument(i, [metierLabel]);
}
function bonCommandeSearchHaystack(b){
  const montant = parseFloat(b.montant) || 0;
  return window.texteDocument(b, [money(montant), montant.toFixed(2)]);
}
function globalSearchResultsList(q){
  const query = (q||'').trim().toLowerCase();
  if(!query) return [];
  const soc = state.societeId;
  const results = [];
  state.devis.filter(d=>d.societeId===soc).forEach(d=>{ if(window.multiWordMatch(devisSearchHaystack(d), query)) results.push({type:'devis', item:d}); });
  state.factures.filter(f=>f.societeId===soc).forEach(f=>{ if(window.multiWordMatch(factureSearchHaystack(f), query)) results.push({type:'facture', item:f}); });
  state.interventions.filter(i=>i.societeId===soc).forEach(i=>{ if(window.multiWordMatch(interventionSearchHaystack(i), query)) results.push({type:'intervention', item:i}); });
  return results;
}
function globalSearchResultsHTML(q){
  const results = globalSearchResultsList(q);
  if(!results.length) return '<div class="empty">Aucun résultat pour cette recherche.</div>';
  const typeLabels = {devis:'Devis', facture:'Facture', intervention:'Rapport'};
  const goFns = {devis:'goToDevis', facture:'goToFacture', intervention:'goToIntervention'};
  return `<div class="section-title">${results.length} résultat${results.length>1?'s':''}</div>` + results.map(r=>{
    const it = r.item;
    const t = (r.type==='intervention') ? null : computeDocTotals(it);
    return `<div class="card" id="global-result-${r.type}-${it.id}" style="cursor:pointer;" onclick="${goFns[r.type]}('${jsAttr(it.id)}')">
      <div class="card-row">
        <div><div class="card-title">${esc(it.client)}</div><div class="card-sub numref">${typeLabels[r.type]} · ${esc(it.numero||'')} · ${fmtDate(it.date)}</div></div>
        ${t? `<div class="amount">${moneyDisplay(t.ttc)}</div>` : `<span class="badge ${badgeClass(it.statut)}">${esc(it.statut)}</span>`}
      </div>
    </div>`;
  }).join('');
}
function globalSearchEnterCycle(ev){
  if(ev.key !== 'Enter') return;
  ev.preventDefault();
  const q = (ev.target.value||'').trim();
  const results = globalSearchResultsList(q);
  if(!results.length) return;
  const qKey = q.toLowerCase();
  if(!state.searchCycle || state.searchCycle.type !== 'global' || state.searchCycle.query !== qKey){
    state.searchCycle = {type:'global', query:qKey, index:0};
  } else {
    state.searchCycle.index = (state.searchCycle.index + 1) % results.length;
  }
  document.querySelectorAll('.search-focus').forEach(el=> el.classList.remove('search-focus'));
  const target = results[state.searchCycle.index];
  const el = document.getElementById(`global-result-${target.type}-${target.item.id}`);
  if(el){
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('search-focus');
  }
}
function onGlobalSearchInput(val){
  state.globalSearch = val;
  const resultsBox = document.getElementById('globalSearchResults');
  const normalBox = document.getElementById('dashboardNormalContent');
  const active = val && val.trim();
  if(resultsBox) resultsBox.innerHTML = active ? globalSearchResultsHTML(val) : '';
  if(normalBox) normalBox.style.display = active ? 'none' : '';
}
function quickActionsHTML(){
  return `<div class="quick-actions">
    <button class="quick-action" onclick="quickNew('interventions','intervention')">
      <span class="quick-icon" style="background:var(--info-soft); color:var(--info);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.interventions}</svg></span>
      <span class="quick-text"><b>Nouveau rapport</b><small>Rapport, contrôles, photos</small></span>
      <span class="quick-chevron">›</span>
    </button>
    <button class="quick-action" onclick="quickNew('devis','devis')">
      <span class="quick-icon" style="background:var(--success-soft); color:var(--success);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.devis}</svg></span>
      <span class="quick-text"><b>Nouveau devis</b><small>Créer un devis rapidement</small></span>
      <span class="quick-chevron">›</span>
    </button>
    <button class="quick-action" onclick="quickNew('factures','facture')">
      <span class="quick-icon" style="background:var(--accent-soft); color:var(--accent-2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.factures}</svg></span>
      <span class="quick-text"><b>Nouvelle facture</b><small>Facturer directement</small></span>
      <span class="quick-chevron">›</span>
    </button>
  </div>`;
}
function quickNew(tab, type){ setTab(tab); openForm(type); }

/* ---------- Formulaires génériques (ouverture / fermeture / lignes) ---------- */
function openForm(type, prefill){
  const base = {type:'ligne', designation:'',qte:1,unite:'u',prixUnitaire:0,tva: tvaDefaut()};
  state.editing = {type, id: prefill && prefill.id, lignes: (prefill && prefill.lignes && prefill.lignes.length ? prefill.lignes : [Object.assign({},base)]), ...(prefill||{})};
  if(type === 'bonCommande' && prefill && (prefill.travauxSupplementaires||[]).length){
    const designationsExistantes = new Set(state.editing.lignes.filter(l=>(l.type||'ligne')==='ligne').map(l=>l.designation));
    let ajoute = false;
    prefill.travauxSupplementaires.forEach(t=>{
      if(!designationsExistantes.has(t.texte)){
        if(!ajoute && state.editing.lignes.length===1 && !state.editing.lignes[0].designation && !state.editing.lignes[0].prixUnitaire){
          state.editing.lignes = [];
        }
        state.editing.lignes.push({type:'ligne', designation:t.texte, qte:1, prixUnitaire:0, tva: tvaDefaut()});
        ajoute = true;
      }
    });
    if(!state.editing.lignes.length) state.editing.lignes.push(Object.assign({},base));
  }
  if(type === 'intervention'){
    state.editing.step = 1;
    state.editing.controles = state.editing.controles || defaultControles();
    state.editing.photos = state.editing.photos || [];
    state.editing.rapport = state.editing.rapport || {constatations:'',preconisations:''};
    state.editing.signature = state.editing.signature || null;
    state.editing.heure = state.editing.heure || nowHeureFR();
  }
  Object.keys(state.formOpen).forEach(k=> state.formOpen[k] = false);
  state.formOpen[type] = true;
  pousserHistorique();
  if(!menuEpingle()) document.body.classList.add('sidebar-collapsed');
  renderTab();
  const zoneId = 'formZone' + type.charAt(0).toUpperCase() + type.slice(1);
  setTimeout(()=>{ const el = document.getElementById(zoneId); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); },50);
  /* Le cadre de facturation décide des blocs visibles : sans ce premier
     passage, la fiche s'ouvrirait avec tous les blocs affichés. */
  if(type === 'client') majSectionsEfacture();
  /* Les sept chemins de création posent `echeance:''` et aucun ne la remplissait :
     la fonction ne se déclenchait qu'au changement de client. Ici, une facture
     neuve repart toujours avec son échéance ; une facture déjà enregistrée porte
     une date sans `data-auto`, et reste intouchée. */
  if(type === 'facture') appliquerDelaiPaiement();
}
function closeForm(type){
  state.formOpen[type] = false;
  state.editing = {type:null,id:null,lignes:[]};
  pousserHistorique(true);
  renderTab();
}
/* Unités proposées à la saisie.
   Elles vivaient au bas de l'ancien écran Articles des Réglages et ont manqué
   de partir avec lui — or `ligneRow` s'en sert pour **toutes** les lignes de
   devis, de facture et de bon de commande. Elles sont désormais près de leur
   usage principal.

   `pièce` et `mm` sont arrivées avec le catalogue : l'export du logiciel de
   gestion emploie `PC` et `MM`, et sans elles on ne pouvait pas choisir à la
   main ce que l'import écrivait. */
const UNITES = ['u','pièce','h','forfait','m','m²','m³','ml','mm','jour'];
function uniteOptions(current){
  const opts = UNITES.slice();
  // Une unité héritée, absente de la liste, reste sélectionnable : sinon
  // rouvrir une vieille ligne la changerait sans le dire.
  if(current && !opts.includes(current)) opts.unshift(current);
  return opts.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');
}

function ligneRow(l,i){
  const hasComment = !!(l.commentaire && l.commentaire.trim());
  const isOpen = hasComment || state.ligneCommentOuvert===i;
  return `<tr class="dnd-row" ondragover="dragOverLigne(event)" ondrop="dropLigne(event, ${i})">
    <td><div class="row-mic">
      <span class="drag-handle" draggable="true" ondragstart="dragStartLigne(event, ${i})" title="Déplacer">⠿</span>
      <div style="position:relative; flex-shrink:0;">
        ${/* La référence était saisie puis perdue : le champ ne portait aucune
             valeur et rien ne la réaffichait au rechargement. Elle est
             désormais celle de la ligne, et elle s'enregistre avec. */''}
        <input type="text" class="art-pick" placeholder="Code…" autocomplete="off" title="Tapez un code ou un mot de la désignation"
          id="artCode-${i}" value="${esc(l.articleReference||'')}"
          oninput="searchArticleCode(this, ${i}); updateLigne(${i},'articleReference',this.value)"
          onkeydown="handleArticleCodeKeydown(event, ${i})"
          onblur="setTimeout(()=>{const b=document.getElementById('artSuggest-${jsAttr(i)}'); if(b) b.style.display='none';},180)">
        <div id="artSuggest-${i}" class="suggest-box"></div>
      </div>
      <input type="text" value="${esc(l.designation)}" oninput="updateLigne(${i},'designation',this.value)">
    </div></td>
    <td><input type="number" min="0" step="1" value="${l.qte}" style="width:60px;" oninput="updateLigne(${i},'qte',this.value)"></td>
    <td><select onchange="updateLigne(${i},'unite',this.value)">${uniteOptions(l.unite)}</select></td>
    <td><input type="number" min="0" step="0.01" value="${l.prixUnitaire}" style="width:90px;" oninput="updateLigne(${i},'prixUnitaire',this.value)"></td>
    <td><select onchange="updateLigne(${i},'tva',this.value)">${optionsTvaHTML(l.tva)}</select></td>
    <td class="num mono" id="ligneHT-${i}" style="white-space:nowrap; font-weight:600;">${money(window.montantLigneHt(l))}</td>
    <td class="num mono" id="ligneTTC-${i}" style="white-space:nowrap; color:var(--text-dim);">${money(window.montantLigneTtc(l))}</td>
    <td style="white-space:nowrap;">
      <button class="btn small ${hasComment?'primary':'ghost'}" onclick="toggleLigneComment(${i})" title="${hasComment?'Modifier le commentaire':'Ajouter un commentaire'}">💬</button>
      <button class="btn small danger" onclick="removeLigne(${i})">✕</button>
    </td>
  </tr>
  ${isOpen? `<tr class="row-ligne-comment"><td colspan="7">
      <textarea rows="2" placeholder="Commentaire (optionnel, plusieurs lignes possibles)…" oninput="updateLigne(${i},'commentaire',this.value)">${esc(l.commentaire)}</textarea>
    </td><td>${hasComment? `<button class="btn small ghost" onclick="updateLigne(${i},'commentaire',''); state.ligneCommentOuvert=null; refreshLignesUI();" title="Retirer le commentaire">✕</button>`:''}</td></tr>` : ''}`;
}
function toggleLigneComment(i){
  state.ligneCommentOuvert = state.ligneCommentOuvert===i ? null : i;
  refreshLignesUI();
}
/* ---------- Remplir une ligne depuis le catalogue ----------
   Le catalogue n'est plus en mémoire : chaque frappe interroge la base, une
   fois la main arrêtée. C'est ce qui permet de garder mille références sans
   les télécharger à chaque ouverture. */
let articleMatchesCache = {};
let articleMinuteur = {};
const DELAI_RECHERCHE_ARTICLE = 250;

/**
 * Recopie l'article dans la ligne. On **copie**, on ne lie pas : une
 * modification ultérieure du catalogue ne doit rien changer à un devis déjà
 * établi. La quantité n'est jamais touchée — c'est la seule valeur que
 * l'utilisateur a saisie lui-même.
 */
function applyArticleObjectToLigne(i, art){
  const ligne = state.editing.lignes[i] || {};
  state.editing.lignes[i] = Object.assign({}, ligne, {
    type: 'ligne',
    articleReference: art.code,
    designation: art.designation,
    // Une description ne remplace pas un commentaire déjà écrit à la main.
    commentaire: (ligne.commentaire && ligne.commentaire.trim()) ? ligne.commentaire : (art.description || ''),
    unite: art.unite || ligne.unite || 'u',
    prixUnitaire: art.prixUnitaire,
    tva: art.tva != null ? art.tva : tvaDefaut(),
  });
  refreshLignesUI();
}

function fermerSuggestionsArticle(i){
  const box = document.getElementById('artSuggest-'+i);
  if(box) box.style.display = 'none';
}

function searchArticleCode(inputEl, i){
  const q = inputEl.value.trim();
  const box = document.getElementById('artSuggest-'+i);
  if(!box) return;
  clearTimeout(articleMinuteur[i]);
  if(!q){ box.style.display = 'none'; articleMatchesCache[i] = []; return; }

  articleMinuteur[i] = setTimeout(async ()=>{
    let matches = [];
    try{
      matches = await window.chercherArticlesLigne(q);
    }catch(err){
      console.error('Recherche au catalogue impossible', err);
      box.innerHTML = '<div class="suggest-empty">Catalogue injoignable — saisie manuelle possible</div>';
      box.style.display = 'block';
      return;
    }
    articleMatchesCache[i] = matches;
    if(!matches.length){
      box.innerHTML = `<div class="suggest-empty">Aucun article — saisie manuelle possible<br><button type="button" class="btn small" style="margin-top:6px;" onmousedown="creerArticleDepuisLigne(${i})">+ Créer « ${esc(q)} » dans le catalogue</button></div>`;
      box.style.display = 'block';
      return;
    }
    box.innerHTML = matches.map((a,idx)=>`<div class="suggest-item" onmousedown="selectArticleMatch(${i}, ${idx})"><b>${esc(a.code)}</b><small>${esc(a.designation)} — ${money(a.prixUnitaire)}${a.unite? ' / '+esc(a.unite):''}</small></div>`).join('');
    box.style.display = 'block';
  }, DELAI_RECHERCHE_ARTICLE);
}

function selectArticleMatch(i, idx){
  const art = (articleMatchesCache[i] || [])[idx];
  fermerSuggestionsArticle(i);
  if(art) applyArticleObjectToLigne(i, art);
}

/* Entrée et Tab valident tous deux : on tape un code qu'on connaît, on passe
   au champ suivant, et la ligne doit être remplie — sans détour par la liste.
   Le code exact l'emporte sur la première proposition, qui pourrait n'être
   qu'une correspondance partielle. */
async function handleArticleCodeKeydown(ev, i){
  if(ev.key === 'Escape'){ fermerSuggestionsArticle(i); return; }
  if(ev.key !== 'Enter' && ev.key !== 'Tab') return;

  const saisi = (ev.target.value || '').trim();
  if(!saisi) return;
  if(ev.key === 'Enter') ev.preventDefault();
  clearTimeout(articleMinuteur[i]);

  try{
    const exact = await window.articleParCode(saisi);
    if(exact){ fermerSuggestionsArticle(i); applyArticleObjectToLigne(i, exact); return; }
  }catch(err){
    console.error('Article introuvable', err);
  }

  const matches = articleMatchesCache[i] || [];
  if(matches.length){ selectArticleMatch(i, 0); return; }
  // Référence inconnue : la ligne reste libre, on ne devine rien à sa place.
  fermerSuggestionsArticle(i);
}

/* La référence n'existe pas : plutôt que d'obliger à quitter le devis, on
   ouvre le catalogue sur un article pré-rempli de ce qui est déjà saisi. */
function creerArticleDepuisLigne(i){
  const ligne = state.editing.lignes[i] || {};
  const code = (document.getElementById('artCode-'+i)?.value || '').trim();
  fermerSuggestionsArticle(i);

  catalogueEtat().edition = {
    id: null,
    code,
    designation: ligne.designation || '',
    description: ligne.commentaire || '',
    unite: ligne.unite || 'u',
    prixUnitaire: parseFloat(ligne.prixUnitaire) || 0,
    prixAchat: null,
    tva: ligne.tva != null ? ligne.tva : tvaDefaut(),
    typeArticle: 'service',
    famille: '',
    actif: true,
    gereEnStock: false,
  };
  setTab('catalogue');
  showToast('Complétez la fiche puis enregistrez — vous reviendrez au document ensuite.');
}


/* Une liste déroulante écarte EN SILENCE une valeur qu'elle ne propose pas.
   Transformer un rapport en devis remplissait donc un champ Client vide dès
   que le client n'était plus au répertoire — supprimé, renommé, ou saisi
   avant sa fiche — et l'enregistrement effaçait le nom que le rapport
   portait. On garde la valeur reçue, en la signalant : c'est le motif déjà
   employé par `comptesLinkOptions` pour les comptes détachés. */
function optionConservee(current, connu, libelle){
  return (current && !connu)
    ? `<option value="${esc(current)}" selected>${esc(current)} ${libelle}</option>`
    : '';
}

function clientSelectOptions(current){
  const list = state.clients.filter(c=>c.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">— Sélectionner un client —</option>'
    + optionConservee(current, list.some(c=>c.nom===current), '— hors répertoire')
    + list.map(c=>`<option value="${esc(c.nom)}" ${c.nom===current?'selected':''}>${esc(c.nom)}</option>`).join('');
}
function bcSelectOptionsPourIntervention(clientNom, current){
  const list = state.bonsCommande.filter(b=>{
    if(b.societeId!==state.societeId) return false;
    if(clientNom && b.client!==clientNom) return false;
    return true;
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return '<option value="">— Aucun —</option>' + list.map(b=>`<option value="${b.id}" ${b.id===current?'selected':''}>${esc(b.numeroBC)}${b.client? ' — '+esc(b.client):''}</option>`).join('');
}
function interventionSelectOptionsPourBC(clientNom, current){
  const list = state.interventions.filter(i=>{
    if(i.societeId!==state.societeId) return false;
    if(clientNom && i.client!==clientNom) return false;
    if(i.id===current) return true;
    return !i.bonCommandeId;
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return '<option value="">— Aucun —</option>' + list.map(i=>`<option value="${i.id}" ${i.id===current?'selected':''}>${esc(i.numero)}${i.client? ' — '+esc(i.client):''}</option>`).join('');
}
function lienWidgetHTML(depuis, id, clientNom){
  const placeholder = depuis==='intervention' ? 'Rechercher un bon de commande : n°, adresse, n° logement…' : 'Rechercher un rapport : n°, adresse, n° logement…';
  return `<div onclick="event.stopPropagation()" style="position:relative;">
    <input type="text" id="lienSearch-${id}" placeholder="${placeholder}" autocomplete="off" style="width:100%;"
      oninput="searchLienCandidat('${jsAttr(depuis)}','${jsAttr(id)}','${jsAttr(clientNom||'')}',this.value)"
      onfocus="searchLienCandidat('${jsAttr(depuis)}','${jsAttr(id)}','${jsAttr(clientNom||'')}',this.value)"
      onblur="setTimeout(()=>{const b=document.getElementById('lienSuggest-${jsAttr(id)}'); if(b) b.style.display='none';},180)">
    <div id="lienSuggest-${id}" class="suggest-box"></div>
    <button class="btn small ghost" style="margin-top:4px;" onclick="toggleLienZone(null)">Annuler</button>
  </div>`;
}
let lienMatchesCache = {};
function candidatsLien(depuis, clientNom){
  if(depuis==='intervention'){
    return state.bonsCommande.filter(b=>b.societeId===state.societeId && (!clientNom || b.client===clientNom))
      .map(b=>({id:b.id, numero:b.numeroBC, client:b.client, adresse:withVille(b.adresse,b.codePostal,b.ville), numeroLogement:b.numeroLogement}));
  }
  return state.interventions.filter(i=>i.societeId===state.societeId && !i.bonCommandeId && (!clientNom || i.client===clientNom))
    .map(i=>({id:i.id, numero:i.numero, client:i.client, adresse:withVille(i.adresseLocataire||i.adresse,i.codePostal,i.ville), numeroLogement:i.numeroLogement}));
}
function searchLienCandidat(depuis, id, clientNom, valeur){
  const q = valeur.trim().toLowerCase();
  const box = document.getElementById('lienSuggest-'+id);
  if(!box) return;
  const tous = candidatsLien(depuis, clientNom);
  const matches = (q? tous.filter(c=> window.multiWordMatch([c.numero,c.client,c.adresse,c.numeroLogement].filter(Boolean).join(' ').toLowerCase(), q)) : tous).slice(0,8);
  lienMatchesCache[id] = matches;
  if(!matches.length){ box.innerHTML = '<div class="suggest-empty">Aucun résultat</div>'; box.style.display = 'block'; return; }
  box.innerHTML = matches.map((c,idx)=>`<div class="suggest-item" onmousedown="selectLienMatch('${jsAttr(depuis)}','${jsAttr(id)}',${idx})">
    <b>${esc(c.numero||'—')}</b><small>${esc(c.client||'')}${c.adresse? ' — '+esc(c.adresse):''}${c.numeroLogement? ' · N° '+esc(c.numeroLogement):''}</small>
  </div>`).join('');
  box.style.display = 'block';
}
function selectLienMatch(depuis, id, idx){
  const matches = lienMatchesCache[id] || [];
  const c = matches[idx];
  if(!c) return;
  confirmerLien(depuis, id, c.id);
}
function toggleLienZone(cle){
  state.lienOuvert = state.lienOuvert===cle ? null : cle;
  renderTab();
}
async function delierLien(interventionId){
  const it = state.interventions.find(x=>x.id===interventionId);
  if(!it) return;
  it.bonCommandeId = null;
  const r = await window.stSet('intervention:'+interventionId, it);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('intervention', 'bonCommande');
  renderTab();
  showToast('✂️ Lien retiré — vous pouvez maintenant lier à un autre document.', 'success', 2500);
}
async function confirmerLien(depuis, id, targetId){
  if(!targetId) return;
  const interventionId = depuis==='intervention' ? id : targetId;
  const bcId = depuis==='intervention' ? targetId : id;
  const it = state.interventions.find(x=>x.id===interventionId);
  if(!it) return;
  // Si un AUTRE rapport pointait déjà vers ce BC, retirer son lien pour éviter les doublons
  const ancien = state.interventions.find(x=>x.bonCommandeId===bcId && x.id!==interventionId);
  if(ancien){
    ancien.bonCommandeId = null;
    await window.stSet('intervention:'+ancien.id, ancien);
  }
  it.bonCommandeId = bcId;
  const r = await window.stSet('intervention:'+interventionId, it);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('intervention', 'bonCommande');
  state.lienOuvert = null;
  renderTab();
  showToast('🔗 Lié avec succès !', 'success', 2000);
}
function devisSelectOptions(clientNom, current, excludeBonCommandeId, interlocuteurNom){
  const list = state.devis.filter(d=>{
    if(d.societeId!==state.societeId) return false;
    if(clientNom && d.client!==clientNom) return false;
    if(interlocuteurNom && (d.interlocuteur||'')!==interlocuteurNom) return false;
    if(d.id===current) return true;
    const dejaLie = state.bonsCommande.some(b=>b.devisId===d.id && b.id!==excludeBonCommandeId);
    if(dejaLie) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return '<option value="">— Aucun —</option>' + list.map(d=>`<option value="${d.id}" ${d.id===current?'selected':''}>${esc(d.numero)}${d.client? ' — '+esc(d.client):''}</option>`).join('');
}
function refreshDevisLieSelect(){
  const selEl = document.getElementById('bc_devisId');
  const clientEl = document.getElementById('bc_client');
  const interlocuteurEl = document.getElementById('bc_interlocuteur');
  if(selEl) selEl.innerHTML = devisSelectOptions(clientEl? clientEl.value : '', '', state.editing.id, interlocuteurEl? interlocuteurEl.value : '');
}
function devisChapterTotals(devis){
  const totals = {};
  let currentChapter = null;
  (devis.lignes||[]).forEach(l=>{
    if(l.type === 'chapitre'){
      currentChapter = (l.designation||'').trim();
      if(currentChapter && !(currentChapter in totals)) totals[currentChapter] = 0;
    } else if(currentChapter){
      totals[currentChapter] += (parseFloat(l.qte)||0) * (parseFloat(l.prixUnitaire)||0);
    }
  });
  return totals;
}
function applyDevisMontant(devisId){
  if(!devisId){ return; }
  const devis = state.devis.find(d=>d.id===devisId);
  if(!devis) return;
  const t = computeDocTotals(devis);
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  const clientSelect = document.getElementById('bc_client');
  if(clientSelect && clientSelect.value !== devis.client){
    clientSelect.value = devis.client;
  }
  const interlocuteurSelect = document.getElementById('bc_interlocuteur');
  if(interlocuteurSelect) interlocuteurSelect.innerHTML = interlocuteurOptions(devis.client, devis.interlocuteur);
  setVal('bc_montant', t.ht.toFixed(2));
  if(document.querySelector('input[name="bc_metiers"]')) refreshBCMontantFields();
  setVal('bc_adresse', devis.adresseLocataire);
  setVal('bc_codePostal', devis.codePostal);
  setVal('bc_ville', devis.ville);
  setVal('bc_occupant', devis.occupant);
  setVal('bc_etage', devis.etage);
  setVal('bc_numeroLogement', devis.numeroLogement);
  setVal('bc_precisionCommune', devis.precisionCommune);
  setVal('bc_ancienLocataire', devis.ancienLocataire);
  const logementSelect = document.getElementById('bc_logementStatut');
  if(logementSelect){
    logementSelect.value = devis.logementStatut || '';
    toggleOccupantField(logementSelect, 'occupantFieldBC', 'communeFieldBC', 'vacantFieldBC', 'numeroFieldBC', 'etageFieldBC');
  }
  if(devis.lignes && devis.lignes.length){
    state.editing.lignes = JSON.parse(JSON.stringify(devis.lignes));
    const body = document.getElementById('lignesBody');
    if(body) body.innerHTML = ligneRowsHTML(state.editing.lignes);
    const zone = document.getElementById('bcLignesZone');
    if(zone) zone.style.display = 'block';
    const toggleBtn = document.querySelector('[onclick="toggleBCLignesZone()"]');
    if(toggleBtn) toggleBtn.textContent = '▲ Masquer';
    refreshRemiseUI();
    /* Les chapitres du devis viennent d'arriver : c'est maintenant qu'ils
       disent leur métier. `refreshBCMontantFields` plus haut a tourné sur les
       lignes d'avant la reprise — le bon héritait des travaux du devis sans
       hériter de ses métiers, et il fallait les recocher un à un. */
    appliquerMetiersDesChapitres();
  }
}
function metierSelectOptions(current){
  return '<option value="">— Non précisé —</option>' + METIERS.map(m=>`<option value="${m.value}" ${m.value===current?'selected':''}>${m.label}</option>`).join('');
}
function metierFilterOptions(current){
  return '<option value="">Tous les métiers</option>' + METIERS.map(m=>`<option value="${m.value}" ${m.value===current?'selected':''}>${m.label}</option>`).join('');
}
function metierLabel(value){
  return (METIERS.find(m=>m.value===value)||{}).label || '';
}
function metierDisplayLabel(value){
  if(!value) return '';
  return metierLabel(value) || value;
}
function metiersDisplayJoin(item){
  if(item.metiers && item.metiers.length) return item.metiers.map(m=>metierDisplayLabel(m)).join(', ');
  return metierDisplayLabel(item.metier);
}
function metierCouleur(value){
  if(!value) return '';
  const m = state.metiersPerso.find(x=>x.nom===value);
  return m ? m.couleur : '';
}
function interlocuteurOptions(clientNom, current){
  const client = state.clients.find(c=>c.societeId===state.societeId && c.nom===clientNom);
  const list = client ? state.interlocuteurs.filter(i=>i.clientId===client.id) : [];
  return '<option value="">— Aucun —</option>'
    + optionConservee(current, list.some(i=>i.nom===current), '— hors répertoire')
    + list.map(i=>`<option value="${esc(i.nom)}" ${i.nom===current?'selected':''}>${esc(i.nom)}${i.fonction? ' ('+esc(i.fonction)+')':''}</option>`).join('');
}
async function lookupVilleParCodePostal(cp, targetId){
  if(!cp || !/^\d{5}$/.test(cp)) return;
  try{
    const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`);
    if(!res.ok) return;
    const data = await res.json();
    if(data && data.length){
      const villeInput = document.getElementById(targetId);
      if(villeInput) villeInput.value = data[0].nom;
    }
  }catch(e){ console.error('Erreur recherche ville', e); }
}
function refreshInterlocuteurSelect(clientSelectEl, interlocuteurSelectId){
  const selEl = document.getElementById(interlocuteurSelectId);
  if(selEl) selEl.innerHTML = interlocuteurOptions(clientSelectEl.value, '');
}
function refreshBCLieSelectInter(clientNom){
  const selEl = document.getElementById('f_bonCommandeIdInter');
  if(selEl && !selEl.disabled){
    selEl.innerHTML = bcSelectOptionsPourIntervention(clientNom, '');
    setEditing('bonCommandeId', null);
  }
}
/** Le délai qui s'applique à ce client : le sien, sinon celui de la société. */
function delaiPaiementDuClient(nom){
  const c = state.clients.find(x=>x.societeId===state.societeId && x.nom===nom);
  return window.delaiPaiementRetenu(c, reglagesCourants().documents);
}

/**
 * Renseigne l'échéance d'après le délai du client.
 *
 * L'ancienne version lisait `client.delaiPaiement`, un champ qui n'a jamais
 * existé : le repli `30` en dur était toujours pris, et elle ne se déclenchait
 * qu'au changement de client — d'où 0 échéance sur 428 factures.
 *
 * `data-auto` distingue une échéance **calculée** d'une échéance **saisie**.
 * Sans lui, on ne peut que choisir entre ne jamais recalculer — le défaut
 * d'avant — et écraser une date tapée à la main.
 */
/** Le mode de règlement convenu avec ce client, pour amorcer la facture. */
function delaiModeDuClient(nom){
  const c = state.clients.find(x=>x.societeId===state.societeId && x.nom===nom);
  return window.modeReglementRetenu(c && c.modePaiement);
}

/**
 * Le délai que porte le formulaire de facture.
 *
 * La liste est la saisie ; le couple (jours, mode) est la donnée. « Conditions
 * du client » ne fige rien de plus que ce que le client dit aujourd'hui — c'est
 * le sens de la reprise à la création.
 */
function delaiFactureSaisi(){
  const sel = document.getElementById('f_delaiPreset');
  const cle = sel ? sel.value : '';
  if(cle && cle !== 'client'){
    const d = window.delaiDeLaCle(cle);
    if(d) return d;
  }
  const cl = document.getElementById('f_client');
  return delaiPaiementDuClient(cl ? cl.value : '');
}

function optionsDelaiFactureHTML(e){
  const courant = (e.delaiPaiementJours === null || e.delaiPaiementJours === undefined)
    ? null
    : { jours: Number(e.delaiPaiementJours), mode: e.delaiPaiementMode==='fin_de_mois'?'fin_de_mois':'net' };
  const p = courant ? window.delaiPreregle(courant) : null;
  const cle = p ? p.cle : (courant ? 'autre' : 'client');
  const sel = (c) => c===cle ? ' selected' : '';
  let html = `<option value="client"${sel('client')}>Conditions du client</option>`
    + window.DELAIS_PREREGLES.map(d=>`<option value="${d.cle}"${sel(d.cle)}>${esc(d.libelle)}</option>`).join('');
  /* Un délai hors liste — repris d'un client qui en portait un — doit rester
     lisible et se réenregistrer tel quel, pas se faire ramener à 30 jours. */
  if(cle === 'autre') html += `<option value="autre" selected>${esc(window.libelleDelaiPaiement(courant))}</option>`;
  return html;
}

/**
 * Changement de client : la facture reprend SES conditions.
 *
 * Seulement tant qu'elle n'est pas enregistrée — au-delà, les conditions sont
 * celles sous lesquelles elle a été émise et ne se réalignent plus sur un
 * client qui a changé d'avis. Le mode choisi à la main sur la facture est
 * respecté : on ne l'écrase que s'il n'a pas été touché.
 */
function reprendreConditionsDuClient(nom){
  const mode = document.getElementById('f_modePaiement');
  const preset = document.getElementById('f_delaiPreset');
  if(mode && (!preset || preset.value === 'client')) mode.value = window.modeReglementRetenu(delaiModeDuClient(nom));
  appliquerDelaiPaiement();
}

/** Choix du délai sur la facture : l'échéance suit aussitôt. */
function choisirDelaiFacture(){
  const ech = document.getElementById('f_echeance');
  if(ech) ech.dataset.auto = '1';
  appliquerDelaiPaiement();
}

function appliquerDelaiPaiement(){
  const ech = document.getElementById('f_echeance');
  if(!ech || (ech.value && ech.dataset.auto !== '1')) return;
  const dt = document.getElementById('f_date');
  const delai = delaiFactureSaisi();
  ech.value = window.dateEcheance((dt && dt.value) || todayISO(), delai);
  ech.dataset.auto = '1';
  const aide = document.getElementById('f_echeanceAide');
  if(aide){
    const hors = window.delaiHorsPlafond(delai);
    aide.textContent = window.libelleDelaiPaiement(delai) + (hors ? ' — ' + hors : '');
    aide.style.color = hors ? 'var(--danger)' : '';
  }
}

/* L'utilisateur reprend la main dès la première frappe, et la garde. */
function echeanceSaisieAlaMain(input){ input.dataset.auto = ''; }

/* …et peut revenir au calcul sans avoir à deviner la date. */
function recalculerEcheance(){
  const ech = document.getElementById('f_echeance');
  if(ech) ech.dataset.auto = '1';
  appliquerDelaiPaiement();
}

/* ---------- Conditions de paiement : la liste et la saisie libre ----------
   Le couple (jours, mode) reste seul enregistré. La liste ci-dessous nomme les
   combinaisons courantes ; en ajouter une se fait dans `DELAIS_PREREGLES`, pas
   ici, et un délai hors liste continue de s'afficher et de se saisir. */

/** Le délai du client correspond-il à une entrée de la liste ? */
function delaiEstPreregle(client){
  if(client.delaiPaiementJours === null || client.delaiPaiementJours === undefined) return true;
  return !!window.delaiPreregle({ jours: Number(client.delaiPaiementJours), mode: client.delaiPaiementMode==='fin_de_mois'?'fin_de_mois':'net' });
}

/** La clé de liste que porte ce client : un préréglage, la société, ou « autre ». */
function cleDelaiDuClient(client){
  if(client.delaiPaiementJours === null || client.delaiPaiementJours === undefined) return 'societe';
  const p = window.delaiPreregle({ jours: Number(client.delaiPaiementJours), mode: client.delaiPaiementMode==='fin_de_mois'?'fin_de_mois':'net' });
  return p ? p.cle : 'autre';
}

function optionsDelaiHTML(client){
  const courante = cleDelaiDuClient(client);
  const sel = (c) => c===courante ? ' selected' : '';
  const defaut = reglagesCourants().documents.delaiPaiementJours;
  return `<option value="societe"${sel('societe')}>Réglage de la société (${defaut} jours)</option>`
    + window.DELAIS_PREREGLES.map(d=>`<option value="${d.cle}"${sel(d.cle)}>${esc(d.libelle)}</option>`).join('')
    + `<option value="autre"${sel('autre')}>Autre — saisie libre…</option>`;
}

function optionsModeReglementHTML(courant){
  const retenu = window.modeReglementRetenu(courant);
  return window.MODES_REGLEMENT.map(m=>`<option value="${m.code}"${m.code===retenu?' selected':''}>${esc(m.libelle)}</option>`).join('');
}

/**
 * Choix dans la liste : les deux champs bruts suivent, et ne se montrent que
 * pour un délai hors liste. Ce sont eux que `saveClient` lit — la clé de liste
 * ne s'enregistre jamais, elle n'est qu'une façon de saisir.
 */
function choisirDelaiPreregle(){
  const cle = (document.getElementById('c_delaiPreset')||{}).value || 'societe';
  const jours = document.getElementById('c_delaiPaiementJours');
  const mode = document.getElementById('c_delaiPaiementMode');
  const libre = cle === 'autre';
  const zoneJours = document.getElementById('c_delaiLibreJours');
  const zoneMode = document.getElementById('c_delaiLibreMode');
  if(zoneJours) zoneJours.hidden = !libre;
  if(zoneMode) zoneMode.hidden = !libre;

  if(cle === 'societe'){ if(jours) jours.value = ''; if(mode) mode.value = 'net'; }
  else if(!libre){
    const d = window.delaiDeLaCle(cle);
    if(d){ if(jours) jours.value = String(d.jours); if(mode) mode.value = d.mode; }
  }
  majDelaiPaiementAide();
}

/** Dans la fiche client : ce que le délai saisi donnerait concrètement. */
function majDelaiPaiementAide(){
  const aide = document.getElementById('c_delaiPaiementAide');
  if(!aide) return;
  const brut = (document.getElementById('c_delaiPaiementJours')||{}).value;
  const mode = (document.getElementById('c_delaiPaiementMode')||{}).value || 'net';
  const delai = window.delaiPaiementRetenu(
    { delaiPaiementJours: String(brut||'').trim()==='' ? null : Number(brut), delaiPaiementMode: mode },
    reglagesCourants().documents
  );
  const exemple = window.dateEcheance(todayISO(), delai);
  const hors = window.delaiHorsPlafond(delai);
  aide.textContent = `${window.libelleDelaiPaiement(delai)} — une facture d'aujourd'hui serait due le ${fmtDate(exemple)}.`
    + (hors ? ' ' + hors : '');
  aide.style.color = hors ? 'var(--danger)' : '';
}
function bcNumeroDepuisId(bonCommandeId){
  const b = state.bonsCommande.find(x=>x.id===bonCommandeId);
  return b ? (b.numeroBC||'') : '';
}
function resolveClientAdresse(nom){
  const c = state.clients.find(x=>x.societeId===state.societeId && x.nom===nom);
  return c ? (c.adresse||'') : '';
}
function logementLabel(statut){
  if(statut === 'occupé') return 'Logement occupé';
  if(statut === 'vacant') return 'Logement vacant';
  if(statut === 'commune') return 'Partie commune';
  return '';
}

function logementOptions(current){
  return [['','Non précisé'],['occupé','Logement occupé'],['vacant','Logement vacant'],['commune','Partie commune']].map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('');
}
function logementBadge(statut){
  const label = logementLabel(statut);
  if(!label) return '';
  const cls = statut==='occupé' ? 'warn' : statut==='vacant' ? 'success' : 'info';
  return `<span class="badge ${cls}">${label}</span>`;
}
function withVille(adresse, cp, ville){
  const cpVille = [cp, ville].filter(Boolean).join(' ');
  return [adresse, cpVille].filter(Boolean).join(', ');
}
function locataireCardLine(item){
  const numero = item.numeroLogement? ' · Log '+esc(item.numeroLogement) : '';
  const adresseComplete = withVille(item.adresseLocataire, item.codePostal, item.ville);
  if(item.precisionCommune) return `<div class="card-sub">Partie commune : ${esc(item.precisionCommune)}${adresseComplete? ' — '+esc(adresseComplete):''}</div>`;
  if(item.ancienLocataire) return `<div class="card-sub">Ancien locataire${numero} : ${esc(item.ancienLocataire)}${adresseComplete? ' — '+esc(adresseComplete):''}</div>`;
  if(item.adresseLocataire || item.occupant || item.numeroLogement){
    let line = 'Locataire' + numero;
    if(item.occupant) line += ' : ' + esc(item.occupant);
    if(adresseComplete) line += (item.occupant? ' — ' : ' : ') + esc(adresseComplete);
    return `<div class="card-sub">${line}</div>`;
  }
  return '';
}
/**
 * Le métier d'un chapitre, tel qu'il se montre et se corrige.
 *
 * Tant que personne n'a tranché, il est **lu** sur le titre et paraît en
 * retrait : une déduction fausse doit se voir avant d'engager une venue
 * d'équipe, puisqu'une tâche vaut bon × métier × jour. Dès qu'on choisit, il
 * s'affirme — et le titre ne le défait plus.
 *
 * Le select tient dans la même cellule que le titre, et non dans la colonne
 * libre à droite : celle-ci est sous l'en-tête « Total TTC », ce qui
 * l'étiquetterait faussement pour qui lit le tableau autrement qu'à l'œil.
 */
function chapitreMetierHTML(l, i){
  const vu = window.metierAffiche
    ? window.metierAffiche(l, metiersDisponibles())
    : { valeur: '', devine: true, certitude: null };
  const classes = ['chapitre-metier'];
  if(vu.devine) classes.push('est-deduit');
  if(vu.certitude === 'approchant') classes.push('est-approchant');
  const titre = vu.devine
    ? (vu.valeur
        ? `Lu sur le titre du chapitre — choisissez pour le figer`
        : `Aucun métier reconnu dans ce titre`)
    : 'Métier choisi pour ce chapitre';
  return `<select class="${classes.join(' ')}" title="${esc(titre)}" onchange="updateLigne(${i},'metier',this.value,this)">${metierChapitreOptions(vu.valeur)}</select>`;
}
function chapitreRow(l,i,total){
  return `<tr class="row-chapitre dnd-row" ondragover="dragOverLigne(event)" ondrop="dropLigne(event, ${i})">
    <td colspan="5"><div class="row-mic"><span class="drag-handle" draggable="true" ondragstart="dragStartLigne(event, ${i})" title="Déplacer">⠿</span><input type="text" class="chapitre-input" value="${esc(l.designation)}" placeholder="Titre du chapitre (ex. Plomberie, Main d'œuvre…)" oninput="updateLigne(${i},'designation',this.value)">${chapitreMetierHTML(l, i)}</div></td>
    <td class="mono" id="chapTotal-${i}" style="text-align:right; font-weight:700; white-space:nowrap;">${total!=null? money(total)+' HT' : ''}</td>
    <td></td>
    <td><button class="btn small danger" onclick="removeLigne(${i})">✕</button></td>
  </tr>`;
}
function commentaireRow(l,i){
  return `<tr class="row-commentaire dnd-row" ondragover="dragOverLigne(event)" ondrop="dropLigne(event, ${i})">
    <td colspan="7"><div class="row-mic"><span class="drag-handle" draggable="true" ondragstart="dragStartLigne(event, ${i})" title="Déplacer">⠿</span><textarea class="commentaire-input" rows="2" oninput="updateLigne(${i},'designation',this.value)" placeholder="Commentaire / remarque (non chiffré)">${esc(l.designation)}</textarea></div></td>
    <td><button class="btn small danger" onclick="removeLigne(${i})">✕</button></td>
  </tr>`;
}
function ligneRowsHTML(lignes){
  const chapterTotals = computeChapterSubtotals(lignes);
  let html = '', running = 0, chapIdx = -1;
  lignes.forEach((l,i)=>{
    const t = l.type || 'ligne';
    if(t === 'chapitre'){
      chapIdx++;
      html += chapitreRow(l,i,chapterTotals[chapIdx]);
    } else if(t === 'commentaire'){
      html += commentaireRow(l,i);
    } else {
      html += ligneRow(l,i);
    }
  });
  return html;
}
function computeChapterSubtotals(lignes){
  return window.sousTotauxChapitres(lignes);
}
/* La TVA se détaille par taux dès qu'il y en a plus d'un — l'art. 242 nonies A
   ann. II du CGI demande, par taux, le total hors taxe et la taxe
   correspondante. À un seul taux, on ne déroule rien : on le met dans le
   libellé, ce qui porte la même information sans alourdir une facture simple.
   Un taux à 0 % apparaît s'il porte une base : c'est l'autoliquidation. */
function tvaLignesHTML(t, rendu){
  const v = t.ventilation || [];
  if(v.length > 1){
    return v.map(p => rendu(`TVA ${window.formaterTaux(p.taux)} sur ${money(p.base)}`, p.montant)).join('')
         + rendu('Total TVA', t.tva);
  }
  return rendu(v.length ? `TVA ${window.formaterTaux(v[0].taux)}` : 'TVA', t.tva);
}
function totalsBoxInnerHTML(t){
  const rendu = (libelle, montant) => `<div>${libelle} <b>${money(montant)}</b></div>`;
  const remise = t.remisePct > 0
    ? `<div>Remise (${t.remisePct}%) <b>-${money(t.remiseMontantHT)}</b></div><div>Total HT net <b>${money(t.ht)}</b></div>`
    : '';
  return `<div>Total HT <b>${money(t.htAvant)}</b></div>${remise}`
       + tvaLignesHTML(t, rendu)
       + `<div>Total TTC <b>${money(t.ttc)}</b></div>`;
}
function remiseAndTotalsHTML(lignes, remisePct){
  const t = computeTotalsAvecRemise(lignes, remisePct);
  return `
    <div class="totals-box" id="totalsBoxContent">${totalsBoxInnerHTML(t)}</div>
    <div class="remise-box" style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">
      <div class="section-title" style="margin-top:0;">Remise</div>
      <div class="field-grid">
        <div class="field"><label>Taux de remise (%)</label><input type="number" step="0.01" min="0" max="100" id="f_remisePct" value="${t.remisePct||''}" placeholder="Ex : 10" oninput="onRemisePctInput(this.value)"></div>
        <div class="field"><label>Montant HT après remise</label><input type="number" step="0.01" id="f_remiseHT" value="${t.remisePct>0? t.ht.toFixed(2):''}" placeholder="Ex : 500" oninput="onRemiseMontantInput(this.value,'ht')"></div>
        <div class="field"><label>Montant TTC après remise</label><input type="number" step="0.01" id="f_remiseTTC" value="${t.remisePct>0? t.ttc.toFixed(2):''}" placeholder="Ex : 550" oninput="onRemiseMontantInput(this.value,'ttc')"></div>
      </div>
    </div>`;
}
function refreshRemiseUI(){
  const t = computeTotalsAvecRemise(state.editing.lignes, state.editing.remisePourcentage);
  const box = document.getElementById('totalsBoxContent');
  if(box) box.innerHTML = totalsBoxInnerHTML(t);
  const bcBox = document.getElementById('bcTotalsBoxContent');
  if(bcBox) bcBox.innerHTML = totalsBoxInnerHTML(t);
  const pctInput = document.getElementById('f_remisePct');
  if(pctInput && document.activeElement !== pctInput) pctInput.value = t.remisePct || '';
  const htInput = document.getElementById('f_remiseHT');
  if(htInput && document.activeElement !== htInput) htInput.value = t.remisePct>0 ? t.ht.toFixed(2) : '';
  const ttcInput = document.getElementById('f_remiseTTC');
  if(ttcInput && document.activeElement !== ttcInput) ttcInput.value = t.remisePct>0 ? t.ttc.toFixed(2) : '';
}
function onRemisePctInput(val){
  const pct = parseFloat(val);
  state.editing.remisePourcentage = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
  refreshRemiseUI();
}
function onRemiseMontantInput(val, kind){
  const target = parseFloat(val);
  if(isNaN(target)) return;
  const base = computeTotals(state.editing.lignes);
  let pct = 0;
  if(kind === 'ht' && base.ht > 0) pct = (1 - target/base.ht) * 100;
  if(kind === 'ttc' && base.ttc > 0) pct = (1 - target/base.ttc) * 100;
  state.editing.remisePourcentage = Math.max(0, Math.min(100, Math.round(pct*100)/100));
  refreshRemiseUI();
}
/* On n'écrit que du texte : reconstruire les <tr> ferait perdre le focus et
   sauter le curseur à chaque caractère.

   L'ancienne version interrogeait `.row-subtotal`, une classe que `ligneRowsHTML`
   n'émet nulle part — seul le CSS la connaît. Les sous-totaux de chapitre
   restaient donc figés dès qu'on touchait une quantité. */
function refreshTotalsOnly(){
  refreshRemiseUI();
  const sums = computeChapterSubtotals(state.editing.lignes);
  let chapIdx = -1;
  (state.editing.lignes||[]).forEach((l, i)=>{
    if((l.type||'ligne') === 'chapitre'){
      chapIdx++;
      const c = document.querySelector('#lignesBody #chapTotal-'+i);
      if(c) c.textContent = sums[chapIdx] != null ? money(sums[chapIdx])+' HT' : '';
      return;
    }
    const ht = document.querySelector('#lignesBody #ligneHT-'+i);
    if(ht) ht.textContent = money(window.montantLigneHt(l));
    const ttc = document.querySelector('#lignesBody #ligneTTC-'+i);
    if(ttc) ttc.textContent = money(window.montantLigneTtc(l));
  });
}
function refreshLignesUI(){
  const body = document.getElementById('lignesBody');
  if(body) body.innerHTML = ligneRowsHTML(state.editing.lignes);
  refreshRemiseUI();
  appliquerMetiersDesChapitres();
}

/**
 * Les métiers se lisent sur les chapitres du bon, au lieu de se cocher.
 *
 * Ne s'exécute que dans le formulaire de bon de commande — la zone n'existe pas
 * ailleurs. C'est la garde qui empêche les 830 bons déjà en base de se voir
 * attribuer des métiers, et leur planning de se scinder, à la simple ouverture :
 * la déduction n'a lieu qu'à la saisie.
 *
 * Elle **ajoute** et ne retire jamais : un métier coché à la main survit à
 * toute relecture des chapitres.
 */
function appliquerMetiersDesChapitres(options){
  const silencieux = !!(options && options.silencieux);
  const zone = document.getElementById('bc_metiersZone');
  if(!zone || !window.metiersDesChapitres) return [];

  const lu = window.metiersDesChapitres(state.editing.lignes, metiersDisponibles());
  const dejaCoches = getCheckedMetiers('bc');
  const retenus = [...dejaCoches];
  for(const m of lu.metiers){
    if(!retenus.some(c=>window.memeMetier(c, m))) retenus.push(m);
  }

  const avant = dejaCoches.length;
  zone.innerHTML = bcMetiersZoneHTML(retenus, lu.origines, retenus.length - avant);

  /* Passer de un à deux métiers scinde la carte du planning en une par métier,
     chacune avec sa date, son équipe et son montant. Mieux vaut le dire ici que
     le laisser découvrir au planning. */
  /* `showToast` n'en garde qu'un à la fois : quand la lecture automatique parle
     juste après, elle écraserait celui-ci. Elle demande donc le silence et dit
     les deux choses en un seul message. */
  if(!silencieux && avant <= 1 && retenus.length > 1){
    showToast(`${retenus.length} métiers lus sur les chapitres — le bon se planifiera en ${retenus.length} interventions.`, 'success', 5000);
  }
  refreshBCMontantFields();
  return retenus;
}
function bcLignesOntDuContenu(lignes){
  return (lignes||[]).some(l=>(l.type||'ligne')==='ligne' && (l.designation || (parseFloat(l.prixUnitaire)||0)>0));
}
function toggleBCLignesZone(){
  const zone = document.getElementById('bcLignesZone');
  if(!zone) return;
  const ouverte = zone.style.display !== 'none';
  zone.style.display = ouverte ? 'none' : 'block';
}
function addLigne(){ state.editing.lignes.push({type:'ligne', designation:'',qte:1,unite:'u',prixUnitaire:0,tva: tvaDefaut()}); refreshLignesUI(); }
/* Pas de `metier` dans ce littéral, et ce n'est pas un oubli : l'absence de la
   clé **est** l'état « à déduire du titre ». L'y ajouter par symétrie avec les
   autres champs figerait un choix vide et la présélection ne parlerait plus. */
function addChapitre(){ state.editing.lignes.push({type:'chapitre', designation:'',qte:0,prixUnitaire:0,tva:0}); refreshLignesUI(); }
function addCommentaire(){ state.editing.lignes.push({type:'commentaire', designation:'',qte:0,prixUnitaire:0,tva:0}); refreshLignesUI(); }
function removeLigne(i){ state.editing.lignes.splice(i,1); if(!state.editing.lignes.length) state.editing.lignes.push({type:'ligne', designation:'',qte:1,unite:'u',prixUnitaire:0,tva: tvaDefaut()}); refreshLignesUI(); }
let draggedLigneIndex = null;
/* Le glisser-déposer des lignes sert deux tableaux : celui des documents —
   devis, facture, bon de commande — et celui de la pré-facture. Une seule
   implémentation, paramétrée par le tableau qu'elle réordonne et le conteneur
   où elle dessine le repère. Deux copies finiraient par diverger, comme la
   comparaison des métiers l'a déjà fait. */
const ZONES_DND = {
  document: {
    conteneur: '#lignesBody',
    lignes: ()=> state.editing && state.editing.lignes,
    apres: ()=> refreshLignesUI(),
  },
  prefacture: {
    conteneur: '#validationDirecteurLignes',
    lignes: ()=> validationDirecteurCtx && validationDirecteurCtx.lignes,
    apres: ()=> renderValidationDirecteur(),
  },
};

/** La zone d'où part le glisser : on ne dépose pas d'un tableau dans l'autre. */
let zoneDndCourante = null;
/** Le travail supplémentaire en cours de glisser, s'il y en a un. */
let travailGlisse = null;

function dragStartTravail(ev, id){
  travailGlisse = id;
  draggedLigneIndex = null;
  zoneDndCourante = 'travail';
  ev.dataTransfer.effectAllowed = 'move';
  try{ ev.dataTransfer.setData('text/plain', id); }catch(e){}
}

/**
 * Un travail constaté devient une ligne du bon, à l'endroit où on le dépose.
 *
 * Il n'est pas supprimé mais passé à `integre` : ni `bc_generer_facture`, qui
 * ne reprend que `chiffre`, ni `bc_chiffrage_valide`, qui ne compte que
 * `a_chiffrer`, ne le verront plus. Le supprimer laisserait une fenêtre où la
 * ligne existe déjà et le travail aussi — une interruption entre les deux
 * écritures ferait facturer deux fois.
 */
function integrerTravailDansLignes(id, insertPos){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  const i = ctx.travaux.findIndex(t=>t.id===id);
  if(i < 0) return;
  const t = ctx.travaux[i];

  ctx.lignes.splice(insertPos, 0, {
    type:'ligne',
    designation: t.libelle || '',
    qte: t.quantite != null ? Number(t.quantite) : 1,
    unite: t.unite || 'u',
    prixUnitaire: Number(t.prix_vente_ht) || 0,
    tva: Number(t.tva) || tvaDefaut(),
  });
  ctx.travaux.splice(i, 1);
  // Enregistré au même moment que les lignes, jamais avant.
  ctx.travauxIntegres = (ctx.travauxIntegres || []).concat(id);
  renderValidationDirecteur();
  showToast('Travail repris comme ligne du bon — enregistrez pour le conserver.', 'success', 5000);
}

function dragStartLigne(ev, i, zone){
  draggedLigneIndex = i;
  zoneDndCourante = zone || 'document';
  ev.dataTransfer.effectAllowed = 'move';
  try{ ev.dataTransfer.setData('text/plain', String(i)); }catch(e){}
}

function reperesDnd(zone){
  const sel = (ZONES_DND[zone] || ZONES_DND.document).conteneur;
  return document.querySelectorAll(sel + ' tr.drag-over-top, ' + sel + ' tr.drag-over-bottom');
}

function dragOverLigne(ev, zone){
  const z = zone || 'document';
  const travailVersLignes = zoneDndCourante === 'travail' && z === 'prefacture';
  if(zoneDndCourante && zoneDndCourante !== z && !travailVersLignes) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
  const row = ev.currentTarget;
  const rect = row.getBoundingClientRect();
  const before = (ev.clientY - rect.top) < rect.height/2;
  reperesDnd(z).forEach(r=>{
    if(r!==row){ r.classList.remove('drag-over-top','drag-over-bottom'); }
  });
  row.classList.toggle('drag-over-top', before);
  row.classList.toggle('drag-over-bottom', !before);
}

function dropLigne(ev, targetIndex, zone){
  const z = zone || 'document';
  ev.preventDefault();
  const row = ev.currentTarget;
  reperesDnd(z).forEach(r=>r.classList.remove('drag-over-top','drag-over-bottom'));
  /* Un travail supplémentaire déposé parmi les lignes les rejoint : c'est le
     seul franchissement de zone autorisé, et il va dans ce sens-là seulement. */
  if(zoneDndCourante === 'travail' && z === 'prefacture' && travailGlisse){
    const rectT = row.getBoundingClientRect();
    const avant = (ev.clientY - rectT.top) < rectT.height/2;
    const id = travailGlisse;
    travailGlisse = null; zoneDndCourante = null; draggedLigneIndex = null;
    integrerTravailDansLignes(id, avant ? targetIndex : targetIndex + 1);
    return;
  }
  if(draggedLigneIndex === null || zoneDndCourante !== z){ draggedLigneIndex = null; return; }
  const rect = row.getBoundingClientRect();
  const before = (ev.clientY - rect.top) < rect.height/2;
  if(draggedLigneIndex === targetIndex){ draggedLigneIndex = null; return; }
  let insertPos = before ? targetIndex : targetIndex + 1;
  if(draggedLigneIndex < insertPos) insertPos -= 1;
  const zoneDef = ZONES_DND[z] || ZONES_DND.document;
  const lignes = zoneDef.lignes();
  if(!lignes){ draggedLigneIndex = null; return; }
  const [moved] = lignes.splice(draggedLigneIndex, 1);
  lignes.splice(insertPos, 0, moved);
  draggedLigneIndex = null;
  zoneDndCourante = null;
  zoneDef.apres();
}
function updateLigne(i,field,val,el){
  /* `articleReference` manquait à cette liste : son code partait donc dans le
     `parseFloat` de la branche numérique, et « PLB-001 » devenait 0 à la
     frappe. Le champ se ressaisissait, s'affichait, et se vidait au premier
     caractère. `metier` tomberait dans le même piège — « PEINTURE » vaudrait 0. */
  const texteFields = field==='designation' || field==='commentaire' || field==='unite'
    || field==='articleReference' || field==='metier';

  if(field==='metier'){
    /* « — Déduit du titre — » n'est pas un métier vide : c'est le retrait du
       choix. On efface la clé, faute de quoi la ligne porterait une valeur que
       la base ne distingue pas d'un `NULL` — et la déduction, elle, ne
       reprendrait jamais la main. */
    if(val === '') delete state.editing.lignes[i].metier;
    else state.editing.lignes[i].metier = val;
    /* Le style dit d'où vient la valeur : déduite, ou tranchée. On le retouche
       en place — reconstruire le tableau refermerait la liste déroulante que
       l'utilisateur vient d'utiliser. */
    if(el){
      el.classList.toggle('est-deduit', val === '');
      if(val !== '') el.classList.remove('est-approchant');
    }
    appliquerMetiersDesChapitres();
    return;
  }

  state.editing.lignes[i][field] = texteFields ? val : (parseFloat(val)||0);
  if(texteFields){
    /* Le titre d'un chapitre porte le métier : le relire à la frappe évite de
       le faire cocher. On ne redessine que la zone des métiers — refaire le
       tableau des lignes ferait perdre le focus à chaque caractère. */
    if(field==='designation' && (state.editing.lignes[i].type||'ligne')==='chapitre'){
      appliquerMetiersDesChapitres();
    }
    return;
  }
  refreshTotalsOnly();
}

async function editItem(type, id){
  const item = state[arrKeyFor(type)].find(x=>x.id===id);
  if(!item) return;
  const clone = JSON.parse(JSON.stringify(item));
  openForm(type, clone);
}
function cardRowClick(ev, type, id){
  if(ev.target.closest('button, a, input, select, textarea')) return;
  if(type === 'intervention'){
    openViewIntervention(id);
  } else {
    openViewDoc(type, id);
  }
}
async function rechargerType(type){
  if(COLLECTIONS_ETAT[type]) await recharger(type);
  else await loadAll();
}
async function deleteItem(type, id){
  if(!confirm('Supprimer définitivement cet élément ?')) return;
  /* Les tables filles partent en cascade avec le salarié, mais pas les
     fichiers du bucket : sans ce passage, le stockage garderait les contrats
     et les attestations médicales de gens qui ne sont plus dans la base —
     précisément ce qu'on ne doit pas garder. */
  if(type === 'salarie'){
    try{ await window.purgerDocumentsRh(id); }
    catch(err){ console.error('Dossier documentaire non purgé', id, err); }
    try{ await window.purgerVisitesMedicales(id); }
    catch(err){ console.error('Attestations médicales non purgées', id, err); }
  }
  let factureIdToSync = null;
  if(type === 'reglement'){
    const reg = state.reglements.find(r=>r.id===id);
    if(reg) factureIdToSync = reg.factureId;
  }
  await window.stDelete(type+':'+id);
  await rechargerType(type);
  if(type === 'salarie') await Promise.all([chargerDossiersRh(true), chargerVisitesRh(true)]);
  /* syncFactureStatut recharge les factures de son côté. */
  if(factureIdToSync) await syncFactureStatut(factureIdToSync);
  renderTab();
}
async function updateStatut(type, id, newStatut){
  const item = state[arrKeyFor(type)].find(x=>x.id===id);
  if(!item) return;
  item.statut = newStatut;
  await window.stSet(type+':'+id, item);
  await rechargerType(type);
  renderTab();
}
function printItem(){ window.print(); }
function sousTotalChapitreHTML(total, fmt){
  return `<tr class="p-subtotal"><td colspan="5">Sous-total HT du chapitre</td><td class="num">${fmt(total)}</td><td></td></tr>`;
}
function printableLignesRows(lignes, hidePrices){
  const fmt = hidePrices ? (()=>'•••') : money;
  const hasChap = (lignes||[]).some(l=>(l.type||'ligne')==='chapitre');
  let html = '', running = 0, sawChap = false;
  (lignes||[]).forEach(l=>{
    const t = l.type || 'ligne';
    // `classe` et `badge` marquent ce qui a été ajouté en cours de chantier
    const cls = l.classe ? ' '+esc(l.classe) : '';
    const badge = l.badge ? `<span class="p-badge-origine">${esc(l.badge)}</span> ` : '';
    if(t === 'chapitre'){
      if(sawChap && hasChap) html += sousTotalChapitreHTML(running, fmt);
      running = 0; sawChap = true;
      html += `<tr class="p-chapitre${cls}"><td colspan="7">${esc(l.designation)}</td></tr>`;
    } else if(t === 'commentaire'){
      html += `<tr class="p-comment${cls}"><td colspan="7">${badge}${esc(l.designation)}</td></tr>`;
    } else {
      /* Même arithmétique que l'écran, empruntée à la règle plutôt que refaite :
         deux formules pour un seul montant finissent par diverger d'un centime. */
      const lht = window.montantLigneHt(l);
      running += lht;
      const sansPrix = !(parseFloat(l.prixUnitaire) > 0) ? ' p-sans-prix' : '';
      html += `<tr class="${(cls+sansPrix).trim()}"><td>${badge}${esc(l.designation)}</td><td class="num">${l.qte}</td><td class="num">${esc(l.unite||'u')}</td><td class="num">${fmt(l.prixUnitaire)}</td><td class="num">${l.tva}%</td><td class="num">${fmt(lht)}</td><td class="num">${fmt(window.montantLigneTtc(l))}</td></tr>`;
    }
  });
  if(sawChap && hasChap) html += sousTotalChapitreHTML(running, fmt);
  return html;
}
function renderPrintIntervention(it){
  if(!it) return '<p>Rapport introuvable.</p>';
  const s = state.settings[state.societeId] || {};
  const socName = societeName(state.societeId);
  const items = CONTROLES_PAR_METIER[it.typePanne] || [];
  const controlesCoches = items.filter(c=> it.controles && it.controles[c.key]).map(c=> (c.key==='autre' && it.controleAutreTexte) ? `${c.label} : ${it.controleAutreTexte}` : c.label);
  const r = it.rapport || {};
  const noOccupant = (it.logementStatut === 'vacant' || it.logementStatut === 'commune');
  return `
    <table class="p-header"><tr>
      <td style="width:55%;">
        ${logoHTML(s)}
        <div class="p-doctitle">RAPPORT D'INTERVENTION</div>
      </td>
      <td style="width:45%;">
        <div class="p-docmeta" style="display:flex; justify-content:space-between; gap:10mm;"><span>N° <b>${esc(it.numero||'—')}</b></span><span>${fmtDate(it.date)}${it.heure? ' à '+esc(it.heure):''}</span></div>
        ${it.bonCommandeId? `<div class="p-docmeta" style="text-align:right; margin-top:2px;">BC n° <b>${esc(bcNumeroDepuisId(it.bonCommandeId))}</b></div>`:''}
      </td>
    </tr></table>
    <div class="p-rule"></div>
    <table class="p-parties"><tr>
      <td>
        <div class="p-label">Client</div>
        <div class="p-name">${esc(it.client)}</div>
        ${it.interlocuteur? `<div class="p-line">À l'attention de ${esc(it.interlocuteur)}</div>`:''}
        <div class="p-line">${esc(it.adresse)}</div>
      </td>
      <td>
        ${(it.adresseLocataire||it.occupant||it.numeroLogement||it.logementStatut)? `<div class="p-locataire"><div class="p-label">Lieu d'intervention</div><div class="p-line">${it.occupant? '<b>'+esc(it.occupant)+'</b><br>':''}${esc(withVille(it.adresseLocataire, it.codePostal, it.ville))}${it.etage? '<br>Étage '+esc(it.etage):''}${it.logementStatut? '<br>'+esc(logementLabel(it.logementStatut)):''}${it.numeroLogement? '<br>Logement n° '+esc(it.numeroLogement):''}</div></div>`:''}
      </td>
    </tr></table>
    ${controlesCoches.length? `<div class="p-section-title">Contrôles réalisés</div><div class="p-line">${controlesCoches.map(c=>esc(c)).join(' · ')}</div>`:''}
    ${r.constatations? `<div class="p-section-title">Constatations</div><div class="p-line">${esc(r.constatations).replace(/\n/g,'<br>')}</div>`:''}
    ${r.preconisations? `<div class="p-section-title">Préconisations</div><div class="p-line">${esc(r.preconisations).replace(/\n/g,'<br>')}</div>`:''}
    ${(it.photos && it.photos.length)? `<div class="p-section-title">Photos</div><div class="p-photos">${it.photos.map(p=>`<img src="${p.dataUrl}" class="p-photo">`).join('')}</div>`:''}
    <table class="p-sign"><tr>
      ${noOccupant? '' : `<td>Signature client :${it.signature? `<br><img src="${it.signature}" class="p-signature-img">` : '<div class="p-sigline"></div>'}</td>`}
      <td>Signature technicien :${it.signatureTechnicien? `<br><img src="${it.signatureTechnicien}" class="p-signature-img">` : '<div class="p-sigline"></div>'}</td>
    </tr></table>
    <div class="p-footer">${esc(socName)}${s.siret? ' — SIRET '+esc(s.siret):''}${s.adresse? ' — '+esc(s.adresse):''}</div>
  `;
}
/** Laisse au navigateur deux cycles de rendu avant la capture. */
function attendreRendu(){
  return new Promise((r)=> requestAnimationFrame(()=> requestAnimationFrame(()=> r())));
}

/* Après une erreur, html2pdf laisse son calque de travail par-dessus l'écran :
   il est invisible mais intercepte tous les clics, l'application paraît figée. */
function nettoyerCalquesPdf(){
  document.querySelectorAll('.html2pdf__overlay, .html2pdf__container').forEach((el)=> el.remove());
}

/* Le lien `download` est le seul chemin qui transporte un nom de fichier, et il
   fonctionne aussi dans une iframe, contrairement à `window.open`. */
function telechargerBlob(blob, nomFichier){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomFichier}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 60000);
}

/**
 * Fabrique le PDF de la zone d'impression et le remet à l'utilisateur.
 *
 * Portage de `genererPdf()` de chantier-mate-ease, qui produit déjà des
 * documents complets. Deux points s'y jouent :
 *
 *  - la zone est mesurée après le rendu, sinon la hauteur capturée est celle
 *    d'avant l'insertion du contenu ;
 *  - le fichier est remis par un lien `download`. Un onglet d'aperçu n'expose
 *    que l'UUID du blob, d'où les « c6ca4058-….pdf » qui atterrissaient dans
 *    les téléchargements.
 *
 * Le rognage de la moitié gauche, lui, ne venait pas d'ici : il tenait à la
 * version d'html2pdf chargée (voir la balise script).
 */
/* Hauteur de la bande réservée au pied, en millimètres. À garder accordée à la
   soustraction de `.p-page{min-height}` ci-dessus. */
const PIED_PDF_MM = 12;

/**
 * Écrit l'identification légale au bas de CHAQUE page.
 *
 * Elle ne figurait qu'une fois, à la suite du contenu : sur un document de
 * deux pages elle tombait en bas de la dernière, et le découpage en images
 * pouvait la couper en deux. Or l'article R123-238 l'exige sur tout document
 * commercial — et le lecteur d'une page isolée doit savoir de qui elle vient.
 *
 * jsPDF l'écrit en vrai texte, pas en image : elle reste donc sélectionnable
 * et cherchable dans le PDF, contrairement au reste du document.
 */
function dessinerPiedDePage(pdf, texte){
  const total = pdf.internal.getNumberOfPages();
  const L = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const base = H - PIED_PDF_MM;
  const MARGE = 14;           // mm, comme les marges latérales du document
  const PLACE_NUMERO = 18;    // mm réservés à « 3 / 12 », à droite

  /* Les espaces insécables empêchent jsPDF de couper la ligne : « Capital
     150 000 € » et « 43.22 » en contiennent, et le pied entier devenait un
     seul mot. Il débordait alors la page, se faisait rogner au bord droit, et
     le RCS comme le code APE disparaissaient — les deux étant obligatoires. */
  const propre = (texte || '').replace(/[\u00A0\u202F\u2007]/g, ' ').trim();
  const largeurMax = L - 2 * MARGE - PLACE_NUMERO;

  /* On rétrécit jusqu'à ce que tout tienne en deux lignes au plus, et on ne
     coupe jamais : mieux vaut un pied menu que des mentions amputées. */
  let taille = 7, lignes = [];
  if(propre){
    for(; taille >= 4.5; taille -= 0.25){
      pdf.setFontSize(taille);
      lignes = pdf.splitTextToSize(propre, largeurMax);
      if(lignes.length <= 2 && lignes.every(l => pdf.getTextWidth(l) <= largeurMax)) break;
    }
  }

  for(let i = 1; i <= total; i++){
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setDrawColor(226, 230, 237);
    pdf.setLineWidth(0.2);
    pdf.line(MARGE, base + 1, L - MARGE, base + 1);

    pdf.setTextColor(150, 155, 165);
    pdf.setFontSize(taille);
    /* Centré sur la zone de texte, pas sur la page : sans ce décalage, une
       ligne pleine passait sous le numéro de page. */
    const centre = MARGE + largeurMax / 2;
    lignes.forEach((ligne, n) => pdf.text(ligne, centre, base + 4.5 + n * 2.8, { align: 'center' }));

    pdf.setFontSize(7);
    pdf.text(`${i} / ${total}`, L - MARGE, base + 4.5, { align: 'right' });
  }
}


async function lancerGenerationPdf(area, nomFichier, action, factureId){
  try{
    await attendreRendu();

    const hauteur = Math.max(area.scrollHeight, area.offsetHeight);
    const largeur = Math.max(area.scrollWidth, area.offsetWidth);
    if(!hauteur || !largeur) throw new Error("le document à imprimer est vide");

    const opt = {
      /* [haut, gauche, bas, droite] : seule la bande du bas est réservée, pour
         le pied que `dessinerPiedDePage` écrit ensuite. */
      margin: [0, 0, PIED_PDF_MM, 0],
      filename: `${nomFichier}.pdf`,
      image: { type:'jpeg', quality:0.98 },
      html2canvas: { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false, scrollX:0, scrollY:0, height: hauteur, windowHeight: hauteur, width: largeur, windowWidth: largeur },
      jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
      pagebreak: { mode: ['css','legacy'] }
    };

    /* Le texte du pied est lu dans le document lui-même : il dit donc toujours
       la même chose que ce que le modèle a composé, pied personnalisé compris. */
    const textePied = (area.querySelector('.p-footer')?.textContent || '').trim();
    area.classList.add('pdf-en-cours');

    let blob;
    try{
      blob = await html2pdf().set(opt).from(area).toPdf()
        .get('pdf').then(pdf => dessinerPiedDePage(pdf, textePied))
        .outputPdf('blob');
    } finally {
      area.classList.remove('pdf-en-cours');
    }

    /* Une facture emporte sa version structurée : le même fichier porte la page
       que l'humain lit et les données que la machine du client exploite. Un
       manque n'empêche pas le téléchargement, il le signale. */
    if(factureId && window.pdfFacturX){
      const r = await window.pdfFacturX(blob, factureId);
      blob = r.fichier;
      /* Et seulement si le document RELÈVE de la facture électronique. Pour un
         particulier, le PDF simple n'est pas un pis-aller : c'est le document
         normal. Le signaler revenait à reprocher l'absence d'un SIRET que le
         formulaire ne propose même pas de saisir — à chaque impression. */
      if(!r.structuree && r.manques.length && passeParUnePlateforme(state.factures.find(x=>x.id===factureId))){
        showToast(`PDF simple : ${r.manques[0]}`);
      }
    }

    /* L'aperçu en onglet ne vaut que hors iframe : ailleurs `window.open` est
       bloqué et le document repart sans nom. */
    if(action !== 'save' && window.self === window.top){
      const url = URL.createObjectURL(blob);
      const onglet = window.open(url, '_blank');
      if(onglet){ setTimeout(()=> URL.revokeObjectURL(url), 60000); return; }
      URL.revokeObjectURL(url);
    }
    telechargerBlob(blob, nomFichier);
  }catch(err){
    console.error('PDF generation error', err);
    showToast("Impossible de produire le PDF. Réessayez, ou utilisez Ctrl+P / Cmd+P pour imprimer la page.");
  }finally{
    area.style.display = 'none';
    nettoyerCalquesPdf();
  }
}
function generateInterventionPdf(it, action){
  action = action || 'open';
  const area = document.getElementById('printArea');
  if(!area || !it) return;
  if(typeof html2pdf === 'undefined'){
    showToast("Le générateur de PDF n'a pas pu se charger (connexion internet bloquée ?). Utilisez Ctrl+P / Cmd+P pour imprimer ou enregistrer en PDF depuis le navigateur.");
    return;
  }
  area.innerHTML = renderPrintIntervention(it);
  area.style.display = 'block';
  showToast(action==='save' ? 'Enregistrement du PDF…' : 'Génération du PDF…', 'success');
  lancerGenerationPdf(area, it.numero || 'rapport', action);
}
function printInterventionDocument(id, action){
  const it = state.interventions.find(x=>x.id===id);
  if(!it){ showToast('Rapport introuvable.'); return; }
  generateInterventionPdf(it, action);
}
function printInterventionDraft(action){
  generateInterventionPdf(state.editing, action);
}
/** Ce qu'un bon de commande porte en plus d'un devis : sa référence client et qui le suit. */
function bonCommandeDocMetaHTML(b){
  const metiers = bcMetiersDuBC(b).map(m=>metierDisplayLabel(m)).filter(Boolean);
  return [
    /* La référence du client s'affiche dès qu'elle existe. Elle était
       conditionnée à la présence du numéro interne, si bien qu'un bon qui
       n'en avait pas — 788 sur 826 — imprimait un document muet sur la
       référence que le client, lui, utilise pour s'y retrouver. */
    b.numeroBC ? `Réf. client : <b>${esc(b.numeroBC)}</b>` : '',
    b.dateReception ? `Reçu le : <b>${fmtDate(b.dateReception)}</b>` : '',
    b.conducteur ? `Conducteur : <b>${esc(b.conducteur)}</b>` : '',
    metiers.length ? `Métiers : <b>${esc(metiers.join(', '))}</b>` : ''
  ].filter(Boolean).map(x=>'<br>'+x).join('');
}
/** Nom du PDF quand le document n'a pas de numéro. */
const NOM_FICHIER_DEFAUT = { devis:'devis', facture:'facture', bonCommande:'bon-de-commande' };
/**
 * Résout un document imprimable et son titre.
 *
 * Un bon de commande porte les mêmes champs d'en-tête qu'un devis ou une
 * facture ; seuls son numéro et sa date se lisent ailleurs. Le rendre ici évite
 * la table artisanale de la pré-facture, qui masquait chapitres et commentaires.
 */
function documentImprimable(type, id){
  if(type==='bonCommande'){
    const b = (state.bonsCommande||[]).find(x=>x.id===id);
    if(!b) return null;
    return { doc: { ...b, numero: b.numeroInterne || b.numeroBC || '', date: b.dateReception || b.date }, titre: 'BON DE COMMANDE' };
  }
  const doc = (type==='devis' ? state.devis : state.factures).find(x=>x.id===id);
  if(!doc) return null;
  /* « AVOIR », et non « FACTURE » : un avoir imprimé sous le mot facture est
     faux pour qui le reçoit comme pour qui le comptabilise. */
  return { doc, titre: type==='devis' ? 'DEVIS' : window.libelleDocument(doc.typeDocument) };
}
function renderPrintDoc(type, id, hidePrices, lignesOverride){
  const resolu = documentImprimable(type, id);
  if(!resolu) return '<p>Document introuvable.</p>';
  const doc = resolu.doc;
  const s = state.settings[state.societeId] || {};
  const socName = societeName(state.societeId);
  const lignes = lignesOverride || doc.lignes;
  const t = computeTotalsAvecRemise(lignes, doc.remisePourcentage || 0);
  const fmt = hidePrices ? (()=>'•••') : money;
  const title = resolu.titre;

  /* Une facture émise porte l'identité de son émetteur au jour de l'émission.
     Les brouillons, eux, suivent les réglages courants. */
  const em = {
    nom: doc.emetteurNom || socName,
    adresse: doc.emetteurAdresse || s.adresse,
    siret: doc.emetteurSiret || s.siret,
    tva: doc.emetteurTvaIntracom || s.tvaIntracom,
    /* Ni le téléphone ni l'e-mail ne sont figés à l'émission : ce ne sont pas
       des mentions obligatoires, et un client qui rappelle doit tomber sur le
       numéro d'aujourd'hui, pas sur celui d'il y a deux ans. */
    telephone: s.telephone,
    email: s.email,
    /* L'IBAN, lui, EST figé — et n'était jamais relu. Une facture réimprimée
       après un changement de banque annonçait le nouveau compte. */
    iban: doc.emetteurIban || s.iban,
  };
  return `
    <div class="p-page">
    <table class="p-header"><tr>
      <td style="width:55%;">
        ${logoHTML(s)}
        ${/* Le bloc « Émetteur » plus bas porte déjà le nom et l'adresse : les
             répéter sous le logo les faisait figurer deux fois sur la page.
             Sans logo, en revanche, l'en-tête doit bien identifier l'émetteur. */
          logoHTML(s) ? '' : `<div class="p-company">${esc(em.nom)}</div>${em.adresse? `<div class="p-tagline">${esc(em.adresse)}</div>`:''}`}
      </td>
      <td style="width:45%;">
        <div class="p-doctitle">${title}</div>
        <div class="p-docmeta">N° <b>${esc(doc.numero)}</b><br>Date : <b>${fmtDate(doc.date)}</b>${type==='facture'&&doc.echeance? '<br>Échéance : <b>'+fmtDate(doc.echeance)+'</b>'+(doc.conditionsReglement? ' <span style="font-weight:400;">('+esc(doc.conditionsReglement)+')</span>':''):''}${type==='facture'? factureDocMetaHTML(doc):''}${type==='bonCommande'? bonCommandeDocMetaHTML(doc):''}</div>
      </td>
    </tr></table>
    <div class="p-rule"></div>
    <table class="p-parties"><tr>
      <td>
        <div class="p-label">Émetteur</div>
        <div class="p-name">${esc(em.nom)}</div>
        <div class="p-line">${em.adresse? esc(em.adresse)+'<br>':''}${em.siret? 'SIRET '+esc(em.siret)+'<br>':''}${em.tva? 'TVA '+esc(em.tva)+'<br>':''}${em.telephone? 'Tél. '+esc(em.telephone)+'<br>':''}${em.email? esc(em.email):''}</div>
      </td>
      <td>
        <div class="p-label">Client</div>
        <div class="p-name">${esc(doc.client)}</div>
        <div class="p-line">${esc(doc.adresse)}</div>
        ${doc.clientSiret? `<div class="p-line">SIRET ${esc(doc.clientSiret)}</div>`:''}
        ${doc.clientTvaIntracom? `<div class="p-line">TVA ${esc(doc.clientTvaIntracom)}</div>`:''}
        ${doc.interlocuteur? `<div class="p-line">À l'attention de ${esc(doc.interlocuteur)}</div>`:''}
        ${(doc.adresseLocataire||doc.precisionCommune||doc.ancienLocataire||doc.numeroLogement||doc.occupant||doc.logementStatut||doc.etage)? `<div class="p-locataire"><div class="p-label">Lieu d'intervention</div><div class="p-line">${doc.numeroLogement? 'Logement n° '+esc(doc.numeroLogement)+'<br>':''}${doc.occupant? '<b>'+esc(doc.occupant)+'</b><br>':''}${doc.ancienLocataire? 'Ancien locataire : '+esc(doc.ancienLocataire)+'<br>':''}${esc(withVille(doc.adresseLocataire, doc.codePostal, doc.ville))}${doc.logementStatut? '<br>'+esc(logementLabel(doc.logementStatut)):''}${doc.etage? ' — Étage '+esc(doc.etage):''}${doc.precisionCommune? '<br>'+esc(doc.precisionCommune):''}</div></div>`:''}
      </td>
    </tr></table>
    <table class="p-lignes">
      <tr><th style="width:36%;">Désignation</th><th class="num">Qté</th><th class="num">Unité</th><th class="num">Prix U. HT</th><th class="num">TVA</th><th class="num">Total HT</th><th class="num">Total TTC</th></tr>
      ${printableLignesRows(lignes, hidePrices)}
    </table>
    <table class="p-totals">
      <tr><td class="label">Total HT</td><td class="val">${fmt(t.htAvant)}</td></tr>
      ${t.remisePct>0? `<tr><td class="label">Remise (${t.remisePct}%)</td><td class="val">-${fmt(t.remiseMontantHT)}</td></tr>` : ''}
      ${tvaLignesHTML(t, (libelle, montant)=>`<tr><td class="label">${libelle}</td><td class="val">${fmt(montant)}</td></tr>`)}
      <tr class="grand"><td class="label">Total TTC</td><td class="val">${fmt(t.ttc)}</td></tr>
      ${soldeLignesHTML(doc, t, fmt)}
    </table>
    ${/* Une facture ne se signe pas : elle constate une créance, elle ne
         recueille pas d'accord. Les lignes de signature n'y avaient donc rien
         à faire. Le devis, lui, vit de l'accord du client, et le bon de
         commande de la validation de sa pré-facture. */
      type === 'facture' ? '' : `<table class="p-sign"><tr>
      <td>${type==='devis'? 'Bon pour accord, date et signature du client :' : 'Validation de la pré-facture :'}<div class="p-sigline"></div></td>
      <td>Pour ${esc(em.nom)} :<div class="p-sigline"></div></td>
    </tr></table>`}
    ${blocConditionsHTML(type, doc, s, hidePrices)}
    <div class="p-bas-de-page">
      ${blocMentionsHTML(type, s)}
      <div class="p-footer">${esc(piedDePageHTML(em, s))}</div>
    </div>
    </div>
  `;
}

/**
 * Logo de l'en-tête.
 *
 * Il était téléversable, stocké et visible dans les réglages, mais
 * n'apparaissait sur aucun document imprimé — seul l'export Word du PPSPS
 * s'en servait. Il vit en data-URL, donc html2pdf le rend sans requête réseau.
 */
/* Le pays par défaut vient du module de règles. Le repli n'existe que pour la
   fraction de seconde avant l'injection du pont : une seule occurrence, ici. */
function paysDefaut(){ return window.PAYS_DEFAUT || 'FR'; }

function logoHTML(s){
  return s && s.logo ? `<img class="p-logo" src="${esc(s.logo)}" alt="">` : '';
}

/**
 * Conditions de règlement et coordonnées bancaires.
 *
 * L'IBAN suit le réglage « afficher l'IBAN », qui existait sans rien piloter.
 * Il disparaît en mode sans prix : une facture sans montants n'a pas à porter
 * de quoi la payer.
 */
/* L'énumération de la base est technique ; le document s'adresse à un humain. */
const LIBELLES_MODE_PAIEMENT = {
  virement:'virement', cheque:'chèque', especes:'espèces', carte:'carte bancaire',
  prelevement:'prélèvement', traite:'traite', autre:'tout moyen convenu'
};
function libelleModePaiement(mode){
  return LIBELLES_MODE_PAIEMENT[mode] || 'virement';
}

/**
 * Ce qui rattache la facture à ce qui l'a précédée.
 *
 * Le n° de bon de commande du client est renseigné depuis peu et n'était pas
 * imprimé ; le n° de marché était une colonne sans écrivain ni lecteur. Or un
 * acheteur public rapproche par ces références, et les réclame.
 *
 * La date d'achèvement ne s'affiche que si elle DIFFÈRE de la date de facture :
 * l'art. L441-9 exige la date de la prestation, mais la répéter à l'identique
 * n'apprend rien et alourdit l'en-tête.
 */
/**
 * Ce qu'il reste à payer, quand ce n'est pas le total.
 *
 * La retenue de garantie n'est pas une remise : la créance reste entière, seul
 * son versement est différé jusqu'à la levée. D'où un « Net à payer » sous le
 * Total TTC, et non un total raboté — c'est ce que le lecteur doit virer.
 *
 * Rien ne s'affiche quand rien n'est déduit : une facture ordinaire n'a pas à
 * porter deux lignes à zéro.
 */
function soldeLignesHTML(doc, t, fmt){
  const s = window.soldeAPayer(t, {
    acomptes: doc.acomptesDeduits,
    retenuePourcentage: doc.retenueGarantiePourcentage,
  });
  if(!s.aDesDeductions) return '';
  return (s.acomptes>0 ? `<tr><td class="label">Acompte déjà versé</td><td class="val">-${fmt(s.acomptes)}</td></tr>` : '')
       + (s.retenueMontant>0 ? `<tr><td class="label">Retenue de garantie (${window.formaterTaux(s.retenuePourcentage)})</td><td class="val">-${fmt(s.retenueMontant)}</td></tr>` : '')
       + `<tr class="grand"><td class="label">Net à payer</td><td class="val">${fmt(s.netAPayer)}</td></tr>`;
}

function factureDocMetaHTML(doc){
  const devis = doc.devisId ? state.devis.find(d=>d.id===doc.devisId) : null;
  const lignes = [];
  if(doc.dateFinExecution && doc.dateFinExecution !== doc.date){
    lignes.push('Travaux achevés le : <b>'+fmtDate(doc.dateFinExecution)+'</b>');
  }
  if(doc.refBonCommandeClient) lignes.push('Votre bon de commande : <b>'+esc(doc.refBonCommandeClient)+'</b>');
  if(devis && devis.numero) lignes.push('Devis : <b>'+esc(devis.numero)+'</b>');
  if(doc.refMarche) lignes.push('Marché : <b>'+esc(doc.refMarche)+'</b>');
  /* Un avoir désigne la pièce qu'il rectifie et dit pourquoi : sans cela, le
     destinataire ne sait pas sur quoi l'imputer, et rien ne justifie la
     rectification à qui relira les comptes. */
  const rectifiee = doc.factureRectifieeId ? state.factures.find(f=>f.id===doc.factureRectifieeId) : null;
  if(rectifiee && rectifiee.numero) lignes.push('Rectifie la facture : <b>'+esc(rectifiee.numero)+'</b> du '+fmtDate(rectifiee.date));
  if(doc.motifRectification) lignes.push('Motif : <b>'+esc(doc.motifRectification)+'</b>');
  return lignes.length ? '<br>'+lignes.join('<br>') : '';
}

function blocConditionsHTML(type, doc, s, hidePrices){
  const r = (s.reglages && s.reglages.documents) || {};
  const conditions = type==='devis'
    ? (r.conditionsDevis||'').trim()
    : (doc.conditionsReglement||'').trim();
  /* L'IBAN de la facture d'abord : il est figé à l'émission, et le lire dans
     les réglages courants ferait annoncer le compte d'aujourd'hui sur une
     facture d'il y a deux ans. Le BIC, lui, n'est pas figé — faute de colonne. */
  const iban = doc.emetteurIban || s.iban;
  const avecIban = (r.afficherIban !== false) && !hidePrices && (iban || s.bic);
  const aUneEcheance = type === 'facture' && !!doc.echeance;
  if(!conditions && !avecIban && !aUneEcheance) return '';

  /* Le titre annonçait « Règlement par virement » quel que soit le mode : la
     colonne `mode_paiement` était écrite et lue par personne. */
  const mode = libelleModePaiement(type==='devis' ? null : doc.modePaiement);

  /* La date d'échéance en toutes lettres à côté des conditions : art. L441-9,
     qui exige la date à laquelle le règlement doit intervenir — pas seulement
     le délai dont elle découle. Le mode l'accompagne, c'est ce que le payeur
     cherche en même temps. */
  const echeance = (type === 'facture' && doc.echeance)
    ? `<div>Échéance : <span style="font-weight:700;">${fmtDate(doc.echeance)}</span> — Règlement par ${esc(mode)}</div>`
    : '';

  return `<table class="p-conditions"><tr>
    <td>${(conditions || echeance)? `<b>Conditions de paiement</b>${conditions? `<div>${esc(conditions)}</div>`:''}${echeance}` : ''}</td>
    <td>${avecIban? `<b>Règlement par ${esc(mode)}</b><div>${iban? 'IBAN '+esc(iban):''}${iban&&s.bic? ' — ':''}${s.bic? 'BIC '+esc(s.bic):''}</div>` : ''}</td>
  </tr></table>`;
}

/* Les mentions du code de commerce ne concernent que la facture : les faire
   figurer sur un devis affaiblirait celles qui engagent réellement. */
function blocMentionsHTML(type, s){
  if(type !== 'facture') return '';
  const mentions = window.mentionsLegales(s);
  const complement = ((s.reglages && s.reglages.documents && s.reglages.documents.mentionsComplementaires)||'').trim();
  if(!mentions.length && !complement) return '';

  return `<div class="p-mentions">
    <div class="p-label">Mentions légales</div>
    ${mentions.map(m=>`<div>${esc(m)}</div>`).join('')}
    ${complement? `<div style="white-space:pre-wrap;">${esc(complement)}</div>`:''}
  </div>`;
}

/* Le pied reprend l'identité légale : c'est là que se lisent la forme
   juridique, le capital et le RCS, obligatoires sur tout document commercial. */
function piedDePageHTML(em, s){
  const identifiants = window.identifiantsLegaux({ ...s, siret: em.siret, tvaIntracom: em.tva });
  const perso = ((s.reglages && s.reglages.documents && s.reglages.documents.piedDePage)||'').trim();
  if(perso) return perso;
  return [em.nom, ...identifiants, em.adresse].filter(Boolean).join(' — ');
}
function printDocument(type, id, action){
  action = action || 'open';
  const resolu = documentImprimable(type, id);
  const doc = resolu && resolu.doc;
  const area = document.getElementById('printArea');
  if(!area || !doc) return;
  if(type==='facture') marquerFactureVerrouillee(id);
  if(typeof html2pdf === 'undefined'){
    showToast("Le générateur de PDF n'a pas pu se charger (connexion internet bloquée ?). Utilisez Ctrl+P / Cmd+P pour imprimer ou enregistrer en PDF depuis le navigateur.");
    return;
  }
  area.innerHTML = renderPrintDoc(type, id);
  area.style.display = 'block';
  showToast(action==='save' ? 'Enregistrement du PDF…' : 'Génération du PDF…', 'success');
  /* Seule une facture numérotée porte une version structurée : un devis n'est
     pas une facture électronique, et un brouillon sans numéro n'existe pas
     encore pour la plateforme. */
  const pourFacturX = (type === 'facture' && doc.numero) ? id : null;
  lancerGenerationPdf(area, doc.numero || NOM_FICHIER_DEFAUT[type] || 'document', action, pourFacturX);
}

/* ---------- Devis ---------- */
function renderDevis(){
  const estST = estSousTraitant();
  const list = state.devis.filter(d=>d.societeId===state.societeId && (estST ? (d.sousTraitantEmetteur && (!sousTraitantActuel() || d.sousTraitantEmetteur===sousTraitantActuel())) : !d.sousTraitantEmetteur));
  return `
    <div class="page-head"><h1>Devis</h1>${state.formOpen.devis? '' : '<button class="btn primary" onclick="openForm(\'devis\')">+ Nouveau devis</button>'}</div>
    ${state.formOpen.devis ? '' : `<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
      <input type="text" id="devisSearchInput" style="flex:1; min-width:220px;" value="${esc(state.devisSearch||'')}" placeholder="Rechercher : client, locataire, interlocuteur, adresse, prix HT/TTC…" oninput="filterDevisList(this.value)" onkeydown="searchEnterCycle(event,'devis')">
      <select style="width:auto; min-width:180px;" onchange="filterDevisConducteur(this.value)">${conducteurFilterOptions(state.devisConducteurFilter)}</select>
      <select style="width:auto; min-width:170px;" onchange="filterDevisLogement(this.value)">${logementFilterOptions(state.devisLogementFilter)}</select>
      <select style="width:auto; min-width:170px;" onchange="filterDevisClient(this.value)">${planningUnschedClientOptions(state.devisClientFilter)}</select>
      <select style="width:auto; min-width:190px;" onchange="filterDevisInterlocuteur(this.value)">${planningUnschedInterlocuteurOptions(state.devisInterlocuteurFilter, state.devisClientFilter)}</select>
      <select style="width:auto; min-width:160px;" onchange="filterDevisStatut(this.value)">${devisStatutFilterOptions(state.devisStatutFilter)}</select>
    </div>`}
    <div id="formZoneDevis">${state.formOpen.devis ? devisForm() : ''}</div>
    ${state.formOpen.devis ? '' : `<div id="devisListZone">${renderDevisListHTML(list)}</div>`}
  `;
}
/* ---------- Barres de recherche des listings ----------
   Sept listings n'avaient aucune recherche ; les dix qui en avaient une
   portaient chacune sa copie du même <input> et sa propre liste de champs,
   si bien que chercher un numéro de série marchait sur le matériel mais pas
   sur les véhicules. Une seule barre, un seul filtre, une seule table.

   Le filtre redessine la zone de liste et elle seule : redessiner l'onglet
   entier reconstruirait l'<input>, qui perdrait le focus à chaque frappe. */

/** Par clé de listing : la zone à redessiner, et de quoi compter les résultats. */
const LISTINGS = {};

/**
 * Déclare un listing.
 *
 * `toutes()` rend les fiches du listing avant recherche, `rendu(liste)` le HTML
 * de sa zone. `extras(fiche)` sert aux valeurs que la fiche ne porte pas —
 * un montant formaté, le nom d'un client qu'elle ne désigne que par son id.
 */
function declarerListing(cle, toutes, rendu, extras){
  LISTINGS[cle] = {
    toutes, extras,
    zone: () => rendu(chercheesDans(cle, toutes(), extras)),
  };
  return LISTINGS[cle].zone;
}

/** Ne garde de `list` que ce qui répond à la recherche du listing `cle`. */
function chercheesDans(cle, list, extras){
  const q = (state.recherches[cle] || '').trim();
  if(!q) return list;
  return list.filter(o => window.correspondFiche(o, q, extras ? extras(o) : []));
}

/** Combien de fiches le listing montre, sur combien il en a. */
function compteRecherche(cle){
  const l = LISTINGS[cle];
  if(!l || !(state.recherches[cle]||'').trim()) return '';
  const total = l.toutes().length;
  const affiches = chercheesDans(cle, l.toutes(), l.extras).length;
  return affiches === total ? '' : `${affiches} sur ${total}`;
}

function barreRecherche(cle, placeholder){
  const compte = compteRecherche(cle);
  return `<div class="barre-recherche">
    <input type="search" id="recherche-${cle}" value="${esc(state.recherches[cle]||'')}"
      placeholder="${esc(placeholder)}" oninput="filtrerListe('${jsAttr(cle)}', this.value)">
    ${compte? `<span class="compteur-resultats">${compte}</span>` : ''}
  </div>`;
}

function filtrerListe(cle, valeur){
  state.recherches[cle] = valeur;
  const zone = document.getElementById('liste-' + cle);
  /* Sans zone déclarée, on retombe sur le rendu complet : une recherche qui
     ne filtre rien serait pire qu'un focus perdu. */
  if(!zone || !LISTINGS[cle]){ renderTab(); return; }
  zone.innerHTML = LISTINGS[cle].zone();
  majCompteurRecherche(cle);
}

/* Le compteur vit hors de la zone redessinée — l'y mettre le ferait
   disparaître avec elle, et remonter d'un cran redessinerait l'<input>. */
function majCompteurRecherche(cle){
  const barre = document.getElementById('recherche-' + cle);
  if(!barre) return;
  const ancien = barre.parentElement.querySelector('.compteur-resultats');
  const texte = compteRecherche(cle);
  if(!texte){ if(ancien) ancien.remove(); return; }
  if(ancien){ ancien.textContent = texte; return; }
  const span = document.createElement('span');
  span.className = 'compteur-resultats';
  span.textContent = texte;
  barre.parentElement.appendChild(span);
}

/** Le message d'une liste vide : « aucun » et « aucun résultat » diffèrent. */
function listeVide(cle, messageSansRecherche, quoi){
  return (state.recherches[cle]||'').trim()
    ? `<div class="empty">Aucun ${quoi} ne correspond à la recherche.</div>`
    : `<div class="empty">${messageSansRecherche}</div>`;
}

/* `sansAccents` et `multiWordMatch` viennent de src/integrations/recherche.ts,
   publiés sur window par le pont. Les redéfinir ici ferait diverger la
   recherche des écrans de celle du tableau de bord — c'est exactement ce qui
   s'était produit. */
function sansAccents(s){ return window.sansAccents(s); }
function multiWordMatch(haystack, query){ return window.multiWordMatch(haystack, query); }
function searchEnterCycle(ev, type){
  if(ev.key !== 'Enter') return;
  ev.preventDefault();
  /* La liste des bons dépend de l'écran : sur Factures, seuls ceux de la vue
     courante sont dans le DOM. */
  const bonsVisibles = () => {
    const vue = state.facturesView || 'liste';
    if(state.tab==='factures' && (vue==='validation' || vue==='afacturer')) return bonsDeLaVue(vue);
    return state.bonsCommande.filter(b=>b.societeId===state.societeId);
  };
  const configs = {
    bonCommande: { list: bonsVisibles(), matchFn: bonCommandeMatchesSearch, prefix: 'bonCommande-card-' },
    devis: { list: state.devis.filter(d=>d.societeId===state.societeId), matchFn: devisMatchesSearch, prefix: 'devis-card-' },
    facture: { list: state.factures.filter(f=>f.societeId===state.societeId), matchFn: factureMatchesSearch, prefix: 'facture-card-' },
    intervention: { list: state.interventions.filter(i=>i.societeId===state.societeId), matchFn: interventionMatchesSearch, prefix: 'intervention-card-' }
  };
  const cfg = configs[type];
  if(!cfg) return;
  const q = (ev.target.value||'').trim().toLowerCase();
  const matches = cfg.list.filter(item => cfg.matchFn(item, q));
  if(!matches.length) return;
  if(!state.searchCycle || state.searchCycle.type !== type || state.searchCycle.query !== q){
    state.searchCycle = {type, query:q, index:0};
  } else {
    state.searchCycle.index = (state.searchCycle.index + 1) % matches.length;
  }
  document.querySelectorAll('.search-focus').forEach(el=> el.classList.remove('search-focus'));
  const target = matches[state.searchCycle.index];
  const el = document.getElementById(cfg.prefix + target.id);
  if(el){
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('search-focus');
  }
}
/* Les statuts que porte un devis, dans l'ordre de son cycle de vie. */
const STATUTS_DEVIS = ['brouillon', 'envoyé', 'accepté', 'refusé'];
function devisStatutFilterOptions(courant){
  return '<option value="">Tous les statuts</option>' + STATUTS_DEVIS
    .map(s=>`<option value="${esc(s)}" ${s===courant?'selected':''}>${esc(s.charAt(0).toUpperCase()+s.slice(1))}</option>`).join('');
}
function filterDevisStatut(valeur){
  state.devisStatutFilter = valeur;
  const zone = document.getElementById('devisListZone');
  if(zone) zone.innerHTML = renderDevisListHTML(state.devis.filter(d=>d.societeId===state.societeId));
}
function devisMatchesSearch(d, q){
  return !q || window.multiWordMatch(devisSearchHaystack(d), q);
}
function filterDevisList(value){
  state.devisSearch = value;
  const zone = document.getElementById('devisListZone');
  if(zone) zone.innerHTML = renderDevisListHTML(state.devis.filter(d=>d.societeId===state.societeId));
}
function filterDevisConducteur(value){
  state.devisConducteurFilter = value;
  const zone = document.getElementById('devisListZone');
  if(zone) zone.innerHTML = renderDevisListHTML(state.devis.filter(d=>d.societeId===state.societeId));
}
function filterDevisLogement(value){
  state.devisLogementFilter = value;
  const zone = document.getElementById('devisListZone');
  if(zone) zone.innerHTML = renderDevisListHTML(state.devis.filter(d=>d.societeId===state.societeId));
}
function filterDevisClient(value){
  state.devisClientFilter = value;
  state.devisInterlocuteurFilter = '';
  renderTab();
}
function filterDevisInterlocuteur(value){
  state.devisInterlocuteurFilter = value;
  const zone = document.getElementById('devisListZone');
  if(zone) zone.innerHTML = renderDevisListHTML(state.devis.filter(d=>d.societeId===state.societeId));
}
function renderDevisListHTML(list){
  const q = (state.devisSearch||'').trim().toLowerCase();
  const cf = state.devisConducteurFilter||'';
  const lf = state.devisLogementFilter||'';
  const clientFilter = state.devisClientFilter||'';
  const interlocuteurFilter = state.devisInterlocuteurFilter||'';
  const sf = state.devisStatutFilter||'';
  const filtered = list.filter(d=>devisMatchesSearch(d, q) && (!cf || d.conducteur===cf) && (!lf || d.logementStatut===lf)
    && (!clientFilter || d.client===clientFilter) && (!interlocuteurFilter || (d.interlocuteur||'')===interlocuteurFilter)
    && (!sf || (d.statut||'brouillon')===sf));
  return filtered.map(d=>{
    const t = computeDocTotals(d);
    const facturesLiees = state.factures.filter(f=>f.devisId===d.id);
    const rapportOrigine = d.interventionId ? state.interventions.find(i=>i.id===d.interventionId) : null;
    const bonsCommandeLies = state.bonsCommande.filter(b=>b.devisId===d.id);
    return `<div class="card" id="devis-card-${d.id}" style="cursor:pointer;" onclick="cardRowClick(event,'devis','${jsAttr(d.id)}')"><div class="card-row">
      <div style="flex:1; min-width:0;"><div class="card-title">${esc(d.client)}</div><div class="card-sub"><span class="numref-lg">${esc(d.numero)}</span> · ${fmtDate(d.date)}${d.interlocuteur? ' · 👤 '+esc(d.interlocuteur):''}${d.conducteur? ' · 🦺 '+esc(d.conducteur):''}</div>${locataireCardLine(d)}
      ${facturesLiees.length? `<div class="card-sub">Facture${facturesLiees.length>1?'s':''} liée${facturesLiees.length>1?'s':''} : ${facturesLiees.map(f=>`<a href="javascript:void(0)" onclick="goToFacture('${jsAttr(f.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(f.numero)}</a>`).join(', ')}</div>`:''}
      ${rapportOrigine? `<div class="card-sub">Rapport d'origine : <a href="javascript:void(0)" onclick="goToIntervention('${jsAttr(rapportOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(rapportOrigine.numero)}</a></div>`:''}
      ${bonsCommandeLies.length? `<div class="card-sub">Bon${bonsCommandeLies.length>1?'s':''} de commande lié${bonsCommandeLies.length>1?'s':''} : ${bonsCommandeLies.map(b=>`<a href="javascript:void(0)" onclick="goToBonCommande('${jsAttr(b.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(b.numeroBC)}</a>`).join(', ')}</div>`:''}
      </div>
      <div style="text-align:right; flex-shrink:0;"><div class="amount">${moneyDisplay(t.ht)} <small style="font-weight:400; color:var(--text-dim); font-size:11px;">HT</small></div><div class="card-sub">${moneyDisplay(t.ttc)} TTC</div>${t.remisePct>0? `<div class="card-sub" style="margin-top:2px;">remise ${t.remisePct}%</div>`:''}<div style="display:flex; gap:6px; align-items:center; justify-content:flex-end; margin-top:5px;">${logementBadge(d.logementStatut)}<span class="badge ${badgeClass(d.statut)}">${esc(d.statut)}</span></div></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn small" onclick="editItem('devis','${jsAttr(d.id)}')">Modifier</button>
      <button class="btn small" onclick="dupliquerDevis('${jsAttr(d.id)}')">Dupliquer</button>
      <button class="btn small" onclick="printDocument('devis','${jsAttr(d.id)}','save')">Imprimer / PDF</button>
      <button class="btn small" onclick="envoyerDocumentEmail('devis','${jsAttr(d.id)}')">Envoyer par email</button>
      ${facturesLiees.length? '' : `<button class="btn small" onclick="transformerEnFacture('${jsAttr(d.id)}')">Transformer en facture</button>`}
      ${bonsCommandeLies.length? '' : `<button class="btn small" onclick="lierDevisABonCommande('${jsAttr(d.id)}')">Créer un bon de commande</button>`}
      <button class="btn small danger" onclick="deleteItem('devis','${jsAttr(d.id)}')">Supprimer</button>
    </div></div>`;
  }).join('') || `<div class="empty">${q? 'Aucun devis ne correspond à la recherche.' : 'Aucun devis pour cette société. Créez-en un, ou dites-le à l\u2019assistant vocal.'}</div>`;
}
function devisForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le devis' : 'Nouveau devis'}</h3>
    ${e.interventionId? `<div class="numref" style="margin-bottom:10px;">Issu d'un rapport d'intervention</div>`:''}
    <div class="form-section">
      <div class="form-section-head">Client & contact</div>
      <div class="field-grid">
        <div class="field"><label>Client</label><select id="f_client" onchange="refreshInterlocuteurSelect(this,'f_interlocuteur')">${clientSelectOptions(e.client)}</select></div>
        <div class="field"><label>Interlocuteur</label><select id="f_interlocuteur">${interlocuteurOptions(e.client, e.interlocuteur)}</select></div>
        <div class="field"><label>Date</label><input type="date" id="f_date" value="${e.date||todayISO()}"></div>
        <div class="field"><label>Conducteur de travaux</label><select id="f_conducteur">${conducteurSelectOptions(conducteurIdDe(e))}</select></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Lieu & locataire</div>
      <div class="field-grid">
      <div class="field full" style="margin-bottom:2px;"><button type="button" class="btn small ghost" onclick="toggleBox('locataireBoxDevis')">+ Le locataire est différent du client</button></div>
      <div id="locataireBoxDevis" style="display:${(e.occupant||e.adresseLocataire||e.logementStatut)?'contents':'none'};">
        <div class="field"><label>Type</label><select id="f_logementStatut" onchange="toggleOccupantField(this,'occupantFieldDevis','communeFieldDevis','vacantFieldDevis','numeroFieldDevis','etageFieldDevis')">${logementOptions(e.logementStatut)}</select></div>
        <div class="field full" id="communeFieldDevis" style="display:${e.logementStatut==='commune'?'':'none'};"><label>Précision (partie commune)</label><input type="text" id="f_precisionCommune" value="${esc(e.precisionCommune)}" placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…"></div>
        <div class="field full" id="vacantFieldDevis" style="display:${e.logementStatut==='vacant'?'':'none'};"><label>Ancien locataire</label><input type="text" id="f_ancienLocataire" value="${esc(e.ancienLocataire)}" placeholder="Ex : M. Dupont"></div>
        <div class="field" id="occupantFieldDevis" style="display:${e.logementStatut==='occupé'?'':'none'};"><label>Locataire</label><input type="text" id="f_occupant" value="${esc(e.occupant)}"></div>
        <div class="address-trio">
          <div class="field" style="position:relative;"><label>Lieu d'intervention</label><input type="text" id="f_adresseLocataire" autocomplete="off" value="${esc(e.adresseLocataire)}" placeholder="Laisser vide si identique à l'adresse client" data-suggest="fLieuSuggestions" oninput="searchAdresse(this, {adresse:'f_adresseLocataire', codePostal:'f_codePostal', ville:'f_ville'})" onblur="setTimeout(()=>{const b=document.getElementById('fLieuSuggestions'); if(b) b.style.display='none';},150)"><div id="fLieuSuggestions" class="suggest-box"></div></div>
          <div class="field"><label>Code postal</label><input type="text" id="f_codePostal" autocomplete="off" maxlength="5" inputmode="numeric" value="${esc(e.codePostal)}" oninput="lookupVilleParCodePostal(this.value,'f_ville')"></div>
          <div class="field"><label>Ville</label><input type="text" id="f_ville" autocomplete="off" value="${esc(e.ville)}"></div>
        </div>
        <div class="field" id="etageFieldDevis" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>Étage</label><input type="text" id="f_etage" value="${esc(e.etage)}" placeholder="RDC, 1er, 2e…"></div>
        <div class="field" id="numeroFieldDevis" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>N° de logement</label><input type="text" id="f_numeroLogement" value="${esc(e.numeroLogement)}" placeholder="Ex : 12, Appt 3B"></div>
      </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Lignes</div>
      <table class="lignes-table"><thead><tr><th style="width:36%;">Désignation</th><th>Qté</th><th>Unité</th><th>Prix U. HT</th><th>TVA</th><th class="num">Total HT</th><th class="num">Total TTC</th><th></th></tr></thead>
      <tbody id="lignesBody">${ligneRowsHTML(e.lignes)}</tbody></table>
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="addLigne()">+ Ligne</button>
        <button class="btn small" onclick="addChapitre()">+ Chapitre</button>
        <button class="btn small" onclick="addCommentaire()">+ Commentaire</button>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Remise & totaux</div>
      ${remiseAndTotalsHTML(e.lignes, e.remisePourcentage)}
    </div>
    <div class="form-actions-sticky">
      <button class="btn primary" onclick="saveDevis()">Enregistrer le devis</button>
      <button class="btn ghost" onclick="closeForm('devis')">Annuler</button>
    </div>
  </div>`;
}
function cleanLogementFields(statut, raw){
  return {
    logementStatut: statut,
    occupant: statut === 'occupé' ? (raw.occupant||'') : '',
    etage: (statut === 'occupé' || statut === 'vacant') ? (raw.etage||'') : '',
    numeroLogement: (statut === 'occupé' || statut === 'vacant') ? (raw.numeroLogement||'') : '',
    precisionCommune: statut === 'commune' ? (raw.precisionCommune||'') : '',
    ancienLocataire: statut === 'vacant' ? (raw.ancienLocataire||'') : ''
  };
}
async function saveDevis(){
  const e = state.editing;
  const client = document.getElementById('f_client').value.trim();
  if(!client){ alert('Le nom du client est requis.'); return; }
  const id = e.id || uid();
  const numero = e.numero || await window.nextNumero(state.societeId, 'devis');
  const obj = { id, societeId: state.societeId, numero, createdAt: e.createdAt || new Date().toISOString(), client, interventionId: e.interventionId || null,
    chantierId: e.chantierId || null,
    adresse: resolveClientAdresse(client),
    interlocuteur: document.getElementById('f_interlocuteur').value,
    adresseLocataire: document.getElementById('f_adresseLocataire').value,
    codePostal: document.getElementById('f_codePostal').value,
    ville: document.getElementById('f_ville').value,
    ...cleanLogementFields(document.getElementById('f_logementStatut').value, {
      occupant: document.getElementById('f_occupant').value,
      etage: document.getElementById('f_etage').value,
      numeroLogement: document.getElementById('f_numeroLogement').value,
      precisionCommune: document.getElementById('f_precisionCommune').value,
      ancienLocataire: document.getElementById('f_ancienLocataire').value
    }),
    date: document.getElementById('f_date').value || todayISO(),
    lignes: state.editing.lignes, remisePourcentage: e.remisePourcentage || 0, statut: e.statut || 'brouillon', ...conducteurDuSelect('f_conducteur') };
  /* Annotation de type seule : ajouter la clé au littéral changerait ce qui part
     à l'écriture, et un champ sans colonne fait rejeter l'insertion entière. */
  if(estSousTraitant()) /** @type {any} */ (obj).sousTraitantEmetteur = sousTraitantActuel()||'Sous-traitant';
  const r = await window.stSet('devis:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('devis');
  closeForm('devis');
  if(obj.chantierId){
    await syncDevisLignesVersDpgf(obj);
    setTab('chantiers');
    state.viewingChantier = obj.chantierId;
    renderTab();
    showToast('Devis créé, lié au chantier et ajouté au DPGF chiffré.', 'success');
  }
}
async function syncDevisLignesVersDpgf(devisObj){
  const c = state.chantiers.find(x=>x.id===devisObj.chantierId);
  if(!c) return;
  if(!c.dpgfLignes) c.dpgfLignes = [];
  c.dpgfLignes = c.dpgfLignes.filter(l=>l.devisSourceId!==devisObj.id);
  (devisObj.lignes||[]).forEach(l=>{
    if(l.type==='commentaire') return;
    if(!l.designation) return;
    c.dpgfLignes.push({
      id: uid(), type: l.type==='chapitre'?'chapitre':'ligne',
      designation: l.designation, qte: l.qte||0, prixUnitaire: l.prixUnitaire||0,
      avancementCumule: 0, devisSourceId: devisObj.id
    });
  });
  await window.stSet('chantier:'+c.id, c);
  await recharger('devis', 'chantier');
}
function dupliquerDevis(devisId){
  const d = state.devis.find(x=>x.id===devisId);
  if(!d) return;
  openForm('devis', {
    client:d.client, adresse:d.adresse, occupant:d.occupant||'', adresseLocataire:d.adresseLocataire||'',
    logementStatut:d.logementStatut||'', etage:d.etage||'', numeroLogement:d.numeroLogement||'', precisionCommune:d.precisionCommune||'', ancienLocataire:d.ancienLocataire||'',
    interlocuteur:d.interlocuteur||'',
    date: todayISO(),
    lignes: JSON.parse(JSON.stringify(d.lignes)),
    remisePourcentage: d.remisePourcentage||0,
    statut:'brouillon'
  });
  showToast('Devis dupliqué — modifiez-le puis enregistrez pour créer un nouveau devis.', 'success');
}
/**
 * Dépose la facture sur la plateforme de dématérialisation.
 *
 * Le geste reste manuel : une facture transmise ne se rattrape pas, il faut
 * émettre un avoir. On demande donc confirmation, et on montre ce qui bloque
 * plutôt que d'échouer sans dire pourquoi.
 */
async function transmettreALaPlateforme(factureId){
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;
  if(f.pdpIdentifiant){
    showToast(`Déjà déposée sur la plateforme (${f.pdpIdentifiant}).`);
    return;
  }
  if(!window.transmettreFacture){
    showToast("La transmission n'est pas disponible.");
    return;
  }
  if(!confirm(`Déposer la facture ${f.numero} sur la plateforme ?\n\nUne facture transmise ne peut plus être modifiée : il faudrait émettre un avoir.`)) return;

  showToast('Transmission en cours…');
  const r = await window.transmettreFacture(factureId);
  showToast(r.message, r.depose ? 'success' : undefined);
  if(r.depose){ await recharger('facture'); renderTab(); }
}

function transformerEnFacture(devisId){
  const d = state.devis.find(x=>x.id===devisId);
  if(!d) return;
  const dejaFacture = state.factures.find(f=>f.devisId===devisId);
  if(dejaFacture){
    showToast(`Ce devis a déjà été transformé en facture (${dejaFacture.numero}). Ouvrez-la directement pour la modifier.`);
    return;
  }
  setTab('factures');
  state.facturesView = 'liste';
  openForm('facture', {client:d.client, adresse:d.adresse, occupant:d.occupant||'', adresseLocataire:d.adresseLocataire||'', logementStatut:d.logementStatut||'', etage:d.etage||'', numeroLogement:d.numeroLogement||'', precisionCommune:d.precisionCommune||'', ancienLocataire:d.ancienLocataire||'', interlocuteur:d.interlocuteur||'', interventionId:d.interventionId||null, date:todayISO(), echeance:'', lignes: JSON.parse(JSON.stringify(d.lignes)), remisePourcentage: d.remisePourcentage||0, devisId:d.id, chantierId:d.chantierId||null, statut:'brouillon'});
}
function lierDevisABonCommande(devisId){
  const d = state.devis.find(x=>x.id===devisId);
  if(!d) return;
  const dejaLie = state.bonsCommande.find(b=>b.devisId===devisId);
  if(dejaLie){
    showToast(`Ce devis est déjà lié au bon de commande ${dejaLie.numeroBC}. Ouvrez-le directement pour le modifier.`);
    return;
  }
  const t = computeDocTotals(d);
  setTab('bonsCommande');
  openForm('bonCommande', {
    client:d.client, interlocuteur:d.interlocuteur||'', adresse:d.adresseLocataire||'', codePostal:d.codePostal||'', ville:d.ville||'',
    occupant:d.occupant||'', logementStatut:d.logementStatut||'', etage:d.etage||'', numeroLogement:d.numeroLogement||'',
    precisionCommune:d.precisionCommune||'', ancienLocataire:d.ancienLocataire||'',
    conducteur:d.conducteur||'', conducteurId:d.conducteurId||'', dateReception:todayISO(), montant: t.ht, lignes: JSON.parse(JSON.stringify(d.lignes||[])), devisId:d.id
  });
}
function setBCMode(mode){
  const e = state.editing;
  const grab = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  e.client = grab('bc_client') ?? e.client;
  e.interlocuteur = grab('bc_interlocuteur') ?? e.interlocuteur;
  e.devisId = grab('bc_devisId') ?? e.devisId;
  const numeroBCEl = document.getElementById('bc_numeroBC');
  if(numeroBCEl) e.numeroBC = numeroBCEl.value;
  e.adresse = grab('bc_adresse') ?? e.adresse;
  e.codePostal = grab('bc_codePostal') ?? e.codePostal;
  e.ville = grab('bc_ville') ?? e.ville;
  e.facturationAdresse = grab('bc_facturationAdresse') ?? e.facturationAdresse;
  e.facturationCodePostal = grab('bc_facturationCodePostal') ?? e.facturationCodePostal;
  e.facturationVille = grab('bc_facturationVille') ?? e.facturationVille;
  e.logementStatut = grab('bc_logementStatut') ?? e.logementStatut;
  e.precisionCommune = grab('bc_precisionCommune') ?? e.precisionCommune;
  e.ancienLocataire = grab('bc_ancienLocataire') ?? e.ancienLocataire;
  e.occupant = grab('bc_occupant') ?? e.occupant;
  e.etage = grab('bc_etage') ?? e.etage;
  e.numeroLogement = grab('bc_numeroLogement') ?? e.numeroLogement;
  e.dateReception = grab('bc_dateReception') ?? e.dateReception;
  e.dateFinTravaux = grab('bc_dateFinTravaux') ?? e.dateFinTravaux;
  e.montant = grab('bc_montant') ?? e.montant;
  const montantMetierEls = document.querySelectorAll('.bc_montant_metier');
  if(montantMetierEls.length){
    e.montantParMetier = {};
    montantMetierEls.forEach(el=>{ e.montantParMetier[el.dataset.metier] = el.value; });
  }
  e.notes = grab('bc_notes') ?? e.notes;
  if(document.getElementById('bc_conducteur')) Object.assign(e, conducteurDuSelect('bc_conducteur'));
  e.natureTravaux = grab('bc_natureTravaux') ?? e.natureTravaux;
  const checkedMetiers = document.querySelector('input[name="bc_metiers"]') ? getCheckedMetiers('bc') : null;
  if(checkedMetiers) e.metiers = checkedMetiers;
  e.sansBC = mode==='sansBC';
  e.enAttenteBC = mode==='attenteBC';
  const zone = document.getElementById('formZoneBonCommande');
  if(zone) zone.innerHTML = bonCommandeForm();
}
/* Le document n'est plus encodé en data-URL : il part au stockage à
   l'enregistrement. Il passe par la même préparation que la lecture
   automatique — un HEIC d'iPhone y devient un JPEG — et par le même contrôle,
   pour que les deux zones de dépôt n'acceptent pas des choses différentes. */
async function handleBCAttachment(inputEl){
  const brut = inputEl.files[0];
  if(!brut) return;
  let file = brut;
  try{
    file = await window.preparerPieceJointe(brut);
  }catch(err){
    console.error('Préparation de la pièce jointe impossible', err);
    showToast(err.message || "Ce fichier n'a pas pu être préparé.");
    inputEl.value = '';
    return;
  }
  const verdict = window.verifierPieceJointe({ nom: file.name, type: file.type, taille: file.size });
  if(!verdict.ok){ showToast(verdict.motif); inputEl.value=''; return; }
  retenirPieceJointeBC(file);
}

/* Le point de rendez-vous des deux dépôts : la lecture automatique et le champ
   manuel posent le même fichier au même endroit. */
function retenirPieceJointeBC(file){
  state.editing.pieceJointeFichier = file;
  state.editing.pieceJointeNom = file.name;
  state.editing.pieceJointeData = null;
  const preview = document.getElementById('bcAttachmentPreview');
  if(preview) preview.innerHTML = `<div class="card-sub" style="margin-bottom:6px;">📎 ${esc(file.name)} <button class="btn small danger" type="button" onclick="removeBCAttachment()">✕</button></div>`;
}

function removeBCAttachment(){
  state.editing.pieceJointeFichier = null;
  state.editing.pieceJointeData = null;
  state.editing.pieceJointeNom = '';
  /* `null` explicite, et non « absent » : c'est ce qui distingue « retirer la
     pièce » de « enregistrer sans y toucher », et donc ce qui décide si le
     document déjà stocké doit être effacé. */
  state.editing.pieceJointeChemin = null;
  const preview = document.getElementById('bcAttachmentPreview');
  if(preview) preview.innerHTML = '';
  const fileInput = document.getElementById('bc_pieceJointe');
  if(fileInput) fileInput.value = '';
}
/* Le second paramètre `ignorerValidationDirecteur` a été retiré. Il valait
   `true` depuis le seul chemin « rapport lié à un bon », ce qui laissait
   facturer un bon que personne n'avait validé — sans trace, sans rôle exigé,
   et sans que son `statut_workflow` bouge d'un cran en base. Le contournement
   existe toujours, mais il a un nom, un rôle et une ligne au journal : c'est
   la pré-facture validée hors circuit. Un seul drapeau fait foi ici,
   `valideDirecteur`, dérivé de l'état réel du bon. */
function transformerBonCommandeEnFacture(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  if(!b.valideDirecteur){ showToast('La validation du directeur est requise avant de pouvoir facturer ce bon de commande.'); return; }
  const dejaFacture = state.factures.find(f=>f.bonCommandeId===bcId);
  if(dejaFacture){
    showToast(`Ce bon de commande a déjà été transformé en facture (${dejaFacture.numero}). Ouvrez-la directement pour la modifier.`);
    return;
  }
  setTab('factures');
  state.facturesView = 'liste';
  openForm('facture', {
    /* L'adresse d'un BON est celle du CHANTIER ; sur une facture, `adresse`
       désigne le CLIENT — `saveDocument` la résout d'ailleurs toute seule.
       Recopier l'une dans l'autre laissait donc le lieu d'intervention vide
       alors qu'il était sous les yeux dans la pré-facture. Même repli que
       `bc_generer_facture` et que le chemin sous-traitant, qui le faisaient
       déjà bien. Le code postal et la ville ne partaient pas du tout. */
    client:b.client, occupant:b.occupant||'',
    adresseLocataire: b.adresseLocataire || b.adresse || '',
    codePostal: b.codePostal || '', ville: b.ville || '',
    logementStatut:b.logementStatut||'', etage:b.etage||'', numeroLogement:b.numeroLogement||'',
    precisionCommune:b.precisionCommune||'', ancienLocataire:b.ancienLocataire||'',
    interlocuteur:'', conducteur:b.conducteur||'', conducteurId:b.conducteurId||'',
    date:todayISO(), echeance:'',
    lignes: (b.lignes&&b.lignes.length)? JSON.parse(JSON.stringify(b.lignes)) : [{type:'ligne', designation:`Travaux — BC ${b.numeroBC||''}`, qte:1, prixUnitaire:b.montant||0, tva: tvaDefaut()}],
    remisePourcentage:0, bonCommandeId:b.id, chantierId:b.chantierId||null,
    /* Brouillon, comme les trois autres chemins de création. La secrétaire
       relit puis émet ; naître « impayée » figeait le document avant même
       qu'elle l'ait ouvert. */
    statut:'brouillon',
    /* BT-13 de l'EN 16931 : la référence de commande de l'acheteur. Normalisée
       par la même règle que `bc_generer_facture`, pour que les deux chemins de
       création ne produisent pas deux valeurs différentes. */
    refBonCommandeClient: window.refBonCommandeClient(b.numeroBC),
    interventionId: (state.interventions.find(x=>x.bonCommandeId===b.id)||{}).id || null
  });
}
function transformerBonCommandeEnSAV(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  const dejaSAV = state.bonsCommande.find(x=>x.bonCommandeId===bcId);
  if(dejaSAV){
    showToast(`Un SAV a déjà été créé pour ce bon de commande (${dejaSAV.numeroBC}). Ouvrez-le directement pour le modifier.`);
    return;
  }
  setTab('bonsCommande');
  openForm('bonCommande', {
    client:b.client, interlocuteur:b.interlocuteur||'', adresse:b.adresse||'', codePostal:b.codePostal||'', ville:b.ville||'',
    occupant:b.occupant||'', logementStatut:b.logementStatut||'', etage:b.etage||'', numeroLogement:b.numeroLogement||'',
    precisionCommune:b.precisionCommune||'', ancienLocataire:b.ancienLocataire||'',
    conducteur:b.conducteur||'', conducteurId:b.conducteurId||'', metier:b.metier||'', dateReception:todayISO(),
    bonCommandeId:b.id, sansBC:true, problemeDescription:'', photos:[]
  });
}
function goToBonCommande(bcId){
  setTab('bonsCommande');
  setTimeout(()=>{
    const el = document.getElementById('bonCommande-card-'+bcId);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('flash-highlight');
      setTimeout(()=> el.classList.remove('flash-highlight'), 1300);
    }
  }, 80);
}
function goToDevis(devisId){
  setTab('devis');
  setTimeout(()=>{
    const el = document.getElementById('devis-card-'+devisId);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('flash-highlight');
      setTimeout(()=>{
        el.classList.remove('flash-highlight');
        openViewDoc('devis', devisId);
      }, 1300);
    } else {
      openViewDoc('devis', devisId);
    }
  }, 80);
}
function goToFacture(factureId){
  setTab('factures');
  state.facturesView = 'liste';
  setTimeout(()=>{
    const el = document.getElementById('facture-card-'+factureId);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('flash-highlight');
      setTimeout(()=>{
        el.classList.remove('flash-highlight');
        openViewDoc('facture', factureId);
      }, 1300);
    } else {
      openViewDoc('facture', factureId);
    }
  }, 80);
}
function openViewDoc(type, id){
  const doc = (type==='devis' ? state.devis : state.factures).find(x=>x.id===id);
  if(!doc) return;
  state.viewingDoc = {kind:type, id};
  const modal = document.getElementById('viewInterventionModal');
  const content = document.getElementById('viewInterventionContent');
  if(content) content.innerHTML = renderPrintDoc(type, id, state.ghostMode);
  if(modal) modal.classList.add('open');
}
function goToIntervention(interventionId){
  setTab('interventions');
  setTimeout(()=>{
    const el = document.getElementById('intervention-card-'+interventionId);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.classList.add('flash-highlight');
      setTimeout(()=>{
        el.classList.remove('flash-highlight');
        openViewIntervention(interventionId);
      }, 1300);
    } else {
      openViewIntervention(interventionId);
    }
  }, 80);
}
function openViewIntervention(interventionId){
  const it = state.interventions.find(x=>x.id===interventionId);
  if(!it) return;
  state.viewingDoc = {kind:'intervention', id:interventionId};
  const modal = document.getElementById('viewInterventionModal');
  const content = document.getElementById('viewInterventionContent');
  if(content) content.innerHTML = renderPrintIntervention(it);
  if(modal) modal.classList.add('open');
}
function setPrintOrientation(orientation){
  let style = document.getElementById('printOrientationStyle');
  if(!style){ style = document.createElement('style'); style.id = 'printOrientationStyle'; document.head.appendChild(style); }
  style.textContent = `@media print{ @page{ size: ${orientation}; margin:10mm; } }`;
}
function printPlanning(assigneeField){
  const area = document.getElementById('printArea');
  if(!area) return;
  const societeNom = (SOCIETES.find(s=>s.id===state.societeId)||{}).nom || '';
  const monday = currentWeekStart();
  const days = weekDays(monday);
  const weekEnd = days[6];
  const weekLabel = `${days[0].dayNum} ${days[0].month} — ${weekEnd.dayNum} ${weekEnd.month} ${new Date(monday+'T00:00:00').getFullYear()}`;
  const all = planningItems();
  const isSousTraitant = assigneeField === 'sousTraitant';

  // Colonnes = techniciens/sous-traitants distincts ayant au moins une tâche planifiée cette semaine (+ "Non assigné" si besoin)
  const weekItems = all.filter(b=>b.datePlanifiee && days.some(d=> d.iso>=b.datePlanifiee && d.iso<=(b.datePlanifieeFin||b.datePlanifiee)));
  const assigneeLabelOf = (b) => {
    if(isSousTraitant) return b.sousTraitant || 'Non assigné';
    if(!b.technicien) return 'Non assigné';
    const t = state.techniciens.find(x=>x.id===b.technicien || technicienLabel(x)===b.technicien);
    return t ? technicienLabel(t) : b.technicien;
  };
  let colonnes = Array.from(new Set(weekItems.map(assigneeLabelOf)));
  colonnes.sort((a,b)=> a==='Non assigné'? 1 : b==='Non assigné'? -1 : a.localeCompare(b));
  if(!colonnes.length) colonnes = ['Non assigné'];

  const headerRow = `<tr><th style="width:26mm;"></th>${colonnes.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>`;
  const bodyRows = days.map(d=>{
    const cells = colonnes.map(col=>{
      const items = weekItems.filter(b=> d.iso>=b.datePlanifiee && d.iso<=(b.datePlanifieeFin||b.datePlanifiee) && assigneeLabelOf(b)===col)
        .sort((a,b)=>(a.heurePlanifiee||'').localeCompare(b.heurePlanifiee||''));
      return `<td class="p-work-cell">${items.length? items.map(b=>`
        <div class="p-print-job">
          <b>${esc(b.client||'')}</b>
          <span class="p-job-adresse">${esc(withVille(b.adresse, b.codePostal, b.ville))}</span><br>
          <span class="p-job-metier">${b.metier? esc(metierDisplayLabel(b.metier)) : ''}</span>${b.heurePlanifiee? ' · '+b.heurePlanifiee:''}
        </div>`).join('') : '<div class="p-print-empty-cell">—</div>'}</td>`;
    }).join('');
    return `<tr><td class="p-day-cell">${d.label}<br>${d.dayNum} ${d.month}${isJourFerie(d.iso)?'<br>Férié':''}</td>${cells}</tr>`;
  }).join('');

  area.innerHTML = `
    <div class="p-print-planning">
      <h1>${esc(societeNom)} — Planning ${isSousTraitant?'Sous-traitants':'Techniciens'}</h1>
      <div class="p-print-weeklabel">Semaine du ${weekLabel}</div>
      <table class="p-print-grid">
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  area.classList.add('is-landscape');
  area.style.display = 'block';
  setPrintOrientation('landscape');
  window.print();
  setTimeout(()=>{ area.style.display = 'none'; area.innerHTML = ''; area.classList.remove('is-landscape'); setPrintOrientation('portrait'); }, 500);
}
function printCurrentView(action){
  const v = state.viewingDoc;
  if(!v) return;
  if(v.kind === 'intervention'){
    printInterventionDocument(v.id, action);
  } else {
    printDocument(v.kind, v.id, action);
  }
}
function closeViewIntervention(){
  const modal = document.getElementById('viewInterventionModal');
  if(modal) modal.classList.remove('open');
}
function closeViewOnBackdrop(ev){
  if(ev.target === ev.currentTarget) closeViewIntervention();
}
function voirFactureDepuisDevis(factureId){ goToFacture(factureId); }
function voirDevisDepuisFacture(devisId){ goToDevis(devisId); }
function parsePreconisationsEnLignes(texte, fallback){
  const lignes = (texte||'').split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lignes.length) return [{type:'ligne', designation: fallback||'', qte:1, unite:'u', prixUnitaire:0, tva: tvaDefaut()}];
  return lignes.map(l=>{
    const m = l.match(/^(.*?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Zµ²³%]*)\s*$/i);
    if(m) return {type:'ligne', designation: m[1].trim(), qte: parseFloat(m[2].replace(',','.'))||1, unite: m[3]? m[3] : 'u', prixUnitaire:0, tva: tvaDefaut()};
    return {type:'ligne', designation: l, qte:1, unite:'u', prixUnitaire:0, tva: tvaDefaut()};
  });
}
function transformerInterventionEn(type, interventionId){
  const i = state.interventions.find(x=>x.id===interventionId);
  if(!i) return;
  const cible = type==='devis' ? state.devis.find(d=>d.interventionId===interventionId) : state.factures.find(f=>f.interventionId===interventionId || (i.bonCommandeId && f.bonCommandeId===i.bonCommandeId));
  if(cible){
    showToast(`Ce rapport a déjà été transformé en ${type==='devis'?'devis':'facture'} (${cible.numero}). Ouvrez-${type==='devis'?'le':'la'} directement pour ${type==='devis'?'le':'la'} modifier.`);
    return;
  }
  /* Un rapport rattaché à un bon ne facture pas à côté de lui : il facture le
     bon, avec son contenu chiffré. Ce chemin forçait jusqu'ici la validation du
     directeur par un simple drapeau — le bon partait en facturation en restant
     « en cours » en base, et rien ne disait qu'on avait sauté le circuit.
     Il emprunte désormais la même porte que tout le monde : la pré-facture. */
  if(type==='facture' && i.bonCommandeId){
    const bcLie = state.bonsCommande.find(b=>b.id===i.bonCommandeId);
    if(bcLie){
      if(!bcLie.valideDirecteur){
        const droits = window.actionsFacturation ? window.actionsFacturation() : {};
        if(!droits.peutFacturerHorsCircuit){
          showToast('🔗 Ce rapport facture le bon de commande lié '+(bcLie.numeroBC||'')+', dont la pré-facture n\'est pas encore validée.', 'danger', 6000);
          return;
        }
        showToast('🔗 Bon de commande lié '+(bcLie.numeroBC||'')+' : chiffrez-le ici, puis validez — sans passer par le planning si besoin.', 'success', 5000);
        setTab('bonsCommande');
        openValidationDirecteurModal(bcLie.id);
        return;
      }
      showToast('🔗 Facturation du bon de commande lié '+(bcLie.numeroBC||'')+' (contenu chiffré du BC).', 'success', 3000);
      transformerBonCommandeEnFacture(bcLie.id);
      return;
    }
  }
  setTab(type==='devis' ? 'devis' : 'factures');
  const designationSuggeree = i.typePanne || '';
  const lignesSuggerees = (i.rapport && i.rapport.preconisations && i.rapport.preconisations.trim())
    ? parsePreconisationsEnLignes(i.rapport.preconisations)
    : [{type:'ligne', designation: (i.rapport && i.rapport.constatations) ? i.rapport.constatations : designationSuggeree, qte:1, unite:'u', prixUnitaire:0, tva: tvaDefaut()}];
  const prefill = {
    client: i.client, adresse: i.adresse, occupant: i.occupant||'', adresseLocataire: i.adresseLocataire||'',
    interlocuteur: i.interlocuteur||'',
    logementStatut: i.logementStatut||'', etage: i.etage||'', numeroLogement: i.numeroLogement||'', precisionCommune: i.precisionCommune||'', ancienLocataire: i.ancienLocataire||'',
    date: todayISO(), lignes: lignesSuggerees,
    statut:'brouillon', interventionId: i.id
  };
  if(type === 'facture') prefill.echeance = '';
  openForm(type, prefill);
}

/* ---------- Factures ---------- */
function renderFactures(){
  const soc = state.societeId;
  const estST = estSousTraitant();
  const view = state.facturesView || 'liste';
  if(estST){
    const mesFactures = facturesDuSousTraitant();
    const bcsKTA = bcFacturesKTA();
    const nbPretes = bcsKTA.filter(b=>b.montantSousTraitant!=null && !factureSTQuiCouvre(b.id)).length;
    return `
    <div class="plus-subnav" style="justify-content:center;">
      <button class="plus-subnav-btn ${view==='liste'?'active':''}" onclick="setFacturesView('liste')">Mes factures</button>
      <button class="plus-subnav-btn ${view==='factureskta'?'active':''}" onclick="setFacturesView('factureskta')">Factures ${esc(societeName(soc))} ${nbPretes? `(${nbPretes})`:''}</button>
      <button class="plus-subnav-btn ${view==='reglements'?'active':''}" onclick="setFacturesView('reglements')">Règlements</button>
    </div>
    <div class="page-head"><h1>${view==='reglements'?'Règlements': view==='factureskta'? 'Factures '+esc(societeName(soc)) : 'Mes factures'}</h1></div>
    ${view==='liste'? (mesFactures.length? mesFactures.map(f=>factureSTCardHTML(f)).join('') : '<div class="empty">Aucune facture pour l\'instant. Retrouvez vos factures pré-remplies dans l\'onglet « Factures '+esc(societeName(soc))+' ».</div>') : ''}
    ${view==='factureskta'? renderFacturesKTAHTML(bcsKTA) : ''}
    ${view==='reglements'? renderReglements(true) : ''}
    `;
  }
  const list = state.factures.filter(f=>f.societeId===soc && !f.sousTraitantEmetteur);
  /* La file ne montrait que les bons entièrement validés — 122 sur 496 en
     production. Le directeur ne voyait donc rien venir : ni les 88 bons dont
     les travaux ont commencé sans être terminés, ni la raison de leur attente.
     La règle vit dans `regles-bc.ts`, avec ses cas. */
  const enValidation = state.bonsCommande.filter(b=>b.societeId===soc && window.etapeValidation(b) !== 'hors_file');
  const aFacturer = state.bonsCommande.filter(b=>b.societeId===soc && b.valideDirecteur && !state.factures.some(f=>f.bonCommandeId===b.id));
  /* Les avoirs restent AUSSI dans la liste des factures : ce sont des pièces
     comptables de la même suite, et les en retirer ici sans le faire dans
     `filterFacturesList` les aurait fait réapparaître à la première frappe —
     le défaut que ce fichier a déjà connu avec les factures de sous-traitants.
     L'onglet ne les isole pas, il les rend trouvables. */
  const avoirs = list.filter(f=>window.estAvoir(f.typeDocument));
  return `
    <div class="plus-subnav" style="justify-content:center;">
      <button class="plus-subnav-btn ${view==='liste'?'active':''}" onclick="setFacturesView('liste')">Factures</button>
      <button class="plus-subnav-btn ${view==='avoirs'?'active':''}" onclick="setFacturesView('avoirs')">Avoirs ${avoirs.length? `(${avoirs.length})`:''}</button>
      <button class="plus-subnav-btn ${view==='validation'?'active':''}" onclick="setFacturesView('validation')">Validation ${enValidation.length? `(${enValidation.length})`:''}</button>
      <button class="plus-subnav-btn ${view==='afacturer'?'active':''}" onclick="setFacturesView('afacturer')">À facturer ${aFacturer.length? `(${aFacturer.length})`:''}</button>
      <button class="plus-subnav-btn ${view==='reglements'?'active':''}" onclick="setFacturesView('reglements')">Règlements</button>
    </div>
    <div class="page-head"><h1>${view==='reglements'?'Règlements': view==='avoirs'?'Avoirs':'Factures'}</h1>${(state.formOpen.facture || view!=='liste')? '' : '<button class="btn primary" onclick="openForm(\'facture\')">+ Nouvelle facture</button>'}</div>
    ${(state.formOpen.facture || view==='reglements') ? '' : barreFiltresFactures(view)}
    ${view==='liste'? `<div id="formZoneFacture">${state.formOpen.facture? factureForm() : ''}</div>
    ${state.formOpen.facture ? '' : `<div id="factureListZone">${renderFacturesListHTML(list)}</div>`}` : ''}
    ${view==='avoirs'? `<div class="card-sub" style="margin-bottom:14px;">Les avoirs rectifient une facture émise. Ils portent leur propre série « AV » et comptent en négatif ; leurs montants s'enregistrent positifs, le type dit le sens.</div>
    <div id="formZoneFacture">${state.formOpen.facture? factureForm() : ''}</div>
    ${state.formOpen.facture ? '' : `<div id="factureListZone">${avoirs.length? renderFacturesListHTML(avoirs, 'avoirs') : "<div class=\"empty\">Aucun avoir pour cette société. Un avoir s'établit depuis une facture émise, par le bouton « ↩ Établir un avoir ».</div>"}</div>`}` : ''}
    ${view==='validation'? `<div class="card-sub" style="margin-bottom:14px;">Bons de commande validés par le conducteur de travaux, en attente de validation par le directeur.</div>
    <div id="facturesWorkflowZone">${renderDossiersClients(enValidation, 'validation')}</div>` : ''}
    ${view==='afacturer'? `<div class="card-sub" style="margin-bottom:14px;">Bons de commande validés par le directeur — à facturer et envoyer au client.</div>
    <div id="facturesWorkflowZone">${renderDossiersClients(aFacturer, 'afacturer')}</div>` : ''}
    ${view==='reglements'? renderReglements(true) : ''}
  `;
}
/* ---------- Barre de recherche et de filtres des Factures ----------
   Les trois vues partagent la même barre et le même état : basculer de
   Factures à À facturer conserve la lentille en cours. Le descripteur dit
   quels filtres chaque vue affiche — la règle métier vit là, et non dans des
   conditions éparpillées dans le gabarit. */
const FILTRES_FACTURES = {
  liste:      ['recherche','client','interlocuteur','conducteur','logement','reglement','periode'],
  avoirs:     ['recherche','client','conducteur','periode'],
  validation: ['recherche','client','interlocuteur','conducteur','metier','periode'],
  afacturer:  ['recherche','client','interlocuteur','conducteur','metier','periode'],
};
const CLE_ETAT_FILTRE = {
  recherche:'factureSearch', client:'factureClientFilter', interlocuteur:'factureInterlocuteurFilter',
  conducteur:'factureConducteurFilter', logement:'factureLogementFilter',
  metier:'factureMetierFilter', reglement:'factureReglementFilter', periode:'facturePeriode',
};

/* Un filtre que la vue n'affiche pas ne doit jamais s'appliquer : sinon un
   statut de règlement posé sur la liste viderait la vue Validation sans que
   rien à l'écran ne l'explique. */
function critereFactures(cle, vue){
  return (FILTRES_FACTURES[vue]||[]).includes(cle) ? (state[CLE_ETAT_FILTRE[cle]] || '') : '';
}

function criteresFactures(vue){
  const periode = critereFactures('periode', vue) || 'tout';
  return {
    recherche: critereFactures('recherche', vue),
    client: critereFactures('client', vue),
    interlocuteur: critereFactures('interlocuteur', vue),
    conducteur: critereFactures('conducteur', vue),
    logement: critereFactures('logement', vue),
    metier: critereFactures('metier', vue),
    reglement: critereFactures('reglement', vue),
    periode,
    du: state.facturePeriodeDebut || '',
    au: state.facturePeriodeFin || '',
  };
}

function filtrageFacturesActif(vue){
  const c = criteresFactures(vue);
  return !!(c.recherche || c.client || c.interlocuteur || c.conducteur || c.logement
    || c.metier || c.reglement || (c.periode && c.periode !== 'tout'));
}

function champFiltreFactures(cle, vue){
  const v = critereFactures(cle, vue);
  switch(cle){
    case 'recherche':
      return `<input type="text" id="factureSearchInput" style="flex:1; min-width:240px;" value="${esc(v)}"
        placeholder="Rechercher : client, n°, adresse, locataire, prestation, montant…"
        oninput="filterFacturesList(this.value)" onkeydown="searchEnterCycle(event,'${vue==='liste'?'facture':'bonCommande'}')">`;
    case 'client':
      return `<select style="width:auto; min-width:170px;" onchange="filterFactureClient(this.value)">${planningUnschedClientOptions(v)}</select>`;
    case 'interlocuteur':
      return `<select id="factureInterlocuteurSelect" style="width:auto; min-width:190px;" onchange="filterFactureCritere('interlocuteur', this.value)">${planningUnschedInterlocuteurOptions(v, critereFactures('client', vue))}</select>`;
    case 'conducteur':
      return `<select style="width:auto; min-width:180px;" onchange="filterFactureCritere('conducteur', this.value)">${conducteurFilterOptions(v)}</select>`;
    case 'logement':
      return `<select style="width:auto; min-width:170px;" onchange="filterFactureCritere('logement', this.value)">${logementFilterOptions(v)}</select>`;
    case 'metier':
      return `<select style="width:auto; min-width:160px;" onchange="filterFactureCritere('metier', this.value)">${metierPersoFilterOptions(v)}</select>`;
    case 'reglement':
      return `<select style="width:auto; min-width:170px;" onchange="filterFactureCritere('reglement', this.value)">
        ${[['','Tous les règlements'],['payee','✅ Payées'],['partiel','🟡 Partielles'],['impayee','🔴 Impayées'],['retard','⏰ En retard']]
          .map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('')}
      </select>`;
    case 'periode':
      return `<select style="width:auto; min-width:170px;" onchange="filterFacturePeriode(this.value)">
        ${[['tout',"Toute la période"],['mois','Ce mois-ci'],['annee','Cette année'],['plage','Période personnalisée…']]
          .map(([k,l])=>`<option value="${k}" ${k===(v||'tout')?'selected':''}>${l}</option>`).join('')}
      </select>
      ${v==='plage'? `<input type="date" style="width:auto;" value="${esc(state.facturePeriodeDebut)}" onchange="filterFactureBorne('debut', this.value)" title="Du">
        <input type="date" style="width:auto;" value="${esc(state.facturePeriodeFin)}" onchange="filterFactureBorne('fin', this.value)" title="Au">` : ''}`;
    default: return '';
  }
}

function barreFiltresFactures(vue){
  return `<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
    ${(FILTRES_FACTURES[vue]||[]).map(c=>champFiltreFactures(c, vue)).join('')}
    ${filtrageFacturesActif(vue)? `<button class="btn small ghost" onclick="reinitialiserFiltresFactures()" title="Tout réafficher">✕ Effacer</button>` : ''}
  </div>`;
}

/* Sources de vérité des listes. `renderFactures` écartait les factures émises
   par les sous-traitants, mais les gestionnaires de filtre reconstruisaient la
   liste sans ce garde-fou : elles réapparaissaient dès la première frappe. */
function facturesDeLaSociete(){
  return state.factures.filter(f=>f.societeId===state.societeId && !f.sousTraitantEmetteur);
}
function bonsDeLaVue(vue){
  const soc = state.societeId;
  if(vue==='validation') return state.bonsCommande.filter(b=>b.societeId===soc && b.valideConducteur && !b.valideDirecteur);
  if(vue==='afacturer') return state.bonsCommande.filter(b=>b.societeId===soc && b.valideDirecteur && !state.factures.some(f=>f.bonCommandeId===b.id));
  return [];
}

/* Contexte que le module de recherche ne peut pas calculer seul : les montants
   dépendent de la remise, le statut de règlement des règlements enregistrés. */
function contexteFacture(f){
  const st = reglementStatutFacture(f);
  const etiquettes = [st.cle==='reglee'? 'payee' : st.cle==='partiellement_reglee'? 'partiel' : 'impayee'];
  // Une facture en retard reste impayée : les deux filtres doivent la trouver
  if(st.reste > 0.01 && (joursDepuisEcheance(f)||0) > 0) etiquettes.push('retard');
  return { extras: montantsCherchables(f), reglements: etiquettes };
}
function contexteBonCommande(b){
  const montant = parseFloat(b.montant) || 0;
  return { extras: [money(montant), montant.toFixed(2)], metiers: bcMetiersDuBC(b) };
}

/* Une seule injection ciblée pour tous les filtres : le champ de recherche
   n'est jamais recréé, il garde donc son focus et son curseur. */
function rafraichirZoneFactures(){
  const vue = state.facturesView || 'liste';
  if(vue === 'liste'){
    const zone = document.getElementById('factureListZone');
    if(zone) zone.innerHTML = renderFacturesListHTML(facturesDeLaSociete());
    return;
  }
  /* La vue des avoirs partage la zone et le gabarit de la liste, pas ceux des
     dossiers : sans ce cas, filtrer depuis l'onglet Avoirs tombait dans la
     branche des bons de commande et vidait l'écran. Et la vue se passe en
     second argument — la liste sans lui reprend les critères de « liste », donc
     ceux d'un autre onglet. */
  if(vue === 'avoirs'){
    const zone = document.getElementById('factureListZone');
    if(zone) zone.innerHTML = renderFacturesListHTML(
      facturesDeLaSociete().filter(f=>window.estAvoir(f.typeDocument)), 'avoirs');
    return;
  }
  const zone = document.getElementById('facturesWorkflowZone');
  if(zone) zone.innerHTML = renderDossiersClients(bonsDeLaVue(vue), vue);
}

function filterFactureCritere(cle, valeur){
  state[CLE_ETAT_FILTRE[cle]] = valeur;
  rafraichirZoneFactures();
}
function filterFacturesList(valeur){ filterFactureCritere('recherche', valeur); }
function filterFactureConducteur(v){ filterFactureCritere('conducteur', v); }
function filterFactureLogement(v){ filterFactureCritere('logement', v); }
function filterFactureInterlocuteur(v){ filterFactureCritere('interlocuteur', v); }

/* Le choix d'interlocuteur appartient au client précédent : on le remet à zéro
   et on régénère la seule liste dépendante, sans re-rendre tout l'écran. */
function filterFactureClient(valeur){
  state.factureClientFilter = valeur;
  state.factureInterlocuteurFilter = '';
  const sel = document.getElementById('factureInterlocuteurSelect');
  if(sel) sel.innerHTML = planningUnschedInterlocuteurOptions('', valeur);
  rafraichirZoneFactures();
}

function filterFacturePeriode(valeur){
  state.facturePeriode = valeur;
  // Les bornes n'ont de sens que sur une plage : les révéler impose un rendu
  renderTab();
}
function filterFactureBorne(borne, valeur){
  if(borne==='debut') state.facturePeriodeDebut = valeur; else state.facturePeriodeFin = valeur;
  rafraichirZoneFactures();
}
function reinitialiserFiltresFactures(){
  Object.values(CLE_ETAT_FILTRE).forEach(k=>{ state[k] = ''; });
  state.facturePeriode = 'tout';
  state.facturePeriodeDebut = ''; state.facturePeriodeFin = '';
  renderTab();
}

function renderDossiersClients(list, workflowCtx){
  const vide = workflowCtx==='validation'
    ? 'Aucun bon de commande en attente de validation.'
    : 'Aucun bon de commande à facturer.';
  if(!list.length) return `<div class="empty">${vide}</div>`;

  const criteres = criteresFactures(workflowCtx);
  const actif = filtrageFacturesActif(workflowCtx);
  const retenus = window.filtrerDocuments(list, criteres, contexteBonCommande);

  /* Une file non vide dont rien ne correspond n'est pas une file vide : les
     confondre ferait croire qu'il n'y a plus rien à traiter. */
  if(!retenus.length){
    return `<div class="empty">Aucun bon de commande ne correspond à votre recherche.</div>`;
  }

  const groupes = window.grouperParClient(retenus);
  const synthese = actif
    ? `<div class="card-sub" style="margin-bottom:10px;">${retenus.length} bon${retenus.length>1?'s':''} de commande · ${groupes.length} client${groupes.length>1?'s':''}</div>`
    : '';

  return synthese + groupes.map(({client, documents})=>{
    const cle = 'dossier:'+workflowCtx+':'+client;
    /* Pendant une recherche, la contrainte « un seul dossier ouvert » devient
       nuisible : un dossier fermé ne rend pas ses cartes, on chercherait donc
       dans du vide. */
    const ouvert = actif || state.dossierOuvert === cle;
    const noms = documents.map(b=>b.numeroBC).filter(Boolean).join(', ');
    /* Les dossiers sont fermés par défaut : sans ce compte, le directeur ne
       saurait qu'en ouvrant que la moitié de sa file n'est pas chiffrable. */
    const enCours = workflowCtx==='validation' && window.etapeValidation
      ? documents.filter(b=>window.etapeValidation(b)==='travaux_en_cours').length
      : 0;
    return `<div class="dossier-client">
      <div class="dossier-header" onclick="toggleDossier('${jsAttr(cle)}')">
        <span class="dossier-icon">${ouvert? '📂':'📁'}</span>
        <span class="dossier-nom">${esc(client)}</span>
        <span class="dossier-badge">${documents.length}</span>
        ${enCours? `<span class="dossier-attente" title="Travaux non terminés — pas encore chiffrables">⏳ ${enCours}</span>`:''}
        ${!ouvert? `<span class="dossier-apercu">${esc(noms)}</span>`:''}
        <span class="dossier-chevron">${ouvert? '▲':'▼'}</span>
      </div>
      ${ouvert? `<div class="dossier-contenu">${documents.map(b=>bonCommandeCardHTML(b, workflowCtx)).join('')}</div>` : ''}
    </div>`;
  }).join('');
}
function toggleDossier(cle){
  state.dossierOuvert = state.dossierOuvert===cle ? null : cle;
  renderTab();
}
function factureSTQuiCouvre(bcId){
  return state.factures.find(f=> f.bonCommandeKTAId===bcId || (f.bonCommandeKTAIds||[]).includes(bcId));
}
function toggleSTFactureSelection(bcId){
  const sel = state.stFactureSelection || (state.stFactureSelection = []);
  const idx = sel.indexOf(bcId);
  if(idx>=0) sel.splice(idx,1); else sel.push(bcId);
  renderTab();
}
async function creerFactureGroupeeST(){
  const sel = (state.stFactureSelection||[]).filter(id=>{
    const b = state.bonsCommande.find(x=>x.id===id);
    return b && b.montantSousTraitant!=null && !factureSTQuiCouvre(id);
  });
  if(!sel.length) return;
  const bcs = sel.map(id=>state.bonsCommande.find(x=>x.id===id));
  const id = uid();
  const ym = todayISO().slice(0,7);
  const dejaCeMois = state.factures.filter(f=>(f.numero||'').startsWith('FST-M'+ym)).length;
  const numero = 'FST-M'+ym + (dejaCeMois? '-'+(dejaCeMois+1) : '');
  const lignes = [];
  bcs.forEach(b=>{
    lignes.push({type:'ligne', designation:`Travaux sous-traités — BC n° ${b.numeroBC||''}${b.adresseLocataire||b.adresse? ' — '+(b.adresseLocataire||b.adresse):''}`, qte:1, unite:'forfait', prixUnitaire: b.montantSousTraitant, tva:0});
    (b.lignes||[]).filter(l=>(l.type||'ligne')==='ligne').forEach(l=>{
      lignes.push({type:'commentaire', designation:`— ${l.designation}${l.qte? ' ('+l.qte+' '+(l.unite||'u')+')':''}`});
    });
  });
  lignes.push({type:'commentaire', designation:'TVA non applicable — autoliquidation (art. 283, 2 nonies du CGI)'});
  const obj = {
    id, societeId: state.societeId, numero, createdAt: new Date().toISOString(),
    sousTraitantEmetteur: sousTraitantActuel() || bcs[0].sousTraitant || '',
    bonCommandeKTAIds: sel.slice(),
    client: societeName(state.societeId),
    adresse: '', date: todayISO(), echeance: '', statut:'impayée',
    lignes,
  };
  const r = await window.stSet('facture:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  state.stFactureSelection = [];
  await recharger('facture');
  renderTab();
  showToast('🧾 Facture mensuelle '+numero+' créée ('+sel.length+' bons regroupés) !', 'success', 3000);
}
function renderFacturesKTAHTML(bcs){
  if(!bcs.length) return `<div class="empty">Aucune facture prête pour l'instant. Elles apparaissent ici une fois vos travaux validés par le conducteur de travaux.</div>`;
  const sel = state.stFactureSelection || [];
  const selValides = sel.filter(id=>{ const b = state.bonsCommande.find(x=>x.id===id); return b && b.montantSousTraitant!=null && !factureSTQuiCouvre(id); });
  const totalSel = selValides.reduce((s,id)=> s + (state.bonsCommande.find(x=>x.id===id).montantSousTraitant||0), 0);
  return `<div class="card-sub" style="margin-bottom:14px;">Travaux validés par le conducteur de travaux de ${esc(societeName(state.societeId))} — votre facture est déjà pré-remplie. Facturez chaque bon individuellement, ou cochez plusieurs bons pour les regrouper sur une seule facture mensuelle.</div>
  ${selValides.length? `<div class="card" style="border-color:var(--accent); background:var(--accent-soft); display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
    <b>${selValides.length} bon${selValides.length>1?'s':''} sélectionné${selValides.length>1?'s':''} — ${moneyDisplay(totalSel)} HT</b>
    <button class="btn primary" onclick="creerFactureGroupeeST()">🧾 Facturer la sélection (facture mensuelle regroupée)</button>
  </div>`:''}` +
  bcs.map(b=>{
    const factureCreee = factureSTQuiCouvre(b.id);
    const adresse = withVille(b.adresseLocataire||b.adresse, b.codePostal, b.ville);
    const lignes = (b.lignes||[]).filter(l=>(l.type||'ligne')==='ligne');
    const prixDefini = b.montantSousTraitant!=null;
    const coche = sel.includes(b.id);
    return `<div class="card ${coche?'':''}" style="${coche? 'border-color:var(--accent);':''}">
      <div class="card-row">
        <div style="display:flex; gap:10px; flex:1; min-width:0;">
          ${(!factureCreee && prixDefini)? `<input type="checkbox" ${coche?'checked':''} onchange="toggleSTFactureSelection('${jsAttr(b.id)}')" style="width:19px; height:19px; margin-top:2px; flex-shrink:0; cursor:pointer;" title="Sélectionner pour une facture mensuelle regroupée">`:''}
          <div style="flex:1; min-width:0;">
            <div class="card-title">BC n° ${esc(b.numeroBC||'—')} — ${esc(b.client||'')}</div>
            ${adresse? `<div class="card-sub">📍 Chantier : ${esc(adresse)}${b.numeroLogement? ' · N° '+esc(b.numeroLogement):''}</div>`:''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">${prixDefini? `<div class="amount" style="color:var(--success);">${moneyDisplay(b.montantSousTraitant)} HT</div><div class="card-sub">Montant convenu</div>` : `<span class="badge warn">Montant en cours de définition</span>`}</div>
      </div>
      ${lignes.length? `<table class="lignes-table" style="background:#fff; margin-top:10px;"><thead><tr><th style="width:60%;">Détail des travaux</th><th>Qté</th><th>Unité</th></tr></thead>
      <tbody>${lignes.map(l=>`<tr><td>${esc(l.designation)}</td><td>${l.qte}</td><td>${esc(l.unite||'u')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        ${factureCreee? `<span class="badge success">✓ Facture créée : ${esc(factureCreee.numero)}</span>` : prixDefini? `<button class="btn primary" onclick="creerFactureDepuisBCKTA('${jsAttr(b.id)}')">➕ Récupérer ma facture pré-remplie</button>` : `<span class="card-sub">Le bouton apparaîtra dès que ${esc(societeName(state.societeId))} aura défini votre montant.</span>`}
      </div>
    </div>`;
  }).join('');
}
async function creerFactureDepuisBCKTA(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b || b.montantSousTraitant==null) return;
  const id = uid();
  const numero = 'FST-' + ((b.numeroBC||'').replace(/\s/g,'') || id.slice(0,6));
  const lignesDetail = (b.lignes||[]).filter(l=>(l.type||'ligne')==='ligne').map(l=>({type:'commentaire', designation:`— ${l.designation}${l.qte? ' ('+l.qte+' '+(l.unite||'u')+')':''}`}));
  const obj = {
    id, societeId: state.societeId, numero, createdAt: new Date().toISOString(),
    sousTraitantEmetteur: sousTraitantActuel() || b.sousTraitant || '',
    bonCommandeKTAId: b.id,
    client: societeName(state.societeId),
    adresse: '', adresseLocataire: b.adresseLocataire||b.adresse||'', codePostal: b.codePostal||'', ville: b.ville||'',
    numeroLogement: b.numeroLogement||'', logementStatut: b.logementStatut||'',
    date: todayISO(), echeance: '', statut:'impayée',
    lignes: [
      {type:'ligne', designation:`Travaux sous-traités — BC n° ${b.numeroBC||''}`, qte:1, unite:'forfait', prixUnitaire: b.montantSousTraitant, tva:0},
      ...lignesDetail,
      {type:'commentaire', designation:'TVA non applicable — autoliquidation (art. 283, 2 nonies du CGI)'},
    ],
  };
  const r = await window.stSet('facture:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('facture');
  renderTab();
  showToast('🧾 Facture '+numero+' créée dans « Mes factures » !', 'success', 2500);
}
function factureSTCardHTML(f){
  const t = computeDocTotals(f);
  const bcIdsOrigine = f.bonCommandeKTAIds || (f.bonCommandeKTAId? [f.bonCommandeKTAId] : []);
  const numerosBCOrigine = bcIdsOrigine.map(id=>{ const b = state.bonsCommande.find(x=>x.id===id); return b? b.numeroBC : null; }).filter(Boolean);
  return `<div class="card">
    <div class="card-row">
      <div style="flex:1; min-width:0;">
        <div class="card-title">${esc(f.client||'')}</div>
        <div class="card-sub"><span class="numref-lg">${esc(f.numero||'')}</span> · ${fmtDate(f.date)}</div>
        ${numerosBCOrigine.length? `<div class="card-sub">Bon${numerosBCOrigine.length>1?'s':''} de commande : ${numerosBCOrigine.map(esc).join(', ')}</div>`:''}
        ${f.adresseLocataire? `<div class="card-sub">📍 ${esc(withVille(f.adresseLocataire, f.codePostal, f.ville))}</div>`:''}
      </div>
      <div style="text-align:right; flex-shrink:0;"><div class="amount">${moneyDisplay(t.ttc)}</div><span class="badge ${badgeClass(f.statut)}" style="margin-top:5px; display:inline-block;">${esc(f.statut)}</span></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn small" onclick="printDocument('facture','${jsAttr(f.id)}','save')">Imprimer / PDF</button>
      ${f.statut==='impayée'? `<button class="btn small" onclick="marquerFactureSTPayee('${jsAttr(f.id)}')">✓ Marquer payée</button>`:''}
    </div>
  </div>`;
}
async function marquerFactureSTPayee(factureId){
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;
  f.statut = 'payée';
  const r = await window.stSet('facture:'+factureId, f);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('facture');
  renderTab();
}
function setFacturesView(view){
  state.facturesView = view;
  renderTab();
}
function factureMatchesSearch(f, q){
  return !q || window.multiWordMatch(factureSearchHaystack(f), q);
}
/* Cinq fonctions vivaient ici en double, réécrivant celles que la section des
   filtres déclare plus haut. En JavaScript, la dernière déclaration l'emporte :
   ce sont ces copies-ci qui tournaient, et le correctif d'au-dessus n'avait
   jamais rien corrigé. Elles reconstruisaient la liste depuis `state.factures`
   sans écarter les factures émises par les sous-traitants — le défaut que
   `facturesDeLaSociete()` avait justement été écrit pour fermer — et sans
   passer la vue, si bien qu'une frappe dans la recherche de l'onglet Avoirs y
   faisait réapparaître toutes les factures.

   Supprimées, donc, au profit de `filterFactureCritere` + `rafraichirZoneFactures`.
   Rien ne signalait ce doublon : ce fichier échappe au contrôle de types. */
function renderFacturesListHTML(list, vue){
  const criteres = criteresFactures(vue || 'liste');
  const filtered = window.filtrerDocuments(list, criteres, contexteFacture);
  return filtered.map(f=>{
    const t = computeDocTotals(f);
    /* L'état de règlement se déduit des règlements enregistrés ; le `statut`
       stocké ne distingue pas le partiel du non-réglé, et une facture réglée à
       moitié se lisait « impayée » sans qu'on sache qu'un acompte était tombé. */
    const reg = reglementStatutFacture(f);
    const estUnAvoir = window.estAvoir(f.typeDocument);
    const rectifiee = f.factureRectifieeId ? state.factures.find(x=>x.id===f.factureRectifieeId) : null;
    const devisOrigine = f.devisId ? state.devis.find(d=>d.id===f.devisId) : null;
    const rapportOrigine = f.interventionId ? state.interventions.find(i=>i.id===f.interventionId) : null;
    const bonCommandeOrigine = f.bonCommandeId ? state.bonsCommande.find(b=>b.id===f.bonCommandeId) : null;
    return `<div class="card" id="facture-card-${f.id}" style="cursor:pointer;" onclick="cardRowClick(event,'facture','${jsAttr(f.id)}')"><div class="card-row">
      <div style="flex:1; min-width:0;"><div class="card-title">${esc(f.client)} ${estUnAvoir?'<span class="badge warn" title="Avoir : il rectifie une facture émise">AVOIR</span>':''}${f.verrouillee?'<span title="Facture verrouillée (déjà téléchargée/envoyée)">🔒</span>':''}</div><div class="card-sub"><span class="numref-lg">${f.numero? esc(f.numero) : 'Brouillon — non émise'}</span> · ${fmtDate(f.date)}${f.echeance? ' · échéance '+fmtDate(f.echeance)+(f.conditionsReglement? ' ('+esc(f.conditionsReglement)+')':''):''}${f.modePaiement? ' · 💶 '+esc(libelleModePaiement(f.modePaiement)):''}${f.interlocuteur? ' · 👤 '+esc(f.interlocuteur):''}${f.conducteur? ' · 🦺 '+esc(f.conducteur):''}</div>${locataireCardLine(f)}
      ${devisOrigine? `<div class="card-sub">Devis d'origine : <a href="javascript:void(0)" onclick="goToDevis('${jsAttr(devisOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(devisOrigine.numero)}</a></div>`:''}
      ${rapportOrigine? `<div class="card-sub">Rapport d'origine : <a href="javascript:void(0)" onclick="goToIntervention('${jsAttr(rapportOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(rapportOrigine.numero)}</a></div>`:''}
      ${rectifiee? `<div class="card-sub">Rectifie la facture : <a href="javascript:void(0)" onclick="event.stopPropagation(); goToFacture('${jsAttr(rectifiee.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(rectifiee.numero)}</a>${f.motifRectification? ' · '+esc(f.motifRectification):''}</div>`:''}
      ${bonCommandeOrigine? `<div class="card-sub">Bon de commande d'origine : <a href="javascript:void(0)" onclick="event.stopPropagation(); ouvrirBonCommandeOrigine('${jsAttr(bonCommandeOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;" title="${bonCommandeOrigine.pieceJointeChemin? 'Voir le bon reçu du client' : 'Aller au bon de commande'}">${esc(bonCommandeOrigine.numeroBC)}${bonCommandeOrigine.pieceJointeChemin? ' 📎':''}</a></div>`:''}
      </div>
      <div style="text-align:right; flex-shrink:0;"><div class="amount">${moneyDisplay(t.ht)} <small style="font-weight:400; color:var(--text-dim); font-size:11px;">HT</small></div><div class="card-sub">${moneyDisplay(t.ttc)} TTC</div>${t.remisePct>0? `<div class="card-sub" style="margin-top:2px;">remise ${t.remisePct}%</div>`:''}${reg.paye > 0.004 ? `<div class="card-sub" style="margin-top:2px;">réglé ${moneyDisplay(reg.paye)}${reg.reste > 0.004? ' · reste '+moneyDisplay(reg.reste):''}</div>`:''}<div style="display:flex; gap:6px; align-items:center; justify-content:flex-end; margin-top:5px;">${logementBadge(f.logementStatut)}${estUnAvoir
        ? /* Un total négatif donne un reste à payer nul : le calcul de règlement
             concluait « Réglée », en vert, sur un avoir que personne n'a encore
             imputé. Ni ce badge ni l'échéance n'ont de sens ici — l'avoir
             s'impute sur une facture, il ne s'encaisse pas. */
          badgeAvoirHTML(f)
        : `<span class="badge ${reg.cls}">${esc(reg.label)}</span>${delaiBadgeHTML(f, reg.reste)}`}</div></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn small" onclick="editItem('facture','${jsAttr(f.id)}')">Modifier</button>
      <button class="btn small" onclick="printDocument('facture','${jsAttr(f.id)}','save')">Imprimer / PDF</button>
      <button class="btn small" onclick="envoyerDocumentEmail('facture','${jsAttr(f.id)}')">Envoyer par email</button>
      ${/* L'ÉMISSION. `emettreFacture` existait, testée et exposée sur window —
            et rien ne l'appelait : aucun bouton, aucun sélecteur de statut. Une
            facture née d'un devis, d'un rapport ou d'une situation de travaux
            restait donc en brouillon SANS NUMÉRO, indéfiniment. 46 en base, dont
            13 hors jeu d'essai, la plus ancienne du 31 juillet.

            Sans numéro elle ne peut être ni remise au client, ni transmise à la
            plateforme. Le seul déblocage qui restait était d'y saisir un
            règlement : le statut basculait, et la base numérotait — le numéro
            légal attribué par un encaissement, hors de tout ordre chronologique.
            C'est précisément ce que la migration de numérotation interdit, au nom
            de l'article 242 nonies A de l'annexe II au CGI. */''}
      ${!f.numero && !estUnAvoir && (!window.actionsFacturation || window.actionsFacturation().peutFacturer)
        ? `<button class="btn small primary" onclick="emettreLaFacture('${jsAttr(f.id)}')" title="Attribuer son numéro définitif et la rendre transmissible">🧾 Émettre</button>`
        : ''}
      ${/* Pas de dépôt pour un particulier ni pour une entreprise étrangère :
            ces opérations relèvent de l'e-reporting et n'ont rien à faire sur
            une plateforme. Le bouton s'affichait dès que la facture avait un
            numéro, ouvrait une confirmation alarmante sur l'irréversibilité,
            puis refusait à tous les coups. */''}
      ${(f.numero && passeParUnePlateforme(f))? `<button class="btn small" onclick="transmettreALaPlateforme('${jsAttr(f.id)}')" title="Déposer la facture électronique sur la plateforme">${f.pdpIdentifiant? '📤 Déposée' : '📤 Transmettre'}</button>` : ''}
      ${/* Le bouton absent ne s'expliquait pas : sur un brouillon — et les
            brouillons sont en TÊTE de liste, la plus récente d'abord — on
            cherchait un avoir qui n'était nulle part. Il reste donc visible,
            désactivé, et dit pourquoi. */''}
      ${estUnAvoir? '' : (f.numero
        ? `<button class="btn small" onclick="etablirAvoirPour('${jsAttr(f.id)}')" title="Rectifier cette facture émise par un avoir">↩ Établir un avoir</button>`
        : `<button class="btn small" disabled title="Cette facture n'est pas émise : elle n'a pas de numéro, et se corrige directement par « Modifier ». Un avoir n'aurait rien à rectifier.">↩ Établir un avoir</button>`)}
      ${peutReglerParAvoir(f)? `<button class="btn small" onclick="reglerParAvoir('${jsAttr(f.id)}')" title="Solder tout ou partie de cette facture avec un avoir du même client">🧾 Régler par un avoir</button>` : ''}
      <button class="btn small danger" onclick="deleteItem('facture','${jsAttr(f.id)}')">Supprimer</button>
    </div></div>`;
  }).join('') || '<div class="empty">Aucune facture pour cette société.</div>';
}
function factureForm(){
  const e = state.editing;
  /* Deux verrous, et un seul se lève. Le cadenas d'écran protège d'une fausse
     manœuvre sur un document déjà envoyé ; l'ÉMISSION, elle, est définitive —
     la base refuse désormais toute retouche de l'en-tête d'une facture
     numérotée. Promettre « déverrouiller pour modifier » sur une facture émise
     serait promettre ce que la base refuse. */
  const emise = !!(e.id && e.numero);
  const verrouillee = e.id && e.verrouillee && !emise;
  const fige = emise || verrouillee;
  const unAvoir = window.estAvoir(e.typeDocument);
  const rectifieeEcran = e.factureRectifieeId ? state.factures.find(f=>f.id===e.factureRectifieeId) : null;
  return `
  <div class="form-panel">
    <h3>${e.id? (emise? (unAvoir?'Avoir ':'Facture ')+esc(e.numero) : 'Modifier la facture') :'Nouvelle facture'}</h3>
    ${emise? `<div class="facture-verrou-banner">
      <span>🔒 ${unAvoir? 'Avoir' : 'Facture'} émis${unAvoir?'':'e'} sous le n° ${esc(e.numero)} — son contenu est définitif (art. L441-9).${unAvoir? '' : ' Une correction passe par un avoir.'}</span>
      <span style="font-weight:400;">L'encaissement s'enregistre dans l'onglet <b>Règlements</b>.</span>
      ${unAvoir? '' : `<button type="button" class="btn small" onclick="etablirAvoirPour('${jsAttr(e.id)}')" title="Rectifier cette facture par un avoir">↩ Établir un avoir</button>`}
    </div>` : verrouillee? `<div class="facture-verrou-banner">
      <span>🔒 Cette facture a déjà été téléchargée ou envoyée — elle est verrouillée pour éviter une modification accidentelle.</span>
      <button type="button" class="btn small danger" onclick="deverrouillerFacture('${jsAttr(e.id)}')">🔓 Déverrouiller pour modifier</button>
    </div>` : ''}
    ${unAvoir && rectifieeEcran? `<div class="numref" style="margin-bottom:10px;">Rectifie la facture ${esc(rectifieeEcran.numero)} du ${fmtDate(rectifieeEcran.date)}${e.motifRectification? ' — '+esc(e.motifRectification):''}</div>`:''}
    <div style="${fige? 'pointer-events:none; opacity:.55;' : ''}">
    ${e.devisId? `<div class="numref" style="margin-bottom:10px;">Générée à partir d'un devis</div>`:''}
    ${e.interventionId? `<div class="numref" style="margin-bottom:10px;">Issue d'un rapport d'intervention</div>`:''}
    <div class="form-section">
      <div class="form-section-head">Client & contact</div>
      <div class="field-grid">
        <div class="field"><label>Client</label><select id="f_client" onchange="refreshInterlocuteurSelect(this,'f_interlocuteur'); reprendreConditionsDuClient(this.value);">${clientSelectOptions(e.client)}</select></div>
        <div class="field"><label>Interlocuteur</label><select id="f_interlocuteur">${interlocuteurOptions(e.client, e.interlocuteur)}</select></div>
        <div class="field"><label>Date</label><input type="date" id="f_date" value="${e.date||todayISO()}" onchange="appliquerDelaiPaiement()"></div>
        ${/* Le délai est recopié du client À LA CRÉATION puis figé : le client
             peut changer de conditions, une facture déjà émise ne bouge plus.
             Il reste modifiable tant que la facture n'est pas verrouillée. */''}
        <div class="field"><label>Délai de paiement</label>
          <select id="f_delaiPreset" onchange="choisirDelaiFacture()">${optionsDelaiFactureHTML(e)}</select></div>
        <div class="field"><label>Mode de règlement</label>
          <select id="f_modePaiement">${optionsModeReglementHTML(e.modePaiement || delaiModeDuClient(e.client))}</select></div>
        <div class="field"><label>Échéance <button type="button" class="btn small ghost" style="padding:0 6px;" onclick="recalculerEcheance()" title="Recalculer d'après le délai">↻</button></label>
          <input type="date" id="f_echeance" value="${esc(e.echeance||'')}" oninput="echeanceSaisieAlaMain(this)">
          <small id="f_echeanceAide" class="card-sub"></small></div>
        <div class="field"><label>Conducteur de travaux</label><select id="f_conducteur">${conducteurSelectOptions(conducteurIdDe(e))}</select></div>
        <div class="field"><label>Travaux achevés le <small class="card-sub">(si différent de la date)</small></label><input type="date" id="f_dateFinExecution" value="${esc(e.dateFinExecution||'')}"></div>
        ${/* BT-13 : la référence que l'acheteur rapproche. Elle s'enregistrait
             déjà — reprise du bon — mais aucun champ ne la montrait : on ne
             pouvait ni la vérifier, ni la corriger, ni la saisir sur une
             facture créée sans bon. */''}
        <div class="field"><label>N° de bon de commande du client</label><input type="text" id="f_refBonCommandeClient" value="${esc(e.refBonCommandeClient||'')}" placeholder="La référence que le client rapprochera"></div>
        <div class="field"><label>N° de marché</label><input type="text" id="f_refMarche" value="${esc(e.refMarche||'')}" placeholder="Lorsqu'il en existe un"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Lieu & locataire</div>
      <div class="field-grid">
      <div class="field full" style="margin-bottom:2px;"><button type="button" class="btn small ghost" onclick="toggleBox('locataireBoxFacture')">+ Le locataire est différent du client</button></div>
      <div id="locataireBoxFacture" style="display:${(e.occupant||e.adresseLocataire||e.logementStatut)?'contents':'none'};">
        <div class="field"><label>Type</label><select id="f_logementStatut" onchange="toggleOccupantField(this,'occupantFieldFacture','communeFieldFacture','vacantFieldFacture','numeroFieldFacture','etageFieldFacture')">${logementOptions(e.logementStatut)}</select></div>
        <div class="field full" id="communeFieldFacture" style="display:${e.logementStatut==='commune'?'':'none'};"><label>Précision (partie commune)</label><input type="text" id="f_precisionCommune" value="${esc(e.precisionCommune)}" placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…"></div>
        <div class="field full" id="vacantFieldFacture" style="display:${e.logementStatut==='vacant'?'':'none'};"><label>Ancien locataire</label><input type="text" id="f_ancienLocataire" value="${esc(e.ancienLocataire)}" placeholder="Ex : M. Dupont"></div>
        <div class="field" id="occupantFieldFacture" style="display:${e.logementStatut==='occupé'?'':'none'};"><label>Locataire</label><input type="text" id="f_occupant" value="${esc(e.occupant)}"></div>
        <div class="address-trio">
          <div class="field" style="position:relative;"><label>Lieu d'intervention</label><input type="text" id="f_adresseLocataire" autocomplete="off" value="${esc(e.adresseLocataire)}" placeholder="Laisser vide si identique à l'adresse client" data-suggest="fLieuSuggestions" oninput="searchAdresse(this, {adresse:'f_adresseLocataire', codePostal:'f_codePostal', ville:'f_ville'})" onblur="setTimeout(()=>{const b=document.getElementById('fLieuSuggestions'); if(b) b.style.display='none';},150)"><div id="fLieuSuggestions" class="suggest-box"></div></div>
          <div class="field"><label>Code postal</label><input type="text" id="f_codePostal" autocomplete="off" maxlength="5" inputmode="numeric" value="${esc(e.codePostal)}" oninput="lookupVilleParCodePostal(this.value,'f_ville')"></div>
          <div class="field"><label>Ville</label><input type="text" id="f_ville" autocomplete="off" value="${esc(e.ville)}"></div>
        </div>
        <div class="field" id="etageFieldFacture" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>Étage</label><input type="text" id="f_etage" value="${esc(e.etage)}" placeholder="RDC, 1er, 2e…"></div>
        <div class="field" id="numeroFieldFacture" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>N° de logement</label><input type="text" id="f_numeroLogement" value="${esc(e.numeroLogement)}" placeholder="Ex : 12, Appt 3B"></div>
      </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Lignes</div>
      <table class="lignes-table"><thead><tr><th style="width:36%;">Désignation</th><th>Qté</th><th>Unité</th><th>Prix U. HT</th><th>TVA</th><th class="num">Total HT</th><th class="num">Total TTC</th><th></th></tr></thead>
      <tbody id="lignesBody">${ligneRowsHTML(e.lignes)}</tbody></table>
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="addLigne()">+ Ligne</button>
        <button class="btn small" onclick="addChapitre()">+ Chapitre</button>
        <button class="btn small" onclick="addCommentaire()">+ Commentaire</button>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">Remise & totaux</div>
      ${remiseAndTotalsHTML(e.lignes, e.remisePourcentage)}
    </div>
    </div>
    <div class="form-actions-sticky">
      <button class="btn primary" onclick="saveFacture()" ${verrouillee?'disabled':''}>Enregistrer la facture</button>
      <button class="btn ghost" onclick="closeForm('facture')">Annuler</button>
    </div>
  </div>`;
}
async function saveFacture(){
  const e = state.editing;
  const client = document.getElementById('f_client').value.trim();
  if(!client){ alert('Le nom du client est requis.'); return; }
  const id = e.id || uid();
  /* Le numéro d'une facture est attribué par la base, à l'émission, dans la
     même transaction que l'enregistrement. Le demander ici consommerait une
     référence même si la saisie est abandonnée — c'est ce qui creusait des
     trous dans une série que la loi veut continue. */
  const numero = e.numero || '';
  /* Ces trois-là ne se saisissent pas : ils viennent de l'établissement de
     l'avoir. Absents de l'objet, ils seraient réécrits à NULL — `columns=` est
     construit sur les clés envoyées, et un avoir rouvert puis enregistré
     redeviendrait une facture, avec son numéro « AV » et son montant positif. */
  const obj = { id, societeId: state.societeId, numero, typeDocument: e.typeDocument || 'facture', factureRectifieeId: e.factureRectifieeId || null, motifRectification: e.motifRectification || null, createdAt: e.createdAt || new Date().toISOString(), devisId: e.devisId || null, interventionId: e.interventionId || null, bonCommandeId: e.bonCommandeId || null, refBonCommandeClient: champSaisi('f_refBonCommandeClient', e.refBonCommandeClient) || null, chantierId: e.chantierId || null, client,
    adresse: resolveClientAdresse(client),
    interlocuteur: document.getElementById('f_interlocuteur').value,
    adresseLocataire: document.getElementById('f_adresseLocataire').value,
    codePostal: document.getElementById('f_codePostal').value,
    ville: document.getElementById('f_ville').value,
    ...cleanLogementFields(document.getElementById('f_logementStatut').value, {
      occupant: document.getElementById('f_occupant').value,
      etage: document.getElementById('f_etage').value,
      numeroLogement: document.getElementById('f_numeroLogement').value,
      precisionCommune: document.getElementById('f_precisionCommune').value,
      ancienLocataire: document.getElementById('f_ancienLocataire').value
    }),
    date: document.getElementById('f_date').value || todayISO(),
    echeance: document.getElementById('f_echeance').value || '',
    /* BT-20 de l'EN 16931, jamais écrit jusqu'ici : 428 factures partaient sans
       leurs conditions de règlement. C'est un texte FIGÉ, pas un renvoi vers la
       fiche client — une facture dit les conditions convenues le jour où elle a
       été établie, et n'en change pas si le client renégocie six mois plus tard. */
    /* La date de la prestation, exigée par l'art. L441-9 : elle ne s'imprime
       que si elle diffère de la date de facture. */
    dateFinExecution: document.getElementById('f_dateFinExecution').value || null,
    refMarche: document.getElementById('f_refMarche').value || null,
    /* Acompte, retenue de garantie et chantier lié ne se saisissent plus ici.
       Les reconduire depuis `e` plutôt que les omettre : un champ absent est
       écrit à NULL par PostgREST, et une facture reprise d'un devis perdrait
       silencieusement son acompte. `null` et non `0` pour la retenue — la
       colonne distingue « le marché n'en prévoit pas » d'un taux nul. */
    acomptesDeduits: e.acomptesDeduits || 0,
    retenueGarantiePourcentage: e.retenueGarantiePourcentage ?? null,
    /* Les conditions vivent SUR la facture, pas seulement chez le client :
       sans elles, changer le délai d'un client rendait impossible de savoir
       sous quelle condition une facture ancienne avait été émise, et de
       recalculer son échéance si sa date bougeait. */
    delaiPaiementJours: delaiFactureSaisi().jours,
    delaiPaiementMode: delaiFactureSaisi().mode,
    conditionsReglement: window.libelleDelaiPaiement(delaiFactureSaisi()),
    /* `v()` n'existe pas ici — c'est le lecteur de `saveInfosEntreprise`. Écrit
       tel quel, il faisait lever `saveFacture` tout entière : plus aucune
       facture n'était enregistrable depuis le formulaire, silencieusement,
       puisque l'exception partait dans la console et que l'écran ne disait
       rien. Un test aurait tenu ; `index.html` n'en a pas. */
    modePaiement: champSaisi('f_modePaiement', e.modePaiement) || window.modeReglementRetenu(delaiModeDuClient(client)),
    lignes: state.editing.lignes, remisePourcentage: e.remisePourcentage || 0,
    /* BROUILLON, et non « impayée ». Une facture enregistrée sans statut —
       c'est le cas du bouton « + Nouvelle facture », qui n'en pose aucun —
       partait « impayée », et `facture_attribuer_numero` numérote tout ce qui
       n'est pas brouillon : la toute première facture du client était donc
       DÉFINITIVE à la seconde où il cliquait Enregistrer, sans un mot. Le
       numéro s'attribue à l'émission, par le bouton « 🧾 Émettre » — art. 242
       nonies A. Le devis faisait déjà ainsi. */
    statut: e.statut || 'brouillon', ...conducteurDuSelect('f_conducteur'), verrouillee: e.verrouillee || false };
  const r = await window.stSet('facture:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('facture');
  closeForm('facture');
}

/**
 * Émet la facture : c'est ce geste qui lui donne son numéro.
 *
 * Le numéro naît en base, dans la transaction qui fait quitter le brouillon —
 * `emettreFacture` ne fait que poser le statut, le déclencheur s'occupe du
 * reste. Rien n'est calculé ici : la continuité de la série est une affaire de
 * base, pas d'écran.
 *
 * On prévient de ce qui devient définitif, parce que ça l'est vraiment : une
 * fois numérotée, la facture ne se modifie plus et ne se supprime plus — la
 * base refuse les deux, et la correction passe par un avoir.
 */
async function emettreLaFacture(factureId){
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;
  if(!window.emettreFacture){ showToast("L'émission n'est pas disponible."); return; }
  if(f.numero){ showToast(`Déjà émise sous le n° ${f.numero}.`); return; }

  const t = computeDocTotals(f);
  if(!confirm(`Émettre la facture de ${esc(f.client)} pour ${moneyDisplay(t.ttc)} TTC ?\n\nElle recevra son numéro définitif. Son contenu ne pourra plus être modifié, et une correction devra passer par un avoir.`)) return;

  try{
    const emise = await window.emettreFacture(factureId);
    await recharger('facture');
    showToast(`Facture émise sous le n° ${emise && emise.numero ? emise.numero : '—'}.`, 'success');
  }catch(err){
    console.error('Émission refusée', err);
    showToast(motifDeLaBase(err, "La facture n'a pas pu être émise."), 'danger', 7000);
  }
}

/**
 * Le motif que la base a donné, et non l'emballage qui le transporte.
 *
 * `SupabaseError` met dans `message` un libellé générique — « Failed to update
 * factures » — et range l'explication de Postgres dans `details.message`. Montrer
 * le premier, c'est dire à l'utilisateur qu'il s'est passé quelque chose sans
 * dire quoi, alors que la base a écrit une phrase faite pour être lue :
 * « Facture sans ligne : aucun numéro ne peut lui être attribué […] Créez-la au
 * statut brouillon, ajoutez ses lignes, puis passez-la à impayée. »
 */
function motifDeLaBase(err, defaut){
  if(!err) return defaut;
  const d = err.details;
  const deLaBase = d && (d.message || d.details || d.hint);
  return deLaBase || err.message || defaut;
}

/**
 * Établit l'avoir qui rectifie une facture émise.
 *
 * Le motif est demandé avant toute confirmation : c'est lui qui distingue un
 * avoir d'une facture qu'on efface. Il s'imprime sur le document, part avec la
 * facture électronique, et reste la seule trace de ce qui s'est passé.
 *
 * Ce qui refuse l'avoir est décidé par `refusAvoir`, la même règle que celle
 * qu'appliquera la couche d'accès : demander deux fois évite d'ouvrir une
 * saisie qui finirait rejetée, sans que les deux messages puissent diverger.
 */
const MOTIF_AVOIR_LIBRE = '__libre__';

function etablirAvoirPour(factureId){
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;
  if(!window.etablirAvoir){ showToast("L'établissement d'un avoir n'est pas disponible."); return; }

  state.avoirCible = factureId;
  const ttc = Math.abs(computeDocTotals(f).ttc);
  document.getElementById('avoirModalResume').textContent =
    `Facture ${f.numero} — ${f.client} — ${moneyDisplay(ttc)} TTC`;

  const motifs = window.MOTIFS_AVOIR || [];
  document.getElementById('avoirMotifPreset').innerHTML =
    motifs.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')
    + `<option value="${MOTIF_AVOIR_LIBRE}">Autre motif (préciser)…</option>`;
  document.getElementById('avoirMotifLibre').value = '';
  document.getElementById('avoirMotifLibreZone').style.display = 'none';
  document.getElementById('avoirModal').classList.add('open');
}
function choisirMotifAvoir(){
  const libre = document.getElementById('avoirMotifPreset').value === MOTIF_AVOIR_LIBRE;
  document.getElementById('avoirMotifLibreZone').style.display = libre ? '' : 'none';
  if(libre) document.getElementById('avoirMotifLibre').focus();
}
function closeAvoirModal(){
  document.getElementById('avoirModal').classList.remove('open');
  state.avoirCible = null;
}
/** Le motif retenu : celui de la liste, ou celui qu'on a écrit à la place. */
function motifAvoirSaisi(){
  const choisi = document.getElementById('avoirMotifPreset').value;
  return (choisi === MOTIF_AVOIR_LIBRE
    ? document.getElementById('avoirMotifLibre').value
    : choisi || '').trim();
}
async function confirmerAvoir(){
  const factureId = state.avoirCible;
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;

  const motif = motifAvoirSaisi();
  /* Le même refus que celui qu'appliquera la couche d'accès : les deux messages
     viennent de `refusAvoir`, ils ne peuvent pas diverger. */
  const refus = window.refusAvoir({ facture:{ numero:f.numero, typeDocument:f.typeDocument }, motif });
  if(refus){ showToast(refus); return; }

  const btn = document.getElementById('avoirConfirmerBtn');
  btn.disabled = true;
  btn.textContent = 'Établissement…';
  try{
    const avoir = await window.etablirAvoir(factureId, motif);
    closeAvoirModal();
    await recharger('facture');
    showToast(`Avoir ${avoir && avoir.numero ? avoir.numero : ''} établi.`, 'success');
    setFacturesView('avoirs');
  }catch(err){
    console.error('Avoir non établi', err);
    showToast((err && err.message) || "L'avoir n'a pas pu être établi.", 'danger', 6000);
  }finally{
    btn.disabled = false;
    btn.textContent = "✓ Établir l'avoir";
  }
}

/* ---------- Règlements ---------- */
function reglementsForFacture(factureId){
  return state.reglements.filter(r=>r.factureId===factureId);
}

/* ---------- Imputation d'un avoir ----------
   Un avoir éteint une créance ; il ne s'encaisse pas. L'imputer écrit deux
   règlements liés — l'un solde la facture, l'autre consomme l'avoir — et c'est
   la couche d'accès qui les pose ensemble, en une seule insertion. */

/**
 * L'état d'un avoir, qui n'est pas celui d'une facture.
 *
 * Le calcul de règlement conclut « Réglée » sur tout total négatif — le reste à
 * payer y tombe à zéro. Un avoir affichait donc un badge vert alors que
 * personne ne l'avait encore imputé. Son état, c'est ce qu'il lui reste à
 * donner.
 */
function badgeAvoirHTML(avoir){
  const reste = resteDeLAvoir(avoir);
  const credit = Math.abs(computeDocTotals(avoir).ttc);
  if(reste <= 0.004) return `<span class="badge success" title="Cet avoir a été entièrement imputé">Imputé</span>`;
  if(reste < credit - 0.004) return `<span class="badge warn" title="Imputé en partie : ${moneyDisplay(reste)} restent à imputer">Partiellement imputé</span>`;
  return `<span class="badge warn" title="À imputer sur une facture du même client">À imputer</span>`;
}

/** Ce qu'il reste d'un avoir à donner, d'après les imputations déjà faites. */
function resteDeLAvoir(avoir){
  if(!avoir) return 0;
  return window.resteAImputer(computeDocTotals(avoir).ttc, reglementsForFacture(avoir.id));
}
/** Les avoirs du même client qui ont encore quelque chose à imputer. */
function avoirsDisponiblesPour(facture){
  if(!facture) return [];
  return state.factures.filter(a =>
    a.societeId === facture.societeId
    && window.estAvoir(a.typeDocument)
    && a.numero
    && (a.client || '') === (facture.client || '')
    && resteDeLAvoir(a) > 0
  );
}
/** L'avoir peut-il solder cette facture ? Ce qui commande l'affichage du bouton. */
function peutReglerParAvoir(facture){
  return !!facture
    && !window.estAvoir(facture.typeDocument)
    && !!facture.numero
    && resteDeLaFacture(facture, null) > 0
    && avoirsDisponiblesPour(facture).length > 0;
}

function reglerParAvoir(factureId){
  const f = state.factures.find(x=>x.id===factureId);
  if(!f) return;
  if(!window.imputerAvoir){ showToast("L'imputation n'est pas disponible."); return; }

  const dispos = avoirsDisponiblesPour(f);
  if(!dispos.length){ showToast("Aucun avoir disponible pour ce client."); return; }

  state.imputationCible = factureId;
  document.getElementById('imputationResume').textContent =
    `Facture ${f.numero} — ${f.client} — reste ${moneyDisplay(resteDeLaFacture(f, null))}`;
  document.getElementById('imputationAvoir').innerHTML = dispos.map(a =>
    `<option value="${a.id}">${esc(a.numero)} — ${moneyDisplay(resteDeLAvoir(a))} disponible${a.motifRectification? ' · '+esc(a.motifRectification):''}</option>`
  ).join('');
  majMontantImputation();
  document.getElementById('imputationModal').classList.add('open');
}
/** Le montant proposé : le plus petit des deux restes, jamais davantage. */
function majMontantImputation(){
  const f = state.factures.find(x=>x.id===state.imputationCible);
  const a = state.factures.find(x=>x.id===document.getElementById('imputationAvoir').value);
  document.getElementById('imputationMontant').value =
    window.montantImputable(resteDeLaFacture(f, null), resteDeLAvoir(a)).toFixed(2);
  majAideImputation();
}
function majAideImputation(){
  const f = state.factures.find(x=>x.id===state.imputationCible);
  const a = state.factures.find(x=>x.id===document.getElementById('imputationAvoir').value);
  if(!f || !a) return;
  const montant = window.arrondiCentime(document.getElementById('imputationMontant').value);
  const resteF = resteDeLaFacture(f, null);
  const resteA = resteDeLAvoir(a);
  const refus = window.refusImputationAvoir({
    avoir:   { numero:a.numero, typeDocument:a.typeDocument, clientNom:a.client },
    facture: { numero:f.numero, typeDocument:f.typeDocument, clientNom:f.client },
    montant, resteFacture:resteF, resteAvoir:resteA,
  });
  const aide = document.getElementById('imputationAide');
  aide.textContent = refus
    || `Après imputation : facture ${moneyDisplay(resteF - montant)} restant dû, avoir ${moneyDisplay(resteA - montant)} disponible.`;
  aide.style.color = refus ? 'var(--danger)' : '';
  document.getElementById('imputationConfirmerBtn').disabled = !!refus;
}
function closeImputationModal(){
  document.getElementById('imputationModal').classList.remove('open');
  state.imputationCible = null;
}
async function confirmerImputation(){
  const factureId = state.imputationCible;
  const avoirId = document.getElementById('imputationAvoir').value;
  const montant = window.arrondiCentime(document.getElementById('imputationMontant').value);
  const btn = document.getElementById('imputationConfirmerBtn');
  btn.disabled = true;
  btn.textContent = 'Imputation…';
  try{
    await window.imputerAvoir(avoirId, factureId, montant);
    closeImputationModal();
    await recharger('reglement', 'facture');
    /* Le statut stocké suit les règlements : sans cette remise à jour, une
       facture soldée par un avoir resterait « impayée » dans les compteurs. */
    await syncFactureStatut(factureId);
    showToast('Avoir imputé.', 'success');
  }catch(err){
    console.error('Imputation refusée', err);
    showToast((err && err.message) || "L'avoir n'a pas pu être imputé.", 'danger', 6000);
  }finally{
    btn.disabled = false;
    btn.textContent = '✓ Imputer';
  }
}
function reglementStatutFacture(f){
  /* Un avoir ne se règle pas, il s'impute — et il faut le mesurer avec SA règle.
     Mesuré avec celle des factures, `resteAPayer` calculait -682, le ramenait à
     0, et l'écran annonçait « RÉGLÉE, reste 0,00 € » sur un avoir dont la
     totalité restait disponible. Il affirmait l'inverse de la vérité, et
     cachait le seul geste qui restait à faire. */
  if(window.estAvoir && window.estAvoir(f.typeDocument) && window.statutImputation){
    const a = window.statutImputation(computeDocTotals(f).ttc, reglementsForFacture(f.id));
    return { cle:a.cle, label:a.label, cls:a.classe, paye:a.impute, reste:a.reste, ttc:a.ttc, avoir:true };
  }
  const st = window.statutReglement(computeDocTotals(f).ttc, reglementsForFacture(f.id));
  /* `cls` reste le nom historique de la classe de badge ; `cle` est ce sur quoi
     le code compare désormais — comparer des libellés casse au premier
     renommage, et ils viennent d'être renommés. */
  return { cle: st.cle, label: st.label, cls: st.classe, paye: st.paye, reste: st.reste, ttc: st.ttc };
}
function joursDepuisEcheance(f){
  const ref = f.echeance || f.date;
  if(!ref) return null;
  const refDate = new Date(ref+'T00:00:00');
  const today = new Date(todayISO()+'T00:00:00');
  return Math.round((today.getTime() - refDate.getTime()) / 86400000);
}
function delaiBadgeHTML(f, reste){
  if(reste <= 0.01) return '';
  const jours = joursDepuisEcheance(f);
  if(jours === null) return '';
  if(jours > 0) return `<span class="badge danger">En retard de ${jours} j</span>`;
  if(jours === 0) return `<span class="badge warn">Échéance aujourd'hui</span>`;
  return `<span class="badge gray">Échéance dans ${-jours} j</span>`;
}
/* ---------- Bons de commande ---------- */
function statutClientBC(b){
  if(bcInterventionFaite(b) || b.dateInterventionTerminee) return { cle:'vert', label:'✅ Travaux réalisés', couleur:'#12875A', fond:'#E1F5EC' };
  if(b.pieceACommander) return { cle:'jaune', label:'🟡 Pièce en commande', couleur:'#B7860B', fond:'#FDF6DC' };
  if(b.datePlanifiee) return { cle:'orange', label:'🟠 Planifié le '+fmtDate(b.datePlanifiee)+(b.heurePlanifiee? ' à '+b.heurePlanifiee:''), couleur:'#C24E00', fond:'#FFEDE0' };
  return { cle:'rouge', label:'🔴 Pas encore planifié', couleur:'#C0303C', fond:'#FDE7E9' };
}
function setClientSearch(valeur){
  state.clientSearch = valeur;
  const zone = document.getElementById('clientBCZone');
  if(zone) zone.innerHTML = renderClientBCZoneHTML();
}
function renderBonsCommandeClient(){
  const clientNom = state.currentClientNom || '';
  if(!clientNom) return `<div class="page-head"><h1>Suivi de vos bons de commande</h1></div>
    <div class="card" style="border-color:var(--accent); background:var(--accent-soft);">👤 Sélectionnez votre organisme et votre nom dans <b>Réglages</b> pour voir vos bons de commande.</div>`;
  const interloc = state.currentInterlocuteur || '';
  return `
    <div class="page-head"><h1>Suivi de vos bons de commande</h1></div>
    <div class="card-sub" style="margin-bottom:14px;">${esc(clientNom)}${interloc? ' — '+esc(interloc):''} · Suivi en temps réel par ${esc(societeName(state.societeId))}.</div>
    <input type="text" value="${esc(state.clientSearch||'')}" placeholder="🔍 Rechercher : n° BC, adresse, n° de logement, nom du locataire…" oninput="setClientSearch(this.value)" style="width:100%; margin-bottom:14px;">
    <div id="clientBCZone">${renderClientBCZoneHTML()}</div>
  `;
}
function renderClientBCZoneHTML(){
  const clientNom = state.currentClientNom || '';
  const interloc = state.currentInterlocuteur || '';
  const q = (state.clientSearch||'').trim().toLowerCase();
  let list = state.bonsCommande.filter(b=>b.societeId===state.societeId && b.client===clientNom && (!interloc || (b.interlocuteur||'')===interloc) &&
    (!q || window.multiWordMatch([b.numeroBC, b.adresse, b.adresseLocataire, b.codePostal, b.ville, b.numeroLogement, b.occupant, b.ancienLocataire, b.interlocuteur, b.pieceACommanderDetail].filter(Boolean).join(' ').toLowerCase(), q)));
  const compteurs = { rouge:0, orange:0, jaune:0, vert:0 };
  list.forEach(b=>{ compteurs[statutClientBC(b).cle]++; });
  const filtre = state.clientStatutFiltre || '';
  if(filtre) list = list.filter(b=>statutClientBC(b).cle===filtre);
  const ordre = { rouge:0, jaune:1, orange:2, vert:3 };
  list.sort((a,b)=> ordre[statutClientBC(a).cle]-ordre[statutClientBC(b).cle] || (a.numeroBC||'').localeCompare(b.numeroBC||''));
  const tuile = (cle, label, n, couleur, fond)=>`<button class="client-tuile ${filtre===cle?'client-tuile-active':''}" style="--tc:${couleur}; --tf:${fond};" onclick="state.clientStatutFiltre = state.clientStatutFiltre==='${jsAttr(cle)}'? '' : '${jsAttr(cle)}'; setClientSearch(state.clientSearch||'');">${label}<b>${n}</b></button>`;
  return `
    <div class="client-tuiles">
      ${tuile('rouge','🔴 À planifier', compteurs.rouge, '#C0303C', '#FDE7E9')}
      ${tuile('orange','🟠 Planifiés', compteurs.orange, '#C24E00', '#FFEDE0')}
      ${tuile('jaune','🟡 Pièce en commande', compteurs.jaune, '#B7860B', '#FDF6DC')}
      ${tuile('vert','✅ Réalisés', compteurs.vert, '#12875A', '#E1F5EC')}
    </div>
    ${list.length? list.map(b=>{
      const st = statutClientBC(b);
      const adresse = [withVille(b.adresseLocataire||b.adresse, b.codePostal, b.ville), b.numeroLogement? 'N° '+b.numeroLogement:''].filter(Boolean).join(' · ');
      const tentatives = b.tentativesContact||[];
      return `<div class="card" style="border-left:5px solid ${st.couleur};">
        <div class="card-row">
          <div style="flex:1; min-width:0;">
            <div class="card-title">BC n° ${esc(b.numeroBC||'—')}</div>
            ${adresse? `<div class="card-sub">📍 ${esc(adresse)}</div>`:''}
            ${b.occupant? `<div class="card-sub">👤 Locataire : ${esc(b.occupant)}</div>`:''}
            ${b.interlocuteur && !interloc? `<div class="card-sub">Interlocuteur : ${esc(b.interlocuteur)}</div>`:''}
          </div>
          <span class="badge" style="background:${st.fond}; color:${st.couleur}; flex-shrink:0;">${st.label}</span>
        </div>
        ${b.pieceACommander && b.pieceACommanderDetail? `<div class="card-sub" style="margin-top:6px;">🔧 Pièce : ${esc(b.pieceACommanderDetail)}${b.pieceACommanderDateCommande? ' — commandée le '+fmtDate(b.pieceACommanderDateCommande):''}</div>`:''}
        ${b.datePlanificationInitiale && b.pieceACommander? `<div class="card-sub">🕓 1ère intervention le ${fmtDate(b.datePlanificationInitiale)} — reportée en attente de la pièce</div>`:''}
        ${tentatives.length? `<div class="client-tentatives">📵 <b>Locataire injoignable</b> — nos tentatives : ${tentatives.map(t=>`<span class="contact-tag contact-tag-${t.type}">${t.type==='appel'?'📞 Appel':'💬 SMS'} ${fmtDate(t.date)}${t.heure? ' '+t.heure:''}</span>`).join(' ')}</div>`:''}
        ${b.rappelDate && !b.dateInterventionTerminee? `<div class="card-sub">🔄 Prochain contact prévu le ${fmtDate(b.rappelDate)}</div>`:''}
        ${b.dateInterventionTerminee? `<div class="card-sub" style="color:var(--success); font-weight:600; margin-top:6px;">✅ Réalisé le ${fmtDate(b.dateInterventionTerminee)}</div>`:''}
      </div>`;
    }).join('') : '<div class="empty">Aucun bon de commande'+(filtre? ' dans cette catégorie':'')+'.</div>'}
  `;
}
function renderBonsCommande(){
  if(state.currentRole==='client') return renderBonsCommandeClient();
  const list = bonCommandeListItems();
  return `
    <div class="page-head"><h1>Bons de commande</h1>${state.formOpen.bonCommande? '' : `
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <label class="btn" style="cursor:pointer;">📄 Importer un BC (PDF ou photo)
          <input type="file" accept="application/pdf,image/*,.heic,.heif" style="display:none;" onchange="importerBonCommande(this.files[0], this)">
        </label>
        <button class="btn primary" onclick="openForm('bonCommande')">+ Nouveau bon de commande</button>
      </div>`}</div>
    ${state.formOpen.bonCommande ? '' : `<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
      <input type="text" id="bonCommandeSearchInput" style="flex:1; min-width:220px;" value="${esc(state.bonCommandeSearch||'')}" placeholder="Rechercher : client, n° BC, adresse, montant…" oninput="filterBonsCommandeList(this.value)" onkeydown="searchEnterCycle(event,'bonCommande')">
      <select style="width:auto; min-width:180px;" onchange="filterBonCommandeConducteur(this.value)">${conducteurFilterOptions(state.bonCommandeConducteurFilter)}</select>
      <select style="width:auto; min-width:170px;" onchange="filterBonCommandeType(this.value)">
        <option value="" ${!state.bonCommandeTypeFilter?'selected':''}>Type</option>
        <option value="bonCommande" ${state.bonCommandeTypeFilter==='bonCommande'?'selected':''}>Bons de commande</option>
        <option value="sav" ${state.bonCommandeTypeFilter==='sav'?'selected':''}>SAV</option>
      </select>
      <select style="width:auto; min-width:220px;" onchange="filterBonCommandeCreationType(this.value)">
        <option value="" ${!state.bonCommandeCreationTypeFilter?'selected':''}>Tous les modes de création</option>
        <option value="normal" ${state.bonCommandeCreationTypeFilter==='normal'?'selected':''}>Bon de commande (n° normal)</option>
        <option value="sansBC" ${state.bonCommandeCreationTypeFilter==='sansBC'?'selected':''}>Sans bon de commande</option>
        <option value="attenteBC" ${state.bonCommandeCreationTypeFilter==='attenteBC'?'selected':''}>En attente de bon de commande</option>
      </select>
      <select style="width:auto; min-width:170px;" onchange="filterBonCommandeLogement(this.value)">
        <option value="" ${!state.bonCommandeLogementFilter?'selected':''}>Tous les logements</option>
        <option value="occupé" ${state.bonCommandeLogementFilter==='occupé'?'selected':''}>🏠 Occupé</option>
        <option value="vacant" ${state.bonCommandeLogementFilter==='vacant'?'selected':''}>🔑 Vacant</option>
        <option value="commune" ${state.bonCommandeLogementFilter==='commune'?'selected':''}>🚪 Partie commune</option>
      </select>
      <select style="width:auto; min-width:170px;" onchange="filterBonCommandeMetier(this.value)">${metierPersoFilterOptions(state.bonCommandeMetierFilter)}</select>
      <select style="width:auto; min-width:170px;" onchange="filterBonCommandeClient(this.value)">${planningUnschedClientOptions(state.bonCommandeClientFilter)}</select>
      <select style="width:auto; min-width:190px;" onchange="filterBonCommandeInterlocuteur(this.value)">${planningUnschedInterlocuteurOptions(state.bonCommandeInterlocuteurFilter, state.bonCommandeClientFilter)}</select>
    </div>`}
    <div id="formZoneBonCommande">${state.formOpen.bonCommande? bonCommandeForm(): ''}</div>
    ${state.formOpen.bonCommande ? '' : `<div id="bonCommandeListZone">${renderBonsCommandeListHTML(list)}</div>`}
  `;
}
function bonCommandeListItems(){
  const soc = state.societeId;
  return state.bonsCommande.filter(b=>b.societeId===soc).map(b=>({kind: b.bonCommandeId? 'sav':'bonCommande', data:b}));
}
function bonCommandeItemMatchesSearch(item, q){
  return bonCommandeMatchesSearch(item.data, q);
}
function bonCommandeMatchesSearch(b, q){
  return !q || window.multiWordMatch(bonCommandeSearchHaystack(b), q);
}
function filterBonsCommandeList(value){
  state.bonCommandeSearch = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeConducteur(value){
  state.bonCommandeConducteurFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeType(value){
  state.bonCommandeTypeFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeCreationType(value){
  state.bonCommandeCreationTypeFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeLogement(value){
  state.bonCommandeLogementFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeMetier(value){
  state.bonCommandeMetierFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function filterBonCommandeClient(value){
  state.bonCommandeClientFilter = value;
  state.bonCommandeInterlocuteurFilter = '';
  renderTab();
}
function filterBonCommandeInterlocuteur(value){
  state.bonCommandeInterlocuteurFilter = value;
  const zone = document.getElementById('bonCommandeListZone');
  if(zone) zone.innerHTML = renderBonsCommandeListHTML(bonCommandeListItems());
}
function renderBonsCommandeListHTML(list){
  const q = (state.bonCommandeSearch||'').trim().toLowerCase();
  const cf = state.bonCommandeConducteurFilter||'';
  const typeFilter = state.bonCommandeTypeFilter||'';
  const creationTypeFilter = state.bonCommandeCreationTypeFilter||'';
  const logementFilter = state.bonCommandeLogementFilter||'';
  const metierFilter = state.bonCommandeMetierFilter||'';
  const clientFilter = state.bonCommandeClientFilter||'';
  const interlocuteurFilter = state.bonCommandeInterlocuteurFilter||'';
  const filtered = list.filter(item => {
    if(typeFilter && item.kind !== typeFilter) return false;
    if(creationTypeFilter==='sansBC' && !item.data.sansBC) return false;
    if(creationTypeFilter==='attenteBC' && !item.data.enAttenteBC) return false;
    if(creationTypeFilter==='normal' && (item.data.sansBC || item.data.enAttenteBC)) return false;
    if(logementFilter && item.data.logementStatut !== logementFilter) return false;
    if(metierFilter && !bcMetiersDuBC(item.data).includes(metierFilter)) return false;
    if(clientFilter && item.data.client !== clientFilter) return false;
    if(interlocuteurFilter && (item.data.interlocuteur||'') !== interlocuteurFilter) return false;
    if(!bonCommandeItemMatchesSearch(item, q)) return false;
    if(cf && item.data.conducteur !== cf) return false;
    return true;
  });
  return filtered.map(item => bonCommandeCardHTML(item.data, false)).join('') || '<div class="empty">Aucun bon de commande ni SAV pour cette société.</div>';
}
function bonCommandeCardHTML(b, workflowCtx){
    const isSAV = !!b.bonCommandeId;
    const factureLiee = state.factures.find(f=>f.bonCommandeId===b.id);
    const savLie = state.bonsCommande.find(x=>x.bonCommandeId===b.id);
    const bonCommandeOrigine = b.bonCommandeId ? state.bonsCommande.find(x=>x.id===b.bonCommandeId) : null;
    const devisLie = b.devisId ? state.devis.find(d=>d.id===b.devisId) : null;
    const rapportLie = state.interventions.find(i=>i.bonCommandeId===b.id);
    /* Le planning arbitre des tâches, il ne chiffre pas. La zone de pré-facture
       s'affichait sur toutes les cartes, y compris « Planning › En attente » et
       « Pièces » : on y saisissait des prix à côté du circuit de validation, et
       le total TTC s'affichait sur le bouton lui-même sans égard pour le rôle.
       Elle ne vit plus que là où le prix se décide — la liste des bons et les
       deux vues de Facturation — et pour un rôle qui voit les prix. */
    const chiffrageIci = (workflowCtx === false || workflowCtx === 'validation' || workflowCtx === 'afacturer')
      && (!window.affichePrix || window.affichePrix());
    return `<div class="card" id="bonCommande-card-${b.id}">
      <div class="card-row">
      <div style="flex:1; min-width:0;"><div class="card-title">${esc(b.client)}${isSAV? ' <span class="badge warn" style="margin-left:6px;">SAV</span>':''}</div><div class="card-sub"><span class="numref-lg" style="white-space:pre-line;">${esc(b.numeroBC)}</span>${b.interlocuteur? ' · 👤 '+esc(b.interlocuteur):''}${b.conducteur? ' · 🦺 '+esc(b.conducteur):''}${(b.metiers&&b.metiers.length)||b.metier? ' · 🔧 '+esc(metiersDisplayJoin(b)):''}</div>
      <div class="card-sub">${esc(withVille(b.adresse, b.codePostal, b.ville))}</div>
      ${planningContactZoneHTML(b)}
      ${b.natureTravaux? `<div class="card-sub">🛠️ ${esc(b.natureTravaux)}</div>`:''}
      ${bonCommandeOrigine? `<div class="card-sub">Bon de commande d'origine : <a href="javascript:void(0)" onclick="goToBonCommande('${jsAttr(bonCommandeOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(bonCommandeOrigine.numeroBC)}</a></div>`:''}
      ${devisLie? `<div class="card-sub">Devis lié : <a href="javascript:void(0)" onclick="goToDevis('${jsAttr(devisLie.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(devisLie.numero)}</a></div>`:''}
      ${rapportLie? `<div class="card-sub">Rapport lié : <a href="javascript:void(0)" onclick="goToIntervention('${jsAttr(rapportLie.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(rapportLie.numero)}</a></div>`:''}
      ${b.referenceChantier? `<div class="card-sub">🏗️ Chantier : ${esc(b.referenceChantier)}</div>`:''}
      ${(workflowCtx==='validation' && window.attenteAvantChiffrage && window.attenteAvantChiffrage(b))
        ? `<div class="attente-chiffrage">⏳ ${esc(window.attenteAvantChiffrage(b))}</div>` : ''}
      ${locataireCardLine(b)}
      ${isSAV? (b.problemeDescription? `<div class="card-sub" style="color:var(--danger);"><span style="color:var(--danger);">⚠</span> ${esc(b.problemeDescription)}</div>`:'') : `<div class="card-sub">${b.dateReception? 'Reçu le '+fmtDate(b.dateReception):''}${b.dateFinTravaux? ' · Fin travaux : '+fmtDate(b.dateFinTravaux):''}</div>`}
      ${isSAV && b.photos && b.photos.length? `<div class="card-sub">📷 ${b.photos.length} photo${b.photos.length>1?'s':''}</div>`:''}
      ${(b.pieceJointeChemin||b.pieceJointeData)? `<div class="card-sub"><a href="javascript:void(0)" style="color:var(--accent-2); text-decoration:underline;" onclick="event.stopPropagation(); ouvrirBonDuClient('${jsAttr(b.id)}')" title="Voir le bon reçu du client">📎 ${esc(b.pieceJointeNom||'Bon du client')}</a></div>`:''}
      ${factureLiee? `<div class="card-sub">Facture liée : <a href="javascript:void(0)" onclick="goToFacture('${jsAttr(factureLiee.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(factureLiee.numero)}</a></div>`:''}
      ${savLie? `<div class="card-sub">SAV lié : <a href="javascript:void(0)" onclick="goToBonCommande('${jsAttr(savLie.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(savLie.numeroBC)}</a></div>`:''}
      ${(b.technicienCommentaire || b.sousTraitantCommentaire || (b.technicienPhotos||[]).length || b.technicienDessin || b.pieceACommanderDetail || b.dateInterventionTerminee)? `<div class="tech-fiche-zone">
        <button class="btn small ghost" onclick="event.stopPropagation(); toggleTechFicheOuverte('${jsAttr(b.id)}')">📋 Fiche d'intervention du technicien ${state.techFicheOuverte===b.id?'▲':'▼'}</button>
        ${state.techFicheOuverte===b.id? `<div class="tech-fiche-detail">
          ${b.dateInterventionTerminee? `<div class="tech-fiche-commentaire" style="color:#2E9BF0; font-weight:600;">✅ Intervention terminée le ${fmtDate(b.dateInterventionTerminee)}</div>`:''}
          ${b.technicienCommentaire? `<div class="tech-fiche-commentaire">💬 ${esc(b.technicienCommentaire)}</div>`:''}
          ${b.sousTraitantCommentaire? `<div class="tech-fiche-commentaire">🏗️ Sous-traitant : ${esc(b.sousTraitantCommentaire)}</div>`:''}
          ${b.pieceACommanderDetail? `<div class="tech-fiche-commentaire" style="color:#C24E00;">📦 Pièce commandée : ${esc(b.pieceACommanderDetail)}${b.pieceACommanderDateCommande? ' — commandée le '+fmtDate(b.pieceACommanderDateCommande):''}${b.pieceACommanderFournisseur? ' — Fournisseur : '+esc(b.pieceACommanderFournisseur):''}</div>`:''}
          ${(b.technicienPhotos||[]).length? `<div class="tech-photos-grid">${b.technicienPhotos.map(p=>`<div class="tech-photo-thumb"><img src="${p.data}" onclick="event.stopPropagation(); openAttachmentPreview('${jsAttr(p.data)}','${jsAttr(p.nom||'photo.jpg')}')"></div>`).join('')}</div>`:''}
          ${b.technicienDessin? `<div class="card-sub" style="margin-top:8px;">✏️ Dessin :</div><img src="${b.technicienDessin}" style="max-width:280px; border:1px solid var(--border); border-radius:8px; margin-top:4px; cursor:pointer;" onclick="event.stopPropagation(); openAttachmentPreview('${jsAttr(b.technicienDessin)}','dessin.png')">`:''}
        </div>` : ''}
      </div>`:''}
      ${/* Un seul chemin vers le chiffrage. L'éditeur qui vivait ici ne lisait
            que `b.lignes` et ignorait les travaux ajoutés sur le chantier : on
            pouvait chiffrer une affaire sans jamais les voir. */''}
      ${chiffrageIci? `<div class="tech-fiche-zone">
        <button class="btn small primary" onclick="event.stopPropagation(); openValidationDirecteurModal('${jsAttr(b.id)}')">🧾 Ouvrir la pré-facture${(b.lignes&&b.lignes.length)? ` — ${money(computeTotals(b.lignes).ttc)} TTC` : ' — pas encore chiffrée'}</button>
      </div>`:''}
      ${pieceAttendueLigne(b, 'card-sub')}
      ${b.datePlanificationInitiale? `<div class="card-sub">🕓 Planifiée une première fois le ${fmtDate(b.datePlanificationInitiale)} (reportée pour attente de pièce)</div>`:''}
      ${b.dateInterventionTerminee? `<div class="card-sub" style="color:#2E9BF0; font-weight:600;">✅ Intervention terminée le ${fmtDate(b.dateInterventionTerminee)}</div>`:''}
      ${(workflowCtx==='pieceCommande' && b.pieceACommander)? `<div class="piece-replanifier-zone">
        <label class="card-sub" style="margin:0;">Commandée le
          <input type="date" id="dateCommandePiece_${b.id}" value="${b.pieceACommanderDateCommande||''}" onchange="updatePieceCommandeChamp('${jsAttr(b.id)}','pieceACommanderDateCommande',this.value)">
        </label>
        <input type="text" id="fournisseurPiece_${b.id}" placeholder="Nom du fournisseur" value="${esc(b.pieceACommanderFournisseur)}" onchange="updatePieceCommandeChamp('${jsAttr(b.id)}','pieceACommanderFournisseur',this.value)" style="min-width:160px;">
        ${!b.pieceACommanderDateCommande? `<button class="btn small primary" onclick="marquerPieceCommandee('${jsAttr(b.id)}')">📦 Commandé</button>`:''}
        <button class="btn small ${b.pieceACommanderDateCommande?'primary':''}" onclick="replanifierApresPiece('${jsAttr(b.id)}')">✓ Pièce arrivée — Renvoyer au planning</button>
      </div>`:''}
      </div>
      ${b.logementStatut? `<div style="flex:0 0 auto; align-self:center; text-align:center; padding:0 6px;">${logementBadge(b.logementStatut)}</div>`:''}
      <div style="text-align:right; flex-shrink:0;"><div class="amount">${moneyDisplay(b.montant)}</div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin-top:5px;">
          ${isSAV? '' : badgeWorkflow(b)}
          <span class="badge ${badgeClass(b.statut)}">${esc(b.statut)}</span>
        </div>
      </div>
    </div>
    ${(workflowCtx && workflowCtx!=='pieceCommande')? bcWorkflowStepperHTML(b, workflowCtx) : ''}
    ${workflowCtx==='attente'? bcMetiersChecklistHTML(b) : ''}
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn small" onclick="editItem('bonCommande','${jsAttr(b.id)}')">Modifier</button>
      ${/* Une fois la pré-facture validée, l'étape suivante doit sauter aux yeux :
            c'est le geste qu'on cherche, pas un bouton gris parmi cinq. */''}
      ${(factureLiee||isSAV)? '' : (b.valideDirecteur
        ? `<button class="btn small primary" onclick="transformerBonCommandeEnFacture('${jsAttr(b.id)}')">🧾 Créer la facture</button>`
        : `<button class="btn small" disabled title="La pré-facture doit être validée avant de facturer">🧾 Créer la facture</button>`)}
      ${(savLie||isSAV)? '' : `<button class="btn small" onclick="transformerBonCommandeEnSAV('${jsAttr(b.id)}')">Créer un SAV</button>`}
      ${rapportLie? `<button class="btn small ghost" onclick="event.stopPropagation(); toggleLienZone('bonCommande:${jsAttr(b.id)}')">🔗 Modifier le lien rapport</button><button class="btn small ghost" onclick="event.stopPropagation(); delierLien('${jsAttr(rapportLie.id)}')" title="Retirer le lien entre ce bon de commande et son rapport">✂️ Délier</button>` : `<button class="btn small ghost" onclick="event.stopPropagation(); toggleLienZone('bonCommande:${jsAttr(b.id)}')">🔗 Lier un rapport</button>`}
      <button class="btn small danger" onclick="deleteItem('bonCommande','${jsAttr(b.id)}')">Supprimer</button>
    </div>
    ${state.lienOuvert==='bonCommande:'+b.id? `<div style="margin-top:8px;">${lienWidgetHTML('bonCommande', b.id, b.client)}</div>`:''}
    ${(!factureLiee && !isSAV && !b.valideDirecteur && workflowCtx!=='pieceCommande')? `<div class="bc-attente-message" style="margin-top:8px;">⏳ En attente — ${!b.valideConducteur? "la validation du conducteur puis du directeur est requise" : "la validation du directeur est requise"} avant de pouvoir facturer ce bon de commande.</div>` : ''}
    </div>`;
}
function bcMetiersDuBC(b){
  return (b.metiers && b.metiers.length) ? b.metiers : (b.metier? [b.metier] : []);
}
async function updatePieceCommandeChamp(bcId, champ, value){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  b[champ] = value;
  await window.stSet('bonCommande:'+bcId, b);
  await recharger('bonCommande');
  renderTab();
}
async function marquerPieceCommandee(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  b.pieceACommanderDateCommande = todayISO();
  const r = await window.stSet('bonCommande:'+bcId, b);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  renderTab();
  showToast('📦 Pièce commandée — classée dans le dossier '+(b.pieceACommanderFournisseur||'fournisseur'), 'success', 2500);
}
/**
 * La pièce est arrivée : le bon retourne dans « Non planifiés ».
 *
 * Le geste vit en base. Vider les champs ici ne servait à rien : `pieceACommander`,
 * `metiersFait` et `dateOrigineFait` n'ont pas de colonne, ils se dérivent des
 * tâches au chargement suivant. Surtout, les tâches gardaient leur date, si bien
 * que le planning reposait une vignette sur chacune de leurs anciennes journées
 * — le bon était à la fois « Non planifié » et encore accroché au calendrier.
 */
async function replanifierApresPiece(bcId){
  try{
    await window.pieceRecue(bcId);
  }catch(err){
    console.error('Retour au planning refusé', bcId, err);
    showToast(err && err.message ? err.message : 'Retour au planning impossible.');
    return;
  }
  await recharger('bonCommande');
  state.tab = 'planning';
  state.planningView = 'technicien';
  renderShell();
  renderTab();
  showToast('Pièce reçue — le bon de commande est de retour dans Planning (colonne "Non planifiés"), prêt à être replanifié.', 'success', 5000);
}
function bcToutesDatesDuBC(b){
  const liste = [];
  if(b.datePlanifiee) liste.push({ dayIso: b.datePlanifiee, fait: !!b.dateOrigineFait });
  (b.datesSupplementaires||[]).forEach(d=> liste.push({ dayIso: d.date, fait: !!d.fait }));
  return liste;
}
function toutesDatesValidees(b){
  const dates = bcToutesDatesDuBC(b);
  return dates.length===0 || dates.every(d=>d.fait);
}
/**
 * L'affaire est-elle entièrement pointée par le terrain ?
 *
 * On se fie aux tâches réelles remontées par l'adaptateur, pas aux cases par
 * métier : un bon PEINTURE+SOL n'a qu'une case par métier alors qu'il peut
 * porter plusieurs tâches, à des dates différentes et pour des équipes
 * différentes. Un bon sans aucune tâche n'est pas « terminé », il n'est pas
 * commencé — l'ancienne version répondait « oui » et laissait franchir l'étape.
 */
function bcTachesTerminees(b){
  if(typeof b.nbTaches === 'number'){
    return b.nbTaches > 0 && (b.tachesNonPointees||[]).length === 0;
  }
  // Bon jamais rechargé depuis la base : on retombe sur les cases cochées
  const metiers = bcMetiersDuBC(b);
  const fait = b.metiersFait || {};
  const metiersOk = metiers.length>0 && metiers.every(m=>fait[m]);
  return metiersOk && toutesDatesValidees(b);
}
function toggleTechFicheOuverte(id){
  state.techFicheOuverte = state.techFicheOuverte===id ? null : id;
  renderTab();
}
function bcInterventionFaite(b){
  const metiers = bcMetiersDuBC(b);
  const dates = bcToutesDatesDuBC(b);
  const metiersFaitReel = metiers.length>0 && metiers.every(m=>(b.metiersFait||{})[m]);
  const datesFaitReel = dates.length>0 && dates.every(d=>d.fait);
  const metiersOk = metiers.length===0 || metiersFaitReel;
  const datesOk = dates.length===0 || datesFaitReel;
  return metiersOk && datesOk && (metiersFaitReel || datesFaitReel);
}
/* ---------- Étape du circuit, en un coup d'œil ----------
   Le stepper détaillé ne s'affiche que dans les écrans de validation. Sur la
   liste et sur le planning, une pastille suffit à dire à qui c'est le tour —
   c'est ce qu'on cherche en balayant du regard. */
function etapeWorkflow(b){
  const bcId = b.bcId || b.id;
  if(state.factures.some(f=>f.bonCommandeId===bcId))
    return { cle:'facture', label:'Facturé', court:'Facturé', cls:'success' };
  if(b.valideDirecteur)
    return { cle:'aFacturer', label:'À facturer', court:'À facturer', cls:'success' };
  if(b.valideConducteur)
    return { cle:'directeur', label:'À valider — directeur', court:'Directeur', cls:'warn' };
  if(bcTachesTerminees(b))
    return { cle:'conducteur', label:'À valider — conducteur', court:'Conducteur', cls:'info' };
  return { cle:'terrain', label:'Travaux à pointer', court:'À pointer', cls:'danger' };
}

function badgeWorkflow(b){
  const e = etapeWorkflow(b);
  return `<span class="badge ${e.cls}" title="Étape du circuit de validation">${esc(e.label)}</span>`;
}

function bcWorkflowStepperHTML(b, ctx){
  const etape1 = bcTachesTerminees(b);
  const etape2 = !!b.valideConducteur;
  const etape3 = !!b.valideDirecteur;
  const etape4 = !!state.factures.find(f=>f.bonCommandeId===b.id);
  /* Arbitrer, c'est le geste du conducteur. Le bouton s'affichait sans aucun
     contrôle de rôle, là où celui du directeur était gardé juste en dessous :
     un technicien voyait « Valider (conducteur) » et se heurtait au refus de la
     base. Masquer ce qui serait de toute façon refusé. */
  const peutArbitrer = !window.actionsTache || window.actionsTache('realisee').peutArbitrer;
  const steps = [
    {label:'Métiers (technicien)', done:etape1},
    {label:'Conducteur', done:etape2},
    {label:'Directeur', done:etape3},
    {label:'Facturé (secrétariat)', done:etape4},
  ];
  return `<div class="bc-stepper">
    ${steps.map((s,i)=>`
      <div class="bc-step ${s.done?'is-done':''} ${!s.done && (i===0||steps[i-1].done)?'is-current':''}">
        <div class="bc-step-dot">${s.done?'✓':i+1}</div>
        <div class="bc-step-label">${s.label}</div>
      </div>
      ${i<steps.length-1? `<div class="bc-step-line ${steps[i].done?'is-done':''}"></div>`:''}
    `).join('')}
    <div class="bc-step-actions">
      ${ctx==='attente' && !etape2 && peutArbitrer? (etape1?
        `<button class="btn small primary" onclick="openValidationConducteurModal('${jsAttr(b.id)}')">✓ Valider (conducteur)</button>`
        : `<div class="bc-attente-message">⏳ En attente — tous les métiers doivent être marqués comme réalisés par le technicien avant de pouvoir passer à la validation du conducteur.</div>`
      ) : ''}
      ${/* Le stepper dit où en est le dossier ; le geste, lui, a un seul bouton,
            porté par la zone « pré-facture » de la carte — avec son montant. En
            mettre un second ici rendrait deux boutons pour la même chose. */''}
    </div>
  </div>`;
}
let validationConducteurCtx = null;
async function openValidationConducteurModal(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  /* Second garde-fou : masquer un bouton ne suffit pas, la fonction reste
     appelable depuis la console. La base refuserait, mais autant le dire ici. */
  if(window.actionsTache && !window.actionsTache('realisee').peutArbitrer){
    showToast("Seuls le conducteur de travaux et l'administrateur arbitrent les tâches.");
    return;
  }
  validationConducteurCtx = bcId;
  document.getElementById('validationConducteurInfo').textContent = `${b.numeroBC||b.client} — ${b.client}`;
  document.getElementById('validationConducteurTaches').innerHTML = '<div class="empty">Chargement des tâches…</div>';
  rafraichirTravauxSupplementaires(b.id, 'validationConducteurTravauxSup');
  document.getElementById('travailSupInput').value = '';
  document.getElementById('validationConducteurModal').style.display = 'flex';
  // Rien n'est encore contrôlé : le bouton ne s'ouvre qu'après lecture des tâches
  majBoutonValidationConducteur(false);

  /* On lit les tâches réelles : la liste des métiers ne dit ni combien de
     journées ont été planifiées, ni ce qui reste à pointer. */
  try{
    const taches = await window.listTachesBonCommande(bcId);
    renderValidationConducteurTaches(taches, b);
  }catch(err){
    console.error('Tâches indisponibles', err);
    document.getElementById('validationConducteurTaches').innerHTML =
      `<div class="empty">Tâches indisponibles : ${esc(err.message||'erreur inconnue')}</div>`;
  }
}
function closeValidationConducteurModal(){
  document.getElementById('validationConducteurModal').style.display = 'none';
  validationConducteurCtx = null;
}
/* Une ligne par tâche réelle : sur une affaire PEINTURE+SOL, le sol et la
   peinture sont faits par des équipes différentes, à des dates différentes.
   Ce qui bloque la validation doit se voir ici. */
const ETAT_TACHE = {
  planifiee: { icone:'⏳', couleur:'#8B93A7', libelle:'à pointer par le technicien' },
  realisee:  { icone:'✓',  couleur:'#5BC97A', libelle:'pointée — à arbitrer' },
  validee:   { icone:'✓',  couleur:'#2E9E5B', libelle:'validée' },
  refusee:   { icone:'✕',  couleur:'#C0392B', libelle:'refusée — à reprendre' },
};
function renderValidationConducteurTaches(taches, b){
  const zone = document.getElementById('validationConducteurTaches');
  if(!zone) return;
  const liste = taches || [];

  if(!liste.length){
    zone.innerHTML = '<div class="empty">Aucune tâche planifiée : il n\'y a rien à valider sur cette affaire.</div>';
    majBoutonValidationConducteur(false);
    return;
  }

  zone.innerHTML = liste.map(t=>{
    const etat = ETAT_TACHE[t.statut||'planifiee'] || ETAT_TACHE.planifiee;
    const titre = metierDisplayLabel(t.metier||'') || t.libelle || 'Tâche';
    const detail = [t.date_tache? fmtDate(t.date_tache):'', etat.libelle].filter(Boolean).join(' · ');
    return `<div class="achat-row" style="--cat-color:${etat.couleur};">
      <div class="achat-row-icon" style="background:${etat.couleur}22; color:${etat.couleur};">${etat.icone}</div>
      <div class="achat-row-main">
        <div class="achat-designation">${esc(titre)}</div>
        <div class="achat-date">${esc(detail)}</div>
      </div>
    </div>`;
  }).join('');

  // Les métiers du bon comptent aussi : un métier jamais planifié n'a pas de tâche
  const blocages = window.blocagesValidationConducteur(liste, b? bcMetiersDuBC(b) : []);
  const bandeau = blocages.length
    ? `<div class="wf-banner alerte" style="margin-top:10px;">⚠ ${esc(window.messageBlocages(blocages))}</div>`
    : `<div class="wf-banner ok" style="margin-top:10px;">✓ Toutes les tâches sont pointées : l'affaire peut être validée.</div>`;
  zone.insertAdjacentHTML('beforeend', bandeau);
  majBoutonValidationConducteur(blocages.length === 0);
}
function majBoutonValidationConducteur(actif){
  const btn = document.getElementById('validationConducteurConfirmBtn');
  if(btn) btn.disabled = !actif;
}
function addTravailSupplementaireTechnicien(){
  addTravailSupplementaire(techModalCtx.bcId, 'techTravailSupInput', 'techTravailSupListe');
}
function addTravailSupplementaireConducteur(){
  addTravailSupplementaire(validationConducteurCtx, 'travailSupInput', 'validationConducteurTravauxSup');
}
function renderTravauxSupplementairesListe(liste, bcId, containerId){
  const zone = document.getElementById(containerId);
  if(!zone) return;
  const prix = window.affichePrix ? window.affichePrix() : true;

  zone.innerHTML = (liste||[]).length ? liste.map(t=>{
    const chiffre = t.statut === 'chiffre';
    const detail = chiffre && prix
      ? money(t.prix_vente_ht) + ' HT'
      : (chiffre ? 'chiffré' : 'à chiffrer');
    return `<div class="achat-row" style="--cat-color:#9B6EF0;">
      <div class="achat-row-icon" style="background:#9B6EF022; color:#9B6EF0;">➕</div>
      <div class="achat-row-main">
        <div class="achat-designation">${esc(t.libelle)}</div>
        <div class="achat-date">${esc(detail)} · constaté par ${esc(t.origine||'—')}</div>
      </div>
      ${(!chiffre && prix) ? `<button class="btn small" onclick="demanderPrixTravailSupplementaire('${jsAttr(bcId)}','${jsAttr(t.id)}','${jsAttr(containerId)}')">💶</button>` : ''}
      <button class="btn small danger" onclick="removeTravailSupplementaire('${jsAttr(bcId)}','${jsAttr(t.id)}','${jsAttr(containerId)}')">✕</button>
    </div>`;
  }).join('') : '<div class="empty">Aucun travail supplémentaire.</div>';
}
/* Travaux constatés en plus du bon de commande.
   Ils vivent dans `tache_travaux_supplementaires` : l'ancien tableau posé sur
   l'objet BC n'avait aucune colonne et n'était donc jamais enregistré. Ils
   restent « à chiffrer » jusqu'à ce qu'un prix leur soit donné — les ajouter
   comme ligne à 0 € du bon de commande les aurait rendus invisibles. */
async function addTravailSupplementaire(bcId, inputId, containerId){
  const input = document.getElementById(inputId);
  const libelle = (input.value||'').trim();
  if(!libelle) return;

  try{
    const role = window.roleEffectif();
    await window.ajouterTravailSupplementaire(window.societeActive().uuid, {
      bon_commande_id: bcId,
      /* La saisie est au niveau du bon, pas du métier : rattacher la ligne à
         une tâche n'a de sens que si le bon n'en porte qu'une. Sur un bon
         multi-métiers, en désigner une serait arbitraire — le bon suffit à
         la retrouver, `bon_commande_id` étant la seule colonne obligatoire. */
      planning_tache_id: wfTaches.length === 1 ? wfTaches[0].tache.id : null,
      libelle,
      quantite: 1,
      origine: (role === 'conducteur' || role === 'admin') ? 'conducteur' : 'technicien',
    });
    input.value = '';
    await rafraichirTravauxSupplementaires(bcId, containerId);
    showToast('Travail supplémentaire consigné — à chiffrer.', 'success');
  }catch(err){
    console.error('Ajout du travail supplémentaire refusé', err);
    showToast(err.message || "Ajout impossible.");
  }
}

async function removeTravailSupplementaire(bcId, id, containerId){
  try{
    await window.supprimerTravailSupplementaire(id);
    await rafraichirTravauxSupplementaires(bcId, containerId);
  }catch(err){
    console.error('Suppression refusée', err);
    showToast(err.message || "Suppression impossible.");
  }
}

/* Chiffrage : réservé à ceux qui voient les prix.
   Le nom diffère volontairement de `window.chiffrerTravailSupplementaire`, qui
   est la requête injectée par le module : une fonction du script classique
   portant le même nom serait écrasée au chargement du module, et le bouton 💶
   appellerait la requête avec les mauvais arguments. */
async function demanderPrixTravailSupplementaire(bcId, id, containerId){
  const saisie = prompt('Prix de vente HT :');
  if(saisie === null) return;
  const prix = parseFloat(String(saisie).replace(',', '.'));
  if(!Number.isFinite(prix) || prix < 0){ showToast('Montant invalide.'); return; }

  try{
    await window.chiffrerTravailSupplementaire(id, prix);
    await rafraichirTravauxSupplementaires(bcId, containerId);
    showToast('Travail chiffré.', 'success');
  }catch(err){
    console.error('Chiffrage refusé', err);
    showToast(err.message || "Chiffrage impossible.");
  }
}

async function rafraichirTravauxSupplementaires(bcId, containerId){
  const zone = document.getElementById(containerId);
  if(!zone) return;
  try{
    const liste = await window.listTravauxSupplementaires(bcId);
    renderTravauxSupplementairesListe(liste, bcId, containerId);
  }catch(err){
    console.error('Travaux supplémentaires indisponibles', err);
    zone.innerHTML = '<div class="empty">Liste indisponible.</div>';
  }
}

/* Le conducteur clôt l'affaire entière. Le contrôle est fait par l'opération,
   pas ici : le motif du refus vient de la base et nomme le métier en attente. */
async function confirmerValidationConducteur(){
  const b = state.bonsCommande.find(x=>x.id===validationConducteurCtx);
  if(!b) return;

  try{
    await window.validerAffaireConducteur(b.id);
    await recharger('bonCommande', 'facture');
    closeValidationConducteurModal();
    renderTab();
    showToast('Affaire validée par le conducteur.', 'success');
  }catch(err){
    console.error('Validation conducteur refusée', err);
    showToast(err.message || "Validation refusée.");
  }
}

/* ===== Validation directeur =====
   Le directeur arrête le montant qui sera facturé. Il voit donc le bon comme un
   document — informations, chapitres, lignes, totaux — avec en surbrillance ce
   que le terrain a ajouté, et il ne peut valider que si plus rien n'est en
   suspens : tâches arbitrées, travaux chiffrés, lignes valorisées.

   Le contexte porte sa propre copie des lignes : `state.editing` est partagé
   avec le formulaire du bon et l'éditeur de pré-facture, y toucher écraserait
   une saisie en cours. */
let validationDirecteurCtx = null;

async function openValidationDirecteurModal(bcId){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  /* Chiffrer et valider sont deux droits distincts : la secrétaire chiffre,
     l'administrateur arrête le montant. La fenêtre s'ouvre donc pour les deux —
     la refuser à la secrétaire la renvoyait vers un éditeur qui ne montre pas
     les travaux ajoutés sur le chantier. Seul le bouton du bas est réservé. */
  const droits = window.actionsFacturation ? window.actionsFacturation() : { peutModifierPrefacture:true, peutValiderPrefacture:true };
  if(!droits.peutModifierPrefacture){
    showToast("La pré-facture se chiffre depuis un compte administrateur ou secrétariat.");
    return;
  }

  const prixVisibles = window.affichePrix ? window.affichePrix() : true;
  validationDirecteurCtx = {
    bcId,
    taches: [],
    travaux: [],
    lignes: JSON.parse(JSON.stringify(b.lignes || [])),
    avecPrix: prixVisibles,
    prixVisibles,
    peutValider: droits.peutValiderPrefacture,
    /* Le contournement du planning est un droit à part, même s'il tombe
       aujourd'hui sur le même rôle : c'est la base qui tranche, et elle les
       distingue par deux fonctions. */
    peutValiderHorsCircuit: !!droits.peutFacturerHorsCircuit,
    /* Le lieu et la référence du client, saisissables ici : ils manquent sur la
       quasi-totalité des bons de la file, et c'est au moment de chiffrer qu'on
       s'en aperçoit. Copiés dans le contexte comme les lignes — l'objet du bon
       ne bouge qu'à l'enregistrement, sinon une fermeture sans enregistrer
       laisserait les cartes afficher ce qui n'est pas en base. */
    adresse: b.adresse || '',
    codePostal: b.codePostal || '',
    ville: b.ville || '',
    numeroBC: b.numeroBC || '',
    // Rien d'ouvert au départ : le tableau des prix prend toute la largeur.
    reference: null
  };

  document.getElementById('validationDirecteurTitre').textContent =
    `Pré-facture — BC ${b.numeroInterne||b.numeroBC||'sans numéro'}`;
  document.getElementById('validationDirecteurInfo').textContent = `${b.client||''}`;
  document.getElementById('validationDirecteurCorps').innerHTML = '<div class="empty">Chargement du dossier…</div>';
  document.getElementById('validationDirecteurModal').style.display = 'flex';
  /* Rien n'est encore contrôlé : les boutons ne s'ouvrent qu'après lecture du
     dossier. Les DEUX doivent être refermés — le pied vit dans le HTML statique
     et n'est pas reconstruit d'une ouverture à l'autre, si bien que le bouton
     de contournement restait affiché, et cliquable, sur le bon SUIVANT. */
  majBoutonValidationDirecteur(false);
  majBoutonHorsCircuit(false);

  try{
    const [taches, travaux] = await Promise.all([
      window.listTachesBonCommande(bcId),
      window.listTravauxSupplementaires(bcId)
    ]);
    validationDirecteurCtx.taches = taches || [];
    validationDirecteurCtx.travaux = (travaux || []).filter(t=>t.statut !== 'integre');
    renderValidationDirecteur();
  }catch(err){
    console.error('Dossier de validation indisponible', err);
    document.getElementById('validationDirecteurCorps').innerHTML =
      `<div class="empty">Dossier indisponible : ${esc(err.message||'erreur inconnue')}. La validation reste bloquée tant qu'on ne peut pas contrôler l'état des tâches.</div>`;
    majBoutonValidationDirecteur(false);
    /* Surtout ici : sans cette ligne, un dossier illisible laissait offert le
       contournement calculé pour le bon précédent. */
    majBoutonHorsCircuit(false);
  }
}

function closeValidationDirecteurModal(){
  /* Le calque vit au niveau du corps : fermer la modale ne l'emporte pas, et
     « Annuler » laisserait un document plein écran au-dessus d'une application
     vide. La fonction est idempotente, l'appel est donc inconditionnel. */
  fermerReferencePleinEcran();
  document.getElementById('validationDirecteurModal').style.display = 'none';
  validationDirecteurCtx = null;
}

function majBoutonValidationDirecteur(actif){
  const btn = document.getElementById('validationDirecteurConfirmBtn');
  if(btn){
    const peutValider = !validationDirecteurCtx || validationDirecteurCtx.peutValider;
    btn.disabled = !actif;
    // Inutile de montrer à la secrétaire un bouton qu'elle ne peut pas presser.
    btn.style.display = peutValider ? '' : 'none';
  }
}

/* Montré, jamais grisé : un bouton désactivé qu'on ne sait pas activer est pire
   qu'un bouton absent. Il n'apparaît que lorsqu'il ferait quelque chose. */
function majBoutonHorsCircuit(visible){
  const btn = document.getElementById('validationDirecteurHorsCircuitBtn');
  if(btn) btn.style.display = visible ? '' : 'none';
}

function toggleValidationDirecteurPrix(coche){
  if(!validationDirecteurCtx) return;
  validationDirecteurCtx.avecPrix = !!coche;
  renderValidationDirecteur();
}

function blocagesDirecteur(b, ctx, options){
  return window.blocagesChiffrage({
    statutWorkflow: b.statutWorkflow,
    taches: ctx.taches,
    travaux: ctx.travaux,
    lignes: ctx.lignes
  }, options || {});
}

/* « Déjà chiffré » et « déjà facturé » ne sont pas des points à traiter : ce sont
   des gestes accomplis. Les annoncer sous « ⚠ il reste un point à traiter »
   disait le contraire de ce qu'ils veulent dire. */
const BLOCAGES_ACCOMPLIS = ['deja_chiffre', 'deja_facture'];

function blocagesDirecteurHTML(blocages, ctx, contournementOffert){
  if(blocages.length && blocages.every(x=>BLOCAGES_ACCOMPLIS.includes(x.code))){
    return `<div class="wf-banner" style="margin-bottom:10px;">
      ${blocages.map(x=>`<div>✓ ${esc(x.libelle)}</div>`).join('')}
    </div>`;
  }
  if(blocages.length){
    return `<div class="wf-banner alerte" style="margin-bottom:10px;">
      <div style="font-weight:700; margin-bottom:6px;">⚠ Il reste ${blocages.length===1?'un point':'des points'} à traiter avant de valider</div>
      <ul style="margin:0; padding-left:18px;">
        ${blocages.map(x=>`<li>${esc(x.libelle)}${x.details.length? ` <span class="card-sub">— ${esc(x.details.join(', '))}</span>`:''}</li>`).join('')}
      </ul>
      ${/* Dire ce que fait le second bouton avant qu'il soit pressé : c'est le
            seul endroit où l'on peut expliquer qu'il laisse une trace. */''}
      ${contournementOffert? `<div class="card-sub" style="margin-top:8px;">Le montant, lui, est complet. Si cette affaire n'a pas de terrain à pointer, « Valider sans passer par le planning » l'envoie en facturation — et la base en garde la trace.</div>`:''}
    </div>`;
  }
  /* Chiffrer et valider sont deux droits : la secrétaire complète le dossier,
     l'administrateur arrête le montant. Le dire, plutôt que griser en silence. */
  if(ctx && !ctx.peutValider){
    return `<div class="wf-banner" style="margin-bottom:10px;">Le dossier est complet. La validation revient à un administrateur — enregistrez, il prendra la suite.</div>`;
  }
  return `<div class="wf-banner ok" style="margin-bottom:10px;">✓ Rien ne reste en suspens : la pré-facture peut être validée.</div>`;
}

/* Chiffrage : toute ligne et tout travail supplémentaire y passe, pour que le
   directeur valide chaque montant et pas seulement ceux qui manquent. */
function chiffrageDirecteurHTML(ctx){
  /* Tout est rendu, chapitres et commentaires compris. Les filtrer ici les
     laissait s'ajouter dans le dossier sans jamais apparaître : le bouton
     répondait, l'écran non. Leur index d'origine est conservé — c'est lui que
     la saisie et la suppression adressent. */
  const lignes = (ctx.lignes||[]).map((l,i)=>({l,i}));

  /* Le tableau se **saisit**, il ne fait pas que se chiffrer : 600 bons de
     commande sur 829 n'ont aucune ligne, et c'est ici qu'on les construit.
     C'est ce que faisait l'éditeur retiré de la carte ; la capacité déménage,
     elle ne disparaît pas.

     `oninput` et non `onchange` : le total suit la frappe. Seuls l'aperçu, le
     total et le pied sont redessinés — jamais les champs, sinon la saisie
     perdrait le focus à chaque caractère. Ajouter ou retirer une ligne, en
     revanche, refait le tableau : la structure a changé. */
  const rows = lignes.map(({l,i})=>{
    const type = l.type || 'ligne';
    const manquant = type === 'ligne' && !(parseFloat(l.prixUnitaire) > 0);
    if(type !== 'ligne'){
      /* Un chapitre et un commentaire ne se saisissent pas dans le même champ
         gris : on doit voir ce qu'on construit. Le champ porte donc l'allure
         qu'aura la ligne sur le document. */
      const allure = type==='chapitre'
        ? 'font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#C24E00;'
        : 'font-style:italic; color:#6B7686;';
      return `<tr class="dnd-row ${type==='chapitre'?'p-chapitre':'p-comment'}" ondragover="dragOverLigne(event,'prefacture')" ondrop="dropLigne(event, ${i}, 'prefacture')">
        <td colspan="3"><div class="row-mic"><span class="drag-handle" draggable="true" ondragstart="dragStartLigne(event, ${i}, 'prefacture')" title="Déplacer">⠿</span><input type="text" value="${esc(l.designation||'')}" placeholder="${type==='chapitre'?'Titre du chapitre':'Commentaire (ni quantité ni prix)'}" style="width:100%; ${allure}" oninput="majLigneDirecteur(${i},'designation',this.value)"></div></td>
        <td class="num"><button class="btn small danger" onclick="supprimerLigneDirecteur(${i})" title="Retirer">✕</button></td>
      </tr>`;
    }
    return `<tr class="dnd-row ${manquant?'p-sans-prix':''}" ondragover="dragOverLigne(event,'prefacture')" ondrop="dropLigne(event, ${i}, 'prefacture')">
      <td><div class="row-mic"><span class="drag-handle" draggable="true" ondragstart="dragStartLigne(event, ${i}, 'prefacture')" title="Déplacer">⠿</span><input type="text" value="${esc(l.designation||'')}" placeholder="Désignation" style="width:100%;" oninput="majLigneDirecteur(${i},'designation',this.value)"></div></td>
      <td class="num"><input type="number" step="0.01" min="0" value="${l.qte!=null?esc(l.qte):1}" style="width:70px; text-align:right;" oninput="majLigneDirecteur(${i},'qte',this.value)"> <input type="text" value="${esc(l.unite||'u')}" style="width:52px;" oninput="majLigneDirecteur(${i},'unite',this.value)"></td>
      <td class="num"><input type="number" step="0.01" min="0" value="${l.prixUnitaire!=null?esc(l.prixUnitaire):''}" placeholder="prix" style="width:100px; text-align:right;" oninput="majLigneDirecteur(${i},'prixUnitaire',this.value)"></td>
      <td class="num"><button class="btn small danger" onclick="supprimerLigneDirecteur(${i})" title="Retirer">✕</button></td>
    </tr>`;
  }).join('');

  /* Les travaux supplémentaires vivent dans leur propre table et ont leur
     circuit : on les chiffre ici, on ne les invente ni ne les efface. */
  const travaux = (ctx.travaux||[]).map(t=>{
    const manquant = t.statut !== 'chiffre';
    return `<tr class="${manquant?'p-sans-prix':''}">
      <td><div class="row-mic"><span class="drag-handle" draggable="true" ondragstart="dragStartTravail(event, '${jsAttr(t.id)}')" title="Glisser dans une ligne du bon pour l'y intégrer">⠿</span><span>${esc(t.libelle||'—')} <span class="p-badge-origine">${esc(window.badgeOrigine(t.origine))}</span></span></div></td>
      <td class="num"><input type="number" step="0.01" min="0" value="${t.quantite!=null?esc(t.quantite):1}" style="width:70px; text-align:right;" oninput="majTravailDirecteur('${jsAttr(t.id)}','quantite',this.value)"> <input type="text" value="${esc(t.unite||'u')}" style="width:52px;" oninput="majTravailDirecteur('${jsAttr(t.id)}','unite',this.value)"></td>
      <td class="num"><input type="number" step="0.01" min="0" value="${t.prix_vente_ht!=null?esc(t.prix_vente_ht):''}" placeholder="prix" style="width:100px; text-align:right;" oninput="majPrixTravailDirecteur('${jsAttr(t.id)}', this.value)"></td>
      <td></td>
    </tr>`;
  }).join('');

  /* Les lignes du bon vivent dans leur propre `tbody` : c'est lui que le
     glisser-déposer adresse. Les travaux supplémentaires sont dans un autre,
     et ne se réordonnent pas — ils viennent d'une table à part, avec leur
     propre circuit, et leur ordre n'a pas de sens sur le document. */
  return `<table class="lignes-table" style="margin-top:8px;">
    <thead><tr><th style="width:44%;">Désignation</th><th class="num">Qté / unité</th><th class="num">Prix U. HT</th><th></th></tr></thead>
    <tbody id="validationDirecteurLignes">
      ${rows || `<tr><td colspan="4" class="card-sub">Ce bon de commande n'a aucune ligne. Ajoutez-les ci-dessous.</td></tr>`}
    </tbody>
    ${travaux? `<tbody><tr class="p-chapitre"><td colspan="4">Travaux supplémentaires constatés sur le chantier</td></tr>${travaux}</tbody>`:''}
  </table>
  <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
    <button type="button" class="btn small" onclick="ajouterLigneDirecteur('ligne')">+ Ligne</button>
    <button type="button" class="btn small" onclick="ajouterLigneDirecteur('chapitre')">+ Chapitre</button>
    <button type="button" class="btn small" onclick="ajouterLigneDirecteur('commentaire')">+ Commentaire</button>
  </div>
  <div class="totals-box" id="validationDirecteurTotal" style="margin-top:10px;">${totalChiffrageHTML(ctx)}</div>`;
}

/** Une valeur change : l'aperçu et le total suivent, les champs ne bougent pas. */
function majLigneDirecteur(index, champ, valeur){
  if(!validationDirecteurCtx) return;
  const ligne = validationDirecteurCtx.lignes[index];
  if(!ligne) return;
  ligne[champ] = (champ === 'designation' || champ === 'unite')
    ? valeur
    : (parseFloat(String(valeur).replace(',', '.')) || 0);
  rafraichirChiffrageDirecteur();
}

/** La structure change : le tableau se refait, le focus part sur la nouveauté. */
function ajouterLigneDirecteur(type){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  ctx.lignes.push(type === 'ligne'
    ? { type:'ligne', designation:'', qte:1, unite:'u', prixUnitaire:0, tva: tvaDefaut() }
    : { type, designation:'' });
  renderValidationDirecteur();
}

function supprimerLigneDirecteur(index){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  ctx.lignes.splice(index, 1);
  renderValidationDirecteur();
}

/** Le total de ce qui est saisi à l'instant, lignes et travaux confondus. */
function totalChiffrageHTML(ctx){
  return totalsBoxInnerHTML(computeTotalsAvecRemise(
    window.lignesDocumentDirecteur(ctx.lignes, ctx.travaux, tvaDefaut()), 0
  ));
}

function comptesRendusHTML(ctx){
  const rendus = window.comptesRendusTerrain(ctx.taches);
  const total = (ctx.taches||[]).length;
  if(!rendus.length){
    return `<div class="empty">Aucun compte rendu de terrain sur les ${total} tâche(s) de ce bon.</div>`;
  }
  return rendus.map(r=>`<div class="achat-row" style="--cat-color:#E9A23B; align-items:flex-start;">
    <div class="achat-row-icon" style="background:#E9A23B22; color:#E9A23B;">💬</div>
    <div class="achat-row-main">
      <div class="achat-designation">${esc(r.libelle||r.metier||'Tâche')}</div>
      <div class="achat-date">${esc([r.date? fmtDate(r.date):'', r.heures, r.statut].filter(Boolean).join(' · '))}${r.valideePar? ' · validée par '+esc(window.nomIntervenant(r.valideePar)):''}</div>
      ${r.commentaire? `<div style="margin-top:6px; white-space:pre-wrap;">${esc(r.commentaire)}</div>`:''}
      ${r.croquis? `<img src="${esc(r.croquis)}" alt="Croquis du technicien" style="margin-top:8px; max-width:220px; border-radius:8px; border:1px solid #E4E8EE;">`:''}
    </div>
  </div>`).join('');
}

function renderValidationDirecteur(){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
  if(!b) return;

  /* L'ordre suit celui du travail : ce qui a été commandé et ce que le terrain
     a ajouté, ce qu'il en a dit, puis les prix. Ce qui bloque et le bouton
     vivent dans le pied, toujours visible. */
  /* Ce qu'on fait ici, c'est saisir des prix. Le tableau est donc le sujet, et
     la pièce d'origine — devis ou bon de commande — s'ouvre à côté quand on
     veut la consulter. Rendre la pré-facture elle-même n'apprenait rien : on
     la regarde une fois émise, pas pendant qu'on la chiffre. */
  document.getElementById('validationDirecteurCorps').innerHTML = `
    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
      ${referencesPrefactureHTML(ctx, b)}
      <label class="bc-tache-row" style="margin:0;">
        <input type="checkbox" ${ctx.avecPrix?'checked':''} ${ctx.prixVisibles?'':'disabled'} onchange="toggleValidationDirecteurPrix(this.checked)">
        <span>Afficher les prix${ctx.prixVisibles?'':' — masqués pour votre rôle'}</span>
      </label>
    </div>
    ${enteteDossierHTML(ctx, b)}
    <div class="pf-colonnes">
      ${ctx.reference? `<div class="print-preview pf-reference">${referenceDocumentHTML(ctx, b)}</div>` : ''}
      <div class="pf-travail">
        <div class="section-title" style="margin-top:0;">💶 Les prix — chaque poste, commandé ou ajouté</div>
        ${chiffrageDirecteurHTML(ctx)}
        <div class="section-title" style="margin-top:18px;">💬 Ce que le terrain a rapporté</div>
        ${comptesRendusHTML(ctx)}
      </div>
    </div>
  `;
  rafraichirChiffrageDirecteur();
}

/**
 * Où l'on est allé, et sous quelle référence le client connaît l'affaire.
 *
 * Les deux figurent sur la carte de la file… et disparaissaient à l'ouverture
 * de la modale, c'est-à-dire au moment précis où l'on chiffre ce qu'ils vont
 * déterminer : le bloc « Lieu d'intervention » du document, et la référence de
 * commande que porte la facture électronique.
 *
 * Saisissables, et pas seulement affichés : sur les 211 bons de la file, 195
 * n'ont aucune référence client et 119 sur 120 des bons prêts à chiffrer n'ont
 * pas d'adresse. Renvoyer l'utilisateur au formulaire du bon pour les remplir,
 * c'est lui faire perdre le chiffrage en cours.
 *
 * L'occupant et le statut du logement restent en lecture : ils obéissent à des
 * règles de cohérence (`cleanLogementFields`) qui vivent dans le formulaire.
 */
function enteteDossierHTML(ctx, b){
  const lieu = window.lieuIntervention(ctx);
  const ref = window.refBonCommandeClient(ctx.numeroBC);
  const occupant = [b.occupant, b.numeroLogement? 'Log. '+b.numeroLogement : '', b.etage? 'Étage '+b.etage : '']
    .filter(Boolean).map(esc).join(' · ');

  return `<div class="pf-entete">
    <div class="pf-entete-champ" style="flex:2 1 320px;">
      <label>Lieu d'intervention${lieu.renseigne? '' : ' <span class="pf-entete-manque">non renseigné</span>'}</label>
      <input type="text" value="${esc(ctx.adresse)}" placeholder="Adresse des travaux" aria-label="Adresse d'intervention"
             oninput="majEnteteDirecteur('adresse', this.value)">
      <div style="display:flex; gap:6px; margin-top:6px;">
        <input type="text" style="flex:0 0 90px;" maxlength="5" inputmode="numeric" value="${esc(ctx.codePostal)}" placeholder="CP" aria-label="Code postal"
               oninput="majEnteteDirecteur('codePostal', this.value)">
        <input type="text" style="flex:1;" value="${esc(ctx.ville)}" placeholder="Ville" aria-label="Ville"
               oninput="majEnteteDirecteur('ville', this.value)">
      </div>
      ${occupant? `<div class="card-sub" style="margin-top:6px;">${occupant}</div>`:''}
      ${b.logementStatut? `<div style="margin-top:6px;">${logementBadge(b.logementStatut)}</div>`:''}
    </div>
    <div class="pf-entete-champ" style="flex:1 1 220px;">
      <label>N° de bon de commande du client</label>
      <input type="text" value="${esc(ctx.numeroBC)}" placeholder="Numéro figurant sur le bon reçu" aria-label="Numéro de bon de commande du client"
             oninput="majEnteteDirecteur('numeroBC', this.value)">
      <div class="card-sub" id="pfEnteteRef" style="margin-top:6px;">${refPartanteHTML(ref)}</div>
      ${b.numeroInterne? `<div class="card-sub" style="margin-top:4px;">Notre n° interne : ${esc(b.numeroInterne)}</div>`:''}
    </div>
  </div>`;
}

/* Ce qui partira réellement sur la facture : « Sans BC » et les numéros de
   notre série SAV sont écartés par la même règle que la base. Le dire ici évite
   de découvrir le champ vide sur la facture électronique. */
function refPartanteHTML(ref){
  return ref
    ? `Référence transmise au client : <b>${esc(ref)}</b>`
    : `<span class="pf-entete-manque">Aucune référence ne partira sur la facture</span>`;
}

/* Le contexte seul est touché, et rien n'est redessiné : reconstruire le
   bandeau à la frappe ferait sauter le curseur. C'est le patron de
   `majLigneDirecteur`, pour la même raison. */
function majEnteteDirecteur(champ, valeur){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  ctx[champ] = valeur;
  if(champ === 'numeroBC'){
    const zone = document.getElementById('pfEnteteRef');
    if(zone) zone.innerHTML = refPartanteHTML(window.refBonCommandeClient(valeur));
  }
}

/**
 * Les pièces consultables : le bon toujours, le devis s'il y en a un.
 *
 * Quand le bon reçu du client est là, c'est LUI qu'on propose d'abord : au
 * moment de facturer, ce qui fait foi est le document signé par le client, pas
 * notre re-rendu de ses lignes. La fiche interne reste à côté — elle sert
 * encore, mais elle cesse d'être ce qu'on obtient par défaut.
 */
function referencesPrefactureHTML(ctx, b){
  const devis = b.devisId ? state.devis.find(d=>d.id===b.devisId) : null;
  const bouton = (cle, libelle) => `<button class="btn small ${ctx.reference===cle?'primary':'ghost'}" onclick="basculerReferencePrefacture('${jsAttr(cle)}')">${ctx.reference===cle?'✓ ':''}${libelle}</button>`;
  const aLeDocument = !!b.pieceJointeChemin;
  return `<div style="display:flex; gap:6px; flex-wrap:wrap;">
    <span class="card-sub" style="align-self:center;">Consulter :</span>
    ${aLeDocument? bouton('bonClient', '📎 Bon du client') : ''}
    ${bouton('bonCommande', aLeDocument? '🧾 Fiche interne' : '📄 Bon de commande')}
    ${devis? bouton('devis', `📄 Devis ${esc(devis.numero||'')}`) : ''}
    ${/* Vaut pour les trois : le devis et la fiche interne sont eux aussi des
         A4 écrasés dans 44 % de la largeur. Rien à agrandir tant que rien
         n'est ouvert. */''}
    ${ctx.reference? `<button class="btn small ghost" onclick="ouvrirReferencePleinEcran()" title="Lire le document en grand (Échap pour revenir)">🔎 Agrandir</button>` : ''}
  </div>`;
}

/**
 * La pièce à consulter, et sous quelle forme.
 *
 * `mode` vaut `fichier` quand c'est le document que le client a envoyé — il
 * porte sa propre mise en page — et `document` quand c'est l'un de nos rendus,
 * qui a besoin du cadre de page. Le panneau et le plein écran habillent donc
 * différemment, mais **choisissent la pièce au même endroit** : deux copies de
 * cette décision finiraient par diverger, et le plein écran montrerait autre
 * chose que le panneau. Or c'est ce document-là qui fait foi.
 *
 * `pourLire` demande au lecteur PDF la largeur de page au lieu de la page
 * entière — voir `urlApercuPdf`. Faux pour le panneau, où la largeur n'est pas
 * la contrainte.
 */
function referencePrefacture(ctx, b, classeFichier, pourLire){
  const nom = b.pieceJointeNom || 'Bon du client';
  const notreRendu = (type, id) => ({
    mode: 'document', chemin: null,
    titre: type === 'devis' ? 'Devis' : 'Fiche interne du bon de commande',
    html: renderPrintDoc(type, id, !ctx.avecPrix),
  });

  if(ctx.reference === 'bonClient'){
    /* L'URL a été obtenue par `basculerReferencePrefacture` : elle est signée,
       donc asynchrone, alors que ce rendu ne l'est pas. Si elle manque, c'est
       que la signature a échoué — on montre la fiche plutôt qu'un cadre vide. */
    if(ctx.urlBonClient){
      const mode = window.apercuDe(ctx.urlBonClient, b.pieceJointeMime, b.pieceJointeNom);
      const source = (mode === 'pdf' && pourLire) ? window.urlApercuPdf(ctx.urlBonClient) : ctx.urlBonClient;
      if(mode === 'pdf') return { mode:'fichier', chemin:b.pieceJointeChemin, titre:nom,
        html:`<iframe class="${classeFichier}" src="${esc(source)}"></iframe>` };
      if(mode === 'image') return { mode:'fichier', chemin:b.pieceJointeChemin, titre:nom,
        html:`<img class="${classeFichier}" src="${esc(source)}" alt="${esc(nom)}">` };
    }
    return notreRendu('bonCommande', ctx.bcId);
  }
  if(ctx.reference === 'devis' && b.devisId) return notreRendu('devis', b.devisId);
  return notreRendu('bonCommande', ctx.bcId);
}

function referenceDocumentHTML(ctx, b){
  return referencePrefacture(ctx, b, 'pf-reference-fichier', false).html;
}

/* Un second clic referme : la référence est une aide, pas un décor permanent —
   refermée, le tableau reprend toute la largeur. */
async function basculerReferencePrefacture(cle){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  ctx.reference = ctx.reference === cle ? null : cle;

  /* L'URL signée est demandée ici, une fois, et non au rendu : la modale se
     redessine à chaque frappe dans un champ de prix, et re-signer à chaque fois
     rechargerait le document sous les yeux de l'utilisateur. */
  if(ctx.reference === 'bonClient' && !ctx.urlBonClient){
    const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
    if(b && b.pieceJointeChemin){
      try{
        ctx.urlBonClient = await window.urlPieceJointe(b.pieceJointeChemin);
      }catch(err){
        console.error('Bon du client illisible', b.pieceJointeChemin, err);
        showToast("Le document du client n'a pas pu être ouvert — voici la fiche interne.");
      }
    }
  }
  renderValidationDirecteur();
}

/* ---------- Le document de référence, en grand ----------
   Le panneau latéral sert à situer le document ; il ne permet pas de le lire.
   Ces quatre fonctions sont toute la surface du plein écran — c'est ce qui
   permettrait, le jour venu, de passer à l'API plein écran du navigateur sans
   toucher au reste. */

function ouvrirReferencePleinEcran(){
  const ctx = validationDirecteurCtx;
  if(!ctx || !ctx.reference) return;
  const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
  if(!b) return;

  const calque = document.getElementById('pfPleinEcran');
  const corps = document.getElementById('pfPleinCorps');
  const r = referencePrefacture(ctx, b, 'pf-plein-fichier', true);

  document.getElementById('pfPleinTitre').textContent = r.titre;
  corps.innerHTML = r.mode === 'document' ? `<div class="print-preview">${r.html}</div>` : r.html;

  /* Le téléchargement se résout après l'affichage : sur une URL signée, un
     attribut `download` est ignoré — il faut une URL signée pour cela — et
     cette signature-là n'est pas mise en cache. Attendre l'aller-retour
     retarderait l'ouverture pour un bouton secondaire. */
  const dl = document.getElementById('pfPleinDl');
  dl.style.display = r.chemin ? 'inline-block' : 'none';
  if(r.chemin){
    dl.removeAttribute('href');
    window.urlTelechargementPieceJointe(r.chemin)
      .then(url => { dl.href = url; dl.download = r.titre; })
      .catch(err => { console.error('Téléchargement indisponible', r.chemin, err); dl.style.display = 'none'; });
  }

  calque.style.display = 'flex';
  document.addEventListener('keydown', toucheReferencePleinEcran);
  /* Le focus sur la croix, et pas ailleurs : une fois le curseur passé dans
     l'iframe du PDF — autre domaine — les frappes n'atteignent plus cette page
     et Échap cesse de répondre. La première pression, elle, marche toujours. */
  document.getElementById('pfPleinFermer').focus();
}

/** Idempotente : appelable sans condition, y compris à la fermeture de la modale. */
function fermerReferencePleinEcran(){
  const calque = document.getElementById('pfPleinEcran');
  if(!calque) return;
  calque.style.display = 'none';
  /* Vidé, et pas seulement masqué : une iframe laissée en place garde le PDF en
     mémoire et continue d'interroger une URL qui expirera. */
  document.getElementById('pfPleinCorps').innerHTML = '';
  document.removeEventListener('keydown', toucheReferencePleinEcran);
}

/* Le fond, et lui seul — un clic dans le document ne doit pas refermer. */
function fermerReferencePleinEcranSiFond(ev){
  if(ev.target === ev.currentTarget) fermerReferencePleinEcran();
}

function toucheReferencePleinEcran(ev){
  if(ev.key !== 'Escape') return;
  ev.stopPropagation();
  fermerReferencePleinEcran();
}

/* Redessine ce qui dépend des prix, et **seulement** cela : les champs de
   saisie ne sont pas reconstruits, donc le focus et le curseur ne bougent pas
   pendant la frappe. */
function rafraichirChiffrageDirecteur(){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
  if(!b) return;

  const total = document.getElementById('validationDirecteurTotal');
  if(total) total.innerHTML = totalChiffrageHTML(ctx);

  const blocages = blocagesDirecteur(b, ctx);
  /* La même liste, sans ce que le planning exige. Si elle est vide alors que
     l'autre ne l'est pas, la différence EST le planning — inutile d'énumérer
     les codes concernés ici : la règle partagée sait lesquels elle retire, et
     les nommer une seconde fois les ferait diverger au premier ajout. */
  const horsCircuit = blocagesDirecteur(b, ctx, {horsCircuit:true});
  const contournementOffert = blocages.length > 0
    && horsCircuit.length === 0
    && !!ctx.peutValiderHorsCircuit;

  const zone = document.getElementById('validationDirecteurBlocages');
  if(zone) zone.innerHTML = blocagesDirecteurHTML(blocages, ctx, contournementOffert);

  majBoutonValidationDirecteur(blocages.length === 0 && ctx.peutValider);
  majBoutonHorsCircuit(contournementOffert);
}

/**
 * Un travail constaté se chiffre comme une ligne : quantité, unité, prix.
 *
 * La quantité et l'unité étaient figées à « 1 u » à l'écran, alors que la table
 * les porte et que `bc_generer_facture` les reprend sur la facture. « Reprise
 * de plinthes sur 4 ml » ne pouvait donc être chiffré qu'au forfait, et la
 * facture affichait une quantité fausse.
 */
function majTravailDirecteur(id, champ, valeur){
  if(!validationDirecteurCtx) return;
  const travail = validationDirecteurCtx.travaux.find(t=>t.id===id);
  if(!travail) return;

  if(champ === 'unite'){
    travail.unite = valeur;
  } else {
    travail[champ] = parseFloat(String(valeur).replace(',', '.')) || 0;
  }
  /* Le statut ne bascule qu'au prix : une quantité saisie sans montant ne
     chiffre rien, et `bc_chiffrage_valide` doit continuer de bloquer. */
  if(champ === 'prix_vente_ht') travail.statut = 'chiffre';
  rafraichirChiffrageDirecteur();
}

/** Conservée : l'ancien nom est encore cité par le champ de prix. */
function majPrixTravailDirecteur(id, valeur){
  majTravailDirecteur(id, 'prix_vente_ht', valeur);
}

/* Les prix sont enregistrés avant la validation, jamais en même temps : si un
   enregistrement échoue, le directeur doit le savoir sans avoir rien validé.
   Renvoie vrai si tout est passé — l'appelant décide de la suite. */
async function enregistrerChiffrageDirecteur(silencieux){
  const ctx = validationDirecteurCtx;
  if(!ctx) return false;
  const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
  if(!b) return false;

  try{
    for(const t of ctx.travaux){
      if(t.prix_vente_ht == null) continue;
      await window.chiffrerTravailSupplementaire(t.id, {
        prixVenteHt: Number(t.prix_vente_ht),
        quantite: t.quantite != null ? Number(t.quantite) : 1,
        unite: t.unite || 'u',
      });
    }
    b.lignes = JSON.parse(JSON.stringify(ctx.lignes));
    b.montant = computeTotals(b.lignes).ht;
    /* Le lieu et la référence du client partent dans la même écriture que les
       prix : un seul geste pour l'utilisateur, une seule ligne touchée. Le
       déclencheur `bons_commande_etat_reserve` ne se réveille que si
       `statut_workflow` change — ce n'est pas le cas ici. */
    b.adresse = ctx.adresse;
    b.codePostal = ctx.codePostal;
    b.ville = ctx.ville;
    b.numeroBC = ctx.numeroBC;
    const r = await window.stSet('bonCommande:'+b.id, b);
    if(!r){ showToast(saveFailedMessage()); return false; }

    /* Après l'enregistrement des lignes, jamais avant : si le bon n'avait pas
       pu s'écrire, un travail déjà marqué « intégré » aurait disparu des deux
       côtés — ni dans la liste des travaux, ni sur le document. */
    for(const id of (ctx.travauxIntegres || [])){
      await window.integrerTravailSupplementaire(id);
    }
    ctx.travauxIntegres = [];

    ctx.travaux = (await window.listTravauxSupplementaires(ctx.bcId)).filter(t=>t.statut !== 'integre');
    renderValidationDirecteur();
    if(!silencieux) showToast('Prix enregistrés.', 'success');
    return true;
  }catch(err){
    console.error('Enregistrement du chiffrage refusé', err);
    showToast(err.message || "Enregistrement impossible.");
    return false;
  }
}

/* Un seul geste pour l'utilisateur : enregistrer fait partie de valider. Les
   deux restent deux appels, pour qu'un échec d'enregistrement n'ait jamais
   l'air d'une validation — et le message dit lequel des deux a échoué. */
async function confirmerValidationDirecteur(){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;

  const enregistre = await enregistrerChiffrageDirecteur(true);
  if(!enregistre){
    showToast("Les prix n'ont pas pu être enregistrés : rien n'a été validé.");
    return;
  }

  try{
    await window.validerChiffrage(ctx.bcId);
    await recharger('bonCommande', 'facture');
    closeValidationDirecteurModal();
    renderTab();
    showToast('Pré-facture validée — le bon passe à « À facturer ».', 'success', 3000);
  }catch(err){
    // Le motif vient de la base : le montrer, plutôt qu'un message générique
    console.error('Validation directeur refusée', err);
    showToast('Prix enregistrés, mais validation refusée : ' + (err.message || 'motif inconnu'));
  }
}

/* Le même enchaînement — enregistrer, puis valider — mais par la porte qui ne
   demande pas de tâche. Deux fonctions et non un drapeau : c'est ce qui permet
   à la confirmation de dire ce qu'elle engage, et à la relecture de voir en un
   coup d'œil lequel des deux gestes a été posé. */
async function confirmerValidationHorsCircuit(){
  const ctx = validationDirecteurCtx;
  if(!ctx) return;
  const b = state.bonsCommande.find(x=>x.id===ctx.bcId);
  if(!b) return;
  if(!window.validerChiffrageHorsCircuit){ showToast("Ce geste n'est pas disponible."); return; }

  const t = computeTotals(ctx.lignes || []);
  if(!confirm(`Envoyer ce bon de commande en facturation SANS passer par le planning ?\n\n`
    + `${b.client||''} — ${moneyDisplay(t.ttc)} TTC\n\n`
    + `Aucune tâche n'attestera des travaux. Le bon passera directement à « À facturer ».\n`
    + `Ce contournement est enregistré au journal de la base, avec votre nom.`)) return;

  const enregistre = await enregistrerChiffrageDirecteur(true);
  if(!enregistre){
    showToast("Les prix n'ont pas pu être enregistrés : rien n'a été validé.");
    return;
  }

  try{
    await window.validerChiffrageHorsCircuit(ctx.bcId);
    await recharger('bonCommande', 'facture');
    closeValidationDirecteurModal();
    renderTab();
    showToast('Pré-facture validée hors circuit — le bon passe à « À facturer ».', 'success', 4000);
  }catch(err){
    console.error('Validation hors circuit refusée', err);
    showToast('Prix enregistrés, mais validation refusée : ' + (err.message || 'motif inconnu'));
  }
}
function bcMetiersChecklistHTML(b){
  const metiers = bcMetiersDuBC(b);
  if(!metiers.length) return '';
  const fait = b.metiersFait || {};
  const nbFait = metiers.filter(m=>fait[m]).length;
  return `<div class="bc-metiers-checklist">
    <div class="card-sub" style="font-weight:700; margin-bottom:6px;">🔧 Métiers réalisés (${nbFait}/${metiers.length})${metiers.length>1? ' — tous requis pour valider':''}</div>
    ${metiers.map(m=>`<label class="bc-tache-row ${fait[m]?'is-fait':''}">
      <input type="checkbox" ${fait[m]?'checked':''} onchange="toggleBCMetierFait('${jsAttr(b.id)}','${jsAttr(m)}')">
      <span style="flex:1;">${esc(metierDisplayLabel(m))}</span>
    </label>`).join('')}
  </div>`;
}
async function toggleBCMetierFait(bcId, metier){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  if(!b.metiersFait) b.metiersFait = {};
  b.metiersFait[metier] = !b.metiersFait[metier];
  await window.stSet('bonCommande:'+bcId, b);
  await recharger('bonCommande');
  renderTab();
}
async function validerBCEtape(bcId, etape){
  const b = state.bonsCommande.find(x=>x.id===bcId);
  if(!b) return;
  /* L'étape directeur engage le montant : elle passe par l'écran qui montre le
     document et par l'opération qui contrôle, jamais par un enregistrement
     silencieux. */
  if(etape==='directeur'){ await openValidationDirecteurModal(bcId); return; }

  /* Même règle que dans la modale : toutes les tâches ou aucune. */
  try{
    await window.validerAffaireConducteur(bcId);
    await recharger('bonCommande', 'facture');
    renderTab();
    showToast('Affaire validée par le conducteur.', 'success');
  }catch(err){
    console.error('Validation conducteur refusée', err);
    showToast(err.message || "Validation refusée.");
  }
}
/* `devaliderBC` a été retirée avec son bouton « ↩ Réinitialiser les validations ».
   Elle écrivait `valideConducteur` et `valideDirecteur`, deux champs dérivés des
   tâches et sans colonne : le pont les ignore, le rechargement les recalculait à
   l'identique. Le bouton demandait confirmation, affichait un succès, et ne
   réinitialisait rien.

   Il n'est pas remplacé par une vraie dévalidation : le circuit tient sur le
   fait qu'une tâche validée est close — `tache_marquer_realisee` refuse
   explicitement de la rouvrir, pour qu'un arbitrage ne s'efface pas sans trace.
   Rouvrir une affaire validée est une décision de gestion, pas un correctif. */
function bonCommandeForm(){
  /* Pendant une lecture automatique, l'écran se consacre à la lecture. Le
     formulaire reviendra prérempli. Rendre le suivi depuis `state.ocr` plutôt
     qu'en manipulant le DOM est ce qui lui permet de survivre à `renderTab()` —
     l'ancien message de fin, lui, était effacé par le rendu qui le suivait. */
  if(state.ocr && (state.ocr.enCours || state.ocr.etat)) return ocrEcranHTML();

  const e = state.editing;
  const statuts = ['en attente','en cours','terminé','annulé'];
  const sansBC = !!e.sansBC;
  const enAttenteBC = !!e.enAttenteBC;
  const isSAV = !!e.bonCommandeId;
  return `
  <div class="form-panel form-panel-v2">
    <h3>${isSAV? (e.id? 'Modifier le SAV' : 'Nouveau SAV') : (e.id? 'Modifier le bon de commande' : 'Nouveau bon de commande')}</h3>
    ${(isSAV || e.id)? '' : `<div class="ocr-zone" style="margin:-4px 0 16px; padding:14px 16px; border:2px dashed var(--accent-2); border-radius:10px; background:rgba(var(--accent-rgb), .06);">
      <label class="btn primary" style="cursor:pointer;">📄 Lire un bon de commande (PDF ou photo)
        <input type="file" accept="application/pdf,image/*,.heic,.heif" style="display:none;" onchange="lireBonCommande(this.files[0], this)">
      </label>
      <small style="display:block; margin-top:6px; color:var(--text-dim); font-size:11.5px;">Le formulaire est prérempli à partir du document — relisez et corrigez avant d'enregistrer.</small>
      <div id="ocrStatut" style="margin-top:8px; font-size:12px;"></div>
    </div>`}
    ${(e.id || isSAV)? '' : `<div class="plus-subnav" style="margin-bottom:16px;">
      <button class="plus-subnav-btn ${(!sansBC && !enAttenteBC)?'active':''}" onclick="setBCMode('normal')">Nouveau bon de commande</button>
      <button class="plus-subnav-btn ${sansBC?'active':''}" onclick="setBCMode('sansBC')">Sans bon de commande</button>
      <button class="plus-subnav-btn ${enAttenteBC?'active':''}" onclick="setBCMode('attenteBC')">En attente de bon de commande</button>
    </div>`}
    <div class="form-section">
      <div class="form-section-head"><span class="form-section-ico"></span>Client & contact</div>
      <div class="field-grid">
        <div class="field"><label>Client</label><select id="bc_client" onchange="refreshInterlocuteurSelect(this,'bc_interlocuteur'); refreshDevisLieSelect()">${clientSelectOptions(e.client)}</select></div>
        <div class="field"><label>Interlocuteur</label><select id="bc_interlocuteur" onchange="refreshDevisLieSelect()">${interlocuteurOptions(e.client, e.interlocuteur)}</select></div>
        ${isSAV? '' : `<div class="field"><label>Devis lié (si applicable)</label><select id="bc_devisId" onchange="applyDevisMontant(this.value)">${devisSelectOptions(e.client, e.devisId, e.id, e.interlocuteur)}</select></div>`}
      </div>
      <p class="card-sub">Adresse de facturation : à remplir seulement si le bon en désigne une — service comptable, centre de gestion. Vide, c'est le siège du client qui sert.</p>
      <div class="field-grid">
        <div class="address-trio">
          <div class="field"><label>Adresse de facturation</label><input type="text" id="bc_facturationAdresse" autocomplete="off" value="${esc(e.facturationAdresse)}" placeholder="Où envoyer la facture"></div>
          <div class="field"><label>Code postal</label><input type="text" id="bc_facturationCodePostal" autocomplete="off" maxlength="5" inputmode="numeric" value="${esc(e.facturationCodePostal)}" oninput="lookupVilleParCodePostal(this.value,'bc_facturationVille')"></div>
          <div class="field"><label>Ville</label><input type="text" id="bc_facturationVille" autocomplete="off" value="${esc(e.facturationVille)}"></div>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head">${isSAV? 'SAV' : 'Bon de commande'}</div>
      <div class="field-grid">
        ${(sansBC||enAttenteBC||isSAV)? '' : `<div class="bc-numref-duo">
          <div class="field"><label>N° du bon de commande</label><textarea id="bc_numeroBC" placeholder="Numéro indiqué sur le BC du client — passez à la ligne pour en ajouter un autre" style="min-height:38px;">${esc(e.numeroBC)}</textarea></div>
          <div class="field"><label>Référence chantier (optionnel)</label><input type="text" id="bc_referenceChantier" value="${esc(e.referenceChantier||'')}" placeholder="N° ou nom du chantier"></div>
        </div>`}
        ${isSAV? '' : `<div class="field"><label>Date de réception du BC</label><input type="date" id="bc_dateReception" value="${e.dateReception||todayISO()}"></div>`}
        <div class="field"><label>Date de fin de travaux</label><input type="date" id="bc_dateFinTravaux" value="${e.dateFinTravaux||''}"></div>
        ${isSAV? `
        <div class="field full">
          <label>Ce qui ne va pas</label>
          <textarea id="bc_problemeDescription" placeholder="Décrivez le problème signalé…">${esc(e.problemeDescription)}</textarea>
        </div>
        <div class="field full">
          <label>Photos (5 maximum)</label>
          <input type="file" id="bcPhotoFileInput" accept="image/*" multiple style="display:none;" onchange="handleBCPhotoFiles(this.files); this.value='';">
          <div class="photo-grid">${photoThumbsBCHTML(e.photos||[])}</div>
        </div>` : `<div class="field full">
          <label>Pièce jointe (bon de commande scanné)</label>
          <div id="bcAttachmentPreview">${e.pieceJointeNom? `<div class="card-sub" style="margin-bottom:6px;">📎 ${esc(e.pieceJointeNom)} <button class="btn small danger" type="button" onclick="removeBCAttachment()">✕</button></div>` : ''}</div>
          <input type="file" id="bc_pieceJointe" accept="application/pdf,image/*" onchange="handleBCAttachment(this)">
        </div>`}
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head"><span class="form-section-ico"></span>Lieu & locataire</div>
      <div class="field-grid">
        <div class="address-trio">
          <div class="field" style="position:relative;">
            <label>Adresse d'intervention *</label>
            <input type="text" id="bc_adresse" autocomplete="off" value="${esc(e.adresse)}" placeholder="Où les travaux ont lieu — pas l'adresse du client" data-suggest="bcAdresseSuggestions"
                   oninput="searchAdresse(this, {adresse:'bc_adresse', codePostal:'bc_codePostal', ville:'bc_ville'})"
                   onblur="setTimeout(()=>{const b=document.getElementById('bcAdresseSuggestions'); if(b) b.style.display='none';},150)">
            <div id="bcAdresseSuggestions" class="suggest-box"></div>
          </div>
          <div class="field"><label>Code postal</label><input type="text" id="bc_codePostal" autocomplete="off" maxlength="5" inputmode="numeric" value="${esc(e.codePostal)}" oninput="lookupVilleParCodePostal(this.value,'bc_ville')"></div>
          <div class="field"><label>Ville</label><input type="text" id="bc_ville" autocomplete="off" value="${esc(e.ville)}"></div>
        </div>
        <div class="field"><label>Type</label><select id="bc_logementStatut" onchange="toggleOccupantField(this,'occupantFieldBC','communeFieldBC','vacantFieldBC','numeroFieldBC','etageFieldBC')">${logementOptions(e.logementStatut)}</select></div>
        <div class="field full" id="communeFieldBC" style="display:${e.logementStatut==='commune'?'':'none'};"><label>Précision (partie commune)</label><input type="text" id="bc_precisionCommune" value="${esc(e.precisionCommune)}" placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…"></div>
        <div class="field full" id="vacantFieldBC" style="display:${e.logementStatut==='vacant'?'':'none'};"><label>Ancien locataire</label><input type="text" id="bc_ancienLocataire" value="${esc(e.ancienLocataire)}" placeholder="Ex : M. Dupont"></div>
        <div class="field" id="occupantFieldBC" style="display:${e.logementStatut==='occupé'?'':'none'};"><label>Locataire</label><input type="text" id="bc_occupant" value="${esc(e.occupant)}"></div>
        <div class="field" id="etageFieldBC" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>Étage</label><input type="text" id="bc_etage" value="${esc(e.etage)}" placeholder="RDC, 1er, 2e…"></div>
        <div class="field" id="numeroFieldBC" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>N° de logement</label><input type="text" id="bc_numeroLogement" value="${esc(e.numeroLogement)}" placeholder="Ex : 12, Appt 3B"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head"><span class="form-section-ico"></span>Organisation</div>
      <div class="field-grid">
        <div class="field"><label>Conducteur de travaux</label><select id="bc_conducteur">${conducteurSelectOptions(conducteurIdDe(e))}</select></div>
        <div class="field"><label>Nature des travaux</label><input type="text" id="bc_natureTravaux" value="${esc(e.natureTravaux)}" placeholder="Ex : Remise en état logement, Fuite d'eau…"></div>
        <div class="field full"><label>Métier(s)</label><div id="bc_metiersZone">${(()=>{ const m = metiersDuBrouillon(e); return bcMetiersZoneHTML(m.retenus, m.origines, m.ajoutes); })()}</div></div>
        <div class="field full"><label>Notes</label><input type="text" id="bc_notes" value="${esc(e.notes)}" placeholder="Remarques…"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-head"><span class="form-section-ico"></span>Chiffrage</div>
      <div class="field-grid">
        <div class="field full" id="bcMontantFieldsZone">${bcMontantFieldsHTML(e.metiers || (e.metier? [e.metier] : []), e.montantParMetier || {}, e.montant, [], e.lignes)}</div>
      </div>
      <div class="section-title" style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; border-top:none; padding-top:0;">
        <span>Travaux à réaliser *</span>
        <button type="button" class="btn small ghost" onclick="toggleBCLignesZone()">▲ Masquer</button>
      </div>
      <p class="card-sub">Au moins une ligne est obligatoire : décrivez en gros ce qu'il y a à faire. Le prix peut rester à zéro, il se saisit au chiffrage — la description, elle, part sur la facture. Si vous chiffrez ici, le montant ci-dessus sera recalculé automatiquement.</p>
      <div id="bcLignesZone" style="display:block;">
        <table class="lignes-table"><thead><tr><th style="width:36%;">Désignation</th><th>Qté</th><th>Unité</th><th>Prix U. HT</th><th>TVA</th><th class="num">Total HT</th><th class="num">Total TTC</th><th></th></tr></thead>
        <tbody id="lignesBody">${ligneRowsHTML(e.lignes&&e.lignes.length? e.lignes : [{type:'ligne', designation:'',qte:1,unite:'u',prixUnitaire:0,tva: tvaDefaut()}])}</tbody></table>
        <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
          <button type="button" class="btn small" onclick="addLigne()">+ Ligne</button>
          <button type="button" class="btn small" onclick="addChapitre()">+ Chapitre</button>
          <button type="button" class="btn small" onclick="addCommentaire()">+ Commentaire</button>
        </div>
        <div class="totals-box" id="bcTotalsBoxContent" style="margin-top:10px;">${totalsBoxInnerHTML(computeTotalsAvecRemise(e.lignes||[], 0))}</div>
      </div>
    </div>
    <div class="form-actions-sticky">
      <button class="btn primary" onclick="saveBonCommande()">Enregistrer${isSAV? ' le SAV' : ' le bon de commande'}</button>
      <button class="btn ghost" onclick="closeForm('bonCommande')">Annuler</button>
    </div>
  </div>`;
}
let bcSaveInProgress = false;
async function saveBonCommande(){
  if(bcSaveInProgress) return;
  bcSaveInProgress = true;
  try{
  const e = state.editing;
  const client = document.getElementById('bc_client').value.trim();
  if(!client){ alert('Le nom du client est requis.'); bcSaveInProgress = false; return; }
  /* La règle vit dans `regles-bc.ts`, pas ici : la couche `queries` s'en sert
     pour refuser et cet écran pour expliquer. Le refus et son message ne
     peuvent donc pas diverger. */
  const manques = window.manquesBonCommande({
    adresse: document.getElementById('bc_adresse').value,
    lignes: state.editing.lignes,
  });
  if(manques.length){ alert(manques.map(m=>'• '+m.libelle).join('\n\n')); bcSaveInProgress = false; return; }
  const id = e.id || uid();
  const sansBC = !!e.sansBC;
  const enAttenteBC = !!e.enAttenteBC;
  const isSAV = !!e.bonCommandeId;
  const numeroBCInput = document.getElementById('bc_numeroBC');
  const devisIdInput = document.getElementById('bc_devisId');
  const dateReceptionInput = document.getElementById('bc_dateReception');
  const problemeInput = document.getElementById('bc_problemeDescription');
  let savNumero = e.numeroBC;
  if(isSAV && !e.id){
    savNumero = await window.nextSAVNumero(state.societeId);
  }
  const montantMetierEls = document.querySelectorAll('.bc_montant_metier');
  let montantParMetier = null, montantTotal;
  if(montantMetierEls.length){
    montantParMetier = {};
    montantTotal = 0;
    montantMetierEls.forEach(el=>{
      const v = parseFloat(el.value) || 0;
      montantParMetier[el.dataset.metier] = v;
      montantTotal += v;
    });
  } else {
    montantTotal = parseFloat(document.getElementById('bc_montant').value) || 0;
  }
  const lignesRenseignees = bcLignesOntDuContenu(state.editing.lignes) ? state.editing.lignes.filter(l=>(l.type||'ligne')==='ligne' && (l.designation||(parseFloat(l.prixUnitaire)||0)>0)) : [];
  /* Quand le bon porte des lignes, ce sont elles qui font foi : le montant est
     leur total, et le champ n'est plus qu'un affichage.
     La réserve : un bon **sans aucune ligne** garde son montant saisi. Sans
     elle, rouvrir puis enregistrer l'un des 12 bons que la production compte
     dans ce cas — 25 323,48 € au total — le ramènerait à zéro, alors qu'il n'y
     a rien à recalculer. Le total des lignes ne fait loi que s'il y a des
     lignes. */
  if(lignesRenseignees.length){
    montantTotal = computeTotals(state.editing.lignes).ht;
  }
  const obj = { id, societeId: state.societeId, createdAt: e.createdAt || new Date().toISOString(),
    client,
    sansBC,
    enAttenteBC,
    bonCommandeId: e.bonCommandeId || null,
    problemeDescription: problemeInput? problemeInput.value : (e.problemeDescription||''),
    photos: e.photos || [],
    interlocuteur: document.getElementById('bc_interlocuteur').value,
    devisId: devisIdInput? (devisIdInput.value || null) : (e.devisId||null),
    numeroBC: isSAV ? savNumero : (enAttenteBC ? 'En attente de BC' : (sansBC ? 'Sans BC' : (numeroBCInput? numeroBCInput.value : e.numeroBC||''))),
    adresse: document.getElementById('bc_adresse').value,
    codePostal: document.getElementById('bc_codePostal').value,
    ville: document.getElementById('bc_ville').value,
    ...cleanLogementFields(document.getElementById('bc_logementStatut').value, {
      occupant: document.getElementById('bc_occupant').value,
      etage: document.getElementById('bc_etage').value,
      numeroLogement: document.getElementById('bc_numeroLogement').value,
      precisionCommune: document.getElementById('bc_precisionCommune').value,
      ancienLocataire: document.getElementById('bc_ancienLocataire').value
    }),
    /* Le bon dit où envoyer la facture ; `bc_generer_facture` recopie ces trois
       champs dans `factures.facturation_*`, que la facture électronique lit
       avant l'adresse du client. Laissés vides, c'est le siège qui sert. */
    facturationAdresse: document.getElementById('bc_facturationAdresse').value,
    facturationCodePostal: document.getElementById('bc_facturationCodePostal').value,
    facturationVille: document.getElementById('bc_facturationVille').value,
    dateReception: dateReceptionInput? (dateReceptionInput.value || todayISO()) : (e.dateReception||todayISO()),
    dateFinTravaux: document.getElementById('bc_dateFinTravaux').value,
    montant: montantTotal,
    montantParMetier,
    lignes: lignesRenseignees.length ? state.editing.lignes : [],
    statut: e.statut || 'en attente',
    ...conducteurDuSelect('bc_conducteur'),
    referenceChantier: (document.getElementById('bc_referenceChantier')||{value:''}).value.trim() || (e.referenceChantier||''),
    natureTravaux: document.getElementById('bc_natureTravaux').value,
    metiers: getCheckedMetiers('bc'),
    metier: getCheckedMetiers('bc')[0] || '',
    /* Le fichier ne traverse pas la base : le pont le range au stockage et
       n'écrit que son chemin. `pieceJointeChemin` n'est transmis que s'il a été
       explicitement mis à `null` par un retrait — absent, le pont laisse en
       place le document déjà stocké. */
    pieceJointeNom: e.pieceJointeNom || '',
    pieceJointeFichier: e.pieceJointeFichier || null,
    ...(e.pieceJointeChemin === null ? { pieceJointeChemin: null } : {}),
    metiersFait: e.metiersFait || {},
    dateOrigineFait: e.dateOrigineFait || false,
    technicienCommentaire: e.technicienCommentaire || '',
    technicienPhotos: e.technicienPhotos || [],
    technicienDessin: e.technicienDessin || null,
    pieceACommander: e.pieceACommander || false,
    pieceACommanderDetail: e.pieceACommanderDetail || '',
    pieceACommanderFournisseur: e.pieceACommanderFournisseur || '',
    pieceACommanderDateCommande: e.pieceACommanderDateCommande || '',
    datePlanificationInitiale: e.datePlanificationInitiale || '',
    dateInterventionTerminee: e.dateInterventionTerminee || '',
    datesSupplementaires: e.datesSupplementaires || [],
    tentativesContact: e.tentativesContact || [],
    rappelDate: e.rappelDate || null,
    travauxSupplementaires: e.travauxSupplementaires || [],
    valideConducteur: e.valideConducteur || false, dateValideConducteur: e.dateValideConducteur || null,
    valideDirecteur: e.valideDirecteur || false, dateValideDirecteur: e.dateValideDirecteur || null,
    notes: document.getElementById('bc_notes').value };
  const r = await window.stSet('bonCommande:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  closeForm('bonCommande');
  showToast(e.id? 'Bon de commande modifié.' : 'Bon de commande créé.', 'success');
  } finally {
    bcSaveInProgress = false;
  }
}

/* ---------- Planning ---------- */
function getMonday(d){
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day===0? -6 : 1);
  date.setDate(diff);
  return date;
}
function isoDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function currentWeekStart(){
  return state.planningWeekStart || isoDate(getMonday(new Date()));
}
function planningPrevWeek(){
  const d = new Date(currentWeekStart()+'T00:00:00');
  d.setDate(d.getDate()-7);
  state.planningWeekStart = isoDate(d);
  renderTab();
}
function planningNextWeek(){
  const d = new Date(currentWeekStart()+'T00:00:00');
  d.setDate(d.getDate()+7);
  state.planningWeekStart = isoDate(d);
  renderTab();
}
function planningToday(){
  state.planningWeekStart = null;
  renderTab();
}
function jumpToWeek(dateVal){
  if(!dateVal) return;
  state.planningWeekStart = isoDate(getMonday(new Date(dateVal+'T00:00:00')));
  renderTab();
}
function filterPlanningConducteur(value){
  state.planningConducteurFilter = value;
  renderTab();
}
function filterPlanningTechnicien(value){
  state.planningTechnicienFilter = value;
  renderTab();
}
function filterPlanningMetier(value){
  state.planningMetierFilter = value;
  renderTab();
}
function filterPlanningLogement(value){
  state.planningLogementFilter = value;
  renderTab();
}
/* Les valeurs réelles de `logementStatut` sont occupé / vacant / commune.
   « Problème » n'en est pas une : ce filtre ne remontait jamais rien sur les
   devis, factures et rapports. Il garde du sens sur le Planning, où il est
   interprété par `bcAProbleme` — d'où deux listes distinctes. */
function logementFilterOptions(current){
  return [['','Tous les logements'],['occupé','🏠 Logement occupé'],['vacant','🔑 Logement vacant'],['commune','🚪 Partie commune']]
    .map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('');
}
function planningLogementFilterOptions(current){
  return logementFilterOptions(current).replace('</select>','')
    + `<option value="probleme" ${current==='probleme'?'selected':''}>⚠️ Problème (ne répond pas)</option>`;
}
function bcAProbleme(b){
  return (b.tentativesContact||[]).length > 0;
}
function filterPlanningList(value){
  state.planningSearch = value;
  const view = state.planningView || 'technicien';
  const assigneeField = view==='soustraitant' ? 'sousTraitant' : 'technicien';
  let jumped = false;
  if(value && view!=='attente'){
    const q = value.trim().toLowerCase();
    const match = planningItems().find(b => b.datePlanifiee && window.multiWordMatch([b.client, b.numero, b.conducteur, b.adresse, b.numeroLogement, b.interlocuteur].filter(Boolean).join(' ').toLowerCase(), q));
    if(match){
      const firstVisible = currentWeekStart();
      const d = new Date(firstVisible+'T00:00:00');
      d.setDate(d.getDate() + PLANNING_WEEKS_SHOWN*7 - 1);
      const lastVisible = isoDate(d);
      if(match.datePlanifiee < firstVisible || match.datePlanifiee > lastVisible){
        state.planningWeekStart = isoDate(getMonday(new Date(match.datePlanifiee+'T00:00:00')));
        jumped = true;
      }
    }
  }
  if(jumped){
    renderTab();
    setTimeout(()=>{ const inp = document.getElementById('planningSearchInput'); if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }, 0);
  } else {
    const zone = document.getElementById('planningBodyZone');
    if(zone) zone.innerHTML = (view==='attente'||view==='attenteST')? renderPlanningEnAttente(view==='attenteST'?'soustraitant':'technicien') : renderPlanningCalendar(assigneeField);
  }
}
function easterDate(year){
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const month = Math.floor((h + l - 7*m + 114) / 31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(year, month-1, day);
}
function joursFeries(year){
  const easter = easterDate(year);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
  const dates = [
    new Date(year,0,1), addDays(easter,1), new Date(year,4,1), new Date(year,4,8),
    addDays(easter,39), addDays(easter,50), new Date(year,6,14), new Date(year,7,15),
    new Date(year,10,1), new Date(year,10,11), new Date(year,11,25)
  ];
  return dates.map(d=>isoDate(d));
}
const _joursFeriesCache = {};
function isJourFerie(dateISO){
  const year = parseInt(dateISO.slice(0,4),10);
  if(!_joursFeriesCache[year]) _joursFeriesCache[year] = joursFeries(year);
  return _joursFeriesCache[year].includes(dateISO);
}
function isWeekend(dateISO){
  const day = new Date(dateISO+'T00:00:00').getDay();
  return day===0 || day===6;
}
function weekDays(mondayISO){
  const days = [];
  const start = new Date(mondayISO+'T00:00:00');
  const names = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    days.push({ iso: isoDate(d), label: names[i], dayNum: d.getDate(), month: d.toLocaleDateString('fr-FR',{month:'short'}) });
  }
  return days;
}
const PLANNING_HOURS = [8,9,10,11,12,13,14,15,16];
const PLANNING_PAUSE_HOUR = 12;
function calculerSpanRows(startIdx, duree){
  const pauseIdx = PLANNING_HOURS.indexOf(PLANNING_PAUSE_HOUR);
  let span = duree;
  if(pauseIdx>=0 && pauseIdx>=startIdx && pauseIdx<startIdx+span) span += 1;
  return Math.min(span, PLANNING_HOURS.length-startIdx);
}
const PLANNING_ROW_H = 46;
const PLANNING_VOFFSET = 225;
function planningRowExpr(){ return `((100vh - ${PLANNING_VOFFSET}px) / ${PLANNING_HOURS.length})`; }
const PLANNING_WEEKS_SHOWN = 6;
function planningItems(){
  const soc = state.societeId;
  const cf = state.planningConducteurFilter||'';
  const mf = state.planningMetierFilter||'';
  const items = [];
  const devisGroups = {};
  state.bonsCommande.filter(b=>b.societeId===soc && b.devisId).forEach(b=>{
    if(!devisGroups[b.devisId]) devisGroups[b.devisId] = new Set();
    devisGroups[b.devisId].add(b.id);
  });
  state.bonsCommande.filter(b=>b.societeId===soc && (!cf || b.conducteur===cf)).forEach(b=>{
    const metiersUniques = b.metiers ? [...new Set(b.metiers)] : b.metiers;
    const multi = metiersUniques && metiersUniques.length > 1;
    const keys = multi ? metiersUniques : [null];
    const logementPartage = (b.devisId && devisGroups[b.devisId] && devisGroups[b.devisId].size > 1) ? devisGroups[b.devisId].size : 0;
    keys.forEach(metierKey=>{
      const effectiveMetier = metierKey || b.metier;
      if(mf && effectiveMetier !== mf) return;
      const id = metierKey ? `${b.id}::${metierKey}` : b.id;
      items.push({
        kind:'bonCommande', id, metierKey, isSAV: !!b.bonCommandeId,
        // `id` est composite sur un bon multi-métier : l'étape se lit sur le bon
        bcId: b.id,
        client:b.client, numero: metierKey? `${b.numeroBC} (${metierDisplayLabel(metierKey)})` : b.numeroBC,
        conducteur:b.conducteur, interlocuteur:b.interlocuteur,
        pieceJointeNom:b.pieceJointeNom, pieceJointeChemin:b.pieceJointeChemin, pieceJointeData:b.pieceJointeData, problemeDescription:b.problemeDescription,
        adresse:b.adresse, adresseLocataire:b.adresseLocataire, numeroLogement:b.numeroLogement, logementStatut:b.logementStatut,
        codePostal:b.codePostal, ville:b.ville, etage:b.etage,
        technicien: schedField(b, metierKey, 'technicien'),
        sousTraitant: schedField(b, metierKey, 'sousTraitant'),
        metier: effectiveMetier, metiers: b.metiers, metiersFait: b.metiersFait, dateOrigineFait: b.dateOrigineFait,
        // La vignette affiche l'étape du circuit : elle a besoin des validations
        valideConducteur: b.valideConducteur, valideDirecteur: b.valideDirecteur,
        pieceACommander: b.pieceACommander, pieceACommanderDetail: b.pieceACommanderDetail,
        pieceACommanderDateCommande: b.pieceACommanderDateCommande,
        pieceACommanderFournisseur: b.pieceACommanderFournisseur,
        pieceRecueLe: b.pieceRecueLe, montantSousTraitant: b.montantSousTraitant,
        datePlanificationInitiale: b.datePlanificationInitiale,
        dateInterventionTerminee: b.dateInterventionTerminee,
        datesSupplementaires: b.datesSupplementaires, tentativesContact: b.tentativesContact, rappelDate: b.rappelDate,
        montant: (metierKey && b.montantParMetier && b.montantParMetier[metierKey]!=null) ? b.montantParMetier[metierKey] : b.montant,
        datePlanifiee: schedField(b, metierKey, 'datePlanifiee'),
        datePlanifieeFin: schedField(b, metierKey, 'datePlanifieeFin'),
        heurePlanifiee: schedField(b, metierKey, 'heurePlanifiee'),
        dureeHeures: schedField(b, metierKey, 'dureeHeures'),
        heureDernierJour: schedField(b, metierKey, 'heureDernierJour'),
        dureeDernierJour: schedField(b, metierKey, 'dureeDernierJour'),
        devisId: b.devisId, logementPartage
      });
    });
  });
  return items;
}
function planningKeyPrefix(kind){ return 'bonCommande:'; }
function planningArrFor(kind){ return state.bonsCommande; }
function parsePlanningId(compositeId){
  const idx = compositeId.indexOf('::');
  if(idx === -1) return { bcId: compositeId, metierKey: null };
  return { bcId: compositeId.slice(0, idx), metierKey: compositeId.slice(idx+2) };
}
function schedField(bc, metierKey, field){
  if(!metierKey) return bc[field];
  const s = bc.scheduleParMetier && bc.scheduleParMetier[metierKey];
  return s ? s[field] : undefined;
}
function setSchedField(bc, metierKey, field, value){
  if(!metierKey){ bc[field] = value; return; }
  if(!bc.scheduleParMetier) bc.scheduleParMetier = {};
  if(!bc.scheduleParMetier[metierKey]) bc.scheduleParMetier[metierKey] = {};
  bc.scheduleParMetier[metierKey][field] = value;
}
function resolvePlanningItem(kind, compositeId){
  const { bcId, metierKey } = parsePlanningId(compositeId);
  const bc = planningArrFor(kind).find(x=>x.id===bcId);
  if(!bc) return null;
  return { bc, metierKey, bcId };
}
function renderPlanning(){
  if(state.currentRole==='technicien') state.planningView = 'technicien';
  if(estSousTraitant()){
    state.planningView = 'soustraitant';
    if(sousTraitantActuel()) state.planningSousTraitantFilter = sousTraitantActuel();
  }
  const view = state.planningView || 'technicien';
  const assigneeField = view==='soustraitant' ? 'sousTraitant' : 'technicien';
  const isSousTraitant = assigneeField === 'sousTraitant';
  const af = isSousTraitant ? (state.planningSousTraitantFilter||'') : (state.planningTechnicienFilter||'');
  const firstMonday = currentWeekStart();
  return `
    <div class="plus-subnav" style="justify-content:center;">
      ${estSousTraitant() ? `<button class="plus-subnav-btn active">Mon planning ${esc(societeName(state.societeId))}</button>` : `<button class="plus-subnav-btn ${view==='technicien'?'active':''}" onclick="setPlanningView('technicien')">Planning Technicien</button>
      ${state.currentRole==='technicien' ? '' : `<button class="plus-subnav-btn ${view==='soustraitant'?'active':''}" onclick="setPlanningView('soustraitant')">Planning Sous-traitant</button>
      <button class="plus-subnav-btn ${view==='attente'?'active':''}" onclick="setPlanningView('attente')">En attente technicien</button>
      <button class="plus-subnav-btn ${view==='attenteST'?'active':''}" onclick="setPlanningView('attenteST')">En attente sous-traitant</button>`}`}
    </div>
    <div class="page-head">
      <div style="display:flex; align-items:center; gap:280px;">
        <h1>Planning</h1>
        <input type="text" id="planningSearchInput" style="width:220px;" value="${esc(state.planningSearch||'')}" placeholder="Rechercher : client, n° BC, adresse…" oninput="filterPlanningList(this.value)">
      </div>
      ${(view==='attente'||view==='attenteST') ? '' : `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-left:auto;">
        <select style="width:auto; min-width:170px;" onchange="filterPlanningAssignee('${jsAttr(assigneeField)}',this.value)">${isSousTraitant? sousTraitantFilterOptions(af) : technicienFilterOptions(af, 'Toutes les équipes')}</select>
        <select style="width:auto; min-width:160px;" onchange="filterPlanningMetier(this.value)">${metierPersoFilterOptions(state.planningMetierFilter)}</select>
        <button class="btn small" onclick="planningPrevWeek()" title="Semaine précédente">←</button>
        <input type="date" style="width:auto;" value="${firstMonday}" onchange="jumpToWeek(this.value)" title="Aller à la semaine de cette date">
        <button class="btn small" onclick="planningNextWeek()" title="Semaine suivante">→</button>
        <button class="btn small" onclick="printPlanning('${jsAttr(assigneeField)}')" title="Imprimer le planning de cette semaine">🖨️ Imprimer</button>
      </div>`}
    </div>
    <div id="planningBodyZone">${(view==='attente'||view==='attenteST')? renderPlanningEnAttente(view==='attenteST'?'soustraitant':'technicien') : renderPlanningCalendar(assigneeField)}</div>
  `;
}
function setPlanningView(view){
  if(state.currentRole==='technicien' && view!=='technicien') return;
  if(estSousTraitant() && view!=='soustraitant') return;
  state.planningView = view;
  renderTab();
}
function renderPlanningRealiseNonFacture(){
  const soc = state.societeId;
  const list = state.bonsCommande.filter(b=>b.societeId===soc && b.valideDirecteur && !state.factures.some(f=>f.bonCommandeId===b.id));
  return `
    <div class="card-sub" style="margin-bottom:14px;">Bons de commande ayant franchi toutes les étapes de validation (tâches, conducteur, directeur), pour lesquels aucune facture n'a encore été créée.</div>
    <div>${list.length? list.map(b=>bonCommandeCardHTML(b, true)).join('') : '<div class="empty">Aucun bon de commande validé en attente de facturation.</div>'}</div>
  `;
}
function renderPlanningEnAttente(mode){
  const soc = state.societeId;
  const q = (state.planningSearch||'').trim().toLowerCase();
  const list = state.bonsCommande.filter(b=>b.societeId===soc && !b.bonCommandeId && !b.valideConducteur &&
    (mode==='soustraitant' ? !!b.sousTraitant : !b.sousTraitant) &&
    (!q || window.multiWordMatch([b.client, b.numeroBC, b.conducteur, b.sousTraitant, b.adresse, b.numeroLogement, b.interlocuteur].filter(Boolean).join(' ').toLowerCase(), q)));
  return `
    <div class="card-sub" style="margin-bottom:12px;">${mode==='soustraitant'? 'Bons de commande assignés à un sous-traitant, en attente de validation.' : 'Bons de commande gérés en interne (techniciens), en attente de validation.'}</div>
    <div>${list.length? list.map(b=>bonCommandeCardHTML(b,'attente')).join('') : '<div class="empty">Aucun bon de commande ne correspond.</div>'}</div>
  `;
}
function filterPlanningAssignee(field, value){
  if(field==='sousTraitant'){
    state.planningSousTraitantFilter = value;
    if(value){
      const st = state.sousTraitants.find(s=>s.nom===value);
      const metiers = (st && st.metiers) || [];
      state.planningMetierFilter = metiers.length===1 ? metiers[0] : '';
    }
  } else {
    state.planningTechnicienFilter = value;
    if(value){
      const tech = state.techniciens.find(t=>technicienLabel(t)===value);
      const metiers = (tech && tech.metiers) || [];
      state.planningMetierFilter = metiers.length===1 ? metiers[0] : '';
    }
  }
  renderTab();
}
function renderPlanningCalendar(assigneeField){
  const isSousTraitant = assigneeField === 'sousTraitant';
  const otherField = isSousTraitant ? 'technicien' : 'sousTraitant';
  const all = planningItems();
  const cf = state.planningConducteurFilter||'';
  const mf = state.planningMetierFilter||'';
  const af = isSousTraitant ? (state.planningSousTraitantFilter||'') : (state.planningTechnicienFilter||'');
  const lf = state.planningLogementFilter||'';
  const baseScope = all.filter(b => (!cf || b.conducteur===cf) && (!mf || b.metier===mf) && !b[otherField] && (!lf || (lf==='probleme'? bcAProbleme(b) : b.logementStatut===lf)));
  const searchQ = (state.planningSearch||'').trim().toLowerCase();
  const matchesSearch = b => !searchQ || window.multiWordMatch([b.client, b.numero, b.conducteur, b.adresse, b.numeroLogement, b.interlocuteur].filter(Boolean).join(' ').toLowerCase(), searchQ);
  const ucf = state.planningUnschedClientFilter||'';
  const uif = state.planningUnschedInterlocuteurFilter||'';
  const unscheduled = baseScope.filter(b=>!b.datePlanifiee && matchesSearch(b) && (!ucf || b.client===ucf) && (!uif || b.interlocuteur===uif)).sort((a,b)=> (b.isSAV?1:0) - (a.isSAV?1:0));
  const calendarItems = baseScope.filter(b => (!af || b[assigneeField]===af) && matchesSearch(b));
  const firstMonday = currentWeekStart();
  const weekStarts = [];
  for(let i=0;i<PLANNING_WEEKS_SHOWN;i++){
    const d = new Date(firstMonday+'T00:00:00');
    d.setDate(d.getDate()+i*7);
    weekStarts.push(isoDate(d));
  }
  return `
    <div class="planning-layout">
      ${(state.currentRole!=='technicien' && !estSousTraitant())? `<div class="planning-unscheduled">
        <select style="width:100%; margin-bottom:10px;" onchange="filterPlanningConducteur(this.value)">${conducteurFilterOptions(state.planningConducteurFilter)}</select>
        <div class="section-title" style="margin-top:0; display:flex; align-items:center; justify-content:space-between;">
          <span>Non planifiés (${unscheduled.length})</span>
          <button class="planning-filter-icon-btn" onclick="togglePlanningUnschedFilter()" title="Filtrer par client ou interlocuteur">🔍</button>
        </div>
        <div id="planningUnschedFilterPanel" style="display:${state.planningUnschedFilterOpen?'flex':'none'}; flex-direction:column; gap:6px; margin-bottom:10px;">
          <select style="width:100%;" onchange="filterPlanningUnschedClient(this.value)">${planningUnschedClientOptions(state.planningUnschedClientFilter)}</select>
          <select style="width:100%;" onchange="filterPlanningUnschedInterlocuteur(this.value)">${planningUnschedInterlocuteurOptions(state.planningUnschedInterlocuteurFilter, state.planningUnschedClientFilter)}</select>
          <select style="width:100%;" onchange="filterPlanningLogement(this.value)">${planningLogementFilterOptions(state.planningLogementFilter)}</select>
        </div>
        <div class="planning-unsched-list" ondragover="allowDropUnsched(event)" ondrop="dropUnsched(event)">
          ${unscheduled.length? unscheduled.map(b=>planningCardHTML(b, true, assigneeField, af)).join('') : '<div class="empty">Tout est planifié.</div>'}
        </div>
      </div>` : ''}
      <div class="planning-week">
        <div class="planning-scroll">
          ${weekStarts.map(monday => renderWeekBlockHTML(monday, calendarItems, assigneeField, af)).join('')}
        </div>
      </div>
    </div>
  `;
}
function renderWeekBlockHTML(monday, all, assigneeField, assigneeValue){
  const days = weekDays(monday);
  const weekEnd = days[6];
  const weekLabel = `${days[0].dayNum} ${days[0].month} — ${weekEnd.dayNum} ${weekEnd.month} ${new Date(monday+'T00:00:00').getFullYear()}`;
  const isCurrentWeek = monday === isoDate(getMonday(new Date()));
  return `
    <div class="planning-week-block" data-week="${monday}">
      <div class="planning-week-label ${isCurrentWeek?'is-current-week':''}">${weekLabel}${isCurrentWeek? ' · cette semaine' : ''}</div>
      <div class="planning-calendar">
        <div class="planning-hourcol">
          <div class="planning-hourcol-spacer"></div>
          ${PLANNING_HOURS.map(h=>`<div class="planning-hour-tick ${h===PLANNING_PAUSE_HOUR?'is-pause':''}" style="height:calc(${planningRowExpr()});">${String(h).padStart(2,'0')}:00</div>`).join('')}
          <div class="planning-hour-tick" style="height:0; border-bottom:none; padding-top:0;">17:00</div>
        </div>
        ${days.map(d=>{
          const items = all.filter(b=> (b.datePlanifiee && d.iso >= b.datePlanifiee && d.iso <= (b.datePlanifieeFin || b.datePlanifiee)) || (b.datesSupplementaires||[]).some(x=>x.date===d.iso));
          const isNonOuvre = isWeekend(d.iso) || isJourFerie(d.iso);
          return `<div class="planning-daycol ${isNonOuvre?'is-non-ouvre':''}" data-iso="${d.iso}">
            <div class="planning-day-head ${d.iso===todayISO()?'is-today':''}">${d.label}<br><b>${d.dayNum} ${d.month}</b>${isJourFerie(d.iso)?'<br><span style="font-size:9.5px;">Férié</span>':''}</div>
            <div class="planning-day-grid" style="height:calc(${PLANNING_HOURS.length} * ${planningRowExpr()});">
              ${PLANNING_HOURS.map((h,idx)=>`<div class="planning-hour-row ${h===PLANNING_PAUSE_HOUR?'is-pause':''}" style="top:calc(${idx} * ${planningRowExpr()}); height:calc(${planningRowExpr()});" ondragover="allowDropHour(event)" ondragleave="this.classList.remove('drag-over')" ondrop="dropOnHour(event,'${jsAttr(d.iso)}',${h},'${assigneeField||''}','${jsAttr(assigneeValue||'')}')"></div>`).join('')}
              ${items.map(b=>planningScheduledCardHTML(b, d.iso, assigneeField)).join('')}
              ${(()=>{ const pIdx = PLANNING_HOURS.indexOf(PLANNING_PAUSE_HOUR); return pIdx>=0 ? `<div class="planning-pause-overlay" style="top:calc(${pIdx} * ${planningRowExpr()}); height:calc(${planningRowExpr()});"></div>` : ''; })()}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}
let annotationCtx = null;
let annotationTool = 'fleche';
let annotationShapes = [];
let annotationOriginalImg = null;
let annotationCouleur = '#E23535';
let annotationZonePoints = [];
function openPhotoAnnotationModal(photoId, arrayField, urlField){
  const arr = state.editing[arrayField] || [];
  const photo = arr.find(p=>p.id===photoId);
  if(!photo) return;
  annotationCtx = { photoId, arrayField, urlField };
  annotationShapes = [];
  annotationTool = 'fleche';
  draggingTexteIndex = null;
  draggingShapeIndex = null;
  draggingOffset = null;
  annotationZonePoints = [];
  annotationCouleur = photo.categorie==='preconisation' ? '#2E9B4F' : '#E23535';
  const canvas = document.getElementById('photoAnnotationCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    annotationOriginalImg = img;
    redrawAnnotationCanvas();
    setupAnnotationDrawing(canvas, ctx);
  };
  img.src = photo[urlField];
  updateToolButtonsUI();
  document.getElementById('photoAnnotationModal').style.display = 'flex';
}
function closePhotoAnnotationModal(){
  document.getElementById('photoAnnotationModal').style.display = 'none';
  annotationCtx = null;
}
function setAnnotationTool(tool){
  if(annotationTool==='zone' && tool!=='zone' && annotationZonePoints.length){
    if(!confirm('Une zone est en cours de tracé. Changer d\'outil l\'annulera. Continuer ?')) return;
    annotationZonePoints = [];
    redrawAnnotationCanvas();
  }
  annotationTool = tool;
  updateToolButtonsUI();
}
function terminerZone(){
  if(annotationZonePoints.length >= 2){
    annotationShapes.push({ type:'zone', points: annotationZonePoints.map(p=>({x:p.x, y:p.y})) });
  }
  annotationZonePoints = [];
  updateToolButtonsUI();
  redrawAnnotationCanvas();
}
function updateToolButtonsUI(){
  const f = document.getElementById('toolFlecheBtn');
  const c = document.getElementById('toolCarreBtn');
  const ce = document.getElementById('toolCercleBtn');
  const t = document.getElementById('toolTexteBtn');
  const z = document.getElementById('toolZoneBtn');
  if(f) f.classList.toggle('primary', annotationTool==='fleche');
  if(c) c.classList.toggle('primary', annotationTool==='carre');
  if(ce) ce.classList.toggle('primary', annotationTool==='cercle');
  if(t) t.classList.toggle('primary', annotationTool==='texte');
  if(z) z.classList.toggle('primary', annotationTool==='zone');
  const aide = document.getElementById('zoneAideTexte');
  const termBtn = document.getElementById('terminerZoneBtn');
  if(aide) aide.style.display = annotationTool==='zone' ? 'block' : 'none';
  if(termBtn) termBtn.style.display = (annotationTool==='zone' && annotationZonePoints.length>=2) ? 'inline-flex' : 'none';
}
function drawZone(ctx, points, enCours){
  if(points.length < 2) return;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  if(!enCours) ctx.closePath();
  if(!enCours){
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 3.5;
  ctx.setLineDash(enCours? [8,6] : []);
  ctx.stroke();
  ctx.setLineDash([]);
  points.forEach(p=>{
    ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fillStyle = '#FFC90E'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a2a00'; ctx.stroke();
  });
  if(!enCours && points.length >= 3){
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.closePath();
    ctx.clip();
    const minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x));
    const minY = Math.min(...points.map(p=>p.y)), maxY = Math.max(...points.map(p=>p.y));
    const diag = maxY - minY;
    const degrade = ctx.createLinearGradient(minX, minY, minX, maxY);
    degrade.addColorStop(0, '#FFDD55');
    degrade.addColorStop(0.5, '#FFC107');
    degrade.addColorStop(1, '#FFA000');
    ctx.strokeStyle = degrade; ctx.lineWidth = 13;
    for(let x = minX - diag; x < maxX; x += 27){
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x + diag, maxY);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawFleche(ctx, x1,y1,x2,y2){
  ctx.strokeStyle = annotationCouleur; ctx.fillStyle = annotationCouleur; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  const angle = Math.atan2(y2-y1, x2-x1);
  const headLen = 18;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen*Math.cos(angle-Math.PI/7), y2 - headLen*Math.sin(angle-Math.PI/7));
  ctx.lineTo(x2 - headLen*Math.cos(angle+Math.PI/7), y2 - headLen*Math.sin(angle+Math.PI/7));
  ctx.closePath(); ctx.fill();
}
function drawCarre(ctx, x1,y1,x2,y2){
  ctx.strokeStyle = annotationCouleur; ctx.lineWidth = 4;
  ctx.strokeRect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
}
let draggingTexteIndex = null;
let draggingShapeIndex = null;
let draggingOffset = null;
function pointDansPolygone(x, y, points){
  let inside = false;
  for(let i=0, j=points.length-1; i<points.length; j=i++){
    const xi=points[i].x, yi=points[i].y, xj=points[j].x, yj=points[j].y;
    const intersect = ((yi>y) !== (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
function distancePointSegment(px,py,x1,y1,x2,y2){
  const dx = x2-x1, dy = y2-y1;
  const lenSq = dx*dx + dy*dy;
  let t = lenSq ? ((px-x1)*dx + (py-y1)*dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t*dx, projY = y1 + t*dy;
  return Math.hypot(px-projX, py-projY);
}
function trouverFormeSousPoint(ctx, x, y){
  const margeToucher = 14;
  for(let i=annotationShapes.length-1; i>=0; i--){
    const s = annotationShapes[i];
    if(s.type==='texte'){
      ctx.font = 'bold 32px Arial';
      const largeur = ctx.measureText(s.texte).width + 12;
      if(x >= s.x1-6 && x <= s.x1-6+largeur && y >= s.y1-22 && y <= s.y1+22) return i;
    } else if(s.type==='fleche'){
      if(distancePointSegment(x,y,s.x1,s.y1,s.x2,s.y2) <= margeToucher) return i;
    } else if(s.type==='carre'){
      const xMin=Math.min(s.x1,s.x2), xMax=Math.max(s.x1,s.x2), yMin=Math.min(s.y1,s.y2), yMax=Math.max(s.y1,s.y2);
      const surBord = (Math.abs(x-xMin)<=margeToucher || Math.abs(x-xMax)<=margeToucher || Math.abs(y-yMin)<=margeToucher || Math.abs(y-yMax)<=margeToucher);
      if(x>=xMin-margeToucher && x<=xMax+margeToucher && y>=yMin-margeToucher && y<=yMax+margeToucher && surBord) return i;
    } else if(s.type==='cercle'){
      const cx=(s.x1+s.x2)/2, cy=(s.y1+s.y2)/2, rx=Math.abs(s.x2-s.x1)/2||1, ry=Math.abs(s.y2-s.y1)/2||1;
      const val = ((x-cx)*(x-cx))/(rx*rx) + ((y-cy)*(y-cy))/(ry*ry);
      if(val >= 0.6 && val <= 1.4) return i;
    } else if(s.type==='zone'){
      if(pointDansPolygone(x, y, s.points)) return i;
    }
  }
  return null;
}
function drawCercle(ctx, x1,y1,x2,y2){
  ctx.strokeStyle = annotationCouleur; ctx.lineWidth = 4;
  const cx = (x1+x2)/2, cy = (y1+y2)/2;
  const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx||1, ry||1, 0, 0, Math.PI*2);
  ctx.stroke();
}
function drawTexte(ctx, x, y, texte){
  ctx.font = 'bold 32px Arial';
  ctx.textBaseline = 'middle';
  const largeur = ctx.measureText(texte).width;
  ctx.fillStyle = annotationCouleur;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x-6, y-22, largeur+12, 44, 6) : ctx.rect(x-6, y-22, largeur+12, 44);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(texte, x, y);
}
function redrawAnnotationCanvas(){
  const canvas = document.getElementById('photoAnnotationCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(annotationOriginalImg) ctx.drawImage(annotationOriginalImg,0,0,canvas.width,canvas.height);
  annotationShapes.forEach(s=>{
    if(s.type==='fleche') drawFleche(ctx, s.x1,s.y1,s.x2,s.y2);
    else if(s.type==='carre') drawCarre(ctx, s.x1,s.y1,s.x2,s.y2);
    else if(s.type==='cercle') drawCercle(ctx, s.x1,s.y1,s.x2,s.y2);
    else if(s.type==='texte') drawTexte(ctx, s.x1, s.y1, s.texte);
    else if(s.type==='zone') drawZone(ctx, s.points, false);
  });
  if(annotationZonePoints.length) drawZone(ctx, annotationZonePoints, true);
}
function setupAnnotationDrawing(canvas, ctx){
  let drawing = false, start = null;
  function pos(ev){
    const r = canvas.getBoundingClientRect();
    const p = ev.touches ? ev.touches[0] : ev;
    return {x:(p.clientX-r.left)*(canvas.width/r.width), y:(p.clientY-r.top)*(canvas.height/r.height)};
  }
  function beginDraw(ev){
    const p0 = pos(ev);
    if(annotationTool==='zone'){
      const idxExistant = trouverFormeSousPoint(ctx, p0.x, p0.y);
      if(idxExistant !== null && annotationShapes[idxExistant].type==='zone' && !annotationZonePoints.length){
        draggingShapeIndex = idxExistant;
        draggingOffset = { x: p0.x, y: p0.y };
        ev.preventDefault();
        return;
      }
      annotationZonePoints.push({x:p0.x, y:p0.y});
      updateToolButtonsUI();
      redrawAnnotationCanvas();
      ev.preventDefault();
      return;
    }
    const idxExistant = trouverFormeSousPoint(ctx, p0.x, p0.y);
    if(idxExistant !== null){
      draggingShapeIndex = idxExistant;
      draggingOffset = { x: p0.x, y: p0.y };
      ev.preventDefault();
      return;
    }
    if(annotationTool==='texte'){
      const texte = prompt('Texte à afficher sur la photo :');
      if(texte && texte.trim()){
        annotationShapes.push({ type:'texte', x1:p0.x, y1:p0.y, texte: texte.trim() });
        redrawAnnotationCanvas();
      }
      ev.preventDefault();
      return;
    }
    drawing = true; start = pos(ev); ev.preventDefault();
  }
  function moveDraw(ev){
    if(draggingShapeIndex !== null){
      const p = pos(ev);
      const dx = p.x - draggingOffset.x, dy = p.y - draggingOffset.y;
      const s = annotationShapes[draggingShapeIndex];
      if(s.points){ s.points.forEach(pt=>{ pt.x += dx; pt.y += dy; }); }
      else { s.x1 += dx; s.y1 += dy; if(s.x2 !== undefined){ s.x2 += dx; s.y2 += dy; } }
      draggingOffset = { x: p.x, y: p.y };
      redrawAnnotationCanvas();
      ev.preventDefault();
      return;
    }
    if(!drawing) return;
    const p = pos(ev);
    redrawAnnotationCanvas();
    if(annotationTool==='fleche') drawFleche(ctx, start.x, start.y, p.x, p.y);
    else if(annotationTool==='cercle') drawCercle(ctx, start.x, start.y, p.x, p.y);
    else drawCarre(ctx, start.x, start.y, p.x, p.y);
    ev.preventDefault();
  }
  function endDraw(ev){
    if(draggingShapeIndex !== null){ draggingShapeIndex = null; draggingOffset = null; return; }
    if(annotationTool==='zone') return;
    if(!drawing) return;
    drawing = false;
    const p = pos(ev.changedTouches ? ev.changedTouches[0] : ev);
    annotationShapes.push({ type: annotationTool, x1:start.x, y1:start.y, x2:p.x, y2:p.y });
    redrawAnnotationCanvas();
  }
  canvas.ondblclick = (ev)=>{ if(annotationTool==='zone'){ terminerZone(); ev.preventDefault(); } };
  canvas.onmousedown = beginDraw; canvas.onmousemove = moveDraw; canvas.onmouseup = endDraw; canvas.onmouseleave = ()=>{ drawing=false; };
  canvas.ontouchstart = beginDraw; canvas.ontouchmove = moveDraw; canvas.ontouchend = endDraw;
}
function undoAnnotation(){
  annotationShapes.pop();
  redrawAnnotationCanvas();
}
function clearAnnotations(){
  annotationShapes = [];
  redrawAnnotationCanvas();
}
function enregistrerAnnotationPhoto(){
  if(!annotationCtx) return;
  const canvas = document.getElementById('photoAnnotationCanvas');
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const arr = state.editing[annotationCtx.arrayField] || [];
  const photo = arr.find(p=>p.id===annotationCtx.photoId);
  if(photo) photo[annotationCtx.urlField] = dataUrl;
  closePhotoAnnotationModal();
  if(state.editing.type === 'bonCommande') refreshBCPhotosUI();
  else refreshPhotosUI();
  showToast('Photo annotée enregistrée.', 'success');
}
let rappelCtx = null;
function openRappelModal(kind, id){
  rappelCtx = { kind, id };
  document.getElementById('rappelDateInput').value = '';
  document.getElementById('rappelDateInput').min = todayISO();
  document.getElementById('rappelModal').style.display = 'flex';
}
function closeRappelModal(){
  document.getElementById('rappelModal').style.display = 'none';
  rappelCtx = null;
}
async function confirmerRappel(){
  if(!rappelCtx) return;
  const dateVal = document.getElementById('rappelDateInput').value;
  if(!dateVal){ showToast('Choisissez une date de rappel.'); return; }
  const resolved = resolvePlanningItem(rappelCtx.kind, rappelCtx.id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  bc.rappelDate = dateVal;
  await window.stSet(planningKeyPrefix(rappelCtx.kind)+bcId, bc);
  await recharger('bonCommande');
  closeRappelModal();
  renderTab();
  majContactsFicheTechnicien();
  showToast('🔄 Rappel programmé pour le '+fmtDate(dateVal)+'.', 'success');
}
async function annulerRappel(kind, id){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  bc.rappelDate = null;
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  await recharger('bonCommande');
  renderTab();
}
/* Le suivi des contacts : ce qu'on a tenté, et ce qu'on a prévu.

   La zone ne s'affichait que pour un logement occupé. Un bon repassé en
   « vacant » ou en parties communes perdait donc à l'écran les appels déjà
   enregistrés — la base les gardait, l'écran ne les montrait plus. Et on ne
   joint pas qu'un locataire : un gardien, un syndic, un gestionnaire se
   relancent aussi. La zone se montre désormais partout ; en lecture seule,
   elle reste muette tant qu'il n'y a rien à dire.

   Une carte posée sur le planning est déjà planifiée : on ne relance plus un
   locataire qu'on a fini par joindre, et les trois boutons mangeaient les
   lignes utiles d'une vignette contrainte par sa durée. Elle n'y garde donc
   que la trace — les tentatives, le rappel prévu. Les boutons restent sur la
   colonne « à planifier », sur la fiche qu'ouvre un clic, et dans la liste des
   bons de commande. */
function planningContactZoneHTML(b, readOnly){
  const kind = b.kind || 'bonCommande';
  const tentatives = b.tentativesContact||[];
  if(readOnly){
    if(!tentatives.length && !b.rappelDate) return '';
    return `<div class="planning-contact-zone" onclick="event.stopPropagation()">
      ${b.rappelDate? `<span class="contact-tag contact-tag-rappel">🔄 Rappeler le ${fmtDate(b.rappelDate)}</span>`:''}
      ${tentatives.map(t=>`<span class="contact-tag contact-tag-${t.type}">${t.type==='appel'?'📞':'💬'} ${fmtDate(t.date)} ${t.heure}</span>`).join('')}
    </div>`;
  }
  return `<div class="planning-contact-zone" onclick="event.stopPropagation()">
    <button class="btn-contact btn-contact-appel" onclick="logTentativeContact('${jsAttr(kind)}','${jsAttr(b.id)}','appel')" title="Enregistrer une tentative d'appel (maintenant)">📞</button>
    <button class="btn-contact btn-contact-sms" onclick="logTentativeContact('${jsAttr(kind)}','${jsAttr(b.id)}','sms')" title="Enregistrer un SMS envoyé (maintenant)">💬</button>
    <button class="btn-contact btn-contact-rappel" onclick="openRappelModal('${jsAttr(kind)}','${jsAttr(b.id)}')" title="Programmer un rappel (ex : le locataire revient de congés)">📅</button>
    ${b.rappelDate? `<span class="contact-tag contact-tag-rappel">🔄 Rappeler le ${fmtDate(b.rappelDate)} <button onclick="event.stopPropagation(); annulerRappel('${jsAttr(kind)}','${jsAttr(b.id)}')" title="Annuler le rappel">✕</button></span>`:''}
    ${tentatives.map(t=>`<span class="contact-tag contact-tag-${t.type}">${t.type==='appel'?'📞':'💬'} ${fmtDate(t.date)} ${t.heure} <button onclick="removeTentativeContact('${jsAttr(kind)}','${jsAttr(b.id)}','${jsAttr(t.id)}')" title="Retirer">✕</button></span>`).join('')}
  </div>`;
}
/* La pièce attendue, en une ligne.

   Deux écrans internes disaient la même chose dans deux markups différents, et
   le planning la réduisait à un badge dont le détail demandait un survol — ce
   qu'un technicien sur un téléphone de chantier ne fait pas. Le portail client
   garde sa propre formulation : le nom du fournisseur ne le regarde pas. */
function pieceAttendueLigne(b, classe){
  if(!b.pieceACommander && !b.pieceACommanderDetail) return '';
  /* Une pièce reçue n'est plus « pas encore commandée » : la trace survit à
     l'attente, et c'est elle qui explique le report au client comme au
     conducteur qui reprend l'affaire des semaines plus tard. */
  const etape = b.pieceRecueLe
    ? 'reçue le '+fmtDate(b.pieceRecueLe)
    : (b.pieceACommanderDateCommande
        ? 'commandée le '+fmtDate(b.pieceACommanderDateCommande)
        : 'pas encore commandée');
  const detail = [
    b.pieceACommanderDetail? esc(b.pieceACommanderDetail) : 'pièce non précisée',
    etape,
    b.pieceACommanderFournisseur? 'chez '+esc(b.pieceACommanderFournisseur) : ''
  ].filter(Boolean).join(' — ');
  const couleur = b.pieceRecueLe ? '#12875A' : '#C24E00';
  return `<div class="${classe}" style="color:${couleur}; font-weight:600;">📦 ${detail}</div>`;
}
async function logTentativeContact(kind, id, type){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  if(!bc.tentativesContact) bc.tentativesContact = [];
  const now = new Date();
  bc.tentativesContact.push({ id: uid(), type, date: todayISO(), heure: now.toTimeString().slice(0,5) });
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
  majContactsFicheTechnicien();
  showToast(type==='appel' ? '📞 Tentative d\'appel enregistrée !' : '💬 SMS enregistré !', 'success', 1800);
}
async function removeTentativeContact(kind, id, tentativeId){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  bc.tentativesContact = (bc.tentativesContact||[]).filter(t=>t.id!==tentativeId);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
  majContactsFicheTechnicien();
}
function planningPrixSTZoneHTML(b, assigneeField){
  if(assigneeField!=='sousTraitant') return '';
  if(estSousTraitant()){
    return b.montantSousTraitant!=null
      ? `<div class="planning-card-sub" style="font-weight:700; color:var(--success);">💶 Votre montant : ${moneyDisplay(b.montantSousTraitant)} HT</div>`
      : `<div class="planning-card-sub" style="color:var(--text-dim);">💶 Montant en cours de définition</div>`;
  }
  return `<div class="planning-prix-st" onclick="event.stopPropagation()">
    💶 <input type="number" min="0" step="0.01" value="${b.montantSousTraitant!=null? b.montantSousTraitant : ''}" placeholder="Prix ST €"
      onchange="updatePrixSousTraitant('${jsAttr(b.kind)}','${jsAttr(b.id)}',this.value)" title="Montant convenu avec le sous-traitant (HT) — repris sur sa facture pré-remplie"> € HT
  </div>`;
}
async function updatePrixSousTraitant(kind, compositeId, value){
  const resolved = resolvePlanningItem(kind, compositeId);
  if(!resolved) return;
  resolved.bc.montantSousTraitant = value===''? null : (parseFloat(value)||0);
  const r = await window.stSet(planningKeyPrefix(kind)+resolved.bcId, resolved.bc);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  renderTab();
  showToast('💶 Prix sous-traitant enregistré', 'success', 1800);
}
function planningCardHTML(b, unscheduled, assigneeField, assigneeValue){
  const kindBadge = '';
  const couleur = metierCouleur(b.metier);
  const savTriangle = b.isSAV? '<div class="planning-sav-bar" title="SAV"></div>' : '';
  const isLiee = b.metiers && b.metiers.length > 1;
  const positionLiee = isLiee ? b.metiers.indexOf(b.metier)+1 : 0;
  const lienBadge = isLiee ? `<span class="planning-lien-badge" title="Ce bon de commande a ${b.metiers.length} métiers, chacun avec sa propre vignette">🔗 ${positionLiee}/${b.metiers.length}</span>` : '';
  const logementPartageBadge = b.logementPartage ? `<span class="planning-logement-badge" title="${b.logementPartage} bons de commande liés au même devis (même logement)">🏠 ${b.logementPartage}</span>` : '';
  return `<div class="planning-card ${bcInterventionFaite(b)?'planning-card-fait':''}" draggable="true" ondragstart="dragStartBC(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}')" onclick="handlePlanningCardClick(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}',null)" style="${couleur? `border-right:5px solid ${esc(couleur)};` : ''}">
    <div class="planning-card-title">${esc(b.client)}${kindBadge}${lienBadge}${logementPartageBadge}${b.pieceACommander? `<span class="planning-piece-badge" title="Pièce à commander : ${esc(b.pieceACommanderDetail||"non précisée")}">📦</span>`:""}</div>
    ${planningContactZoneHTML(b)}
    <div class="planning-card-sub">${esc(b.numero)}</div>
    ${b.isSAV? '' : `<div class="planning-etape planning-etape-${etapeWorkflow(b).cle}" title="${esc(etapeWorkflow(b).label)}">${esc(etapeWorkflow(b).court)}</div>`}
    ${b.interlocuteur? `<div class="planning-card-sub">👤 ${esc(b.interlocuteur)}</div>`:''}
    ${(b.conducteur || b.metier)? `<div class="planning-card-sub">${b.conducteur? '🦺 '+esc(b.conducteur):''}${b.conducteur && b.metier? ' · ':''}${b.metier? '🔧 '+esc(metierDisplayLabel(b.metier)):''}</div>`:''}
    ${b.adresse? `<div class="planning-card-sub">📍 ${esc(withVille(b.adresse, b.codePostal, b.ville))}</div>`:''}
    ${b.logementStatut? `<div class="planning-card-sub" style="margin-top:2px;">${logementBadge(b.logementStatut)}</div>`:''}
    ${(b.etage || b.numeroLogement)? `<div class="planning-card-sub">${[b.etage? 'Étage '+esc(b.etage):'', b.numeroLogement? 'N° '+esc(b.numeroLogement):''].filter(Boolean).join(' · ')}</div>`:''}
    ${b.isSAV && b.problemeDescription? `<div class="planning-card-sub" style="color:var(--danger);">⚠ ${esc(b.problemeDescription)}</div>`:''}
    ${pieceAttendueLigne(b, 'planning-card-sub')}
    ${b.datePlanificationInitiale? `<div class="planning-card-sub" title="Reportée pour attente de pièce">🕓 1ère planif. : ${fmtDate(b.datePlanificationInitiale)}</div>`:''}
    ${b.dateInterventionTerminee? `<div class="planning-card-sub" style="color:#2E9BF0;">✅ Terminée le ${fmtDate(b.dateInterventionTerminee)}</div>`:''}
    ${planningPrixSTZoneHTML(b, assigneeField)}
    <input type="date" class="planning-quick-date" onchange="quickScheduleBC('${jsAttr(b.kind)}','${jsAttr(b.id)}', this.value, '${assigneeField||''}', '${jsAttr(assigneeValue||'')}')" title="Choisir une date (alternative au glisser-déposer)">
    ${(b.montant!=null && !estSousTraitant())? `<div class="planning-card-amount">${moneyDisplay(b.montant)}</div>` : ''}
    ${(b.pieceJointeChemin||b.pieceJointeData)? `<a href="javascript:void(0)" class="planning-card-pj" draggable="false" onclick="event.stopPropagation(); openAttachmentPreviewFor('${jsAttr(b.kind)}','${jsAttr(b.id)}')" title="Aperçu de la pièce jointe">📎 ${esc(b.pieceJointeNom||'Pièce jointe')}</a>`:''}
    ${savTriangle}
  </div>`;
}
function planningScheduledCardHTML(b, dayIso, assigneeField){
  assigneeField = assigneeField || 'technicien';
  const occSuppl = (b.datesSupplementaires||[]).find(x=>x.date===dayIso);
  const isDateSupp = !!occSuppl && dayIso !== b.datePlanifiee;
  const isOrigin = dayIso === b.datePlanifiee;
  const isMultiJour = b.datePlanifieeFin && b.datePlanifieeFin !== b.datePlanifiee;
  const isDernierJour = isMultiJour && dayIso === b.datePlanifieeFin;
  const kindBadge = '';
  const isLiee = b.metiers && b.metiers.length > 1;
  const positionLiee = isLiee ? b.metiers.indexOf(b.metier)+1 : 0;
  const lienBadge = isLiee ? `<span class="planning-lien-badge" title="Ce bon de commande a ${b.metiers.length} métiers, chacun avec sa propre vignette">🔗 ${positionLiee}/${b.metiers.length}</span>` : '';
  const logementPartageBadge = b.logementPartage ? `<span class="planning-logement-badge" title="${b.logementPartage} bons de commande liés au même devis (même logement)">🏠 ${b.logementPartage}</span>` : '';
  const h = parseInt((b.heurePlanifiee||'08:00').split(':')[0],10) || 8;
  let startIdx = PLANNING_HOURS.indexOf(h);
  if(startIdx<0) startIdx = 0;
  const hDernierJour = parseInt((b.heureDernierJour||'08:00').split(':')[0],10) || 8;
  let startIdxDernierJour = PLANNING_HOURS.indexOf(hDernierJour);
  if(startIdxDernierJour<0) startIdxDernierJour = 0;
  const duree = b.dureeHeures || 1;
  const rowExpr = planningRowExpr();
  const couleur = metierCouleur(b.metier);
  const couleurStyle = couleur? `border-right:5px solid ${esc(couleur)};` : '';
  const savTriangle = b.isSAV? '<div class="planning-sav-bar" title="SAV"></div>' : '';
  let top, height, spanRows;
  if(isDateSupp){
    const hSuppl = parseInt((occSuppl.heure||'08:00').split(':')[0],10) || 8;
    let startIdxSuppl = PLANNING_HOURS.indexOf(hSuppl);
    if(startIdxSuppl<0) startIdxSuppl = 0;
    const dureeSuppl = occSuppl.duree || 1;
    spanRows = calculerSpanRows(startIdxSuppl, dureeSuppl);
    top = `calc(${startIdxSuppl} * ${rowExpr} + 2px)`;
    height = `calc(${spanRows} * ${rowExpr} - 4px)`;
  } else if(!isOrigin && isDernierJour){
    spanRows = b.dureeDernierJour ? calculerSpanRows(startIdxDernierJour, b.dureeDernierJour) : (PLANNING_HOURS.length-startIdxDernierJour);
    top = `calc(${startIdxDernierJour} * ${rowExpr} + 2px)`;
    height = `calc(${spanRows} * ${rowExpr} - 4px)`;
  } else if(!isOrigin){
    spanRows = PLANNING_HOURS.length;
    top = `calc(0 * ${rowExpr} + 2px)`;
    height = `calc(${spanRows} * ${rowExpr} - 4px)`;
  } else {
    spanRows = calculerSpanRows(startIdx, duree);
    top = `calc(${startIdx} * ${rowExpr} + 2px)`;
    height = `calc(${spanRows} * ${rowExpr} - 4px)`;
  }
  if(isDateSupp){
    return `<div class="planning-card planning-card-scheduled planning-card-suppl ${bcInterventionFaite(b)?'planning-card-fait':''}" draggable="false" onclick="handlePlanningCardClick(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}')" style="top:${top}; height:${height}; ${couleurStyle}">
      <button class="planning-unschedule" onclick="event.stopPropagation(); removeDateSupplementaire('${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}')" title="Retirer cette date">✕</button>
      <div class="planning-card-title">${esc(b.client)}${kindBadge}<span class="planning-suppl-badge" title="Date supplémentaire ajoutée pour ce même bon de commande">📅 Suppl.</span></div>
      <div class="planning-card-sub">${esc(b.numero)}</div>
      <div class="planning-card-controls" onclick="event.stopPropagation()">
        <input type="time" class="planning-time" value="${occSuppl.heure||'08:00'}" onchange="updateDateSupplChamp('${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}','heure',this.value)">
        <select class="planning-duree" onchange="updateDateSupplChamp('${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}','duree',this.value)" title="Durée">
          ${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${(occSuppl.duree||1)===n?'selected':''}>${n} h</option>`).join('')}
        </select>
      </div>
      ${savTriangle}
    </div>`;
  }
  if(!isOrigin && isDernierJour){
    return `<div class="planning-card planning-card-scheduled planning-card-continuation" onclick="handlePlanningCardClick(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}')" style="top:${top}; height:${height}; ${couleurStyle}; cursor:pointer;">
      <div class="planning-card-title">${esc(b.client)}${kindBadge}${lienBadge}${logementPartageBadge}${b.pieceACommander? `<span class="planning-piece-badge" title="Pièce à commander : ${esc(b.pieceACommanderDetail||"non précisée")}">📦</span>`:""}</div>
      <div class="planning-card-sub">${esc(b.numero)} · suite, dernier jour</div>
      <input type="time" class="planning-time" value="${b.heureDernierJour||'08:00'}" onchange="updateBCHeureDernierJour('${jsAttr(b.kind)}','${jsAttr(b.id)}',this.value)" onclick="event.stopPropagation()" title="Heure de début ce jour-là">
      ${savTriangle}
      <div class="planning-resize-corner planning-resize-corner-big" onmousedown="startResizeCorner(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}',true)" draggable="false" title="Glisser pour ajuster la durée et/ou étendre sur d'autres jours"></div>
    </div>`;
  }
  if(!isOrigin){
    return `<div class="planning-card planning-card-scheduled planning-card-continuation" onclick="handlePlanningCardClick(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}')" style="top:${top}; height:${height}; ${couleurStyle}; cursor:pointer;">
      <div class="planning-card-title">${esc(b.client)}${kindBadge}${lienBadge}${logementPartageBadge}${b.pieceACommander? `<span class="planning-piece-badge" title="Pièce à commander : ${esc(b.pieceACommanderDetail||"non précisée")}">📦</span>`:""}</div>
      <div class="planning-card-sub">${esc(b.numero)} · suite</div>
      ${savTriangle}
    </div>`;
  }
  return `<div class="planning-card planning-card-scheduled ${bcInterventionFaite(b)?'planning-card-fait':''}" draggable="true" ondragstart="dragStartBC(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}')" onclick="handlePlanningCardClick(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(dayIso)}')" style="top:${top}; height:${height}; ${couleurStyle}">
    ${estSousTraitant()? '' : `<button class="planning-unschedule" onclick="unscheduleBC('${jsAttr(b.kind)}','${jsAttr(b.id)}')" title="Retirer du planning">✕</button>`}
    <div class="planning-card-title">${esc(b.client)}${kindBadge}${lienBadge}${logementPartageBadge}${b.pieceACommander? `<span class="planning-piece-badge" title="Pièce à commander : ${esc(b.pieceACommanderDetail||"non précisée")}">📦</span>`:""}</div>
    ${planningContactZoneHTML(b, true)}
    <div class="planning-card-sub">${esc(b.numero)}</div>
    ${b.isSAV? '' : `<div class="planning-etape planning-etape-${etapeWorkflow(b).cle}" title="${esc(etapeWorkflow(b).label)}">${esc(etapeWorkflow(b).court)}</div>`}
    ${b.interlocuteur? `<div class="planning-card-sub">👤 ${esc(b.interlocuteur)}</div>`:''}
    ${(b.conducteur || b.metier)? `<div class="planning-card-sub">${b.conducteur? '🦺 '+esc(b.conducteur):''}${b.conducteur && b.metier? ' · ':''}${b.metier? '🔧 '+esc(metierDisplayLabel(b.metier)):''}</div>`:''}
    ${b.adresse? `<div class="planning-card-sub">📍 ${esc(withVille(b.adresse, b.codePostal, b.ville))}</div>`:''}
    ${b.logementStatut? `<div class="planning-card-sub" style="margin-top:2px;">${logementBadge(b.logementStatut)}</div>`:''}
    ${(b.etage || b.numeroLogement)? `<div class="planning-card-sub">${[b.etage? 'Étage '+esc(b.etage):'', b.numeroLogement? 'N° '+esc(b.numeroLogement):''].filter(Boolean).join(' · ')}</div>`:''}
    ${b.isSAV && b.problemeDescription? `<div class="planning-card-sub" style="color:var(--danger);">⚠ ${esc(b.problemeDescription)}</div>`:''}
    ${b.datePlanificationInitiale? `<div class="planning-card-sub" title="Reportée pour attente de pièce">🕓 1ère planif. : ${fmtDate(b.datePlanificationInitiale)}</div>`:''}
    ${b.dateInterventionTerminee? `<div class="planning-card-sub" style="color:#2E9BF0;">✅ Terminée le ${fmtDate(b.dateInterventionTerminee)}</div>`:''}
    ${estSousTraitant()? `${(b.datesSupplementaires||[]).length? `<div class="planning-extra-dates">${b.datesSupplementaires.map(d=>`<span class="planning-extra-date-tag">📅 ${fmtDate(d.date)} ${d.heure||'08:00'}</span>`).join('')}</div>`:''}` : `<div class="planning-extra-dates" onclick="event.stopPropagation()">
      ${(b.datesSupplementaires||[]).map(d=>`<span class="planning-extra-date-tag">📅 ${fmtDate(d.date)} ${d.heure||'08:00'} (${d.duree||1}h) <button onclick="removeDateSupplementaire('${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(d.date)}')" title="Retirer">✕</button></span>`).join('')}
      <button class="btn small ghost" onclick="event.stopPropagation(); openAjoutDateSupplModal('${jsAttr(b.kind)}','${jsAttr(b.id)}')" title="Planifier ce même bon de commande sur une autre date, en plus">+ Autre date</button>
    </div>`}
    ${estSousTraitant()? `<div class="planning-card-controls"><span class="planning-jour-heure" style="font-size:11px;">${b.heurePlanifiee||'—'}${b.dureeHeures? ' · '+b.dureeHeures+'h':''}</span></div>` : `<div class="planning-card-controls">
      <input type="time" class="planning-time" value="${b.heurePlanifiee||''}" onchange="updateBCHeure('${jsAttr(b.kind)}','${jsAttr(b.id)}',this.value)" onclick="event.stopPropagation()">
      <select class="planning-duree" onchange="updateBCDuree('${jsAttr(b.kind)}','${jsAttr(b.id)}',this.value)" onclick="event.stopPropagation()" title="Durée">
        ${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${duree===n?'selected':''}>${n} h</option>`).join('')}
      </select>
    </div>`}
    ${estSousTraitant()? '' : `<select class="planning-technicien-select" onchange="updateBCAssignee('${jsAttr(b.kind)}','${jsAttr(b.id)}','${jsAttr(assigneeField)}',this.value)" onclick="event.stopPropagation()" title="${assigneeField==='sousTraitant'?'Sous-traitant assigné':'Équipe assignée'}">${assigneeField==='sousTraitant'? sousTraitantSelectOptions(b.sousTraitant) : technicienSelectOptions(b.technicien)}</select>`}
    ${estSousTraitant()? '' : `<input type="date" class="planning-enddate" value="${b.datePlanifieeFin||b.datePlanifiee||''}" min="${b.datePlanifiee||''}" onchange="updateBCDateFin('${jsAttr(b.kind)}','${jsAttr(b.id)}',this.value)" onclick="event.stopPropagation()" title="Étirer jusqu'à cette date">`}
    ${(b.montant!=null && !estSousTraitant())? `<div class="planning-card-amount">${moneyDisplay(b.montant)}</div>` : ''}
    ${planningPrixSTZoneHTML(b, assigneeField)}
    ${(b.pieceJointeChemin||b.pieceJointeData)? `<a href="javascript:void(0)" class="planning-card-pj" draggable="false" onclick="event.stopPropagation(); openAttachmentPreviewFor('${jsAttr(b.kind)}','${jsAttr(b.id)}')" title="Aperçu de la pièce jointe">📎</a>`:''}
    ${savTriangle}
    ${estSousTraitant()? '' : `<button class="planning-shift-left" onclick="event.stopPropagation(); shiftBCUnJourPlusTot('${jsAttr(b.kind)}','${jsAttr(b.id)}')" title="Annuler l'étirement (puis déplanifier au clic suivant)">←</button>`}
    ${estSousTraitant()? '' : `<div class="planning-resize-corner planning-resize-corner-big" onmousedown="startResizeCorner(event,'${jsAttr(b.kind)}','${jsAttr(b.id)}',false)" draggable="false" title="Glisser pour ajuster la durée et/ou étendre sur d'autres jours"></div>`}
  </div>`;
}
let draggedItem = null;
function handlePlanningCardClick(ev, kind, id, dayIso){
  if(estSousTraitant()){
    ev.stopPropagation();
    openSousTraitantValidationModal(kind, id, dayIso);
    return;
  }
  ev.stopPropagation();
  openTechnicienInterventionModal(kind, id, dayIso);
}
let stModalCtx = null;
function openSousTraitantValidationModal(kind, id, dayIso){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const b = resolved.bc;
  const estDateOrigine = !dayIso || !(b.datesSupplementaires||[]).some(d=>d.date===dayIso);
  stModalCtx = { kind, bcId: b.id, dayIso: estDateOrigine ? null : dayIso };
  document.getElementById('stModalTitre').textContent = 'Valider les travaux — ' + (b.numeroBC || b.client) + (estDateOrigine ? '' : ` — ${fmtDate(dayIso)}`);
  document.getElementById('stModalInfo').textContent = `${b.client||''} — ${withVille(b.adresseLocataire||b.adresse, b.codePostal, b.ville)||''}${b.numeroLogement? ' · N° '+b.numeroLogement:''}`;
  const occSuppl = stModalCtx.dayIso ? (b.datesSupplementaires||[]).find(d=>d.date===stModalCtx.dayIso) : null;
  document.getElementById('stModalDateFaite').checked = stModalCtx.dayIso ? !!(occSuppl && occSuppl.fait) : !!b.dateOrigineFait;
  const autresDates = bcToutesDatesDuBC(b).filter(d=> d.dayIso !== (stModalCtx.dayIso||b.datePlanifiee));
  const nbRestantes = autresDates.filter(d=>!d.fait).length;
  document.getElementById('stModalDatesRestantes').textContent = autresDates.length? `Ce chantier a ${autresDates.length} autre(s) date(s) planifiée(s) — ${nbRestantes? nbRestantes+' encore à valider' : 'toutes déjà validées'}.` : '';
  document.getElementById('stModalCommentaire').value = b.sousTraitantCommentaire || '';
  document.getElementById('stTravailSupInput').value = '';
  rafraichirTravauxSupplementaires(b.id, 'stTravauxSupListe');
  renderSTModalPhotos(b);
  document.getElementById('stValidationModal').classList.add('open');
}
function renderSTModalPhotos(b){
  const photos = b.technicienPhotos || [];
  document.getElementById('stModalPhotos').innerHTML = photos.map((p,i)=>`
    <div class="tech-photo-thumb">
      <img src="${p.data}" onclick="openAttachmentPreview('${jsAttr(p.data)}','${jsAttr(p.nom||'photo.jpg')}')">
      <button type="button" onclick="removeSTPhoto(${i})">✕</button>
    </div>`).join('');
}
function addSTPhoto(input){
  const b = state.bonsCommande.find(x=>x.id===stModalCtx.bcId);
  if(!b) return;
  if(!b.technicienPhotos) b.technicienPhotos = [];
  const files = Array.from(input.files||[]);
  let remaining = files.length;
  if(!remaining) return;
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      b.technicienPhotos.push({ id: uid(), nom: file.name, data: ev.target.result });
      remaining--;
      if(remaining===0) renderSTModalPhotos(b);
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function removeSTPhoto(index){
  const b = state.bonsCommande.find(x=>x.id===stModalCtx.bcId);
  if(!b || !b.technicienPhotos) return;
  b.technicienPhotos.splice(index,1);
  renderSTModalPhotos(b);
}
function closeSousTraitantValidationModal(){
  document.getElementById('stValidationModal').classList.remove('open');
  stModalCtx = null;
}
async function saveSousTraitantValidation(){
  const b = state.bonsCommande.find(x=>x.id===stModalCtx.bcId);
  if(!b) return;
  b.sousTraitantCommentaire = document.getElementById('stModalCommentaire').value;
  const dateFaite = document.getElementById('stModalDateFaite').checked;
  if(stModalCtx.dayIso){
    const occ = (b.datesSupplementaires||[]).find(d=>d.date===stModalCtx.dayIso);
    if(occ) occ.fait = dateFaite;
  } else {
    b.dateOrigineFait = dateFaite;
  }
  if(bcInterventionFaite(b)) b.dateInterventionTerminee = todayISO();
  else b.dateInterventionTerminee = '';
  const r = await window.stSet('bonCommande:'+b.id, b);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  closeSousTraitantValidationModal();
  renderTab();
  showToast('✓ Travaux validés — merci !', 'success');
}
let techModalCtx = null;
/* La fiche est peuplée une fois, à l'ouverture. Sans ce rafraîchissement, un
   appel enregistré depuis la fiche elle-même n'y apparaîtrait qu'au prochain
   passage — c'est-à-dire jamais, du point de vue de celui qui vient de cliquer. */
function majContactsFicheTechnicien(){
  const zone = document.getElementById('techModalContacts');
  if(!zone || !techModalCtx) return;
  const resolved = resolvePlanningItem(techModalCtx.kind, techModalCtx.bcId);
  if(!resolved) return;
  zone.innerHTML = planningContactZoneHTML(resolved.bc);
  const rien = !(resolved.bc.tentativesContact||[]).length && !resolved.bc.rappelDate;
  document.getElementById('techModalContactsVide').style.display = rien? '' : 'none';
}
function openTechnicienInterventionModal(kind, id, dayIso){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const b = resolved.bc;
  const estDateOrigine = !dayIso || !(b.datesSupplementaires||[]).some(d=>d.date===dayIso);
  /* Le métier de la carte cliquée était rendu par `resolvePlanningItem` puis
     jeté : la fiche montrait donc tous les métiers du bon, et matérialisait au
     passage les tâches de ceux qu'on n'avait pas ouverts. */
  techModalCtx = { kind, bcId: b.id, metierKey: resolved.metierKey || null, dayIso: estDateOrigine ? null : dayIso };
  document.getElementById('techModalTitre').textContent = (b.numeroBC || b.client)
    + (resolved.metierKey ? ` — ${metierDisplayLabel(resolved.metierKey)}` : '')
    + (estDateOrigine ? '' : ` — ${fmtDate(dayIso)}`);
  document.getElementById('techModalInfo').textContent = `${esc(b.client)} — ${withVille(b.adresse, b.codePostal, b.ville)||''}`;
  const occSuppl = techModalCtx.dayIso ? (b.datesSupplementaires||[]).find(d=>d.date===techModalCtx.dayIso) : null;
  document.getElementById('techModalDateFaite').checked = techModalCtx.dayIso ? !!(occSuppl && occSuppl.fait) : !!b.dateOrigineFait;
  const autresDates = bcToutesDatesDuBC(b).filter(d=> d.dayIso !== (techModalCtx.dayIso||b.datePlanifiee));
  const nbRestantes = autresDates.filter(d=>!d.fait).length;
  document.getElementById('techModalDatesRestantes').textContent = autresDates.length? `Ce bon de commande a ${autresDates.length} autre(s) date(s) planifiée(s) — ${nbRestantes? nbRestantes+' encore à valider' : 'toutes déjà validées'}.` : '';
  document.getElementById('techModalCommentaire').value = b.technicienCommentaire || '';
  document.getElementById('techModalPieceCommander').checked = !!b.pieceACommander;
  document.getElementById('techModalPieceDetail').value = b.pieceACommanderDetail || '';
  togglePieceCommanderInput(!!b.pieceACommander);
  document.getElementById('techTravailSupInput').value = '';
  rafraichirTravauxSupplementaires(b.id, 'techTravailSupListe');
  renderTechModalPhotos(b);
  majContactsFicheTechnicien();
  document.getElementById('technicienInterventionModal').style.display = 'flex';
  setTimeout(()=> setupTechDessinCanvas(b), 30);
  chargerWorkflowTache(b, techModalCtx.dayIso, techModalCtx.metierKey);
}
/* ---------- Circuit de validation d'une tâche ----------
   L'état et les actions viennent de la base : `planning_taches` porte le
   statut, et les transitions passent par des fonctions SQL qui horodatent et
   enregistrent l'auteur. L'interface ne fait que déclencher. */

/* Un élément par métier du bon : `{ metier, tache }`. Chaque métier porte sa
   propre tâche et s'arbitre séparément — c'est ce que supposent déjà les règles
   de `regles-bc.ts` et le `metiersFait` de l'adaptateur. */
let wfTaches = [];

const WF_LIBELLES = {
  planifiee: 'Planifiée',
  realisee: 'Travaux déclarés faits',
  validee: 'Validée',
  refusee: 'Refusée',
};

async function chargerWorkflowTache(b, dayIso, metierKey){
  const zone = document.getElementById('techModalWorkflow');
  if(!zone) return;
  zone.innerHTML = '<div class="wf-bandeau"><span class="wf-meta">Chargement du suivi…</span></div>';
  wfTaches = [];

  try{
    const date = dayIso || b.datePlanifiee || todayISO();
    const libelle = b.numeroBC || b.client || 'Intervention';
    /* Un bon sans métier déclaré garde une tâche unique sans métier : son
       circuit reste exactement celui d'avant. */
    const metiers = bcMetiersDuBC(b);
    const tous = metiers.length ? metiers : [null];

    /* On ouvre la fiche d'**une** carte : elle ne montre que son métier. Les
       afficher tous mélangeait deux interventions distinctes, et matérialisait
       au passage les tâches des métiers qu'on n'avait pas ouverts. */
    const monMetier = metierKey && tous.some(m => window.memeMetier(m, metierKey))
      ? tous.find(m => window.memeMetier(m, metierKey))
      : (metiers.length ? tous[0] : null);
    const cibles = [monMetier];

    /* Les lignes du bon sont la seule description écrite des travaux. Sans
       elles la carte n'annonçait qu'un métier et une date — le technicien
       arrivait sans savoir ce qu'il venait faire, et le chiffrage repartait
       d'une feuille blanche alors que le bon disait déjà tout. */
    const connus = metiersDisponibles();
    const travauxDe = (m) => window.travauxDeLaCarte
      ? window.travauxDeLaCarte(b.lignes, connus, m, tous[0])
      : [];

    const chargees = [];
    for(const m of cibles){
      /* En série : deux matérialisations concurrentes sur le même bon
         créeraient deux tâches pour un même métier. */
      const equipe = equipeDeLaCarte(b, m);
      chargees.push({
        metier: m,
        tache: await window.tacheDuBonCommande(b.id, date, libelle, m, equipe),
        travaux: travauxDe(m)
      });
    }

    /* Une tâche qu'aucun métier déclaré ne réclame — au métier vide, ou à un
       métier retiré du bon depuis — n'apparaîtrait sous aucun bandeau. Elle
       resterait pourtant comptée par `bc_passer_pret_a_chiffrer`, qui exige que
       **toutes** les tâches soient validées : le bon se bloque avant le
       chiffrage sans que rien ne le dise. C'est ce qui est arrivé à
       BC-2026-0866. Une tâche qui existe doit toujours être atteignable. */
    const surLaPremiere = !metiers.length || window.memeMetier(monMetier, tous[0]);
    if(surLaPremiere){
      const reclamees = new Set(chargees.map(e => e.tache && e.tache.id));
      const toutes = await window.listTachesBonCommande(b.id);
      for(const t of (toutes || [])){
        if(reclamees.has(t.id)) continue;
        // Réclamée par un autre métier du bon : elle a sa propre carte.
        if(tous.some(m => window.memeMetier(m, t.metier))) continue;
        chargees.push({ metier: t.metier || null, tache: t, horsMetier: true, travaux: [] });
      }
    }

    wfTaches = chargees;
    renderWorkflowTaches();
  }catch(err){
    console.error('Suivi de tâche indisponible', err);
    zone.innerHTML = `<div class="wf-bandeau"><span class="wf-meta">Suivi indisponible : ${esc(err.message||'erreur')}</span></div>`;
  }
}

function renderWorkflowTaches(){
  const zone = document.getElementById('techModalWorkflow');
  if(!zone) return;
  if(!wfTaches.length){ zone.innerHTML = ''; return; }

  const bandeaux = wfTaches.map((e, i) => bandeauTacheHTML(e, i)).join('');

  /* Le planning arbitre les tâches, il ne chiffre pas. Une fois tous les métiers
     validés, le bon remonte de lui-même dans Facturation › Validation, où
     l'administrateur saisit les prix puis valide le chiffrage. Un bouton de
     pré-facture ici court-circuitait cette étape : il générait la facture sans
     qu'aucun prix ait été demandé. */
  const toutesValidees = wfTaches.every(e => (e.tache.statut || 'planifiee') === 'validee');
  const suite = toutesValidees
    ? `<div class="wf-bandeau"><span class="wf-meta">✓ Tous les métiers sont validés — le bon attend son chiffrage dans <b>Facturation › Validation</b>.</span></div>`
    : '';

  zone.innerHTML = bandeaux + suite;
}

/**
 * L'équipe du compte connecté, dans la société active.
 *
 * C'est la chaîne que la base emprunte pour sa propre garde : compte → salarié
 * → équipe. On la refait ici pour que l'écran sache, **avant** le clic, si la
 * tâche est celle de l'utilisateur.
 */
/**
 * L'uuid de l'équipe choisie au planning pour ce métier.
 *
 * `schedField` rend le **nom** de l'équipe ; la tâche, elle, la référence par
 * uuid. On traduit ici, faute de quoi une tâche matérialisée à l'ouverture
 * d'une carte naîtrait sans équipe — et n'en recevrait plus jamais.
 */
function equipeDeLaCarte(b, metier){
  const nom = schedField(b, metier || null, 'technicien') || b.technicien || '';
  if(!nom) return null;
  const e = state.techniciens.find(x => x.societeId===state.societeId && (x.nom1===nom || x.id===nom));
  return e ? e.id : null;
}

function monEquipeId(){
  const moi = window.monCompteId && window.monCompteId();
  if(!moi) return null;
  const salarie = state.salaries.find(s => s.profileId === moi && s.societeId === state.societeId);
  return (salarie && salarie.technicienId) || null;
}

/** À qui la tâche est confiée, vu du compte qui regarde. */
function appartenanceTache(t){
  const equipeTache = t.technicien_id || t.technicienId || null;
  return {
    aUneEquipe: !!equipeTache,
    enFaitPartie: !!equipeTache && equipeTache === monEquipeId(),
  };
}

/**
 * Les travaux du bon qui reviennent à cette tâche, tels qu'ils y sont écrits.
 *
 * En lecture seule, et sans prix : le pointage se fait à la journée, et le
 * terrain ne voit aucun montant — c'est déjà la règle du reste de l'écran.
 * Le titre du chapitre est conservé parce qu'il nomme la pièce : « PEINTURE
 * CHAMBRE 1 » est la seule indication de lieu que porte le bon.
 */
function travauxTacheHTML(blocs){
  if(!blocs || !blocs.length) return '';
  const total = blocs.reduce((n, b)=>n + b.lignes.length, 0);
  const corps = blocs.map(bloc=>`
    ${bloc.chapitre ? `<div class="wf-travaux-chapitre">${esc(bloc.chapitre)}</div>` : ''}
    <ul class="wf-travaux-liste">${bloc.lignes.map(l=>{
      // La virgule décimale, comme partout ailleurs sur les quantités.
      const q = (l.qte===0 || l.qte) ? `${esc(String(l.qte).replace('.', ','))}${l.unite? ' '+esc(l.unite):''}` : '';
      return `<li${(l.type||'ligne')==='commentaire'? ' class="wf-travaux-note"':''}>`
        + `<span>${esc(l.designation||'')}</span>${q? `<span class="wf-travaux-qte">${q}</span>`:''}</li>`;
    }).join('')}</ul>`).join('');
  return `<div class="wf-travaux">
    <div class="wf-travaux-titre">📋 Travaux prévus au bon — ${total} ligne${total>1?'s':''}</div>
    ${corps}
  </div>`;
}

function bandeauTacheHTML(entree, i){
  const t = entree.tache;
  const statut = t.statut || 'planifiee';
  const appartenance = appartenanceTache(t);
  const droits = window.actionsTache(statut, undefined, appartenance);
  /* Le terrain voit toutes les tâches du bon — connaître l'avancement du
     chantier entier a du sens — mais il n'agit que sur les siennes. Le motif
     reprend mot pour mot celui que la base opposerait. */
  const lectureSeule = window.motifLectureSeule
    ? window.motifLectureSeule(appartenance)
    : null;
  const equipe = (t.technicien_id || t.technicienId)
    ? (state.techniciens.find(e => e.id === (t.technicien_id || t.technicienId)) || {}).nom1
    : null;

  const boutons = [];
  if(droits.peutSaisir){
    boutons.push(`<button class="btn" onclick="wfEnregistrerConstats(${i})">💾 Enregistrer mes constats</button>`);
  }
  if(droits.peutCloturer){
    boutons.push(`<button class="btn primary" onclick="wfMarquerRealisee(${i})">✓ Travaux terminés</button>`);
  }
  if(droits.peutArbitrer){
    boutons.push(`<button class="btn primary" onclick="wfValider(${i}, true)">✓ Valider</button>`);
    boutons.push(`<button class="btn ghost" onclick="wfValider(${i}, false)">✕ Refuser</button>`);
  }

  /* Qui a fait quoi : un identifiant ne dit rien, on affiche le nom. */
  const histoire = [];
  if(t.realisee_le){
    histoire.push(`Déclarés faits par <b>${esc(window.nomIntervenant(t.realisee_par))}</b> le ${fmtDate(String(t.realisee_le).slice(0,10))}`);
  }
  if(t.validee_le){
    histoire.push(`Validés par <b>${esc(window.nomIntervenant(t.validee_par))}</b> le ${fmtDate(String(t.validee_le).slice(0,10))}`);
  }
  if(statut === 'refusee' && t.validee_par){
    histoire.push(`Refusés par <b>${esc(window.nomIntervenant(t.validee_par))}</b>`);
  }

  /* À qui le tour : c'est la question qu'on se pose en ouvrant la fiche. */
  const acteur = window.prochainActeur(statut);
  const cestMonTour = (statut === 'realisee' && droits.peutArbitrer)
    || ((statut === 'planifiee' || statut === 'refusee') && droits.peutCloturer);
  const attente = statut === 'validee'
    ? '<span class="wf-clos">✓ Circuit terminé pour cette tâche</span>'
    : (cestMonTour
        ? `<span class="wf-tour wf-tour-moi">⏳ À vous de jouer — ${esc(acteur)}</span>`
        : `<span class="wf-tour">⏳ En attente de ${esc(acteur)}</span>`);

  return `<div class="wf-bandeau">
    ${entree.metier ? `<div class="wf-metier">${esc(metierDisplayLabel(entree.metier))}</div>` : ''}
    ${travauxTacheHTML(entree.travaux)}
    ${entree.horsMetier ? `<div class="wf-metier wf-hors-metier">Hors métier${entree.metier ? '' : ' — tâche sans métier'}</div>` : ''}
    <span class="wf-etat wf-${esc(statut)}">${esc(WF_LIBELLES[statut] || statut)}</span>
    ${equipe ? `<div class="wf-equipe">👷 Confiée à ${esc(equipe)}</div>` : '<div class="wf-equipe wf-sans-equipe">👷 Aucune équipe affectée</div>'}
    ${t.refus_motif && statut === 'refusee' ? `<div class="wf-motif">↩ ${esc(t.refus_motif)}</div>` : ''}
    ${histoire.length ? `<div class="wf-meta">${histoire.join('<br>')}</div>` : ''}
    <div class="wf-attente">${attente}</div>
    ${boutons.length
      ? `<div class="wf-actions">${boutons.join('')}</div>`
      : `<div class="wf-meta">${esc(lectureSeule || 'Aucune action ouverte à votre rôle à cette étape.')}</div>`}
  </div>`;
}

/* La tâche visée par un bouton : les bandeaux sont rendus dans l'ordre de
   `wfTaches`, l'indice les désigne sans exposer d'identifiant dans le HTML. */
function wfTacheAt(i){
  const entree = wfTaches[i];
  if(!entree) throw new Error('Tâche introuvable — rouvrez la fiche.');
  return entree.tache;
}

async function wfRafraichir(){
  const bcId = techModalCtx && techModalCtx.bcId;
  if(!bcId || !wfTaches.length) return;
  const taches = await window.listTachesBonCommande(bcId);
  wfTaches = wfTaches.map(e => ({ ...e, tache: taches.find(x => x.id === e.tache.id) || e.tache }));
  renderWorkflowTaches();

  /* Le bon de commande DÉRIVE de ses tâches : `metiersFait`, `valideConducteur`
     et `pieceACommander` sont recalculés au chargement de la collection, pas
     ici. Ne rafraîchir que la modale laissait donc `state.bonsCommande` sur
     l'état d'avant : valider la dernière tâche d'un bon l'inscrivait bien en
     base, mais il ne remontait dans Facturation › Validation qu'après un
     rechargement complet de la page. Les trois gestes du terrain — constats,
     travaux réalisés, validation — passent tous par ici.

     La modale vit hors de `#content` : redessiner l'onglet ne la ferme pas. */
  await recharger('bonCommande');
  renderTab();
}

/* Enregistre commentaire et pièce sans changer d'état : le technicien peut
   noter au fil de l'intervention sans la déclarer terminée. */
async function wfEnregistrerConstats(i){
  try{
    await window.sauvegarderTerrain(wfTacheAt(i).id, {
      commentaire: document.getElementById('techModalCommentaire').value || undefined,
      pieceACommander: document.getElementById('techModalPieceCommander').checked,
      pieceDescription: document.getElementById('techModalPieceDetail').value || undefined,
    });
    await wfRafraichir();
    showToast('Constats enregistrés.', 'success');
  }catch(err){
    console.error('Enregistrement des constats refusé', err);
    showToast(err.message || 'Enregistrement impossible.');
  }
}

async function wfMarquerRealisee(i){
  const commentaire = document.getElementById('techModalCommentaire').value || undefined;
  try{
    const tacheId = wfTacheAt(i).id;
    // On enregistre d'abord les constats : ils seraient perdus au changement d'état
    await window.sauvegarderTerrain(tacheId, {
      commentaire,
      pieceACommander: document.getElementById('techModalPieceCommander').checked,
      pieceDescription: document.getElementById('techModalPieceDetail').value || undefined,
    });
    await window.marquerRealisee(tacheId, { commentaire });
    await wfRafraichir();
    showToast('Travaux déclarés faits — en attente de validation.', 'success');
  }catch(err){
    console.error('Passage en réalisé refusé', err);
    showToast(err.message || 'Action refusée.');
  }
}

async function wfValider(i, ok){
  let motif;
  if(!ok){
    // Un refus non motivé ne dit pas au technicien quoi reprendre
    motif = prompt('Motif du refus (obligatoire) :');
    if(!motif || !motif.trim()) return;
  }
  try{
    await window.validerTache(wfTacheAt(i).id, ok, motif);
    await wfRafraichir();
    showToast(ok ? 'Travaux validés.' : 'Travaux renvoyés au technicien.', 'success');
  }catch(err){
    console.error('Validation refusée', err);
    showToast(err.message || 'Action refusée.');
  }
}

/* `wfValiderPrefacture` a été supprimée. Elle générait la facture depuis le
   planning sans jamais demander de prix : le chiffrage se saisit dans
   Facturation › Validation (`openValidationDirecteurModal`), qui présente
   chaque ligne et chaque travail supplémentaire avec son champ de prix avant
   de laisser valider. Deux chemins vers le même geste, dont un qui sautait la
   seule étape qui compte.

   `wfPretAChiffrer` a été supprimée pour une raison voisine : elle était
   définie et jamais appelée. Le passage à « prêt à chiffrer » est déduit du
   chiffrage, pas cliqué. Un bouton mort disait le contraire. */

function closeTechnicienInterventionModal(){
  document.getElementById('technicienInterventionModal').style.display = 'none';
  techModalCtx = null;
}
/* `renderTechModalMetiers` et `toggleTechModalMetier` ont été supprimées. Leurs
   cases à cocher ne persistaient rien — `toggleTechModalMetier` ne modifiait
   que `b.metiersFait` en mémoire, perdu au rechargement — et elles doublaient
   désormais les bandeaux de circuit, qui eux portent l'état réel de chaque
   métier. Une case qui ne sauvegarde pas dit le contraire de ce qu'elle fait. */
function renderTechModalPhotos(b){
  const photos = b.technicienPhotos || [];
  document.getElementById('techModalPhotos').innerHTML = photos.map((p,i)=>`
    <div class="tech-photo-thumb">
      <img src="${p.data}" onclick="openAttachmentPreview('${jsAttr(p.data)}','${jsAttr(p.nom||'photo.jpg')}')">
      <button type="button" onclick="removeTechPhoto(${i})">✕</button>
    </div>`).join('');
}
function addTechPhoto(input){
  const b = state.bonsCommande.find(x=>x.id===techModalCtx.bcId);
  if(!b) return;
  if(!b.technicienPhotos) b.technicienPhotos = [];
  const files = Array.from(input.files||[]);
  let remaining = files.length;
  if(!remaining) return;
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      b.technicienPhotos.push({ id: uid(), nom: file.name, data: ev.target.result });
      remaining--;
      if(remaining===0) renderTechModalPhotos(b);
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function removeTechPhoto(index){
  const b = state.bonsCommande.find(x=>x.id===techModalCtx.bcId);
  if(!b) return;
  b.technicienPhotos.splice(index,1);
  renderTechModalPhotos(b);
}
function setupTechDessinCanvas(b){
  const canvas = document.getElementById('techDessinCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#E23535'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  if(b.technicienDessin){
    const img = new Image();
    img.onload = ()=> ctx.drawImage(img,0,0,canvas.width,canvas.height);
    img.src = b.technicienDessin;
  }
  let drawing = false, last = null;
  function pos(ev){
    const r = canvas.getBoundingClientRect();
    const p = ev.touches ? ev.touches[0] : ev;
    return {x:(p.clientX-r.left)*(canvas.width/r.width), y:(p.clientY-r.top)*(canvas.height/r.height)};
  }
  function start(ev){ drawing = true; last = pos(ev); ev.preventDefault(); }
  function move(ev){ if(!drawing) return; const p = pos(ev); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last = p; ev.preventDefault(); }
  function end(){ if(drawing){ drawing = false; b.technicienDessin = canvas.toDataURL('image/png'); } }
  canvas.onmousedown = start; canvas.onmousemove = move;
  if(canvas._techMouseUpHandler) window.removeEventListener('mouseup', canvas._techMouseUpHandler);
  canvas._techMouseUpHandler = end;
  window.addEventListener('mouseup', end);
  canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
}
function clearTechDessin(){
  const canvas = document.getElementById('techDessinCanvas');
  if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  const b = state.bonsCommande.find(x=>x.id===techModalCtx.bcId);
  if(b) b.technicienDessin = null;
}
function togglePieceCommanderInput(checked){
  const input = document.getElementById('techModalPieceDetail');
  if(input) input.style.display = checked? 'block' : 'none';
}
async function saveTechnicienIntervention(){
  const b = state.bonsCommande.find(x=>x.id===techModalCtx.bcId);
  if(!b) return;
  b.technicienCommentaire = document.getElementById('techModalCommentaire').value;
  b.pieceACommander = document.getElementById('techModalPieceCommander').checked;
  b.pieceACommanderDetail = document.getElementById('techModalPieceDetail').value;
  const dateFaite = document.getElementById('techModalDateFaite').checked;
  if(techModalCtx.dayIso){
    const occ = (b.datesSupplementaires||[]).find(d=>d.date===techModalCtx.dayIso);
    if(occ) occ.fait = dateFaite;
  } else {
    b.dateOrigineFait = dateFaite;
  }
  if(bcInterventionFaite(b)) b.dateInterventionTerminee = todayISO();
  const r = await window.stSet('bonCommande:'+b.id, b);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  closeTechnicienInterventionModal();
  renderTab();
  showToast('Intervention enregistrée.', 'success');
}
let ajoutDateSupplCtx = null;
function openAjoutDateSupplModal(kind, id){
  ajoutDateSupplCtx = { kind, id };
  document.getElementById('ajoutDateSupplDate').value = '';
  document.getElementById('ajoutDateSupplDate').min = todayISO();
  document.getElementById('ajoutDateSupplHeure').value = '08:00';
  document.getElementById('ajoutDateSupplDuree').value = '1';
  document.getElementById('ajoutDateSupplModal').style.display = 'flex';
}
function closeAjoutDateSupplModal(){
  document.getElementById('ajoutDateSupplModal').style.display = 'none';
  ajoutDateSupplCtx = null;
}
async function confirmerAjoutDateSuppl(){
  if(!ajoutDateSupplCtx) return;
  const { kind, id } = ajoutDateSupplCtx;
  const dateVal = document.getElementById('ajoutDateSupplDate').value;
  const heureVal = document.getElementById('ajoutDateSupplHeure').value || '08:00';
  const dureeVal = parseInt(document.getElementById('ajoutDateSupplDuree').value,10) || 1;
  if(!dateVal){ showToast('Choisissez une date.'); return; }
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  if(!bc.datesSupplementaires) bc.datesSupplementaires = [];
  if(bc.datesSupplementaires.some(d=>d.date===dateVal) || dateVal===bc.datePlanifiee){ showToast('Cette date est déjà planifiée pour ce bon de commande.'); return; }
  bc.datesSupplementaires.push({ date: dateVal, heure: heureVal, duree: dureeVal });
  bc.datesSupplementaires.sort((a,b)=> a.date.localeCompare(b.date));
  const r = await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('bonCommande');
  closeAjoutDateSupplModal();
  renderTab();
  showToast(`Date ajoutée : ${fmtDate(dateVal)} de ${heureVal} (${dureeVal}h).`, 'success');
}
async function removeDateSupplementaire(kind, id, dateVal){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  bc.datesSupplementaires = (bc.datesSupplementaires||[]).filter(d=>d.date!==dateVal);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  await recharger('bonCommande');
  renderTab();
}
async function updateDateSupplChamp(kind, id, dateVal, champ, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, bcId } = resolved;
  const occ = (bc.datesSupplementaires||[]).find(d=>d.date===dateVal);
  if(!occ) return;
  occ[champ] = champ==='duree' ? (parseInt(value,10)||1) : value;
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  await recharger('bonCommande');
  renderTab();
}
function dragStartBC(ev, kind, id){
  if(state.currentRole==='technicien' || estSousTraitant()){ ev.preventDefault(); return; }
  const resolved = resolvePlanningItem(kind, id);
  /* Une affaire terminée ne se DÉPLACE pas. Mais une affaire sans date n'est
     pas sur le calendrier : l'y poser n'est pas la déplacer. Sans cette nuance,
     un bon revenu de « Pièces en commande » dont le technicien avait pointé sa
     journée restait bloqué dans « Non planifiés », impossible à replanifier —
     un cul-de-sac, puisque `metiersFait` se dérive des tâches et reste vrai. */
  if(resolved
     && schedField(resolved.bc, resolved.metierKey, 'datePlanifiee')
     && bcInterventionFaite(resolved.bc)){ ev.preventDefault(); return; }
  draggedItem = {kind, id};
  ev.dataTransfer.effectAllowed = 'move';
  try{ ev.dataTransfer.setData('text/plain', kind+':'+id); }catch(e){}
}
function readDraggedItem(ev){
  if(draggedItem) return draggedItem;
  const raw = ev.dataTransfer.getData('text/plain')||'';
  const idx = raw.indexOf(':');
  if(idx<0) return null;
  return { kind: raw.slice(0,idx), id: raw.slice(idx+1) };
}
function allowDropUnsched(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; }
function allowDropHour(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; ev.currentTarget.classList.add('drag-over'); }
async function dropOnHour(ev, dateISO, hour, assigneeField, assigneeValue){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  const info = readDraggedItem(ev);
  draggedItem = null;
  if(!info) return;

  /* Une tâche sans équipe ne pourra être clôturée que par le conducteur : le
     choix n'est pas optionnel. Quand le filtre en porte une, elle s'applique et
     le dépôt reste immédiat ; sinon on la demande, au lieu de refuser. */
  if(assigneeField && !assigneeValue){
    ouvrirChoixAssigne(info, assigneeField, dateISO, String(hour).padStart(2,'0')+':00');
    return;
  }
  await poserAuPlanning(info, dateISO, String(hour).padStart(2,'0')+':00', assigneeField, assigneeValue);
}

/** Écrit la planification sur le bon. L'équipe rejoint la tâche à sa création. */
async function poserAuPlanning(info, dateISO, heure, assigneeField, assigneeValue){
  const resolved = resolvePlanningItem(info.kind, info.id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, 'datePlanifiee', dateISO);
  setSchedField(bc, metierKey, 'datePlanifieeFin', dateISO);
  setSchedField(bc, metierKey, 'heurePlanifiee', heure);
  if(!schedField(bc, metierKey, 'dureeHeures')) setSchedField(bc, metierKey, 'dureeHeures', 1);
  if(assigneeField && assigneeValue){
    setSchedField(bc, metierKey, assigneeField, assigneeValue);
  }
  await window.stSet(planningKeyPrefix(info.kind)+bcId, bc);
  renderTab();
}

let choixAssigneCtx = null;
function ouvrirChoixAssigne(info, assigneeField, dateISO, heure){
  choixAssigneCtx = { info, assigneeField, dateISO, heure };
  const st = assigneeField === 'sousTraitant';
  document.getElementById('choixAssigneTitre').textContent = st ? 'Quel sous-traitant ?' : 'Quelle équipe ?';
  document.getElementById('choixAssigneAide').textContent = st
    ? "Le sous-traitant intervient sur cette date."
    : "Seuls les membres de cette équipe pourront déclarer les travaux faits.";
  document.getElementById('choixAssigneSelect').innerHTML = st
    ? sousTraitantSelectOptions('')
    : technicienSelectOptions('');
  document.getElementById('choixAssigneModal').style.display = 'flex';
}
function fermerChoixAssigne(){
  document.getElementById('choixAssigneModal').style.display = 'none';
  choixAssigneCtx = null;
}
async function confirmerChoixAssigne(){
  if(!choixAssigneCtx) return;
  const valeur = document.getElementById('choixAssigneSelect').value;
  if(!valeur){ showToast("Choisissez d'abord dans la liste."); return; }
  const { info, assigneeField, dateISO, heure } = choixAssigneCtx;
  fermerChoixAssigne();
  await poserAuPlanning(info, dateISO, heure, assigneeField, valeur);
}
async function dropUnsched(ev){
  ev.preventDefault();
  const info = readDraggedItem(ev);
  if(!info) return;
  const resolved = resolvePlanningItem(info.kind, info.id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, 'datePlanifiee', '');
  await window.stSet(planningKeyPrefix(info.kind)+bcId, bc);
  draggedItem = null;
  renderTab();
}
async function unscheduleBC(kind, id){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  if(bcInterventionFaite(resolved.bc)){ showToast('Cette intervention a été validée par le technicien, elle ne peut plus être modifiée depuis le planning.'); return; }
  const { bc, metierKey, bcId } = resolved;
  const nbDatesSuppl = !metierKey ? (bc.datesSupplementaires||[]).length : 0;
  if(nbDatesSuppl>0 && !confirm(`Ce bon de commande a aussi ${nbDatesSuppl} autre(s) date(s) planifiée(s) (via "+ Autre date"). Les retirer du planning va aussi supprimer ces dates-là. Continuer ?`)) return;
  setSchedField(bc, metierKey, 'datePlanifiee', '');
  if(!metierKey) bc.datesSupplementaires = [];
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
async function shiftBCUnJourPlusTot(kind, id){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  const debut = schedField(bc, metierKey, 'datePlanifiee');
  if(!debut) return;
  const fin = schedField(bc, metierKey, 'datePlanifieeFin');
  const isMultiJour = fin && fin !== debut;
  if(isMultiJour){
    setSchedField(bc, metierKey, 'datePlanifieeFin', debut);
    setSchedField(bc, metierKey, 'dureeDernierJour', null);
    setSchedField(bc, metierKey, 'heureDernierJour', null);
    await window.stSet(planningKeyPrefix(kind)+bcId, bc);
    renderTab();
    return;
  }
  setSchedField(bc, metierKey, 'datePlanifiee', '');
  setSchedField(bc, metierKey, 'datePlanifieeFin', '');
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  showToast('Chantier renvoyé dans "Non planifiés".', 'success', 2500);
  renderTab();
}
async function quickScheduleBC(kind, id, dateVal, assigneeField, assigneeValue){
  if(!dateVal) return;
  // Même règle qu'au glisser-déposer : on demande l'équipe plutôt que de refuser.
  if(assigneeField && !assigneeValue){
    ouvrirChoixAssigne({ kind, id }, assigneeField, dateVal, '08:00');
    return;
  }
  await poserAuPlanning({ kind, id }, dateVal, schedHeureOuDefaut(kind, id), assigneeField, assigneeValue);
}

/* Le sélecteur de date ne touche pas à l'heure déjà posée, contrairement au
   dépôt sur une case horaire qui la fixe. */
function schedHeureOuDefaut(kind, id){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return '08:00';
  return schedField(resolved.bc, resolved.metierKey, 'heurePlanifiee') || '08:00';
}
async function updateBCHeure(kind, id, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, 'heurePlanifiee', value);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
async function updateBCHeureDernierJour(kind, id, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, 'heureDernierJour', value);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
async function updateBCDuree(kind, id, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, 'dureeHeures', parseInt(value,10) || 1);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
async function updateBCDateFin(kind, id, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey, bcId } = resolved;
  const debut = schedField(bc, metierKey, 'datePlanifiee');
  setSchedField(bc, metierKey, 'datePlanifieeFin', value && value >= debut ? value : debut);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
async function updateBCAssignee(kind, id, field, value){
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  if(bcInterventionFaite(resolved.bc)){ showToast('Cette intervention a été validée par le technicien, elle ne peut plus être modifiée depuis le planning.'); renderTab(); return; }
  const { bc, metierKey, bcId } = resolved;
  setSchedField(bc, metierKey, field, value);
  await window.stSet(planningKeyPrefix(kind)+bcId, bc);
  renderTab();
}
let resizeState = null;
function startResizeCorner(ev, kind, id, isLastDay){
  ev.preventDefault();
  ev.stopPropagation();
  const resolved = resolvePlanningItem(kind, id);
  if(!resolved) return;
  const { bc, metierKey } = resolved;
  const cardEl = ev.target.closest('.planning-card-scheduled');
  const startDuree = isLastDay ? (schedField(bc, metierKey, 'dureeDernierJour') || PLANNING_HOURS.length) : (schedField(bc, metierKey, 'dureeHeures')||1);
  resizeState = {
    kind, id, mode: isLastDay ? 'cornerDernierJour' : 'corner', cardEl,
    startY: ev.clientY, startDuree, startHeure: isLastDay ? (schedField(bc, metierKey, 'heureDernierJour')||'08:00') : (schedField(bc, metierKey, 'heurePlanifiee')||'08:00'), previewDuree: startDuree,
    startEndDate: schedField(bc, metierKey, 'datePlanifieeFin') || schedField(bc, metierKey, 'datePlanifiee'), previewEndDate: schedField(bc, metierKey, 'datePlanifieeFin') || schedField(bc, metierKey, 'datePlanifiee')
  };
  document.body.classList.add('is-resizing-corner');
  if(cardEl) cardEl.classList.add('is-resize-active');
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.addEventListener('keydown', onResizeKeydown);
}
function computeNewDuree(startY, startDuree, startHeure, currentY){
  const sampleRow = document.querySelector('.planning-hour-row');
  const rowH = sampleRow ? sampleRow.getBoundingClientRect().height : 50;
  const deltaY = currentY - startY;
  const deltaRows = Math.round(deltaY / rowH);
  let newDuree = startDuree + deltaRows;
  newDuree = Math.max(1, Math.min(PLANNING_HOURS.length, newDuree));
  const pauseIdx = PLANNING_HOURS.indexOf(PLANNING_PAUSE_HOUR);
  if(pauseIdx >= 0){
    const startH = parseInt((startHeure||'08:00').split(':')[0],10);
    const startIdx = PLANNING_HOURS.indexOf(startH);
    if(startIdx>=0 && startIdx<pauseIdx && (startIdx+newDuree)>pauseIdx){
      newDuree += 1;
    }
  }
  return Math.min(PLANNING_HOURS.length, newDuree);
}
function findDayColAtX(x){
  const dayCols = document.querySelectorAll('.planning-daycol');
  for(const col of dayCols){
    const rect = col.getBoundingClientRect();
    if(x >= rect.left && x <= rect.right) return col;
  }
  return null;
}
function onResizeMove(ev){
  if(!resizeState) return;
  if(resizeState.mode === 'corner' || resizeState.mode === 'cornerDernierJour'){
    const newDuree = computeNewDuree(resizeState.startY, resizeState.startDuree, resizeState.startHeure, ev.clientY);
    if(newDuree !== resizeState.previewDuree && resizeState.cardEl){
      const rowExprStr = planningRowExpr();
      resizeState.cardEl.style.height = `calc(${newDuree} * ${rowExprStr} - 4px)`;
    }
    resizeState.previewDuree = newDuree;
    document.querySelectorAll('.planning-daycol.is-resize-target').forEach(el=>el.classList.remove('is-resize-target'));
    const col = findDayColAtX(ev.clientX);
    if(col){
      resizeState.previewEndDate = col.dataset.iso;
      col.classList.add('is-resize-target');
    }
  }
}
function onResizeKeydown(ev){
  if(ev.key !== 'Escape' || !resizeState) return;
  if(resizeState.cardEl){
    const rowExprStr = planningRowExpr();
    const originalDuree = resizeState.startDuree;
    resizeState.cardEl.style.height = `calc(${originalDuree} * ${rowExprStr} - 4px)`;
  }
  document.querySelectorAll('.planning-daycol.is-resize-target').forEach(el=>el.classList.remove('is-resize-target'));
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('keydown', onResizeKeydown);
  document.body.classList.remove('is-resizing-v', 'is-resizing-h', 'is-resizing-corner');
  if(resizeState.cardEl) resizeState.cardEl.classList.remove('is-resize-active');
  resizeState = null;
  showToast('Redimensionnement annulé.', 'success', 2000);
}
async function onResizeEnd(){
  if(!resizeState) return;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('keydown', onResizeKeydown);
  document.body.classList.remove('is-resizing-v', 'is-resizing-h', 'is-resizing-corner');
  document.querySelectorAll('.planning-daycol.is-resize-target').forEach(el=>el.classList.remove('is-resize-target'));
  const { kind, id, mode, preview, previewDuree, previewEndDate } = resizeState;
  resizeState = null;
  const resolved = resolvePlanningItem(kind, id);
  if(resolved){
    const { bc, metierKey, bcId } = resolved;
    const debut = schedField(bc, metierKey, 'datePlanifiee');
    if(mode==='corner'){
      setSchedField(bc, metierKey, 'dureeHeures', previewDuree);
      if(previewEndDate && previewEndDate >= debut){
        setSchedField(bc, metierKey, 'datePlanifieeFin', previewEndDate);
      }
      await window.stSet(planningKeyPrefix(kind)+bcId, bc);
    } else if(mode==='cornerDernierJour'){
      setSchedField(bc, metierKey, 'dureeDernierJour', previewDuree);
      if(previewEndDate && previewEndDate >= debut){
        setSchedField(bc, metierKey, 'datePlanifieeFin', previewEndDate);
      }
      await window.stSet(planningKeyPrefix(kind)+bcId, bc);
    }
  }
  renderTab();
}

function renderReglements(embedded){
  const factures = facturesDesReglements();
  if(estSousTraitant() && !factures.length) return '<div class="empty">Aucun règlement pour l\'instant — vos règlements apparaîtront ici une fois vos factures créées.</div>';
  if(state.reglementsClient){
    return renderReglementsClientDetail(state.reglementsClient, factures);
  }
  return `
    ${embedded? '' : '<div class="page-head"><h1>Règlements</h1></div>'}
    ${barreRecherche('reglementClient', 'Rechercher : client, n° de facture…')}
    <div id="liste-reglementClient">${listeDossiersReglementsHTML()}</div>
  `;
}

/** Les factures de la société, telles que l'écran Règlements les voit. */
function facturesDesReglements(){
  const estST = estSousTraitant();
  return state.factures.filter(f=>f.societeId===state.societeId && (estST
    ? (f.sousTraitantEmetteur && (!sousTraitantActuel() || f.sousTraitantEmetteur===sousTraitantActuel()))
    : !f.sousTraitantEmetteur));
}

const listeDossiersReglementsHTML = declarerListing('reglementClient',
  ()=> {
    const groups = {};
    facturesDesReglements().forEach(f=>{ (groups[f.client] = groups[f.client] || []).push(f); });
    return Object.keys(groups).sort().map(nom=>({ nom, factures: groups[nom] }));
  },
  list => list.map(({nom, factures: facturesDuClient})=>{
      let totalDu = 0, enRetard = false;
      facturesDuClient.forEach(f=>{
        const st = reglementStatutFacture(f);
        /* Le reste d'un avoir est un crédit, pas une dette : l'ajouter au total
           dû ferait grossir la créance du montant même qui l'éteint. */
        if(st.avoir) return;
        totalDu += st.reste;
        if(st.reste>0.01 && (joursDepuisEcheance(f)||0) > 0) enRetard = true;
      });
      const list = facturesDuClient;
      return `<div class="card" style="cursor:pointer;" onclick="openReglementsClient('${jsAttr(nom)}')">
        <div class="card-row">
          <div><div class="card-title">${esc(nom)}</div><div class="card-sub">${list.length} facture${list.length>1?'s':''}</div></div>
          <div style="text-align:right;"><div class="amount">${moneyDisplay(totalDu)}</div><div class="card-sub" style="margin-top:4px;">${totalDu>0.01? (enRetard? '<span class="badge danger">Retard</span>' : 'dû') : 'à jour'}</div></div>
        </div>
      </div>`;
    }).join('') || listeVide('reglementClient', 'Aucune facture pour cette société.', 'dossier'),
  /* Le dossier ne porte que le nom du client : sans les numéros de ses
     factures, taper « FAC-2026-0412 » ici ne ramènerait rien. */
  d => d.factures.map(f=>f.numero).filter(Boolean));

function openReglementsClient(nom){ state.reglementsClient = nom; state.reglementSelection = []; renderTab(); }
function closeReglementsClient(){ state.reglementsClient = null; state.reglementSelection = []; renderTab(); }
/** Les factures d'un client, les plus récentes d'abord. */
function facturesDuClientReglements(){
  return facturesDesReglements()
    .filter(f=>f.client===state.reglementsClient)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}

function renderReglementsClientDetail(nom, allFactures){
  const list = allFactures.filter(f=>f.client===nom).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const selection = state.reglementSelection || [];
  /* Le total de la sélection se calcule sur TOUTES les factures du client, et
     non sur celles que la recherche laisse voir : filtrer l'écran ne déselectionne
     rien, et la barre du bas doit continuer d'annoncer le bon montant. */
  const totalSelection = list.reduce((somme, f)=>{
    const st = reglementStatutFacture(f);
    return somme + (st.reste > 0.01 && selection.includes(f.id) ? st.reste : 0);
  }, 0);
  return `
    <div class="page-head"><h1>${esc(nom)}</h1><button class="btn" onclick="closeReglementsClient()">← Retour</button></div>
    ${barreRecherche('reglementFacture', 'Rechercher : n° de facture, montant, mode, référence…')}
    <div id="formZoneReglement">${state.formOpen.reglement? reglementForm(): ''}</div>
    <div id="liste-reglementFacture">${listeFacturesReglementsHTML()}</div>
    ${selection.length? `
    <div class="reglement-bulk-bar">
      <span>${selection.length} facture${selection.length>1?'s':''} sélectionnée${selection.length>1?'s':''} — Total : <b>${moneyDisplay(totalSelection)}</b></span>
      <button class="btn primary" onclick="openBulkReglementForm()">Règlement</button>
    </div>` : ''}
    ${state.formOpen.reglementBulk? renderBulkReglementModal(selection, list) : ''}
  `;
}

const listeFacturesReglementsHTML = declarerListing('reglementFacture',
  facturesDuClientReglements,
  list => {
    const selection = state.reglementSelection || [];
    return list.map(f=>{
      const st = reglementStatutFacture(f);
      const regs = reglementsForFacture(f.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      /* « Payable » veut dire « on peut y poser un encaissement ». Un avoir a un
         reste, mais ce reste est un CRÉDIT à donner : ni case à cocher, ni
         bouton « + Règlement », ni retard — on ne réclame pas un avoir. */
      const payable = st.reste > 0.01 && !st.avoir;
      return `<div class="card" ${payable? `style="cursor:pointer;" onclick="reglementCardClick(event,'${jsAttr(f.id)}')"` : ''}>
        <div class="card-row">
          <div style="display:flex; align-items:flex-start; gap:10px;">
            ${payable? `<input type="checkbox" style="margin-top:3px; width:17px; height:17px; flex-shrink:0;" ${selection.includes(f.id)?'checked':''} onchange="toggleReglementSelection('${jsAttr(f.id)}')">` : `<span style="width:17px; flex-shrink:0;"></span>`}
            <div><div class="card-title">${esc(f.numero)}</div><div class="card-sub">${fmtDate(f.date)}${f.echeance? ' · échéance '+fmtDate(f.echeance):''}</div></div>
          </div>
          <div style="text-align:right;"><div class="amount">${moneyDisplay(st.ttc)}</div><span class="badge ${st.cls}" style="margin-top:5px;display:inline-block;">${st.label}</span></div>
        </div>
        <div class="card-sub" style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">${st.avoir
            ? `Imputé : ${moneyDisplay(st.paye)} · <strong>Disponible : ${moneyDisplay(st.reste)}</strong>`
            : `Réglé : ${moneyDisplay(st.paye)} · Reste : ${moneyDisplay(st.reste)} ${delaiBadgeHTML(f, st.reste)}`}
          ${/* Le geste à l'endroit où on le cherche. Il n'existait que sur la
                carte de la liste des factures : dans cet écran-ci, où la facture
                et l'avoir se font face, rien ne permettait de les rapprocher. */''}
          ${(!st.avoir && peutReglerParAvoir(f))? `<button class="btn small" style="${payable?'':'margin-left:auto;'}" onclick="event.stopPropagation(); reglerParAvoir('${jsAttr(f.id)}')" title="Solder tout ou partie de cette facture avec un avoir du même client">🧾 Régler par un avoir</button>`:''}
          ${payable? `<button class="btn small primary" style="margin-left:auto;" onclick="event.stopPropagation(); ouvrirReglementFacture('${jsAttr(f.id)}')">+ Règlement</button>`:''}
        </div>
        ${regs.length? `<div class="card-sub" style="margin-top:10px; font-weight:600;">Historique des règlements</div>`:''}
        ${regs.map(r=>`
          <div class="card-sub" style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span>${fmtDate(r.date)} · ${esc(libelleModeReglement(r.mode))}${r.reference? ' ('+esc(r.reference)+')':''}</span>
            <span class="mono" style="white-space:nowrap;">${moneyDisplay(r.montant)}
              <button class="btn small ghost" style="padding:2px 7px; margin-left:6px;" title="Modifier ce règlement" onclick="event.stopPropagation(); editItem('reglement','${jsAttr(r.id)}')">✎</button>
              <button class="btn small danger" style="padding:2px 7px;" title="Supprimer ce règlement" onclick="event.stopPropagation(); deleteItem('reglement','${jsAttr(r.id)}')">✕</button></span>
          </div>`).join('')}
      </div>`;
    }).join('') || listeVide('reglementFacture', 'Aucune facture pour ce client.', 'facture');
  },
  /* Le montant et les règlements ne sont pas dans la facture : sans eux, on ne
     pourrait pas chercher « virement » ni le montant qu'on voit à l'écran. */
  f => {
    const st = reglementStatutFacture(f);
    return [moneyDisplay(st.ttc), moneyDisplay(st.reste), st.label,
      ...reglementsForFacture(f.id).map(r =>
        [libelleModeReglement(r.mode), r.reference, moneyDisplay(r.montant)].filter(Boolean).join(' '))];
  });
/**
 * Ouvre la saisie d'un règlement pour CETTE facture.
 *
 * Seul le règlement groupé existait, et il solde chaque facture de la sélection
 * en entier : un acompte, ou un virement qui ne couvre pas tout, n'avait aucun
 * chemin. Le formulaire unitaire était écrit mais rien ne l'ouvrait jamais.
 */
function ouvrirReglementFacture(factureId){
  openForm('reglement', { factureId });
}

function toggleReglementSelection(factureId){
  if(!state.reglementSelection) state.reglementSelection = [];
  const idx = state.reglementSelection.indexOf(factureId);
  if(idx>=0) state.reglementSelection.splice(idx,1);
  else state.reglementSelection.push(factureId);
  renderTab();
}
function reglementCardClick(ev, factureId){
  if(ev.target.closest('input, button')) return;
  toggleReglementSelection(factureId);
}
function openBulkReglementForm(){
  state.formOpen.reglementBulk = true;
  renderTab();
  /* La répartition lit le DOM : elle se peint une fois la fenêtre posée. */
  setTimeout(majRepartitionBulk, 0);
}
function closeBulkReglementForm(){
  state.formOpen.reglementBulk = false;
  renderTab();
}
/** Les factures de la sélection, dans la forme qu'attend la règle d'imputation. */
function facturesAImputer(selection, list){
  return list.filter(f=>selection.includes(f.id))
    .map(f=>({ id:f.id, numero:f.numero, date:f.date, reste: reglementStatutFacture(f).reste }));
}

/**
 * Le virement groupé.
 *
 * En SURIMPRESSION, et non ajouté au bas de la liste : là, il atterrissait
 * plusieurs écrans sous la barre de sélection restée collée en bas, et rien ne
 * semblait se passer au clic.
 *
 * Le montant est saisissable. Un virement qui ne couvre pas tout s'impute de la
 * plus ancienne facture à la plus récente — jusqu'ici l'écran soldait chacune
 * en entier, et un règlement partiel sur plusieurs factures n'avait aucun
 * chemin.
 */
function renderBulkReglementModal(selection, list){
  const cibles = facturesAImputer(selection, list);
  const total = window.arrondiCentime(cibles.reduce((s,f)=> s + f.reste, 0));
  const factures = list.filter(f=>selection.includes(f.id));
  return `
  <div class="view-modal" style="display:flex;" onclick="fermerBulkSiFond(event)">
    <div class="view-modal-panel" style="max-width:620px; padding:22px; font-family:inherit; font-size:14px;">
      <button class="view-modal-close" onclick="closeBulkReglementForm()">✕</button>
      <h3 style="margin:0 0 4px;">Règlement groupé — ${cibles.length} facture${cibles.length>1?'s':''}</h3>
      <div class="card-sub" style="margin-bottom:14px;">Total dû : <b>${moneyDisplay(total)}</b></div>
      <div class="field-grid">
        <div class="field"><label>Montant reçu</label>
          <input type="number" step="0.01" min="0" id="rb_montant" value="${total.toFixed(2)}" oninput="majRepartitionBulk()"></div>
        <div class="field"><label>Date</label><input type="date" id="rb_date" value="${todayISO()}"></div>
        <div class="field"><label>Mode de règlement</label><select id="rb_mode">${optionsModeReglementHTML(factures[0] && factures[0].modePaiement)}</select></div>
        <div class="field"><label>Référence</label><input type="text" id="rb_reference" placeholder="N° chèque, réf. virement…"></div>
      </div>
      ${/* La répartition se voit AVANT de valider : c'est elle qu'on accepte,
           pas un montant global dont on devine l'effet. */''}
      <div class="section-title" style="margin-top:6px;">Répartition</div>
      <div id="rb_repartition"></div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn primary" id="rb_valider" onclick="saveBulkReglement()">Enregistrer le règlement</button>
        <button class="btn ghost" onclick="closeBulkReglementForm()">Annuler</button>
      </div>
    </div>
  </div>`;
}

/* Le fond ferme, le panneau non. */
function fermerBulkSiFond(ev){
  if(ev.target === ev.currentTarget) closeBulkReglementForm();
}

/** Ce que le montant saisi donnerait, facture par facture. */
function majRepartitionBulk(){
  const zone = document.getElementById('rb_repartition');
  if(!zone) return;
  const cibles = facturesAImputer(state.reglementSelection || [], state.factures);
  const montant = window.arrondiCentime((document.getElementById('rb_montant')||{}).value);
  const refus = window.refusImputation(montant, cibles);
  const bouton = document.getElementById('rb_valider');
  if(bouton) bouton.disabled = !!refus;

  if(refus){ zone.innerHTML = `<div class="bc-attente-message">${esc(refus)}</div>`; return; }

  const parts = window.imputer(montant, cibles);
  const servies = new Set(parts.map(p=>p.id));
  zone.innerHTML = cibles.map(f=>{
    const p = parts.find(x=>x.id===f.id);
    if(!p) return `<div class="summary-row" style="opacity:.5;"><span>${esc(f.numero||'')} <small>— rien cette fois</small></span><b>—</b></div>`;
    const solde = p.resteApres <= 0.004;
    return `<div class="summary-row"><span>${esc(f.numero||'')} ${solde
        ? '<small style="color:var(--success);">soldée</small>'
        : `<small style="color:var(--text-dim);">reste ${moneyDisplay(p.resteApres)}</small>`}</span><b>${moneyDisplay(p.montant)}</b></div>`;
  }).join('') + (servies.size < cibles.length
      ? `<div class="card-sub" style="margin-top:6px;">Les factures non servies restent dues : le virement ne va pas jusqu'à elles.</div>`
      : '');
}
async function saveBulkReglement(){
  const selection = state.reglementSelection || [];
  const cibles = facturesAImputer(selection, state.factures);
  const montant = window.arrondiCentime((document.getElementById('rb_montant')||{}).value);

  /* Le refus et son message viennent de la règle : l'écran ne redécide pas de
     ce qui est acceptable. */
  const refus = window.refusImputation(montant, cibles);
  if(refus){ alert(refus); return; }

  const date = document.getElementById('rb_date').value || todayISO();
  const mode = document.getElementById('rb_mode').value;
  const reference = document.getElementById('rb_reference').value;

  /* Un règlement par facture, du montant imputé — et non du reste dû : c'est
     ce qui permet qu'un virement partiel se répartisse au lieu de tout solder.
     La référence commune les rattache au même mouvement bancaire. */
  const parts = window.imputer(montant, cibles);
  for(const part of parts){
    const id = uid();
    const obj = { id, societeId: state.societeId, factureId: part.id,
      createdAt: new Date().toISOString(), date, montant: part.montant, mode, reference };
    const r = await window.stSet('reglement:'+id, obj);
    if(!r){ showToast(saveFailedMessage()); return; }
  }
  await recharger('reglement', 'facture');
  for(const part of parts){ await maybeMarkFacturePayee(part.id); }
  state.reglementSelection = [];
  state.formOpen.reglementBulk = false;
  const soldees = parts.filter(x=>x.resteApres <= 0.004).length;
  showToast(`${moneyDisplay(montant)} enregistré${parts.length>1? ' sur '+parts.length+' factures':''} — ${soldees} soldée${soldees>1?'s':''}.`, 'success');
  renderTab();
}
/**
 * Le moyen de règlement, en clair.
 *
 * Les règlements d'avant stockent le libellé français — « Virement », « CB » —
 * ceux d'aujourd'hui le code de l'énumération. Les deux doivent se lire, et
 * aucun ne doit être réécrit : une reprise en masse sur des écritures
 * comptables ne se justifie pas pour un affichage.
 */
function libelleModeReglement(mode){
  const brut = String(mode || '').trim();
  if(!brut) return '—';
  const connu = (window.MODES_REGLEMENT || []).find(m => m.code === brut);
  return connu ? connu.libelle : brut;
}

/** La facture visée par le formulaire de règlement, telle qu'il l'affiche. */
function factureDuReglement(){
  const sel = document.getElementById('r_factureId');
  const id = sel ? sel.value : state.editing.factureId;
  return state.factures.find(f=>f.id===id) || null;
}

/**
 * Ce que la facture doit encore encaisser, en excluant le règlement en cours
 * de modification : sans cela son ancien montant se compte deux fois et le
 * plafond de saisie est amputé de ce qu'on corrige.
 */
function resteDeLaFacture(facture, idModifie){
  if(!facture) return 0;
  return window.resteAPayer(computeDocTotals(facture).ttc, reglementsForFacture(facture.id), idModifie || null);
}

/** Le rappel sous le champ montant : réglé, reste, et ce qui est proposé. */
function majAideReglement(){
  const aide = document.getElementById('r_aide');
  if(!aide) return;
  const f = factureDuReglement();
  if(!f){ aide.textContent = ''; return; }
  const ttc = computeDocTotals(f).ttc;
  const regs = reglementsForFacture(f.id);
  const paye = window.totalRegle(regs, state.editing.id || null);
  const reste = resteDeLaFacture(f, state.editing.id);
  aide.textContent = `Total ${money(ttc)} · déjà réglé ${money(paye)} · reste ${money(reste)}`;
}

/** Changement de facture : le montant proposé et le mode suivent. */
function changerFactureDuReglement(){
  const f = factureDuReglement();
  const montant = document.getElementById('r_montant');
  const mode = document.getElementById('r_mode');
  if(montant) montant.value = f ? String(resteDeLaFacture(f, state.editing.id)) : '';
  if(mode && f && f.modePaiement) mode.value = window.modeReglementRetenu(f.modePaiement);
  majAideReglement();
}

function reglementForm(){
  const e = state.editing;
  /* Les avoirs sont écartés de ce sélecteur : leur total est négatif, le reste
     à payer y tombe donc à zéro et ils s'affichaient « soldée » — on pouvait
     enregistrer un encaissement SUR un avoir. Un avoir ne s'encaisse pas, il
     s'impute : c'est « Régler par un avoir », depuis la facture. */
  const factures = state.factures.filter(f=>f.societeId===state.societeId && !window.estAvoir(f.typeDocument));
  const facture = state.factures.find(f=>f.id===e.factureId) || factures[0] || null;
  /* Le montant part sur le reste à payer : c'est le cas courant — on encaisse
     ce qui est dû — et il reste modifiable pour un acompte ou un versement
     partiel. Sur une modification, on garde le montant saisi. */
  const montantPropose = e.id ? e.montant : (facture ? resteDeLaFacture(facture, null) : '');
  /* Le mode vient de la facture, qui le tient du client : c'est presque
     toujours celui-là, et le retaper à chaque encaissement est une corvée. */
  /* Le défaut vient de la règle, plus d'un littéral : il était écrit ici ET
     dans `regles-efacture`, et seule la copie d'ici servait — la constante
     n'était posée sur `window` par personne. */
  const modeCourant = e.mode || (facture && facture.modePaiement ? window.modeReglementRetenu(facture.modePaiement) : window.MODE_REGLEMENT_DEFAUT);
  setTimeout(majAideReglement, 0);
  return `
  <div class="form-panel">
    <h3>${e.id?'Modifier le règlement':'Nouveau règlement'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Facture</label><select id="r_factureId" onchange="changerFactureDuReglement()">${factures.map(f=>{
        const st = reglementStatutFacture(f);
        return `<option value="${f.id}" ${f.id===e.factureId?'selected':''}>${esc(f.numero)} — ${esc(f.client)} (${money(st.ttc)}${st.reste>0.004? ' · reste '+money(st.reste):' · soldée'})</option>`;
      }).join('')}</select></div>
      <div class="field"><label>Date</label><input type="date" id="r_date" value="${e.date||todayISO()}"></div>
      <div class="field"><label>Montant</label>
        <input type="number" step="0.01" min="0" id="r_montant" value="${montantPropose===''?'':esc(montantPropose)}" oninput="majAideReglement()"></div>
      <div class="field"><label>Mode de règlement</label><select id="r_mode">${optionsModeReglementHTML(modeCourant)}</select></div>
      <div class="field"><label>Référence</label><input type="text" id="r_reference" value="${esc(e.reference)}" placeholder="N° chèque, réf. virement…"></div>
      <div class="field full"><small id="r_aide" class="card-sub"></small></div>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn primary" onclick="saveReglement()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('reglement')">Annuler</button>
    </div>
  </div>`;
}
async function saveReglement(){
  const e = state.editing;
  const factureId = document.getElementById('r_factureId').value;
  if(!factureId){ alert('Sélectionnez une facture.'); return; }
  const facture = state.factures.find(f=>f.id===factureId);
  if(!facture){ alert('Facture introuvable.'); return; }

  /* Le refus et son explication viennent de la règle : un message écrit ici
     finirait par dire autre chose que ce que la règle décide. En modification,
     le règlement en cours est écarté du calcul du reste — sinon corriger 500
     en 700 se heurterait à un plafond qui compte encore les 500. */
  const montant = window.arrondiCentime(document.getElementById('r_montant').value);
  const refus = window.refusReglement({
    montant,
    ttc: computeDocTotals(facture).ttc,
    reglements: reglementsForFacture(factureId),
    idModifie: e.id || null,
  });
  if(refus){ alert(refus); return; }

  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, factureId, createdAt: e.createdAt || new Date().toISOString(),
    date: document.getElementById('r_date').value || todayISO(),
    montant, mode: document.getElementById('r_mode').value,
    reference: document.getElementById('r_reference').value };
  const r = await window.stSet('reglement:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('reglement', 'facture');
  await maybeMarkFacturePayee(factureId);
  closeForm('reglement');
}
async function maybeMarkFacturePayee(factureId){
  await syncFactureStatut(factureId);
}
async function syncFactureStatut(factureId){
  const facture = state.factures.find(f=>f.id===factureId);
  if(!facture) return;
  const st = reglementStatutFacture(facture);
  /* Le partiel était rangé en « envoyée » : la facture disparaissait des
     compteurs d'impayés et du montant dû du tableau de bord. Une facture
     réglée à moitié est due. */
  const newStatut = window.statutEnBase(st.cle);
  if(facture.statut !== newStatut){
    facture.statut = newStatut;
    await window.stSet('facture:'+factureId, facture);
    await recharger('facture');
  }
}

/* ---------- Interventions (parcours en 4 étapes) ---------- */
function renderInterventions(){
  const estST = estSousTraitant();
  const list = state.interventions.filter(i=>i.societeId===state.societeId && (estST ? (i.sousTraitantEmetteur && (!sousTraitantActuel() || i.sousTraitantEmetteur===sousTraitantActuel())) : !i.sousTraitantEmetteur));
  return `
    <div class="page-head"><h1>Rapports / recherche de fuite</h1>${state.formOpen.intervention? '' : '<button class="btn primary" onclick="openForm(\'intervention\')">+ Nouveau rapport</button>'}</div>
    ${state.formOpen.intervention ? '' : `<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
      <input type="text" id="interventionSearchInput" style="flex:1; min-width:220px;" value="${esc(state.interventionSearch||'')}" placeholder="Rechercher" oninput="filterInterventionsList(this.value)" onkeydown="searchEnterCycle(event,'intervention')">
      <select style="width:auto; min-width:180px;" onchange="filterInterventionConducteur(this.value)">${conducteurFilterOptions(state.interventionConducteurFilter)}</select>
      <select style="width:auto; min-width:170px;" onchange="filterInterventionLogement(this.value)">${logementFilterOptions(state.interventionLogementFilter)}</select>
    </div>`}
    <div id="formZoneIntervention">${state.formOpen.intervention? interventionForm(): ''}</div>
    <div id="interventionListZone">${renderInterventionsListHTML(list)}</div>
  `;
}
function interventionMatchesSearch(i, q){
  return !q || window.multiWordMatch(interventionSearchHaystack(i), q);
}
function filterInterventionsList(value){
  state.interventionSearch = value;
  const zone = document.getElementById('interventionListZone');
  if(zone) zone.innerHTML = renderInterventionsListHTML(state.interventions.filter(i=>i.societeId===state.societeId));
}
function filterInterventionConducteur(value){
  state.interventionConducteurFilter = value;
  const zone = document.getElementById('interventionListZone');
  if(zone) zone.innerHTML = renderInterventionsListHTML(state.interventions.filter(i=>i.societeId===state.societeId));
}
function filterInterventionLogement(value){
  state.interventionLogementFilter = value;
  const zone = document.getElementById('interventionListZone');
  if(zone) zone.innerHTML = renderInterventionsListHTML(state.interventions.filter(i=>i.societeId===state.societeId));
}
function renderInterventionsListHTML(list){
  const q = (state.interventionSearch||'').trim().toLowerCase();
  const cf = state.interventionConducteurFilter||'';
  const lf = state.interventionLogementFilter||'';
  const filtered = list.filter(i=>interventionMatchesSearch(i, q) && (!cf || i.conducteur===cf) && (!lf || i.logementStatut===lf));
  return filtered.map(i=>{
      const devisLies = state.devis.filter(d=>d.interventionId===i.id);
      const facturesLiees = state.factures.filter(f=>f.interventionId===i.id);
      const bonCommandeOrigine = i.bonCommandeId ? state.bonsCommande.find(b=>b.id===i.bonCommandeId) : null;
      return `
      <div class="card" id="intervention-card-${i.id}" style="cursor:pointer;" onclick="cardRowClick(event,'intervention','${jsAttr(i.id)}')"><div class="card-row">
        <div style="flex:1; min-width:0;"><div class="card-title">${esc(i.client)}</div>
        <div class="card-sub"><span class="numref-lg">${esc(i.numero||'')}</span> · ${fmtDate(i.date)}${i.heure? ' à '+esc(i.heure):''}${i.interlocuteur? ' · 👤 '+esc(i.interlocuteur):''}${i.conducteur? ' · 🦺 '+esc(i.conducteur):''}</div>
        <div class="card-sub">${i.photos&&i.photos.length? i.photos.length+' photo'+(i.photos.length>1?'s':'') : ''}</div>
        ${locataireCardLine(i)}
        ${devisLies.length? `<div class="card-sub">Devis lié${devisLies.length>1?'s':''} : ${devisLies.map(d=>`<a href="javascript:void(0)" onclick="goToDevis('${jsAttr(d.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(d.numero)}</a>`).join(', ')}</div>`:''}
        ${facturesLiees.length? `<div class="card-sub">Facture${facturesLiees.length>1?'s':''} liée${facturesLiees.length>1?'s':''} : ${facturesLiees.map(f=>`<a href="javascript:void(0)" onclick="goToFacture('${jsAttr(f.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(f.numero)}</a>`).join(', ')}</div>`:''}
        ${bonCommandeOrigine? `<div class="card-sub">Bon de commande lié : <a href="javascript:void(0)" onclick="goToBonCommande('${jsAttr(bonCommandeOrigine.id)}')" style="color:var(--accent-2); text-decoration:underline;">${esc(bonCommandeOrigine.numeroBC)}</a></div>`:''}
        </div>
        <div style="display:flex; gap:6px; align-items:center; align-self:center; flex-shrink:0;">${logementBadge(i.logementStatut)}<span class="badge ${badgeClass(i.statut)}">${esc(i.statut)}</span></div>
      </div>
      ${i.rapport && i.rapport.constatations? `<div style="margin-top:8px; font-size:13px; color:var(--text-dim);">${esc(i.rapport.constatations)}</div>`:''}
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="editItem('intervention','${jsAttr(i.id)}')">Modifier</button>
        ${devisLies.length? '' : `<button class="btn small" onclick="transformerInterventionEn('devis','${jsAttr(i.id)}')">Transformer en devis</button>`}
        ${facturesLiees.length? '' : `<button class="btn small" onclick="transformerInterventionEn('facture','${jsAttr(i.id)}')">Transformer en facture</button>`}
        <button class="btn small" onclick="printInterventionDocument('${jsAttr(i.id)}')">Imprimer / PDF</button>
        ${bonCommandeOrigine? `<button class="btn small ghost" onclick="event.stopPropagation(); toggleLienZone('intervention:${jsAttr(i.id)}')">🔗 Modifier le lien BC</button><button class="btn small ghost" onclick="event.stopPropagation(); delierLien('${jsAttr(i.id)}')" title="Retirer le lien entre ce rapport et son bon de commande">✂️ Délier</button>` : `<button class="btn small ghost" onclick="event.stopPropagation(); toggleLienZone('intervention:${jsAttr(i.id)}')">🔗 Lier un bon de commande</button>`}
        <button class="btn small danger" onclick="deleteItem('intervention','${jsAttr(i.id)}')">Supprimer</button>
      </div>
      ${state.lienOuvert==='intervention:'+i.id? `<div style="margin-top:8px;" onclick="event.stopPropagation()">${lienWidgetHTML('intervention', i.id, i.client)}</div>`:''}
      </div>`;
    }).join('') || '<div class="empty">Aucun rapport pour cette société.</div>';
}
function interventionForm(){
  const e = state.editing;
  return `
  <div class="form-panel wizard-panel">
    ${stepIndicatorHTML(e.step||1)}
    <div id="wizardBody">${renderWizardStep(e.step||1)}</div>
  </div>`;
}
function stepIndicatorHTML(current){
  const steps = [{n:1,label:'Infos'},{n:2,label:'Contrôles'},{n:3,label:'Photos'},{n:4,label:'Rapport'}];
  return `<div class="step-indicator">${steps.map((s,idx)=>(idx>0?'<div class="step-line"></div>':'')+`
    <div class="step-item ${s.n===current?'active':''} ${s.n<current?'done':''}" onclick="goStep(${s.n})">
      <div class="step-circle">${s.n}</div><div class="step-label">${s.label}</div>
    </div>`).join('')}</div>`;
}
function renderWizardStep(n){
  const e = state.editing;
  if(n===1) return stepInfosHTML(e);
  if(n===2) return stepControlesHTML(e);
  if(n===3) return stepPhotosHTML(e);
  if(n===4) return stepRapportHTML(e);
  return '';
}
function goStep(n){
  state.editing.step = n;
  const panel = document.querySelector('.wizard-panel');
  if(panel){
    const ind = panel.querySelector('.step-indicator');
    if(ind) ind.outerHTML = stepIndicatorHTML(n);
    const body = panel.querySelector('#wizardBody');
    if(body) body.innerHTML = renderWizardStep(n);
  }
  if(n===3) setTimeout(initSignaturePad, 30);
}
function wizardNav(step){
  return `<div class="form-actions-sticky" style="justify-content:space-between; flex-wrap:wrap;">
    <div>${step>1? `<button class="btn ghost" onclick="goStep(${step-1})">← Précédent</button>` : `<button class="btn ghost" onclick="closeForm('intervention')">Annuler</button>`}</div>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">${step<4? `<button class="btn primary" onclick="goStep(${step+1})">Suivant →</button>` : `
      <button class="btn" onclick="saveIntervention(false)">Enregistrer le rapport</button>
      <button class="btn primary" onclick="saveIntervention(true)">Enregistrer et créer un devis</button>
    `}</div>
  </div>`;
}
function setEditing(field, value){ state.editing[field] = value; }
function toggleBox(id){ const el = document.getElementById(id); if(!el) return; el.style.display = (el.style.display === 'none' ? 'contents' : 'none'); }
function toggleOccupantField(selectEl, occupantFieldId, communeFieldId, vacantFieldId, numeroFieldId, etageFieldId){
  const val = selectEl.value;
  const showOccupant = val === 'occupé';
  const occEl = document.getElementById(occupantFieldId);
  if(occEl) occEl.style.display = showOccupant ? '' : 'none';
  if(etageFieldId){
    const showEtage = (val === 'occupé' || val === 'vacant');
    const etEl = document.getElementById(etageFieldId);
    if(etEl) etEl.style.display = showEtage ? '' : 'none';
  }
  if(communeFieldId){
    const showCommune = val === 'commune';
    const comEl = document.getElementById(communeFieldId);
    if(comEl) comEl.style.display = showCommune ? '' : 'none';
  }
  if(vacantFieldId){
    const showVacant = val === 'vacant';
    const vacEl = document.getElementById(vacantFieldId);
    if(vacEl) vacEl.style.display = showVacant ? '' : 'none';
  }
  if(numeroFieldId){
    const showNumero = (val === 'occupé' || val === 'vacant');
    const numEl = document.getElementById(numeroFieldId);
    if(numEl) numEl.style.display = showNumero ? '' : 'none';
  }
}
function setControle(key, value){ if(!state.editing.controles) state.editing.controles={}; state.editing.controles[key]=value; }
function setRapportField(field, value){ if(!state.editing.rapport) state.editing.rapport={}; state.editing.rapport[field]=value; }

function stepInfosHTML(e){
  return `
    <div class="field-grid">
      <div class="field"><label>Client</label><select id="f_client" onchange="setEditing('client',this.value); refreshInterlocuteurSelect(this,'f_interlocuteurInter'); refreshBCLieSelectInter(this.value);">${clientSelectOptions(e.client)}</select></div>
      <div class="field"><label>Interlocuteur</label><select id="f_interlocuteurInter" onchange="setEditing('interlocuteur',this.value)">${interlocuteurOptions(e.client, e.interlocuteur)}</select></div>
      <div class="field"><label>Bon de commande lié (si applicable)</label><select id="f_bonCommandeIdInter" onchange="setEditing('bonCommandeId',this.value||null)">${bcSelectOptionsPourIntervention(e.client, e.bonCommandeId)}</select></div>
      <div class="field full" style="margin-bottom:2px;"><button type="button" class="btn small ghost" onclick="toggleBox('locataireBoxInter')">+ Le locataire est différent du client</button></div>
      <div id="locataireBoxInter" style="display:${(e.occupant||e.adresseLocataire||e.logementStatut)?'contents':'none'};">
        <div class="field"><label>Type</label><select id="f_logementStatutInter" onchange="setEditing('logementStatut',this.value); toggleOccupantField(this,'occupantFieldInter','communeFieldInter','vacantFieldInter','numeroFieldInter','etageFieldInter');">${logementOptions(e.logementStatut)}</select></div>
        <div class="field full" id="communeFieldInter" style="display:${e.logementStatut==='commune'?'':'none'};"><label>Précision (partie commune)</label><input type="text" value="${esc(e.precisionCommune)}" placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…" oninput="setEditing('precisionCommune',this.value)"></div>
        <div class="field full" id="vacantFieldInter" style="display:${e.logementStatut==='vacant'?'':'none'};"><label>Ancien locataire</label><input type="text" value="${esc(e.ancienLocataire)}" placeholder="Ex : M. Dupont" oninput="setEditing('ancienLocataire',this.value)"></div>
        <div class="field" id="occupantFieldInter" style="display:${e.logementStatut==='occupé'?'':'none'};"><label>Locataire</label><input type="text" id="f_occupant" value="${esc(e.occupant)}" oninput="setEditing('occupant',this.value)"></div>
        <div class="address-trio">
          <div class="field" style="position:relative;"><label>Lieu d'intervention</label><input type="text" id="f_adresseLocataire" autocomplete="off" value="${esc(e.adresseLocataire)}" placeholder="Laisser vide si identique à l'adresse client" data-suggest="fLieuSuggestions" oninput="setEditing('adresseLocataire',this.value); searchAdresse(this, {adresse:'f_adresseLocataire', codePostal:'f_codePostal', ville:'f_ville'})" onblur="setTimeout(()=>{const b=document.getElementById('fLieuSuggestions'); if(b) b.style.display='none';},150)"><div id="fLieuSuggestions" class="suggest-box"></div></div>
          <div class="field"><label>Code postal</label><input type="text" id="f_codePostal" autocomplete="off" maxlength="5" inputmode="numeric" value="${esc(e.codePostal)}" oninput="setEditing('codePostal',this.value); lookupVilleParCodePostal(this.value,'f_ville')"></div>
          <div class="field"><label>Ville</label><input type="text" id="f_ville" autocomplete="off" value="${esc(e.ville)}" oninput="setEditing('ville',this.value)"></div>
        </div>
        <div class="field" id="etageFieldInter" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>Étage</label><input type="text" value="${esc(e.etage)}" placeholder="RDC, 1er, 2e…" oninput="setEditing('etage',this.value)"></div>
        <div class="field" id="numeroFieldInter" style="display:${(e.logementStatut==='occupé'||e.logementStatut==='vacant')?'':'none'};"><label>N° de logement</label><input type="text" value="${esc(e.numeroLogement)}" placeholder="Ex : 12, Appt 3B" oninput="setEditing('numeroLogement',this.value)"></div>
      </div>
      <div class="field"><label>Date</label><input type="date" value="${e.date||todayISO()}" oninput="setEditing('date',this.value)"></div>
      <div class="field"><label>Conducteur de travaux</label><select onchange="setEditing('conducteur',this.value)">${conducteurSelectOptions(e.conducteur)}</select></div>
      <div class="field"><label>Heure</label><select onchange="setEditing('heure',this.value)">${heureOptions(e.heure)}</select></div>
      <div class="field"><label>Type d'intervention</label><select onchange="setEditing('typePanne',this.value)"><option value="">— Choisir —</option>${METIERS.map(m=>`<option value="${m.value}" ${m.value===e.typePanne?'selected':''}>${m.label}</option>`).join('')}</select></div>
    </div>
    ${wizardNav(1)}
  `;
}
function stepControlesHTML(e){
  const items = CONTROLES_PAR_METIER[e.typePanne];
  if(!items){
    return `
      <div class="empty">Choisissez d'abord un type d'intervention (Plomberie, Électricité, Étanchéité) à l'étape "Infos" pour afficher les points de contrôle correspondants.</div>
      ${wizardNav(2)}
    `;
  }
  return `
    <div class="controles-list">${items.map(c=>{
      const checked = !!(e.controles && e.controles[c.key]);
      let row = `<label class="controle-item"><span>${esc(c.label)}</span><input type="checkbox" ${checked?'checked':''} onchange="setControle('${jsAttr(c.key)}', this.checked); toggleAutreTexte(this,'${jsAttr(c.key)}');"></label>`;
      if(c.key === 'autre'){
        row += `<div class="field full" id="autreTexteBox" style="display:${checked?'':'none'}; margin:-4px 0 12px;"><input type="text" value="${esc(e.controleAutreTexte)}" placeholder="Précisez le contrôle…" oninput="setEditing('controleAutreTexte', this.value)"></div>`;
      }
      return row;
    }).join('')}</div>
    ${wizardNav(2)}
  `;
}
function toggleAutreTexte(checkboxEl, key){
  if(key !== 'autre') return;
  const box = document.getElementById('autreTexteBox');
  if(box) box.style.display = checkboxEl.checked ? '' : 'none';
}
function stepPhotosHTML(e){
  const noOccupant = (e.logementStatut === 'vacant' || e.logementStatut === 'commune');
  return `
    <div class="field full">
      <label>Photos de l'intervention (3 maximum)</label>
      <input type="file" id="photoFileInput" accept="image/*" multiple style="display:none;" onchange="handlePhotoFiles(this.files); this.value='';">
      <div class="photo-grid">${photoThumbsHTML(e.photos||[])}</div>
    </div>
    ${noOccupant? '' : `
    <div class="field full" style="margin-top:16px;">
      <label>Signature client</label>
      <div class="sig-wrap"><canvas id="sigCanvas" width="500" height="150"></canvas></div>
      <button class="btn small" style="margin-top:8px;" onclick="clearSignature('sigCanvas','signature')">Effacer la signature</button>
    </div>`}
    <div class="field full" style="margin-top:16px;">
      <label>Signature du technicien</label>
      <div class="sig-wrap"><canvas id="sigCanvasTech" width="500" height="150"></canvas></div>
      <button class="btn small" style="margin-top:8px;" onclick="clearSignature('sigCanvasTech','signatureTechnicien')">Effacer la signature</button>
    </div>
    ${wizardNav(3)}
  `;
}
function photoThumbHTMLAvecCategorie(p, removeFnName){
  return `<div class="photo-thumb photo-thumb-${p.categorie||''}">
    <img src="${p.dataUrl}" onclick="openPhotoAnnotationModal('${jsAttr(p.id)}','photos','dataUrl')" style="cursor:pointer;" title="Cliquer pour annoter (flèche, carré)">
    <button class="photo-remove-btn" onclick="${removeFnName}('${jsAttr(p.id)}')">✕</button>
    <button class="photo-duplicate-btn" onclick="dupliquerPhoto('${jsAttr(p.id)}','photos')" title="Dupliquer cette photo">⧉</button>
    ${p.categorie? `<span class="photo-categorie-badge photo-categorie-${p.categorie}">${p.categorie==='constatation'?'Constatation':'Préconisation'}</span>`:''}
    <div class="photo-categorie-choix">
      <button class="photo-cat-btn photo-cat-constatation" onclick="setPhotoCategorie('${jsAttr(p.id)}','constatation','photos')" title="Marquer comme photo de constatation">🔴 Constat.</button>
      <button class="photo-cat-btn photo-cat-preco" onclick="setPhotoCategorie('${jsAttr(p.id)}','preconisation','photos')" title="Marquer comme photo de préconisation">🟢 Préco</button>
    </div>
  </div>`;
}
function dupliquerPhoto(photoId, arrayField){
  const arr = state.editing[arrayField] || [];
  const idx = arr.findIndex(p=>p.id===photoId);
  if(idx===-1) return;
  const copie = JSON.parse(JSON.stringify(arr[idx]));
  copie.id = uid();
  arr.splice(idx+1, 0, copie);
  if(state.editing.type==='bonCommande') refreshBCPhotosUI();
  else refreshPhotosUI();
}
function photoThumbsHTML(photos){
  const thumbs = (photos||[]).map(p=>photoThumbHTMLAvecCategorie(p, 'removePhoto')).join('');
  const addTile = (photos||[]).length < 3 ? `<div class="photo-add" onclick="document.getElementById('photoFileInput').click()" title="Ajouter une photo">+</div>` : '';
  return thumbs + addTile;
}
function setPhotoCategorie(photoId, categorie, arrayField){
  const arr = state.editing[arrayField] || [];
  const photo = arr.find(p=>p.id===photoId);
  if(!photo) return;
  photo.categorie = photo.categorie===categorie ? null : categorie;
  if(arrayField==='photos' && state.editing.type==='bonCommande') refreshBCPhotosUI();
  else refreshPhotosUI();
}
function stepRapportHTML(e){
  const r = e.rapport || {};
  return `
    <button class="btn primary" id="genRapportBtn" onclick="generateRapportIA()">✨ Générer / améliorer avec l'IA</button>
    <div class="field full" style="margin-top:16px;"><label>Constatations</label><textarea id="rap_constatations" oninput="setRapportField('constatations',this.value)">${esc(r.constatations)}</textarea></div>
    <div class="field full" style="margin-top:16px;"><label>Préconisations</label><textarea oninput="setRapportField('preconisations',this.value)">${esc(r.preconisations)}</textarea>
      <p class="card-sub">💡 Une ligne = une ligne de devis. Ajoutez « x2 » (et l'unité juste après, ex : « x25 m² ») en fin de ligne pour indiquer quantité et unité.</p>
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
      <button class="btn" onclick="printInterventionDraft()">Imprimer / PDF</button>
      <button class="btn" onclick="envoyerRapportEmail()">Envoyer par email</button>
    </div>
    ${wizardNav(4)}
  `;
}
async function generateRapportIA(){
  const raw = ((state.editing.rapport && state.editing.rapport.constatations) || '').trim();
  if(!raw){ alert('Notez d\u2019abord quelques constatations, même brèves, avant de générer avec l\u2019IA.'); return; }
  const btn = document.getElementById('genRapportBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Génération en cours…'; }
  try{
    const items = CONTROLES_PAR_METIER[state.editing.typePanne] || [];
    let controlesCoches = items.filter(c=> state.editing.controles && state.editing.controles[c.key]).map(c=>c.label).join(', ') || 'aucun renseigné';
    if(state.editing.controles && state.editing.controles.autre && state.editing.controleAutreTexte){
      controlesCoches += ` (précision "autre" : ${state.editing.controleAutreTexte})`;
    }
    const metierLabel = (METIERS.find(m=>m.value===state.editing.typePanne)||{}).label || 'non précisé';
    const system = `Tu rédiges un rapport d'intervention professionnel pour un artisan du bâtiment à partir de notes prises sur le terrain. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni balises markdown.
Schéma exact: {"constatations":"...", "preconisations":"..."}
- constatations: reformule et complète les notes fournies en phrases claires et professionnelles (ce qui a été observé et réalisé), sans inventer de faits absents des notes
- preconisations: ce qu'il reste à faire ou à surveiller si c'est pertinent (chaîne vide sinon)
Métier : ${metierLabel}. Contrôles réalisés : ${controlesCoches}.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens: 1000, system, messages:[{role:'user', content: raw}] })
    });
    const data = await resp.json();
    let text = (data.content||[]).map(b=>b.text||'').join('').trim();
    text = text.replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();
    const parsed = JSON.parse(text);
    state.editing.rapport = { constatations: parsed.constatations || raw, preconisations: parsed.preconisations || '' };
    goStep(4);
  }catch(err){
    console.error(err);
    alert("Je n'ai pas pu générer le rapport automatiquement. Réessayez, ou complétez-le manuellement.");
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "✨ Générer / améliorer avec l'IA"; }
  }
}

/* Photos : redimension + compression avant stockage */
function handlePhotoFiles(files){
  if(!state.editing.photos) state.editing.photos = [];
  const remaining = 3 - state.editing.photos.length;
  if(remaining <= 0){ showToast('Maximum 3 photos par intervention.', 'success'); return; }
  const filesToProcess = Array.from(files).slice(0, remaining);
  if(files.length > remaining){ showToast(`Seules ${remaining} photo(s) ont été ajoutées (maximum 3 au total).`, 'success'); }
  filesToProcess.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.onload = ()=>{
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        if(!state.editing.photos) state.editing.photos = [];
        state.editing.photos.push({id:uid(), dataUrl});
        refreshPhotosUI();
      };
      img.src = String(ev.target.result);
    };
    reader.readAsDataURL(file);
  });
}
function removePhoto(id){ state.editing.photos = (state.editing.photos||[]).filter(p=>p.id!==id); refreshPhotosUI(); }
function refreshPhotosUI(){ const el = document.querySelector('.photo-grid'); if(el) el.innerHTML = photoThumbsHTML(state.editing.photos||[]); }
function photoThumbsBCHTML(photos){
  const thumbs = (photos||[]).map(p=>photoThumbHTMLAvecCategorie(p, 'removeBCPhoto')).join('');
  const addTile = (photos||[]).length < 5 ? `<div class="photo-add" onclick="document.getElementById('bcPhotoFileInput').click()" title="Ajouter une photo">+</div>` : '';
  return thumbs + addTile;
}
function handleBCPhotoFiles(files){
  if(!state.editing.photos) state.editing.photos = [];
  const remaining = 5 - state.editing.photos.length;
  if(remaining <= 0){ showToast('Maximum 5 photos par SAV.', 'success'); return; }
  const filesToProcess = Array.from(files).slice(0, remaining);
  if(files.length > remaining){ showToast(`Seules ${remaining} photo(s) ont été ajoutées (maximum 5 au total).`, 'success'); }
  filesToProcess.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.onload = ()=>{
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        if(!state.editing.photos) state.editing.photos = [];
        state.editing.photos.push({id:uid(), dataUrl});
        refreshBCPhotosUI();
      };
      img.src = String(ev.target.result);
    };
    reader.readAsDataURL(file);
  });
}
function removeBCPhoto(id){ state.editing.photos = (state.editing.photos||[]).filter(p=>p.id!==id); refreshBCPhotosUI(); }
function refreshBCPhotosUI(){ const el = document.querySelector('.photo-grid'); if(el) el.innerHTML = photoThumbsBCHTML(state.editing.photos||[]); }

/* Signature client (canvas tactile/souris) */
function setupSignatureCanvas(canvasId, fieldName){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#182233'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  if(state.editing[fieldName]){
    const img = new Image();
    img.onload = ()=> ctx.drawImage(img,0,0,canvas.width,canvas.height);
    img.src = state.editing[fieldName];
  }
  let drawing = false, last = null;
  function pos(ev){
    const r = canvas.getBoundingClientRect();
    const p = ev.touches ? ev.touches[0] : ev;
    return {x:(p.clientX-r.left)*(canvas.width/r.width), y:(p.clientY-r.top)*(canvas.height/r.height)};
  }
  function start(ev){ drawing = true; last = pos(ev); ev.preventDefault(); }
  function move(ev){ if(!drawing) return; const p = pos(ev); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last = p; ev.preventDefault(); }
  function end(){ if(drawing){ drawing = false; state.editing[fieldName] = canvas.toDataURL('image/png'); } }
  canvas.onmousedown = start; canvas.onmousemove = move;
  if(canvas._sigMouseUpHandler) window.removeEventListener('mouseup', canvas._sigMouseUpHandler);
  canvas._sigMouseUpHandler = end;
  window.addEventListener('mouseup', end);
  canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
}
function initSignaturePad(){
  setupSignatureCanvas('sigCanvas', 'signature');
  setupSignatureCanvas('sigCanvasTech', 'signatureTechnicien');
}
function clearSignature(canvasId, fieldName){
  const canvas = document.getElementById(canvasId);
  if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  state.editing[fieldName] = null;
}

/* Rapport rédigé par l'IA à partir de la dictée */
function openEmailComposeModal(opts){
  state.emailModalCtx = opts;
  document.getElementById('email_dest').value = opts.dest || '';
  document.getElementById('email_subject').value = opts.subject || '';
  document.getElementById('email_body').value = opts.body || '';
  document.getElementById('emailDownloadBtn').textContent = '📄 Télécharger le PDF';
  document.getElementById('emailModal').classList.add('open');
}
function closeEmailModal(){ document.getElementById('emailModal').classList.remove('open'); }
function closeEmailModalOnBackdrop(ev){ if(ev.target === ev.currentTarget) closeEmailModal(); }
function emailModalDownload(){
  const ctx = state.emailModalCtx;
  if(!ctx) return;
  ctx.pdfAction();
  const btn = document.getElementById('emailDownloadBtn');
  if(btn) btn.textContent = '✓ Téléchargé — vérifiez votre dossier Téléchargements';
}
function emailModalOpenMailClient(){
  const ctx = state.emailModalCtx;
  if(ctx && ctx.docType==='facture' && ctx.docId) marquerFactureVerrouillee(ctx.docId);
  const dest = document.getElementById('email_dest').value;
  const subject = encodeURIComponent(document.getElementById('email_subject').value);
  const body = encodeURIComponent(document.getElementById('email_body').value);
  window.location.href = `mailto:${dest}?subject=${subject}&body=${body}`;
  showToast("Si votre messagerie ne s'est pas ouverte, utilisez \"Copier le texte\" ci-dessous et collez-le dans votre webmail.", 'success', 5000);
}
function emailModalCopy(){
  const dest = document.getElementById('email_dest').value;
  const subject = document.getElementById('email_subject').value;
  const body = document.getElementById('email_body').value;
  const text = `À : ${dest}\nObjet : ${subject}\n\n${body}`;
  navigator.clipboard.writeText(text).then(()=>{
    showToast('Texte copié — collez-le dans votre messagerie.', 'success', 2500);
  }).catch(()=>{
    showToast("Impossible de copier automatiquement. Sélectionnez et copiez le texte manuellement.");
  });
}
function envoyerRapportEmail(){
  const e = state.editing;
  const r = e.rapport || {};
  const client = state.clients.find(c=>c.societeId===state.societeId && c.nom===e.client);
  const dest = client && client.email ? client.email : '';
  const subject = `Rapport d'intervention — ${e.client||''}`;
  const infosLogement = lignesLogementPourEmail(e);
  const body = `Client : ${e.client||''}\n${infosLogement.join('\n')}\nDate : ${fmtDate(e.date)}\n\nConstatations :\n${r.constatations||''}\n\nPréconisations :\n${r.preconisations||''}`;
  openEmailComposeModal({dest, subject, body, pdfAction: ()=> printInterventionDraft('save')});
}
/**
 * Identité des deux parties, figée sur la facture.
 *
 * Jusqu'ici l'en-tête était recomposé à l'impression depuis les réglages
 * courants : changer le SIRET de la société réécrivait l'en-tête de toutes les
 * factures déjà émises. La facturation électronique l'interdit — une facture
 * transmise doit rester ce qu'elle était le jour de son émission.
 */
function instantaneIdentite(f){
  const s = state.settings[state.societeId] || {};
  const client = (state.clients||[]).find(c => c.societeId===state.societeId && c.nom===f.client) || {};
  const vide = (v) => (v===undefined || v===null || v==='') ? undefined : v;

  return {
    emetteurNom: vide(s.raisonSocialeLegale) || vide(societeName(state.societeId)),
    emetteurSiren: vide(s.siren) || vide(window.sirenDuSiret(s.siret)),
    emetteurSiret: vide(s.siret),
    emetteurTvaIntracom: vide(s.tvaIntracom),
    emetteurAdresse: vide(s.adresse),
    emetteurCodePostal: vide(s.codePostal),
    emetteurVille: vide(s.ville),
    emetteurPaysCode: vide(s.paysCode) || paysDefaut(),
    emetteurIban: vide(s.iban),

    clientSiren: vide(client.siren) || vide(window.sirenDuSiret(client.siret)),
    clientSiret: vide(client.siret),
    clientTvaIntracom: vide(client.tvaIntracom),
    clientCodeRoutage: vide(client.codeRoutage),
    clientCodeService: vide(client.codeService),
    clientPaysCode: vide(client.paysCode) || paysDefaut(),
    cadreFacturation: vide(client.cadreFacturation),
  };
}

/* Le verrouillage est le moment où la facture part : c'est là qu'on fige. */
async function marquerFactureVerrouillee(id){
  const f = state.factures.find(x=>x.id===id);
  if(!f || f.verrouillee) return;
  /* Une facture ÉMISE est déjà figée par la base, définitivement : lui poser en
     plus le verrou d'écran est sans objet, et l'écriture est refusée — 23001,
     « son en-tête ne peut plus être modifié ». Imprimer une facture émise
     laissait donc une erreur dans la console et une requête en 400, à chaque
     fois. Le formulaire fait déjà cette distinction : `emise` l'emporte sur
     `verrouillee`. */
  if(f.numero) return;
  f.verrouillee = true;
  Object.assign(f, instantaneIdentite(f));
  await window.stSet('facture:'+id, f);
  await recharger('facture');
}
async function deverrouillerFacture(id){
  if(!confirm("Cette facture a déjà été téléchargée ou envoyée. Confirmez-vous vouloir la déverrouiller pour la modifier ?\n\nAttention : si le client a déjà reçu une version, pensez à lui renvoyer la version corrigée.")) return;
  const f = state.factures.find(x=>x.id===id);
  if(!f) return;
  f.verrouillee = false;
  await window.stSet('facture:'+id, f);
  await recharger('facture');
  state.editing = {...state.factures.find(x=>x.id===id)};
  renderTab();
}
function lignesLogementPourEmail(doc){
  const lignes = [];
  const adresseComplete = withVille(doc.adresseLocataire || doc.adresse, doc.codePostal, doc.ville);
  if(adresseComplete) lignes.push(`Adresse : ${adresseComplete}`);
  if(doc.logementStatut==='occupé' && doc.occupant) lignes.push(`Locataire : ${doc.occupant}`);
  else if(doc.logementStatut==='vacant' && doc.ancienLocataire) lignes.push(`Ancien locataire : ${doc.ancienLocataire}`);
  if(doc.numeroLogement) lignes.push(`N° de logement : ${doc.numeroLogement}`);
  return lignes;
}
function envoyerDocumentEmail(type, id){
  const doc = (type==='devis' ? state.devis : state.factures).find(x=>x.id===id);
  if(!doc) return;
  const client = state.clients.find(c=>c.societeId===state.societeId && c.nom===doc.client);
  const dest = client && client.email ? client.email : '';
  /* « Notre facture » sur un avoir, avec un montant négatif dans la phrase :
     le client lisait l'inverse de ce qu'il recevait. Le mot suit le type, et le
     montant s'annonce en valeur absolue — c'est « en votre faveur » qui porte
     le sens, pas un signe moins au milieu d'une phrase. */
  const unAvoir = type!=='devis' && window.estAvoir(doc.typeDocument);
  const titre = type==='devis' ? 'devis' : (unAvoir ? 'avoir' : 'facture');
  const t = computeDocTotals(doc);
  const subject = `${titre.charAt(0).toUpperCase()+titre.slice(1)} ${doc.numero} — ${societeName(state.societeId)}`;
  const infosLogement = lignesLogementPourEmail(doc);
  const blocLogement = infosLogement.length ? `\n${infosLogement.join('\n')}\n` : '';
  const body = `Bonjour,\n${blocLogement}\nVeuillez trouver ci-joint notre ${titre} n° ${doc.numero} d'un montant de ${money(Math.abs(t.ttc))} TTC${unAvoir? ' en votre faveur':''}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\n${societeName(state.societeId)}`;
  openEmailComposeModal({dest, subject, body, pdfAction: ()=> printDocument(type, id, 'save'), docType: type, docId: id});
}

async function saveIntervention(etCreerDevis){
  const e = state.editing;
  if(!e.client || !e.client.trim()){ alert('Le nom du client est requis (étape Infos).'); goStep(1); return; }
  const id = e.id || uid();
  const numero = e.numero || await window.nextNumero(state.societeId,'intervention');
  const obj = { id, societeId: state.societeId, numero, createdAt: e.createdAt || new Date().toISOString(), bonCommandeId: e.bonCommandeId || null,
    client: e.client, adresse: resolveClientAdresse(e.client), interlocuteur: e.interlocuteur||'', adresseLocataire: e.adresseLocataire||'', codePostal: e.codePostal||'', ville: e.ville||'',
    ...cleanLogementFields(e.logementStatut||'', {
      occupant: e.occupant||'', etage: e.etage||'', numeroLogement: e.numeroLogement||'',
      precisionCommune: e.precisionCommune||'', ancienLocataire: e.ancienLocataire||''
    }),
    date: e.date || todayISO(), heure: e.heure||'', typePanne: e.typePanne||'',
    conducteur: e.conducteur||'', conducteurId: e.conducteurId||'',
    controles: e.controles || defaultControles(), controleAutreTexte: e.controleAutreTexte||'', photos: e.photos || [], signature: (e.logementStatut==='vacant'||e.logementStatut==='commune') ? null : (e.signature || null), signatureTechnicien: e.signatureTechnicien || null,
    rapport: e.rapport || {constatations:'',preconisations:''},
    datePlanifiee: e.datePlanifiee || '', heurePlanifiee: e.heurePlanifiee || '', dureeHeures: e.dureeHeures || 1,
    statut: e.statut || 'en cours' };
  /* Annotation de type seule : ajouter la clé au littéral changerait ce qui part
     à l'écriture, et un champ sans colonne fait rejeter l'insertion entière. */
  if(estSousTraitant()) /** @type {any} */ (obj).sousTraitantEmetteur = sousTraitantActuel()||'Sous-traitant';
  const r = await window.stSet('intervention:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  const isNouveauSAV = !!obj.bonCommandeId && !e.id;
  await recharger('intervention');
  closeForm('intervention');
  if(etCreerDevis){
    transformerInterventionEn('devis', id);
    showToast('Rapport enregistré — devis pré-rempli, vérifiez puis enregistrez-le.', 'success', 4000);
    return;
  }
  if(isNouveauSAV){
    setTab('planning');
    showToast('SAV créé — planifiez-le ci-dessous.', 'success', 4000);
  }
}

/* ---------- Paramètres ---------- */
function filtrerParPeriode(items, dateField, periode){
  if(periode==='tout') return items;
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const moisActuel = now.getMonth();
  return items.filter(it=>{
    const d = it[dateField];
    if(!d) return false;
    const dt = new Date(d);
    if(isNaN(dt.getTime())) return false;
    if(periode==='annee') return dt.getFullYear()===anneeActuelle;
    if(periode==='mois') return dt.getFullYear()===anneeActuelle && dt.getMonth()===moisActuel;
    return true;
  });
}
function periodeLabel(periode){
  const now = new Date();
  if(periode==='mois') return moisLabelCourt(todayISO().slice(0,7));
  if(periode==='annee') return String(now.getFullYear());
  return 'tout l\'historique';
}
function computeStatsParConducteur(){
  const soc = state.societeId;
  const today = todayISO();
  const periode = state.statsPeriode || 'tout';
  const bonsCommande = filtrerParPeriode(state.bonsCommande.filter(b=>b.societeId===soc), 'createdAt', periode);
  const devisAll = filtrerParPeriode(state.devis.filter(d=>d.societeId===soc), 'date', periode);
  const facturesAll = filtrerParPeriode(state.factures.filter(f=>f.societeId===soc), 'date', periode);
  const conducteurs = state.conducteurs.filter(c=>c.societeId===soc).map(c=>c.nom);
  const noms = Array.from(new Set([...conducteurs, ...bonsCommande.map(b=>b.conducteur||''), ...devisAll.map(d=>d.conducteur||''), ...facturesAll.map(f=>f.conducteur||'')].filter(n=>n!=='')));
  if(!noms.length) return [];
  return noms.map(nom=>{
    const bcs = bonsCommande.filter(b=>(b.conducteur||'')===nom);
    const bcTotal = bcs.length;
    const bcSAV = bcs.filter(b=>b.bonCommandeId).length;
    const bcEnRetard = bcs.filter(b=>b.dateFinTravaux && b.dateFinTravaux < today).length;
    const bcDansLesTemps = bcTotal - bcEnRetard;
    const bcAvecTravSup = bcs.filter(b=>(b.travauxSupplementaires||[]).length>0).length;
    const nbTravSup = bcs.reduce((s,b)=>s+(b.travauxSupplementaires||[]).length, 0);
    const montantTravSup = bcs.reduce((s,b)=>{
      const textes = (b.travauxSupplementaires||[]).map(t=>t.texte);
      const lignesCorrespondantes = (b.lignes||[]).filter(l=>(l.type||'ligne')==='ligne' && textes.includes(l.designation));
      return s + lignesCorrespondantes.reduce((s2,l)=> s2 + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
    }, 0);
    const devisC = devisAll.filter(d=>(d.conducteur||'')===nom);
    const devisTotal = devisC.length;
    const devisAcceptes = devisC.filter(d=>d.statut==='accepté').length;
    const devisTransformes = devisC.filter(d=>facturesAll.some(f=>f.devisId===d.id)).length;
    const facturesC = facturesAll.filter(f=>(f.conducteur||'')===nom);
    const ca = facturesC.reduce((s,f)=>s+computeDocTotals(f).ht, 0);
    return {
      nom, bcTotal, bcSAV,
      tauxSAV: bcTotal? Math.round(bcSAV/bcTotal*100) : 0,
      bcEnRetard, bcDansLesTemps,
      tauxDansLesTemps: bcTotal? Math.round(bcDansLesTemps/bcTotal*100) : 0,
      nbTravSup, montantTravSup, tauxTravSup: bcTotal? Math.round(bcAvecTravSup/bcTotal*100) : 0,
      ca, devisTotal, devisAcceptes,
      tauxDevisAccepte: devisTotal? Math.round(devisAcceptes/devisTotal*100) : 0,
      devisTransformes,
      tauxDevisTransforme: devisTotal? Math.round(devisTransformes/devisTotal*100) : 0,
    };
  }).sort((a,b)=>b.ca-a.ca);
}
function computeStatsBinomesParMois(){
  const soc = state.societeId;
  const periode = state.statsPeriode || 'tout';
  const facturesSoc = filtrerParPeriode(state.factures.filter(f=>f.societeId===soc), 'date', periode);
  const moisSet = new Set();
  const parBinome = {};
  facturesSoc.forEach(f=>{
    const mois = (f.date||'').slice(0,7);
    if(!mois) return;
    const bc = f.bonCommandeId ? state.bonsCommande.find(b=>b.id===f.bonCommandeId) : null;
    const tech = bc && bc.technicien ? state.techniciens.find(t=>t.id===bc.technicien || technicienLabel(t)===bc.technicien) : null;
    const label = tech ? technicienLabel(tech) : 'Non attribué';
    moisSet.add(mois);
    if(!parBinome[label]) parBinome[label] = {};
    const t = computeDocTotals(f);
    parBinome[label][mois] = (parBinome[label][mois]||0) + t.ht;
  });
  const mois = [...moisSet].sort();
  const binomes = Object.keys(parBinome).sort((a,b)=> a==='Non attribué'?1 : b==='Non attribué'?-1 : a.localeCompare(b));
  return { mois, binomes, parBinome };
}
function moisLabelCourt(moisISO){
  const [an, m] = moisISO.split('-');
  const noms = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  return `${noms[parseInt(m,10)-1]} ${an}`;
}
function renderStatsBinomesHTML(){
  const { mois, binomes, parBinome } = computeStatsBinomesParMois();
  if(!binomes.length) return '';
  return `
    <div class="page-head" style="margin-top:28px;"><h1 style="font-size:19px;">Chiffre d'affaires par équipe et par mois</h1></div>
    <div class="card-sub" style="margin-bottom:12px;">Basé sur la date des factures émises, rattachées au technicien (seul, binôme ou trinôme) du bon de commande d'origine.</div>
    <div class="stats-table-wrap">
    <table class="stats-table">
      <thead><tr><th>Équipe</th>${mois.map(m=>`<th class="stats-num">${moisLabelCourt(m)}</th>`).join('')}<th class="stats-num">Total</th></tr></thead>
      <tbody>
        ${binomes.map(b=>{
          const total = mois.reduce((s,m)=> s + (parBinome[b][m]||0), 0);
          return `<tr><td><strong>${esc(b)}</strong></td>${mois.map(m=>`<td class="stats-num">${parBinome[b][m]? moneyDisplay(parBinome[b][m]) : '<span class="card-sub">—</span>'}</td>`).join('')}<td class="stats-num"><strong>${moneyDisplay(total)}</strong></td></tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;
}
function setStatsPeriode(value){
  state.statsPeriode = value;
  renderTab();
}
function renderStatistiques(){
  const stats = computeStatsParConducteur();
  const soc = state.societeId;
  const periode = state.statsPeriode || 'tout';
  const totalDevis = filtrerParPeriode(state.devis.filter(d=>d.societeId===soc), 'date', periode).length;
  const totalFactures = filtrerParPeriode(state.factures.filter(f=>f.societeId===soc), 'date', periode).length;
  const totalBC = filtrerParPeriode(state.bonsCommande.filter(b=>b.societeId===soc), 'createdAt', periode).length;
  return `
    <div class="page-head"><h1>Statistiques par conducteur de travaux</h1>
      <select style="width:auto; min-width:170px;" onchange="setStatsPeriode(this.value)">
        <option value="tout" ${periode==='tout'?'selected':''}>Tout l'historique</option>
        <option value="annee" ${periode==='annee'?'selected':''}>Cette année</option>
        <option value="mois" ${periode==='mois'?'selected':''}>Ce mois-ci</option>
      </select>
    </div>
    <div class="card-sub" style="margin-bottom:14px; margin-top:-8px;">Période affichée : <strong>${esc(periodeLabel(periode))}</strong>. « Travaux supplémentaires » = part des bons de commande ayant eu au moins un travail signalé en plus (par le technicien, le conducteur ou le directeur), leur nombre, et leur montant une fois chiffrés en pré-facture.</div>
    <div class="grid-stats" style="margin-bottom:18px;">
      <div class="stat-card"><div class="stat-card-top"><span class="stat-icon" style="background:var(--info-soft); color:var(--info);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.devis}</svg></span></div><div class="stat-label">Devis effectués</div><div class="stat-num">${totalDevis}</div></div>
      <div class="stat-card"><div class="stat-card-top"><span class="stat-icon" style="background:var(--success-soft); color:var(--success);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.factures}</svg></span></div><div class="stat-label">Factures effectuées</div><div class="stat-num">${totalFactures}</div></div>
      <div class="stat-card"><div class="stat-card-top"><span class="stat-icon" style="background:var(--accent-soft); color:var(--accent);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.bonsCommande||ICONS.devis}</svg></span></div><div class="stat-label">Bons de commande</div><div class="stat-num">${totalBC}</div></div>
    </div>
    ${!stats.length? '<div class="empty">Aucune donnée pour l\'instant — attribuez un conducteur de travaux à vos bons de commande, devis ou factures.</div>' : `
    <div class="card-sub" style="margin-bottom:16px;">« En retard » = date de fin de travaux prévue dépassée sans que le bon de commande ait été refermé. « Taux de devis transformé » = part des devis pour lesquels une facture a été émise.</div>
    <div class="stats-charts-grid">
      <div class="card stats-chart-card">
        <div class="card-title">Répartition du chiffre d'affaires</div>
        <div class="stats-ca-bars">${renderStatsCARepartitionHTML(stats)}</div>
      </div>
      <div class="card stats-chart-card">
        <div class="card-title">Bons de commande — dans les temps / en retard</div>
        <div class="stats-retard-bars">${renderStatsRetardHTML(stats)}</div>
      </div>
      <div class="card stats-chart-card stats-chart-card-wide">
        <div class="card-title">Taux comparés (SAV, devis transformés, travaux suppl.)</div>
        <div class="stats-taux-bars">${renderStatsTauxHTML(stats)}</div>
      </div>
    </div>
    <div class="stats-table-wrap">
    <table class="stats-table">
      <thead>
        <tr>
          <th>Conducteur</th>
          <th>Chiffre d'affaires (HT)</th>
          <th>Bons de commande</th>
          <th>Dans les temps</th>
          <th>En retard</th>
          <th>Taux de SAV</th>
          <th>Devis émis</th>
          <th>Taux devis → facture</th>
          <th>Travaux supplémentaires</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(s=>`
          <tr>
            <td><strong>${esc(s.nom)}</strong></td>
            <td class="stats-num">${moneyDisplay(s.ca)}</td>
            <td class="stats-num">${s.bcTotal}</td>
            <td class="stats-num"><span class="badge success">${s.tauxDansLesTemps}%</span> <span class="card-sub">(${s.bcDansLesTemps})</span></td>
            <td class="stats-num">${s.bcEnRetard>0? `<span class="badge danger">${100-s.tauxDansLesTemps}%</span>`:'<span class="badge">0%</span>'} <span class="card-sub">(${s.bcEnRetard})</span></td>
            <td class="stats-num">${s.tauxSAV}% <span class="card-sub">(${s.bcSAV})</span></td>
            <td class="stats-num">${s.devisTotal}</td>
            <td class="stats-num">${s.tauxDevisTransforme}% <span class="card-sub">(${s.devisTransformes})</span></td>
            <td class="stats-num">${s.tauxTravSup}% <span class="card-sub">(${s.nbTravSup})</span><br><span class="card-sub">${moneyDisplay(s.montantTravSup)}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
    `}
    ${renderStatsBinomesHTML()}
  `;
}
const STATS_PALETTE = ['#FF6A1A','#2E9BF0','#5BC97A','#F0A82E','#9B6EF0','#EF5A6F','#2EC4C4','#8C8C8C'];
function renderStatsCARepartitionHTML(stats){
  const total = stats.reduce((s,x)=>s+x.ca,0);
  if(!total) return '<div class="empty">Aucun chiffre d\'affaires facturé pour l\'instant.</div>';
  const tri = [...stats].sort((a,b)=>b.ca-a.ca);
  return tri.map((s,i)=>{
    const pct = total? Math.round(s.ca/total*100) : 0;
    const couleur = STATS_PALETTE[i%STATS_PALETTE.length];
    return `<div class="stats-bar-row">
      <div class="stats-bar-label"><span class="stats-bar-dot" style="background:${couleur};"></span>${esc(s.nom)}</div>
      <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${pct}%; background:${couleur};"></div></div>
      <div class="stats-bar-value">${moneyDisplay(s.ca)} <span class="card-sub">(${pct}%)</span></div>
    </div>`;
  }).join('');
}
function renderStatsRetardHTML(stats){
  const total = stats.reduce((s,x)=>s+x.bcTotal,0);
  if(!total) return '<div class="empty">Aucun bon de commande pour l\'instant.</div>';
  return stats.map(s=>{
    const t = s.bcTotal||1;
    const pctOk = Math.round(s.bcDansLesTemps/t*100);
    const pctRetard = 100-pctOk;
    return `<div class="stats-bar-row">
      <div class="stats-bar-label">${esc(s.nom)}</div>
      <div class="stats-bar-track stats-bar-track-split">
        ${pctOk>0? `<div class="stats-bar-seg" style="width:${pctOk}%; background:#5BC97A;" title="${s.bcDansLesTemps} dans les temps"></div>`:''}
        ${pctRetard>0? `<div class="stats-bar-seg" style="width:${pctRetard}%; background:#EF5A6F;" title="${s.bcEnRetard} en retard"></div>`:''}
      </div>
      <div class="stats-bar-value"><span style="color:#2E9B4F;">${s.bcDansLesTemps}</span> / <span style="color:#EF5A6F;">${s.bcEnRetard}</span></div>
    </div>`;
  }).join('') + `<div class="stats-legend"><span><i style="background:#5BC97A;"></i> Dans les temps</span><span><i style="background:#EF5A6F;"></i> En retard</span></div>`;
}
function renderStatsTauxHTML(stats){
  if(!stats.length) return '<div class="empty">Aucune donnée pour l\'instant.</div>';
  return stats.map(s=>`
    <div class="stats-taux-bloc">
      <div class="stats-bar-label" style="margin-bottom:8px;">${esc(s.nom)}</div>
      <div class="stats-mini-bar-row"><span class="stats-mini-label">Taux de SAV</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:${s.tauxSAV}%; background:#F0A82E;"></div></div><span class="stats-mini-value">${s.tauxSAV}%</span></div>
      <div class="stats-mini-bar-row"><span class="stats-mini-label">Devis → facture</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:${s.tauxDevisTransforme}%; background:#9B6EF0;"></div></div><span class="stats-mini-value">${s.tauxDevisTransforme}%</span></div>
      <div class="stats-mini-bar-row"><span class="stats-mini-label">Travaux suppl.</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:${s.tauxTravSup}%; background:#EF5A6F;"></div></div><span class="stats-mini-value">${s.tauxTravSup}%</span></div>
    </div>`).join('');
}
function renderParametres(){
  if(state.currentRole==='client'){
    const clients = state.clients.filter(c=>c.societeId===state.societeId);
    const clientObj = clients.find(c=>c.nom===state.currentClientNom);
    const interlocs = clientObj? state.interlocuteurs.filter(i=>i.clientId===clientObj.id) : [];
    return `
    <div class="page-head"><h1>Réglages — Accès client</h1></div>
    <div class="card">
      <div class="card-title" style="margin-bottom:4px;">🏢 Votre organisme</div>
      <select style="width:100%; max-width:340px;" onchange="state.currentClientNom=this.value; state.currentInterlocuteur=''; state.clientStatutFiltre=''; renderTab();">
        <option value="">— Sélectionner —</option>
        ${clients.map(c=>`<option value="${esc(c.nom)}" ${c.nom===state.currentClientNom?'selected':''}>${esc(c.nom)}</option>`).join('')}
      </select>
      ${clientObj? `
      <div class="card-title" style="margin:16px 0 4px;">👤 Votre nom (interlocuteur)</div>
      <div class="card-sub" style="margin-bottom:8px;">Chaque interlocuteur ne voit que ses propres bons de commande. Laissez vide pour voir tous ceux de l'organisme.</div>
      <select style="width:100%; max-width:340px;" onchange="state.currentInterlocuteur=this.value; state.clientStatutFiltre=''; renderTab();">
        <option value="">— Tous les interlocuteurs —</option>
        ${interlocs.map(i=>`<option value="${esc(i.nom)}" ${i.nom===state.currentInterlocuteur?'selected':''}>${esc(i.nom)}</option>`).join('')}
      </select>`:''}
    </div>
    `;
  }
  if(estSousTraitant()){
    const sts = state.sousTraitants.filter(s=>s.societeId===state.societeId);
    return `
    <div class="page-head"><h1>Réglages — Espace sous-traitant</h1></div>
    <div class="card">
      <div class="card-title" style="margin-bottom:4px;">👤 Qui êtes-vous ?</div>
      <div class="card-sub" style="margin-bottom:12px;">Sélectionnez votre entreprise pour ne voir que vos documents et vos factures ${esc(societeName(state.societeId))}.</div>
      <select style="width:100%; max-width:340px;" onchange="state.currentSousTraitant=this.value; renderTab();">
        <option value="">— Sélectionner —</option>
        ${sts.map(s=>`<option value="${esc(s.nom)}" ${s.nom===state.currentSousTraitant?'selected':''}>${esc(s.nom)}</option>`).join('')}
      </select>
      ${!sts.length? '<div class="card-sub" style="margin-top:10px;">Aucun sous-traitant enregistré — demandez à '+esc(societeName(state.societeId))+' de vous ajouter dans ses réglages.</div>':''}
    </div>
    `;
  }
  return `
    <div class="page-head"><h1>Réglages — ${esc(societeName(state.societeId))}</h1></div>

    <div class="card" style="border-color:var(--accent); background:var(--accent-soft);">
      <div class="card-title" style="margin-bottom:4px;">💾 Sauvegarde de vos données</div>
      <div class="card-sub" style="margin-bottom:12px;">Si vous testez régulièrement une nouvelle version de l'appli, vos données peuvent ne pas se conserver d'une version à l'autre. Exportez-les avant de changer de version, puis réimportez-les — vous ne perdrez plus rien.</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn primary" onclick="exporterMesDonnees()">⬇ Exporter mes données</button>
        <label class="btn" style="cursor:pointer;">⬆ Importer une sauvegarde<input type="file" accept="application/json" style="display:none;" onchange="if(this.files[0]) importAllData(this.files[0])"></label>
      </div>
    </div>

    <div class="reglages-layout">
      ${renderReglagesNav()}
      <div id="reglagesContenu">${renderReglagesOnglet()}</div>
    </div>

    <footer class="note">
      Vérifiez le taux de TVA applicable selon la nature des travaux (une attestation du client est requise pour les taux réduits de 5,5 % et 10 % sur des logements de plus de 2 ans).
    </footer>
  `;
}

/* ---------- Réglages : navigation par onglets ----------
   Groupés comme dans chantier-mate-ease, pour que les deux applications se
   parcourent de la même façon. */
const REGLAGES_GROUPES = [
  { titre:'Société', items:[
    {id:'organisation', label:'Organisation', icone:'🏢', desc:"Identité légale et coordonnées"},
    {id:'identite', label:'Identité visuelle', icone:'🎨', desc:'Logo et couleur dominante'},
    {id:'legaux', label:'Documents légaux', icone:'📄', desc:'Kbis, assurances, URSSAF'},
  ]},
  { titre:'Documents', items:[
    {id:'documents', label:'Devis & factures', icone:'🧾', desc:'Valeurs par défaut'},
    {id:'numerotation', label:'Numérotation', icone:'🔢', desc:'Compteurs par année'},
  ]},
  { titre:'Référentiels', items:[
    {id:'travaux', label:'Travaux & unités', icone:'🛠️', desc:'Métiers et unités'},
    {id:'intervenants', label:'Intervenants', icone:'🦺', desc:'Conducteurs, techniciens, sous-traitants'},
    {id:'rh', label:'RH', icone:'🧑‍🔧', desc:'Seuils d\'alerte'},
    {id:'vehicules', label:'Véhicules', icone:'🚚', desc:'Seuils d\'alerte'},
    {id:'notifications', label:'Notifications', icone:'🔔', desc:'Alertes et destinataires'},
  ]},
  { titre:'Mon compte', items:[
    {id:'moncompte', label:'Mon nom', icone:'👤', desc:'Le nom affiché dans l\'application'},
  ]},
];

function setReglagesTab(id){ state.reglagesTab = id; renderTab(); }

function renderReglagesNav(){
  const actif = state.reglagesTab || 'organisation';
  return `
    <select class="reglages-choix" onchange="setReglagesTab(this.value)" aria-label="Rubrique des réglages">
      ${REGLAGES_GROUPES.map(g=>`<optgroup label="${esc(g.titre)}">${g.items
        .map(o=>`<option value="${o.id}" ${o.id===actif?'selected':''}>${o.icone} ${esc(o.label)}</option>`).join('')}</optgroup>`).join('')}
    </select>
    <nav class="reglages-rail" aria-label="Rubriques des réglages">
      ${REGLAGES_GROUPES.map(g=>`
        <div class="reglages-groupe">${esc(g.titre)}</div>
        ${g.items.map(o=>`
          <button class="reglages-lien ${o.id===actif?'active':''}" onclick="setReglagesTab('${jsAttr(o.id)}')"
                  ${o.id===actif?'aria-current="page"':''}>
            <span class="reglages-lien-ico" aria-hidden="true">${o.icone}</span>
            <span class="reglages-lien-texte">${esc(o.label)}<span class="reglages-lien-desc">${esc(o.desc)}</span></span>
          </button>`).join('')}
      `).join('')}
    </nav>`;
}

function renderReglagesOnglet(){
  /* Le bandeau de complétude lit le DOM : il se remplit une fois la section
     posée, pas pendant qu'on assemble sa chaîne. */
  const onglet = state.reglagesTab || 'organisation';
  if(onglet === 'organisation') setTimeout(majCompletudeSociete, 0);
  if(onglet === 'identite') setTimeout(()=>apercuCouleur(reglagesCourants().documents.couleurAccent), 0);
  /* La numérotation appelait `rafraichirNumerotation()` depuis sa propre
     fonction de rendu, c'est-à-dire pendant qu'on assemblait sa chaîne : la
     zone `#zoneNumerotation` n'existait pas encore, le `if(!zone) return` en
     tête sortait aussitôt, et l'écran restait sur « Chargement… ». */
  if(onglet === 'numerotation') setTimeout(rafraichirNumerotation, 0);

  switch(onglet){
    case 'organisation':  return renderInfosEntrepriseSection();
    case 'identite':      return renderIdentiteVisuelleSection();
    case 'legaux':        return renderDocumentsLegauxSection();
    case 'documents':     return renderReglagesDocumentsSection();
    case 'numerotation':  return renderNumerotationSection();
    case 'travaux':       return renderMetiersSection() + renderUnitesSection();
    case 'intervenants':  return renderConducteursSection() + renderSousTraitantsSection();
    case 'rh':            return renderSeuilsSection('rh');
    case 'vehicules':     return renderSeuilsSection('vehicules');
    case 'notifications': return renderNotificationsSection();
    case 'moncompte':     return renderMonCompteSection();
    default:              return renderInfosEntrepriseSection();
  }
}
function renderInfosEntrepriseSection(){
  const s = state.settings[state.societeId] || {};
  return `<div class="card" style="margin-top:22px;">
    <div class="card-title" style="margin-bottom:10px;">🏢 Informations de l'entreprise</div>
    <div class="card-sub" style="margin-bottom:14px;">Utilisées dans l'en-tête de vos devis/factures et pour générer automatiquement des documents comme le PPSPS.</div>
    <div class="field-grid">
      <div class="field full" style="position:relative;">
        <label>Adresse</label>
        <input type="text" id="ie_adresse" autocomplete="off" value="${esc(s.adresse)}" data-suggest="ieAdresseSuggestions"
               oninput="searchAdresse(this, {adresse:'ie_adresse', codePostal:'ie_codePostal', ville:'ie_ville'})"
               onblur="setTimeout(()=>{const b=document.getElementById('ieAdresseSuggestions'); if(b) b.style.display='none';},150)">
        <div id="ieAdresseSuggestions" class="suggest-box"></div>
      </div>
      <div class="field"><label>Code postal</label><input type="text" id="ie_codePostal" value="${esc(s.codePostal)}"></div>
      <div class="field"><label>Ville</label><input type="text" id="ie_ville" value="${esc(s.ville)}"></div>
      <div class="field"><label>Téléphone</label><input type="text" id="ie_telephone" oninput="majCompletudeSociete()" value="${esc(s.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="ie_email" oninput="majCompletudeSociete()" value="${esc(s.email)}"></div>
      ${champSiretHTML('ie_siret', s.siret, CIBLES_ANNUAIRE_SOCIETE)}
      <div class="field"><label>Nom du gérant / représentant</label><input type="text" id="ie_gerant" value="${esc(s.gerant)}"></div>
      <div class="field"><label>Téléphone du gérant</label><input type="text" id="ie_gerantTelephone" value="${esc(s.gerantTelephone)}"></div>
    </div>
    ${sectionsEfactureSocieteHTML(s)}

    <div id="ie_completude" style="margin-top:12px;"></div>
    <button class="btn primary" style="margin-top:12px;" onclick="saveInfosEntreprise()">Enregistrer</button>
  </div>`;
}

/**
 * Ce qui manque à la fiche société, et ce qui serait bienvenu.
 *
 * `completudeSociete` existait, le bandeau était rendu, et la fonction n'était
 * appelée nulle part : la fiche pouvait rester vide sans que rien ne le dise.
 * C'est ce silence qui a fait découvrir les mentions manquantes par un
 * comptable plutôt que par l'écran.
 *
 * Les deux listes restent séparées : ce qui est obligatoire se corrige toutes
 * affaires cessantes, ce qui est recommandé attend. Les confondre, c'est ne
 * plus savoir par quoi commencer.
 */
function societeDepuisFormulaire(){
  const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const s = state.settings[state.societeId] || {};
  return { ...s,
    raisonSocialeLegale: v('ie_raisonSocialeLegale') || s.raisonSocialeLegale,
    formeJuridique: v('ie_formeJuridique') || s.formeJuridique,
    siret: v('ie_siret') || s.siret,
    tvaIntracom: v('ie_tvaIntracom') || s.tvaIntracom,
    capitalSocial: v('ie_capitalSocial') || s.capitalSocial,
    rcsNumero: v('ie_rcsNumero') || s.rcsNumero,
    rcsVille: v('ie_rcsVille') || s.rcsVille,
    adresse: v('ie_adresse') || s.adresse,
    codePostal: v('ie_codePostal') || s.codePostal,
    ville: v('ie_ville') || s.ville,
    telephone: v('ie_telephone') || s.telephone,
    email: v('ie_email') || s.email,
    iban: v('ie_iban') || s.iban,
    bic: v('ie_bic') || s.bic,
    adresseElectroniqueValeur: v('ie_adresseElectroniqueValeur') || s.adresseElectroniqueValeur,
  };
}

function majCompletudeSociete(){
  const zone = document.getElementById('ie_completude');
  if(!zone) return;
  const societe = societeDepuisFormulaire();
  const manques = window.completudeSociete(societe);
  const conseils = window.recommandationsSociete(societe);

  /* Un pied de page personnalisé remplace l'identité légale du document. Le
     réglage est assumé, mais il doit se voir quand l'identité est incomplète —
     sinon la mention obligatoire disparaît deux fois, et sans bruit. */
  const piedPerso = ((reglagesCourants().documents||{}).piedDePage||'').trim();

  let html = '';
  if(manques.length){
    html += `<div class="wf-banner alerte">${esc(window.messageAnomalies(manques))}</div>`;
  } else {
    html += `<div class="wf-banner ok">✓ Les mentions obligatoires de vos documents sont au complet.</div>`;
  }
  if(conseils.length){
    html += `<div class="card-sub" style="margin-top:6px;">Recommandé, sans être obligatoire : ${esc(conseils.map(c=>c.libelle).join(', '))}.</div>`;
  }
  if(piedPerso && manques.length){
    html += `<div class="card-sub" style="margin-top:6px; color:var(--danger);">Votre pied de page personnalisé remplace l'identité légale sur les documents : les mentions ci-dessus n'y figureront pas.</div>`;
  }
  zone.innerHTML = html;
}

/* Champs que l'annuaire sait remplir sur la fiche de votre société. */
const CIBLES_ANNUAIRE_SOCIETE = {
  adresse:'ie_adresse', codePostal:'ie_codePostal', ville:'ie_ville',
  siren:'ie_siren', tvaIntracom:'ie_tvaIntracom', codeNaf:'ie_codeNaf',
  formeJuridique:'ie_formeJuridique',
  /* Le dirigeant était retapé à la main alors que l'annuaire le déclare. */
  gerant:'ie_gerant',
  adresseElectroniqueValeur:'ie_adresseElectroniqueValeur',
  adresseElectroniqueSchema:'ie_adresseElectroniqueSchema',
};

/**
 * Identité légale et facturation électronique de l'émetteur.
 *
 * Repliées : ces champs se renseignent une fois, alors que les coordonnées
 * au-dessus sont consultées au quotidien. La section « réception » est ouverte
 * par défaut — l'obligation de recevoir est en vigueur depuis le 01/09/2026.
 */
function sectionsEfactureSocieteHTML(s){
  const schemas = (window.SCHEMAS_ADRESSE_ELECTRONIQUE||[]);
  const coche = (v) => v===true ? 'checked' : '';
  return `
  <details style="margin-top:14px;">
    <summary style="cursor:pointer; font-weight:700;">⚖️ Identité légale</summary>
    <div class="field-grid" style="margin-top:10px;">
      <div class="field full"><label>Raison sociale</label><input type="text" id="ie_raisonSocialeLegale" oninput="majCompletudeSociete()" value="${esc(s.raisonSocialeLegale)}" placeholder="${esc(s.nom||'')}"></div>
      <div class="field"><label>Forme juridique</label><input type="text" id="ie_formeJuridique" oninput="majCompletudeSociete()" value="${esc(s.formeJuridique)}" placeholder="SASU, EURL…"></div>
      <div class="field"><label>SIREN</label><input type="text" id="ie_siren" value="${esc(s.siren)}" inputmode="numeric" placeholder="9 chiffres"></div>
      <div class="field">
        <label>N° de TVA intracommunautaire</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="ie_tvaIntracom" value="${esc(s.tvaIntracom)}" placeholder="FR…" style="flex:1;">
          <button type="button" class="btn small" onclick="calculerTvaSociete()" title="Calculer depuis le SIREN">∑</button>
        </div>
      </div>
      <div class="field"><label>Code APE / NAF</label><input type="text" id="ie_codeNaf" value="${esc(s.codeNaf)}"></div>
      <div class="field"><label>Capital social (€)</label><input type="number" step="0.01" min="0" id="ie_capitalSocial" oninput="majCompletudeSociete()" value="${esc(s.capitalSocial)}"></div>
      <div class="field"><label>N° RCS</label><input type="text" id="ie_rcsNumero" oninput="majCompletudeSociete()" value="${esc(s.rcsNumero)}"></div>
      <div class="field"><label>Ville du RCS</label><input type="text" id="ie_rcsVille" oninput="majCompletudeSociete()" value="${esc(s.rcsVille)}"></div>
      <div class="field"><label>Pays</label><input type="text" id="ie_paysCode" value="${esc(s.paysCode||paysDefaut())}" maxlength="2"></div>
    </div>
  </details>

  <details style="margin-top:8px;">
    <summary style="cursor:pointer; font-weight:700;">💶 TVA et mentions obligatoires</summary>
    <div class="field-grid" style="margin-top:10px;">
      <div class="field">
        <label>Régime de TVA</label>
        <select id="ie_regimeTva" onchange="majMentionFranchise()">
          <option value="">—</option>
          ${(window.REGIMES_TVA||[]).map(r=>`<option value="${esc(r.code)}" ${s.regimeTva===r.code?'selected':''}>${esc(r.libelle)}</option>`).join('')}
        </select>
        <small id="ie_franchiseAide" style="color:#B85C00; font-size:11px;"></small>
      </div>
      <div class="field">
        <label>Périodicité de l'e-reporting</label>
        <select id="ie_ereportingRegime">
          <option value="">—</option>
          ${(window.PERIODICITES_EREPORTING||[]).map(x=>`<option value="${esc(x.code)}" ${s.ereportingRegime===x.code?'selected':''}>${esc(x.libelle)}</option>`).join('')}
        </select>
        <small style="color:var(--text-dim); font-size:11px;">À aligner sur votre fréquence de déclaration de TVA — à confirmer avec votre comptable.</small>
      </div>
      <div class="field full"><label class="bc-tache-row"><input type="checkbox" id="ie_tvaSurEncaissements" ${coche(s.tvaSurEncaissements)}><span>TVA exigible à l'encaissement (prestations de services)</span></label></div>
      <div class="field full"><label class="bc-tache-row"><input type="checkbox" id="ie_autoliquidationBatiment" ${coche(s.autoliquidationBatiment)}><span>Autoliquidation de la TVA dans le bâtiment (sous-traitance, art. 283-2 nonies du CGI)</span></label></div>
      <div class="field full"><label>Mention des pénalités de retard</label><input type="text" id="ie_mentionPenalitesRetard" value="${esc(s.mentionPenalitesRetard)}" placeholder="Ex : trois fois le taux d'intérêt légal"></div>
      <div class="field"><label>Indemnité de recouvrement (€)</label><input type="number" step="1" min="0" id="ie_indemniteRecouvrement" value="${esc(s.indemniteRecouvrement !== '' && s.indemniteRecouvrement != null ? s.indemniteRecouvrement : (window.INDEMNITE_RECOUVREMENT_EUR||40))}"><small style="color:var(--text-dim); font-size:11px;">40 € par défaut — art. D. 441-5 du code de commerce.</small></div>
      <div class="field"><label>Assurance décennale — assureur</label><input type="text" id="ie_assuranceDecennaleNom" value="${esc(s.assuranceDecennaleNom)}"></div>
      <div class="field"><label>N° de police</label><input type="text" id="ie_assuranceDecennalePolice" value="${esc(s.assuranceDecennalePolice)}"></div>
    </div>
  </details>

  <details style="margin-top:8px;" open>
    <summary style="cursor:pointer; font-weight:700;">📧 Réception des factures fournisseurs</summary>
    <div class="card-sub" style="margin:8px 0;">Obligatoire depuis le 1<sup>er</sup> septembre 2026 : c'est l'adresse que vos fournisseurs et sous-traitants utiliseront pour vous facturer. Elle vous est attribuée par votre plateforme de dématérialisation.</div>
    <div class="field-grid">
      <div class="field">
        <label>Schéma de l'adresse</label>
        <select id="ie_adresseElectroniqueSchema">
          <option value="">—</option>
          ${schemas.map(x=>`<option value="${esc(x.code)}" ${s.adresseElectroniqueSchema===x.code?'selected':''}>${esc(x.code)} — ${esc(x.libelle)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Adresse électronique</label><input type="text" id="ie_adresseElectroniqueValeur" value="${esc(s.adresseElectroniqueValeur)}" placeholder="déduite du SIRET"></div>
      <div class="field"><label>IBAN</label><input type="text" id="ie_iban" oninput="majCompletudeSociete()" value="${esc(s.iban)}" placeholder="FR76…"></div>
      <div class="field"><label>BIC</label><input type="text" id="ie_bic" oninput="majCompletudeSociete()" value="${esc(s.bic)}"></div>
    </div>
  </details>`;
}

/* La franchise en base interdit de facturer de la TVA et impose une mention
   précise : c'est le seul régime qui change le document lui-même. */
function majMentionFranchise(){
  const zone = document.getElementById('ie_franchiseAide');
  const select = document.getElementById('ie_regimeTva');
  if(!zone || !select) return;
  zone.textContent = window.sansTva(select.value)
    ? `Vos factures porteront « ${window.MENTION_FRANCHISE_EN_BASE} » et aucune TVA.`
    : '';
}

function calculerTvaSociete(){
  const champ = document.getElementById('ie_tvaIntracom');
  if(!champ) return;
  const siren = (document.getElementById('ie_siren')||{}).value
    || window.sirenDuSiret((document.getElementById('ie_siret')||{}).value);
  const tva = window.tvaIntracomFr(siren);
  if(!tva){ showToast('Renseignez d\'abord un SIRET ou un SIREN.'); return; }
  champ.value = tva;
}
const TYPES_DOC_LEGAUX = ['KBIS','Assurance décennale','Assurance RC Pro','Attestation de vigilance URSSAF','Qualibat','Attestation fiscale','Autre'];
/* ---------- Réglages : sections par onglet ----------
   Chaque section n'écrit que les champs présents à l'écran : `saveReglages()`
   fusionne avec l'existant, pour qu'un onglet non affiché ne soit pas effacé. */
/* Le taux de TVA n'est pas une constante du métier : 20 % en neuf, 10 % en
   rénovation, 5,5 % en amélioration énergétique, 0 en autoliquidation. Il vient
   donc des réglages de la société, jamais d'un littéral. */
function tvaDefaut(){
  const d = reglagesCourants().documents;
  return Number.isFinite(Number(d && d.tvaDefaut)) ? Number(d.tvaDefaut) : 0;
}
function tauxTvaProposes(){
  const r = reglagesCourants();
  return (r.tauxTva && r.tauxTva.length) ? r.tauxTva : [tvaDefaut()];
}
/** Options d'un sélecteur de taux, le taux courant présélectionné. */
function optionsTvaHTML(courant){
  const taux = tauxTvaProposes();
  const valeur = Number.isFinite(Number(courant)) ? Number(courant) : tvaDefaut();
  // Un taux enregistré autrefois peut ne plus figurer dans la liste : on le garde
  const liste = taux.includes(valeur) ? taux : [...taux, valeur].sort((a,b)=>a-b);
  return liste.map(v=>`<option value="${v}" ${v===valeur?'selected':''}>${v}%</option>`).join('');
}

/**
 * Pose la couleur de la société active sur tout le document.
 *
 * Les variables `--accent*` sont déjà lues par l'interface ET par le CSS
 * d'impression : les écraser sur l'élément racine suffit à reteindre l'écran et
 * les PDF d'un coup. html2canvas clone dans le même document et lit les styles
 * calculés, donc la capture voit la couleur.
 *
 * Le réglage existait depuis longtemps sans lecteur : KTA avait choisi un
 * violet, et l'application affichait l'orange par défaut.
 */
/**
 * Montre la palette que la couleur choisie produit, et l'applique aussitôt.
 *
 * Sans cela on choisit un ton dans un sélecteur système, on enregistre, on
 * recharge — et on découvre seulement là que le foncé ne convient pas.
 */
function apercuCouleur(couleur){
  const p = window.paletteAccent(couleur);
  const zone = document.getElementById('rg_couleurApercu');
  if(zone){
    const pastille = (fond, texte, libelle) =>
      `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:${fond}; color:${texte}; font-size:11px; font-weight:700;">${libelle}</span>`;
    zone.innerHTML = `<div style="display:flex; gap:6px; flex-wrap:wrap;">`
      + pastille(p.accent, p.surAccent, 'Accent')
      + pastille(p.accentFonce, '#FFFFFF', 'Titres')
      + pastille(p.accentClair, '#182233', 'Fonds')
      + `</div>`;
  }
  /* Appliquée tout de suite : l'écran entier sert d'aperçu grandeur nature. */
  appliquerPalette(p);
}

/**
 * Pose une palette sur l'élément racine.
 *
 * Écrite une seule fois : l'aperçu du réglage et le démarrage doivent produire
 * exactement le même écran, sinon on choisit une couleur et on en obtient une
 * autre au rechargement.
 */
function appliquerPalette(p){
  const r = document.documentElement.style;
  r.setProperty('--accent', p.accent);
  r.setProperty('--accent-2', p.accentFonce);
  r.setProperty('--accent-soft', p.accentClair);
  r.setProperty('--sur-accent', p.surAccent);
  /* Les halos et anneaux de focus étaient sept opacités d'un orange figé : ils
     seraient restés orange pendant que le reste virait. Les composantes
     suffisent, chaque opacité s'en déduit. */
  const [rr, vv, bb] = [1, 3, 5].map(i => parseInt(p.accent.slice(i, i + 2), 16));
  r.setProperty('--accent-rgb', `${rr}, ${vv}, ${bb}`);
}

/**
 * Applique la couleur de la société active.
 *
 * À n'appeler qu'une fois les réglages chargés. Elle l'était AVANT `loadAll()` :
 * `state.settings` étant vide, `reglagesCourants()` rendait le défaut, l'orange
 * se posait — et rien ne repassait quand la vraie couleur arrivait. KTA avait
 * choisi un violet, l'écran restait orange, et le réglage passait pour mort.
 */
function appliquerCouleurSociete(){
  const reglages = reglagesCourants();
  const couleur = reglages && reglages.documents ? reglages.documents.couleurAccent : null;
  appliquerPalette(window.paletteAccent(couleur));
}

function reglagesCourants(){
  return (state.settings[state.societeId]||{}).reglages || window.REGLAGES_DEFAUT;
}

function renderReglagesDocumentsSection(){
  const d = reglagesCourants().documents;
  return `<div class="card">
    <div class="card-title" style="margin-bottom:10px;">🧾 Valeurs par défaut des devis et factures</div>
    <div class="card-sub" style="margin-bottom:14px;">Appliquées aux nouveaux documents de ${esc(societeName(state.societeId))}.</div>
    <div class="field-grid">
      <div class="field"><label>Validité des devis (jours)</label><input type="number" min="0" id="rg_validiteDevis" value="${d.validiteDevisJours}"></div>
      <div class="field"><label>Délai de paiement (jours)</label><input type="number" min="0" id="rg_delaiPaiement" value="${d.delaiPaiementJours}"></div>
      <div class="field"><label>TVA par défaut (%)</label><input type="number" min="0" step="0.1" id="rg_tva" value="${d.tvaDefaut}"></div>
      <div class="field"><label>Taux de TVA proposés (%)</label><input type="text" id="rg_tauxTva" value="${esc(tauxTvaProposes().join(', '))}" placeholder="0, 5.5, 10, 20"><small style="color:var(--text-dim); font-size:11px;">Séparés par des virgules. 0 sert à l'autoliquidation et aux exonérations.</small></div>
      <div class="field full"><label>Mention d'acceptation (devis)</label><input type="text" id="rg_mentionAcceptation" value="${esc(d.mentionAcceptation)}"></div>
      <div class="field full"><label>Conditions affichées sur les devis</label><textarea id="rg_conditionsDevis" style="min-height:60px;">${esc(d.conditionsDevis)}</textarea></div>
      <div class="field full"><label>Mentions complémentaires (factures)</label><textarea id="rg_mentionsComplementaires" style="min-height:60px;">${esc(d.mentionsComplementaires)}</textarea></div>
      <div class="field full"><label>Pied de page des documents</label><input type="text" id="rg_piedDePage" value="${esc(d.piedDePage)}"></div>
      <div class="field full"><label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="rg_afficherIban" ${d.afficherIban?'checked':''}> Rappeler l'IBAN sur les factures</label></div>
    </div>
    <div style="margin-top:16px;"><button class="btn primary" onclick="saveReglages()">Enregistrer</button></div>
  </div>`;
}

function renderUnitesSection(){
  const r = reglagesCourants();
  return `<div class="card" style="margin-top:22px;">
    <div class="card-title" style="margin-bottom:10px;">📏 Unités</div>
    <div class="card-sub" style="margin-bottom:12px;">Proposées dans les lignes de devis, factures et bons de commande.</div>
    <div class="field full"><input type="text" id="rg_unites" value="${esc(r.unites.join(', '))}" placeholder="U, ml, m², h…"></div>
    <small style="color:var(--text-dim); font-size:11px;">Séparées par des virgules. Laissez vide pour revenir à la liste par défaut.</small>
    <div style="margin-top:14px;"><button class="btn primary" onclick="saveReglages()">Enregistrer</button></div>
  </div>`;
}

/* Seuils : RH et véhicules puisent dans la même table, filtrée par domaine. */
const SEUILS_PAR_DOMAINE = {
  rh: ['carteBtp','visiteMedicale','habilitation','documentLegal'],
  vehicules: ['vehiculeCarte','vehiculeControle'],
};

function renderSeuilsSection(domaine){
  const seuils = reglagesCourants().seuils;
  const libelles = window.LIBELLES_SEUILS;
  const cles = SEUILS_PAR_DOMAINE[domaine] || Object.keys(seuils);
  const titre = domaine === 'rh' ? "🧑‍🔧 Seuils d'alerte RH" : "🚚 Seuils d'alerte véhicules";

  return `<div class="card">
    <div class="card-title" style="margin-bottom:10px;">${titre}</div>
    <div class="card-sub" style="margin-bottom:14px;">Nombre de jours avant échéance à partir duquel l'alerte apparaît dans la cloche.</div>
    <div class="field-grid">
      ${cles.map(k=>`<div class="field"><label>${esc(libelles[k]||k)}</label><input type="number" min="0" id="rg_seuil_${esc(k)}" value="${seuils[k]}"></div>`).join('')}
    </div>
    <div style="margin-top:16px;"><button class="btn primary" onclick="saveReglages()">Enregistrer</button></div>
  </div>`;
}

/* Le nom appartient à la personne, pas à la société : il vit donc dans son
   propre groupe. Sans cet écran, `profiles.nom` garderait indéfiniment la
   partie gauche de l'adresse, faute de tout autre endroit pour le corriger. */
function renderMonCompteSection(){
  const adresse = (window.utilisateurCourant && window.utilisateurCourant()) || '';
  const actuel = (window.nomIntervenant && window.monCompteId
    ? window.nomIntervenant(window.monCompteId()) : '') || '';
  const renseigne = actuel && actuel !== 'un utilisateur' && !actuel.includes('@')
    && actuel !== adresse.split('@')[0];
  return `
    <div class="reglage-titre">👤 Mon nom</div>
    <div class="card">
      <div class="card-sub" style="margin-bottom:12px;">C'est ce nom qui s'affiche dans le menu, dans les validations et au-dessus de votre tableau de bord. ${renseigne? '' : "Tant qu'il n'est pas renseigné, l'application se rabat sur votre adresse e-mail."}</div>
      <div class="field-grid">
        <div class="field"><label>Nom affiché</label><input type="text" id="mc_nom" value="${esc(renseigne? actuel : '')}" placeholder="Ex : Johan"></div>
        <div class="field"><label>Adresse de connexion</label><input type="text" value="${esc(adresse)}" disabled title="Votre adresse ne se change pas ici"></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="btn primary" onclick="saveMonNom()">Enregistrer</button>
      </div>
    </div>`;
}

async function saveMonNom(){
  const nom = document.getElementById('mc_nom').value.trim();
  if(!nom){ alert('Indiquez le nom à afficher.'); return; }
  if(!window.definirMonNom || !(await window.definirMonNom(nom))){
    showToast(saveFailedMessage()); return;
  }
  /* L'en-tête porte le nom : sans ce rendu, il resterait sur l'ancien jusqu'au
     prochain rechargement de la page. */
  renderShell();
  renderTab();
  showToast('Nom enregistré.', 'success');
}

function renderNotificationsSection(){
  const n = reglagesCourants().notifications;
  return `<div class="card">
    <div class="card-title" style="margin-bottom:10px;">🔔 Notifications</div>
    <div class="field-grid">
      <div class="field full"><label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="rg_notifActives" ${n.actives?'checked':''}> Afficher les alertes d'échéance</label></div>
      <div class="field full"><label>Destinataires des rappels (emails séparés par des virgules)</label><input type="text" id="rg_notifDestinataires" value="${esc(n.destinataires)}" placeholder="conducteur@exemple.fr, rh@exemple.fr"></div>
    </div>
    <div style="margin-top:16px;"><button class="btn primary" onclick="saveReglages()">Enregistrer</button></div>
  </div>`;
}

/* ---------- Numérotation ----------
   Les compteurs vivent dans la table `compteurs` et sont incrémentés par la
   fonction SQL `prochain_numero()`, de façon atomique : deux personnes qui
   créent un devis en même temps ne peuvent pas obtenir le même numéro.
   L'écran règle le préfixe et le point de départ, il n'attribue rien. */

let compteursCharges = null;

async function rafraichirNumerotation(){
  const zone = document.getElementById('zoneNumerotation');
  if(!zone) return;
  try{
    compteursCharges = await window.listCompteurs(window.societeActive().uuid);
    zone.innerHTML = tableauNumerotation();
  }catch(err){
    console.error('Compteurs indisponibles', err);
    zone.innerHTML = '<div class="empty">Compteurs indisponibles.</div>';
  }
}

function tableauNumerotation(){
  const annee = new Date().getFullYear();
  const modifiable = window.autorise ? window.autorise('reglages', 'modifier') : true;

  return `<table class="table">
    <thead><tr><th>Document</th><th style="width:110px;">Préfixe</th><th style="width:140px;">Dernier n° attribué</th><th>Prochain</th></tr></thead>
    <tbody>
      ${window.SERIES_NUMEROTATION.map(s=>{
        const c = (compteursCharges||[]).find(x=> x.type===s.type && x.annee===annee);
        const prefixe = (c && c.prefixe) || s.prefixe;
        const valeur = c ? c.valeur : 0;
        return `<tr>
          <td>${esc(s.label)}</td>
          <td><input type="text" id="num_p_${esc(s.type)}" value="${esc(prefixe)}" maxlength="8" style="width:90px;" ${modifiable?'':'disabled'} oninput="majApercuNumero('${jsAttr(s.type)}')"></td>
          <td><input type="number" min="0" id="num_v_${esc(s.type)}" value="${valeur}" style="width:110px;" ${modifiable?'':'disabled'} oninput="majApercuNumero('${jsAttr(s.type)}')"></td>
          <td><code id="num_a_${esc(s.type)}">${esc(window.apercuNumero(prefixe, valeur, annee))}</code></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ${modifiable? `<div style="margin-top:14px;"><button class="btn primary" onclick="saveNumerotation()">Enregistrer la numérotation</button></div>` : ''}`;
}

function majApercuNumero(type){
  const annee = new Date().getFullYear();
  const p = document.getElementById('num_p_'+type).value;
  const v = parseInt(document.getElementById('num_v_'+type).value, 10) || 0;
  document.getElementById('num_a_'+type).textContent = window.apercuNumero(p, v, annee);
}

async function saveNumerotation(){
  const annee = new Date().getFullYear();
  const uuid = window.societeActive().uuid;
  try{
    for(const s of window.SERIES_NUMEROTATION){
      const prefixe = document.getElementById('num_p_'+s.type).value;
      const valeur = parseInt(document.getElementById('num_v_'+s.type).value, 10) || 0;
      const actuel = (compteursCharges||[]).find(x=> x.type===s.type && x.annee===annee);

      /* Baisser le compteur réattribuerait des numéros déjà émis : on prévient
         plutôt que de créer des doublons en silence. */
      if(actuel && valeur < actuel.valeur){
        if(!confirm(`${s.label} : passer de ${actuel.valeur} à ${valeur} réattribuera des numéros déjà utilisés. Continuer ?`)) return;
      }
      await window.reglerCompteur(uuid, s.type, prefixe, valeur, annee);
    }
    await rafraichirNumerotation();
    showToast('Numérotation enregistrée.', 'success');
  }catch(err){
    console.error('Enregistrement de la numérotation refusé', err);
    showToast(err.message || 'Enregistrement impossible.');
  }
}

function renderNumerotationSection(){
  return `<div class="card">
    <div class="card-title" style="margin-bottom:10px;">🔢 Numérotation</div>
    <div class="card-sub" style="margin-bottom:12px;">Préfixe et point de départ de chaque série, pour ${esc(societeName(state.societeId))} en ${new Date().getFullYear()}. Les numéros sont attribués par la base de façon atomique — deux personnes ne peuvent pas obtenir le même.</div>
    <div id="zoneNumerotation"><div class="empty">Chargement…</div></div>
    <small style="display:block; margin-top:12px; color:var(--text-dim); font-size:11px;">Les bons de commande n'ont pas de série : leur numéro figure sur le document du client. Les compteurs repartent de zéro chaque année civile.</small>
  </div>`;
}

/**
 * Enregistre les préférences.
 *
 * Ne lit que les champs réellement présents dans le DOM : un onglet masqué
 * garde ses valeurs au lieu d'être écrasé par des chaînes vides.
 */
async function saveReglages(){
  const el = id => document.getElementById(id);
  const s = state.settings[state.societeId] || {};
  const base = s.reglages || window.REGLAGES_DEFAUT;

  const documents = { ...base.documents };
  const champsNum = { rg_validiteDevis:'validiteDevisJours', rg_delaiPaiement:'delaiPaiementJours', rg_tva:'tvaDefaut' };
  Object.entries(champsNum).forEach(([id, cle])=>{
    if(el(id)){ const n = parseFloat(el(id).value); if(Number.isFinite(n)) documents[cle] = n; }
  });
  const champsTxt = { rg_mentionAcceptation:'mentionAcceptation', rg_conditionsDevis:'conditionsDevis', rg_mentionsComplementaires:'mentionsComplementaires', rg_piedDePage:'piedDePage' };
  Object.entries(champsTxt).forEach(([id, cle])=>{ if(el(id)) documents[cle] = el(id).value; });
  if(el('rg_afficherIban')) documents.afficherIban = el('rg_afficherIban').checked;

  const seuils = { ...base.seuils };
  Object.keys(base.seuils).forEach(k=>{
    const e = el('rg_seuil_'+k);
    if(e){ const n = parseFloat(e.value); if(Number.isFinite(n)) seuils[k] = Math.max(0, n); }
  });

  const notifications = { ...base.notifications };
  if(el('rg_notifActives')) notifications.actives = el('rg_notifActives').checked;
  if(el('rg_notifDestinataires')) notifications.destinataires = el('rg_notifDestinataires').value;

  const unites = el('rg_unites')
    ? el('rg_unites').value.split(',').map(x=>x.trim()).filter(Boolean)
    : base.unites;

  /* Le nettoyage — tri, doublons, valeurs aberrantes — est fait par
     `fusionnerReglages` à la relecture : une seule règle, côté testable. */
  const tauxTva = el('rg_tauxTva')
    ? el('rg_tauxTva').value.split(',').map(x=>parseFloat(x.trim())).filter(n=>Number.isFinite(n) && n>=0)
    : base.tauxTva;

  const obj = { ...s, reglages: { ...base, documents, unites, tauxTva, seuils, notifications } };
  state.settings[state.societeId] = obj;

  const r = await window.stSet('settings:'+state.societeId, obj);
  if(!r){ showToast(saveFailedMessage()); return; }

  // Relire : la fusion réapplique les défauts sur ce qui a été vidé
  const relu = await window.stGet('settings:'+state.societeId);
  if(relu) state.settings[state.societeId] = relu;
  renderTab();
  showToast('Préférences enregistrées.', 'success');
}

/**
 * Logo et couleur dominante, réunis.
 *
 * Ces deux réglages vivaient chacun dans un onglet différent — le logo dans
 * « Organisation », la couleur dans « Devis & factures » — et personne ne
 * trouvait le second. Ils font une seule chose : l'apparence de la société,
 * à l'écran comme sur les documents.
 */
function renderIdentiteVisuelleSection(){
  const s = state.settings[state.societeId] || {};
  return `<div class="card">
    <div class="card-title" style="margin-bottom:4px;">🎨 Identité visuelle</div>
    <div class="card-sub" style="margin-bottom:16px;">Reprise par l'application et par tous les documents générés — devis, factures, bons de commande.</div>

    <div class="reglage-duo">
      <div style="display:flex; flex-direction:column; align-items:flex-start; gap:10px;">
        <div class="reglage-titre" style="margin:0;">Logo</div>
        ${s.logo
          ? `<div style="padding:12px; border:1px solid var(--border); border-radius:10px; background:var(--surface);"><img src="${s.logo}" style="max-height:70px; max-width:220px; display:block;"></div>`
          : `<div class="card-sub">Aucun logo : les documents porteront le nom de la société.</div>`}
        <label class="btn small" style="cursor:pointer;">📷 ${s.logo? 'Changer le logo' : 'Ajouter un logo'}<input type="file" accept="image/*" style="display:none;" onchange="handleLogoUpload(this.files[0])"></label>
      </div>
      <div>
        <div class="reglage-titre">Couleur dominante</div>
        <div style="display:flex; align-items:center; gap:12px;">
          <input type="color" id="ie_couleur" value="${esc(reglagesCourants().documents.couleurAccent)}" oninput="apercuCouleur(this.value)"
                 style="width:56px; height:40px; padding:2px; border:1px solid var(--border); border-radius:10px; cursor:pointer; background:var(--surface);">
          <div id="rg_couleurApercu"></div>
        </div>
        <small class="card-sub" style="display:block; margin-top:8px;">Les tons clair et foncé s'en déduisent. L'écran change tout de suite ; enregistrez pour le garder.</small>
      </div>
    </div>

    <button class="btn primary" style="margin-top:6px;" onclick="saveInfosEntreprise()">Enregistrer</button>
  </div>`;
}

function renderDocumentsLegauxSection(){
  const s = state.settings[state.societeId] || {};
  const docs = s.documentsLegaux || [];
  return `<div class="card" style="margin-top:22px;">
    <div class="card-title" style="margin-bottom:4px;">📑 Documents légaux de l'entreprise</div>
    <div class="card-sub" style="margin-bottom:14px;">KBIS, assurances, attestations — avec alerte automatique avant expiration.</div>
    <div class="entretien-add-row">
      <select id="docLegalType">${TYPES_DOC_LEGAUX.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
      <input type="date" id="docLegalEmission" placeholder="Date d'émission">
      <input type="date" id="docLegalExpiration" placeholder="Date d'expiration (si applicable)">
      <label class="btn small" style="cursor:pointer;">📎 Fichier<input type="file" id="docLegalFichier" accept=".pdf,image/*" style="display:none;"></label>
      <button class="btn primary" onclick="addDocumentLegal()">+ Ajouter</button>
    </div>
    <div class="achats-list" style="margin-top:10px;">
      ${docs.length? [...docs].sort((a,b)=>(a.dateExpiration||'9999').localeCompare(b.dateExpiration||'9999')).map(d=>{
        const j = joursAvant(d.dateExpiration);
        const alerte = j!=null && j<=30;
        return `<div class="achat-row" style="--cat-color:${alerte?(j<0?'#EF5A6F':'#F0A82E'):'#5BC97A'};">
          <div class="achat-row-icon" style="background:${alerte?(j<0?'#EF5A6F22':'#F0A82E22'):'#5BC97A22'}; color:${alerte?(j<0?'#EF5A6F':'#F0A82E'):'#5BC97A'};">📑</div>
          <div class="achat-row-main">
            <div class="achat-designation">${esc(d.type)}${d.fichierNom? ` · <a href="javascript:void(0)" onclick="openAttachmentPreview('${jsAttr(d.fichierData)}','${jsAttr(d.fichierNom)}')">📎 voir</a>`:''}</div>
            <div class="achat-date">${d.dateEmission? `Émis le ${fmtDate(d.dateEmission)}`:''}${d.dateExpiration? ` · expire le ${fmtDate(d.dateExpiration)}`:''}${alerte? ` <span class="badge ${j<0?'danger':'warn'}">${j<0?'EXPIRÉ':'DANS '+j+' J'}</span>`:''}</div>
          </div>
          <button class="btn small danger" onclick="removeDocumentLegal('${jsAttr(d.id)}')">✕</button>
        </div>`;
      }).join('') : '<div class="empty">Aucun document légal enregistré.</div>'}
    </div>
  </div>`;
}
async function addDocumentLegal(){
  const type = document.getElementById('docLegalType').value;
  const dateEmission = document.getElementById('docLegalEmission').value;
  const dateExpiration = document.getElementById('docLegalExpiration').value;
  const fichierInput = document.getElementById('docLegalFichier');
  if(!state.settings[state.societeId]) state.settings[state.societeId] = {};
  const s = state.settings[state.societeId];
  if(!s.documentsLegaux) s.documentsLegaux = [];
  const finishSave = async (fichierNom, fichierData) => {
    s.documentsLegaux.push({ id: uid(), type, dateEmission, dateExpiration, fichierNom: fichierNom||'', fichierData: fichierData||null });
    await window.stSet('settings:'+state.societeId, s);
    await loadAll();
    renderTab();
    showToast('Document légal enregistré.', 'success');
  };
  if(fichierInput && fichierInput.files[0]){
    const reader = new FileReader();
    reader.onload = (ev)=> finishSave(fichierInput.files[0].name, ev.target.result);
    reader.readAsDataURL(fichierInput.files[0]);
  } else {
    await finishSave(null, null);
  }
}
async function removeDocumentLegal(docId){
  const s = state.settings[state.societeId];
  if(!s) return;
  s.documentsLegaux = (s.documentsLegaux||[]).filter(d=>d.id!==docId);
  await window.stSet('settings:'+state.societeId, s);
  await loadAll();
  renderTab();
}
async function handleLogoUpload(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    if(!state.settings[state.societeId]) state.settings[state.societeId] = {};
    state.settings[state.societeId].logo = ev.target.result;
    await window.stSet('settings:'+state.societeId, state.settings[state.societeId]);
    await loadAll();
    renderTab();
    showToast('Logo mis à jour.', 'success');
  };
  reader.readAsDataURL(file);
}
async function saveInfosEntreprise(){
  const s = state.settings[state.societeId] || {};
  const v = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const coche = (id) => { const el = document.getElementById(id); return el ? el.checked : undefined; };

  const obj = { ...s,
    adresse: v('ie_adresse'),
    codePostal: v('ie_codePostal'),
    ville: v('ie_ville'),
    telephone: v('ie_telephone'),
    email: v('ie_email'),
    siret: v('ie_siret'),
    gerant: v('ie_gerant'),
    gerantTelephone: v('ie_gerantTelephone'),

    /* Identité légale et facturation électronique. Chacun de ces noms doit
       figurer dans CHAMPS_SOCIETE, sinon il part dans le jsonb au lieu de sa
       colonne — un test de garde le vérifie. */
    raisonSocialeLegale: v('ie_raisonSocialeLegale'),
    formeJuridique: v('ie_formeJuridique'),
    siren: v('ie_siren'),
    tvaIntracom: v('ie_tvaIntracom'),
    codeNaf: v('ie_codeNaf'),
    capitalSocial: v('ie_capitalSocial'),
    rcsNumero: v('ie_rcsNumero'),
    rcsVille: v('ie_rcsVille'),
    paysCode: v('ie_paysCode'),
    regimeTva: v('ie_regimeTva'),
    ereportingRegime: v('ie_ereportingRegime'),
    tvaSurEncaissements: coche('ie_tvaSurEncaissements'),
    autoliquidationBatiment: coche('ie_autoliquidationBatiment'),
    mentionPenalitesRetard: v('ie_mentionPenalitesRetard'),
    indemniteRecouvrement: v('ie_indemniteRecouvrement'),
    assuranceDecennaleNom: v('ie_assuranceDecennaleNom'),
    assuranceDecennalePolice: v('ie_assuranceDecennalePolice'),
    adresseElectroniqueSchema: v('ie_adresseElectroniqueSchema'),
    adresseElectroniqueValeur: v('ie_adresseElectroniqueValeur'),
    iban: v('ie_iban'),
    bic: v('ie_bic'),
  };

  /* Un champ absent de l'écran vaut « inchangé », pas « effacé » : les onglets
     de réglages ne rendent pas tous les mêmes champs. */
  for (const [k, val] of Object.entries(obj)) if (val === undefined) delete obj[k];

  /* La couleur vit dans les réglages de documents, pas dans une colonne de
     `societes` : elle voyage donc à part, et on ne recopie que la clé touchée —
     écraser `documents` en entier effacerait le délai de paiement et le reste. */
  const couleur = v('ie_couleur');
  if(couleur){
    obj.reglages = { ...(s.reglages||{}),
      documents: { ...((s.reglages||{}).documents||{}), couleurAccent: couleur } };
  }

  const anomalies = window.verifierEntite(obj);
  if(anomalies.length){ alert(window.messageAnomalies(anomalies)); return; }

  state.settings[state.societeId] = obj;
  const r = await window.stSet('settings:'+state.societeId, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await loadAll();
  renderTab();
  showToast('Informations enregistrées.', 'success');
}

/* ---------- Clients (annuaire) ---------- */
function renderChantiers(){
  if(state.viewingChantier) return renderChantierDetail(state.viewingChantier);
  const list = chantierListItems();
  return `
    <div class="page-head"><h1>Chantiers</h1>${state.formOpen.chantier? '' : '<button class="btn primary" onclick="openForm(\'chantier\')">+ Nouveau chantier</button>'}</div>
    ${state.formOpen.chantier ? '' : `<div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap;">
      <input type="text" id="chantierSearchInput" style="flex:1; min-width:220px;" value="${esc(state.chantierSearch||'')}" placeholder="Rechercher : nom, client, adresse…" oninput="filterChantiersList(this.value)">
      <select style="width:auto; min-width:180px;" onchange="filterChantierConducteur(this.value)">${conducteurFilterOptions(state.chantierConducteurFilter)}</select>
      <select style="width:auto; min-width:200px;" onchange="filterChantierType(this.value)">
        <option value="" ${!state.chantierTypeFilter?'selected':''}>Tous les chantiers</option>
        <option value="rehabilitation" ${state.chantierTypeFilter==='rehabilitation'?'selected':''}>Réhabilitation</option>
        <option value="neuf" ${state.chantierTypeFilter==='neuf'?'selected':''}>Chantier neuf</option>
      </select>
    </div>`}
    <div id="formZoneChantier">${state.formOpen.chantier? chantierForm(): ''}</div>
    <div id="chantierListZone">${renderChantierGridHTML(list)}</div>
  `;
}
function chantierListItems(){
  return state.chantiers.filter(c=>c.societeId===state.societeId);
}
function chantierMatchesSearch(c, q){
  if(!q) return true;
  const haystack = [c.nom, c.client, c.adresse, c.codePostal, c.ville].filter(Boolean).join(' ').toLowerCase();
  return window.multiWordMatch(haystack, q);
}
function renderChantierGridHTML(list){
  const q = (state.chantierSearch||'').trim().toLowerCase();
  const cf = state.chantierConducteurFilter||'';
  const tf = state.chantierTypeFilter||'';
  const filtered = list.filter(c=>{
    if(tf && c.type!==tf) return false;
    if(!chantierMatchesSearch(c, q)) return false;
    if(cf && c.conducteur !== cf) return false;
    return true;
  });
  return `<div class="chantier-grid">
    ${filtered.length? filtered.map(c=>chantierCardA4HTML(c)).join('') : '<div class="empty">Aucun chantier ne correspond.</div>'}
  </div>`;
}
function filterChantiersList(value){
  state.chantierSearch = value;
  const zone = document.getElementById('chantierListZone');
  if(zone) zone.innerHTML = renderChantierGridHTML(chantierListItems());
}
function filterChantierConducteur(value){
  state.chantierConducteurFilter = value;
  const zone = document.getElementById('chantierListZone');
  if(zone) zone.innerHTML = renderChantierGridHTML(chantierListItems());
}
function filterChantierType(value){
  state.chantierTypeFilter = value;
  const zone = document.getElementById('chantierListZone');
  if(zone) zone.innerHTML = renderChantierGridHTML(chantierListItems());
}
function chantierCardA4HTML(c){
  const typeLabel = c.type==='neuf' ? 'Chantier neuf' : 'Réhabilitation';
  const nbCR = (c.comptesRendus||[]).length;
  const nbDevis = state.devis.filter(d=>d.chantierId===c.id).length;
  const nbFactures = state.factures.filter(f=>f.chantierId===c.id).length;
  const lignes = c.dpgfLignes||[];
  const totalHT = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
  const totalFacture = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + ((parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0)) * ((parseFloat(l.avancementCumule)||0)/100), 0);
  const pctAvancement = totalHT>0 ? Math.round(totalFacture/totalHT*100) : 0;
  return `<div class="chantier-a4" onclick="openChantierDetail('${jsAttr(c.id)}')">
    <div class="chantier-a4-type ${c.type==='neuf'?'neuf':'rehab'}">${typeLabel}</div>
    <div class="chantier-a4-nom">${esc(c.nom)}</div>
    <div class="chantier-a4-client">${esc(c.client||'')}</div>
    <div class="chantier-a4-adresse">${esc(withVille(c.adresse, c.codePostal, c.ville))}</div>
    <div class="chantier-a4-dates">${c.dateDebut? fmtDate(c.dateDebut):'?'} → ${c.dateFin? fmtDate(c.dateFin):'?'}</div>
    <div class="chantier-a4-statut"><span class="badge ${c.statut==='terminé'?'success':c.statut==='en cours'?'warn':'info'}">${esc(c.statut||'en préparation')}</span></div>
    <div class="chantier-a4-montant">${moneyDisplay(totalHT)} <span class="card-sub">HT</span></div>
    <div class="chantier-a4-avancement-box">
      <div class="chantier-a4-avancement-bar"><div class="chantier-a4-avancement-fill" style="width:${pctAvancement}%;"></div></div>
      <div class="chantier-a4-avancement-ring" style="--pct:${pctAvancement};"><span>${pctAvancement}%</span></div>
    </div>
    <div class="chantier-a4-footer">
      <span class="a4-stat a4-stat-cr" title="Comptes-rendus">📋 ${nbCR}</span>
      <span class="a4-stat a4-stat-devis" title="Devis">📄 ${nbDevis}</span>
      <span class="a4-stat a4-stat-facture" title="Factures">🧾 ${nbFactures}</span>
    </div>
  </div>`;
}
function chantierForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le chantier' : 'Nouveau chantier'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom du chantier</label><input type="text" id="ch_nom" value="${esc(e.nom)}" placeholder="Ex : Résidence Les Tilleuls — Réfection façades"></div>
      <div class="field"><label>Type</label><select id="ch_type">
        <option value="rehabilitation" ${e.type==='rehabilitation'||!e.type?'selected':''}>Réhabilitation</option>
        <option value="neuf" ${e.type==='neuf'?'selected':''}>Chantier neuf</option>
      </select></div>
      <div class="field"><label>Statut</label><select id="ch_statut">
        <option value="en préparation" ${(!e.statut||e.statut==='en préparation')?'selected':''}>En préparation</option>
        <option value="en cours" ${e.statut==='en cours'?'selected':''}>En cours</option>
        <option value="terminé" ${e.statut==='terminé'?'selected':''}>Terminé</option>
      </select></div>
      <div class="field"><label>Client</label><select id="ch_client">${clientSelectOptions(e.client)}</select></div>
      <div class="field"><label>Conducteur de travaux</label><select id="ch_conducteur">${conducteurSelectOptions(conducteurIdDe(e))}</select></div>
      <div class="address-trio">
        <div class="field" style="position:relative;">
          <label>Adresse</label>
          <input type="text" id="ch_adresse" autocomplete="off" value="${esc(e.adresse)}" data-suggest="chAdresseSuggestions"
                 oninput="searchAdresse(this, {adresse:'ch_adresse', codePostal:'ch_codePostal', ville:'ch_ville'})"
                 onblur="setTimeout(()=>{const b=document.getElementById('chAdresseSuggestions'); if(b) b.style.display='none';},150)">
          <div id="chAdresseSuggestions" class="suggest-box"></div>
        </div>
        <div class="field"><label>Code postal</label><input type="text" id="ch_codePostal" maxlength="5" inputmode="numeric" value="${esc(e.codePostal)}" oninput="lookupVilleParCodePostal(this.value,'ch_ville')"></div>
        <div class="field"><label>Ville</label><input type="text" id="ch_ville" value="${esc(e.ville)}"></div>
      </div>
      <div class="field"><label>Date de début</label><input type="date" id="ch_dateDebut" value="${e.dateDebut||''}"></div>
      <div class="field"><label>Date de fin prévisionnelle</label><input type="date" id="ch_dateFin" value="${e.dateFin||''}"></div>
      <div class="field full"><label>Notes</label><input type="text" id="ch_notes" value="${esc(e.notes)}" placeholder="Remarques…"></div>
    </div>
    <div class="section-title" style="margin-top:16px;">📋 Informations PPSPS (optionnel)</div>
    <div class="card-sub" style="margin-bottom:10px;">Utilisées pour générer automatiquement le PPSPS de ce chantier.</div>
    <div class="field-grid">
      <div class="field full"><label>Lot</label><input type="text" id="ch_ppspsLot" value="${esc(e.ppspsLot)}" placeholder="Ex : Peintures intérieures"></div>
      <div class="field"><label>Maître de l'ouvrage (si différent du client)</label><textarea id="ch_ppspsMaitreOuvrage" rows="3" placeholder="Nom, société, adresse…">${esc(e.ppspsMaitreOuvrage)}</textarea></div>
      <div class="field"><label>Maître d'œuvre</label><textarea id="ch_ppspsMaitreOeuvre" rows="3" placeholder="Nom, société, adresse…">${esc(e.ppspsMaitreOeuvre)}</textarea></div>
      <div class="field"><label>Coordonnateur S.P.S.</label><textarea id="ch_ppspsCoordinateurSPS" rows="3" placeholder="Nom, société, adresse…">${esc(e.ppspsCoordinateurSPS)}</textarea></div>
      <div class="field"><label>Effectif moyen prévisible</label><input type="text" id="ch_ppspsEffectifMoyen" value="${esc(e.ppspsEffectifMoyen)}"></div>
    </div>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn primary" onclick="saveChantier()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('chantier')">Annuler</button>
    </div>
  </div>`;
}
async function saveChantier(){
  const e = state.editing;
  const nom = document.getElementById('ch_nom').value.trim();
  if(!nom){ alert('Le nom du chantier est requis.'); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, createdAt: e.createdAt || new Date().toISOString(),
    nom, type: document.getElementById('ch_type').value,
    statut: document.getElementById('ch_statut').value,
    client: document.getElementById('ch_client').value,
    ...conducteurDuSelect('ch_conducteur'),
    adresse: document.getElementById('ch_adresse').value,
    codePostal: document.getElementById('ch_codePostal').value,
    ville: document.getElementById('ch_ville').value,
    dateDebut: document.getElementById('ch_dateDebut').value,
    dateFin: document.getElementById('ch_dateFin').value,
    notes: document.getElementById('ch_notes').value,
    comptesRendus: e.comptesRendus || [], dpgf: e.dpgf || [], cctp: e.cctp || [], todoList: e.todoList || [], devisComplementaires: e.devisComplementaires || [], achats: e.achats || [], dpgfLignes: e.dpgfLignes || [],
    ppspsLot: document.getElementById('ch_ppspsLot').value,
    ppspsMaitreOuvrage: document.getElementById('ch_ppspsMaitreOuvrage').value,
    ppspsMaitreOeuvre: document.getElementById('ch_ppspsMaitreOeuvre').value,
    ppspsCoordinateurSPS: document.getElementById('ch_ppspsCoordinateurSPS').value,
    ppspsEffectifMoyen: document.getElementById('ch_ppspsEffectifMoyen').value,
    inspections: e.inspections || [], ppsps: e.ppsps || [], doe: e.doe || [], ccap: e.ccap || [], avenants: e.avenants || [], dgd: e.dgd || [], infosDiverses: e.infosDiverses || '' };
  const r = await window.stSet('chantier:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('chantier');
  closeForm('chantier');
  showToast(e.id? 'Chantier modifié.' : 'Chantier créé.', 'success');
}
function openFacturerAvancement(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const table = document.getElementById('dpgfLignesTable_'+chantierId);
  const checkedIds = table ? [...table.querySelectorAll('.dpgf-ligne-select:checked')].map(cb=>cb.dataset.ligneId) : [];
  if(!checkedIds.length){ showToast('Cochez d\'abord au moins une ligne à facturer dans le tableau ci-dessus.'); return; }
  captureChantierDpgfLignesFromDOM(chantierId);
  const lignes = (c.dpgfLignes||[]).filter(l=>checkedIds.includes(l.id));
  const body = document.getElementById('avancementLignesBody');
  body.innerHTML = lignes.map((l,i)=>{
    const montant = (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0);
    const dejaFacture = parseFloat(l.avancementCumule)||0;
    const presets = [25,50,75,100].filter(p=>p>dejaFacture);
    return `<tr data-ligne-id="${l.id}" data-montant="${montant}" data-deja="${dejaFacture}">
      <td>${esc(l.designation)}</td>
      <td>${moneyDisplay(montant)}</td>
      <td>${dejaFacture.toFixed(0)}%</td>
      <td>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <input type="number" min="${dejaFacture}" max="100" step="1" value="${dejaFacture}" class="avancement-input" oninput="refreshAvancementTotal()" style="width:60px;">
          <div class="avancement-presets">
            ${presets.map(p=>`<button type="button" class="avancement-preset-btn" onclick="setAvancementPreset(this,${p})">${p}%</button>`).join('')}
          </div>
        </div>
      </td>
      <td class="avancement-montant-cell">${moneyDisplay(0)}</td>
    </tr>`;
  }).join('');
  document.getElementById('avancementModal').style.display = 'flex';
  document.getElementById('avancementModal').dataset.chantierId = chantierId;
  document.getElementById('avancementTotalHT').textContent = moneyDisplay(0);
}
function setAvancementPreset(btn, value){
  const row = btn.closest('tr');
  const input = row.querySelector('.avancement-input');
  input.value = value;
  refreshAvancementTotal();
}
function refreshAvancementTotal(){
  let total = 0;
  document.querySelectorAll('#avancementLignesBody tr').forEach(row=>{
    const montant = parseFloat(row.dataset.montant)||0;
    const deja = parseFloat(row.dataset.deja)||0;
    const input = row.querySelector('.avancement-input');
    const nouveau = Math.max(deja, Math.min(100, parseFloat(input.value)||deja));
    const aFacturer = montant * (nouveau - deja)/100;
    row.querySelector('.avancement-montant-cell').textContent = moneyDisplay(aFacturer);
    total += aFacturer;
  });
  document.getElementById('avancementTotalHT').textContent = moneyDisplay(total);
}
function closeFacturerAvancement(){
  document.getElementById('avancementModal').style.display = 'none';
}
async function confirmerFacturationAvancement(){
  const chantierId = document.getElementById('avancementModal').dataset.chantierId;
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const rows = [...document.querySelectorAll('#avancementLignesBody tr')];
  const lignesFacture = [];
  rows.forEach(row=>{
    const ligneId = row.dataset.ligneId;
    const montant = parseFloat(row.dataset.montant)||0;
    const deja = parseFloat(row.dataset.deja)||0;
    const input = row.querySelector('.avancement-input');
    const nouveau = Math.max(deja, Math.min(100, parseFloat(input.value)||deja));
    if(nouveau > deja){
      const aFacturer = montant * (nouveau-deja)/100;
      const dpgfLigne = c.dpgfLignes.find(l=>l.id===ligneId);
      lignesFacture.push({ type:'ligne', designation: `${dpgfLigne.designation} (avancement ${deja.toFixed(0)}% → ${nouveau.toFixed(0)}%)`, qte:1, prixUnitaire: aFacturer, tva: tvaDefaut() });
      if(dpgfLigne) dpgfLigne.avancementCumule = nouveau;
    }
  });
  if(!lignesFacture.length){ showToast('Aucun avancement supplémentaire à facturer.'); return; }
  await window.stSet('chantier:'+chantierId, c);
  const factureId = uid();
  // Brouillon : la base numérotera à l'émission.
  const factureObj = { id: factureId, societeId: state.societeId, numero: '', createdAt: new Date().toISOString(),
    client: c.client||'', adresse: c.adresse||'', codePostal: c.codePostal||'', ville: c.ville||'',
    date: todayISO(), echeance:'', lignes: lignesFacture, remisePourcentage:0, statut:'brouillon',
    chantierId: c.id, notes: `Situation de travaux — ${c.nom}` };
  await window.stSet('facture:'+factureId, factureObj);
  await recharger('chantier', 'facture');
  closeFacturerAvancement();
  renderTab();
  showToast('Facture d\'avancement créée avec succès.', 'success');
}
function openChantierDetail(id){
  state.viewingChantier = id;
  renderTab();
}
function closeChantierDetail(){
  state.viewingChantier = null;
  renderTab();
}
function renderChantierDetail(id){
  const c = state.chantiers.find(x=>x.id===id);
  if(!c) { state.viewingChantier = null; return renderChantiers(); }
  const typeLabel = c.type==='neuf' ? 'Chantier neuf' : 'Réhabilitation';

  const lignes = c.dpgfLignes||[];
  const totalHT = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
  const totalFacture = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + ((parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0)) * ((parseFloat(l.avancementCumule)||0)/100), 0);
  const pctAvancement = totalHT>0 ? Math.round(totalFacture/totalHT*100) : 0;
  const totalAchats = (c.achats||[]).reduce((s,a)=>s+(parseFloat(a.montant)||0),0);
  const nbFactures = state.factures.filter(f=>f.chantierId===c.id).length;
  const nbDevis = state.devis.filter(d=>d.chantierId===c.id).length;
  const nbComptesRendus = (c.comptesRendus||[]).length;

  return `
    <div class="page-head">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn small" onclick="closeChantierDetail()">← Retour aux chantiers</button>
        <h1 style="margin:0;">${esc(c.nom)}</h1>
      </div>
      ${state.formOpen.chantier? '' : `<button class="btn" onclick="editItem('chantier','${jsAttr(c.id)}')">Modifier les infos</button>`}
    </div>
    ${state.formOpen.chantier? chantierForm() : `
    <div class="chantier-hero">
      <div class="chantier-hero-top">
        <div>
          <div class="card-sub">${typeLabel} · ${esc(c.client||'')}</div>
          <div class="card-sub">${esc(withVille(c.adresse, c.codePostal, c.ville))}</div>
          <div class="card-sub">${c.dateDebut? fmtDate(c.dateDebut):'?'} → ${c.dateFin? fmtDate(c.dateFin):'?'}</div>
        </div>
        <span class="badge ${c.statut==='terminé'?'success':c.statut==='en cours'?'warn':'info'}">${esc(c.statut||'en préparation')}</span>
      </div>
      <div class="chantier-hero-stats">
        <div class="hero-stat">
          <div class="hero-ring" style="--pct:${pctAvancement}">
            <span>${pctAvancement}%</span>
          </div>
          <div class="hero-stat-label">Avancement<br>facturé</div>
        </div>
        <div class="hero-stat-block">
          <div class="hero-stat-value">${moneyDisplay(totalHT)}</div>
          <div class="hero-stat-label">Total DPGF (HT)</div>
        </div>
        <div class="hero-stat-block">
          <div class="hero-stat-value">${nbDevis}</div>
          <div class="hero-stat-label">Devis</div>
        </div>
        <div class="hero-stat-block">
          <div class="hero-stat-value">${nbComptesRendus}</div>
          <div class="hero-stat-label">Compte${nbComptesRendus>1?'s':''}-rendu${nbComptesRendus>1?'s':''}</div>
        </div>
        <div class="hero-stat-block">
          <div class="hero-stat-value">${moneyDisplay(totalAchats)}</div>
          <div class="hero-stat-label">Achats</div>
        </div>
        <div class="hero-stat-block">
          <div class="hero-stat-value">${nbFactures}</div>
          <div class="hero-stat-label">Facture${nbFactures>1?'s':''}</div>
        </div>
      </div>
    </div>
    <div class="chantier-sections">
      ${chantierComptesRendusHTML(c)}
      ${chantierInfosDiversesHTML(c)}
      ${chantierDpgfHTML(c)}
      ${chantierTodoHTML(c)}
      ${chantierDevisComplHTML(c)}
      ${chantierFacturesHTML(c)}
      ${chantierAchatsHTML(c)}
      ${chantierDpgfLignesHTML(c)}
    </div>
    `}
  `;
}
function chantierInfosDiversesHTML(c){
  return `<div class="chantier-section">
    <div class="section-title">📝 Informations diverses</div>
    <textarea id="chantierInfosDiverses_${c.id}" rows="4" placeholder="Codes d'accès, contacts utiles, remarques, particularités du chantier…" style="width:100%;" onblur="saveChantierInfosDiverses('${jsAttr(c.id)}', this.value)">${esc(c.infosDiverses)}</textarea>
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🦺 Sécurité</span>
    </div>
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; border-top:none; padding-top:0; font-weight:600; font-size:12.5px;">
      <span>🔍 Visites d'inspection</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'inspections','insp_file_'+c.id,'.pdf,image/*')}</label>
    </div>
    ${chantierFileListEditableDateHTML(c, 'inspections')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:12.5px;">
      <span>📋 PPSPS</span>
      <div style="display:flex; gap:8px;">
        <button class="btn small primary" onclick="genererPPSPS('${jsAttr(c.id)}')">📄 Générer (Word)</button>
        <label class="btn small" style="cursor:pointer;">+ Fichier${chantierFileInputHTML(c.id,'ppsps','ppsps_file_'+c.id,'.pdf,.docx,image/*')}</label>
      </div>
    </div>
    ${chantierFileListEditableDateHTML(c, 'ppsps')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:12.5px;">
      <span>📁 DOE</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'doe','doe_file_'+c.id,'.pdf,.docx,.xlsx,image/*')}</label>
    </div>
    ${chantierFileListEditableDateHTML(c, 'doe')}
  </div>`;
}
async function saveChantierInfosDiverses(chantierId, value){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  if(c.infosDiverses === value) return;
  c.infosDiverses = value;
  const r = await window.stSet('chantier:'+chantierId, c);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('chantier');
  showToast('Informations enregistrées.', 'success');
}
function chantierFileInputHTML(chantierId, listKey, inputId, accept){
  return `<input type="file" id="${inputId}" accept="${accept||'*'}" style="display:none;" onchange="handleChantierFileAdd('${jsAttr(chantierId)}','${jsAttr(listKey)}', this.files[0]); this.value='';">`;
}
async function handleChantierFileAdd(chantierId, listKey, file){
  if(!file) return;
  if(file.size > 8*1024*1024){ showToast('Fichier trop volumineux (8 Mo maximum).'); return; }
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    const c = state.chantiers.find(x=>x.id===chantierId);
    if(!c) return;
    if(!c[listKey]) c[listKey] = [];
    const entry = { id: uid(), nom: file.name, date: todayISO(), data: ev.target.result };
    if(listKey==='comptesRendus') entry.vu = false;
    c[listKey].push(entry);
    await window.stSet('chantier:'+chantierId, c);
    await recharger('chantier');
    renderTab();
  };
  reader.readAsDataURL(file);
}
async function removeChantierFile(chantierId, listKey, fileId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  c[listKey] = (c[listKey]||[]).filter(f=>f.id!==fileId);
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
}
function chantierFileListHTML(c, listKey, dlPrefix){
  const list = c[listKey]||[];
  if(!list.length) return '<div class="empty">Aucun fichier pour l\'instant.</div>';
  return list.map(f=>`
    <div class="chantier-file-row">
      <a href="javascript:void(0)" onclick="openAttachmentPreview('${jsAttr(f.data)}','${jsAttr(f.nom)}')">📎 ${esc(f.nom)}</a>
      <span class="card-sub">${fmtDate(f.date)}</span>
      <button class="btn small danger" onclick="removeChantierFile('${jsAttr(c.id)}','${jsAttr(listKey)}','${jsAttr(f.id)}')">✕</button>
    </div>`).join('');
}

function chantierFileListEditableDateHTML(c, listKey){
  const list = c[listKey]||[];
  if(!list.length) return '<div class="empty">Aucun fichier pour l\'instant.</div>';
  return list.map(f=>`
    <div class="chantier-file-row">
      <a href="javascript:void(0)" onclick="openAttachmentPreview('${jsAttr(f.data)}','${jsAttr(f.nom)}')">📎 ${esc(f.nom)}</a>
      <input type="date" value="${f.date||''}" style="width:auto; font-size:11px; padding:3px 6px;" onchange="updateChantierFileDate('${jsAttr(c.id)}','${jsAttr(listKey)}','${jsAttr(f.id)}', this.value)">
      <button class="btn small danger" onclick="removeChantierFile('${jsAttr(c.id)}','${jsAttr(listKey)}','${jsAttr(f.id)}')">✕</button>
    </div>`).join('');
}
async function updateChantierFileDate(chantierId, listKey, fileId, newDate){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const f = (c[listKey]||[]).find(x=>x.id===fileId);
  if(!f) return;
  f.date = newDate;
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  showToast('Date mise à jour.', 'success');
}
function dataUrlToUint8Array(dataUrl){
  const base64 = dataUrl.split(',')[1];
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for(let i=0;i<binStr.length;i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}
function moisAnnee(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr+'T00:00:00');
  return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
async function genererPPSPS(chantierId){
  if(typeof docx === 'undefined'){ showToast('La génération de documents Word nécessite une connexion internet (bibliothèque non chargée). Réessayez dans quelques instants.'); return; }
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const s = state.settings[state.societeId] || {};
  const socNom = societeName(state.societeId);
  showToast('Génération du PPSPS en cours…', 'success', 2500);

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, HeadingLevel, ImageRun, VerticalAlign, PageBreak, ShadingType } = docx;

  const P = (text, opts={}) => new Paragraph({ children:[new TextRun({text, ...opts})], spacing:{after:120} });
  const PB = (text, opts={}) => new Paragraph({ children:[new TextRun({text, bold:true, ...opts})], spacing:{after:120} });
  const multiline = (text) => (text||'').split('\n').filter(Boolean).map(l => new Paragraph({ children:[new TextRun({text:l})], spacing:{after:40} }));
  const cell = (children, opts={}) => new TableCell({ children: Array.isArray(children)?children:[children], width:{size:opts.width||2000, type:WidthType.DXA}, shading: opts.shade? {type:ShadingType.CLEAR, fill:opts.shade}: undefined, verticalAlign: VerticalAlign.CENTER, margins:{top:60,bottom:60,left:100,right:100} });
  const headerCell = (text,width) => cell([new Paragraph({children:[new TextRun({text,bold:true})]})], {width, shade:'D9D9D9'});
  const sectionTitle = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing:{before:300, after:200} });
  const subTitle = (text) => new Paragraph({ children:[new TextRun({text, bold:true, size:24})], spacing:{before:200, after:120} });

  const maitreOuvrage = c.ppspsMaitreOuvrage || c.client || '';
  const maitreOeuvre = c.ppspsMaitreOeuvre || '';
  const coordSPS = c.ppspsCoordinateurSPS || '';
  const periode = (c.dateDebut||c.dateFin) ? `Du ${c.dateDebut?fmtDate(c.dateDebut):'?'} au ${c.dateFin?fmtDate(c.dateFin):'?'}` : '';

  const children = [];
  if(s.logo){
    try{
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children:[ new ImageRun({ data: dataUrlToUint8Array(s.logo), type:'png', transformation:{width:170, height:125} }) ], spacing:{after:300} }));
    }catch(err){ /* logo illisible, on continue sans */ }
  }
  children.push(new Table({
    width:{size:9000, type:WidthType.DXA}, columnWidths:[9000],
    rows:[ new TableRow({ children:[ new TableCell({
      width:{size:9000, type:WidthType.DXA}, margins:{top:200,bottom:200,left:200,right:200},
      children:[
        new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:socNom, bold:true, size:28})], spacing:{after:300}}),
        new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:'PLAN PARTICULIER DE SECURITE ET DE PROTECTION DE LA SANTE', bold:true, size:22})], spacing:{after:120}}),
        new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:'P.P.S.P.S.', bold:true, size:40})], spacing:{after:300}}),
        new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:'Chantier :', bold:true, size:22})], spacing:{after:120}}),
        new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:c.nom, bold:true, size:28})], spacing:{after:60}}),
      ]
    })]})]
  }));
  children.push(new Paragraph({text:'', spacing:{after:300}}));
  children.push(new Paragraph({children:[new TextRun({text:'Adresse du chantier : ', bold:true}), new TextRun({text:withVille(c.adresse,c.codePostal,c.ville)})], spacing:{after:120}}));
  children.push(new Paragraph({children:[new TextRun({text:"Période d'exécution : ", bold:true}), new TextRun({text:periode})], spacing:{after:120}}));
  children.push(new Paragraph({children:[new TextRun({text:'Lot : ', bold:true}), new TextRun({text:c.ppspsLot||''})], spacing:{after:120}}));
  children.push(new Paragraph({children:[new TextRun({text:"Maître de l'ouvrage : ", bold:true})], spacing:{after:20}}));
  children.push(...multiline(maitreOuvrage));
  children.push(new Paragraph({text:'', spacing:{after:120}}));
  children.push(new Paragraph({children:[new TextRun({text:"Maître d'œuvre : ", bold:true})], spacing:{after:20}}));
  children.push(...multiline(maitreOeuvre));
  children.push(new Paragraph({text:'', spacing:{after:120}}));
  children.push(new Paragraph({children:[new TextRun({text:'Coordonnateur S.P.S. : ', bold:true})], spacing:{after:20}}));
  children.push(...multiline(coordSPS));
  children.push(new Paragraph({text:'', spacing:{after:200}}));
  children.push(new Table({
    width:{size:9000, type:WidthType.DXA}, columnWidths:[1200,1500,4800,1500],
    rows:[
      new TableRow({children:[headerCell('Indice',1200), headerCell('Date',1500), headerCell('Nature de la modification',4800), headerCell('Rédacteur',1500)]}),
      new TableRow({children:[cell(new Paragraph('00'),{width:1200}), cell(new Paragraph(fmtDate(todayISO())),{width:1500}), cell(new Paragraph('Emission initiale'),{width:4800}), cell(new Paragraph(s.gerant||''),{width:1500})]}),
      new TableRow({children:[cell(new Paragraph(''),{width:1200}), cell(new Paragraph(''),{width:1500}), cell(new Paragraph(''),{width:4800}), cell(new Paragraph(''),{width:1500})]}),
    ]
  }));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(sectionTitle('I - RENSEIGNEMENTS GENERAUX'));
  children.push(subTitle("1.1 - L'entreprise :"));
  children.push(P('Nom ou Raison Sociale : '+socNom));
  children.push(P('Téléphone : '+(s.telephone||'')+'    mail : '+(s.email||'')));
  children.push(P('Qualité : '));
  children.push(P('Nom et qualités du représentant de l\u2019entreprise présent sur le chantier'));
  children.push(P('Nom : '+(s.gerant||'')));
  children.push(P('Téléphone : '+(s.gerantTelephone||s.telephone||'')+'    mail : '+(s.email||'')));
  children.push(subTitle('1.2 - Le chantier :'));
  children.push(P('Adresse du chantier : '+withVille(c.adresse,c.codePostal,c.ville)));
  children.push(P('Téléphone :        mail :'));
  children.push(P('Sous-traitance :'));
  children.push(subTitle("1.3 - Le planning et l\u2019organisation horaire :"));
  children.push(P('Période prévisible d\u2019exécution des travaux : '));
  children.push(P('- Durée prévisible des travaux : '));
  children.push(P('- Début des travaux : '+moisAnnee(c.dateDebut)));
  children.push(P('- Fin des travaux : '+moisAnnee(c.dateFin)));
  children.push(P('Effectif prévisible du chantier :'));
  children.push(P('Pour l\'entreprise : effectif moyen : '+(c.ppspsEffectifMoyen||'')+'    effectif de pointe :'));
  children.push(P('Pour les sous-traitants : effectif moyen :     effectif de pointe : '));
  children.push(P('Horaires de travail du chantier :'));
  children.push(new Table({
    width:{size:9000,type:WidthType.DXA}, columnWidths:[2250,3375,3375],
    rows:[
      new TableRow({children:[headerCell('JOURS',2250), headerCell('MATIN',3375), headerCell('APRES-MIDI',3375)]}),
      ...['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(j=>new TableRow({children:[cell(new Paragraph(j),{width:2250}), cell(new Paragraph(''),{width:3375}), cell(new Paragraph(''),{width:3375})]})),
    ]
  }));
  children.push(new Paragraph({text:'', spacing:{after:200}}));
  children.push(subTitle('1.4 \u2013 Les organismes de préventions'));
  children.push(new Table({
    width:{size:9000,type:WidthType.DXA}, columnWidths:[2200,2900,2200,1700],
    rows:[
      new TableRow({children:[headerCell('Organisme',2200), headerCell('Adresse',2900), headerCell('Contact',2200), headerCell('Téléphone',1700)]}),
      new TableRow({children:[cell(new Paragraph('DREETS de l\u2019Isère'),{width:2200}), cell(new Paragraph('1 Avenue Marie Reynoard, 38029 Grenoble Cedex'),{width:2900}), cell(new Paragraph('Mme Martres-Guguenheim'),{width:2200}), cell(new Paragraph('04 56 58 38 84'),{width:1700})]}),
      new TableRow({children:[cell(new Paragraph('Médecine du Travail \u2014 BTP Santé au Travail'),{width:2200}), cell(new Paragraph('18 Rue de la Tuilerie, 38170 Seyssinet-Pariset'),{width:2900}), cell(new Paragraph('Dr PHAM'),{width:2200}), cell(new Paragraph('04 76 21 76 84'),{width:1700})]}),
      new TableRow({children:[cell(new Paragraph('CARSAT \u2014 Service Prévention des risques professionnels'),{width:2200}), cell(new Paragraph('159 route de Closon, 74330 Poisy'),{width:2900}), cell(new Paragraph('Cécile Verset'),{width:2200}), cell(new Paragraph('39 60'),{width:1700})]}),
      new TableRow({children:[cell(new Paragraph('OPPBTP'),{width:2200}), cell(new Paragraph('3 Rue Méridiens, 38130 Echirolles'),{width:2900}), cell(new Paragraph(''),{width:2200}), cell(new Paragraph('04 76 46 92 68'),{width:1700})]}),
    ]
  }));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(sectionTitle('II - RENSEIGNEMENTS CONCERNANT L\u2019ORGANISATION DU CHANTIER'));
  children.push(subTitle('2.1. - Hygiène et conditions de travail du personnel de chantier :'));
  children.push(P('Parking véhicules du personnel : '));
  children.push(P('Sanitaires : '));
  children.push(P('Réfectoire : '));
  children.push(subTitle('2.2 - Surveillance médicale spéciale :'));
  children.push(P(''));
  children.push(sectionTitle('III - MESURES DE SECURITE APPLICABLES AUX INTERVENTIONS DE L\u2019ENTREPRISE SUR LE CHANTIER'));
  children.push(subTitle('3.1. - Moyens matériels utilisés par l\u2019entreprise :'));
  children.push(PB('- ELECTRICITE')); children.push(P('Nous utiliserons l\u2019électricité du chantier'));
  children.push(PB('- EAU')); children.push(P('Nous utiliserons l\u2019eau du chantier'));
  children.push(PB('- TELEPHONE'));
  children.push(subTitle('3.2. - Installation générale de chantier :'));
  children.push(P('BASE VIE CHANTIER'));
  children.push(subTitle('3.3. - Effectif du personnel :'));
  children.push(P('Donnez l\u2019effectif prévisible du personnel de l\u2019entreprise en fonction de la planification des travaux.'));
  children.push(new Table({
    width:{size:9000,type:WidthType.DXA}, columnWidths:[900,5400,2700],
    rows:[
      new TableRow({children:[headerCell('N°',900), headerCell('Enumération des tâches',5400), headerCell('Effectif',2700)]}),
      ...['Préparation et protection chantier','Ragréage / Préparation des supports','Réalisation des travaux','Nettoyage et repli du chantier'].map((t,i)=>new TableRow({children:[cell(new Paragraph(String(i+1)),{width:900}), cell(new Paragraph(t),{width:5400}), cell(new Paragraph(''),{width:2700})]})),
    ]
  }));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(subTitle('3.6. - Analyse et prévention des risques propres à l\u2019entreprise :'));
  for(let i=1;i<=10;i++) children.push(P(`Fiche de tâche n°${String(i).padStart(2,'0')} :`));
  children.push(P(''));
  children.push(new Table({
    width:{size:9000,type:WidthType.DXA}, columnWidths:[3000,3000,3000],
    rows:[
      new TableRow({children:[headerCell('Activités interférentes',3000), headerCell('Risques',3000), headerCell('Prévention',3000)]}),
      new TableRow({children:[cell(new Paragraph('Travail en hauteur'),{width:3000}), cell(new Paragraph('Risque de chute'),{width:3000}), cell(new Paragraph('Equipement de protection, Echafaudage sécurisé, Formation interne, Casques de protection, Balisage, PIR'),{width:3000})]}),
      new TableRow({children:[cell(new Paragraph('Manutention / Approvisionnement'),{width:3000}), cell(new Paragraph('Risque de coupure\nRisque d\u2019écrasements'),{width:3000}), cell(new Paragraph('Gants anti-coupures, TMS, port du casque et jugulaire\nPort des genouillères, gants et chaussures de sécurité, manutention au diable'),{width:3000})]}),
    ]
  }));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(subTitle('3.9. - Analyse et prévention des risques inhérents au chantier et à son environnement :'));
  children.push(new Table({
    width:{size:9000,type:WidthType.DXA}, columnWidths:[2500,3000,3500],
    rows:[
      new TableRow({children:[headerCell('Environnement',2500), headerCell('Risques',3000), headerCell('Prévention',3500)]}),
      new TableRow({children:[cell(new Paragraph('Peintures / Revêtements'),{width:2500}), cell(new Paragraph('Coupures\nTMS\nIntoxication\nEcrasements'),{width:3000}), cell(new Paragraph('Port du casque + jugulaire, gants anti coupures, lunettes étanches et chaussures de sécurité, genouillères, 1/2 masque à filtre antiparticules. Fiches de sécurité des produits transmises à l\u2019entreprise générale.'),{width:3500})]}),
      new TableRow({children:[cell(new Paragraph('Installation d\u2019un échafaudage'),{width:2500}), cell(new Paragraph('Risques de chutes'),{width:3000}), cell(new Paragraph('Port des EPI, Formation interne à l\u2019installation d\u2019échafaudage, Balisage, PIR'),{width:3500})]}),
    ]
  }));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(sectionTitle('4 - Mesures de sécurité et de secours'));
  children.push(subTitle('4.1 Consignes générales de sécurité :'));
  children.push(P('Port des EPI individuels / Mise en place et port des EPI collectifs'));
  children.push(subTitle('4.2 Consignes particulières au chantier :'));
  children.push(P(''));
  children.push(subTitle('4.3 - Dispositions en matière de secours et d\u2019évacuation des personnels de chantier en cas d\u2019accident :'));
  children.push(P('Identification et localisation du (des) secouriste(s) : fiche renseignée et affichée sur chaque site'));
  children.push(P('Localisation de la trousse de secours : '));
  children.push(P('Consignes Premiers secours :'));
  children.push(P('\u2022 Alerter par téléphone les secours : POMPIERS 18 | SAMU 15 | POLICE 17'));
  children.push(P('\u2022 En cas de projection de produits dans les yeux ou sur le corps : laver à grande eau pendant 15 minutes après avoir enlevé les vêtements souillés.'));
  children.push(new Paragraph({children:[new PageBreak()]}));

  children.push(new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:'5 - AVIS / COMMENTAIRES / SIGNATURES', bold:true, size:24})], spacing:{after:400}}));
  children.push(new Paragraph({children:[new TextRun({text:'Etabli le : ', bold:true}), new TextRun({text:fmtDate(todayISO()), italics:true})], spacing:{after:600}}));
  children.push(P('Rédigé par : '+(s.gerant||'')));
  children.push(new Paragraph({text:'', spacing:{after:600}}));
  children.push(P(s.gerant||''));
  children.push(P('Gérant'));
  children.push(new Paragraph({text:'', spacing:{after:200}}));
  children.push(PB(socNom));
  if(s.adresse) children.push(P(s.adresse));
  if(s.codePostal||s.ville) children.push(P([s.codePostal,s.ville].filter(Boolean).join(' ')));
  if(s.telephone) children.push(P('Tél : '+s.telephone));
  if(s.siret) children.push(P('Siret : '+s.siret));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  try{
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PPSPS_${(c.nom||'chantier').replace(/[^a-z0-9]+/gi,'_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    showToast('PPSPS généré et téléchargé.', 'success');
  }catch(err){
    showToast('Erreur lors de la génération du document.');
  }
}
function chantierComptesRendusHTML(c){
  const list = c.comptesRendus||[];
  return `<div class="chantier-section" style="grid-column:1/-1;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📋 Comptes-rendus</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'comptesRendus','cr_file_'+c.id,'.pdf,image/*')}</label>
    </div>
    ${!list.length? '<div class="empty">Aucun fichier pour l\'instant.</div>' : list.map(f=>`
      <div class="chantier-file-row ${f.vu===false?'is-unread':''}">
        <a href="javascript:void(0)" onclick="openCompteRenduFile('${jsAttr(c.id)}','${jsAttr(f.id)}','${jsAttr(f.data)}','${jsAttr(f.nom)}')">
          ${f.vu===false? '<span class="unread-dot"></span>':''}📎 ${esc(f.nom)}
        </a>
        <span class="card-sub">${fmtDate(f.date)}</span>
        <button class="btn small danger" onclick="removeChantierFile('${jsAttr(c.id)}','comptesRendus','${jsAttr(f.id)}')">✕</button>
      </div>`).join('')}
  </div>`;
}
async function openCompteRenduFile(chantierId, fileId, dataUrl, nom){
  openAttachmentPreview(dataUrl, nom);
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const f = (c.comptesRendus||[]).find(x=>x.id===fileId);
  if(!f || f.vu!==false) return;
  f.vu = true;
  await window.stSet('chantier:'+chantierId, c);
  await recharger('bonCommande', 'chantier');
  renderTab();
}
function parseMontantCell(raw){
  if(raw==null) return NaN;
  let s = String(raw).trim();
  if(!s) return NaN;
  s = s.replace(/[€$]/g,'').replace(/\s/g,'').trim();
  if(s.includes(',') && s.includes('.')){
    if(s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g,'').replace(',', '.');
    else s = s.replace(/,/g,'');
  } else if(s.includes(',')){
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
function parseCSVText(text){
  const lines = text.split(/\r\n|\n|\r/).filter(l=>l.trim().length);
  const detectSep = lines[0] && lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  return lines.map(line=>{
    const cells = [];
    let cur = '', inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){ inQuotes = !inQuotes; }
      else if(ch === detectSep && !inQuotes){ cells.push(cur); cur=''; }
      else { cur += ch; }
    }
    cells.push(cur);
    return cells.map(c=>c.trim());
  });
}
let dpgfMapping = { sheets: {}, sheetNames: [], currentSheet: '', chantierId: null, colRoles: [] };
function guessAllColRoles(headerRow, sampleRows, nbCols){
  const roles = new Array(nbCols).fill('ignore');
  const assigned = new Set();
  const headerMatch = (keywords) => {
    for(let c=0;c<nbCols;c++){
      if(assigned.has(c)) continue;
      const h = String((headerRow||[])[c]||'').toLowerCase();
      if(keywords.some(k=>h.includes(k))) return c;
    }
    return -1;
  };
  const cDesignation = headerMatch(['désignation','designation','libellé','libelle','description','nature','ouvrage','poste','article']);
  if(cDesignation!==-1){ roles[cDesignation]='designation'; assigned.add(cDesignation); }
  const cQte = headerMatch(['qté','qte','quantité','quantite','qty','quant','nombre']);
  if(cQte!==-1){ roles[cQte]='qte'; assigned.add(cQte); }
  const cPrix = headerMatch(['prix u','p.u','pu ht','prix unit','p unit','px u','unitaire','prix en']);
  if(cPrix!==-1){ roles[cPrix]='prix'; assigned.add(cPrix); }
  // Colonnes restantes sans en-tête reconnu : deviner via le contenu (texte vs nombre "propre")
  const looksLikeRefCode = (v) => /^\s*\d+([.\s]\d+)*\s*$/.test(String(v)) && /[.\s]/.test(String(v).trim());
  for(let c=0;c<nbCols;c++){
    if(assigned.has(c)) continue;
    let numericCount = 0, textCount = 0, refCodeCount = 0, nonEmpty = 0;
    sampleRows.forEach(r=>{
      const v = (r||[])[c];
      if(v==null || String(v).trim()==='') return;
      nonEmpty++;
      if(looksLikeRefCode(v)) refCodeCount++;
      else if(!isNaN(parseMontantCell(v))) numericCount++;
      else textCount++;
    });
    if(nonEmpty===0) continue;
    if(refCodeCount > numericCount && refCodeCount > textCount) continue; // colonne de repérage (ex: "2.1 1"), on ignore
    if(cDesignation===-1 && textCount >= numericCount && textCount>0){ roles[c]='designation'; assigned.add(c); continue; }
    if(cQte===-1 && numericCount>0){ roles[c]='qte'; assigned.add(c); continue; }
  }
  return roles;
}
function recomputeDpgfColRoles(){
  const rows = currentDpgfRows();
  const skip = parseInt(document.getElementById('dpgfMappingSkipRows').value,10) || 0;
  const headerRow = rows[Math.max(0,skip-1)] || [];
  const sample = rows.slice(skip, skip+15);
  const nbCols = Math.max(1, ...rows.map(r=>(r||[]).length));
  dpgfMapping.colRoles = guessAllColRoles(headerRow, sample, nbCols);
}
function onDpgfSkipRowsChange(){
  recomputeDpgfColRoles();
  renderDpgfMappingPreview();
}
function updateDpgfColRole(colIdx, value){
  dpgfMapping.colRoles[colIdx] = value;
}
function handleDpgfFileAnalyse(chantierId, file){
  if(!file) return;
  const isCsv = /\.csv$/i.test(file.name);
  showToast('Lecture du fichier…', 'success', 1500);
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      dpgfMapping.sheets = {};
      if(isCsv){
        dpgfMapping.sheetNames = ['CSV'];
        dpgfMapping.sheets['CSV'] = parseCSVText(ev.target.result);
      } else {
        if(typeof XLSX === 'undefined'){ showToast('La lecture des fichiers Excel nécessite une connexion internet (bibliothèque non chargée). Réessayez, ou exportez votre fichier en CSV.'); return; }
        const data = new Uint8Array(/** @type {ArrayBuffer} */ (ev.target.result));
        const workbook = XLSX.read(data, {type:'array'});
        dpgfMapping.sheetNames = workbook.SheetNames;
        workbook.SheetNames.forEach(name=>{
          dpgfMapping.sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {header:1, defval:'', raw:false});
        });
      }
      if(!dpgfMapping.sheetNames.length){ showToast('Ce fichier semble vide.'); return; }
      // Choisir par défaut la feuille la plus "riche" en données (pas la page de garde)
      let bestSheet = dpgfMapping.sheetNames[0], bestScore = -1;
      dpgfMapping.sheetNames.forEach(name=>{
        const rows = dpgfMapping.sheets[name];
        let score = 0;
        rows.forEach(r=>{ (r||[]).forEach(c=>{ if(!isNaN(parseMontantCell(c)) && String(c).trim()!=='') score++; }); });
        if(score > bestScore){ bestScore = score; bestSheet = name; }
      });
      dpgfMapping.currentSheet = bestSheet;
      dpgfMapping.chantierId = chantierId;
      openDpgfMapping();
    } catch(err){
      showToast('Impossible de lire ce fichier. Formats acceptés : Excel (.xlsx, .xls) ou CSV.');
    }
  };
  if(isCsv) reader.readAsText(file, 'UTF-8'); else reader.readAsArrayBuffer(file);
}
function currentDpgfRows(){ return dpgfMapping.sheets[dpgfMapping.currentSheet] || []; }
function guessSkipRows(){
  const rows = currentDpgfRows();
  for(let i=0;i<Math.min(rows.length,30);i++){
    const rowText = (rows[i]||[]).join(' ').toLowerCase();
    if(['désignation','designation','quantité','quantite','prix'].some(k=>rowText.includes(k))) return i+1;
  }
  return 0;
}function openDpgfMapping(){
  document.getElementById('dpgfMappingModal').style.display = 'flex';
  const skipRows = guessSkipRows();
  document.getElementById('dpgfMappingSkipRows').value = skipRows;
  recomputeDpgfColRoles();
  renderDpgfMappingPreview();
}
function closeDpgfMapping(){
  document.getElementById('dpgfMappingModal').style.display = 'none';
}
function changeDpgfSheet(name){
  dpgfMapping.currentSheet = name;
  const skipRows = guessSkipRows();
  document.getElementById('dpgfMappingSkipRows').value = skipRows;
  recomputeDpgfColRoles();
  renderDpgfMappingPreview();
}
function renderDpgfMappingPreview(){
  const rows = currentDpgfRows();
  const skip = parseInt(document.getElementById('dpgfMappingSkipRows').value,10) || 0;
  const nbCols = Math.max(1, ...rows.map(r=>(r||[]).length));
  const previewRows = rows.slice(skip, skip+8);
  const roleLabel = {designation:'Désignation', qte:'Quantité', prix:'Prix Unitaire', ignore:'Ignorer'};
  const sheetSelectorHtml = dpgfMapping.sheetNames.length>1 ? `
    <div class="field" style="max-width:320px; margin-bottom:10px;">
      <label>Feuille du classeur</label>
      <select onchange="changeDpgfSheet(this.value)">
        ${dpgfMapping.sheetNames.map(n=>`<option value="${esc(n)}" ${n===dpgfMapping.currentSheet?'selected':''}>${esc(n)}</option>`).join('')}
      </select>
    </div>` : '';
  let html = '<thead><tr>';
  for(let c=0;c<nbCols;c++){
    html += `<th><select onchange="updateDpgfColRole(${c}, this.value)" style="font-size:11px; padding:3px;">
      ${['designation','qte','prix','ignore'].map(v=>`<option value="${v}" ${dpgfMapping.colRoles[c]===v?'selected':''}>${roleLabel[v]}</option>`).join('')}
    </select></th>`;
  }
  html += '</tr></thead><tbody>';
  previewRows.forEach(r=>{
    html += '<tr>' + Array.from({length:nbCols}).map((_,c)=>`<td style="font-size:12px;">${esc(String((r||[])[c]!=null?r[c]:''))}</td>`).join('') + '</tr>';
  });
  html += '</tbody>';
  document.getElementById('dpgfSheetSelectorZone').innerHTML = sheetSelectorHtml;
  document.getElementById('dpgfMappingTable').innerHTML = html;
}
function confirmDpgfMapping(){
  const rows = currentDpgfRows();
  const skip = parseInt(document.getElementById('dpgfMappingSkipRows').value,10) || 0;
  const idxDesignation = dpgfMapping.colRoles.indexOf('designation');
  const idxQte = dpgfMapping.colRoles.indexOf('qte');
  const idxPrix = dpgfMapping.colRoles.indexOf('prix');
  if(idxDesignation===-1){ showToast('Indiquez au moins quelle colonne contient la désignation.'); return; }
  const lignes = [];
  for(let i=skip;i<rows.length;i++){
    const row = rows[i];
    if(!row) continue;
    const designation = String(row[idxDesignation]!=null? row[idxDesignation] : '').trim();
    if(!designation) continue;
    const qte = idxQte!==-1 ? parseMontantCell(row[idxQte]) : NaN;
    const prixUnitaire = idxPrix!==-1 ? parseMontantCell(row[idxPrix]) : NaN;
    const qteVal = isNaN(qte) ? 0 : qte;
    const prixVal = isNaN(prixUnitaire) ? 0 : prixUnitaire;
    if(!qteVal && !prixVal){ lignes.push({ id: uid(), type:'chapitre', designation, qte:0, prixUnitaire:0, avancementCumule:0 }); continue; }
    lignes.push({ id: uid(), type:'ligne', designation, qte: qteVal, prixUnitaire: prixVal, avancementCumule:0 });
  }
  if(!lignes.length){ showToast('Aucune ligne exploitable avec cette correspondance.'); return; }
  const c = state.chantiers.find(x=>x.id===dpgfMapping.chantierId);
  if(!c) return;
  c.dpgfLignes = lignes;
  closeDpgfMapping();
  renderTab();
  showToast(`${lignes.length} ligne(s) importée(s) — vérifiez puis cliquez sur "Enregistrer les lignes".`, 'success', 4500);
}
function chantierDpgfLignesHTML(c){
  const lignes = c.dpgfLignes || [];
  const totalHT = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0), 0);
  const totalFacture = lignes.filter(l=>l.type!=='chapitre').reduce((s,l)=> s + ((parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0)) * ((parseFloat(l.avancementCumule)||0)/100), 0);
  if(!state.dpgfSectionCollapsed) state.dpgfSectionCollapsed = {};
  const collapsed = !!state.dpgfSectionCollapsed[c.id];
  return `<div class="chantier-section" style="grid-column:1/-1;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span style="display:flex; align-items:center; gap:8px;">
        <button class="btn small dpgf-toggle-btn" onclick="toggleDpgfSection('${jsAttr(c.id)}')" title="${collapsed?'Déplier':'Replier'}">${collapsed?'+':'−'}</button>
        📈 DPGF chiffré — suivi d'avancement
      </span>
      ${collapsed? `<span class="card-sub">${lignes.filter(l=>l.type!=='chapitre').length} ligne(s) — ${moneyDisplay(totalHT)} HT</span>` : `<span class="card-sub">Cochez les lignes à facturer, puis validez ci-dessous</span>`}
    </div>
    <div id="dpgfCollapsibleBody_${c.id}" style="${collapsed?'display:none;':''}">
    <div class="dpgf-import-banner">
      <div>
        <strong>Importer un DPGF existant</strong>
        <div class="card-sub">Fichier Excel (.xlsx) ou CSV — les lignes sont extraites automatiquement</div>
      </div>
      <label class="btn primary" style="cursor:pointer;">📥 Analyser un fichier
        <input type="file" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleDpgfFileAnalyse('${jsAttr(c.id)}', this.files[0]); this.value='';">
      </label>
    </div>
    <table class="lignes-table" id="dpgfLignesTable_${c.id}">
      <thead><tr><th style="width:26px;"></th><th style="width:32%;">Désignation</th><th>Qté</th><th>Prix U. HT</th><th>Montant HT</th><th>Déjà facturé</th><th>Métier</th><th>Planning</th><th></th></tr></thead>
      <tbody>${chantierDpgfLigneRowsHTML(lignes, c.id)}</tbody>
    </table>
    <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
      <button class="btn small" onclick="addChantierDpgfLigne('${jsAttr(c.id)}')">+ Ligne</button>
      <button class="btn small" onclick="addChantierDpgfChapitre('${jsAttr(c.id)}')">+ Chapitre</button>
      <button class="btn small primary" onclick="saveChantierDpgfLignes('${jsAttr(c.id)}')">Enregistrer les lignes</button>
      <button class="btn small primary" onclick="openFacturerAvancement('${jsAttr(c.id)}')" style="margin-left:auto;">Facturer la sélection</button>
    </div>
    <div class="dpgf-totals">
      <div>Total DPGF (HT) : <strong>${moneyDisplay(totalHT)}</strong></div>
      <div>Déjà facturé : <strong>${moneyDisplay(totalFacture)}</strong></div>
      <div>Reste à facturer : <strong>${moneyDisplay(totalHT-totalFacture)}</strong></div>
    </div>
    </div>
  </div>`;
}
function toggleDpgfSection(chantierId){
  if(!state.dpgfSectionCollapsed) state.dpgfSectionCollapsed = {};
  state.dpgfSectionCollapsed[chantierId] = !state.dpgfSectionCollapsed[chantierId];
  renderTab();
}
function chantierDpgfLigneRowsHTML(lignes, chantierId){
  if(!lignes.length) return `<tr><td colspan="9" class="empty">Aucune ligne pour l'instant.</td></tr>`;
  return lignes.map((l,i)=>{
    if(l.type==='chapitre'){
      return `<tr class="ligne-chapitre-row"><td></td><td colspan="7"><input type="text" data-idx="${i}" data-field="designation" value="${esc(l.designation)}" placeholder="Titre du chapitre" style="font-weight:700;"></td><td><button class="btn small danger" onclick="removeChantierDpgfLigne(event,${i})">✕</button></td></tr>`;
    }
    const montant = (parseFloat(l.qte)||0)*(parseFloat(l.prixUnitaire)||0);
    const complet = (parseFloat(l.avancementCumule)||0) >= 100;
    const devisSource = l.devisSourceId ? state.devis.find(d=>d.id===l.devisSourceId) : null;
    const qteTotale = parseFloat(l.qte)||0;
    const dejaPlanifiee = qteDejaPlanifiee(l);
    const restante = Math.max(0, qteTotale - dejaPlanifiee);
    const tachesPlanifiees = l.tachesPlanifiees||[];
    return `<tr class="dpgf-ligne-row ${complet?'is-complete':''}">
      <td><input type="checkbox" class="dpgf-ligne-select" data-ligne-id="${l.id}" ${complet?'disabled':''} title="${complet? 'Déjà facturé à 100%' : 'Sélectionner pour facturer'}"></td>
      <td>
        <input type="text" data-idx="${i}" data-field="designation" value="${esc(l.designation)}" placeholder="Désignation">
        ${devisSource? `<span class="dpgf-devis-source-badge" title="Ajoutée depuis le devis ${esc(devisSource.numero)}">📄 ${esc(devisSource.numero)}</span>` : ''}
      </td>
      <td><input type="number" step="0.01" data-idx="${i}" data-field="qte" value="${l.qte!=null?l.qte:''}" style="width:70px;"></td>
      <td><input type="number" step="0.01" data-idx="${i}" data-field="prixUnitaire" value="${l.prixUnitaire!=null?l.prixUnitaire:''}" style="width:90px;"></td>
      <td>${moneyDisplay(montant)}</td>
      <td>${(parseFloat(l.avancementCumule)||0).toFixed(0)}%</td>
      <td><select data-idx="${i}" data-field="metier" style="width:auto; font-size:11px;">${metierPersoSelectOptions(l.metier)}</select></td>
      <td>
        ${tachesPlanifiees.length? `<div class="dpgf-planif-progress" title="${dejaPlanifiee}/${qteTotale} planifié">${dejaPlanifiee}/${qteTotale}</div>
        <div class="dpgf-planif-taches">${tachesPlanifiees.map(t=>{
          const bc = state.bonsCommande.find(b=>b.id===t.bonCommandeId);
          return bc? `<button class="btn small" onclick="ouvrirTacheDansPlanning('${jsAttr(bc.id)}')" title="Voir dans Planning">✅ ${t.qte}</button>` : '';
        }).join('')}</div>` : ''}
        ${qteTotale>0 && restante>0 ? `<button class="btn small primary" onclick="openPlanifierQteModal('${jsAttr(chantierId)}',${i})">📅 Planifier</button>` : ''}
      </td>
      <td><button class="btn small danger" onclick="removeChantierDpgfLigne(event,${i})">✕</button></td>
    </tr>`;
  }).join('');
}
function addChantierDpgfLigne(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  if(!c.dpgfLignes) c.dpgfLignes = [];
  c.dpgfLignes.push({id: uid(), type:'ligne', designation:'', qte:1, prixUnitaire:0, avancementCumule:0});
  refreshChantierDpgfLignesZone(chantierId);
}
function addChantierDpgfChapitre(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  if(!c.dpgfLignes) c.dpgfLignes = [];
  c.dpgfLignes.push({id: uid(), type:'chapitre', designation:'', qte:0, prixUnitaire:0, avancementCumule:0});
  refreshChantierDpgfLignesZone(chantierId);
}
function removeChantierDpgfLigne(ev, idx){
  const table = ev.target.closest('table');
  const cid = table.id.replace('dpgfLignesTable_','');
  const c = state.chantiers.find(x=>x.id===cid);
  if(!c) return;
  captureChantierDpgfLignesFromDOM(cid);
  c.dpgfLignes.splice(idx,1);
  refreshChantierDpgfLignesZone(cid);
}
function captureChantierDpgfLignesFromDOM(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const table = document.getElementById('dpgfLignesTable_'+chantierId);
  if(!table) return;
  table.querySelectorAll('input[data-idx], select[data-idx]').forEach(inp=>{
    const idx = parseInt(inp.dataset.idx,10);
    const field = inp.dataset.field;
    if(c.dpgfLignes[idx]) c.dpgfLignes[idx][field] = inp.value;
  });
}
function refreshChantierDpgfLignesZone(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const zone = document.getElementById('dpgfLignesTable_'+chantierId);
  if(zone) zone.querySelector('tbody').innerHTML = chantierDpgfLigneRowsHTML(c.dpgfLignes||[]);
}
async function saveChantierDpgfLignes(chantierId){
  captureChantierDpgfLignesFromDOM(chantierId);
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const r = await window.stSet('chantier:'+chantierId, c);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('chantier');
  renderTab();
  showToast('Lignes DPGF enregistrées.', 'success');
}
function chantierDpgfHTML(c){
  return `<div class="chantier-section">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📊 DPGF</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML2(c.id,'dpgf_file_'+c.id,'.pdf,.xlsx,.xls,.csv','handleDpgfFileAddAndAnalyse')}</label>
    </div>
    ${chantierFileListHTML(c, 'dpgf')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📃 CCTP</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'cctp','cctp_file_'+c.id,'.pdf')}</label>
    </div>
    ${chantierFileListHTML(c, 'cctp')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📑 CCAP</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'ccap','ccap_file_'+c.id,'.pdf')}</label>
    </div>
    ${chantierFileListHTML(c, 'ccap')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📝 Avenant</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'avenants','avenant_file_'+c.id,'.pdf,.docx')}</label>
    </div>
    ${chantierFileListHTML(c, 'avenants')}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📕 DGD</span>
      <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(c.id,'dgd','dgd_file_'+c.id,'.pdf,.xlsx,.xls,.docx')}</label>
    </div>
    ${chantierFileListHTML(c, 'dgd')}
  </div>`;
}
function chantierFileInputHTML2(chantierId, inputId, accept, handlerName){
  return `<input type="file" id="${inputId}" accept="${accept||'*'}" style="display:none;" onchange="${handlerName}('${jsAttr(chantierId)}', this.files[0]); this.value='';">`;
}
async function handleDpgfFileAddAndAnalyse(chantierId, file){
  if(!file) return;
  await handleChantierFileAdd(chantierId, 'dpgf', file);
  const isAnalysable = /\.(xlsx|xls|csv)$/i.test(file.name);
  if(isAnalysable){
    handleDpgfFileAnalyse(chantierId, file);
  } else {
    showToast('Fichier PDF archivé. L\'analyse automatique des travaux facturables nécessite un fichier Excel ou CSV.', 'success', 4500);
  }
}
const ACHAT_CATEGORIES = [
  {key:'fournitures', label:'Fournitures', icon:'📦', color:'#2E9BF0'},
  {key:'salarie', label:'Salarié', icon:'👷', color:'#F0A82E'},
  {key:'soustraitant', label:'Sous-traitant', icon:'🔧', color:'#9B6EF0'}
];
function achatCategorieLabel(key){
  const found = ACHAT_CATEGORIES.find(c=>c.key===key);
  return found ? found.label : key;
}
function achatCategorieIcon(key){
  const found = ACHAT_CATEGORIES.find(c=>c.key===key);
  return found ? found.icon : '💰';
}
function chantierAchatsHTML(c){
  const achats = c.achats || [];
  const filtre = state.chantierAchatsFiltre || '';
  const totalParCategorie = {};
  ACHAT_CATEGORIES.forEach(cat=>{ totalParCategorie[cat.key] = achats.filter(a=>a.categorie===cat.key).reduce((s,a)=>s+(parseFloat(a.montant)||0),0); });
  const totalGeneral = Object.values(totalParCategorie).reduce((s,v)=>s+v,0);
  const filtered = filtre ? achats.filter(a=>a.categorie===filtre) : achats;
  const sorted = [...filtered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return `<div class="chantier-section" style="grid-column:1/-1;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>💰 Achats</span>
      <span class="achats-grand-total">${moneyDisplay(totalGeneral)} <span class="card-sub" style="font-weight:400;">au total</span></span>
    </div>
    <div class="achats-totals">
      ${ACHAT_CATEGORIES.map(cat=>{
        const montant = totalParCategorie[cat.key];
        const pct = totalGeneral>0 ? Math.round(montant/totalGeneral*100) : 0;
        return `<div class="achats-total-card ${filtre===cat.key?'is-active':''}" onclick="filterChantierAchats('${jsAttr(cat.key)}')" style="--cat-color:${cat.color};">
          <div class="achats-total-icon" style="background:${cat.color}22; color:${cat.color};">${cat.icon}</div>
          <div class="achats-total-info">
            <div class="achats-total-label">${cat.label}</div>
            <div class="achats-total-montant">${moneyDisplay(montant)}</div>
          </div>
          <div class="achats-total-bar-wrap"><div class="achats-total-bar" style="width:${pct}%; background:${cat.color};"></div></div>
        </div>`;
      }).join('')}
    </div>
    ${filtre? `<button class="btn small ghost" style="margin-bottom:10px;" onclick="filterChantierAchats('')">✕ Retirer le filtre "${achatCategorieLabel(filtre)}"</button>` : ''}
    <div class="achat-add-card">
      <div class="achat-add-row">
        <select id="achatCategorie_${c.id}" onchange="onAchatCategorieChange('${jsAttr(c.id)}')">
          ${ACHAT_CATEGORIES.map(cat=>`<option value="${cat.key}">${cat.icon} ${cat.label}</option>`).join('')}
        </select>
        <input type="text" id="achatDesignation_${c.id}" placeholder="Désignation…" style="flex:1;">
        <input type="number" step="0.01" id="achatMontant_${c.id}" placeholder="Montant HT">
        <input type="date" id="achatDate_${c.id}" value="${todayISO()}">
        <button class="btn primary" onclick="addChantierAchat('${jsAttr(c.id)}')">+ Ajouter</button>
      </div>
      <div class="achat-salarie-zone" id="achatSalarieZone_${c.id}" style="display:none;">
        <select id="achatSalarieId_${c.id}" onchange="onAchatSalarieHeuresChange('${jsAttr(c.id)}')">${salarieSelectOptions()}</select>
        <input type="number" step="0.25" id="achatHeures_${c.id}" placeholder="Heures" oninput="onAchatSalarieHeuresChange('${jsAttr(c.id)}')">
        <span class="card-sub" id="achatSalarieCoutInfo_${c.id}"></span>
      </div>
    </div>
    <div class="achats-list">
      ${sorted.length? sorted.map(a=>{
        /* Le repli porte la même forme que les catégories connues : un objet vide
           obligeait chaque lecture à se garder elle-même, et TypeScript à refuser. */
        const cat = ACHAT_CATEGORIES.find(x=>x.key===a.categorie) || {key:'', label:'', color:'#999', icon:'💰'};
        return `<div class="achat-row" style="--cat-color:${cat.color||'#999'};">
          <div class="achat-row-icon" style="background:${cat.color}22; color:${cat.color};">${cat.icon||'💰'}</div>
          <div class="achat-row-main">
            <div class="achat-designation">${esc(a.designation)}${a.heures? ` <span class="card-sub">(${a.heures}h)</span>`:''}</div>
            <div class="achat-date">${achatCategorieLabel(a.categorie)} · ${fmtDate(a.date)}</div>
          </div>
          <div class="achat-montant">${moneyDisplay(a.montant)}</div>
          <button class="todo-remove" onclick="removeChantierAchat('${jsAttr(c.id)}','${jsAttr(a.id)}')" title="Supprimer">✕</button>
        </div>`;
      }).join('') : '<div class="empty">Aucun achat enregistré pour l\'instant.</div>'}
    </div>
  </div>`;
}
function salarieSelectOptions(current){
  const list = state.salaries.filter(s=>s.societeId===state.societeId);
  return '<option value="">— Sans conducteur / non renseigné —</option>' + list.map(s=>`<option value="${s.id}" ${s.id===current?'selected':''}>${esc(s.prenom)} ${esc(s.nom)}</option>`).join('');
}
function onAchatCategorieChange(chantierId){
  const categorie = document.getElementById('achatCategorie_'+chantierId).value;
  document.getElementById('achatSalarieZone_'+chantierId).style.display = categorie==='salarie' ? 'flex' : 'none';
}
function onAchatSalarieHeuresChange(chantierId){
  const salarieId = document.getElementById('achatSalarieId_'+chantierId).value;
  const heures = parseFloat(document.getElementById('achatHeures_'+chantierId).value) || 0;
  const infoEl = document.getElementById('achatSalarieCoutInfo_'+chantierId);
  const salarie = state.salaries.find(s=>s.id===salarieId);
  if(!salarie || !salarie.coutHoraireCharge){ infoEl.textContent = ''; return; }
  const montant = heures * salarie.coutHoraireCharge;
  document.getElementById('achatMontant_'+chantierId).value = montant.toFixed(2);
  infoEl.textContent = `${moneyDisplay(salarie.coutHoraireCharge)}/h × ${heures}h = ${moneyDisplay(montant)}`;
  const designationEl = document.getElementById('achatDesignation_'+chantierId);
  if(!designationEl.value) designationEl.value = `${salarie.prenom} ${salarie.nom}`;
}
function filterChantierAchats(categorie){
  state.chantierAchatsFiltre = categorie;
  renderTab();
}
async function addChantierAchat(chantierId){
  const categorie = document.getElementById('achatCategorie_'+chantierId).value;
  const designation = document.getElementById('achatDesignation_'+chantierId).value.trim();
  const montant = parseFloat(document.getElementById('achatMontant_'+chantierId).value) || 0;
  const date = document.getElementById('achatDate_'+chantierId).value || todayISO();
  const salarieId = categorie==='salarie' ? (document.getElementById('achatSalarieId_'+chantierId).value || null) : null;
  const heures = categorie==='salarie' ? (parseFloat(document.getElementById('achatHeures_'+chantierId).value) || null) : null;
  if(!designation){ showToast('Indiquez une désignation pour cet achat.'); return; }
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  if(!c.achats) c.achats = [];
  c.achats.push({ id: uid(), categorie, designation, montant, date, salarieId, heures });
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
  showToast('Achat enregistré.', 'success');
}
async function removeChantierAchat(chantierId, achatId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  c.achats = (c.achats||[]).filter(a=>a.id!==achatId);
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
}
let planifierQteCtx = { chantierId: null, ligneId: null };
function qteDejaPlanifiee(ligne){
  return (ligne.tachesPlanifiees||[]).reduce((s,t)=>s+(parseFloat(t.qte)||0),0);
}
function openPlanifierQteModal(chantierId, idx){
  captureChantierDpgfLignesFromDOM(chantierId);
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const ligne = c.dpgfLignes[idx];
  if(!ligne) return;
  if(!ligne.metier){ showToast('Choisissez d\'abord un métier pour cette ligne avant de la planifier.'); return; }
  const qteTotale = parseFloat(ligne.qte)||0;
  const dejaPlanifiee = qteDejaPlanifiee(ligne);
  const restante = Math.max(0, qteTotale - dejaPlanifiee);
  if(restante <= 0){ showToast('Toute la quantité de cette ligne est déjà planifiée.'); return; }
  planifierQteCtx = { chantierId, ligneId: ligne.id };
  document.getElementById('planifierQteInfo').textContent = `${ligne.designation} — ${dejaPlanifiee} / ${qteTotale} déjà planifié${dejaPlanifiee>1?'s':''}. Reste ${restante} à planifier.`;
  document.getElementById('planifierQteUnite').textContent = 'sur '+restante+' restant(s)';
  const input = document.getElementById('planifierQteInput');
  input.max = restante;
  input.value = '';
  document.getElementById('planifierQteModal').style.display = 'flex';
  refreshPlanifierQteMontant();
  setTimeout(()=>input.focus(), 50);
}
function closePlanifierQteModal(){
  document.getElementById('planifierQteModal').style.display = 'none';
}
function refreshPlanifierQteMontant(){
  const c = state.chantiers.find(x=>x.id===planifierQteCtx.chantierId);
  if(!c) return;
  const ligne = (c.dpgfLignes||[]).find(l=>l.id===planifierQteCtx.ligneId);
  if(!ligne) return;
  const qte = parseFloat(document.getElementById('planifierQteInput').value) || 0;
  const montant = qte * (parseFloat(ligne.prixUnitaire)||0);
  document.getElementById('planifierQteMontantInfo').textContent = `Montant correspondant : ${moneyDisplay(montant)}`;
}
async function confirmPlanifierQte(){
  const c = state.chantiers.find(x=>x.id===planifierQteCtx.chantierId);
  if(!c) return;
  const ligne = (c.dpgfLignes||[]).find(l=>l.id===planifierQteCtx.ligneId);
  if(!ligne) return;
  const qteTotale = parseFloat(ligne.qte)||0;
  const dejaPlanifiee = qteDejaPlanifiee(ligne);
  const restante = Math.max(0, qteTotale - dejaPlanifiee);
  let qte = parseFloat(document.getElementById('planifierQteInput').value) || 0;
  if(qte <= 0){ showToast('Indiquez une quantité supérieure à 0.'); return; }
  if(qte > restante) qte = restante;
  const montant = qte * (parseFloat(ligne.prixUnitaire)||0);
  const bcId = uid();
  const numeroPart = qte < qteTotale ? ` (${qte}/${qteTotale})` : '';
  const bcObj = {
    id: bcId, societeId: state.societeId, createdAt: new Date().toISOString(),
    client: c.client||'', interlocuteur:'', devisId: null,
    numeroBC: `${c.nom} — ${ligne.designation}${numeroPart}`,
    adresse: c.adresse||'', codePostal: c.codePostal||'', ville: c.ville||'',
    metier: ligne.metier, metiers: [ligne.metier],
    montant, conducteur:'', notes: '',
    chantierId: c.id, dpgfLigneId: ligne.id, qtePlanifiee: qte
  };
  const r = await window.stSet('bonCommande:'+bcId, bcObj);
  if(!r){ showToast(saveFailedMessage()); return; }
  if(!ligne.tachesPlanifiees) ligne.tachesPlanifiees = [];
  ligne.tachesPlanifiees.push({ id: uid(), bonCommandeId: bcId, qte });
  await window.stSet('chantier:'+c.id, c);
  await recharger('chantier', 'bonCommande');
  closePlanifierQteModal();
  renderTab();
  showToast('Tâche créée — retrouvez-la dans "Non planifiés" du Planning pour l\'assigner.', 'success', 4500);
}
function ouvrirTacheDansPlanning(bonCommandeId){
  state.viewingChantier = null;
  state.planningSearch = '';
  setTab('planning');
  const bc = state.bonsCommande.find(b=>b.id===bonCommandeId);
  if(bc){
    setTimeout(()=>{
      const input = document.getElementById('planningSearchInput');
      if(input){ input.value = bc.numeroBC; filterPlanningList(bc.numeroBC); }
    }, 0);
  }
}
function chantierFacturesHTML(c){
  const facturesLiees = state.factures.filter(f=>f.chantierId===c.id);
  return `<div class="chantier-section">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🧾 Factures</span>
    </div>
    ${facturesLiees.length? facturesLiees.map(f=>{
      const t = computeDocTotals(f);
      return `<div class="chantier-file-row" style="flex-wrap:wrap;">
        <a href="javascript:void(0)" onclick="ouvrirFactureDepuisChantier('${jsAttr(f.id)}')">🧾 ${esc(f.numero)} — ${moneyDisplay(t.ttc)} TTC</a>
        <span class="badge ${f.statut==='payée'?'success':f.statut==='impayée'?'danger':'info'}">${esc(f.statut||'brouillon')}</span>
        <button class="btn small" onclick="printDocument('facture','${jsAttr(f.id)}','save')">Imprimer / PDF</button>
        <button class="btn small" onclick="envoyerDocumentEmail('facture','${jsAttr(f.id)}')">Envoyer par email</button>
      </div>`;
    }).join('') : '<div class="empty">Aucune facture pour l\'instant.</div>'}
  </div>`;
}
function ouvrirFactureDepuisChantier(factureId){
  state.viewingChantier = null;
  setTab('factures');
  state.facturesView = 'liste';
  editItem('facture', factureId);
}
function chantierDevisComplHTML(c){
  const devisLies = state.devis.filter(d=>d.chantierId===c.id);
  return `<div class="chantier-section">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📄 Devis complémentaires</span>
      <div style="display:flex; gap:8px;">
        <button class="btn small primary" onclick="creerDevisDepuisChantier('${jsAttr(c.id)}')">+ Nouveau devis</button>
        <label class="btn small" style="cursor:pointer;">+ Fichier${chantierFileInputHTML(c.id,'devisComplementaires','devcompl_file_'+c.id,'.pdf,image/*')}</label>
      </div>
    </div>
    ${devisLies.length? devisLies.map(d=>{
      const t = computeDocTotals(d);
      return `<div class="chantier-file-row" style="flex-wrap:wrap;">
        <a href="javascript:void(0)" onclick="ouvrirDevisDepuisChantier('${jsAttr(d.id)}')">📄 ${esc(d.numero)} — ${moneyDisplay(t.ht)} HT</a>
        <span class="badge ${d.statut==='accepté'?'success':d.statut==='refusé'?'danger':'info'}">${esc(d.statut||'brouillon')}</span>
        <button class="btn small" onclick="printDocument('devis','${jsAttr(d.id)}','save')">Imprimer / PDF</button>
        <button class="btn small" onclick="envoyerDocumentEmail('devis','${jsAttr(d.id)}')">Envoyer par email</button>
      </div>`;
    }).join('') : ''}
    ${chantierFileListHTML(c, 'devisComplementaires')}
  </div>`;
}
function creerDevisDepuisChantier(chantierId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  state.viewingChantier = null;
  setTab('devis');
  openForm('devis', { client: c.client||'', adresseLocataire: c.adresse||'', codePostal: c.codePostal||'', ville: c.ville||'', chantierId: c.id });
}
function ouvrirDevisDepuisChantier(devisId){
  state.viewingChantier = null;
  setTab('devis');
  editItem('devis', devisId);
}
function chantierTodoStatut(t){
  if(t.statut) return t.statut;
  return t.fait ? 'fait' : 'a_faire';
}
function chantierTodoHTML(c){
  const list = c.todoList||[];
  const done = list.filter(t=>chantierTodoStatut(t)==='fait').length;
  const total = list.length;
  const pct = total? Math.round(done/total*100) : 0;
  const colonnes = [
    {key:'a_faire', label:'À faire', icon:'📋'},
    {key:'en_cours', label:'En cours', icon:'🔧'},
    {key:'fait', label:'Fait', icon:'✅'}
  ];
  return `<div class="chantier-section" style="grid-column:1/-1;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🗂️ To do liste</span>
      ${total? `<span class="todo-progress-label">${done}/${total} ${pct===100? '🎉 Tout est fait !':'terminées'}</span>` : ''}
    </div>
    ${total? `<div class="todo-progress-wrap">
      <div class="todo-progress-bar"><div class="todo-progress-fill" style="width:${pct}%;"></div></div>
    </div>` : ''}
    <div class="todo-add-row">
      <input type="text" id="chantierTodoInput_${c.id}" placeholder="Ajouter une tâche…" onkeydown="if(event.key==='Enter') addChantierTodo('${jsAttr(c.id)}')">
      <button class="btn small primary" onclick="addChantierTodo('${jsAttr(c.id)}')">+ Ajouter</button>
    </div>
    <div class="todo-kanban">
      ${colonnes.map(col=>{
        const items = list.filter(t=>chantierTodoStatut(t)===col.key);
        return `<div class="todo-kanban-col" ondragover="allowDropTodoColumn(event)" ondrop="dropTodoColumn(event,'${jsAttr(c.id)}','${jsAttr(col.key)}')">
          <div class="todo-kanban-col-header todo-kanban-col-${col.key}">
            <span>${col.icon} ${col.label}</span>
            <span class="todo-kanban-count">${items.length}</span>
          </div>
          <div class="todo-kanban-col-body">
            ${items.length? items.map(t=>{
              const salarie = t.salarieId ? state.salaries.find(s=>s.id===t.salarieId) : null;
              const initiales = salarie ? (salarie.prenom||'?')[0]+(salarie.nom||'?')[0] : '';
              const enRetard = t.dateRealisation && chantierTodoStatut(t)!=='fait' && t.dateRealisation < todayISO();
              return `
              <div class="todo-kanban-card" draggable="true" ondragstart="dragStartTodoCard(event,'${jsAttr(c.id)}','${jsAttr(t.id)}')" onclick="openTodoDetail('${jsAttr(c.id)}','${jsAttr(t.id)}')">
                <span class="todo-kanban-card-text">${esc(t.texte)}</span>
                ${(t.dateRealisation||salarie)? `<div class="todo-kanban-card-meta">
                  ${t.dateRealisation? `<span class="todo-meta-badge ${enRetard?'is-late':''}">📅 ${fmtDate(t.dateRealisation)}</span>`:''}
                  ${salarie? `<span class="todo-meta-badge" title="${esc(salarie.prenom)} ${esc(salarie.nom)}">👤 ${esc(initiales)}</span>`:''}
                </div>`:''}
                <button class="todo-remove" onclick="event.stopPropagation(); removeChantierTodo('${jsAttr(c.id)}','${jsAttr(t.id)}')" title="Supprimer">✕</button>
              </div>`;
            }).join('') : `<div class="todo-kanban-empty">Glissez une tâche ici</div>`}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function dragStartTodoCard(ev, chantierId, todoId){
  ev.dataTransfer.effectAllowed = 'move';
  ev.dataTransfer.setData('text/plain', chantierId+'::'+todoId);
}
function allowDropTodoColumn(ev){
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
}
async function dropTodoColumn(ev, chantierId, newStatut){
  ev.preventDefault();
  const raw = ev.dataTransfer.getData('text/plain')||'';
  const [cid, todoId] = raw.split('::');
  if(cid !== chantierId) return;
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const t = (c.todoList||[]).find(x=>x.id===todoId);
  if(!t) return;
  t.statut = newStatut;
  t.fait = newStatut==='fait';
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
}
async function addChantierTodo(chantierId){
  const input = document.getElementById('chantierTodoInput_'+chantierId);
  const texte = input.value.trim();
  if(!texte) return;
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  if(!c.todoList) c.todoList = [];
  c.todoList.push({ id: uid(), texte, statut:'a_faire', fait:false });
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
}
async function removeChantierTodo(chantierId, todoId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  c.todoList = (c.todoList||[]).filter(x=>x.id!==todoId);
  await window.stSet('chantier:'+chantierId, c);
  await recharger('chantier');
  renderTab();
}
let todoDetailCtx = { chantierId: null, todoId: null };
function openTodoDetail(chantierId, todoId){
  const c = state.chantiers.find(x=>x.id===chantierId);
  if(!c) return;
  const t = (c.todoList||[]).find(x=>x.id===todoId);
  if(!t) return;
  todoDetailCtx = { chantierId, todoId };
  document.getElementById('todoDetailTexte').value = t.texte||'';
  document.getElementById('todoDetailDate').value = t.dateRealisation||'';
  document.getElementById('todoDetailSalarieId').innerHTML = salarieSelectOptions();
  document.getElementById('todoDetailSalarieId').value = t.salarieId||'';
  document.getElementById('todoDetailNotes').value = t.notes||'';
  document.getElementById('todoDetailModal').style.display = 'flex';
}
function closeTodoDetail(){
  document.getElementById('todoDetailModal').style.display = 'none';
}
async function saveTodoDetail(){
  const c = state.chantiers.find(x=>x.id===todoDetailCtx.chantierId);
  if(!c) return;
  const t = (c.todoList||[]).find(x=>x.id===todoDetailCtx.todoId);
  if(!t) return;
  const texte = document.getElementById('todoDetailTexte').value.trim();
  if(!texte){ showToast('La tâche ne peut pas être vide.'); return; }
  t.texte = texte;
  t.dateRealisation = document.getElementById('todoDetailDate').value || null;
  t.salarieId = document.getElementById('todoDetailSalarieId').value || null;
  t.notes = document.getElementById('todoDetailNotes').value;
  await window.stSet('chantier:'+c.id, c);
  await recharger('chantier');
  closeTodoDetail();
  renderTab();
  showToast('Tâche mise à jour.', 'success');
}
const TYPES_CONTRAT = ['CDI','CDD','Intérim','Apprenti'];
const ETATS_MATERIEL = ['Neuf','Bon état','Usé','À réparer','Hors service'];
function renderMateriel(){
  const all = state.materiels.filter(m=>m.societeId===state.societeId);
  const q = (state.materielSearch||'').trim().toLowerCase();
  const list = q ? all.filter(m=>window.multiWordMatch([m.nom,m.categorie].filter(Boolean).join(' ').toLowerCase(), q)) : all;

  let bodyHtml;
  if(state.viewingMateriel){
    bodyHtml = renderMaterielDetail(state.viewingMateriel);
  } else if(state.formOpen.materiel){
    bodyHtml = `<div id="formZoneMateriel">${materielForm()}</div>`;
  } else {
    bodyHtml = renderMaterielListeHTML(list);
  }

  return `
    <div class="page-head"><h1>Matériel</h1>${state.viewingMateriel || state.formOpen.materiel? '' : '<button class="btn primary" onclick="openForm(\'materiel\', {prets:[]})">+ Nouveau matériel</button>'}</div>
    ${state.viewingMateriel || state.formOpen.materiel? '' : `<div style="display:flex; gap:10px; margin-bottom:18px;">
      <input type="text" style="flex:1; min-width:220px;" value="${esc(state.materielSearch||'')}" placeholder="Rechercher : nom, catégorie…" oninput="filterMaterielList(this.value)">
    </div>`}
    ${bodyHtml}
  `;
}
function filterMaterielList(value){
  state.materielSearch = value;
  const zone = document.querySelector('#content');
  renderTab();
}
function materielStatut(m){
  const prets = m.prets||[];
  const actif = prets.find(p=>!p.dateRetourReelle);
  if(!actif) return { enPret:false };
  return { enPret:true, pret: actif };
}
function renderMaterielListeHTML(list){
  if(!list.length) return '<div class="empty">Aucun matériel pour l\'instant.</div>';
  return `<div class="vehicule-liste-wrap">
    <table class="stats-table">
      <thead><tr><th>Matériel</th><th>Catégorie</th><th>État</th><th>Statut</th><th>Emprunteur</th><th>Depuis / jusqu'au</th></tr></thead>
      <tbody>
        ${list.map(m=>{
          const st = materielStatut(m);
          let emprunteur = '—', periode = '—';
          if(st.enPret){
            const sal = state.salaries.find(s=>s.id===st.pret.salarieId);
            emprunteur = sal? `${esc(sal.prenom)} ${esc(sal.nom)}` : (st.pret.salarieId||'—');
            const retourPrevu = st.pret.dureeJours!=null ? addJours(st.pret.datePret, st.pret.dureeJours) : null;
            periode = `Depuis le ${fmtDate(st.pret.datePret)}` + (retourPrevu? ` · retour prévu ${fmtDate(retourPrevu)}` : '');
          }
          return `<tr class="vehicule-liste-row" onclick="openMaterielDetail('${jsAttr(m.id)}')">
            <td><strong>${esc(m.nom)}</strong></td>
            <td>${esc(m.categorie)||'—'}</td>
            <td>${esc(m.etatGeneral)||'—'}</td>
            <td>${st.enPret? '<span class="badge warn">En prêt</span>' : '<span class="badge success">Disponible</span>'}</td>
            <td>${emprunteur}</td>
            <td class="card-sub">${periode}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
function addJours(dateISO, jours){
  const d = new Date(dateISO+'T00:00:00');
  d.setDate(d.getDate()+parseInt(jours,10));
  return isoDate(d);
}
function openMaterielDetail(id){
  state.viewingMateriel = id;
  renderTab();
}
function closeMaterielDetail(){
  state.viewingMateriel = null;
  renderTab();
}
async function deleteMateriel(id){
  if(!confirm('Supprimer ce matériel et tout son historique de prêt ?')) return;
  await window.stDelete('materiel:'+id);
  state.viewingMateriel = null;
  await recharger('materiel');
  renderTab();
}
function materielForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le matériel' : 'Nouveau matériel'}</h3>
    <div class="field-grid">
      <div class="field"><label>Nom du matériel</label><input type="text" id="mat_nom" value="${esc(e.nom)}" placeholder="Ex : Perforateur Hilti TE 60"></div>
      <div class="field"><label>Catégorie</label><input type="text" id="mat_categorie" value="${esc(e.categorie)}" placeholder="Ex : Outillage électroportatif"></div>
      <div class="field"><label>État général</label><select id="mat_etatGeneral">${ETATS_MATERIEL.map(et=>`<option value="${et}" ${e.etatGeneral===et?'selected':''}>${et}</option>`).join('')}</select></div>
      <div class="field"><label>N° de série (optionnel)</label><input type="text" id="mat_numeroSerie" value="${esc(e.numeroSerie)}"></div>
      <div class="field"><label>Date d'achat</label><input type="date" id="mat_dateAchat" value="${e.dateAchat||''}"></div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn primary" onclick="saveMateriel()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('materiel')">Annuler</button>
    </div>
  </div>`;
}
async function saveMateriel(){
  const e = state.editing;
  const nom = document.getElementById('mat_nom').value.trim();
  if(!nom){ alert('Le nom du matériel est requis.'); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, createdAt: e.createdAt || new Date().toISOString(),
    nom, categorie: document.getElementById('mat_categorie').value,
    etatGeneral: document.getElementById('mat_etatGeneral').value,
    numeroSerie: document.getElementById('mat_numeroSerie').value,
    dateAchat: document.getElementById('mat_dateAchat').value,
    prets: e.prets || [] };
  const r = await window.stSet('materiel:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('materiel');
  closeForm('materiel');
  showToast(e.id? 'Matériel modifié.' : 'Matériel créé.', 'success');
}
function renderMaterielDetail(id){
  const m = state.materiels.find(x=>x.id===id);
  if(!m){ state.viewingMateriel = null; return renderMateriel(); }
  const st = materielStatut(m);
  return `
    <div class="page-head">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn small" onclick="closeMaterielDetail()">← Retour au matériel</button>
        <h1 style="margin:0;">${esc(m.nom)}</h1>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn" onclick="editItem('materiel','${jsAttr(m.id)}')">Modifier</button>
        <button class="btn danger" onclick="deleteMateriel('${jsAttr(m.id)}')">Supprimer</button>
      </div>
    </div>
    <div class="vehicule-hero">
      <div class="vehicule-hero-grid">
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Catégorie</div><div class="vehicule-hero-value">${esc(m.categorie)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">État général</div><div class="vehicule-hero-value">${esc(m.etatGeneral)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">N° de série</div><div class="vehicule-hero-value">${esc(m.numeroSerie)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Date d'achat</div><div class="vehicule-hero-value">${m.dateAchat? fmtDate(m.dateAchat):'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Statut</div><div class="vehicule-hero-value">${st.enPret? '<span class="badge warn">En prêt</span>' : '<span class="badge success">Disponible</span>'}</div></div>
      </div>
    </div>
    <div class="chantier-section" style="grid-column:1/-1;">
      <div class="section-title">📦 Prêts</div>
      ${st.enPret? `<div class="facture-verrou-banner" style="background:#fff8ec; border-color:#ffe1a8; color:#8a5a00;">
        <span>🔶 Actuellement prêté à <strong>${(()=>{const sal=state.salaries.find(s=>s.id===st.pret.salarieId); return sal? esc(sal.prenom)+' '+esc(sal.nom) : 'inconnu';})()}</strong> depuis le ${fmtDate(st.pret.datePret)}${st.pret.dureeJours!=null? ` (retour prévu ${fmtDate(addJours(st.pret.datePret, st.pret.dureeJours))})`:''}</span>
        <button class="btn small primary" onclick="marquerMaterielRendu('${jsAttr(m.id)}','${jsAttr(st.pret.id)}')">✓ Marquer comme rendu</button>
      </div>` : `
      <div class="entretien-add-row">
        <select id="pretSalarieId_${m.id}">${salarieSelectOptions()}</select>
        <select id="pretEtat_${m.id}">${ETATS_MATERIEL.map(et=>`<option value="${et}" ${m.etatGeneral===et?'selected':''}>${et}</option>`).join('')}</select>
        <input type="date" id="pretDate_${m.id}" value="${todayISO()}">
        <input type="number" id="pretDuree_${m.id}" placeholder="Durée (jours)" style="width:140px;">
        <button class="btn primary" onclick="creerPretMateriel('${jsAttr(m.id)}')">+ Prêter</button>
      </div>`}
      <div class="achats-list" style="margin-top:14px;">
        ${(m.prets||[]).length? [...m.prets].sort((a,b)=>(b.datePret||'').localeCompare(a.datePret||'')).map(p=>{
          const sal = state.salaries.find(s=>s.id===p.salarieId);
          const nomEmprunteur = sal? `${esc(sal.prenom)} ${esc(sal.nom)}` : (p.salarieId||'Inconnu');
          return `<div class="achat-row" style="--cat-color:${p.dateRetourReelle?'#8C8C8C':'#F0A82E'};">
            <div class="achat-row-icon" style="background:${p.dateRetourReelle?'#8C8C8C22':'#F0A82E22'}; color:${p.dateRetourReelle?'#8C8C8C':'#F0A82E'};">📦</div>
            <div class="achat-row-main">
              <div class="achat-designation">${nomEmprunteur} <span class="card-sub">— état au prêt : ${esc(p.etatAuPret)||'—'}</span></div>
              <div class="achat-date">Du ${fmtDate(p.datePret)}${p.dureeJours!=null? ` · prévu ${p.dureeJours} j`:''}${p.dateRetourReelle? ` · rendu le ${fmtDate(p.dateRetourReelle)}` : ' · en cours'}</div>
            </div>
            <button class="btn small danger" onclick="removeMaterielPret('${jsAttr(m.id)}','${jsAttr(p.id)}')">✕</button>
          </div>`;
        }).join('') : '<div class="empty">Aucun prêt enregistré pour l\'instant.</div>'}
      </div>
    </div>
  `;
}
async function creerPretMateriel(materielId){
  const m = state.materiels.find(x=>x.id===materielId);
  if(!m) return;
  const salarieId = document.getElementById('pretSalarieId_'+materielId).value;
  const etatAuPret = document.getElementById('pretEtat_'+materielId).value;
  const datePret = document.getElementById('pretDate_'+materielId).value || todayISO();
  const dureeJours = parseInt(document.getElementById('pretDuree_'+materielId).value,10) || null;
  if(!salarieId){ showToast('Choisissez la personne à qui prêter ce matériel.'); return; }
  if(!m.prets) m.prets = [];
  m.prets.push({ id: uid(), salarieId, etatAuPret, datePret, dureeJours, dateRetourReelle: null });
  await window.stSet('materiel:'+materielId, m);
  await recharger('materiel');
  renderTab();
  showToast('Matériel prêté.', 'success');
}
async function marquerMaterielRendu(materielId, pretId){
  const m = state.materiels.find(x=>x.id===materielId);
  if(!m) return;
  const p = (m.prets||[]).find(x=>x.id===pretId);
  if(!p) return;
  p.dateRetourReelle = todayISO();
  await window.stSet('materiel:'+materielId, m);
  await recharger('materiel');
  renderTab();
  showToast('Matériel marqué comme rendu.', 'success');
}
async function removeMaterielPret(materielId, pretId){
  const m = state.materiels.find(x=>x.id===materielId);
  if(!m) return;
  m.prets = (m.prets||[]).filter(x=>x.id!==pretId);
  await window.stSet('materiel:'+materielId, m);
  await recharger('materiel');
  renderTab();
}
function renderPiecesCommande(){
  return `
    <div class="page-head"><h1>Pièces en commande</h1></div>
    <div class="card-sub" style="margin-bottom:14px;">Bons de commande pour lesquels un technicien a signalé une pièce à commander. Une fois la date de commande renseignée, la pièce est classée dans le dossier de son fournisseur.</div>
    ${barreRecherche('pieceCommande', 'Rechercher : pièce, fournisseur, client, n° BC…')}
    <div id="liste-pieceCommande">${listePiecesCommandeHTML()}</div>
  `;
}

/* Une seule barre pour les deux blocs : « à commander » et « commandées » sont
   deux moments de la même pièce, et on cherche la pièce, pas son moment. */
const listePiecesCommandeHTML = declarerListing('pieceCommande',
  ()=> state.bonsCommande.filter(b=>b.societeId===state.societeId && b.pieceACommander),
  list => {
    const aCommander = list.filter(b=>!b.pieceACommanderDateCommande);
    const commandees = list.filter(b=>b.pieceACommanderDateCommande);
    return `
    <div class="section-title-row"><span class="section-title" style="margin:0;">📦 À commander ${aCommander.length? `<span class="dossier-badge" style="margin-left:6px;">${aCommander.length}</span>`:''}</span></div>
    <div>${aCommander.length? aCommander.map(b=>bonCommandeCardHTML(b,'pieceCommande')).join('') : listeVide('pieceCommande', 'Aucune pièce en attente de commande.', 'pièce à commander')}</div>
    <div class="section-title-row" style="margin-top:24px;"><span class="section-title" style="margin:0;">🚚 Commandées — par fournisseur ${commandees.length? `<span class="dossier-badge" style="margin-left:6px;">${commandees.length}</span>`:''}</span></div>
    ${commandees.length? renderDossiersFournisseurs(commandees) : listeVide('pieceCommande', "Aucune pièce commandée pour l'instant.", 'pièce commandée')}
  `;
  });
function renderDossiersFournisseurs(list){
  if(!list.length) return '<div class="empty">Aucune pièce commandée pour l\'instant.</div>';
  const parFournisseur = {};
  list.forEach(b=>{
    const key = (b.pieceACommanderFournisseur||'').trim() || '— Fournisseur non renseigné —';
    if(!parFournisseur[key]) parFournisseur[key] = [];
    parFournisseur[key].push(b);
  });
  const fournisseurs = Object.keys(parFournisseur).sort((a,b)=>a.localeCompare(b));
  return fournisseurs.map(fournisseur=>{
    const items = parFournisseur[fournisseur];
    const cle = 'dossier:fournisseur:'+fournisseur;
    const ouvert = state.dossierOuvert === cle;
    const apercu = items.map(b=>b.pieceACommanderDetail||b.numeroBC).filter(Boolean).join(', ');
    return `<div class="dossier-client">
      <div class="dossier-header" onclick="toggleDossier('${jsAttr(cle)}')">
        <span class="dossier-icon">${ouvert? '📂':'📁'}</span>
        <span class="dossier-nom">${esc(fournisseur)}</span>
        <span class="dossier-badge">${items.length}</span>
        ${!ouvert? `<span class="dossier-apercu">${esc(apercu)}</span>`:''}
        <span class="dossier-chevron">${ouvert? '▲':'▼'}</span>
      </div>
      ${ouvert? `<div class="dossier-contenu">${items.map(b=>bonCommandeCardHTML(b,'pieceCommande')).join('')}</div>` : ''}
    </div>`;
  }).join('');
}
/* La recherche se pose APRÈS le filtre En service / Vendus : chercher dans
   « Vendus » ne doit pas ressusciter un véhicule en service. */
const listeVehiculesHTML = declarerListing('vehicule',
  ()=> {
    const all = state.vehicules.filter(v=>v.societeId===state.societeId);
    const filtre = state.vehiculeFiltre || 'actifs';
    return filtre==='tous' ? all : filtre==='vendus' ? all.filter(v=>v.vendu) : all.filter(v=>!v.vendu);
  },
  list => renderVehiculeListeHTML(list));

function renderVehicules(){
  const all = state.vehicules.filter(v=>v.societeId===state.societeId);
  const filtre = state.vehiculeFiltre || 'actifs';
  const nbVendus = all.filter(v=>v.vendu).length;

  let bodyHtml;
  if(state.viewingVehicule){
    bodyHtml = renderVehiculeDetail(state.viewingVehicule);
  } else if(state.formOpen.vehicule){
    bodyHtml = `<div id="formZoneVehicule">${vehiculeForm()}</div>`;
  } else {
    bodyHtml = `<div id="liste-vehicule">${listeVehiculesHTML()}</div>`;
  }

  return `
    <div class="page-head"><h1>Véhicules</h1>${state.viewingVehicule || state.formOpen.vehicule? '' : '<button class="btn primary" onclick="openForm(\'vehicule\', {entretiens:[]})">+ Nouveau véhicule</button>'}</div>
    ${state.viewingVehicule || state.formOpen.vehicule? '' : `<div class="vehicule-filtres">
      <button class="btn small ${filtre==='actifs'?'primary':''}" onclick="filterVehicules('actifs')">En service (${all.length-nbVendus})</button>
      <button class="btn small ${filtre==='vendus'?'primary':''}" onclick="filterVehicules('vendus')">Vendus (${nbVendus})</button>
      <button class="btn small ${filtre==='tous'?'primary':''}" onclick="filterVehicules('tous')">Tous (${all.length})</button>
    </div>
    ${barreRecherche('vehicule', 'Rechercher : immatriculation, marque, modèle, conducteur…')}`}
    ${bodyHtml}
  `;
}
function filterVehicules(f){
  state.vehiculeFiltre = f;
  renderTab();
}
function setVehiculeVue(v){
  state.vehiculeVue = v;
  renderTab();
}
function renderVehiculeListeHTML(list){
  if(!list.length) return listeVide('vehicule', 'Aucun véhicule dans cette catégorie.', 'véhicule');
  return `<div class="vehicule-liste-wrap">
    <table class="stats-table">
      <thead><tr><th>Véhicule</th><th>Immatriculation</th><th>Type</th><th>Motorisation</th><th>Pneus</th><th>Kilométrage</th><th>Contrôle technique</th><th>Conducteur</th><th>Statut</th></tr></thead>
      <tbody>
        ${list.map(v=>{
          const jCT = joursAvantVehicule(v.prochainCT);
          const ctAlerte = jCT!=null && jCT<=30 && !v.vendu;
          const conducteurSal = v.conducteurSalarieId ? state.salaries.find(s=>s.id===v.conducteurSalarieId) : null;
          return `<tr class="vehicule-liste-row" onclick="openVehiculeDetail('${jsAttr(v.id)}')">
            <td><strong>${esc(v.nom)}</strong></td>
            <td class="stats-num">${esc(v.immatriculation)||'—'}</td>
            <td>${v.typeVehicule? esc(vehiculeTypeLabel(v.typeVehicule)):'—'}</td>
            <td>${esc(v.motorisation)||'—'}</td>
            <td>${esc(v.taillePneus)||'—'}</td>
            <td class="stats-num">${v.kilometrage? Number(v.kilometrage).toLocaleString('fr-FR')+' km':'—'}</td>
            <td>${v.prochainCT? `${fmtDate(v.prochainCT)} ${ctAlerte? `<span class="vehicule-ct-tag">${jCT<0?'EXPIRÉ':'DANS '+jCT+' J'}</span>`:''}` : '—'}</td>
            <td>${conducteurSal? `${esc(conducteurSal.prenom)} ${esc(conducteurSal.nom)}` : '—'}</td>
            <td>${v.vendu? '<span class="badge">Vendu</span>' : '<span class="badge success">En service</span>'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
function vehiculeTypeLabel(t){
  return {CTTE:'CTTE', VP:'VP', Tourisme:'Tourisme'}[t] || t || '';
}
function joursAvantVehicule(dateStr){ return joursAvant(dateStr); }
function vehiculeCardHTML(v){
  const dernierEntretien = (v.entretiens||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const jCT = joursAvantVehicule(v.prochainCT);
  const ctAlerte = jCT!=null && jCT<=30 && !v.vendu;
  const conducteurSal = v.conducteurSalarieId ? state.salaries.find(s=>s.id===v.conducteurSalarieId) : null;
  return `<div class="vehicule-card ${v.vendu?'is-vendu':''}" onclick="openVehiculeDetail('${jsAttr(v.id)}')">
    <div class="vehicule-card-top">
      <div class="vehicule-icon">🚐</div>
      <div style="flex:1; min-width:0;">
        <div class="vehicule-card-nom">${esc(v.nom)}</div>
        <div class="vehicule-card-plate">${esc(v.immatriculation||'—')}</div>
      </div>
      ${v.vendu? `<span class="badge">VENDU</span>` : (v.typeVehicule? `<span class="badge info">${esc(vehiculeTypeLabel(v.typeVehicule))}</span>` : '')}
    </div>
    <div class="vehicule-mini-badge ${conducteurSal?'is-on':''}" style="margin-bottom:10px;">👤 ${conducteurSal? `${esc(conducteurSal.prenom)} ${esc(conducteurSal.nom)}` : 'Sans conducteur attitré'}</div>
    ${v.prochainCT && !v.vendu? `<div class="vehicule-ct-row ${ctAlerte?'is-blinking':''}">
      🔧 Contrôle technique : <strong>${fmtDate(v.prochainCT)}</strong>${ctAlerte? ` <span class="vehicule-ct-tag">${jCT<0?'EXPIRÉ':'DANS '+jCT+' J'}</span>`:''}
    </div>` : ''}
    <div class="vehicule-card-specs">
      <div class="vehicule-spec"><span class="vehicule-spec-icon">⚙️</span> ${esc(v.motorisation)||'—'}</div>
      <div class="vehicule-spec"><span class="vehicule-spec-icon">🛞</span> ${esc(v.taillePneus)||'—'}</div>
    </div>
    <div class="vehicule-card-badges">
      <span class="vehicule-mini-badge ${v.telepeageNumero?'is-on':''}">🛣️ ${v.telepeageNumero? `${esc(v.telepeageFournisseur||'Télépéage')} · ${esc(v.telepeageNumero)}` : 'Télépéage — non renseigné'}</span>
      <span class="vehicule-mini-badge ${v.carteCarburantNumero?'is-on':''}">⛽ ${v.carteCarburantNumero? `${esc(v.carteCarburantFournisseur||'Carte carburant')} · ${esc(v.carteCarburantNumero)}` : 'Carte carburant — non renseignée'}</span>
    </div>
    <div class="vehicule-card-footer">
      <span class="card-sub">${v.vendu? `Vendu le ${fmtDate(v.dateVente)}${v.prixVente? ' — '+moneyDisplay(v.prixVente):''}` : (dernierEntretien? 'Dernier entretien : '+fmtDate(dernierEntretien.date) : 'Aucun entretien enregistré')}</span>
    </div>
  </div>`;
}
function openVehiculeDetail(id){
  state.viewingVehicule = id;
  renderTab();
}
function closeVehiculeDetail(){
  state.viewingVehicule = null;
  renderTab();
}
function renderVehiculeDetail(id){
  const v = state.vehicules.find(x=>x.id===id);
  if(!v){ state.viewingVehicule = null; return renderVehicules(); }
  const jCT = joursAvantVehicule(v.prochainCT);
  const conducteurSal = v.conducteurSalarieId ? state.salaries.find(s=>s.id===v.conducteurSalarieId) : null;
  return `
    <div class="page-head">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn small" onclick="closeVehiculeDetail()">← Retour aux véhicules</button>
        <h1 style="margin:0;">${esc(v.nom)}</h1>
      </div>
      ${state.formOpen.vehicule? '' : `<button class="btn" onclick="editItem('vehicule','${jsAttr(v.id)}')">Modifier</button>`}
    </div>
    ${state.formOpen.vehicule? vehiculeForm() : `
    <div class="vehicule-hero">
      <div class="vehicule-hero-grid">
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Type</div><div class="vehicule-hero-value">${v.typeVehicule? vehiculeTypeLabel(v.typeVehicule):'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Conducteur attitré</div><div class="vehicule-hero-value">${conducteurSal? `${esc(conducteurSal.prenom)} ${esc(conducteurSal.nom)}` : 'Sans conducteur'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Immatriculation</div><div class="vehicule-hero-value">${esc(v.immatriculation)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">TVA</div><div class="vehicule-hero-value">${v.tvaApplicable===false? 'Sans TVA' : 'Avec TVA'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Motorisation</div><div class="vehicule-hero-value">${esc(v.motorisation)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Taille de pneus</div><div class="vehicule-hero-value">${esc(v.taillePneus)||'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Kilométrage</div><div class="vehicule-hero-value">${v.kilometrage? Number(v.kilometrage).toLocaleString('fr-FR')+' km':'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Date d'achat</div><div class="vehicule-hero-value">${v.dateAchat? fmtDate(v.dateAchat):'—'}</div></div>
        <div class="vehicule-hero-item"><div class="vehicule-hero-label">Contrôle technique</div><div class="vehicule-hero-value">${v.prochainCT? fmtDate(v.prochainCT):'—'} ${jCT!=null&&jCT<=30? `<span class="badge ${jCT<0?'danger':'warn'}">${jCT<0?'Expiré':'Bientôt'}</span>`:''}</div></div>
      </div>
    </div>
    <div class="chantier-sections">
      <div class="chantier-section">
        <div class="section-title">🧾 Facture d'achat</div>
        <div style="margin-bottom:8px;">
          <label class="btn small primary" style="cursor:pointer;">+ Ajouter${chantierFileInputHTML(v.id,'factureAchatFiles','vehAchat_'+v.id,'.pdf,image/*')}</label>
        </div>
        ${chantierFileListHTML(v, 'factureAchatFiles')}
      </div>
      <div class="chantier-section">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🛣️ Télépéage & ⛽ Carte carburant</span>
          ${!v.vendu? `<button class="btn small danger" onclick="openVendreVehiculeModal('${jsAttr(v.id)}')">💰 Vendre ce véhicule</button>` : ''}
        </div>
        <div class="vehicule-abonnement-row"><span>🛣️ Télépéage</span><strong>${esc(v.telepeageFournisseur)||'—'}</strong><span class="card-sub">${esc(v.telepeageNumero)||'Non renseigné'}${v.telepeageValidite? ' · valide jusqu\'au '+fmtDate(v.telepeageValidite):''}</span></div>
        <div class="vehicule-abonnement-row"><span>⛽ Carte carburant</span><strong>${esc(v.carteCarburantFournisseur)||'—'}</strong><span class="card-sub">${esc(v.carteCarburantNumero)||'Non renseignée'}${v.carteCarburantValidite? ' · '+esc(v.carteCarburantValidite):''}</span></div>
        ${v.vendu? `<div class="vehicule-vendu-info">
          <strong>🚗 Véhicule vendu</strong> le ${fmtDate(v.dateVente)}${v.prixVente? ' pour '+moneyDisplay(v.prixVente):''}
          ${v.factureVenteId? `<button class="btn small" onclick="ouvrirFactureDepuisChantier('${jsAttr(v.factureVenteId)}')">Voir la facture</button>` : ''}
        </div>` : ''}
      </div>
      <div class="chantier-section" style="grid-column:1/-1;">
        <div class="section-title">📦 Prêts du véhicule</div>
        ${(()=>{
          const st = materielStatut(v);
          if(st.enPret){
            const sal = state.salaries.find(s=>s.id===st.pret.salarieId);
            const enRetour = state.marquantRetourPretId === st.pret.id;
            return `<div class="facture-verrou-banner" style="background:#fff8ec; border-color:#ffe1a8; color:#8a5a00; flex-direction:column; align-items:flex-start;">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:10px;">
                <span>🔶 Actuellement prêté à <strong>${sal? esc(sal.prenom)+' '+esc(sal.nom) : 'inconnu'}</strong> depuis le ${fmtDate(st.pret.datePret)}${st.pret.dureeJours!=null? ` (retour prévu ${fmtDate(addJours(st.pret.datePret, st.pret.dureeJours))})`:''}</span>
                ${enRetour? '' : `<button class="btn small primary" onclick="ouvrirMarquageRetour('${jsAttr(st.pret.id)}')">✓ Marquer comme rendu</button>`}
              </div>
              ${enRetour? `<div style="width:100%; margin-top:10px;">
                <div class="card-sub" style="margin-bottom:4px; color:#8a5a00;">Cliquez sur le schéma pour marquer les <strong>nouvelles</strong> rayures/chocs constatés au retour :</div>
                ${vehiculeSchemaHTML('retourVehSchema_'+st.pret.id, [])}
                <div style="display:flex; gap:8px; margin-top:8px;">
                  <button class="btn small primary" onclick="confirmerRetourVehicule('${jsAttr(v.id)}','${jsAttr(st.pret.id)}')">Confirmer le retour</button>
                  <button class="btn small ghost" onclick="state.marquantRetourPretId=null; renderTab();">Annuler</button>
                </div>
              </div>` : ''}
            </div>`;
          }
          return !v.vendu? `<div class="entretien-add-row">
            <select id="pretVehSalarieId_${v.id}">${salarieSelectOptions()}</select>
            <select id="pretVehEtat_${v.id}">${ETATS_MATERIEL.map(et=>`<option value="${et}">${et}</option>`).join('')}</select>
            <input type="date" id="pretVehDate_${v.id}" value="${todayISO()}">
            <input type="number" id="pretVehDuree_${v.id}" placeholder="Durée (jours)" style="width:140px;">
            <button class="btn primary" onclick="creerPretVehicule('${jsAttr(v.id)}')">+ Prêter</button>
          </div>
          <div class="card-sub" style="margin:10px 0 4px;">Cliquez sur le schéma pour marquer l'état du véhicule au départ (rayures, chocs…) :</div>
          ${vehiculeSchemaHTML('pretVehSchema_'+v.id, [])}
          ` : '';
        })()}
        <div class="achats-list" style="margin-top:14px;">
          ${(v.prets||[]).length? [...v.prets].sort((a,b)=>(b.datePret||'').localeCompare(a.datePret||'')).map(p=>{
            const sal = state.salaries.find(s=>s.id===p.salarieId);
            const nomEmprunteur = sal? `${esc(sal.prenom)} ${esc(sal.nom)}` : (p.salarieId||'Inconnu');
            const hasDepartMarks = p.schemaMarks && p.schemaMarks.length;
            const hasRetourMarks = p.schemaMarksRetour && p.schemaMarksRetour.length;
            return `<div class="achat-row" style="--cat-color:${p.dateRetourReelle?'#8C8C8C':'#F0A82E'}; flex-wrap:wrap;">
              <div class="achat-row-icon" style="background:${p.dateRetourReelle?'#8C8C8C22':'#F0A82E22'}; color:${p.dateRetourReelle?'#8C8C8C':'#F0A82E'};">📦</div>
              <div class="achat-row-main">
                <div class="achat-designation">${nomEmprunteur} <span class="card-sub">— état au prêt : ${esc(p.etatAuPret)||'—'}</span></div>
                <div class="achat-date">Du ${fmtDate(p.datePret)}${p.dureeJours!=null? ` · prévu ${p.dureeJours} j`:''}${p.dateRetourReelle? ` · rendu le ${fmtDate(p.dateRetourReelle)}` : ' · en cours'}${hasRetourMarks? ` · ⚠ ${p.schemaMarksRetour.length} nouvelle(s) marque(s) au retour`:''}</div>
              </div>
              ${hasDepartMarks? `<button class="btn small ghost" onclick="togglePretSchema('${jsAttr(p.id)}_depart')">📋 État au départ</button>`:''}
              ${hasRetourMarks? `<button class="btn small ${hasRetourMarks?'danger':'ghost'}" onclick="togglePretSchema('${jsAttr(p.id)}_retour')">⚠ État au retour</button>`:''}
              <button class="btn small danger" onclick="removeVehiculePret('${jsAttr(v.id)}','${jsAttr(p.id)}')">✕</button>
              ${state.pretSchemaOuvert===p.id+'_depart'? `<div style="width:100%; margin-top:10px;"><div class="card-sub" style="margin-bottom:4px;">État constaté au départ :</div>${vehiculeSchemaHTML('view_depart_'+p.id, p.schemaMarks||[], true)}</div>`:''}
              ${state.pretSchemaOuvert===p.id+'_retour'? `<div style="width:100%; margin-top:10px;"><div class="card-sub" style="margin-bottom:4px; color:#a30f22;">Nouvelles marques constatées au retour :</div>${vehiculeSchemaHTML('view_retour_'+p.id, p.schemaMarksRetour||[], true)}</div>`:''}
            </div>`;
          }).join('') : '<div class="empty">Aucun prêt enregistré pour l\'instant.</div>'}
        </div>
      </div>
      <div class="chantier-section" style="grid-column:1/-1;">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🔧 Historique d'entretien</span>
        </div>
        <div class="entretien-add-row">
          <input type="text" id="entretienDesignation_${v.id}" placeholder="Ex : Vidange, plaquettes de frein…" style="flex:1;">
          <input type="number" id="entretienKilometrage_${v.id}" placeholder="Kilométrage" value="${v.kilometrage||''}">
          <input type="number" step="0.01" id="entretienMontant_${v.id}" placeholder="Montant">
          <input type="date" id="entretienDate_${v.id}" value="${todayISO()}">
          <label class="btn" style="cursor:pointer;">📎 Facture<input type="file" id="entretienFichier_${v.id}" accept=".pdf,image/*" style="display:none;"></label>
          <button class="btn primary" onclick="addVehiculeEntretien('${jsAttr(v.id)}')">+ Ajouter</button>
        </div>
        <div class="achats-list">
          ${(v.entretiens||[]).length? [...v.entretiens].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(en=>
            state.editingEntretienId===en.id ? entretienEditRowHTML(v.id, en) : `
            <div class="achat-row" style="--cat-color:#5BC97A;">
              <div class="achat-row-icon" style="background:#5BC97A22; color:#5BC97A;">🔧</div>
              <div class="achat-row-main">
                <div class="achat-designation">${esc(en.designation)}${en.kilometrage!=null? ` <span class="card-sub">— ${Number(en.kilometrage).toLocaleString('fr-FR')} km</span>`:''}${en.fichierNom? ` · <a href="javascript:void(0)" onclick="event.stopPropagation(); openAttachmentPreview('${jsAttr(en.fichierData)}','${jsAttr(en.fichierNom)}')">📎 facture</a>`:''}</div>
                <div class="achat-date">${fmtDate(en.date)}</div>
              </div>
              <div class="achat-montant">${moneyDisplay(en.montant)}</div>
              <button class="todo-remove" onclick="startEditEntretien('${jsAttr(en.id)}')" title="Modifier">✏️</button>
              <button class="todo-remove" onclick="removeVehiculeEntretien('${jsAttr(v.id)}','${jsAttr(en.id)}')" title="Supprimer">✕</button>
            </div>`).join('') : '<div class="empty">Aucun entretien enregistré pour l\'instant.</div>'}
        </div>
      </div>
    </div>
    `}
  `;
}
function setVehiculeTva(withTva){
  document.getElementById('veh_tvaApplicable').value = withTva? 'true':'false';
  document.querySelectorAll('.tva-toggle-btn').forEach((btn,i)=> btn.classList.toggle('is-active', (i===0)===withTva));
}
function vehiculeForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le véhicule' : 'Nouveau véhicule'}</h3>
    <div class="field-grid">
      <div class="field"><label>Nom du véhicule</label><input type="text" id="veh_nom" value="${esc(e.nom)}" placeholder="Ex : Renault Trafic"></div>
      <div class="field"><label>Type de véhicule</label><select id="veh_typeVehicule">
        <option value="CTTE" ${e.typeVehicule==='CTTE'||!e.typeVehicule?'selected':''}>Véhicule CTTE</option>
        <option value="VP" ${e.typeVehicule==='VP'?'selected':''}>Véhicule VP</option>
        <option value="Tourisme" ${e.typeVehicule==='Tourisme'?'selected':''}>Véhicule de tourisme</option>
      </select></div>
      <div class="field"><label>Immatriculation</label><input type="text" id="veh_immatriculation" value="${esc(e.immatriculation)}" placeholder="AB-123-CD"></div>
      <div class="field">
        <label>TVA sur ce véhicule</label>
        <div class="tva-toggle-row">
          <button type="button" class="tva-toggle-btn ${e.tvaApplicable!==false?'is-active':''}" onclick="setVehiculeTva(true)">Avec TVA</button>
          <button type="button" class="tva-toggle-btn ${e.tvaApplicable===false?'is-active':''}" onclick="setVehiculeTva(false)">Sans TVA</button>
        </div>
        <input type="hidden" id="veh_tvaApplicable" value="${e.tvaApplicable!==false?'true':'false'}">
      </div>
      <div class="field"><label>Motorisation</label><input type="text" id="veh_motorisation" value="${esc(e.motorisation)}" placeholder="Ex : Diesel 2.0L 145ch"></div>
      <div class="field"><label>Taille de pneus</label><input type="text" id="veh_taillePneus" value="${esc(e.taillePneus)}" placeholder="Ex : 205/65 R16"></div>
      <div class="field"><label>Kilométrage actuel</label><input type="number" id="veh_kilometrage" value="${e.kilometrage||''}"></div>
      <div class="field"><label>Date d'achat</label><input type="date" id="veh_dateAchat" value="${e.dateAchat||''}"></div>
      <div class="field"><label>Prochain contrôle technique</label><input type="date" id="veh_prochainCT" value="${e.prochainCT||''}"></div>
      <div class="field"><label>Conducteur attitré</label><select id="veh_conducteurSalarieId">${salarieSelectOptions(e.conducteurSalarieId)}</select></div>
    </div>
    <div class="section-title" style="margin-top:10px;">🛣️ Télépéage</div>
    <div class="field-grid">
      <div class="field"><label>Fournisseur</label><input type="text" id="veh_telepeageFournisseur" value="${esc(e.telepeageFournisseur)}" placeholder="Ex : Bip&Go, Ulys…"></div>
      <div class="field"><label>N° de badge / abonnement</label><input type="text" id="veh_telepeageNumero" value="${esc(e.telepeageNumero)}"></div>
      <div class="field"><label>Validité / renouvellement</label><input type="date" id="veh_telepeageValidite" value="${e.telepeageValidite||''}"></div>
    </div>
    <div class="section-title" style="margin-top:6px;">⛽ Carte carburant</div>
    <div class="field-grid">
      <div class="field"><label>Fournisseur</label><input type="text" id="veh_carteCarburantFournisseur" value="${esc(e.carteCarburantFournisseur)}" placeholder="Ex : Total, DKV, Shell…"></div>
      <div class="field"><label>N° de carte</label><input type="text" id="veh_carteCarburantNumero" value="${esc(e.carteCarburantNumero)}"></div>
      <div class="field"><label>Validité / code PIN</label><input type="text" id="veh_carteCarburantValidite" value="${esc(e.carteCarburantValidite)}" placeholder="Date d'expiration ou code"></div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn primary" onclick="saveVehicule()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('vehicule')">Annuler</button>
    </div>
  </div>`;
}
async function saveVehicule(){
  const e = state.editing;
  const nom = document.getElementById('veh_nom').value.trim();
  if(!nom){ alert('Le nom du véhicule est requis.'); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, createdAt: e.createdAt || new Date().toISOString(),
    nom, typeVehicule: document.getElementById('veh_typeVehicule').value,
    immatriculation: document.getElementById('veh_immatriculation').value,
    tvaApplicable: document.getElementById('veh_tvaApplicable').value === 'true',
    motorisation: document.getElementById('veh_motorisation').value,
    taillePneus: document.getElementById('veh_taillePneus').value,
    kilometrage: document.getElementById('veh_kilometrage').value,
    dateAchat: document.getElementById('veh_dateAchat').value,
    prochainCT: document.getElementById('veh_prochainCT').value,
    conducteurSalarieId: document.getElementById('veh_conducteurSalarieId').value || null,
    telepeageFournisseur: document.getElementById('veh_telepeageFournisseur').value,
    telepeageNumero: document.getElementById('veh_telepeageNumero').value,
    telepeageValidite: document.getElementById('veh_telepeageValidite').value,
    carteCarburantFournisseur: document.getElementById('veh_carteCarburantFournisseur').value,
    carteCarburantNumero: document.getElementById('veh_carteCarburantNumero').value,
    carteCarburantValidite: document.getElementById('veh_carteCarburantValidite').value,
    vendu: e.vendu || false, dateVente: e.dateVente || '', prixVente: e.prixVente || null, factureVenteId: e.factureVenteId || null,
    factureAchatFiles: e.factureAchatFiles || [],
    entretiens: e.entretiens || [], prets: e.prets || [] };
  const r = await window.stSet('vehicule:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('vehicule');
  closeForm('vehicule');
  showToast(e.id? 'Véhicule modifié.' : 'Véhicule créé.', 'success');
}
async function addVehiculeEntretien(vehiculeId){
  const designation = document.getElementById('entretienDesignation_'+vehiculeId).value.trim();
  const kilometrage = parseFloat(document.getElementById('entretienKilometrage_'+vehiculeId).value) || null;
  const montant = parseFloat(document.getElementById('entretienMontant_'+vehiculeId).value) || 0;
  const date = document.getElementById('entretienDate_'+vehiculeId).value || todayISO();
  const fichierInput = document.getElementById('entretienFichier_'+vehiculeId);
  if(!designation){ showToast('Indiquez une désignation pour cet entretien.'); return; }
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  if(!v.entretiens) v.entretiens = [];
  const finishSave = async (fichierNom, fichierData) => {
    v.entretiens.push({ id: uid(), designation, kilometrage, montant, date, fichierNom: fichierNom||'', fichierData: fichierData||null });
    if(kilometrage!=null && kilometrage > (parseFloat(v.kilometrage)||0)) v.kilometrage = kilometrage;
    await window.stSet('vehicule:'+vehiculeId, v);
    await recharger('vehicule');
    renderTab();
    showToast('Entretien enregistré.', 'success');
  };
  if(fichierInput && fichierInput.files[0]){
    const reader = new FileReader();
    reader.onload = (ev)=> finishSave(fichierInput.files[0].name, ev.target.result);
    reader.readAsDataURL(fichierInput.files[0]);
  } else {
    await finishSave(null, null);
  }
}
async function removeVehiculeEntretien(vehiculeId, entretienId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  v.entretiens = (v.entretiens||[]).filter(en=>en.id!==entretienId);
  await window.stSet('vehicule:'+vehiculeId, v);
  await recharger('vehicule');
  renderTab();
}
async function creerPretVehicule(vehiculeId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  const salarieId = document.getElementById('pretVehSalarieId_'+vehiculeId).value;
  const etatAuPret = document.getElementById('pretVehEtat_'+vehiculeId).value;
  const datePret = document.getElementById('pretVehDate_'+vehiculeId).value || todayISO();
  const dureeJours = parseInt(document.getElementById('pretVehDuree_'+vehiculeId).value,10) || null;
  if(!salarieId){ showToast('Choisissez la personne à qui prêter ce véhicule.'); return; }
  if(!v.prets) v.prets = [];
  const schemaId = 'pretVehSchema_'+vehiculeId;
  const schemaMarks = vehiculeSchemaMarks[schemaId] || [];
  v.prets.push({ id: uid(), salarieId, etatAuPret, datePret, dureeJours, dateRetourReelle: null, schemaMarks });
  vehiculeSchemaMarks[schemaId] = [];
  await window.stSet('vehicule:'+vehiculeId, v);
  await recharger('vehicule');
  renderTab();
  showToast('Véhicule prêté.', 'success');
}
function ouvrirMarquageRetour(pretId){
  state.marquantRetourPretId = pretId;
  renderTab();
}
async function confirmerRetourVehicule(vehiculeId, pretId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  const p = (v.prets||[]).find(x=>x.id===pretId);
  if(!p) return;
  const schemaId = 'retourVehSchema_'+pretId;
  p.schemaMarksRetour = vehiculeSchemaMarks[schemaId] || [];
  p.dateRetourReelle = todayISO();
  vehiculeSchemaMarks[schemaId] = [];
  await window.stSet('vehicule:'+vehiculeId, v);
  await recharger('vehicule');
  state.marquantRetourPretId = null;
  renderTab();
  const nbNouvelles = p.schemaMarksRetour.length;
  showToast(nbNouvelles? `Véhicule rendu — ${nbNouvelles} nouvelle(s) marque(s) relevée(s).` : 'Véhicule marqué comme rendu, aucune nouvelle marque.', 'success', 4500);
}
async function removeVehiculePret(vehiculeId, pretId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  v.prets = (v.prets||[]).filter(x=>x.id!==pretId);
  await window.stSet('vehicule:'+vehiculeId, v);
  await recharger('vehicule');
  renderTab();
}
function startEditEntretien(entretienId){
  state.editingEntretienId = entretienId;
  renderTab();
}
function cancelEditEntretien(){
  state.editingEntretienId = null;
  renderTab();
}
function entretienEditRowHTML(vehiculeId, en){
  return `<div class="achat-row entretien-edit-row" style="--cat-color:#5BC97A;">
    <div class="achat-row-icon" style="background:#5BC97A22; color:#5BC97A;">🔧</div>
    <input type="text" id="editEntretienDesignation_${en.id}" value="${esc(en.designation)}" style="flex:1; min-width:140px;">
    <input type="number" id="editEntretienKilometrage_${en.id}" value="${en.kilometrage!=null?en.kilometrage:''}" placeholder="Km" style="width:110px;">
    <input type="number" step="0.01" id="editEntretienMontant_${en.id}" value="${en.montant!=null?en.montant:''}" style="width:110px;">
    <input type="date" id="editEntretienDate_${en.id}" value="${en.date||''}" style="width:150px;">
    <button class="btn small primary" onclick="saveEditEntretien('${jsAttr(vehiculeId)}','${jsAttr(en.id)}')">✓</button>
    <button class="btn small ghost" onclick="cancelEditEntretien()">✕</button>
  </div>`;
}
async function saveEditEntretien(vehiculeId, entretienId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  const en = (v.entretiens||[]).find(x=>x.id===entretienId);
  if(!en) return;
  const designation = document.getElementById('editEntretienDesignation_'+entretienId).value.trim();
  if(!designation){ showToast('La désignation ne peut pas être vide.'); return; }
  en.designation = designation;
  en.kilometrage = parseFloat(document.getElementById('editEntretienKilometrage_'+entretienId).value) || null;
  en.montant = parseFloat(document.getElementById('editEntretienMontant_'+entretienId).value) || 0;
  en.date = document.getElementById('editEntretienDate_'+entretienId).value || en.date;
  if(en.kilometrage!=null && en.kilometrage > (parseFloat(v.kilometrage)||0)) v.kilometrage = en.kilometrage;
  await window.stSet('vehicule:'+vehiculeId, v);
  await recharger('vehicule');
  state.editingEntretienId = null;
  renderTab();
  showToast('Entretien modifié.', 'success');
}
let vehiculeSchemaMarks = {};
function vehiculeSchemaHTML(schemaId, marks, readonly){
  if(!vehiculeSchemaMarks[schemaId]) vehiculeSchemaMarks[schemaId] = marks || [];
  const currentMarks = readonly ? (marks||[]) : vehiculeSchemaMarks[schemaId];
  return `<div class="vehicule-schema-wrap">
    <svg id="${schemaId}" viewBox="0 0 220 420" class="vehicule-schema-svg" ${readonly?'':`onclick="addMarkToSchema('${schemaId}', event)"`} style="cursor:${readonly?'default':'crosshair'};">
      <rect x="30" y="20" width="160" height="380" rx="35" fill="#f0f2f6" stroke="#8a93a3" stroke-width="2"/>
      <rect x="45" y="55" width="130" height="70" rx="8" fill="#dbe1ea" stroke="#8a93a3" stroke-width="1.5"/>
      <rect x="45" y="300" width="130" height="55" rx="8" fill="#dbe1ea" stroke="#8a93a3" stroke-width="1.5"/>
      <line x1="30" y1="145" x2="190" y2="145" stroke="#8a93a3" stroke-width="1.5"/>
      <line x1="30" y1="280" x2="190" y2="280" stroke="#8a93a3" stroke-width="1.5"/>
      <line x1="110" y1="145" x2="110" y2="280" stroke="#c3c9d3" stroke-width="1"/>
      <rect x="14" y="70" width="14" height="45" rx="4" fill="#5a6472"/>
      <rect x="192" y="70" width="14" height="45" rx="4" fill="#5a6472"/>
      <rect x="14" y="300" width="14" height="45" rx="4" fill="#5a6472"/>
      <rect x="192" y="300" width="14" height="45" rx="4" fill="#5a6472"/>
      <text x="110" y="15" text-anchor="middle" font-size="12" fill="#8a93a3">AVANT</text>
      <text x="110" y="412" text-anchor="middle" font-size="12" fill="#8a93a3">ARRIÈRE</text>
      ${currentMarks.map(m=>`<text x="${m.x}" y="${m.y}" text-anchor="middle" dominant-baseline="middle" font-size="22" font-weight="800" fill="#E23535">✕</text>`).join('')}
    </svg>
    ${readonly? '' : `<button type="button" class="btn small ghost" onclick="clearSchemaMarks('${jsAttr(schemaId)}')" style="margin-top:6px;">Effacer les marques</button>`}
  </div>`;
}
function addMarkToSchema(schemaId, ev){
  const svg = document.getElementById(schemaId);
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = ((ev.clientX - rect.left) / rect.width) * vb.width;
  const y = ((ev.clientY - rect.top) / rect.height) * vb.height;
  if(!vehiculeSchemaMarks[schemaId]) vehiculeSchemaMarks[schemaId] = [];
  vehiculeSchemaMarks[schemaId].push({x: Math.round(x), y: Math.round(y)});
  const mark = document.createElementNS('http://www.w3.org/2000/svg','text');
  mark.setAttribute('x', String(x)); mark.setAttribute('y', String(y));
  mark.setAttribute('text-anchor','middle'); mark.setAttribute('dominant-baseline','middle');
  mark.setAttribute('font-size','22'); mark.setAttribute('font-weight','800'); mark.setAttribute('fill','#E23535');
  mark.textContent = '✕';
  svg.appendChild(mark);
}
function clearSchemaMarks(schemaId){
  vehiculeSchemaMarks[schemaId] = [];
  renderTab();
}
function togglePretSchema(pretId){
  state.pretSchemaOuvert = state.pretSchemaOuvert===pretId ? null : pretId;
  renderTab();
}
let vendreVehiculeCtx = null;
function openVendreVehiculeModal(vehiculeId){
  const v = state.vehicules.find(x=>x.id===vehiculeId);
  if(!v) return;
  vendreVehiculeCtx = vehiculeId;
  document.getElementById('vendreVehiculeInfo').textContent = `${v.nom} — ${v.immatriculation||''}`;
  document.getElementById('venteAcheteur').value = '';
  document.getElementById('venteDate').value = todayISO();
  document.getElementById('ventePrix').value = '';
  document.getElementById('vendreVehiculeModal').style.display = 'flex';
}
function closeVendreVehiculeModal(){
  document.getElementById('vendreVehiculeModal').style.display = 'none';
}
async function confirmVendreVehicule(){
  const v = state.vehicules.find(x=>x.id===vendreVehiculeCtx);
  if(!v) return;
  const acheteur = document.getElementById('venteAcheteur').value.trim();
  const date = document.getElementById('venteDate').value || todayISO();
  const prix = parseFloat(document.getElementById('ventePrix').value) || 0;
  if(!acheteur){ showToast('Indiquez le nom de l\'acheteur.'); return; }
  if(prix<=0){ showToast('Indiquez un prix de vente supérieur à 0.'); return; }
  const details = [
    v.immatriculation? `immatriculation ${v.immatriculation}` : null,
    v.motorisation? `motorisation ${v.motorisation}` : null,
    v.taillePneus? `pneus ${v.taillePneus}` : null,
    v.kilometrage? `${Number(v.kilometrage).toLocaleString('fr-FR')} km` : null,
    v.dateAchat? `acheté le ${fmtDate(v.dateAchat)}` : null,
  ].filter(Boolean).join(' — ');
  const designation = `Vente du véhicule ${v.nom}${details? ' (' + details + ')' : ''}`;
  const factureId = uid();
  // Émise d'emblée : la base attribue le numéro à l'enregistrement.
  const factureObj = { id: factureId, societeId: state.societeId, numero: '', createdAt: new Date().toISOString(),
    client: acheteur, adresse:'', date, echeance:'',
    lignes:[{ type:'ligne', designation, qte:1, prixUnitaire: prix, tva: v.tvaApplicable===false? 0 : 20 }],
    remisePourcentage:0, statut:'impayée', notes:`Vente de véhicule` };
  const r = await window.stSet('facture:'+factureId, factureObj);
  if(!r){ showToast(saveFailedMessage()); return; }
  v.vendu = true; v.dateVente = date; v.prixVente = prix; v.factureVenteId = factureId;
  await window.stSet('vehicule:'+v.id, v);
  await recharger('vehicule', 'facture');
  closeVendreVehiculeModal();
  renderTab();
  showToast('Véhicule marqué comme vendu, facture créée.', 'success');
}
function setRhView(view){
  state.rhView = view;
  renderTab();
}
function renderRH(){
  if(state.viewingRegistre) return renderRegistreUniquePersonnel();
  const vue = state.rhView || 'salaries';
  const equipes = state.techniciens.filter(t=>t.societeId===state.societeId);
  /* Ni les dossiers ni le registre médical ne viennent du pont : on les
     demande dès qu'un écran RH s'affiche, y compris la liste des salariés —
     c'est elle qui porte le badge « dossier incomplet ». */
  chargerDossiersRh();
  chargerVisitesRh();
  const sousNav = `
    <div class="plus-subnav" style="justify-content:center;">
      <button class="plus-subnav-btn ${vue==='salaries'?'active':''}" onclick="setRhView('salaries')">Salariés</button>
      <button class="plus-subnav-btn ${vue==='documents'?'active':''}" onclick="setRhView('documents')">Documents</button>
      <button class="plus-subnav-btn ${vue==='visites'?'active':''}" onclick="setRhView('visites')">Visites médicales</button>
      <button class="plus-subnav-btn ${vue==='equipes'?'active':''}" onclick="setRhView('equipes')">Équipes ${equipes.length? `(${equipes.length})`:''}</button>
    </div>`;
  if(vue==='documents') return sousNav + renderRHDocuments();
  if(vue==='visites') return sousNav + renderRHVisites();
  if(vue==='equipes') return sousNav + renderEquipesRH();
  return sousNav + renderRHSalaries();
}
function renderRHSalaries(){
  const list = state.salaries.filter(s=>s.societeId===state.societeId);
  const q = (state.rhSearch||'').trim().toLowerCase();
  const metierFiltre = state.rhMetierFiltre||'';
  const metiersDistincts = Array.from(new Set(list.map(s=>s.poste).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  let filtered = q ? list.filter(s=>window.multiWordMatch([s.nom,s.prenom,s.poste].filter(Boolean).join(' ').toLowerCase(), q)) : list;
  if(metierFiltre) filtered = filtered.filter(s=>s.poste===metierFiltre);
  return `
    <div class="page-head"><h1>RH</h1>${state.formOpen.salarie? '' : `<div style="display:flex; gap:8px;"><button class="btn" onclick="state.viewingRegistre=true; renderTab();">📋 Registre unique du personnel</button><button class="btn primary" onclick="openForm('salarie', {habilitations:[]})">+ Nouveau salarié</button></div>`}</div>
    ${state.formOpen.salarie ? '' : `<div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap;">
      <input type="text" style="flex:1; min-width:220px;" value="${esc(state.rhSearch||'')}" placeholder="Rechercher : nom, prénom, poste…" oninput="filterRHList(this.value)">
      <select style="width:auto; min-width:180px;" onchange="filterRHMetier(this.value)">
        <option value="" ${!metierFiltre?'selected':''}>Tous les métiers</option>
        ${metiersDistincts.map(m=>`<option value="${esc(m)}" ${metierFiltre===m?'selected':''}>${esc(m)}</option>`).join('')}
      </select>
    </div>`}
    <div id="formZoneSalarie">${state.formOpen.salarie? salarieForm(): ''}</div>
    <div id="rhListZone">${renderSalarieListHTML(filtered)}</div>
  `;
}
/**
 * Les équipes et leurs membres.
 *
 * Une équipe est une ligne de `techniciens` — l'application les appelle ainsi
 * depuis toujours dans le planning et les statistiques. Ses membres sont les
 * salariés dont « Équipe liée » pointe dessus : rattacher quelqu'un, c'est
 * écrire ce champ, qui existait déjà mais ne se renseignait que depuis la fiche
 * du salarié, une par une.
 *
 * L'appartenance décide de qui peut déclarer les travaux faits — la base
 * remonte la chaîne compte → salarié → équipe. D'où la mention du compte
 * manquant : un membre sans compte ne pointera jamais lui-même.
 */
function renderEquipesRH(){
  const equipes = state.techniciens.filter(t=>t.societeId===state.societeId);
  const salaries = state.salaries.filter(s=>s.societeId===state.societeId && s.actif !== false);
  const sansEquipe = salaries.filter(s=>!s.technicienId);

  return `
    <div class="page-head"><h1>Équipes</h1>${state.formOpen.technicien? '' : `<button class="btn primary" onclick="openForm('technicien')">+ Nouvelle équipe</button>`}</div>
    <div id="formZoneTechnicien">${state.formOpen.technicien? technicienForm() : ''}</div>
    ${equipes.map(t=>{
      const membres = salaries.filter(s=>s.technicienId===t.id);
      return `<div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">${esc(technicienLabel(t))}</div>
            <div class="card-sub">${(t.metiers&&t.metiers.length)? '🔧 '+t.metiers.map(esc).join(', ') : (t.metier? '🔧 '+esc(t.metier):'Aucun métier')} · ${membres.length} membre${membres.length>1?'s':''}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn small" onclick="editItem('technicien','${jsAttr(t.id)}')">Modifier</button>
            <button class="btn small danger" onclick="deleteItem('technicien','${jsAttr(t.id)}')">Supprimer</button>
          </div>
        </div>
        <div style="margin-top:10px;">
          ${membres.map(s=>`
            <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--border);">
              <span style="flex:1;">${esc([s.prenom,s.nom].filter(Boolean).join(' '))}${s.poste? ` <span class="card-sub">· ${esc(s.poste)}</span>`:''}</span>
              ${s.profileId? '' : '<span class="card-sub" title="Sans compte, ce membre ne peut pas déclarer ses travaux lui-même">⚠ sans compte</span>'}
              <button class="btn small ghost" onclick="retirerDeLEquipe('${jsAttr(s.id)}')">Retirer</button>
            </div>`).join('') || '<div class="empty" style="margin:6px 0;">Aucun membre. Cette équipe ne peut rien déclarer.</div>'}
        </div>
        ${sansEquipe.length? `<div style="margin-top:10px; display:flex; gap:8px; align-items:center;">
          <select id="ajoutMembre_${t.id}" style="flex:1;">
            <option value="">— Ajouter un salarié —</option>
            ${sansEquipe.map(s=>`<option value="${s.id}">${esc([s.prenom,s.nom].filter(Boolean).join(' '))}</option>`).join('')}
          </select>
          <button class="btn small" onclick="ajouterALEquipe('${jsAttr(t.id)}')">+ Ajouter</button>
        </div>` : ''}
      </div>`;
    }).join('') || '<div class="empty">Aucune équipe. Créez-en une pour pouvoir planifier.</div>'}
    ${sansEquipe.length? `<div class="section-title" style="margin-top:26px;">Salariés sans équipe (${sansEquipe.length})</div>
      <div class="card"><div class="card-sub">${sansEquipe.map(s=>esc([s.prenom,s.nom].filter(Boolean).join(' '))).join(' · ')}</div></div>` : ''}
  `;
}
async function ajouterALEquipe(equipeId){
  const select = document.getElementById('ajoutMembre_'+equipeId);
  const salarieId = select && select.value;
  if(!salarieId) return;
  await majEquipeSalarie(salarieId, equipeId);
}
async function retirerDeLEquipe(salarieId){
  await majEquipeSalarie(salarieId, null);
}
/* Le rattachement passe par la fiche du salarié : c'est elle qui porte le champ,
   et l'écrire ailleurs ferait diverger les deux chemins. */
async function majEquipeSalarie(salarieId, equipeId){
  const s = state.salaries.find(x=>x.id===salarieId);
  if(!s) return;
  const r = await window.stSet('salarie:'+salarieId, { ...s, technicienId: equipeId });
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('salarie');
  renderTab();
  showToast(equipeId? 'Salarié rattaché à l\'équipe.' : 'Salarié retiré de l\'équipe.', 'success');
}
function renderRegistreUniquePersonnel(){
  const list = state.salaries.filter(s=>s.societeId===state.societeId)
    .slice().sort((a,b)=>(a.dateDebut||'9999').localeCompare(b.dateDebut||'9999'));
  return `
    <div class="page-head">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn small" onclick="state.viewingRegistre=false; renderTab();">← Retour RH</button>
        <h1 style="margin:0;">Registre unique du personnel</h1>
      </div>
      <button class="btn primary" onclick="imprimerRegistrePersonnel()">🖨️ Imprimer</button>
    </div>
    <div class="card-sub" style="margin-bottom:16px;">Document obligatoire (Code du travail, art. L.1221-13) — liste de tous les salariés par ordre d'embauche, à tenir à disposition de l'inspection du travail.</div>
    <div class="vehicule-liste-wrap">
      <table class="stats-table" id="registrePersonnelTable">
        <thead><tr><th>N°</th><th>Nom</th><th>Prénom</th><th>Date de naissance</th><th>Nationalité</th><th>Sexe</th><th>Emploi</th><th>Type de contrat</th><th>Date d'entrée</th><th>Date de sortie</th></tr></thead>
        <tbody>
          ${list.length? list.map((s,i)=>`<tr>
            <td>${i+1}</td>
            <td><strong>${esc(s.nom)}</strong></td>
            <td>${esc(s.prenom)}</td>
            <td>${s.dateNaissance? fmtDate(s.dateNaissance):'—'}</td>
            <td>${esc(s.nationalite)||'—'}</td>
            <td>${s.sexe==='F'?'Femme':s.sexe==='M'?'Homme':'—'}</td>
            <td>${esc(s.poste)||'—'}</td>
            <td>${esc(s.typeContrat)||'—'}</td>
            <td>${s.dateDebut? fmtDate(s.dateDebut):'—'}</td>
            <td>${s.dateFin? fmtDate(s.dateFin):'—'}</td>
          </tr>`).join('') : '<tr><td colspan="10" class="empty">Aucun salarié enregistré.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}
function imprimerRegistrePersonnel(){
  const area = document.getElementById('printArea');
  if(!area) return;
  const societeNom = societeName(state.societeId);
  const list = state.salaries.filter(s=>s.societeId===state.societeId)
    .slice().sort((a,b)=>(a.dateDebut||'9999').localeCompare(b.dateDebut||'9999'));
  area.innerHTML = `
    <div class="p-print-planning">
      <h1>${esc(societeNom)} — Registre unique du personnel</h1>
      <div class="p-print-weeklabel">Document tenu à jour au ${fmtDate(todayISO())} — Code du travail, art. L.1221-13</div>
      <table class="p-print-grid" style="table-layout:auto;">
        <thead><tr><th>N°</th><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Nationalité</th><th>Sexe</th><th>Emploi</th><th>Contrat</th><th>Entrée</th><th>Sortie</th></tr></thead>
        <tbody>
          ${list.map((s,i)=>`<tr>
            <td>${i+1}</td><td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td>
            <td>${s.dateNaissance? fmtDate(s.dateNaissance):'—'}</td>
            <td>${esc(s.nationalite)||'—'}</td>
            <td>${s.sexe==='F'?'F':s.sexe==='M'?'M':'—'}</td>
            <td>${esc(s.poste)||'—'}</td><td>${esc(s.typeContrat)||'—'}</td>
            <td>${s.dateDebut? fmtDate(s.dateDebut):'—'}</td>
            <td>${s.dateFin? fmtDate(s.dateFin):'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  area.classList.add('is-landscape');
  area.style.display = 'block';
  setPrintOrientation('landscape');
  window.print();
  setTimeout(()=>{ area.style.display = 'none'; area.innerHTML = ''; area.classList.remove('is-landscape'); setPrintOrientation('portrait'); }, 500);
}
function filterRHMetier(value){
  state.rhMetierFiltre = value;
  const zone = document.getElementById('rhListZone');
  const list = state.salaries.filter(s=>s.societeId===state.societeId);
  const q = (state.rhSearch||'').trim().toLowerCase();
  let filtered = q ? list.filter(s=>window.multiWordMatch([s.nom,s.prenom,s.poste].filter(Boolean).join(' ').toLowerCase(), q)) : list;
  if(value) filtered = filtered.filter(s=>s.poste===value);
  if(zone) zone.innerHTML = renderSalarieListHTML(filtered);
}
function filterRHList(value){
  state.rhSearch = value;
  const zone = document.getElementById('rhListZone');
  const q = value.trim().toLowerCase();
  const metierFiltre = state.rhMetierFiltre||'';
  const list = state.salaries.filter(s=>s.societeId===state.societeId);
  let filtered = q ? list.filter(s=>window.multiWordMatch([s.nom,s.prenom,s.poste].filter(Boolean).join(' ').toLowerCase(), q)) : list;
  if(metierFiltre) filtered = filtered.filter(s=>s.poste===metierFiltre);
  if(zone) zone.innerHTML = renderSalarieListHTML(filtered);
}
function joursAvant(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr+'T00:00:00');
  const diffMs = d.getTime() - new Date(todayISO()+'T00:00:00').getTime();
  return Math.round(diffMs / 86400000);
}
function alerteEcheance(dateStr){
  const j = joursAvant(dateStr);
  if(j==null) return '';
  if(j<0) return '<span class="badge danger">Expiré</span>';
  if(j<=30) return '<span class="badge warn">Expire bientôt</span>';
  return '';
}
function renderSalarieListHTML(list){
  if(!list.length) return '<div class="empty">Aucun salarié pour cette société.</div>';
  return list.map(s=>{
    const habilitationsAlerte = (s.habilitations||[]).filter(h=>{ const j=joursAvant(h.dateExpiration); return j!=null && j<=30; });
    const carteBtpAlerte = alerteEcheance(s.carteBtpValidite);
    const visiteAlerte = alerteEcheance(s.visiteMedicaleProchaine);
    const today = todayISO();
    const absenceEnCours = (s.absences||[]).find(a=>a.dateDebut<=today && a.dateFin>=today);
    /* Tant que les dossiers ne sont pas revenus, pas de badge : afficher
       « incomplet » sur un dossier qu'on n'a pas encore lu serait un mensonge
       le temps d'un aller-retour réseau. */
    const dossier = (dossiersRhPrets() && visitesRhPretes()) ? conformiteRhDuSalarie(s.id) : null;
    return `<div class="card">
      <div class="card-row">
        <div style="flex:1; min-width:0;">
          <div class="card-title">${esc(s.prenom)} ${esc(s.nom)} ${habilitationsAlerte.length||carteBtpAlerte||visiteAlerte? '<span class="badge warn" style="margin-left:6px;">⚠ à vérifier</span>':''}${absenceEnCours? `<span class="badge" style="margin-left:6px; background:#fff0f0; color:#a30f22;">🏖️ Absent (${esc(absenceEnCours.type)}, retour ${fmtDate(absenceEnCours.dateFin)})</span>`:''}${dossier && !dossier.complet? `<span class="badge danger" style="margin-left:6px;" title="${esc([...dossier.manquants.map(t=>t.libelle), dossier.manqueMedical? 'Suivi médical' : ''].filter(Boolean).join(', '))||'Document expiré'}">📁 dossier incomplet</span>`:''}${s.profileId? '' : '<span class="badge warn" style="margin-left:6px;" title="Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même">⚠ sans compte</span>'}</div>
          <div class="card-sub">${esc(s.poste||'')}${s.typeContrat? ' · '+esc(s.typeContrat):''}${s.technicienId? ' · 🔧 équipe liée':''}</div>
          <div class="card-sub">${s.telephone? '📞 '+esc(s.telephone):''}${s.email? ' · ✉ '+esc(s.email):''}</div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="amount">${s.coutHoraireCharge!=null? moneyDisplay(s.coutHoraireCharge)+'/h':'—'}</div>
          <div class="card-sub">coût chargé</div>
          <div class="amount" style="margin-top:6px;">${s.salaireMensuelNet!=null? moneyDisplay(s.salaireMensuelNet):'—'}</div>
          <div class="card-sub">salaire net/mois</div>
        </div>
      </div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="editItem('salarie','${jsAttr(s.id)}')">Modifier</button>
        <button class="btn small" onclick="ouvrirDossierRhDepuisListe('${jsAttr(s.id)}')">📁 Dossier</button>
        <button class="btn small danger" onclick="deleteItem('salarie','${jsAttr(s.id)}')">Supprimer</button>
      </div>
    </div>`;
  }).join('');
}
/* ---------- Dossier documentaire du salarié ----------

   Les documents vivent dans `salarie_documents`, leurs fichiers dans le bucket
   privé `terrain`. Ils ne transitent PAS par le pont kv_store : `salarie` y est
   déclaré sans table fille, si bien qu'un tableau posé sur la fiche est filtré
   par `colonnesDe()` avant l'envoi. C'est précisément ce qui arrivait aux
   « Contrat de travail » et « Avenants » de cet écran : le fichier était encodé
   en data-URL sur la fiche, affiché aussitôt depuis le cache, et perdu au
   rechargement suivant sans qu'aucune erreur ne le dise.

   Tout passe donc par les fonctions posées sur `window` par
   `src/integrations/documents-rh.ts`, et les règles — types attendus, dossier
   complet ou non — par `src/api/regles-documents-rh.ts`, qui est testé. */

function seuilDocumentRh(){
  const seuils = reglagesCourants().seuils || {};
  return seuils.documentLegal != null ? seuils.documentLegal : 30;
}
function documentsDuSalarie(salarieId){
  return window.trierDocumentsRh(state.documentsRh.filter(d=>d.salarieId===salarieId));
}
function dossierDuSalarie(salarieId){
  return window.dossierSalarie(documentsDuSalarie(salarieId), todayISO(), seuilDocumentRh());
}
/* Le dossier se charge à part du reste, et il est indexé par société : sans
   cette clé, changer de société montrerait les dossiers de la précédente.

   La requête en vol se retient dans `chargementDossiersRh`. Deux raisons : le
   rendu appelle cette fonction à chaque passage et ne doit pas la relancer, et
   les écrans doivent savoir distinguer « dossier vide » de « pas encore lu » —
   sans quoi ils annonceraient tous les dossiers incomplets le temps d'un
   aller-retour réseau. */
let chargementDossiersRh = null;
function dossiersRhPrets(){
  return !chargementDossiersRh
    && state.documentsRhCharges
    && state.documentsRhSociete === state.societeId;
}
function chargerDossiersRh(force){
  if(chargementDossiersRh) return chargementDossiersRh;
  if(!force && dossiersRhPrets()) return Promise.resolve();
  const societe = state.societeId;
  const ids = state.salaries.filter(s=>s.societeId===societe).map(s=>s.id);
  chargementDossiersRh = (async ()=>{
    try{
      state.documentsRh = await window.chargerDocumentsRh(ids);
    }catch(err){
      console.error('Dossiers documentaires illisibles', err);
      state.documentsRh = [];
      showToast("Les dossiers documentaires n'ont pas pu être chargés.");
    }finally{
      /* Marqué lu même en cas d'échec : sinon chaque rendu relance la requête
         qui vient d'échouer, et l'écran se met à clignoter. */
      state.documentsRhCharges = true;
      state.documentsRhSociete = societe;
      chargementDossiersRh = null;
    }
    renderTab();
  })();
  return chargementDossiersRh;
}

function etatDocumentRhBadge(doc){
  const info = window.etatDocumentRh(doc, todayISO(), seuilDocumentRh());
  if(info.etat === 'expire') return `<span class="badge danger">Expiré le ${fmtDate(doc.dateExpiration)}</span>`;
  if(info.etat === 'bientot') return `<span class="badge warn">Expire dans ${info.jours} j</span>`;
  if(info.etat === 'valide') return `<span class="card-sub">Valide jusqu'au ${fmtDate(doc.dateExpiration)}</span>`;
  /* Un périssable sans date de fin ne déclenchera jamais d'alerte : le dire,
     sinon l'absence de badge se lit comme « tout va bien ». */
  if(info.sansEcheance) return `<span class="badge warn" title="Aucune alerte ne préviendra de son expiration">Sans date de fin</span>`;
  return '';
}
function documentRhRowHTML(doc){
  const t = window.typeDocumentRh(doc.type);
  const details = [t.libelle, doc.organisme, doc.numeroDocument? 'n° '+doc.numeroDocument : '', doc.dateDocument? 'du '+fmtDate(doc.dateDocument) : '']
    .filter(Boolean).map(esc).join(' · ');
  return `<div class="chantier-file-row">
    <span style="flex:1; min-width:0;">
      ${t.icone} <strong>${esc(window.libelleDocumentRh(doc))}</strong>
      <span class="card-sub">${details}</span>
      ${doc.notes? `<span class="card-sub">📝 ${esc(doc.notes)}</span>`:''}
    </span>
    ${etatDocumentRhBadge(doc)}
    ${doc.fichierChemin
      ? `<button class="btn small ghost" onclick="ouvrirDocumentRhEcran('${jsAttr(doc.id)}')">📎 Ouvrir</button>`
      : '<span class="card-sub" title="Ligne enregistrée sans fichier joint">sans fichier</span>'}
    <button class="btn small" onclick="ouvrirFormDocumentRh('${jsAttr(doc.salarieId)}','${jsAttr(doc.id)}')">Modifier</button>
    <button class="btn small danger" onclick="supprimerDocumentRhEcran('${jsAttr(doc.id)}')">✕</button>
  </div>`;
}
/* Le dossier d'un salarié : ce qu'il contient, ce qui lui manque, et de quoi
   compléter. Servi tel quel dans l'onglet Documents et dans la fiche. */
function dossierRhHTML(salarie){
  if(!dossiersRhPrets()){
    chargerDossiersRh();
    return '<div class="empty">Chargement du dossier…</div>';
  }
  const docs = documentsDuSalarie(salarie.id);
  const bilan = dossierDuSalarie(salarie.id);
  const formIci = state.rhDocForm && state.rhDocForm.salarieId === salarie.id;
  const resume = bilan.manquants.length
    ? `<div class="card-sub" style="color:#a30f22;">⚠ Manque au dossier : ${bilan.manquants.map(t=>esc(t.libelle)).join(', ')}</div>`
    : `<div class="card-sub" style="color:#15803d;">✓ Toutes les pièces obligatoires sont au dossier.</div>`;
  return `
    ${resume}
    <div style="margin-top:10px;">${docs.length? docs.map(documentRhRowHTML).join('') : '<div class="empty">Aucun document au dossier.</div>'}</div>
    ${formIci? formDocumentRhHTML() : `<button class="btn small primary" style="margin-top:10px;" onclick="ouvrirFormDocumentRh('${jsAttr(salarie.id)}')">+ Ajouter un document</button>`}
  `;
}
function ouvrirFormDocumentRh(salarieId, docId){
  const doc = docId ? state.documentsRh.find(d=>d.id===docId) : null;
  state.rhDocForm = {
    salarieId, id: doc? doc.id : null,
    type: doc? doc.type : 'contrat',
    nom: doc? (doc.nom||'') : '',
    organisme: doc? (doc.organisme||'') : '',
    numeroDocument: doc? (doc.numeroDocument||'') : '',
    dateDocument: doc? (doc.dateDocument||'') : '',
    dateExpiration: doc? (doc.dateExpiration||'') : '',
    notes: doc? (doc.notes||'') : '',
    fichierNom: doc? (doc.fichierNom||'') : ''
  };
  renderTab();
}
function fermerFormDocumentRh(){
  state.rhDocForm = null;
  renderTab();
}
function formDocumentRhHTML(){
  const f = state.rhDocForm;
  const choisi = window.typeDocumentRh(f.type);
  return `<div class="form-panel" style="margin-top:12px;">
    <h3>${f.id? 'Modifier le document' : 'Ajouter un document au dossier'}</h3>
    <div class="field-grid">
      <div class="field"><label>Type de document</label><select id="docRh_type" onchange="onTypeDocumentRhChange()">
        ${window.TYPES_DOCUMENT_RH.map(t=>`<option value="${t.code}" ${f.type===t.code?'selected':''}>${t.icone} ${esc(t.libelle)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Libellé</label><input type="text" id="docRh_nom" value="${esc(f.nom)}" placeholder="${esc(choisi.libelle)}"></div>
      <div class="field"><label>Organisme émetteur</label><input type="text" id="docRh_organisme" value="${esc(f.organisme)}" placeholder="Ex : CIBTP, médecine du travail…"></div>
      <div class="field"><label>Numéro du document</label><input type="text" id="docRh_numeroDocument" value="${esc(f.numeroDocument)}"></div>
      <div class="field"><label>Date du document</label><input type="date" id="docRh_dateDocument" value="${f.dateDocument||''}"></div>
      <div class="field"><label>Fin de validité</label><input type="date" id="docRh_dateExpiration" value="${f.dateExpiration||''}">
        <div class="card-sub" id="docRh_avertissementEcheance" style="margin-top:4px; ${choisi.perissable?'':'display:none;'}">Sans cette date, aucune alerte ne préviendra de son expiration.</div></div>
      <div class="field full"><label>Notes</label><input type="text" id="docRh_notes" value="${esc(f.notes)}"></div>
    </div>
    <div class="achat-salarie-zone">
      <label class="btn small" style="cursor:pointer;">📎 ${f.id && f.fichierNom? 'Remplacer le fichier' : 'Joindre le fichier'}<input type="file" id="docRh_fichier" accept=".pdf,image/*" style="display:none;" onchange="onFichierDocumentRhChange()"></label>
      <span class="card-sub" id="docRh_fichierNom">${f.fichierNom? esc(f.fichierNom) : 'PDF, JPEG, PNG ou WebP'}</span>
    </div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn primary" onclick="enregistrerDocumentRh()">Enregistrer</button>
      <button class="btn ghost" onclick="fermerFormDocumentRh()">Annuler</button>
    </div>
  </div>`;
}
/* Le panneau ne se redessine pas au changement de type : le fichier déjà
   choisi vit dans l'élément `input`, et un redessin le perdrait sans le dire. */
function onTypeDocumentRhChange(){
  const type = document.getElementById('docRh_type').value;
  state.rhDocForm.type = type;
  const t = window.typeDocumentRh(type);
  document.getElementById('docRh_nom').placeholder = t.libelle;
  document.getElementById('docRh_avertissementEcheance').style.display = t.perissable? '' : 'none';
}
function onFichierDocumentRhChange(){
  const fichier = (document.getElementById('docRh_fichier').files||[])[0];
  const zone = document.getElementById('docRh_fichierNom');
  if(!fichier){ zone.textContent = 'PDF, JPEG, PNG ou WebP'; return; }
  const verdict = window.verifierPieceJointe({ nom: fichier.name, type: fichier.type, taille: fichier.size });
  zone.textContent = verdict.ok ? fichier.name : verdict.motif;
}
async function enregistrerDocumentRh(){
  const f = state.rhDocForm;
  if(!f) return;
  const saisie = {
    type: document.getElementById('docRh_type').value,
    nom: document.getElementById('docRh_nom').value,
    organisme: document.getElementById('docRh_organisme').value,
    numeroDocument: document.getElementById('docRh_numeroDocument').value,
    dateDocument: document.getElementById('docRh_dateDocument').value,
    dateExpiration: document.getElementById('docRh_dateExpiration').value,
    notes: document.getElementById('docRh_notes').value
  };
  const fichier = (document.getElementById('docRh_fichier').files||[])[0] || null;
  if(fichier){
    /* Même verdict que pour le bon du client : un seul jeu de règles, donc un
       seul refus possible et les mêmes mots pour l'expliquer. */
    const verdict = window.verifierPieceJointe({ nom: fichier.name, type: fichier.type, taille: fichier.size });
    if(!verdict.ok){ showToast(verdict.motif); return; }
  }
  if(!f.id && !fichier && !saisie.nom.trim()){
    showToast('Donnez au moins un libellé ou joignez un fichier.');
    return;
  }
  try{
    if(f.id) await window.majDocumentRh(f.id, saisie, fichier);
    else await window.ajouterDocumentRh(f.salarieId, saisie, fichier);
  }catch(err){
    console.error('Document RH refusé', err);
    showToast(refusDocumentRh(err));
    return;
  }
  state.rhDocForm = null;
  await chargerDossiersRh(true);
  showToast('Document enregistré.', 'success');
}
/* Un refus de la base n'est pas une panne : le plus fréquent est le droit
   manquant, et « échec de l'enregistrement » enverrait chercher ailleurs. */
function refusDocumentRh(err){
  const code = (err && (err.code || (err.cause && err.cause.code))) || '';
  if(code === '42501') return "Vous n'avez pas le droit de modifier les dossiers RH.";
  return saveFailedMessage();
}
async function supprimerDocumentRhEcran(docId){
  const doc = state.documentsRh.find(d=>d.id===docId);
  if(!doc) return;
  if(!confirm('Retirer ce document du dossier ? Le fichier joint sera supprimé.')) return;
  try{
    await window.supprimerDocumentRh(doc);
  }catch(err){
    console.error('Document RH non supprimé', err);
    showToast(refusDocumentRh(err));
    return;
  }
  await chargerDossiersRh(true);
  showToast('Document retiré du dossier.', 'success');
}
async function ouvrirDocumentRhEcran(docId){
  const doc = state.documentsRh.find(d=>d.id===docId);
  if(!doc) return;
  try{
    const ouvert = await window.ouvrirDocumentRh(doc);
    if(!ouvert){ showToast("Ce document n'a pas de fichier joint."); return; }
    openAttachmentPreview(ouvert.url, ouvert.nom, ouvert.mime, ouvert.urlTelechargement);
  }catch(err){
    /* Le chemin désigne un objet disparu, ou les droits ont changé. Le dire :
       un aperçu qui ne s'ouvre pas sans un mot laisse croire à un clic raté. */
    console.error('Document RH illisible', doc.fichierChemin, err);
    showToast("Le document n'a pas pu être ouvert.");
  }
}
/* Le tableau de conformité : une ligne par salarié, une colonne par pièce
   obligatoire. La pastille donne l'état le PIRE des documents de ce type —
   deux visites médicales dont une périmée, c'est une visite médicale périmée
   tant que la nouvelle n'a pas de date. */
function pastilleDocumentRh(docs, type){
  const dedans = docs.filter(d=>d.type===type.code);
  if(!dedans.length) return `<span class="doc-rh-pastille manquant" title="Manquant">✕</span>`;
  const today = todayISO(), seuil = seuilDocumentRh();
  const etats = dedans.map(d=>window.etatDocumentRh(d, today, seuil));
  if(etats.some(e=>e.etat==='expire')) return `<span class="doc-rh-pastille expire" title="Expiré">!</span>`;
  if(etats.some(e=>e.etat==='bientot')) return `<span class="doc-rh-pastille bientot" title="Expire bientôt">~</span>`;
  if(etats.some(e=>e.sansEcheance)) return `<span class="doc-rh-pastille bientot" title="Sans date de fin de validité">?</span>`;
  return `<span class="doc-rh-pastille ok" title="Au dossier">✓</span>`;
}
function renderRHDocuments(){
  const salaries = state.salaries.filter(s=>s.societeId===state.societeId);
  /* Le tableau montre aussi la colonne médicale : il lui faut donc les deux
     sources, et il attend les deux. */
  if(!dossiersRhPrets() || !visitesRhPretes()){
    chargerDossiersRh();
    chargerVisitesRh();
    return '<div class="empty">Chargement des dossiers documentaires…</div>';
  }
  const obligatoires = window.TYPES_DOCUMENT_RH.filter(t=>t.obligatoire);
  const bilans = salaries.map(s=>({ s, docs: documentsDuSalarie(s.id), bilan: conformiteRhDuSalarie(s.id) }));
  const nbIncomplets = bilans.filter(b=>!b.bilan.complet).length;
  const nbExpires = bilans.reduce((n,b)=>n+b.bilan.expires.length, 0);
  const nbBientot = bilans.reduce((n,b)=>n+b.bilan.bientot.length, 0);

  const filtre = state.rhDocFiltre||'';
  let liste = bilans;
  if(filtre==='incomplets') liste = bilans.filter(b=>!b.bilan.complet);
  else if(filtre==='expires') liste = bilans.filter(b=>b.bilan.expires.length);
  else if(filtre==='bientot') liste = bilans.filter(b=>b.bilan.bientot.length);

  const ouvert = state.rhDocSalarieId ? bilans.find(b=>b.s.id===state.rhDocSalarieId) : null;

  return `
    <div class="page-head"><h1>Dossiers documentaires</h1></div>
    <div class="card-sub" style="margin-bottom:14px;">Contrat, DPAE, carte BTP, identité, RIB : les pièces que l'inspection du travail peut demander. Les fichiers sont rangés dans un espace privé, cloisonné par société. La colonne 🩺 vient du registre des visites médicales.</div>
    <div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap;">
      <button class="btn small ${!filtre?'primary':''}" onclick="filtrerDossiersRh('')">Tous (${bilans.length})</button>
      <button class="btn small ${filtre==='incomplets'?'primary':''}" onclick="filtrerDossiersRh('incomplets')">Dossiers incomplets (${nbIncomplets})</button>
      <button class="btn small ${filtre==='expires'?'primary':''}" onclick="filtrerDossiersRh('expires')">Documents expirés (${nbExpires})</button>
      <button class="btn small ${filtre==='bientot'?'primary':''}" onclick="filtrerDossiersRh('bientot')">Expirent bientôt (${nbBientot})</button>
    </div>
    ${salaries.length? `<div class="vehicule-liste-wrap">
      <table class="stats-table">
        <thead><tr>
          <th style="text-align:left;">Salarié</th>
          ${obligatoires.map(t=>`<th class="doc-rh-colonne" title="${esc(t.libelle)}"><span>${t.icone}</span>${esc(t.libelle)}</th>`).join('')}
          <th class="doc-rh-colonne" title="Visite médicale — vient du registre, pas du dossier"><span>🩺</span>Visite médicale</th>
          <th>Autres</th><th>Dossier</th><th></th>
        </tr></thead>
        <tbody>
          ${liste.length? liste.map(({s, docs, bilan})=>{
            const autres = docs.filter(d=>!obligatoires.some(t=>t.code===d.type)).length;
            /* Le manquement médical se compte à part : il ne se répare pas au
               même endroit, on renvoie donc vers son registre. */
            const manques = bilan.manquants.length + (bilan.manqueMedical ? 1 : 0);
            return `<tr>
              <td style="text-align:left;"><strong>${esc(s.prenom)} ${esc(s.nom)}</strong>${s.poste? ` <span class="card-sub">· ${esc(s.poste)}</span>`:''}</td>
              ${obligatoires.map(t=>`<td style="text-align:center;">${pastilleDocumentRh(docs, t)}</td>`).join('')}
              <td style="text-align:center;">${pastilleVisiteRh(s.id)}</td>
              <td>${autres||'—'}</td>
              <td>${bilan.complet? '<span class="badge">Complet</span>' : `<span class="badge danger">${manques? manques+' manquant'+(manques>1?'s':'') : bilan.expires.length+' expiré'+(bilan.expires.length>1?'s':'')}</span>`}</td>
              <td><button class="btn small" onclick="ouvrirDossierRh('${jsAttr(s.id)}')">${state.rhDocSalarieId===s.id? 'Fermer':'Ouvrir'}</button></td>
            </tr>`;
          }).join('') : `<tr><td colspan="${obligatoires.length+5}" class="empty">Aucun salarié ne correspond à ce filtre.</td></tr>`}
        </tbody>
      </table>
    </div>` : '<div class="empty">Aucun salarié pour cette société.</div>'}
    <div class="card-sub" style="margin-top:8px;">Légende : ✓ au dossier · ~ expire bientôt · ! expiré · ? sans date de fin · ✕ manquant. La colonne 🩺 se corrige depuis l'onglet Visites médicales.</div>
    ${ouvert? `<div class="card" style="margin-top:20px;">
      <div class="card-row">
        <div class="card-title">${esc(ouvert.s.prenom)} ${esc(ouvert.s.nom)} — dossier documentaire</div>
        <button class="btn small ghost" onclick="ouvrirDossierRh('${jsAttr(ouvert.s.id)}')">Fermer</button>
      </div>
      <div style="margin-top:10px;">${dossierRhHTML(ouvert.s)}</div>
    </div>` : ''}
  `;
}
function filtrerDossiersRh(valeur){
  state.rhDocFiltre = valeur;
  renderTab();
}
/* Depuis la liste des salariés : changer de vue ET ouvrir le bon dossier, en
   un seul rendu — deux appels enchaînés en dessinaient deux. */
function ouvrirDossierRhDepuisListe(salarieId){
  state.rhView = 'documents';
  state.rhDocFiltre = '';
  state.rhDocSalarieId = salarieId;
  state.rhDocForm = null;
  renderTab();
}
function ouvrirDossierRh(salarieId){
  state.rhDocSalarieId = state.rhDocSalarieId===salarieId ? null : salarieId;
  /* Le formulaire appartient au dossier qu'on referme : le laisser ouvert le
     ferait réapparaître sur le prochain salarié consulté. */
  if(state.rhDocForm && state.rhDocForm.salarieId!==state.rhDocSalarieId) state.rhDocForm = null;
  renderTab();
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
let chargementVisitesRh = null;
function visitesRhPretes(){
  return !chargementVisitesRh
    && state.visitesRhCharges
    && state.visitesRhSociete === state.societeId;
}
function chargerVisitesRh(force){
  if(chargementVisitesRh) return chargementVisitesRh;
  if(!force && visitesRhPretes()) return Promise.resolve();
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
      state.visitesRhCharges = true;
      state.visitesRhSociete = societe;
      chargementVisitesRh = null;
    }
    renderTab();
  })();
  return chargementVisitesRh;
}

/* La conformité RH d'un salarié : son dossier ET son suivi médical.
   Les deux se composent ici, et non dans une règle feuille — celles-ci
   n'importent que des types, et ne peuvent donc pas se connaître. */
function conformiteRhDuSalarie(salarieId){
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
function pastilleVisiteRh(salarieId){
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
/* Le registre d'un salarié : son état, son historique, et de quoi compléter.
   Servi tel quel dans l'onglet Visites médicales et dans la fiche. */
function visitesMedicalesHTML(salarie){
  if(!visitesRhPretes()){
    chargerVisitesRh();
    return '<div class="empty">Chargement du registre…</div>';
  }
  const visites = visitesDuSalarie(salarie.id);
  const formIci = state.rhVisiteForm && state.rhVisiteForm.salarieId === salarie.id;
  /* Une échéance sans registre : la date saisie à la main avant que le
     registre n'existe. Elle vaut, mais elle ne dit ni le type de visite ni
     l'avis rendu — le dire, plutôt que d'afficher un vide qui se lirait comme
     une absence de suivi. */
  const heritee = !visites.length && echeanceVisite(salarie.id);
  return `
    <div class="card-sub">${etatVisiteBadge(salarie.id)}</div>
    <div style="margin-top:10px;">${visites.length
      ? visites.map(visiteRhRowHTML).join('')
      : (heritee
        ? `<div class="empty">Échéance reprise de l'ancienne saisie, sans visite au registre : ni type, ni avis, ni attestation. Enregistrez la prochaine visite pour repartir sur du solide.</div>`
        : '<div class="empty">Aucune visite enregistrée. Ce salarié n\'a pas de suivi médical traçable.</div>')}</div>
    ${formIci? formVisiteRhHTML() : `<button class="btn small primary" style="margin-top:10px;" onclick="ouvrirFormVisiteRh('${jsAttr(salarie.id)}')">+ Enregistrer une visite</button>`}
  `;
}
function ouvrirFormVisiteRh(salarieId, visiteId){
  const v = visiteId ? state.visitesRh.find(x=>x.id===visiteId) : null;
  /* Le régime par défaut est celui de la visite précédente : il change
     rarement, et le resaisir à chaque fois inviterait à le laisser faux. */
  const precedente = v ? null : window.derniereVisite(visitesDuSalarie(salarieId));
  state.rhVisiteForm = {
    salarieId, id: v? v.id : null,
    dateVisite: v? v.dateVisite : todayISO(),
    type: v? v.type : (precedente? 'periodique' : 'embauche'),
    suivi: v? v.suivi : (precedente? precedente.suivi : 'simple'),
    organisme: v? (v.organisme||'') : (precedente? (precedente.organisme||'') : ''),
    medecin: v? (v.medecin||'') : '',
    avis: v? (v.avis||'') : '',
    reserves: v? (v.reserves||'') : '',
    prochaineVisite: v? (v.prochaineVisite||'') : '',
    notes: v? (v.notes||'') : '',
    fichierNom: v? (v.fichierNom||'') : '',
    /* Une échéance déjà enregistrée a été décidée par quelqu'un : la
       proposition automatique ne doit pas la reprendre sous prétexte qu'on
       corrige le régime. */
    echeanceSaisieMain: !!(v && v.prochaineVisite)
  };
  renderTab();
}
function fermerFormVisiteRh(){
  state.rhVisiteForm = null;
  renderTab();
}
function formVisiteRhHTML(){
  const f = state.rhVisiteForm;
  return `<div class="form-panel" style="margin-top:12px;">
    <h3>${f.id? 'Modifier la visite' : 'Enregistrer une visite médicale'}</h3>
    <div class="field-grid">
      <div class="field"><label>Date de la visite</label><input type="date" id="visRh_dateVisite" value="${f.dateVisite||''}" onchange="onVisiteRhEcheanceChange()"></div>
      <div class="field"><label>Type de visite</label><select id="visRh_type" onchange="onVisiteRhEcheanceChange()">
        ${window.TYPES_VISITE.map(t=>`<option value="${t.code}" ${f.type===t.code?'selected':''}>${t.icone} ${esc(t.libelle)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Régime de suivi</label><select id="visRh_suivi" onchange="onVisiteRhEcheanceChange()">
        ${window.REGIMES_SUIVI.map(r=>`<option value="${r.code}" ${f.suivi===r.code?'selected':''}>${esc(r.libelle)}</option>`).join('')}
      </select><div class="card-sub" id="visRh_reference" style="margin-top:4px;"></div></div>
      <div class="field"><label>Avis d'aptitude</label><select id="visRh_avis">
        <option value="">— Non rendu —</option>
        ${window.AVIS_APTITUDE.map(a=>`<option value="${a.code}" ${f.avis===a.code?'selected':''}>${esc(a.libelle)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Service de santé au travail</label><input type="text" id="visRh_organisme" value="${esc(f.organisme)}" placeholder="Ex : AIST, APST BTP…"></div>
      <div class="field"><label>Médecin</label><input type="text" id="visRh_medecin" value="${esc(f.medecin)}"></div>
      <div class="field"><label>Prochaine visite</label><input type="date" id="visRh_prochaineVisite" value="${f.prochaineVisite||''}" onchange="onVisiteRhEcheanceMain()">
        <div class="card-sub" id="visRh_avertissement" style="margin-top:4px;"></div></div>
      <div class="field full"><label>Réserves et aménagements</label><input type="text" id="visRh_reserves" value="${esc(f.reserves)}" placeholder="Ex : pas de port de charge supérieure à 15 kg"></div>
      <div class="field full"><label>Notes</label><input type="text" id="visRh_notes" value="${esc(f.notes)}"></div>
    </div>
    <div class="achat-salarie-zone">
      <label class="btn small" style="cursor:pointer;">📎 ${f.id && f.fichierNom? "Remplacer l'attestation" : "Joindre l'attestation"}<input type="file" id="visRh_fichier" accept=".pdf,image/*" style="display:none;" onchange="onFichierVisiteRhChange()"></label>
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
  try{
    if(f.id) await window.majVisiteMedicale(f.id, saisie, fichier);
    else await window.ajouterVisiteMedicale(f.salarieId, saisie, fichier);
  }catch(err){
    console.error('Visite médicale refusée', err);
    showToast(refusDocumentRh(err));
    return;
  }
  state.rhVisiteForm = null;
  /* Les deux dates de la fiche salarié viennent d'être recalculées en base par
     le déclencheur : recharger les salariés, sinon l'écran garde les anciennes. */
  await Promise.all([chargerVisitesRh(true), recharger('salarie')]);
  showToast('Visite enregistrée.', 'success');
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
  await Promise.all([chargerVisitesRh(true), recharger('salarie')]);
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
function renderRHVisites(){
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
const TYPES_ABSENCE =['Congé payé','Arrêt maladie','Congé sans solde','Absence injustifiée','Accident du travail'];
function soldeCPRestant(e){
  const initial = parseFloat(e.soldeCPInitial) || 0;
  const pris = (e.absences||[]).filter(a=>a.type==='Congé payé').reduce((s,a)=>s+(parseFloat(a.nbJours)||0),0);
  return initial - pris;
}
function nbJoursOuvres(dateDebut, dateFin){
  let d = new Date(dateDebut+'T00:00:00');
  const fin = new Date(dateFin+'T00:00:00');
  let n = 0;
  while(d <= fin){
    const jour = d.getDay();
    if(jour!==0 && jour!==6) n++;
    d.setDate(d.getDate()+1);
  }
  return n;
}
async function updateSoldeCPPreview(salarieId){
  const val = document.getElementById('sal_soldeCPInitial').value;
  state.editing.soldeCPInitial = val;
  const s = state.salaries.find(x=>x.id===salarieId);
  if(s){
    s.soldeCPInitial = val;
    await window.stSet('salarie:'+salarieId, s);
  }
  renderTab();
}
function onAbsTypeChange(salarieId){
  const type = document.getElementById('absType_'+salarieId).value;
  const zone = document.getElementById('absJustificatifZone_'+salarieId);
  const necessiteJustificatif = type==='Arrêt maladie' || type==='Accident du travail';
  zone.style.display = necessiteJustificatif? 'flex' : 'none';
  if(!necessiteJustificatif){
    document.getElementById('absJustificatif_'+salarieId).value = '';
    document.getElementById('absJustificatifNom_'+salarieId).textContent = '';
  }
}
async function addAbsence(salarieId){
  const type = document.getElementById('absType_'+salarieId).value;
  const dateDebut = document.getElementById('absDebut_'+salarieId).value;
  const dateFin = document.getElementById('absFin_'+salarieId).value;
  const commentaire = document.getElementById('absCommentaire_'+salarieId).value;
  if(!dateDebut || !dateFin){ showToast('Indiquez une date de début et de fin.'); return; }
  if(dateFin < dateDebut){ showToast('La date de fin doit être après la date de début.'); return; }
  const nbJours = nbJoursOuvres(dateDebut, dateFin);
  const s = state.salaries.find(x=>x.id===salarieId);
  if(!s) return;
  if(!s.absences) s.absences = [];
  const justificatifInput = document.getElementById('absJustificatif_'+salarieId);
  const finishSave = async (fichierNom, fichierData) => {
    s.absences.push({ id: uid(), type, dateDebut, dateFin, nbJours, commentaire, fichierNom: fichierNom||'', fichierData: fichierData||null });
    if(state.editing && state.editing.id===salarieId) state.editing.absences = s.absences;
    await window.stSet('salarie:'+salarieId, s);
    await recharger('salarie');
    renderTab();
    showToast('Absence enregistrée.', 'success');
  };
  if(justificatifInput && justificatifInput.files[0]){
    const reader = new FileReader();
    reader.onload = (ev)=> finishSave(justificatifInput.files[0].name, ev.target.result);
    reader.readAsDataURL(justificatifInput.files[0]);
  } else {
    await finishSave(null, null);
  }
}
async function removeAbsence(salarieId, absenceId){
  const s = state.salaries.find(x=>x.id===salarieId);
  if(!s) return;
  s.absences = (s.absences||[]).filter(a=>a.id!==absenceId);
  if(state.editing && state.editing.id===salarieId) state.editing.absences = s.absences;
  await window.stSet('salarie:'+salarieId, s);
  await recharger('salarie');
  renderTab();
}
function salarieForm(){
  const e = state.editing;
  if(!e.habilitations) e.habilitations = [];
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le salarié' : 'Nouveau salarié'}</h3>
    <div class="field-grid">
      <div class="field"><label>Prénom</label><input type="text" id="sal_prenom" value="${esc(e.prenom)}"></div>
      <div class="field"><label>Nom</label><input type="text" id="sal_nom" value="${esc(e.nom)}"></div>
      <div class="field"><label>Poste / métier</label><input type="text" id="sal_poste" value="${esc(e.poste)}" placeholder="Ex : Plombier, Chef d'équipe…"></div>
      <div class="field"><label>Date de naissance</label><input type="date" id="sal_dateNaissance" value="${e.dateNaissance||''}"></div>
      <div class="field"><label>Nationalité</label><input type="text" id="sal_nationalite" value="${esc(e.nationalite)}" placeholder="Ex : Française"></div>
      <div class="field"><label>Sexe</label><select id="sal_sexe">
        <option value="" ${!e.sexe?'selected':''}>—</option>
        <option value="F" ${e.sexe==='F'?'selected':''}>Femme</option>
        <option value="M" ${e.sexe==='M'?'selected':''}>Homme</option>
      </select></div>
      <div class="field"><label>Équipe</label><select id="sal_technicienId">${technicienLinkOptions(e.technicienId)}</select></div>
      <div class="field"><label>Compte utilisateur</label><select id="sal_profileId">${comptesLinkOptions(e.profileId)}</select><div class="card-sub" style="margin-top:4px;">Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même.</div>${zoneInvitationHTML(e)}</div>
      <div class="field"><label>Type de contrat</label><select id="sal_typeContrat">${TYPES_CONTRAT.map(t=>`<option value="${t}" ${e.typeContrat===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Coût horaire chargé (HT, salaire + charges)</label><input type="number" step="0.01" id="sal_coutHoraireCharge" value="${e.coutHoraireCharge!=null?e.coutHoraireCharge:''}" placeholder="Ex : 32.50"></div>
      <div class="field"><label>Salaire mensuel net</label><input type="number" step="0.01" id="sal_salaireMensuelNet" value="${e.salaireMensuelNet!=null?e.salaireMensuelNet:''}" placeholder="Ex : 1850"></div>
      <div class="field"><label>Date de début de contrat</label><input type="date" id="sal_dateDebut" value="${e.dateDebut||''}"></div>
      <div class="field"><label>Date de fin de contrat (si applicable)</label><input type="date" id="sal_dateFin" value="${e.dateFin||''}"></div>
      <div class="field"><label>Téléphone</label><input type="text" id="sal_telephone" value="${esc(e.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="sal_email" value="${esc(e.email)}"></div>
      <div class="field"><label>N° Carte BTP</label><input type="text" id="sal_carteBtpNumero" value="${esc(e.carteBtpNumero)}"></div>
      <div class="field"><label>Validité carte BTP</label><input type="date" id="sal_carteBtpValidite" value="${e.carteBtpValidite||''}"></div>
      <div class="field"><label>Dernière visite médicale</label><input type="date" id="sal_visiteMedicaleDate" value="${e.visiteMedicaleDate||''}" disabled style="background:var(--surface-2);"></div>
      <div class="field"><label>Prochaine visite médicale</label><input type="date" id="sal_visiteMedicaleProchaine" value="${e.visiteMedicaleProchaine||''}" disabled style="background:var(--surface-2);"><div class="card-sub" style="margin-top:4px;">Tenues par le registre des visites, plus bas — la base les réécrit à chaque enregistrement.</div></div>
    </div>
    <div class="section-title" style="margin-top:14px;">Habilitations & certifications</div>
    <div id="habilitationsBody">${habilitationRowsHTML(e.habilitations)}</div>
    <button class="btn small" onclick="addHabilitation()">+ Habilitation</button>
    ${e.id? `
    <div class="section-title" style="margin-top:18px;">📁 Dossier documentaire</div>
    ${dossierRhHTML(e)}
    <div class="section-title" style="margin-top:18px;">🩺 Suivi médical</div>
    ${visitesMedicalesHTML(e)}
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🏖️ Congés & Absences</span>
    </div>
    <div class="field-grid" style="margin-top:8px;">
      <div class="field"><label>Solde de CP acquis (jours)</label><input type="number" step="0.5" id="sal_soldeCPInitial" value="${e.soldeCPInitial!=null?e.soldeCPInitial:''}" placeholder="Ex : 25" onchange="updateSoldeCPPreview('${jsAttr(e.id)}')"></div>
      <div class="field"><label>Solde restant (calculé)</label><input type="text" value="${soldeCPRestant(e).toFixed(1)} jour(s)" disabled style="background:var(--surface-2); font-weight:700;"></div>
    </div>
    <div class="entretien-add-row">
      <select id="absType_${e.id}" onchange="onAbsTypeChange('${jsAttr(e.id)}')">${TYPES_ABSENCE.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
      <input type="date" id="absDebut_${e.id}" placeholder="Début">
      <input type="date" id="absFin_${e.id}" placeholder="Fin">
      <input type="text" id="absCommentaire_${e.id}" placeholder="Commentaire (optionnel)" style="flex:1; min-width:140px;">
      <button class="btn primary" onclick="addAbsence('${jsAttr(e.id)}')">+ Ajouter</button>
    </div>
    <div class="achat-salarie-zone" id="absJustificatifZone_${e.id}" style="display:none;">
      <label class="btn small" style="cursor:pointer;">📎 Joindre le document du médecin<input type="file" id="absJustificatif_${e.id}" accept=".pdf,image/*" style="display:none;"></label>
      <span class="card-sub" id="absJustificatifNom_${e.id}"></span>
    </div>
    <div class="achats-list" style="margin-top:10px;">
      ${(e.absences||[]).length? [...e.absences].sort((a,b)=>(b.dateDebut||'').localeCompare(a.dateDebut||'')).map(a=>`
        <div class="achat-row" style="--cat-color:${a.type==='Congé payé'?'#2E9BF0':a.type==='Arrêt maladie'?'#EF5A6F':'#F0A82E'};">
          <div class="achat-row-icon" style="background:${a.type==='Congé payé'?'#2E9BF022':a.type==='Arrêt maladie'?'#EF5A6F22':'#F0A82E22'}; color:${a.type==='Congé payé'?'#2E9BF0':a.type==='Arrêt maladie'?'#EF5A6F':'#F0A82E'};">🏖️</div>
          <div class="achat-row-main">
            <div class="achat-designation">${esc(a.type)}${a.commentaire? ` — ${esc(a.commentaire)}`:''}${a.fichierNom? ` · <a href="javascript:void(0)" onclick="event.stopPropagation(); openAttachmentPreview('${jsAttr(a.fichierData)}','${jsAttr(a.fichierNom)}')">📎 justificatif</a>`:''}</div>
            <div class="achat-date">${fmtDate(a.dateDebut)} → ${fmtDate(a.dateFin)} · ${a.nbJours} jour(s) ouvré(s)</div>
          </div>
          <button class="btn small danger" onclick="removeAbsence('${jsAttr(e.id)}','${jsAttr(a.id)}')">✕</button>
        </div>`).join('') : '<div class="empty">Aucune absence enregistrée.</div>'}
    </div>
    ` : `<div class="card-sub" style="margin-top:14px;">💡 Enregistrez d'abord la fiche pour pouvoir ajouter le contrat de travail et ses avenants.</div>`}
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn primary" onclick="saveSalarie()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('salarie')">Annuler</button>
    </div>
  </div>`;
}
function technicienLinkOptions(current){
  const list = state.techniciens.filter(t=>t.societeId===state.societeId);
  return '<option value="">— Aucune —</option>' + list.map(t=>`<option value="${t.id}" ${t.id===current?'selected':''}>${esc(t.nom1||'Équipe')}</option>`).join('');
}
/* Les comptes de la société, pour rattacher un salarié au sien.

   Le rattachement existant est toujours proposé, même si l'annuaire ne l'a pas
   ramené — annuaire non chargé, compte désactivé depuis, société changée. Sans
   cette précaution le champ s'affichait sur « Aucun », et le simple fait
   d'enregistrer la fiche effaçait le lien : le salarié perdait son compte sans
   que personne ne l'ait demandé, et avec lui le droit de pointer ses tâches. */
function comptesLinkOptions(current){
  const list = window.listeIntervenants ? window.listeIntervenants() : [];
  const connu = list.some(i=>i.id===current);
  const options = list.map(i=>`<option value="${i.id}" ${i.id===current?'selected':''}>${esc(i.nom)}</option>`).join('');
  const conserve = (current && !connu)
    ? `<option value="${esc(current)}" selected>Compte déjà rattaché</option>`
    : '';
  return `<option value="" ${current?'':'selected'}>— Aucun —</option>` + conserve + options;
}

/* ---------- Inviter un salarié à se créer un compte ----------

   La liste ci-dessus ne sait que RATTACHER un compte existant. Créer l'identité
   demande la clé de service, qui ne peut pas approcher le navigateur : le
   bouton appelle la fonction de bord `inviter-salarie`.

   Le reste se fait tout seul en base. Deux déclencheurs sur `auth.users`
   inscrivent le membre et renseignent `salaries.profile_id` dès que l'adresse
   est confirmée — l'écran n'a rien à écrire dans le champ « Compte », il n'a
   qu'à recharger. Le rôle n'est accordé qu'à une adresse prouvée : c'est la
   seule garde du circuit, et elle tient. */

/* `sous_traitant` est absent : ce rôle vise la fiche sous-traitant, pas le
   salarié. Le proposer ici rattacherait la personne à la mauvaise table. */
const ROLES_INVITATION = [
  { code:'technicien', libelle:'Technicien — déclare ses travaux' },
  { code:'conducteur', libelle:'Conducteur de travaux' },
  { code:'secretaire', libelle:'Secrétaire — devis, factures, RH' },
  { code:'lecture',    libelle:'Lecture seule' },
  { code:'admin',      libelle:'Administrateur — tous les droits' },
];
let chargementInvitations = null;
function invitationsPretes(){
  return !chargementInvitations
    && state.invitationsCharges
    && state.invitationsSociete === state.societeId;
}
function chargerInvitationsRh(force){
  if(chargementInvitations) return chargementInvitations;
  if(!force && invitationsPretes()) return Promise.resolve();
  const societe = state.societeId;
  chargementInvitations = (async ()=>{
    try{
      state.invitations = await window.chargerInvitations();
    }catch(err){
      /* Un compte non administrateur n'a rien à y voir : la RLS le dira, et ce
         n'est pas une panne. On se tait, et le bloc reste muet. */
      console.error('Invitations illisibles', err);
      state.invitations = [];
    }finally{
      state.invitationsCharges = true;
      state.invitationsSociete = societe;
      chargementInvitations = null;
    }
    renderTab();
  })();
  return chargementInvitations;
}
function invitationDuSalarie(salarieId){
  return state.invitations.find(i=>i.salarie_id===salarieId && i.statut==='en_attente') || null;
}
function zoneInvitationHTML(e){
  if(!e.id) return '';
  if(!window.autorise || !window.autorise('utilisateurs','creer')) return '';
  if(e.profileId) return '<div class="card-sub" style="margin-top:6px; color:#15803d;">✓ Compte rattaché.</div>';
  if(!invitationsPretes()){ chargerInvitationsRh(); return ''; }

  const invitation = invitationDuSalarie(e.id);
  if(invitation){
    const envoyee = invitation.invitee_le ? fmtDate(invitation.invitee_le.slice(0,10)) : null;
    return `<div class="card-sub" style="margin-top:8px;">
      ✉ Invitation en attente pour <strong>${esc(invitation.email)}</strong>${envoyee? ` — envoyée le ${envoyee}`:''}.
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn small" onclick="renvoyerInvitationSalarie('${jsAttr(e.id)}','${jsAttr(invitation.email)}','${jsAttr(invitation.role)}')">Renvoyer</button>
        <button class="btn small danger" onclick="annulerInvitationSalarie('${jsAttr(invitation.id)}')">Annuler</button>
      </div>
    </div>`;
  }

  const email = (e.email||'').trim();
  return `<div style="margin-top:8px; padding:10px; border:1px dashed var(--border); border-radius:10px;">
    <div class="card-sub" style="margin-bottom:6px;">Pas de compte ? Invitez-le : il recevra un courriel et choisira son mot de passe.</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <input type="email" id="inv_email_${e.id}" value="${esc(email)}" placeholder="adresse e-mail" style="flex:1; min-width:180px;">
      <select id="inv_role_${e.id}" style="width:auto;">
        ${ROLES_INVITATION.map(r=>`<option value="${r.code}">${esc(r.libelle)}</option>`).join('')}
      </select>
      <button class="btn small primary" onclick="inviterSalarieEcran('${jsAttr(e.id)}')">✉ Inviter</button>
    </div>
    ${email? '' : '<div class="card-sub" style="margin-top:6px;">Renseignez d\'abord son e-mail ci-dessous, ou saisissez-le ici.</div>'}
  </div>`;
}
async function inviterSalarieEcran(salarieId){
  const email = (document.getElementById('inv_email_'+salarieId).value||'').trim();
  const role = document.getElementById('inv_role_'+salarieId).value;
  if(!email || !email.includes('@')){ showToast("Indiquez une adresse e-mail valide."); return; }
  if(role === 'admin' && !confirm("Donner TOUS les droits à ce compte, y compris la gestion des utilisateurs ?")) return;
  await envoyerInvitation(salarieId, email, role);
}
async function renvoyerInvitationSalarie(salarieId, email, role){
  await envoyerInvitation(salarieId, email, role);
}
async function envoyerInvitation(salarieId, email, role){
  try{
    const r = await window.inviterSalarie(salarieId, email, role);
    /* Trois issues, trois phrases : un compte déjà confirmé se rattache
       sur-le-champ, sans qu'aucun courriel ne parte — le dire, sinon on
       attendrait un mail qui ne viendra jamais. */
    const message = r.etat === 'rattachee'
      ? 'Ce compte existait déjà : il vient d\'être rattaché, sans courriel.'
      : r.etat === 'confirmation_renvoyee'
        ? 'Courriel de confirmation renvoyé à ' + r.email + '.'
        : 'Invitation envoyée à ' + r.email + '.';
    showToast(message, 'success');
  }catch(err){
    console.error('Invitation refusée', err);
    showToast(err.message || "L'invitation n'a pas pu être envoyée.");
    return;
  }
  await Promise.all([chargerInvitationsRh(true), recharger('salarie')]);
}
async function annulerInvitationSalarie(invitationId){
  if(!confirm("Annuler cette invitation ? Le lien déjà envoyé ne donnera plus aucun droit.")) return;
  try{
    await window.annulerInvitation(invitationId);
  }catch(err){
    console.error('Annulation refusée', err);
    showToast("L'invitation n'a pas pu être annulée.");
    return;
  }
  await chargerInvitationsRh(true);
  showToast('Invitation annulée.', 'success');
}

function habilitationRowsHTML(habilitations){
  if(!habilitations.length) return '<div class="empty">Aucune habilitation renseignée.</div>';
  return habilitations.map((h,i)=>`
    <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
      <input type="text" data-idx="${i}" data-field="nom" value="${esc(h.nom)}" placeholder="Ex : CACES R486, Habilitation électrique B1V…" style="flex:1;">
      <input type="date" data-idx="${i}" data-field="dateExpiration" value="${h.dateExpiration||''}" style="width:auto;" onchange="refreshHabilitationAlerte(${i}, this.value)">
      <span id="habilitationAlerte_${i}">${alerteEcheance(h.dateExpiration)}</span>
      <button class="btn small danger" onclick="removeHabilitation(${i})">✕</button>
    </div>`).join('');
}
function refreshHabilitationAlerte(idx, value){
  const el = document.getElementById('habilitationAlerte_'+idx);
  if(el) el.innerHTML = alerteEcheance(value);
}
function addHabilitation(){
  captureHabilitationsFromDOM();
  state.editing.habilitations.push({nom:'', dateExpiration:''});
  document.getElementById('habilitationsBody').innerHTML = habilitationRowsHTML(state.editing.habilitations);
}
function removeHabilitation(idx){
  captureHabilitationsFromDOM();
  state.editing.habilitations.splice(idx,1);
  document.getElementById('habilitationsBody').innerHTML = habilitationRowsHTML(state.editing.habilitations);
}
function captureHabilitationsFromDOM(){
  const body = document.getElementById('habilitationsBody');
  if(!body) return;
  body.querySelectorAll('input[data-idx]').forEach(inp=>{
    const idx = parseInt(inp.dataset.idx,10);
    const field = inp.dataset.field;
    if(state.editing.habilitations[idx]) state.editing.habilitations[idx][field] = inp.value;
  });
}
async function saveSalarie(){
  const e = state.editing;
  const nom = document.getElementById('sal_nom').value.trim();
  if(!nom){ alert('Le nom du salarié est requis.'); return; }
  captureHabilitationsFromDOM();
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, createdAt: e.createdAt || new Date().toISOString(),
    nom, prenom: document.getElementById('sal_prenom').value,
    poste: document.getElementById('sal_poste').value,
    dateNaissance: document.getElementById('sal_dateNaissance').value,
    nationalite: document.getElementById('sal_nationalite').value,
    sexe: document.getElementById('sal_sexe').value,
    technicienId: document.getElementById('sal_technicienId').value || null,
    profileId: document.getElementById('sal_profileId').value || null,
    typeContrat: document.getElementById('sal_typeContrat').value,
    coutHoraireCharge: parseFloat(document.getElementById('sal_coutHoraireCharge').value) || null,
    salaireMensuelNet: parseFloat(document.getElementById('sal_salaireMensuelNet').value) || null,
    dateDebut: document.getElementById('sal_dateDebut').value,
    dateFin: document.getElementById('sal_dateFin').value,
    telephone: document.getElementById('sal_telephone').value,
    email: document.getElementById('sal_email').value,
    carteBtpNumero: document.getElementById('sal_carteBtpNumero').value,
    carteBtpValidite: document.getElementById('sal_carteBtpValidite').value,
    visiteMedicaleDate: document.getElementById('sal_visiteMedicaleDate').value,
    visiteMedicaleProchaine: document.getElementById('sal_visiteMedicaleProchaine').value,
    habilitations: state.editing.habilitations.filter(h=>h.nom),
    /* `contratTravail` et `avenantsContrat` ne sont plus posés ici : ces deux
       champs n'ont jamais eu de colonne, `colonnesDe()` les écartait avant
       l'envoi, et les fichiers encodés en data-URL qu'ils portaient
       disparaissaient au rechargement suivant. Le dossier documentaire les
       remplace, dans `salarie_documents` et le bucket `terrain`. */
    soldeCPInitial: document.getElementById('sal_soldeCPInitial')? document.getElementById('sal_soldeCPInitial').value : (e.soldeCPInitial||null),
    absences: e.absences || [] };
  const r = await window.stSet('salarie:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('salarie');
  closeForm('salarie');
  showToast(e.id? 'Salarié modifié.' : 'Salarié créé.', 'success');
}
function renderClients(){
  return `
    <div class="page-head"><h1>Clients</h1>${state.formOpen.client? '' : '<button class="btn primary" onclick="openForm(\'client\')">+ Nouveau client</button>'}</div>
    ${renderClientsSection()}
  `;
}
function renderClientsSection(){
  return `
    ${barreRecherche('client', 'Rechercher : nom, interlocuteur, ville, SIRET, e-mail…')}
    <div id="formZoneClient">${state.formOpen.client? clientForm() : ''}</div>
    <div id="liste-client">${listeClientsHTML()}</div>
  `;
}
const listeClientsHTML = declarerListing('client',
  ()=> state.clients.filter(c=>c.societeId===state.societeId),
  list => list.map(c=>{
      const contacts = state.interlocuteurs.filter(i=>i.clientId===c.id);
      return `
      <div class="card"><div class="card-row">
        <div><div class="card-title">${esc(c.nom)}</div><div class="card-sub">${esc(c.telephone||'')}${c.telephone&&c.adresse?' · ':''}${esc(c.adresse||'')}</div>${c.email? `<div class="card-sub">${esc(c.email)}</div>`:''}</div>
      </div>
      ${contacts.length? `<div style="margin-top:8px;">${contacts.map(i=>`
        <div class="card-sub" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <span>👤 ${esc(i.nom)}${i.fonction? ' — '+esc(i.fonction):''}${i.telephone? ' · '+esc(i.telephone):''}${i.email? ' · '+esc(i.email):''}</span>
          <span style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn small" style="padding:2px 8px;" title="Modifier cet interlocuteur" onclick="editItem('interlocuteur','${jsAttr(i.id)}')">Modifier</button>
            <button class="btn small danger" style="padding:2px 7px;" onclick="deleteItem('interlocuteur','${jsAttr(i.id)}')">✕</button>
          </span>
        </div>`).join('')}</div>`:''}
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small primary" onclick="editItem('client','${jsAttr(c.id)}')">Modifier le client</button>
        <button class="btn small" onclick="openForm('interlocuteur', {clientId:'${jsAttr(c.id)}'})">+ Ajouter un interlocuteur</button>
        <button class="btn small danger" onclick="deleteItem('client','${jsAttr(c.id)}')">Supprimer le client</button>
      </div>
      ${state.formOpen.interlocuteur && state.editing.clientId===c.id? interlocuteurForm(c): ''}
      </div>`;
    }).join('') || listeVide('client', 'Aucun client enregistré pour cette société.', 'client'),
  /* Les interlocuteurs s'affichent dans la fiche du client : chercher le nom
     d'un contact doit donc ramener son client, sinon la barre ment sur ce
     qu'elle voit. */
  c => state.interlocuteurs.filter(i=>i.clientId===c.id)
         .map(i=>[i.nom, i.fonction, i.telephone, i.email].filter(Boolean).join(' ')));
function interlocuteurForm(client){
  const e = state.editing;
  return `
  <div class="form-panel" style="margin-top:10px;">
    <h3>${e.id? "Modifier l'interlocuteur" : "Nouvel interlocuteur — "+esc(client.nom)}</h3>
    <div class="field-grid">
      <div class="field"><label>Nom</label><input type="text" id="i_nom" value="${esc(e.nom)}" placeholder="Ex : M. Martin"></div>
      <div class="field"><label>Fonction</label><input type="text" id="i_fonction" value="${esc(e.fonction)}" placeholder="Ex : Gestionnaire, Comptabilité…"></div>
      <div class="field"><label>Téléphone</label><input type="tel" id="i_telephone" value="${esc(e.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="i_email" value="${esc(e.email)}"></div>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn primary" onclick="saveInterlocuteur('${jsAttr(client.id)}')">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('interlocuteur')">Annuler</button>
    </div>
  </div>`;
}
async function saveInterlocuteur(clientId){
  const e = state.editing;
  const nom = document.getElementById('i_nom').value.trim();
  if(!nom){ alert("Le nom de l'interlocuteur est requis."); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, clientId,
    nom, fonction: document.getElementById('i_fonction').value,
    telephone: document.getElementById('i_telephone').value,
    email: document.getElementById('i_email').value };
  const r = await window.stSet('interlocuteur:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('interlocuteur');
  closeForm('interlocuteur');
}
/* Champs que l'annuaire sait remplir sur la fiche client. */
const CIBLES_ANNUAIRE_CLIENT = {
  nom:'c_nom', adresse:'c_adresse', codePostal:'c_codePostal', ville:'c_ville',
  siren:'c_siren', tvaIntracom:'c_tvaIntracom',
  adresseElectroniqueValeur:'c_adresseElectroniqueValeur',
  adresseElectroniqueSchema:'c_adresseElectroniqueSchema',
};

/**
 * Le cadre de facturation ouvre le formulaire, il ne le referme pas.
 *
 * Un particulier n'a ni SIRET, ni TVA, ni adresse électronique — le B2C relève
 * de l'e-reporting. Sa fiche est donc plus courte qu'avant. À l'inverse, une
 * administration réclame le bloc marché public. Tous les blocs sont rendus et
 * l'on ne bascule que leur affichage : le formulaire ne se re-rend pas, et un
 * `renderTab()` effacerait la saisie en cours.
 */
function clientForm(){
  const e = state.editing;
  const cadre = e.cadreFacturation || 'B2B_national';
  const schemas = (window.SCHEMAS_ADRESSE_ELECTRONIQUE||[]);
  return `
  <div class="form-panel">
    <h3>${e.id?'Modifier le client':'Nouveau client'}</h3>

    <div class="field-grid">
      <div class="field full">
        <label>Type de client</label>
        <select id="c_cadreFacturation" onchange="majSectionsEfacture()">
          ${(window.CADRES_FACTURATION||[]).map(c=>`<option value="${esc(c.code)}" ${cadre===c.code?'selected':''}>${esc(c.libelle)}</option>`).join('')}
        </select>
        <small id="c_cadreAide" style="color:var(--text-dim); font-size:11px;"></small>
        <small id="c_cadreSuggestion" style="color:#B85C00; font-size:11px; font-weight:600;"></small>
      </div>

      <div class="field" style="position:relative;">
        <label>Nom / raison sociale</label>
        <input type="text" id="c_nom" value="${esc(e.nom)}" autocomplete="off" placeholder="Ex : syndic, bailleur social, société…" oninput="searchEntreprise(this.value)" onkeydown="if(event.key==='Enter'){ event.preventDefault(); const b=document.getElementById('clientSuggestions'); if(b) b.style.display='none'; this.blur(); }" onblur="setTimeout(()=>{const b=document.getElementById('clientSuggestions'); if(b) b.style.display='none';},150)">
        <div id="clientSuggestions" class="suggest-box"></div>
      </div>
      <div class="field"><label>Téléphone</label><input type="tel" id="c_tel" value="${esc(e.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="c_email" value="${esc(e.email)}" placeholder="contact@client.fr"></div>
    </div>

    <div id="sec_immatriculation" class="field-grid">
      ${champSiretHTML('c_siret', e.siret, CIBLES_ANNUAIRE_CLIENT)}
      <div class="field"><label>SIREN</label><input type="text" id="c_siren" value="${esc(e.siren)}" placeholder="9 chiffres" inputmode="numeric" onchange="majCompletudeClient()"></div>
      <div class="field">
        <label>N° de TVA intracommunautaire</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="c_tvaIntracom" value="${esc(e.tvaIntracom)}" placeholder="FR…" style="flex:1;">
          <button type="button" class="btn small" onclick="calculerTvaClient()" title="Calculer depuis le SIREN">∑</button>
        </div>
      </div>
    </div>

    <div class="field-grid">
      <div class="field full" style="position:relative;">
        <label>Adresse</label>
        <input type="text" id="c_adresse" autocomplete="off" value="${esc(e.adresse)}" data-suggest="clientAdresseSuggestions"
               oninput="searchAdresse(this, {adresse:'c_adresse', codePostal:'c_codePostal', ville:'c_ville'})"
               onblur="setTimeout(()=>{const b=document.getElementById('clientAdresseSuggestions'); if(b) b.style.display='none';},150)">
        <div id="clientAdresseSuggestions" class="suggest-box"></div>
      </div>
      <div class="field"><label>Code postal</label><input type="text" id="c_codePostal" value="${esc(e.codePostal)}"></div>
      <div class="field"><label>Ville</label><input type="text" id="c_ville" value="${esc(e.ville)}"></div>
      <div class="field" id="sec_pays"><label>Pays</label><input type="text" id="c_paysCode" value="${esc(e.paysCode||paysDefaut())}" maxlength="2" placeholder="${esc(paysDefaut())}" onchange="majSectionsEfacture()"></div>
    </div>

    <div id="sec_efacture" class="field-grid">
      <div class="field full section-title" style="margin:12px 0 0;">📧 Facture électronique</div>
      <div class="field">
        <label>Schéma de l'adresse</label>
        <select id="c_adresseElectroniqueSchema">
          <option value="">—</option>
          ${schemas.map(s=>`<option value="${esc(s.code)}" ${e.adresseElectroniqueSchema===s.code?'selected':''}>${esc(s.code)} — ${esc(s.libelle)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Adresse électronique</label><input type="text" id="c_adresseElectroniqueValeur" value="${esc(e.adresseElectroniqueValeur)}" placeholder="déduite du SIRET"></div>
      <div class="field"><label>Code de routage</label><input type="text" id="c_codeRoutage" value="${esc(e.codeRoutage)}" placeholder="facultatif"></div>
      <div class="field"><label>Référence acheteur</label><input type="text" id="c_referenceAcheteur" value="${esc(e.referenceAcheteur)}" placeholder="réf. interne exigée par le client"></div>
      <div class="field full"><small style="color:var(--text-dim); font-size:11px;">L'adresse électronique se déduit du SIRET. Ne la modifiez que si votre client vous en a communiqué une autre.</small></div>
    </div>

    <div id="sec_marche" class="field-grid">
      <div class="field full section-title" style="margin:12px 0 0;">🏛 Marché public</div>
      <div class="field"><label>Code service exécutant</label><input type="text" id="c_codeService" value="${esc(e.codeService)}" onchange="majCompletudeClient()"></div>
      <div class="field"><label>N° d'engagement</label><input type="text" id="c_referenceEngagement" value="${esc(e.referenceEngagement)}" onchange="majCompletudeClient()"></div>
      <div class="field"><label>N° de marché</label><input type="text" id="c_numeroMarche" value="${esc(e.numeroMarche)}"></div>
    </div>

    <div class="field-grid">
      <div class="field full section-title" style="margin:12px 0 0;">💶 Règlement</div>
      <div class="field"><label>Délai de paiement</label>
        <select id="c_delaiPreset" onchange="choisirDelaiPreregle()">${optionsDelaiHTML(e)}</select></div>
      <div class="field"><label>Mode de règlement</label>
        <select id="c_modePaiement">${optionsModeReglementHTML(e.modePaiement)}</select></div>
      ${/* Les deux champs bruts ne servent plus qu'au délai hors liste — 21 jours,
           par exemple. Ils restent les seuls à s'enregistrer : la liste nomme des
           combinaisons, elle ne devient pas la donnée. */''}
      <div class="field" id="c_delaiLibreJours"${delaiEstPreregle(e)?' hidden':''}>
        <label>Nombre de jours</label>
        <input type="number" min="0" id="c_delaiPaiementJours" value="${e.delaiPaiementJours ?? ''}"
               placeholder="Défaut société : ${reglagesCourants().documents.delaiPaiementJours}"
               oninput="majDelaiPaiementAide()"></div>
      <div class="field" id="c_delaiLibreMode"${delaiEstPreregle(e)?' hidden':''}>
        <label>Mode de calcul</label>
        <select id="c_delaiPaiementMode" onchange="majDelaiPaiementAide()">
          <option value="net"${(e.delaiPaiementMode||'net')==='net'?' selected':''}>Net — date de facture + N jours</option>
          <option value="fin_de_mois"${e.delaiPaiementMode==='fin_de_mois'?' selected':''}>Fin de mois — fin du mois + N jours</option>
        </select></div>
      <div class="field full"><small id="c_delaiPaiementAide" class="card-sub"></small></div>
    </div>

    <details style="margin-top:12px;">
      <summary style="cursor:pointer; font-weight:600; font-size:13px;">Adresses de facturation et de livraison différentes</summary>
      <div class="field-grid" style="margin-top:8px;">
        <div class="field full"><label>Adresse de facturation</label><input type="text" id="c_facturationAdresse" value="${esc(e.facturationAdresse)}"></div>
        <div class="field"><label>Code postal</label><input type="text" id="c_facturationCodePostal" value="${esc(e.facturationCodePostal)}"></div>
        <div class="field"><label>Ville</label><input type="text" id="c_facturationVille" value="${esc(e.facturationVille)}"></div>
        <div class="field full"><label>Adresse de livraison</label><input type="text" id="c_livraisonAdresse" value="${esc(e.livraisonAdresse)}"></div>
        <div class="field"><label>Code postal</label><input type="text" id="c_livraisonCodePostal" value="${esc(e.livraisonCodePostal)}"></div>
        <div class="field"><label>Ville</label><input type="text" id="c_livraisonVille" value="${esc(e.livraisonVille)}"></div>
      </div>
    </details>

    <details style="margin-top:8px;">
      <summary style="cursor:pointer; font-weight:600; font-size:13px;">Service comptabilité</summary>
      <div class="field-grid" style="margin-top:8px;">
        <div class="field"><label>Nom</label><input type="text" id="c_contactNom" value="${esc(e.contactNom)}"></div>
        <div class="field"><label>Email</label><input type="email" id="c_contactEmail" value="${esc(e.contactEmail)}"></div>
        <div class="field"><label>Téléphone</label><input type="tel" id="c_contactTelephone" value="${esc(e.contactTelephone)}"></div>
        <div class="field full"><small style="color:var(--text-dim); font-size:11px;">Destinataire des factures. Les interlocuteurs restent l'annuaire opérationnel du chantier.</small></div>
      </div>
    </details>

    <div class="field-grid" style="margin-top:8px;">
      <div class="field full"><label>Notes</label><input type="text" id="c_notes" value="${esc(e.notes)}"></div>
    </div>

    <div class="field full" style="margin-top:-6px;"><small style="color:var(--text-dim); font-size:11px;">Tapez un nom (3 lettres min.), un SIREN (9 chiffres) ou un SIRET (14) : nom officiel, adresse, SIREN et n° de TVA sont renseignés automatiquement. Les établissements fermés sont signalés.</small></div>
    <div id="c_completude" style="margin-top:8px;"></div>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn primary" onclick="saveClient()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('client')">Annuler</button>
    </div>
  </div>`;
}

/* Le cadre décide de ce qui est visible. On ne touche qu'au display : le
   formulaire n'est jamais re-rendu, sinon la saisie en cours serait perdue. */
function majSectionsEfacture(){
  const select = document.getElementById('c_cadreFacturation');
  if(!select) return;
  const cadre = select.value;
  const visibles = window.sectionsEfactureVisibles(cadre);

  const bascule = (id, cle) => {
    const el = document.getElementById(id);
    if(el) el.style.display = visibles.includes(cle) ? '' : 'none';
  };
  bascule('sec_immatriculation','immatriculation');
  bascule('sec_efacture','efacture');
  bascule('sec_marche','marche');
  bascule('sec_pays','pays');

  const aide = (window.CADRES_FACTURATION||[]).find(c=>c.code===cadre);
  const zoneAide = document.getElementById('c_cadreAide');
  if(zoneAide) zoneAide.textContent = aide ? aide.aide : '';

  majCompletudeClient();
}

/** Objet client reconstruit depuis le DOM, pour les contrôles à la volée. */
function clientDepuisFormulaire(){
  const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  return {
    nom: v('c_nom'), telephone: v('c_tel'), email: v('c_email'),
    siret: v('c_siret'), siren: v('c_siren'), tvaIntracom: v('c_tvaIntracom'),
    adresse: v('c_adresse'), codePostal: v('c_codePostal'), ville: v('c_ville'),
    paysCode: v('c_paysCode') || paysDefaut(),
    /* `v()` rend '' : il faut un lecteur qui distingue « vide » de « zéro ».
       `parseInt(x) || null` confondrait « pas paramétré » et « à réception ».
       Et tout champ absent d'ici est perdu à chaque enregistrement. */
    delaiPaiementJours: (() => { const el = document.getElementById('c_delaiPaiementJours');
      const s = el ? el.value.trim() : ''; return s === '' ? null : Number(s); })(),
    delaiPaiementMode: v('c_delaiPaiementMode') || null,
    modePaiement: v('c_modePaiement') || null,
    cadreFacturation: v('c_cadreFacturation'),
    adresseElectroniqueSchema: v('c_adresseElectroniqueSchema'),
    adresseElectroniqueValeur: v('c_adresseElectroniqueValeur'),
    codeRoutage: v('c_codeRoutage'), referenceAcheteur: v('c_referenceAcheteur'),
    codeService: v('c_codeService'), referenceEngagement: v('c_referenceEngagement'),
    numeroMarche: v('c_numeroMarche'),
    facturationAdresse: v('c_facturationAdresse'), facturationCodePostal: v('c_facturationCodePostal'),
    facturationVille: v('c_facturationVille'),
    livraisonAdresse: v('c_livraisonAdresse'), livraisonCodePostal: v('c_livraisonCodePostal'),
    livraisonVille: v('c_livraisonVille'),
    contactNom: v('c_contactNom'), contactEmail: v('c_contactEmail'), contactTelephone: v('c_contactTelephone'),
    notes: v('c_notes'),
  };
}

/* Informatif, jamais bloquant : on dit ce qui manquera le jour de l'émission. */
function majCompletudeClient(){
  const zone = document.getElementById('c_completude');
  if(!zone) return;
  const manques = window.completudeClient(clientDepuisFormulaire());
  zone.innerHTML = manques.length
    ? `<div class="wf-banner alerte">${esc(window.messageAnomalies(manques))}</div>`
    : `<div class="wf-banner ok">✓ Cette fiche est complète pour la facture électronique.</div>`;
}

function calculerTvaClient(){
  const champ = document.getElementById('c_tvaIntracom');
  if(!champ) return;
  const siren = (document.getElementById('c_siren')||{}).value
    || window.sirenDuSiret((document.getElementById('c_siret')||{}).value);
  const tva = window.tvaIntracomFr(siren);
  if(!tva){ showToast('Renseignez d\'abord un SIRET ou un SIREN.'); return; }
  champ.value = tva;
}

/* L'annuaire connaît la catégorie juridique : elle dit si l'acheteur est public.
   On le suggère, on ne l'applique pas — le cadre change le canal de transmission. */
function majApresAnnuaire(etab){
  const zone = document.getElementById('c_cadreSuggestion');
  if(!zone) return;
  const select = document.getElementById('c_cadreFacturation');
  const suggestion = window.cadreSuggere({
    paysCode: (document.getElementById('c_paysCode')||{}).value || paysDefaut(),
    natureJuridique: etab && etab.formeJuridique,
  });
  zone.textContent = (suggestion && select && select.value !== suggestion.cadre)
    ? `${suggestion.motif} Type suggéré : ${(window.CADRES_FACTURATION.find(c=>c.code===suggestion.cadre)||{}).libelle}.`
    : '';
  majCompletudeClient();
}
let entrepriseSearchTimer = null;
let entrepriseResults = [];
function formatEntrepriseAdresse(r){
  const s = r.siege || {};
  return (s.adresse || '').trim();
}
function searchEntreprise(query){
  clearTimeout(entrepriseSearchTimer);
  const box = document.getElementById('clientSuggestions');
  if(!box) return;
  const q = (query||'').trim();
  const chiffres = q.replace(/[^0-9]/g,'');
  const estNumero = chiffres.length===9 || chiffres.length===14;
  if(!q || (q.length < 3 && !estNumero)){ box.innerHTML=''; box.style.display='none'; return; }

  entrepriseSearchTimer = setTimeout(async ()=>{
    box.innerHTML = '<div class="suggest-empty">Recherche…</div>';
    box.style.display = 'block';
    const res = await window.rechercherEntreprise(q);

    if(res.type === 'erreur'){
      entrepriseResults = [];
      box.innerHTML = `<div class="suggest-empty">${esc(res.message)} — saisie manuelle possible</div>`;
      return;
    }

    entrepriseResults = res.type === 'siret' ? [res.etablissement] : res.etablissements;
    if(!entrepriseResults.length){
      box.innerHTML = '<div class="suggest-empty">Aucun résultat — saisie manuelle possible</div>';
      return;
    }
    box.innerHTML = entrepriseResults.map((r,i)=>{
      const lieu = [r.adresse, r.codePostal, r.ville].filter(Boolean).join(' ');
      return `<div class="suggest-item" onclick="selectEntreprise(${i})"><b>${esc(r.nom)}</b><small>${esc(lieu)}${r.siret? ' · SIRET '+esc(r.siret):''}</small></div>`;
    }).join('');
  }, 400);
}

/* Renseigne le formulaire client depuis l'annuaire : nom, adresse découpée
   et SIRET, que la base sait stocker. */
/* Une seule voie de remplissage : l'autocomplétion sur le nom délègue au même
   code que le bouton SIRET, sinon les deux chemins divergent au premier champ
   ajouté — c'est ce qui faisait perdre le SIREN et le code APE. */
function selectEntreprise(i){
  const r = entrepriseResults[i];
  if(!r) return;
  siretCibles = CIBLES_ANNUAIRE_CLIENT;
  appliquerEtablissement(r, 'c_siret');
  const box = document.getElementById('clientSuggestions');
  if(box){ box.innerHTML=''; box.style.display='none'; }
}

/* ---------- Recherche SIRET / SIREN ----------
   Champ dédié avec bouton : 14 chiffres remplissent directement, 9 chiffres
   proposent la liste des établissements ouverts. */
let siretResults = [];
let siretCibles = null;

function champSiretHTML(idChamp, valeur, cibles){
  const cfg = esc(JSON.stringify(cibles));
  return `<div class="field full" style="position:relative;">
    <label>SIRET / SIREN</label>
    <div style="display:flex; gap:8px;">
      <input type="text" id="${idChamp}" value="${esc(valeur||'')}" placeholder="14 chiffres (SIRET) ou 9 chiffres (SIREN)" inputmode="numeric"
             onkeydown="if(event.key==='Enter'){ event.preventDefault(); chercherSiret('${jsAttr(idChamp)}', ${cfg}); }">
      <button type="button" class="btn" onclick="chercherSiret('${jsAttr(idChamp)}', ${cfg})">🔍 Rechercher</button>
    </div>
    <div id="${idChamp}_res" class="suggest-box" style="position:static; margin-top:6px;"></div>
  </div>`;
}

/* Ce qu'on dit après avoir rempli les champs.
   Une société CESSÉE au registre reste facturable par erreur : l'annuaire le
   disait, personne ne le regardait. On ne bloque pas — reprendre une créance
   antérieure à la radiation est légitime — on avertit, et l'avertissement
   REMPLACE le « champs remplis » au lieu d'être recouvert par lui. */
function messageApresRemplissage(etab){
  if(etab && etab.active === false){
    const quand = etab.dateFermeture ? ` le ${fmtDate(etab.dateFermeture)}` : '';
    return `<div class="suggest-empty" style="color:var(--danger); font-weight:600;">`
      + `⚠ Entreprise radiée${esc(quand)} au registre — champs remplis. Vérifiez avant d'émettre un document.</div>`;
  }
  return '<div class="suggest-empty" style="color:var(--success,#1E6B37);">Champs remplis.</div>';
}

async function chercherSiret(idChamp, cibles){
  const input = document.getElementById(idChamp);
  const box = document.getElementById(idChamp + '_res');
  if(!input || !box) return;

  const numero = (input.value||'').replace(/[^0-9]/g,'');
  if(numero.length !== 9 && numero.length !== 14){
    showToast('Saisissez 9 chiffres (SIREN) ou 14 chiffres (SIRET).');
    return;
  }

  siretCibles = cibles;
  box.style.display = 'block';
  box.innerHTML = '<div class="suggest-empty">Recherche…</div>';

  const res = await window.rechercherEntreprise(numero);

  if(res.type === 'erreur'){
    box.innerHTML = `<div class="suggest-empty" style="color:var(--danger);">${esc(res.message)}</div>`;
    return;
  }
  if(res.type === 'siret'){
    appliquerEtablissement(res.etablissement, idChamp);
    box.innerHTML = messageApresRemplissage(res.etablissement);
    return;
  }

  siretResults = res.etablissements || [];
  if(siretResults.length === 1){
    appliquerEtablissement(siretResults[0], idChamp);
    box.innerHTML = messageApresRemplissage(siretResults[0]);
    return;
  }
  box.innerHTML = `<div class="suggest-empty">${siretResults.length} établissements ouverts — choisissez :</div>`
    + siretResults.map((r,i)=>
        `<div class="suggest-item" onclick="choisirEtablissement(${i}, '${jsAttr(idChamp)}')"><b>${esc(r.nom)}</b><small>${esc([r.adresse, r.codePostal, r.ville].filter(Boolean).join(' '))} · ${esc(r.siret)}</small></div>`
      ).join('');
}

function choisirEtablissement(i, idChamp){
  const r = siretResults[i];
  if(!r) return;
  appliquerEtablissement(r, idChamp);
  const box = document.getElementById(idChamp + '_res');
  if(box) box.innerHTML = messageApresRemplissage(r);
}

/* Ne remplit que les champs déclarés par l'appelant : chaque formulaire a ses
   propres identifiants. */
/* Un clic dans l'annuaire remplit tout ce qu'il sait, y compris l'identité
   fiscale : SIREN, code APE, forme juridique et n° de TVA (calculé, l'annuaire
   ne le renvoie pas). L'adresse électronique s'en déduit également.
   Les champs déjà saisis ne sont jamais écrasés — une surcharge manuelle de
   l'adresse électronique doit survivre à une nouvelle recherche. */
function appliquerEtablissement(etab, idChamp){
  const c = siretCibles || {};
  const set = (id, v) => { const el = id && document.getElementById(id); if(el && v != null) el.value = v; };
  const setSiVide = (id, v) => {
    const el = id && document.getElementById(id);
    if(el && v != null && !String(el.value||'').trim()) el.value = v;
  };
  set(idChamp, etab.siret);
  set(c.nom, etab.nom);
  set(c.adresse, etab.adresse);
  set(c.codePostal, etab.codePostal);
  set(c.ville, etab.ville);

  set(c.siren, etab.siren);
  setSiVide(c.tvaIntracom, etab.tvaIntracom);
  setSiVide(c.codeNaf, etab.activite);
  setSiVide(c.formeJuridique, etab.formeJuridique);

  /* Le dirigeant ne s'impose pas : un cabinet peut vouloir nommer un
     représentant autre que celui du registre. On ne remplit que le vide. */
  setSiVide(c.gerant, etab.dirigeant);

  const adr = window.adresseElectroniqueParDefaut(etab);
  if(adr){
    setSiVide(c.adresseElectroniqueValeur, adr.valeur);
    setSiVide(c.adresseElectroniqueSchema, adr.schema);
  }

  if(typeof majApresAnnuaire === 'function') majApresAnnuaire(etab);
}

/* ---------- Autocomplétion d'adresse (Base Adresse Nationale) ---------- */
let adresseSearchTimer = null;
let adresseResults = [];
let adresseCible = null;

function searchAdresse(input, idsCibles){
  clearTimeout(adresseSearchTimer);
  const box = document.getElementById(input.dataset.suggest);
  if(!box) return;
  const q = (input.value||'').trim();
  if(q.length < 3){ box.innerHTML=''; box.style.display='none'; return; }

  adresseCible = idsCibles;
  adresseSearchTimer = setTimeout(async ()=>{
    box.innerHTML = '<div class="suggest-empty">Recherche…</div>';
    box.style.display = 'block';
    adresseResults = await window.rechercherAdresse(q);
    if(!adresseResults.length){
      box.innerHTML = '<div class="suggest-empty">Aucune adresse trouvée — saisie manuelle possible</div>';
      return;
    }
    box.innerHTML = adresseResults.map((a,i)=>
      `<div class="suggest-item" onclick="selectAdresse(${i}, '${jsAttr(box.id)}')"><b>${esc(a.adresse)}</b><small>${esc(a.codePostal)} ${esc(a.ville)}</small></div>`
    ).join('');
  }, 350);
}

function selectAdresse(i, boxId){
  const a = adresseResults[i];
  if(!a || !adresseCible) return;
  const set = (id, v) => { const el = id && document.getElementById(id); if(el) el.value = v; };
  set(adresseCible.adresse, a.adresse);
  set(adresseCible.codePostal, a.codePostal);
  set(adresseCible.ville, a.ville);
  const box = document.getElementById(boxId);
  if(box){ box.innerHTML=''; box.style.display='none'; }
}

async function saveClient(){
  const e = state.editing;
  const saisi = clientDepuisFormulaire();
  if(!saisi.nom){ alert('Le nom du client est requis.'); return; }

  /* On refuse ce qui est mal formé — un SIRET dont la clé est fausse — jamais
     ce qui manque : un client sans SIRET reste parfaitement enregistrable. */
  const anomalies = window.verifierEntite(saisi);
  if(anomalies.length){ alert(window.messageAnomalies(anomalies)); return; }

  const id = e.id || uid();
  const obj = {
    ...saisi,
    id,
    societeId: state.societeId,
    /* Écrits par la vérification annuaire, sans champ de saisie : sans ce
       report explicite, chaque enregistrement les effacerait. */
    eligibiliteStatut: e.eligibiliteStatut,
    eligibiliteMessage: e.eligibiliteMessage,
    eligibiliteVerifieLe: e.eligibiliteVerifieLe,
  };

  const r = await window.stSet('client:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('client');
  closeForm('client');
}

/* ---------- Articles / catalogue de prestations ---------- */
function renderMetiersSection(){
  return `
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
      <span>Métiers</span>
      <button class="btn small primary" onclick="openForm('metierPerso')">+ Nouveau métier</button>
    </div>
    ${barreRecherche('metierPerso', 'Rechercher un métier…')}
    <div id="formZoneMetierPerso">${state.formOpen.metierPerso? metierPersoForm() : ''}</div>
    <div id="liste-metierPerso">${listeMetiersHTML()}</div>
  `;
}
const listeMetiersHTML = declarerListing('metierPerso',
  ()=> state.metiersPerso.filter(m=>m.societeId===state.societeId),
  list => list.map(m=>`
      <div class="card"><div class="card-row">
        <div style="display:flex; align-items:center; gap:8px;"><span style="width:16px; height:16px; border-radius:4px; background:${esc(m.couleur||'#999')}; flex-shrink:0; border:1px solid rgba(0,0,0,.1);"></span><div class="card-title">${esc(m.nom)}</div></div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn small" onclick="editItem('metierPerso','${jsAttr(m.id)}')">Modifier</button>
        <button class="btn small danger" onclick="deleteItem('metierPerso','${jsAttr(m.id)}')">Supprimer</button>
      </div></div>`).join('') || listeVide('metierPerso', 'Aucun métier enregistré pour cette société.', 'métier'));
const METIER_PALETTE = ['#FF6A1A','#F5B301','#FFD23F','#2E9E4F','#5EC26A','#0E7C66','#178A7A','#1E8FD5','#3AA9E0','#0B5FA5','#5B5FE8','#7C6FF0','#8E5CE6','#B85CD1','#D65DB1','#C77DFF','#8A6D3B','#B08D57','#5C6470'];
function pickMetierCouleur(couleur){
  const input = document.getElementById('mp_couleur');
  if(input) input.value = couleur;
  document.querySelectorAll('.metier-swatch').forEach(el=>{
    el.classList.toggle('is-selected', el.title === couleur);
  });
}
function metierPersoForm(){
  const e = state.editing;
  const couleurActuelle = e.couleur || METIER_PALETTE[0];
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le métier' : 'Nouveau métier'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom du métier</label><input type="text" id="mp_nom" value="${esc(e.nom)}" placeholder="Ex : Menuiserie, Serrurerie, Peinture…"></div>
      <div class="field full">
        <label>Couleur</label>
        <input type="hidden" id="mp_couleur" value="${esc(couleurActuelle)}">
        <div class="metier-palette">${METIER_PALETTE.map(c=>`<button type="button" class="metier-swatch ${c===couleurActuelle?'is-selected':''}" style="background:${c};" onclick="pickMetierCouleur('${jsAttr(c)}')" title="${c}"></button>`).join('')}</div>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn primary" onclick="saveMetierPerso()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('metierPerso')">Annuler</button>
    </div>
  </div>`;
}
async function saveMetierPerso(){
  const e = state.editing;
  const nom = document.getElementById('mp_nom').value.trim();
  if(!nom){ alert('Le nom du métier est requis.'); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, nom, couleur: document.getElementById('mp_couleur').value };
  const r = await window.stSet('metierPerso:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('metierPerso');
  closeForm('metierPerso');
  showToast(e.id? 'Métier modifié.' : 'Métier créé.', 'success');
}
function metierPersoSelectOptions(current){
  const list = state.metiersPerso.filter(m=>m.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">— Non précisé —</option>' + list.map(m=>`<option value="${esc(m.nom)}" ${m.nom===current?'selected':''}>${esc(m.nom)}</option>`).join('');
}
function metierPersoFilterOptions(current){
  const list = state.metiersPerso.filter(m=>m.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">Tous les métiers</option>' + list.map(m=>`<option value="${esc(m.nom)}" ${m.nom===current?'selected':''}>${esc(m.nom)}</option>`).join('');
}
function renderConducteursSection(){
  return `
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
      <span>Conducteurs de travaux</span>
      <button class="btn small primary" onclick="openForm('conducteur')">+ Nouveau conducteur</button>
    </div>
    ${barreRecherche('conducteur', 'Rechercher : nom, téléphone, e-mail…')}
    <div id="formZoneConducteur">${state.formOpen.conducteur? conducteurForm() : ''}</div>
    <div id="liste-conducteur">${listeConducteursHTML()}</div>
  `;
}
const listeConducteursHTML = declarerListing('conducteur',
  ()=> state.conducteurs.filter(c=>c.societeId===state.societeId),
  list => list.map(c=>`
      <div class="card"><div class="card-row">
        <div><div class="card-title">${esc(c.nom)}</div>${c.telephone||c.email? `<div class="card-sub">${[c.telephone,c.email].filter(Boolean).join(' · ')}</div>`:''}${c.profileId? '' : '<div class="card-sub" title="Sans compte, son tableau de bord montre les affaires de toute la société">⚠ sans compte utilisateur</div>'}</div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn small" onclick="editItem('conducteur','${jsAttr(c.id)}')">Modifier</button>
        <button class="btn small danger" onclick="deleteItem('conducteur','${jsAttr(c.id)}')">Supprimer</button>
      </div></div>`).join('') || listeVide('conducteur', 'Aucun conducteur de travaux enregistré pour cette société.', 'conducteur'));
function conducteurForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le conducteur' : 'Nouveau conducteur de travaux'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom</label><input type="text" id="cd_nom" value="${esc(e.nom)}" placeholder="Ex : M. Martin"></div>
      <div class="field"><label>Téléphone</label><input type="tel" id="cd_telephone" value="${esc(e.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="cd_email" value="${esc(e.email)}"></div>
      <div class="field full"><label>Compte utilisateur</label><select id="cd_profileId">${comptesLinkOptions(e.profileId)}</select><div class="card-sub" style="margin-top:4px;">Sans compte, son tableau de bord montrera les affaires de toute la société au lieu des siennes.</div></div>
    </div>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn primary" onclick="saveConducteur()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('conducteur')">Annuler</button>
    </div>
  </div>`;
}
async function saveConducteur(){
  const e = state.editing;
  const nom = document.getElementById('cd_nom').value.trim();
  if(!nom){ alert('Le nom du conducteur est requis.'); return; }
  const id = e.id || uid();
  /* Renommer une fiche réécrit, en base, l'étiquette de tous les documents qui
     la désignent. Recharger les seuls conducteurs laisserait donc l'écran sur
     l'ancien nom — partout ailleurs. */
  const ancienNom = e.id ? (state.conducteurs.find(c=>c.id===e.id)||{}).nom : null;
  const obj = { id, societeId: state.societeId, nom,
    telephone: document.getElementById('cd_telephone').value,
    email: document.getElementById('cd_email').value,
    profileId: document.getElementById('cd_profileId').value || null };
  const r = await window.stSet('conducteur:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  if(ancienNom != null && ancienNom !== nom)
    await recharger('conducteur', 'bonCommande', 'devis', 'facture', 'intervention', 'chantier');
  else
    await recharger('conducteur');
  closeForm('conducteur');
  showToast(e.id? 'Conducteur modifié.' : 'Conducteur créé.', 'success');
}
/* La valeur est l'IDENTIFIANT de la fiche, comme pour les chantiers — et non
   plus son nom recopié. Un renommage ne scinde donc plus les statistiques.

   `conducteurIdDe` rattrape les documents écrits avant la reprise, dont l'écran
   ne connaît encore que le nom : sans lui, ouvrir une vieille fiche afficherait
   « Non attribué » et l'enregistrer effacerait le conducteur. */
/* Le rôle vaut `sous_traitant`, avec un tiret bas, comme en base et comme dans
   `ROLES_LIBELLES`. Vingt-quatre comparaisons le cherchaient sous
   « soustraitant » : aucune n'a jamais été vraie, et tout le parcours
   sous-traitant — son tableau de bord, ses devis, ses factures, son planning en
   lecture seule — est resté inatteignable depuis qu'il existe. Une seule
   fonction désormais, pour que la faute ne puisse plus se répéter. */
function estSousTraitant(){ return state.currentRole === 'sous_traitant'; }

function conducteurIdDe(e){
  if(e && e.conducteurId) return e.conducteurId;
  const nom = ((e && e.conducteur) || '').trim().toLowerCase();
  if(!nom) return '';
  const fiche = state.conducteurs.find(c=>c.societeId===state.societeId
    && (c.nom||'').trim().toLowerCase() === nom);
  return fiche ? fiche.id : '';
}

function conducteurSelectOptions(currentId){
  const list = state.conducteurs.filter(c=>c.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">— Non attribué —</option>' + list.map(c=>`<option value="${esc(c.id)}" ${c.id===currentId?'selected':''}>${esc(c.nom)}</option>`).join('');
}

/* On envoie la référence ET le nom. La base tient l'étiquette d'après la
   référence, mais sans ce nom, retirer le conducteur d'un document laisserait
   son étiquette derrière lui — la colonne n'étant alors pas réécrite. */
function conducteurDuSelect(idChamp){
  const el = document.getElementById(idChamp);
  if(!el) return {};
  const fiche = state.conducteurs.find(c=>c.id === el.value);
  return { conducteurId: el.value || '', conducteur: fiche ? fiche.nom : '' };
}
function chantierSelectOptions(current){
  const list = state.chantiers.filter(c=>c.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">— Aucun —</option>' + list.map(c=>`<option value="${c.id}" ${c.id===current?'selected':''}>${esc(c.nom)}</option>`).join('');
}
function conducteurFilterOptions(current, allLabel){
  const list = state.conducteurs.filter(c=>c.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return `<option value="">${esc(allLabel||'Tous les conducteurs')}</option>` + list.map(c=>`<option value="${esc(c.nom)}" ${c.nom===current?'selected':''}>${esc(c.nom)}</option>`).join('');
}
function togglePlanningUnschedFilter(){
  state.planningUnschedFilterOpen = !state.planningUnschedFilterOpen;
  const panel = document.getElementById('planningUnschedFilterPanel');
  if(panel) panel.style.display = state.planningUnschedFilterOpen ? 'flex' : 'none';
}
function planningUnschedClientOptions(current){
  const list = state.clients.filter(c=>c.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">Tous les clients</option>' + list.map(c=>`<option value="${esc(c.nom)}" ${c.nom===current?'selected':''}>${esc(c.nom)}</option>`).join('');
}
function planningUnschedInterlocuteurOptions(current, clientNom){
  const client = clientNom ? state.clients.find(c=>c.societeId===state.societeId && c.nom===clientNom) : null;
  const list = clientNom
    ? (client ? state.interlocuteurs.filter(i=>i.clientId===client.id) : [])
    : state.interlocuteurs.filter(i=>i.societeId===state.societeId);
  return '<option value="">Tous les interlocuteurs</option>' + list.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'')).map(i=>`<option value="${esc(i.nom)}" ${i.nom===current?'selected':''}>${esc(i.nom)}</option>`).join('');
}
function filterPlanningUnschedClient(value){
  state.planningUnschedClientFilter = value;
  state.planningUnschedInterlocuteurFilter = '';
  renderTab();
}
function filterPlanningUnschedInterlocuteur(value){
  state.planningUnschedInterlocuteurFilter = value;
  renderTab();
}

function renderSousTraitantsSection(){
  return `
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
      <span>Sous-traitants</span>
      <button class="btn small primary" onclick="openForm('sousTraitant')">+ Nouveau sous-traitant</button>
    </div>
    ${barreRecherche('sousTraitant', 'Rechercher : nom, métier, ville, SIRET…')}
    <div id="formZoneSousTraitant">${state.formOpen.sousTraitant? sousTraitantForm() : ''}</div>
    <div id="liste-sousTraitant">${listeSousTraitantsHTML()}</div>
  `;
}
const listeSousTraitantsHTML = declarerListing('sousTraitant',
  ()=> state.sousTraitants.filter(s=>s.societeId===state.societeId),
  list => list.map(s=>`
      <div class="card"><div class="card-row">
        <div><div class="card-title">${esc(s.nom)}</div>${s.telephone||s.email? `<div class="card-sub">${[s.telephone,s.email].filter(Boolean).join(' · ')}</div>`:''}${(s.metiers&&s.metiers.length)? `<div class="card-sub">🔧 ${s.metiers.map(esc).join(', ')}</div>` : (s.metier? `<div class="card-sub">🔧 ${esc(s.metier)}</div>`:'')}</div>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn small" onclick="editItem('sousTraitant','${jsAttr(s.id)}')">Modifier</button>
        <button class="btn small danger" onclick="deleteItem('sousTraitant','${jsAttr(s.id)}')">Supprimer</button>
      </div></div>`).join('') || listeVide('sousTraitant', 'Aucun sous-traitant enregistré pour cette société.', 'sous-traitant'));
function sousTraitantForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom / Entreprise</label><input type="text" id="st_nom" value="${esc(e.nom)}" placeholder="Ex : SARL Toiture Plus"></div>
      ${champSiretHTML('st_siret', e.siret, {nom:'st_nom', adresse:'st_adresse', codePostal:'st_codePostal', ville:'st_ville', siren:'st_siren', tvaIntracom:'st_tvaIntracom'})}
      <div class="field"><label>SIREN</label><input type="text" id="st_siren" value="${esc(e.siren)}" inputmode="numeric" placeholder="9 chiffres"></div>
      <div class="field"><label>N° de TVA intracommunautaire</label><input type="text" id="st_tvaIntracom" value="${esc(e.tvaIntracom)}" placeholder="FR…"></div>
      <div class="field full"><small style="color:var(--text-dim); font-size:11px;">Le SIREN sert à rapprocher automatiquement les factures que ce sous-traitant vous adresse.</small></div>
      <div class="field full"><label>Adresse</label><input type="text" id="st_adresse" value="${esc(e.adresse)}"></div>
      <div class="field"><label>Code postal</label><input type="text" id="st_codePostal" value="${esc(e.codePostal)}"></div>
      <div class="field"><label>Ville</label><input type="text" id="st_ville" value="${esc(e.ville)}"></div>
      <div class="field"><label>Téléphone</label><input type="tel" id="st_telephone" value="${esc(e.telephone)}"></div>
      <div class="field"><label>Email</label><input type="email" id="st_email" value="${esc(e.email)}"></div>
      <div class="field full"><label>Métier(s)</label>${metierCheckboxesHTML('st', e.metiers || (e.metier? [e.metier] : []))}</div>
    </div>
    ${e.id? `
    <div class="chantier-subsection-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
      <span>📑 Documents (décennale, vigilance URSSAF…)</span>
    </div>
    <div class="entretien-add-row">
      <select id="stDocType">${TYPES_DOC_SOUSTRAITANT.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
      <input type="date" id="stDocExpiration" placeholder="Date d'expiration">
      <label class="btn small" style="cursor:pointer;">📎 Fichier<input type="file" id="stDocFichier" accept=".pdf,image/*" style="display:none;"></label>
      <button class="btn primary" onclick="addSousTraitantDoc('${jsAttr(e.id)}')">+ Ajouter</button>
    </div>
    <div class="achats-list" style="margin-top:10px;">
      ${(e.documents||[]).length? [...e.documents].sort((a,b)=>(a.dateExpiration||'9999').localeCompare(b.dateExpiration||'9999')).map(d=>{
        const j = joursAvant(d.dateExpiration);
        const alerte = j!=null && j<=30;
        return `<div class="achat-row" style="--cat-color:${alerte?(j<0?'#EF5A6F':'#F0A82E'):'#5BC97A'};">
          <div class="achat-row-icon" style="background:${alerte?(j<0?'#EF5A6F22':'#F0A82E22'):'#5BC97A22'}; color:${alerte?(j<0?'#EF5A6F':'#F0A82E'):'#5BC97A'};">📑</div>
          <div class="achat-row-main">
            <div class="achat-designation">${esc(d.type)}${d.fichierNom? ` · <a href="javascript:void(0)" onclick="openAttachmentPreview('${jsAttr(d.fichierData)}','${jsAttr(d.fichierNom)}')">📎 voir</a>`:''}</div>
            <div class="achat-date">${d.dateExpiration? `Expire le ${fmtDate(d.dateExpiration)}`:'Sans date d\u2019expiration'}${alerte? ` <span class="badge ${j<0?'danger':'warn'}">${j<0?'EXPIRÉ':'DANS '+j+' J'}</span>`:''}</div>
          </div>
          <button class="btn small danger" onclick="removeSousTraitantDoc('${jsAttr(e.id)}','${jsAttr(d.id)}')">✕</button>
        </div>`;
      }).join('') : '<div class="empty">Aucun document enregistré.</div>'}
    </div>
    ` : `<div class="card-sub" style="margin-top:14px;">💡 Enregistrez d'abord la fiche pour pouvoir ajouter ses documents (décennale, vigilance…).</div>`}
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn primary" onclick="saveSousTraitant()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('sousTraitant')">Annuler</button>
    </div>
  </div>`;
}
const TYPES_DOC_SOUSTRAITANT = ['Assurance décennale','Attestation de vigilance URSSAF','Assurance RC Pro','Kbis','Autre'];
async function addSousTraitantDoc(sousTraitantId){
  const type = document.getElementById('stDocType').value;
  const dateExpiration = document.getElementById('stDocExpiration').value;
  const fichierInput = document.getElementById('stDocFichier');
  const st = state.sousTraitants.find(x=>x.id===sousTraitantId);
  if(!st) return;
  if(!st.documents) st.documents = [];
  const finishSave = async (fichierNom, fichierData) => {
    st.documents.push({ id: uid(), type, dateExpiration, fichierNom: fichierNom||'', fichierData: fichierData||null });
    if(state.editing && state.editing.id===sousTraitantId) state.editing.documents = st.documents;
    await window.stSet('sousTraitant:'+sousTraitantId, st);
    await recharger('sousTraitant');
    renderTab();
    showToast('Document enregistré.', 'success');
  };
  if(fichierInput && fichierInput.files[0]){
    const reader = new FileReader();
    reader.onload = (ev)=> finishSave(fichierInput.files[0].name, ev.target.result);
    reader.readAsDataURL(fichierInput.files[0]);
  } else {
    await finishSave(null, null);
  }
}
async function removeSousTraitantDoc(sousTraitantId, docId){
  const st = state.sousTraitants.find(x=>x.id===sousTraitantId);
  if(!st) return;
  st.documents = (st.documents||[]).filter(d=>d.id!==docId);
  if(state.editing && state.editing.id===sousTraitantId) state.editing.documents = st.documents;
  await window.stSet('sousTraitant:'+sousTraitantId, st);
  await recharger('sousTraitant');
  renderTab();
}
async function saveSousTraitant(){
  const e = state.editing;
  const nom = document.getElementById('st_nom').value.trim();
  if(!nom){ alert('Le nom du sous-traitant est requis.'); return; }
  const id = e.id || uid();
  const metiers = getCheckedMetiers('st');
  const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const obj = { id, societeId: state.societeId, nom,
    telephone: v('st_telephone'),
    email: v('st_email'),
    siret: v('st_siret'),
    // Clé de rapprochement avec factures_entrantes.emetteur_siren
    siren: v('st_siren'),
    tvaIntracom: v('st_tvaIntracom'),
    adresse: v('st_adresse'),
    codePostal: v('st_codePostal'),
    ville: v('st_ville'),
    metiers, metier: metiers[0]||'', documents: e.documents || [] };

  const anomalies = window.verifierEntite(obj);
  if(anomalies.length){ alert(window.messageAnomalies(anomalies)); return; }

  const r = await window.stSet('sousTraitant:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('sousTraitant');
  closeForm('sousTraitant');
  showToast(e.id? 'Sous-traitant modifié.' : 'Sous-traitant créé.', 'success');
}
function sousTraitantSelectOptions(current){
  const list = state.sousTraitants.filter(s=>s.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">— Non attribué —</option>' + list.map(s=>`<option value="${esc(s.nom)}" ${s.nom===current?'selected':''}>${esc(s.nom)}</option>`).join('');
}
function sousTraitantFilterOptions(current){
  const list = state.sousTraitants.filter(s=>s.societeId===state.societeId).sort((a,b)=>(a.nom||'').localeCompare(b.nom||''));
  return '<option value="">Tous les sous-traitants</option>' + list.map(s=>`<option value="${esc(s.nom)}" ${s.nom===current?'selected':''}>${esc(s.nom)}</option>`).join('');
}
/* Les équipes ont quitté les Réglages pour l'onglet Équipes du RH, où elles
   vivent avec leurs membres. `renderTechniciensSection` n'existe plus. */

/* Le libellé composait `nom1 + nom2 + nom3`. Seul `nom1` a une colonne : les
   deux autres n'étaient jamais relus, le « + » ne s'affichait qu'avant le
   premier rechargement.

   Les équipes d'origine n'ont pas de nom, seulement un métier — c'est ainsi
   qu'elles ont été créées. Le métier en tient lieu plutôt que « (sans nom) »,
   qui ne désigne rien dans un menu déroulant. */
function technicienLabel(t){
  return t.nom1 || t.metier || (t.metiers && t.metiers[0]) || 'Équipe';
}
/* Retient le client choisi parmi les suggestions de la lecture automatique. */
function appliquerClientOCR(nom){
  state.editing.client = nom;
  renderTab();
  showToast('Client « ' + nom + ' » retenu.', 'success');
}

/* Import depuis la liste : ouvre un formulaire vierge puis le préremplit. */
async function importerBonCommande(fichier, input){
  if(!fichier) return;
  openForm('bonCommande');
  renderTab();
  await lireBonCommande(fichier, input);
}

/* ---------- Lecture automatique d'un bon de commande ----------

   Ce que l'écran affichait : une phrase figée, « Lecture du document en
   cours… », en douze pixels sous le bouton. Aucun mouvement, aucun délai, aucun
   moyen d'abandonner. Et le 14/09 la fonction est morte sans émettre de réponse
   HTTP : la promesse ne s'est jamais résolue, donc le `catch` n'a jamais été
   atteint et la phrase serait restée là indéfiniment.

   Désormais l'écran se consacre à la lecture, un chronomètre tourne, la durée
   habituelle est annoncée, on peut renoncer, et **toute** issue produit un
   message qui survit au rendu — y compris le silence du serveur. */

let ocrChronoTimer = null;

function arreterChronoOCR(){
  if(ocrChronoTimer){ clearInterval(ocrChronoTimer); ocrChronoTimer = null; }
}

/* Le chronomètre ne redessine jamais l'écran : il réécrit trois nœuds. Un
   `renderTab()` chaque seconde emporterait le focus et ferait clignoter la
   page. Il se re-résout à chaque tic et abandonne en silence si l'écran a
   changé — le prochain rendu recalculera la valeur depuis `state.ocr.debut`. */
function majChronoOCR(){
  const o = state.ocr;
  if(!o || !o.enCours){ arreterChronoOCR(); return; }
  const chrono = document.getElementById('ocrChrono');
  if(!chrono) return;

  const ecoule = Date.now() - o.debut;
  const etat = window.etatLecture(o.etape, ecoule, o.evenements || []);
  chrono.textContent = window.formaterDuree(ecoule);
  const libelle = document.getElementById('ocrLibelle');
  if(libelle) libelle.textContent = etat.libelle;
  const alerte = document.getElementById('ocrAlerte');
  if(alerte){
    alerte.textContent = etat.alerte || '';
    alerte.style.display = etat.alerte ? '' : 'none';
  }
}

function demarrerChronoOCR(){
  arreterChronoOCR();
  ocrChronoTimer = setInterval(majChronoOCR, 1000);
}

function annulerLectureBC(){
  const o = state.ocr;
  if(!o || !o.enCours) return;
  o.annuleParUtilisateur = true;
  o.controleur.abort();
}

/** Reprendre la main à la main, après un échec ou un abandon. */
function quitterLectureBC(){
  state.ocr = null;
  renderTab();
}

/** L'écran pendant et après la lecture : il remplace le formulaire. */
function ocrEcranHTML(){
  const o = state.ocr;
  const ecoule = Date.now() - o.debut;

  if(!o.enCours && o.etat){
    const couleur = o.etat.ton === 'erreur' ? 'var(--danger)' : 'var(--text-dim)';
    return `<div class="form-panel ocr-ecran">
      <div class="ocr-titre" style="color:${couleur};">${esc(o.etat.libelle)}</div>
      ${o.etat.alerte? `<div class="ocr-alerte">${esc(o.etat.alerte)}</div>`:''}
      <div class="ocr-fichier">${esc(o.nom)}</div>
      <div class="ocr-actions">
        <label class="btn primary" style="cursor:pointer;">↻ Réessayer
          <input type="file" accept="application/pdf,image/*,.heic,.heif" style="display:none;" onchange="relancerLectureBC(this.files[0], this)">
        </label>
        <button type="button" class="btn" onclick="quitterLectureBC()">Saisir à la main</button>
      </div>
    </div>`;
  }

  const etat = window.etatLecture(o.etape, ecoule, o.evenements || []);
  return `<div class="form-panel ocr-ecran">
    <div class="ocr-titre"><span class="ocr-pastille"></span><span id="ocrLibelle">${esc(etat.libelle)}</span></div>
    <div class="ocr-fichier">${esc(o.nom)}</div>
    <div class="ocr-chrono" id="ocrChrono">${esc(window.formaterDuree(ecoule))}</div>
    <div class="ocr-attente">${esc(window.attenteAnnoncee())}</div>
    <div class="ocr-alerte" id="ocrAlerte" style="display:${etat.alerte?'':'none'};">${esc(etat.alerte||'')}</div>
    <div class="ocr-actions">
      <button type="button" class="btn ghost" onclick="annulerLectureBC()">Annuler la lecture</button>
    </div>
  </div>`;
}

function relancerLectureBC(fichier, input){
  state.ocr = null;
  return lireBonCommande(fichier, input);
}

async function lireBonCommande(fichier, input){
  if(!fichier) return;
  /* Le bouton n'était ni désactivé ni renommé : on pouvait lancer une seconde
     lecture par-dessus la première. */
  if(state.ocr && state.ocr.enCours){
    showToast('Une lecture est déjà en cours.');
    return;
  }

  const controleur = new AbortController();
  state.ocr = {
    enCours: true, etape: 'preparation', debut: Date.now(),
    nom: fichier.name, controleur, evenements: [], etat: null,
    annuleParUtilisateur: false,
  };
  renderTab();
  demarrerChronoOCR();

  try{
    const extraction = await window.extraireBonCommande(fichier, {
      signal: controleur.signal,
      surEtape: (etape)=>{ if(state.ocr){ state.ocr.etape = etape; majChronoOCR(); } },
      /* Le document déposé devient la pièce jointe du bon. Posé ici, avant
         l'appel distant : si la lecture échoue, le scan reste attaché — c'est
         précisément le cas où l'on ressaisit à la main et où l'avoir compte. */
      surFichierPret: (pret)=>{ retenirPieceJointeBC(pret); },
    });
    const saisie = window.versSaisieBonCommande(extraction);

    /* Le nom lu correspond rarement au libellé enregistré : on le rapproche du
       fichier clients pour que le BC se rattache au bon client. */
    const connus = state.clients.filter(c=>c.societeId===state.societeId).map(c=>c.nom);
    const rapp = window.rapprocherClient(saisie.client, connus);
    saisie.client = rapp.nom;

    // On fusionne dans le brouillon en cours sans écraser ce qui est déjà saisi
    Object.entries(saisie).forEach(([k, v])=>{
      if(v === undefined || v === '' ) return;
      if(Array.isArray(v) && !v.length) return;
      state.editing[k] = v;
    });

    const avert = extraction.avertissements || [];
    const messages = [];
    if(!rapp.nom) messages.push('client non détecté');
    else if(!rapp.reconnu) messages.push('client « ' + rapp.nom + ' » à confirmer');
    messages.push(...avert);

    /* La lecture a abouti : l'écran rend la main au formulaire, désormais
       prérempli. Le compte rendu part en toast **et** dans le bloc de statut,
       parce que le premier s'efface au bout de quelques secondes. */
    state.ocr = null;
    renderTab();

    /* Le document lu apporte ses chapitres — « PEINTURE TOUT LE LOGEMENT »,
       « SOL CHAMBRE 1 » — et une lecture est une saisie : les métiers se
       déduisent donc ici aussi. Sans cet appel, un bon lu automatiquement
       arriverait avec ses chapitres mais sans métier, et repartirait avec une
       tâche unique sans métier — le défaut même qu'on vient de corriger. */
    const metiersLus = appliquerMetiersDesChapitres({ silencieux: true });

    const dire = (msg, couleur) => {
      const zone = document.getElementById('ocrStatut');
      if(zone){ zone.textContent = msg; zone.style.color = couleur || 'var(--text-dim)'; }
    };
    dire(messages.length
      ? 'Document lu — à vérifier : ' + messages.join(' · ')
      : 'Document lu — vérifiez les champs avant d\'enregistrer.',
      messages.length ? 'var(--accent-2)' : 'var(--success, #1E6B37)');

    /* Client incertain : on propose les plus proches plutôt que de laisser
       l'utilisateur chercher dans toute la liste. */
    if(!rapp.reconnu && rapp.suggestions.length){
      const box = document.getElementById('ocrStatut');
      if(box){
        box.innerHTML += `<div style="margin-top:8px;">
          <div style="font-size:11.5px; color:var(--text-dim); margin-bottom:4px;">Clients les plus proches :</div>
          ${rapp.suggestions.map(n=>`<button type="button" class="btn small" style="margin:0 6px 6px 0;" onclick="appliquerClientOCR('${jsAttr(n)}')">${esc(n)}</button>`).join('')}
        </div>`;
      }
    }

    /* Un seul toast, qui porte les deux nouvelles : le document est lu, et le
       nombre d'interventions que ses chapitres impliquent au planning. */
    showToast(
      metiersLus.length > 1
        ? `Bon lu — ${metiersLus.length} métiers sur ses chapitres, donc ${metiersLus.length} interventions à planifier. Relisez avant d'enregistrer.`
        : 'Bon de commande lu — relisez avant d\'enregistrer.',
      'success', metiersLus.length > 1 ? 7000 : 4000);
  }catch(err){
    console.error('OCR', err);
    const ecoule = state.ocr ? Date.now() - state.ocr.debut : 0;
    const abandonne = err && (err.name === 'AbortError' || err.name === 'TimeoutError');

    /* Trois issues, trois messages. Les confondre, c'est ce qui faisait croire
       à une panne quand l'utilisateur venait simplement de renoncer — et
       inversement, laisser un silence passer pour une lecture en cours. */
    let etat;
    if(state.ocr && state.ocr.annuleParUtilisateur) etat = window.etatAnnule(ecoule);
    else if(abandonne) etat = window.etatDelaiDepasse(ecoule);
    else etat = window.etatEchec(err && err.message ? err.message : 'Lecture impossible.');

    if(state.ocr){ state.ocr.etat = etat; state.ocr.enCours = false; }
    renderTab();

    /* Le message vit désormais à deux endroits : l'écran, qui le garde, et un
       toast, qui le porte à l'attention même si la page a défilé. Il n'y avait
       jusqu'ici ni l'un ni l'autre en cas d'échec. */
    if(etat.ton === 'erreur'){
      showToast(etat.libelle + (etat.alerte ? ' — ' + etat.alerte : ''), 'error', 9000);
    }
  }finally{
    arreterChronoOCR();
    if(state.ocr) state.ocr.enCours = false;
    if(input) input.value = '';
  }
}

/**
 * Le montant du bon — saisi, ou dicté par les lignes.
 *
 * Dès qu'une ligne est renseignée, l'enregistrement remplace le montant par le
 * total des lignes. Laisser le champ ouvert donnait donc un champ qui ment :
 * on y tapait une somme que la sauvegarde écrasait sans le dire. Il devient
 * alors un affichage, et la phrase dit d'où vient le chiffre.
 */
function bcMontantFieldsHTML(metiers, montantParMetier, montantSimple, sansChapitre, lignes){
  const uniq = [...new Set(metiers||[])];
  const sansChap = sansChapitre || [];
  const parLesLignes = bcLignesOntDuContenu(lignes);
  const totalLignes = parLesLignes ? computeTotals(lignes).ht : 0;
  const nbLignes = (lignes||[]).filter(l=>(l.type||'ligne')==='ligne').length;
  const note = parLesLignes
    ? `<div class="bc-montant-note">${uniq.length > 1
        ? `Le total enregistré est celui des lignes du bon (${nbLignes === 1 ? 'une ligne' : nbLignes+' lignes'}) ; la répartition ci-dessus ne sert qu'à ventiler par métier.`
        : `Calculé sur ${nbLignes === 1 ? 'la ligne' : 'les '+nbLignes+' lignes'} du bon.`}${
        totalLignes ? '' : ' Aucune n\'est chiffrée : le montant restera à 0 tant que la pré-facture ne l\'est pas.'}</div>`
    : '';
  if(uniq.length <= 1){
    if(parLesLignes){
      return `<label>Montant des travaux (HT)</label>
        <input type="number" step="0.01" id="bc_montant" value="${totalLignes}" readonly class="champ-calcule">
        ${note}`;
    }
    return `<label>Montant des travaux (HT)</label><input type="number" step="0.01" id="bc_montant" value="${montantSimple!=null?montantSimple:''}" placeholder="0,00">`;
  }
  return `<label>Montant des travaux (HT) — par métier</label>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${uniq.map(m=>`<div>
        <div style="display:flex; align-items:center; gap:8px;"><span style="min-width:130px; font-size:13px; color:var(--text-dim);">${esc(m)}</span><input type="number" step="0.01" class="bc_montant_metier" data-metier="${esc(m)}" value="${montantParMetier[m]!=null?montantParMetier[m]:''}" placeholder="0,00" style="flex:1;"></div>
        ${sansChap.includes(m)? `<div style="font-size:11.5px; color:var(--accent-2); margin:3px 0 0 138px;">⚠ Aucun chapitre "${esc(m)}" trouvé dans le devis lié — montant à saisir manuellement.</div>` : ''}
      </div>`).join('')}
    </div>${note}`;
}
function refreshBCMontantFields(){
  const checked = getCheckedMetiers('bc');
  const existingAmounts = {};
  document.querySelectorAll('.bc_montant_metier').forEach(el=>{ existingAmounts[el.dataset.metier] = el.value; });
  const simpleEl = document.getElementById('bc_montant');
  const previousSimple = simpleEl ? simpleEl.value : null;
  const devisIdEl = document.getElementById('bc_devisId');
  const sansChapitre = [];
  if(devisIdEl && devisIdEl.value && checked.length > 1){
    const devis = state.devis.find(d=>d.id===devisIdEl.value);
    if(devis){
      const chapterTotals = devisChapterTotals(devis);
      checked.forEach(metier=>{
        if(existingAmounts[metier] == null || existingAmounts[metier] === ''){
          /* Même règle que partout ailleurs : le métier se lit sur le titre du
             chapitre, en mots entiers. L'appariement par sous-chaîne qui vivait
             ici trouvait « SOL » dans « ISOLATION » et ne connaissait ni les
             accents ni les fautes de frappe. */
          const chapKey = Object.keys(chapterTotals).find(ch =>
            !!window.metierDuChapitre(ch, [metier]));
          if(chapKey) existingAmounts[metier] = chapterTotals[chapKey];
          else sansChapitre.push(metier);
        }
      });
    }
  }
  const zone = document.getElementById('bcMontantFieldsZone');
  if(zone) zone.innerHTML = bcMontantFieldsHTML(checked, existingAmounts, previousSimple, sansChapitre, state.editing && state.editing.lignes);
}
/**
 * Les métiers proposés à la saisie, pour la société courante.
 *
 * La table `metiers` ne suffit pas : KTA n'y déclare que CARRELAGE, PEINTURE et
 * SOL, alors que ses bons portent aussi PLOMBERIE (49 bons) et ETANCHEITE (47).
 * Ces deux-là avaient disparu de la liste à cocher, donc impossibles à recocher
 * — et un chapitre « PLOMBERIE » serait resté lettre morte.
 */
function metiersDisponibles(){
  const declares = state.metiersPerso
    .filter(m=>m.societeId===state.societeId)
    .map(m=>m.nom);
  const employes = [];
  state.bonsCommande.forEach(b=>{
    if(b.societeId!==state.societeId) return;
    bcMetiersDuBC(b).forEach(m=>{ if(m) employes.push(m); });
  });
  return window.referentielMetiers ? window.referentielMetiers(declares, employes) : declares;
}

/**
 * Les métiers proposés sur un chapitre.
 *
 * Trois sens tiennent dans cette liste : laisser le titre décider, dire qu'il
 * n'y a aucun métier, ou en nommer un. Les deux premiers ne sont pas la même
 * chose — un chapitre qu'on n'a pas encore tranché doit continuer de suivre son
 * titre, un chapitre « ARTICLE BPU » ne désigne personne et c'est définitif.
 *
 * `metierPersoSelectOptions` ne convenait pas : elle ne connaît que les métiers
 * déclarés aux Réglages. Chez KTA, PLOMBERIE (49 bons) et ETANCHEITE (47) n'y
 * sont pas — la moitié du référentiel réel en serait absente, et c'est le
 * défaut même que `metiersDisponibles()` a été écrit pour corriger.
 *
 * Un métier hérité, retiré des Réglages depuis, reste sélectionnable : même
 * raison que dans `uniteOptions`, rouvrir un vieux document ne doit pas le
 * changer en silence.
 */
function metierChapitreOptions(current){
  const choisi = (current||'').trim();
  const aucun = window.METIER_AUCUN || '(aucun)';
  const meme = (a,b)=> window.memeMetier ? window.memeMetier(a,b) : a===b;

  const noms = metiersDisponibles();
  if(choisi && !meme(choisi, aucun) && !noms.some(n=>meme(n, choisi))) noms.unshift(choisi);

  return `<option value="" ${choisi===''?'selected':''}>— Déduit du titre —</option>`
    + `<option value="${esc(aucun)}" ${meme(choisi, aucun)?'selected':''}>— Aucun métier —</option>`
    + noms.map(n=>`<option value="${esc(n)}" ${meme(n, choisi)?'selected':''}>${esc(n)}</option>`).join('');
}

/**
 * Les chapitres du brouillon, seulement pour dire d'où vient un métier.
 *
 * N'ajoute aucun métier : ouvrir un bon ancien qui porte des chapitres ne doit
 * rien changer à ce qu'il déclare, sinon son planning se scinderait sans que
 * personne l'ait demandé. Les métiers ne s'ajoutent qu'à la saisie, par
 * `appliquerMetiersDesChapitres`.
 */
/**
 * Les métiers du bon en cours de saisie : ceux qu'il déclare, plus ceux que
 * ses chapitres livrent.
 *
 * Ouvrir un bon dans le formulaire **est** une saisie : les métiers lus y sont
 * cochés, et ils sont enregistrés si l'on enregistre. La garde qui compte n'est
 * pas là — elle est dans le fait que cette fonction ne tourne que depuis le
 * formulaire. Ni le chargement des collections ni le rendu du planning ne
 * l'appellent, donc aucun des 830 bons ne change tout seul.
 *
 * La déduction ajoute et ne retire jamais : ce que l'on a coché à la main reste.
 */
function metiersDuBrouillon(e){
  const declares = (e && e.metiers && e.metiers.length) ? [...e.metiers] : (e && e.metier ? [e.metier] : []);
  if(!window.metiersDesChapitres) return { retenus: declares, origines: null, ajoutes: 0 };

  const lu = window.metiersDesChapitres(e && e.lignes, metiersDisponibles());
  const retenus = [...declares];
  for(const m of lu.metiers){
    if(!retenus.some(c=>window.memeMetier(c, m))) retenus.push(m);
  }
  return { retenus, origines: lu.origines, ajoutes: retenus.length - declares.length };
}

/** Le contenu du champ « Métier(s) », rendu à l'identique par les deux chemins. */
function bcMetiersZoneHTML(retenus, origines, ajoutes){
  const cases = metierCheckboxesHTML('bc', retenus, 'onchange="refreshBCMontantFields()"', origines);
  if(!ajoutes) return cases;
  /* Dit en place, et pas seulement en toast : un toast s'efface au bout de
     quelques secondes, et scinder un planning en deux mérite une trace que
     l'on retrouve au moment d'enregistrer. */
  const suite = retenus.length > 1
    ? ` Ce bon se planifiera en ${retenus.length} interventions, une par métier.`
    : '';
  return cases + `<div class="metier-lu">✓ ${ajoutes} métier${ajoutes>1?'s':''} lu${ajoutes>1?'s':''} sur les chapitres du bon.${suite}</div>`;
}

function metierCheckboxesHTML(idPrefix, currentMetiers, onChangeAttr, origines){
  const list = metiersDisponibles();
  const current = [...new Set(currentMetiers || [])];
  if(!list.length) return '<div class="empty">Aucun métier créé pour l\'instant (Réglages → Métiers).</div>';
  const meme = (a,b)=> window.memeMetier ? window.memeMetier(a,b) : a===b;
  return `<div class="metier-checkbox-list">${list.map(nom=>{
    const coche = current.some(c=>meme(c, nom));
    // Le chapitre qui a produit ce métier, s'il vient d'une lecture du bon.
    const cle = origines ? Object.keys(origines).find(k=>meme(k, nom)) : null;
    return `
    <label class="metier-checkbox-item${cle?' est-deduit':''}"${cle?` title="Lu sur le chapitre « ${esc(origines[cle])} »"`:''}>
      <input type="checkbox" name="${idPrefix}_metiers" value="${esc(nom)}" ${coche?'checked':''} ${onChangeAttr||''}>
      <span>${esc(nom)}</span>
      ${cle?`<small class="metier-origine">← ${esc(origines[cle])}</small>`:''}
    </label>`;
  }).join('')}</div>`;
}
function getCheckedMetiers(idPrefix){
  const values = Array.from(document.querySelectorAll(`input[name="${idPrefix}_metiers"]:checked`)).map(el=>el.value);
  return [...new Set(values)];
}
/**
 * Formulaire d'équipe.
 *
 * Il proposait une composition « seul / binôme / trinôme » et jusqu'à trois
 * noms. La table n'a qu'une colonne `nom` : `type`, `nom2` et `nom3` n'avaient
 * aucune colonne et étaient écartés à l'enregistrement — un binôme saisi
 * ressortait seul. Les membres viennent désormais des salariés, où ils sont
 * nommés une fois pour toutes ; l'équipe ne porte plus que son nom, ses métiers
 * et sa couleur au planning.
 */
function technicienForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id? "Modifier l'équipe" : 'Nouvelle équipe'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom de l'équipe</label><input type="text" id="tc_nom1" value="${esc(e.nom1)}" placeholder="Ex : Équipe peinture, Karim &amp; Yanis…"></div>
      <div class="field"><label>Couleur au planning</label><input type="color" id="tc_couleur" value="${esc(e.couleur || '#4F7CFF')}"></div>
      <div class="field full"><label>Métier(s)</label>${metierCheckboxesHTML('tc', e.metiers || (e.metier? [e.metier] : []))}</div>
    </div>
    <p class="card-sub" style="margin-top:4px;">Les membres se rattachent depuis l'onglet Équipes du RH, ou depuis la fiche de chaque salarié.</p>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn primary" onclick="saveTechnicien()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('technicien')">Annuler</button>
    </div>
  </div>`;
}
async function saveTechnicien(){
  const e = state.editing;
  const nom1 = document.getElementById('tc_nom1').value.trim();
  if(!nom1){ alert("Le nom de l'équipe est requis."); return; }
  const id = e.id || uid();
  const metiers = getCheckedMetiers('tc');
  const obj = { id, societeId: state.societeId, nom1, metiers, metier: metiers[0]||'',
    couleur: document.getElementById('tc_couleur').value };
  const r = await window.stSet('technicien:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('technicien');
  closeForm('technicien');
  showToast(e.id? 'Équipe modifiée.' : 'Équipe créée.', 'success');
}
function technicienSelectOptions(current){
  const list = state.techniciens.filter(t=>t.societeId===state.societeId);
  return '<option value="">— Non attribué —</option>' + list.map(t=>{
    const label = technicienLabel(t);
    return `<option value="${esc(label)}" ${label===current?'selected':''}>${esc(label)}</option>`;
  }).join('');
}
function technicienFilterOptions(current, allLabel){
  const list = state.techniciens.filter(t=>t.societeId===state.societeId);
  return `<option value="">${esc(allLabel||'Tous les techniciens')}</option>` + list.map(t=>{
    const label = technicienLabel(t);
    return `<option value="${esc(label)}" ${label===current?'selected':''}>${esc(label)}</option>`;
  }).join('');
}

/* ---------- Catalogue d'articles ----------
   Le catalogue ne vit pas en mémoire, contrairement aux autres collections :
   un millier de références alourdiraient une ouverture qui télécharge déjà
   dix-sept tables entières, alors qu'on n'en consulte qu'une poignée à la
   fois. Chaque écran interroge donc la base, et `state.catalogue` ne garde que
   la page affichée. */
function catalogueEtat(){
  if(!state.catalogue){
    state.catalogue = { recherche:'', actif:'true', type:'', famille:'', page:1,
      articles:[], total:0, pages:1, familles:[], chargement:true, edition:null, import:null };
  }
  return state.catalogue;
}

function renderCatalogue(){
  const c = catalogueEtat();
  // Le rendu est synchrone, les données ne le sont pas : on demande la page
  // puis on redessine la zone, plutôt que d'afficher un écran vide sans rien dire.
  if(c.chargement) setTimeout(rafraichirCatalogue, 0);

  const peutEcrire = !window.autorise || window.autorise('articles','modifier');
  return `
    <div class="page-head"><h1>Catalogue</h1>
      ${peutEcrire && !c.edition && !c.import? `<div style="display:flex; gap:8px;">
        <button class="btn" onclick="ouvrirImportCatalogue()">📥 Importer un fichier</button>
        <button class="btn primary" onclick="ouvrirArticleCatalogue(null)">+ Nouvel article</button>
      </div>`:''}
    </div>
    <div id="catalogueZone">${c.import? importCatalogueHTML(c) : c.edition? articleCatalogueFormHTML(c) : catalogueListeHTML(c)}</div>
  `;
}

async function rafraichirCatalogue(){
  const c = catalogueEtat();
  try{
    const [page, familles] = await Promise.all([
      window.chercherCatalogue({
        recherche: c.recherche,
        actif: c.actif === '' ? null : c.actif === 'true',
        typeArticle: c.type || null,
        famille: c.famille || null,
        page: c.page,
      }),
      c.familles.length? Promise.resolve(c.familles) : window.famillesCatalogue(),
    ]);
    c.articles = page.articles;
    c.total = page.total;
    c.pages = page.pages;
    c.familles = familles;
    c.chargement = false;
  }catch(err){
    console.error('Catalogue indisponible', err);
    c.chargement = false;
    c.erreur = err && err.message ? err.message : 'erreur inconnue';
  }
  if(state.tab === 'catalogue') renderTab();
}

function relancerCatalogue(champ, valeur){
  const c = catalogueEtat();
  c[champ] = valeur;
  if(champ !== 'page') c.page = 1;
  c.chargement = true;
  renderTab();
}

/* La frappe ne déclenche pas une requête par caractère : on attend que la main
   s'arrête. 250 ms, c'est le temps d'une hésitation, pas d'une attente. */
let catalogueMinuteur = null;
function chercherDansCatalogue(valeur){
  const c = catalogueEtat();
  c.recherche = valeur;
  clearTimeout(catalogueMinuteur);
  catalogueMinuteur = setTimeout(()=>{ c.page = 1; c.chargement = true; renderTab(); }, 250);
}

function catalogueListeHTML(c){
  if(c.erreur) return `<div class="empty">Catalogue indisponible : ${esc(c.erreur)}</div>`;

  const peutEcrire = !window.autorise || window.autorise('articles','modifier');
  const filtres = `
    <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
      <input type="text" style="flex:1; min-width:220px;" value="${esc(c.recherche)}" placeholder="Rechercher : code ou désignation…" oninput="chercherDansCatalogue(this.value)">
      <select style="width:auto;" onchange="relancerCatalogue('actif', this.value)">
        <option value="true" ${c.actif==='true'?'selected':''}>Actifs</option>
        <option value="false" ${c.actif==='false'?'selected':''}>Retirés</option>
        <option value="" ${c.actif===''?'selected':''}>Tous</option>
      </select>
      <select style="width:auto;" onchange="relancerCatalogue('type', this.value)">
        <option value="" ${!c.type?'selected':''}>Tous types</option>
        <option value="service" ${c.type==='service'?'selected':''}>Prestations</option>
        <option value="bien" ${c.type==='bien'?'selected':''}>Biens</option>
      </select>
      <select style="width:auto;" onchange="relancerCatalogue('famille', this.value)">
        <option value="" ${!c.famille?'selected':''}>Toutes familles</option>
        ${c.familles.map(f=>`<option value="${esc(f)}" ${c.famille===f?'selected':''}>${esc(f)}</option>`).join('')}
      </select>
    </div>`;

  if(c.chargement) return filtres + '<div class="empty">Chargement du catalogue…</div>';
  if(!c.articles.length) return filtres + `<div class="empty">${c.recherche||c.type||c.famille? 'Aucun article ne correspond.' : 'Le catalogue est vide. Importez un fichier ou créez un premier article.'}</div>`;

  const lignes = c.articles.map(a=>`
    <tr${a.actif? '' : ' style="opacity:.55;"'}>
      <td><span class="numref">${esc(a.code)}</span></td>
      <td>${esc(a.designation)}${a.description? `<div class="card-sub" style="white-space:pre-wrap;">${esc(a.description.slice(0,120))}${a.description.length>120?'…':''}</div>`:''}</td>
      <td>${esc(a.famille)}</td>
      <td>${a.typeArticle==='bien'?'Bien':'Prestation'}</td>
      <td class="num">${esc(a.unite)}</td>
      <td class="num">${money(a.prixUnitaire)}</td>
      <td class="num">${a.tva}%</td>
      <td style="white-space:nowrap;">
        ${peutEcrire? `<button class="btn small" onclick="ouvrirArticleCatalogue('${jsAttr(a.id)}')">Modifier</button>
        ${a.actif
          ? `<button class="btn small danger" onclick="retirerDuCatalogue('${jsAttr(a.id)}')" title="Retirer du catalogue sans l'effacer : des documents citent ce code">Retirer</button>`
          : `<button class="btn small" onclick="remettreAuCatalogue('${jsAttr(a.id)}')">Remettre</button>`}`
        : ''}
      </td>
    </tr>`).join('');

  const pagination = c.pages > 1 ? `
    <div style="display:flex; gap:8px; align-items:center; justify-content:center; margin-top:14px;">
      <button class="btn small" ${c.page<=1?'disabled':''} onclick="relancerCatalogue('page', ${c.page-1})">← Précédent</button>
      <span class="card-sub">Page ${c.page} sur ${c.pages}</span>
      <button class="btn small" ${c.page>=c.pages?'disabled':''} onclick="relancerCatalogue('page', ${c.page+1})">Suivant →</button>
    </div>` : '';

  return filtres + `
    <div class="card-sub" style="margin-bottom:8px;">${c.total} article${c.total>1?'s':''}</div>
    <table class="lignes-table" style="background:#fff;">
      <thead><tr><th style="width:14%;">Code</th><th>Désignation</th><th style="width:12%;">Famille</th><th style="width:10%;">Type</th><th class="num" style="width:8%;">Unité</th><th class="num" style="width:10%;">Prix HT</th><th class="num" style="width:7%;">TVA</th><th style="width:14%;"></th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>${pagination}`;
}

function ouvrirArticleCatalogue(id){
  const c = catalogueEtat();
  const existant = id ? c.articles.find(a=>a.id===id) : null;
  c.edition = existant
    ? { ...existant }
    : { id:null, code:'', designation:'', description:'', unite:'u', prixUnitaire:0, prixAchat:null,
        tva: tvaDefaut(), typeArticle:'service', famille:'', actif:true, gereEnStock:false };
  renderTab();
}

function fermerArticleCatalogue(){
  catalogueEtat().edition = null;
  renderTab();
}

function majArticleCatalogue(champ, valeur){
  const e = catalogueEtat().edition;
  if(!e) return;
  e[champ] = valeur;
}

function articleCatalogueFormHTML(c){
  const e = c.edition;
  return `
  <div class="form-panel">
    <h3>${e.id? "Modifier l'article" : 'Nouvel article'}</h3>
    <div class="field-grid">
      <div class="field"><label>Code article</label><input type="text" id="cat_code" value="${esc(e.code)}" placeholder="PLB-001" oninput="majArticleCatalogue('code', this.value)"></div>
      <div class="field"><label>Famille</label><input type="text" id="cat_famille" value="${esc(e.famille)}" list="famillesCatalogue" oninput="majArticleCatalogue('famille', this.value)">
        <datalist id="famillesCatalogue">${c.familles.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></div>
      <div class="field full"><label>Désignation</label><input type="text" id="cat_designation" value="${esc(e.designation)}" oninput="majArticleCatalogue('designation', this.value)"></div>
      <div class="field full"><label>Description</label><textarea id="cat_description" style="min-height:70px;" oninput="majArticleCatalogue('description', this.value)">${esc(e.description)}</textarea>
        <div class="card-sub">Reprise en commentaire de la ligne quand on choisit cet article.</div></div>
      <div class="field"><label>Type</label><select onchange="majArticleCatalogue('typeArticle', this.value)">
        <option value="service" ${e.typeArticle==='service'?'selected':''}>Prestation</option>
        <option value="bien" ${e.typeArticle==='bien'?'selected':''}>Bien</option></select></div>
      <div class="field"><label>Unité</label><select onchange="majArticleCatalogue('unite', this.value)">${uniteOptions(e.unite)}</select></div>
      <div class="field"><label>Prix de vente HT</label><input type="number" step="0.01" value="${e.prixUnitaire||''}" oninput="majArticleCatalogue('prixUnitaire', parseFloat(this.value)||0)"></div>
      <div class="field"><label>Prix d'achat</label><input type="number" step="0.0001" value="${e.prixAchat==null?'':e.prixAchat}" oninput="majArticleCatalogue('prixAchat', this.value===''? null : parseFloat(this.value))"></div>
      <div class="field"><label>TVA</label><select onchange="majArticleCatalogue('tva', parseFloat(this.value))">${optionsTvaHTML(e.tva)}</select></div>
      <div class="field"><label>&nbsp;</label><label class="bc-tache-row" style="margin:0;"><input type="checkbox" ${e.gereEnStock?'checked':''} onchange="majArticleCatalogue('gereEnStock', this.checked)"><span>Géré en stock</span></label></div>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn primary" onclick="enregistrerArticleCatalogue()">Enregistrer</button>
      <button class="btn ghost" onclick="fermerArticleCatalogue()">Annuler</button>
    </div>
  </div>`;
}

async function enregistrerArticleCatalogue(){
  const c = catalogueEtat();
  const e = c.edition;
  if(!e) return;
  if(!e.code.trim() || !e.designation.trim()){
    showToast('Le code et la désignation sont requis.');
    return;
  }
  try{
    await window.enregistrerArticle(e.id, e);
    c.edition = null;
    c.familles = [];
    c.chargement = true;
    renderTab();
    showToast('Article enregistré.', 'success');
  }catch(err){
    console.error('Enregistrement refusé', err);
    // Le motif vient de la base : un code en double s'y lit noir sur blanc.
    showToast(/duplicate|unique/i.test(err.message||'')
      ? `Le code « ${e.code} » existe déjà dans le catalogue.`
      : (err.message || 'Enregistrement impossible.'));
  }
}

async function retirerDuCatalogue(id){
  if(!confirm("Retirer cet article du catalogue ?\n\nIl reste cité par les documents qui l'emploient, mais ne sera plus proposé à la saisie.")) return;
  try{
    await window.retirerArticle(id);
    catalogueEtat().chargement = true;
    renderTab();
  }catch(err){ showToast(err.message || 'Retrait impossible.'); }
}

/* ---------- Import d'un catalogue ----------
   Le fichier vient d'un logiciel de gestion : point-virgule, Windows-1252,
   guillemets non échappés. Sa lecture vit dans `regles-import-articles.ts`,
   sans base ni DOM ; ici on ne fait que la déclencher, montrer ce qu'elle a
   compris, et n'écrire qu'après accord. */
function ouvrirImportCatalogue(){
  catalogueEtat().import = { etape:'fichier', nom:'', rapport:null, apercu:null, resultat:null, enCours:false };
  renderTab();
}

function fermerImportCatalogue(){
  const c = catalogueEtat();
  c.import = null;
  c.chargement = true;
  c.familles = [];
  renderTab();
}

async function lireFichierCatalogue(fichier){
  const c = catalogueEtat();
  if(!fichier || !c.import) return;
  c.import.nom = fichier.name;
  c.import.enCours = true;
  renderTab();

  try{
    const octets = await fichier.arrayBuffer();
    const rapport = window.lireExportArticles(octets);
    const apercu = rapport.articles.length
      ? await window.previsualiserImport(rapport.articles)
      : { aCreer:0, aMettreAJour:0 };
    c.import.rapport = rapport;
    c.import.apercu = apercu;
    c.import.etape = 'apercu';
  }catch(err){
    console.error('Lecture du fichier impossible', err);
    c.import.erreur = err && err.message ? err.message : 'fichier illisible';
  }
  c.import.enCours = false;
  renderTab();
}

async function lancerImportCatalogue(){
  const c = catalogueEtat();
  const i = c.import;
  if(!i || !i.rapport) return;
  i.enCours = true;
  renderTab();
  try{
    i.resultat = await window.importerCatalogue(i.rapport.articles);
    i.etape = 'termine';
  }catch(err){
    console.error('Import refusé', err);
    i.erreur = err && err.message ? err.message : 'import refusé';
  }
  i.enCours = false;
  renderTab();
}

function telechargerRejetsCatalogue(){
  const i = catalogueEtat().import;
  if(!i || !i.rapport) return;
  const lignes = [...i.rapport.rejets];
  // Les signalements ne sont pas des rejets, mais ils s'expliquent de la même
  // façon : on les joint pour n'avoir qu'un fichier à relire.
  i.rapport.signalements.forEach(sg => lignes.push({ ligne:sg.ligne, motif:sg.motif, contenu:'article '+sg.code }));
  lignes.sort((a,b)=>a.ligne-b.ligne);
  const csv = window.rapportRejetsCsv(lignes);
  // Windows-1252 pour être relu par le même tableur que le fichier d'origine.
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  telechargerBlob(blob, 'import-articles-rapport');
}

function importCatalogueHTML(c){
  const i = c.import;
  const retour = `<button class="btn ghost" onclick="fermerImportCatalogue()">Retour au catalogue</button>`;

  if(i.erreur) return `<div class="form-panel">
    <div class="wf-banner alerte"><b>Import impossible</b><div>${esc(i.erreur)}</div></div>
    <div style="margin-top:12px;">${retour}</div></div>`;

  if(i.enCours) return `<div class="form-panel"><div class="empty">Traitement de ${esc(i.nom||'votre fichier')}…</div></div>`;

  if(i.etape === 'fichier') return `<div class="form-panel">
    <h3>Importer un catalogue</h3>
    <p class="card-sub">Fichier exporté du logiciel de gestion : colonnes séparées par des points-virgules, encodage Windows‑1252. Rien n'est écrit avant votre accord.</p>
    <div style="margin:16px 0;">
      <input type="file" accept=".csv,.txt,text/csv" onchange="lireFichierCatalogue(this.files[0])">
    </div>
    ${retour}
  </div>`;

  if(i.etape === 'apercu'){
    const r = i.rapport;
    const aEcrire = r.articles.length;
    return `<div class="form-panel">
      <h3>${esc(i.nom)}</h3>
      <div style="display:flex; gap:18px; flex-wrap:wrap; margin:14px 0;">
        <div><div class="hero-stat-value">${i.apercu.aCreer}</div><div class="card-sub">à créer</div></div>
        <div><div class="hero-stat-value">${i.apercu.aMettreAJour}</div><div class="card-sub">à mettre à jour</div></div>
        <div><div class="hero-stat-value" style="color:${r.rejets.length?'var(--danger)':'inherit'};">${r.rejets.length}</div><div class="card-sub">rejetés</div></div>
        <div><div class="hero-stat-value" style="color:${r.signalements.length?'#C24E00':'inherit'};">${r.signalements.length}</div><div class="card-sub">signalés</div></div>
      </div>
      ${r.rejets.length? `<div class="wf-banner alerte">
        <div style="font-weight:700; margin-bottom:6px;">Lignes écartées</div>
        <ul style="margin:0; padding-left:18px;">${r.rejets.slice(0,8).map(x=>`<li>Ligne ${x.ligne} — ${esc(x.motif)}</li>`).join('')}</ul>
        ${r.rejets.length>8? `<div class="card-sub" style="margin-top:6px;">…et ${r.rejets.length-8} autres, dans le rapport.</div>`:''}
      </div>`:''}
      ${r.signalements.length? `<div class="wf-banner" style="margin-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">Décidé à la place du fichier</div>
        <ul style="margin:0; padding-left:18px;">${r.signalements.slice(0,6).map(x=>`<li>Ligne ${x.ligne} (${esc(x.code)}) — ${esc(x.motif)}</li>`).join('')}</ul>
        ${r.signalements.length>6? `<div class="card-sub" style="margin-top:6px;">…et ${r.signalements.length-6} autres.</div>`:''}
      </div>`:''}
      <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
        <button class="btn primary" ${aEcrire?'':'disabled'} onclick="lancerImportCatalogue()">Importer ${aEcrire} article${aEcrire>1?'s':''}</button>
        ${(r.rejets.length||r.signalements.length)? `<button class="btn" onclick="telechargerRejetsCatalogue()">📄 Rapport</button>`:''}
        ${retour}
      </div>
    </div>`;
  }

  const res = i.resultat || { crees:0, misAJour:0, echecs:[] };
  return `<div class="form-panel">
    <div class="wf-banner ok"><b>Import terminé</b> — ${res.crees} créé${res.crees>1?'s':''}, ${res.misAJour} mis à jour.</div>
    ${res.echecs.length? `<div class="wf-banner alerte" style="margin-top:10px;">
      <div style="font-weight:700;">${res.echecs.length} lot${res.echecs.length>1?'s':''} refusé${res.echecs.length>1?'s':''}</div>
      <ul style="margin:0; padding-left:18px;">${res.echecs.map(e=>`<li>${esc(e.motif)} <span class="card-sub">(${e.codes.length} article(s))</span></li>`).join('')}</ul>
    </div>`:''}
    <div style="display:flex; gap:10px; margin-top:16px;">
      ${(i.rapport.rejets.length||i.rapport.signalements.length)? `<button class="btn" onclick="telechargerRejetsCatalogue()">📄 Rapport</button>`:''}
      ${retour}
    </div>
  </div>`;
}

async function remettreAuCatalogue(id){
  try{
    await window.reactiverArticle(id);
    catalogueEtat().chargement = true;
    renderTab();
  }catch(err){ showToast(err.message || 'Remise impossible.'); }
}


/* ---------- Documents de la société (Kbis, URSSAF, assurance…) ---------- */
function docStatus(dateValidite){
  if(!dateValidite) return {label:'Non renseigné', cls:'gray'};
  if(dateValidite < todayISO()) return {label:'Expiré', cls:'danger'};
  return {label:'À jour', cls:'success'};
}
function renderDocumentsSection(){
  const list = state.documents.filter(d=>d.societeId===state.societeId);
  return `
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
      <span>Documents de la société</span>
      <button class="btn small primary" onclick="openForm('document')">+ Ajouter un document</button>
    </div>
    <div id="formZoneDocument">${state.formOpen.document? documentForm() : ''}</div>
    ${list.map(d=>{
      const st = docStatus(d.dateValidite);
      return `<div class="card"><div class="card-row">
        <div><div class="card-title">${esc(d.nom)}</div><div class="card-sub">${d.dateValidite? 'Valide jusqu\u2019au '+fmtDate(d.dateValidite) : 'Date de validité non renseignée'}</div></div>
        <span class="badge ${st.cls}">${st.label}</span>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn small" onclick="editItem('document','${jsAttr(d.id)}')">Modifier</button>
        <button class="btn small danger" onclick="deleteItem('document','${jsAttr(d.id)}')">Supprimer</button>
      </div></div>`;
    }).join('') || '<div class="empty">Aucun document enregistré pour cette société.</div>'}
  `;
}
function documentForm(){
  const e = state.editing;
  return `
  <div class="form-panel">
    <h3>${e.id?'Modifier le document':'Nouveau document'}</h3>
    <div class="field-grid">
      <div class="field full"><label>Nom du document</label><input type="text" id="doc_nom" list="docTypesList" value="${esc(e.nom)}" placeholder="Kbis, Attestation URSSAF, Assurance décennale…"></div>
      <datalist id="docTypesList">
        <option value="Kbis">
        <option value="Attestation URSSAF (vigilance)">
        <option value="Assurance décennale">
        <option value="Assurance RC Pro">
        <option value="Attestation fiscale">
        <option value="RIB">
      </datalist>
      <div class="field"><label>Date de validité</label><input type="date" id="doc_date" value="${e.dateValidite||''}"></div>
      <div class="field full"><label>Notes</label><input type="text" id="doc_notes" value="${esc(e.notes)}"></div>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn primary" onclick="saveDocument()">Enregistrer</button>
      <button class="btn ghost" onclick="closeForm('document')">Annuler</button>
    </div>
  </div>`;
}
/**
 * La valeur d'un champ qui n'existe que sur certains formulaires.
 *
 * `saveDocument` sert le devis, la facture et le bon : lire en dur un champ
 * absent lèverait, et se rabattre sur l'objet en cours perdrait la saisie là
 * où le champ existe. On distingue donc « absent de cet écran » de « vidé par
 * l'utilisateur » — sans quoi effacer une référence serait impossible.
 */
function champSaisi(id, defaut){
  const el = document.getElementById(id);
  return el ? el.value.trim() : (defaut || '');
}

async function saveDocument(){
  const e = state.editing;
  const nom = document.getElementById('doc_nom').value.trim();
  if(!nom){ alert('Le nom du document est requis.'); return; }
  const id = e.id || uid();
  const obj = { id, societeId: state.societeId, nom,
    dateValidite: document.getElementById('doc_date').value || '',
    notes: document.getElementById('doc_notes').value };
  const r = await window.stSet('document:'+id, obj);
  if(!r){ showToast(saveFailedMessage()); return; }
  await recharger('document');
  closeForm('document');
}

/* ---------- Démarrage ---------- */
(async function init(){
  // Attendre que stGet/stSet/stListKeys/nextNumero pointent sur les tables
  // Supabase : sans ça, on lirait l'ancienne implémentation kv_store.
  try{
    /* Le pont fournit les sociétés que la RLS rend visibles, et le rôle que la
       base attribue. Le délai d'attente est indispensable : si le module ne se
       charge pas — identifiants Supabase absents du déploiement, script bloqué —
       la promesse ne se résout jamais et l'écran resterait vide et muet. */
    const societes = await Promise.race([
      window.__erpBridgeReady,
      new Promise((_, rej)=> setTimeout(
        ()=> rej(new Error("La couche de données n'a pas répondu. Vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies dans l'environnement de déploiement.")),
        15000)),
    ]);
    if(Array.isArray(societes) && societes.length){
      SOCIETES = societes.map(s => ({ id: s.id, nom: s.nom }));
      if(!societes.some(s => s.id === state.societeId)){
        state.societeId = societes[0].id;
      }
      window.choisirSociete(state.societeId);
    }
    state.currentRole = window.roleEffectif();
    document.body.classList.toggle('role-technicien', state.currentRole==='technicien');
    const autorises = navPourRole().map(n=>n.id);
    if(autorises.length && !autorises.includes(state.tab)) state.tab = autorises[0];
    /* Dans le try : le pont refuse de servir une collection tronquée, et cette
       erreur doit atteindre l'écran. Hors du try, elle partait en promesse
       rejetée — console seulement — et l'application s'affichait à moitié. */
    await loadAll();
  }catch(e){
    console.error('Couche données indisponible', e);
    document.body.innerHTML = '<div style="max-width:640px; margin:56px auto; padding:24px; border:1px solid #E2E6ED; border-radius:12px; font:14px/1.6 system-ui; color:#1F2937;">'
      + '<div style="font-size:17px; font-weight:700; margin-bottom:8px;">Application indisponible</div>'
      + '<p style="margin:0 0 14px;">' + esc(e && e.message ? e.message : 'Vérifiez votre session puis rechargez la page.') + '</p>'
      + '<p style="margin:0; color:#6B7686; font-size:12.5px;">Le détail technique est dans la console du navigateur (F12).</p>'
      + '</div>';
    return;
  }
  /* Pas de second `loadAll()` ici : celui du `try` a déjà tout chargé. Le
     doublon retéléchargeait seize tables entières — 12,2 Mo et 12 s de
     démarrage, au lieu de la moitié. */
  // Entrée initiale : sans elle, le premier « Précédent » quitte l'application
  pousserHistorique(true);
  renderShell();
  // La préférence d'affichage du menu, relue à l'ouverture de la session.
  appliquerEpinglageMenu();
  renderTab();
  if(!hasRealStorage){
    const foot = document.getElementById('sidebarFoot');
    if(foot){ foot.textContent = '⚠ Supabase inaccessible : voir le bandeau.'; foot.style.color = 'var(--accent-2)'; }
    const banner = document.createElement('div');
    banner.id = 'noStorageBanner';
    banner.innerHTML = "⚠ <b>Connexion à Supabase impossible — vos données ne sont pas conservées.</b> Si vous voyez ce message dans l'aperçu Claude.ai, c'est normal : Claude.ai bloque les connexions vers des serveurs externes comme Supabase. Téléchargez ce fichier (bouton Télécharger) et ouvrez-le directement dans votre navigateur pour que Supabase fonctionne.";
    document.body.prepend(banner);
    document.body.classList.add('has-no-storage-banner');
  }
})();


/* ─────────────────────────────────────────────────────────────────────────
   Ce que le HTML peut appeler.

   Généré depuis les déclarations de premier niveau de ce fichier, par le même
   analyseur que la garde de construction : les deux listes ne peuvent pas
   diverger. Ne rien retirer d'ici à la main — `npm run build` refuse de
   produire une page dont un attribut appellerait un nom absent.
   ───────────────────────────────────────────────────────────────────────── */
Object.assign(window, {
  ACHAT_CATEGORIES,
  CIBLES_ANNUAIRE_CLIENT,
  CIBLES_ANNUAIRE_SOCIETE,
  CLE_ETAT_FILTRE,
  CLE_MENU_EPINGLE,
  COLLECTIONS_ETAT,
  CONTROLES_PAR_METIER,
  DELAI_RECHERCHE_ARTICLE,
  DESTINATIONS_DASHBOARD,
  ETATS_MATERIEL,
  ETAT_TACHE,
  FILTRES_FACTURES,
  ICONS,
  JOURNEE_VISIBLE,
  LIBELLES_MODE_PAIEMENT,
  LISTINGS,
  METIERS,
  METIER_PALETTE,
  MOBILE_NAV,
  MOTIF_AVOIR_LIBRE,
  NAV,
  NOM_FICHIER_DEFAUT,
  PIED_PDF_MM,
  PLANNING_HOURS,
  PLANNING_PAUSE_HOUR,
  PLANNING_ROW_H,
  PLANNING_VOFFSET,
  PLANNING_WEEKS_SHOWN,
  REGLAGES_GROUPES,
  ROLES,
  ROLES_INVITATION,
  SEUILS_PAR_DOMAINE,
  SOCIETES,
  STATS_PALETTE,
  STATUTS_DEVIS,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  TYPES_ABSENCE,
  TYPES_CONTRAT,
  TYPES_DOC_LEGAUX,
  TYPES_DOC_SOUSTRAITANT,
  UNITES,
  WF_LIBELLES,
  ZONES_DND,
  _joursFeriesCache,
  achatCategorieIcon,
  achatCategorieLabel,
  addAbsence,
  addChantierAchat,
  addChantierDpgfChapitre,
  addChantierDpgfLigne,
  addChantierTodo,
  addChapitre,
  addCommentaire,
  addDocumentLegal,
  addHabilitation,
  addJours,
  addLigne,
  addMarkToSchema,
  addSTPhoto,
  addSousTraitantDoc,
  addTechPhoto,
  addTravailSupplementaire,
  addTravailSupplementaireConducteur,
  addTravailSupplementaireTechnicien,
  addVehiculeEntretien,
  adresseCible,
  adresseResults,
  adresseSearchTimer,
  ajoutDateSupplCtx,
  ajouterALEquipe,
  ajouterLigneDirecteur,
  alerteEcheance,
  allowDropHour,
  allowDropTodoColumn,
  allowDropUnsched,
  annotationCouleur,
  annotationCtx,
  annotationOriginalImg,
  annotationShapes,
  annotationTool,
  annotationZonePoints,
  annulerInvitationSalarie,
  annulerLectureBC,
  annulerRappel,
  apercuCouleur,
  appartenanceTache,
  appliquerClientOCR,
  appliquerCouleurSociete,
  appliquerDelaiPaiement,
  appliquerEpinglageMenu,
  appliquerEtablissement,
  appliquerEtatNavigation,
  appliquerMetiersDesChapitres,
  appliquerPalette,
  applyArticleObjectToLigne,
  applyDevisMontant,
  arrKeyFor,
  arreterChronoOCR,
  articleCatalogueFormHTML,
  articleMatchesCache,
  articleMinuteur,
  attachmentDragState,
  attachmentResizeState,
  attendreRendu,
  avoirsDisponiblesPour,
  badgeAvoirHTML,
  badgeClass,
  badgeWorkflow,
  bandeauTacheHTML,
  barreFiltresFactures,
  barreRecherche,
  basculerReferencePrefacture,
  bcAProbleme,
  bcFacturesKTA,
  bcInterventionFaite,
  bcLignesOntDuContenu,
  bcMetiersChecklistHTML,
  bcMetiersDuBC,
  bcMetiersZoneHTML,
  bcMontantFieldsHTML,
  bcNumeroDepuisId,
  bcSaveInProgress,
  bcSelectOptionsPourIntervention,
  bcTachesTerminees,
  bcToutesDatesDuBC,
  bcWorkflowStepperHTML,
  blocConditionsHTML,
  blocMentionsHTML,
  blocagesDirecteur,
  blocagesDirecteurHTML,
  bonCommandeCardHTML,
  bonCommandeDocMetaHTML,
  bonCommandeForm,
  bonCommandeItemMatchesSearch,
  bonCommandeListItems,
  bonCommandeMatchesSearch,
  bonCommandeSearchHaystack,
  bonsDeLaVue,
  buildActivityFeed,
  buildMonthsBack,
  buildYTDMonths,
  calculerSpanRows,
  calculerTvaClient,
  calculerTvaSociete,
  cancelEditEntretien,
  candidatsLien,
  captureChantierDpgfLignesFromDOM,
  captureHabilitationsFromDOM,
  cardRowClick,
  catalogueEtat,
  catalogueListeHTML,
  catalogueMinuteur,
  champFiltreFactures,
  champSaisi,
  champSiretHTML,
  changeDpgfSheet,
  changerFactureDuReglement,
  changerSociete,
  chantierAchatsHTML,
  chantierCardA4HTML,
  chantierComptesRendusHTML,
  chantierDevisComplHTML,
  chantierDpgfHTML,
  chantierDpgfLigneRowsHTML,
  chantierDpgfLignesHTML,
  chantierFacturesHTML,
  chantierFileInputHTML,
  chantierFileInputHTML2,
  chantierFileListEditableDateHTML,
  chantierFileListHTML,
  chantierForm,
  chantierInfosDiversesHTML,
  chantierListItems,
  chantierMatchesSearch,
  chantierSelectOptions,
  chantierTodoHTML,
  chantierTodoStatut,
  chapitreRow,
  chargementDossiersRh,
  chargementInvitations,
  chargementVisitesRh,
  chargerDossiersRh,
  chargerInvitationsRh,
  chargerVisitesRh,
  chargerWorkflowTache,
  chercheesDans,
  chercherDansCatalogue,
  chercherSiret,
  chiffrageDirecteurHTML,
  choisirDelaiFacture,
  choisirDelaiPreregle,
  choisirEtablissement,
  choisirMotifAvoir,
  choixAssigneCtx,
  cleDelaiDuClient,
  cleanLogementFields,
  clearAnnotations,
  clearSchemaMarks,
  clearSignature,
  clearTechDessin,
  clientDepuisFormulaire,
  clientForm,
  clientSelectOptions,
  closeAjoutDateSupplModal,
  closeAttachmentPreview,
  closeAvoirModal,
  closeBulkReglementForm,
  closeChantierDetail,
  closeDpgfMapping,
  closeEmailModal,
  closeEmailModalOnBackdrop,
  closeFacturerAvancement,
  closeForm,
  closeImputationModal,
  closeMaterielDetail,
  closeNotifPanel,
  closePhotoAnnotationModal,
  closePlanifierQteModal,
  closeRappelModal,
  closeReglementsClient,
  closeRevenueCustomModal,
  closeRevenueCustomModalOnBackdrop,
  closeSousTraitantValidationModal,
  closeTechnicienInterventionModal,
  closeTodoDetail,
  closeValidationConducteurModal,
  closeValidationDirecteurModal,
  closeVehiculeDetail,
  closeVendreVehiculeModal,
  closeViewIntervention,
  closeViewOnBackdrop,
  commentaireRow,
  compteRecherche,
  comptesLinkOptions,
  comptesRendusHTML,
  compteursCharges,
  computeChapterSubtotals,
  computeCustomRevenue,
  computeDashTraiter,
  computeDocTotals,
  computeMonthSummary,
  computeNewDuree,
  computeNotifications,
  computeRevenuePeriod,
  computeStatsBinomesParMois,
  computeStatsParConducteur,
  computeStatusBreakdown,
  computeTopClients,
  computeTotals,
  computeTotalsAvecRemise,
  conducteurDuSelect,
  conducteurFilterOptions,
  conducteurForm,
  conducteurIdDe,
  conducteurSelectOptions,
  confirmDpgfMapping,
  confirmPlanifierQte,
  confirmVendreVehicule,
  confirmerAjoutDateSuppl,
  confirmerAvoir,
  confirmerChoixAssigne,
  confirmerFacturationAvancement,
  confirmerImputation,
  confirmerLien,
  confirmerRappel,
  confirmerRetourVehicule,
  confirmerValidationConducteur,
  confirmerValidationDirecteur,
  confirmerValidationHorsCircuit,
  conformiteRhDuSalarie,
  contexteBonCommande,
  contexteFacture,
  copierVersion,
  creerArticleDepuisLigne,
  creerDevisDepuisChantier,
  creerFactureDepuisBCKTA,
  creerFactureGroupeeST,
  creerPretMateriel,
  creerPretVehicule,
  critereFactures,
  criteresFactures,
  currentDpgfRows,
  currentWeekStart,
  dataUrlToUint8Array,
  dateLocaleISO,
  declarerListing,
  defaultControles,
  delaiBadgeHTML,
  delaiEstPreregle,
  delaiFactureSaisi,
  delaiModeDuClient,
  delaiPaiementDuClient,
  deleteItem,
  deleteMateriel,
  delierLien,
  demanderPrixTravailSupplementaire,
  demarrerChronoOCR,
  dessinerPiedDePage,
  deverrouillerFacture,
  devisChapterTotals,
  devisForm,
  devisMatchesSearch,
  devisSearchHaystack,
  devisSelectOptions,
  devisStatutFilterOptions,
  distancePointSegment,
  docStatus,
  documentForm,
  documentImprimable,
  documentRhRowHTML,
  documentsDuSalarie,
  dossierDuSalarie,
  dossierRhHTML,
  dossiersRhPrets,
  dpgfMapping,
  dragOverLigne,
  dragStartBC,
  dragStartLigne,
  dragStartTodoCard,
  dragStartTravail,
  draggedItem,
  draggedLigneIndex,
  draggingOffset,
  draggingShapeIndex,
  draggingTexteIndex,
  drawCarre,
  drawCercle,
  drawFleche,
  drawTexte,
  drawZone,
  dropLigne,
  dropOnHour,
  dropTodoColumn,
  dropUnsched,
  dupliquerDevis,
  dupliquerPhoto,
  easterDate,
  echeanceSaisieAlaMain,
  echeanceVisite,
  editItem,
  emailModalCopy,
  emailModalDownload,
  emailModalOpenMailClient,
  emettreLaFacture,
  endDragAttachmentFloat,
  endResizeAttachmentFloat,
  enregistrerAnnotationPhoto,
  enregistrerArticleCatalogue,
  enregistrerChiffrageDirecteur,
  enregistrerDocumentRh,
  enregistrerVisiteRh,
  enteteDashboard,
  enteteDossierHTML,
  entrepriseResults,
  entrepriseSearchTimer,
  entretienEditRowHTML,
  envoyerDocumentEmail,
  envoyerInvitation,
  envoyerRapportEmail,
  equipeDeLaCarte,
  esc,
  estSousTraitant,
  etablirAvoirPour,
  etapeWorkflow,
  etatDocumentRhBadge,
  etatNavigation,
  etatVisiteBadge,
  etatVisiteDuSalarie,
  exportAllData,
  exporterMesDonnees,
  factureDocMetaHTML,
  factureDuReglement,
  factureForm,
  factureMatchesSearch,
  factureSTCardHTML,
  factureSTQuiCouvre,
  factureSearchHaystack,
  facturesAImputer,
  facturesDeLaSociete,
  facturesDesReglements,
  facturesDuClientReglements,
  facturesDuSousTraitant,
  fermerArticleCatalogue,
  fermerBulkSiFond,
  fermerChoixAssigne,
  fermerFormDocumentRh,
  fermerFormVisiteRh,
  fermerImportCatalogue,
  fermerReferencePleinEcran,
  fermerReferencePleinEcranSiFond,
  fermerSuggestionsArticle,
  filterBonCommandeClient,
  filterBonCommandeConducteur,
  filterBonCommandeCreationType,
  filterBonCommandeInterlocuteur,
  filterBonCommandeLogement,
  filterBonCommandeMetier,
  filterBonCommandeType,
  filterBonsCommandeList,
  filterChantierAchats,
  filterChantierConducteur,
  filterChantierType,
  filterChantiersList,
  filterDevisClient,
  filterDevisConducteur,
  filterDevisInterlocuteur,
  filterDevisList,
  filterDevisLogement,
  filterDevisStatut,
  filterFactureBorne,
  filterFactureClient,
  filterFactureConducteur,
  filterFactureCritere,
  filterFactureInterlocuteur,
  filterFactureLogement,
  filterFacturePeriode,
  filterFacturesList,
  filterInterventionConducteur,
  filterInterventionLogement,
  filterInterventionsList,
  filterMaterielList,
  filterPlanningAssignee,
  filterPlanningConducteur,
  filterPlanningList,
  filterPlanningLogement,
  filterPlanningMetier,
  filterPlanningTechnicien,
  filterPlanningUnschedClient,
  filterPlanningUnschedInterlocuteur,
  filterRHList,
  filterRHMetier,
  filterVehicules,
  filtrageFacturesActif,
  filtrerDossiersRh,
  filtrerListe,
  filtrerParPeriode,
  filtrerVisitesRh,
  findDayColAtX,
  fmtDate,
  formDocumentRhHTML,
  formVisiteRhHTML,
  formatEntrepriseAdresse,
  generateInterventionPdf,
  generateRapportIA,
  genererPPSPS,
  getCheckedMetiers,
  getMonday,
  globalSearchEnterCycle,
  globalSearchResultsHTML,
  globalSearchResultsList,
  goStep,
  goToBonCommande,
  goToDevis,
  goToFacture,
  goToIntervention,
  guessAllColRoles,
  guessSkipRows,
  habilitationRowsHTML,
  handleArticleCodeKeydown,
  handleBCAttachment,
  handleBCPhotoFiles,
  handleChantierFileAdd,
  handleDpgfFileAddAndAnalyse,
  handleDpgfFileAnalyse,
  handleLogoUpload,
  handlePhotoFiles,
  handlePlanningCardClick,
  hasRealStorage,
  heureOptions,
  hideRevenueTooltip,
  importAllData,
  importCatalogueHTML,
  importerBonCommande,
  imprimerRegistrePersonnel,
  initSignaturePad,
  initials,
  instantaneIdentite,
  integrerTravailDansLignes,
  interlocuteurForm,
  interlocuteurOptions,
  interventionForm,
  interventionMatchesSearch,
  interventionSearchHaystack,
  interventionSelectOptionsPourBC,
  invitationDuSalarie,
  invitationsPretes,
  inviterSalarieEcran,
  isJourFerie,
  isWeekend,
  isoDate,
  joursAvant,
  joursAvantVehicule,
  joursDepuisEcheance,
  joursFeries,
  jsAttr,
  jumpToWeek,
  lancerGenerationPdf,
  lancerImportCatalogue,
  libelleModePaiement,
  libelleModeReglement,
  libelleRole,
  lienMatchesCache,
  lienWidgetHTML,
  lierDevisABonCommande,
  ligneRow,
  ligneRowsHTML,
  lignesLogementPourEmail,
  lireBonCommande,
  lireFichierCatalogue,
  listeClientsHTML,
  listeConducteursHTML,
  listeDossiersReglementsHTML,
  listeFacturesReglementsHTML,
  listeMetiersHTML,
  listePiecesCommandeHTML,
  listeSousTraitantsHTML,
  listeVehiculesHTML,
  listeVide,
  loadAll,
  loadPrefix,
  locataireCardLine,
  logOut,
  logTentativeContact,
  logementBadge,
  logementFilterOptions,
  logementLabel,
  logementOptions,
  logoHTML,
  lookupVilleParCodePostal,
  maFicheConducteur,
  majAideImputation,
  majAideReglement,
  majApercuNumero,
  majApresAnnuaire,
  majArticleCatalogue,
  majBoutonValidationConducteur,
  majBoutonHorsCircuit,
  majBoutonValidationDirecteur,
  majChronoOCR,
  majCompletudeClient,
  majCompletudeSociete,
  majCompteurRecherche,
  majContactsFicheTechnicien,
  majDelaiPaiementAide,
  majEnteteDirecteur,
  majEquipeSalarie,
  majLigneDirecteur,
  majMentionFranchise,
  majMontantImputation,
  majPrixTravailDirecteur,
  majRepartitionBulk,
  majSectionsEfacture,
  majTravailDirecteur,
  marquerFactureSTPayee,
  marquerFactureVerrouillee,
  marquerMaterielRendu,
  marquerNotifsCocheesFaites,
  marquerPieceCommandee,
  materielForm,
  materielStatut,
  maybeMarkFacturePayee,
  memoryStore,
  menuEpingle,
  mesBonsTechnicien,
  messageApresRemplissage,
  metierCheckboxesHTML,
  metierCouleur,
  metierDisplayLabel,
  metierFilterOptions,
  metierLabel,
  metierPersoFilterOptions,
  metierPersoForm,
  metierPersoSelectOptions,
  metierSelectOptions,
  metiersDisplayJoin,
  metiersDisponibles,
  metiersDuBrouillon,
  motifDeLaBase,
  moisAnnee,
  moisLabelCourt,
  monEquipeId,
  money,
  moneyDisplay,
  montantsCherchables,
  monthsForPeriod,
  motifAvoirSaisi,
  multiWordMatch,
  navPourRole,
  nbJoursOuvres,
  nettoyerCalquesPdf,
  nextNumero,
  nextSAVNumero,
  nomAffichable,
  nomSocieteActive,
  nowHeureFR,
  ocrChronoTimer,
  ocrEcranHTML,
  onAbsTypeChange,
  onAchatCategorieChange,
  onAchatSalarieHeuresChange,
  onDpgfSkipRowsChange,
  onDragAttachmentFloat,
  onFichierDocumentRhChange,
  onFichierVisiteRhChange,
  onGlobalSearchInput,
  onRemiseMontantInput,
  onRemisePctInput,
  onResizeAttachmentFloat,
  onResizeEnd,
  onResizeKeydown,
  onResizeMove,
  onTypeDocumentRhChange,
  onVisiteRhEcheanceChange,
  onVisiteRhEcheanceMain,
  onVisiteRhEcheanceSaisie,
  openAjoutDateSupplModal,
  openAttachmentPreview,
  openAttachmentPreviewFor,
  openBulkReglementForm,
  openChantierDetail,
  openCompteRenduFile,
  openDpgfMapping,
  openEmailComposeModal,
  openFacturerAvancement,
  openForm,
  openMaterielDetail,
  openPhotoAnnotationModal,
  openPlanifierQteModal,
  openRappelModal,
  openReglementsClient,
  openRevenueCustomModal,
  openSousTraitantValidationModal,
  openTechnicienInterventionModal,
  openTodoDetail,
  openValidationConducteurModal,
  openValidationDirecteurModal,
  openVehiculeDetail,
  openVendreVehiculeModal,
  openViewDoc,
  openViewIntervention,
  optionConservee,
  optionsDelaiFactureHTML,
  optionsDelaiHTML,
  optionsModeReglementHTML,
  optionsSocietesHTML,
  optionsTvaHTML,
  ouvrirArticleCatalogue,
  ouvrirAttestationVisiteEcran,
  ouvrirBonCommandeOrigine,
  ouvrirBonDuClient,
  ouvrirChoixAssigne,
  ouvrirClientDepuisDashboard,
  ouvrirDepuisDashboard,
  ouvrirDevisDepuisChantier,
  ouvrirDocumentRhEcran,
  ouvrirDossierRh,
  ouvrirDossierRhDepuisListe,
  ouvrirFactureDepuisChantier,
  ouvrirFormDocumentRh,
  ouvrirFormVisiteRh,
  ouvrirImportCatalogue,
  ouvrirMarquageRetour,
  ouvrirPieceJointeBC,
  ouvrirReferencePleinEcran,
  ouvrirRegistreVisites,
  ouvrirReglementFacture,
  ouvrirTacheDansPlanning,
  parNom,
  parseCSVText,
  parseMontantCell,
  parsePlanningId,
  parsePreconisationsEnLignes,
  pastilleDocumentRh,
  pastilleVisiteRh,
  paysDefaut,
  periodeLabel,
  peutReglerParAvoir,
  photoThumbHTMLAvecCategorie,
  photoThumbsBCHTML,
  photoThumbsHTML,
  pickMetierCouleur,
  pieceAttendueLigne,
  piedDePageHTML,
  planifierQteCtx,
  planningArrFor,
  planningCardHTML,
  planningContactZoneHTML,
  planningItems,
  planningKeyPrefix,
  planningLogementFilterOptions,
  planningNextWeek,
  planningPrevWeek,
  planningPrixSTZoneHTML,
  planningRowExpr,
  planningScheduledCardHTML,
  planningToday,
  planningUnschedClientOptions,
  planningUnschedInterlocuteurOptions,
  pointDansPolygone,
  poserAuPlanning,
  pousserHistorique,
  printCurrentView,
  printDocument,
  printInterventionDocument,
  printInterventionDraft,
  printItem,
  printPlanning,
  printableLignesRows,
  qteDejaPlanifiee,
  quickActionsHTML,
  quickNew,
  quickScheduleBC,
  quitterLectureBC,
  rafraichirCatalogue,
  rafraichirChiffrageDirecteur,
  rafraichirNumerotation,
  rafraichirTravauxSupplementaires,
  rafraichirZoneFactures,
  rappelCtx,
  readDraggedItem,
  recalculerEcheance,
  recharger,
  rechargerType,
  recomputeDpgfColRoles,
  redrawAnnotationCanvas,
  refPartanteHTML,
  referenceDocumentHTML,
  referencePrefacture,
  referencesPrefactureHTML,
  refreshAvancementTotal,
  refreshBCLieSelectInter,
  refreshBCMontantFields,
  refreshBCPhotosUI,
  refreshChantierDpgfLignesZone,
  refreshDevisLieSelect,
  refreshHabilitationAlerte,
  refreshInterlocuteurSelect,
  refreshLignesUI,
  refreshNotifBadge,
  refreshNotifPanelDOM,
  refreshPhotosUI,
  refreshPlanifierQteMontant,
  refreshRemiseUI,
  refreshTotalsOnly,
  refusDocumentRh,
  reglagesCourants,
  reglementCardClick,
  reglementForm,
  reglementStatutFacture,
  reglementsForFacture,
  reglerParAvoir,
  reinitialiserFiltresFactures,
  relancerCatalogue,
  relancerLectureBC,
  relativeTime,
  remettreAuCatalogue,
  remiseAndTotalsHTML,
  removeAbsence,
  removeBCAttachment,
  removeBCPhoto,
  removeChantierAchat,
  removeChantierDpgfLigne,
  removeChantierFile,
  removeChantierTodo,
  removeDateSupplementaire,
  removeDocumentLegal,
  removeHabilitation,
  removeLigne,
  removeMaterielPret,
  removePhoto,
  removeSTPhoto,
  removeSousTraitantDoc,
  removeTechPhoto,
  removeTentativeContact,
  removeTravailSupplementaire,
  removeVehiculeEntretien,
  removeVehiculePret,
  renderBonsCommande,
  renderBonsCommandeClient,
  renderBonsCommandeListHTML,
  renderBulkReglementModal,
  renderCatalogue,
  renderChantierDetail,
  renderChantierGridHTML,
  renderChantiers,
  renderClientBCZoneHTML,
  renderClients,
  renderClientsSection,
  renderConducteursSection,
  renderDashboard,
  renderDashboardConducteur,
  renderDashboardSousTraitant,
  renderDashboardTechnicien,
  renderDevis,
  renderDevisListHTML,
  renderDocumentsLegauxSection,
  renderDocumentsSection,
  renderDonutSVG,
  renderDossiersClients,
  renderDossiersFournisseurs,
  renderDpgfMappingPreview,
  renderEquipesRH,
  renderFactures,
  renderFacturesKTAHTML,
  renderFacturesListHTML,
  renderIdentiteVisuelleSection,
  renderInfosEntrepriseSection,
  renderInterventions,
  renderInterventionsListHTML,
  renderMateriel,
  renderMaterielDetail,
  renderMaterielListeHTML,
  renderMetiersSection,
  renderMonCompteSection,
  renderNotifPanelContent,
  renderNotificationsSection,
  renderNumerotationSection,
  renderParametres,
  renderPiecesCommande,
  renderPlanning,
  renderPlanningCalendar,
  renderPlanningEnAttente,
  renderPlanningRealiseNonFacture,
  renderPlus,
  renderPrintDoc,
  renderPrintIntervention,
  renderRH,
  renderRHDocuments,
  renderRHSalaries,
  renderRHVisites,
  renderRegistreUniquePersonnel,
  renderReglagesDocumentsSection,
  renderReglagesNav,
  renderReglagesOnglet,
  renderReglements,
  renderReglementsClientDetail,
  renderSTModalPhotos,
  renderSalarieListHTML,
  renderSeuilsSection,
  renderShell,
  renderSousTraitantsSection,
  renderStatistiques,
  renderStatsBinomesHTML,
  renderStatsCARepartitionHTML,
  renderStatsRetardHTML,
  renderStatsTauxHTML,
  renderTab,
  renderTechModalPhotos,
  renderTopClientsHTML,
  renderTravauxSupplementairesListe,
  renderUnitesSection,
  renderUserMenu,
  renderValidationConducteurTaches,
  renderValidationDirecteur,
  renderVehiculeDetail,
  renderVehiculeListeHTML,
  renderVehicules,
  renderWeekBlockHTML,
  renderWizardStep,
  renderWorkflowTaches,
  renderYearlyComparisonSVG,
  renvoyerInvitationSalarie,
  reperesDnd,
  replanifierApresPiece,
  reprendreConditionsDuClient,
  resizeState,
  resolveClientAdresse,
  resolvePlanningItem,
  resteDeLAvoir,
  resteDeLaFacture,
  retenirPieceJointeBC,
  retirerDeLEquipe,
  retirerDuCatalogue,
  salarieForm,
  salarieSelectOptions,
  salutation,
  sansAccents,
  saveBonCommande,
  saveBulkReglement,
  saveChantier,
  saveChantierDpgfLignes,
  saveChantierInfosDiverses,
  saveClient,
  saveConducteur,
  saveDevis,
  saveDocument,
  saveEditEntretien,
  saveFacture,
  saveFailedMessage,
  saveInfosEntreprise,
  saveInterlocuteur,
  saveIntervention,
  saveMateriel,
  saveMetierPerso,
  saveMonNom,
  saveNumerotation,
  saveReglages,
  saveReglement,
  saveSalarie,
  saveSousTraitant,
  saveSousTraitantValidation,
  saveTechnicien,
  saveTechnicienIntervention,
  saveTodoDetail,
  saveVehicule,
  schedField,
  schedHeureOuDefaut,
  searchAdresse,
  searchArticleCode,
  searchEnterCycle,
  searchEntreprise,
  searchLienCandidat,
  sectionsEfactureSocieteHTML,
  selectAdresse,
  selectArticleMatch,
  selectEntreprise,
  selectLienMatch,
  setAnnotationTool,
  setAvancementPreset,
  setBCMode,
  setClientSearch,
  setControle,
  setDashRevenuePeriod,
  setEditing,
  setFacturesView,
  setPhotoCategorie,
  setPlanningView,
  setPlusTab,
  setPrintOrientation,
  setRapportField,
  setReglagesTab,
  setRhView,
  setRole,
  setSchedField,
  setStatsPeriode,
  setTab,
  setVehiculeTva,
  setVehiculeVue,
  setupAnnotationDrawing,
  setupSignatureCanvas,
  setupTechDessinCanvas,
  seuilDocumentRh,
  seuilVisiteMedicale,
  shiftBCUnJourPlusTot,
  showRevenueTooltip,
  showToast,
  siretCibles,
  siretResults,
  societeDepuisFormulaire,
  societeName,
  soldeCPRestant,
  soldeLignesHTML,
  sousTotalChapitreHTML,
  sousTraitantActuel,
  sousTraitantFilterOptions,
  sousTraitantForm,
  sousTraitantSelectOptions,
  stDelete,
  stGet,
  stListKeys,
  stModalCtx,
  stSet,
  startDragAttachmentFloat,
  startEditEntretien,
  startResizeAttachmentFloat,
  startResizeCorner,
  state,
  statutClientBC,
  stepControlesHTML,
  stepIndicatorHTML,
  stepInfosHTML,
  stepPhotosHTML,
  stepRapportHTML,
  supabaseHeaders,
  supprimerDocumentRhEcran,
  supprimerLigneDirecteur,
  supprimerVisiteRhEcran,
  syncDevisLignesVersDpgf,
  syncFactureStatut,
  tableauNumerotation,
  tauxTvaProposes,
  techModalCtx,
  technicienFilterOptions,
  technicienForm,
  technicienLabel,
  technicienLinkOptions,
  technicienSelectOptions,
  telechargerBlob,
  telechargerRejetsCatalogue,
  terminerZone,
  todayISO,
  todoDetailCtx,
  toggleAutreTexte,
  toggleBCLignesZone,
  toggleBCMetierFait,
  toggleBox,
  toggleDossier,
  toggleDpgfSection,
  toggleGhostMode,
  toggleLienZone,
  toggleLigneComment,
  toggleMenuEpingle,
  toggleNotifPanel,
  toggleOccupantField,
  togglePieceCommanderInput,
  togglePlanningUnschedFilter,
  togglePretSchema,
  toggleReglementSelection,
  toggleSTFactureSelection,
  toggleSidebarForced,
  toggleTechFicheOuverte,
  toggleUserMenu,
  toggleValidationDirecteurPrix,
  totalChiffrageHTML,
  totalsBoxInnerHTML,
  toucheReferencePleinEcran,
  toutesDatesValidees,
  transformerBonCommandeEnFacture,
  transformerBonCommandeEnSAV,
  transformerEnFacture,
  transformerInterventionEn,
  transmettreALaPlateforme,
  travailGlisse,
  travauxTacheHTML,
  trierParDate,
  trouverFormeSousPoint,
  tuileDashboard,
  tvaDefaut,
  tvaLignesHTML,
  uid,
  undoAnnotation,
  uniteOptions,
  unscheduleBC,
  updateBCAssignee,
  updateBCDateFin,
  updateBCDuree,
  updateBCHeure,
  updateBCHeureDernierJour,
  updateChantierFileDate,
  updateDateSupplChamp,
  updateDpgfColRole,
  updateLigne,
  updatePieceCommandeChamp,
  updatePrixSousTraitant,
  updateSoldeCPPreview,
  updateStatut,
  updateToolButtonsUI,
  validationConducteurCtx,
  validationDirecteurCtx,
  validerBCEtape,
  vehiculeCardHTML,
  vehiculeForm,
  vehiculeSchemaHTML,
  vehiculeSchemaMarks,
  vehiculeTypeLabel,
  vendreVehiculeCtx,
  versionConstruite,
  visiteRhRowHTML,
  visitesDuSalarie,
  visitesMedicalesHTML,
  visitesRhPretes,
  voirDevisDepuisFacture,
  voirFactureDepuisDevis,
  weekDays,
  wfEnregistrerConstats,
  wfMarquerRealisee,
  wfRafraichir,
  wfTacheAt,
  wfTaches,
  wfValider,
  withVille,
  wizardNav,
  zoneDndCourante,
  zoneInvitationHTML,
});
