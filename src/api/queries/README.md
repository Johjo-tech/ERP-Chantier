# 📊 API Queries - ERP Chantier

Couche d'accès aux données Supabase. Remplace les appels `kv_store` du HTML original.

## 📁 Structure

```
queries/
├── index.ts                 # Export centralisé
├── devis.ts                 # Devis CRUD + numérotation
├── factures.ts              # Factures + Réglements + workflows
├── bonCommande.ts           # BC CRUD + planification + SAV
├── clients.ts               # Clients + Interlocuteurs
├── articles.ts              # Articles/fournitures
├── rh.ts                    # Salariés, Techniciens, Conducteurs, Véhicules
├── chantiers.ts             # Chantiers
├── interventions.ts         # Rapports d'intervention
└── parametres.ts            # Documents, Sous-traitants, Métiers, Fournisseurs
```

## 🚀 Utilisation

```typescript
// Import centralisé (recommandé)
import {
  getDevis, listDevis, createDevis, updateDevis, deleteDevis,
  getFacture, listFactures, createFactureFromBC,
  getBonCommande, listBonsCommande, scheduleBC,
  // ... 80+ fonctions
} from '@/api/queries'

// Usage
const devis = await getDevis(id)
const factures = await listFactures(societeId, { statut: 'impayée' })
const newBC = await createBonCommande(societeId, {
  client: 'ACME Corp',
  numero_bc: 'BC-2024-001',
  date_planifiee: '2024-09-10',
})
```

## 📋 Domaines

### 1. **Devis** (`devis.ts`)
- `getDevis(id)` - Récupérer un devis
- `listDevis(societeId, filters)` - Lister (avec filtres)
- `searchDevis(societeId, query)` - Rechercher
- `createDevis(societeId, data)` - Créer (numéro auto)
- `updateDevis(id, updates)` - Modifier
- `updateDevisStatut(id, statut)` - Changer le statut
- `deleteDevis(id)` - Supprimer (brouillon only)
- `duplicateDevis(societeId, devisId)` - Dupliquer
- `getDevisTotaux(devisId)` - Calculs (vue SQL)

### 2. **Factures** (`factures.ts`)
- `getFacture(id)` / `listFactures()` / `searchFactures()`
- `createFacture()` - CRUD standard
- `createFactureFromDevis(devisId)` - ⭐ Workflow: Devis → Facture
- `createFactureFromBC(bcId)` - ⭐ Workflow: BC → Facture
- `updateFactureStatut()` / `lockFacture()` / `unlockFacture()`
- `addReglement()` / `listReglements()` / `deleteReglement()`
- `getFactureTotaux()` / `getFactureSolde()` - Calculs

### 3. **Bons de Commande** (`bonCommande.ts`) - ⭐ CRITIQUE
- `getBonCommande()` / `listBonsCommande()` - Récupération
- `createBonCommande()` - Créer un BC
- `createSAVBonCommande(originalBcId)` - ⭐ SAV (lié à un BC précédent)
- `scheduleBC()` - Planifier simple
- `scheduleBCByMetier()` - ⭐ Planification multi-métiers
- `scheduleBCLastDay()` - Dernier jour
- `markBCReceived()` - Marquer comme reçu
- `addBCPhotos()` - Ajouter des photos
- `addBCNotes()` - Notes
- `getBCTotaux()` - Calculs montants
- `getChantierAvancement()` - Vue d'ensemble du chantier

### 4. **Clients** (`clients.ts`)
- `getClient()` / `listClients()` / `searchClients()`
- `createClient()` / `updateClient()` / `deleteClient()`
- `getInterlocuteur()` / `listInterlocuteurs()`
- `createInterlocuteur()` / `updateInterlocuteur()` / `deleteInterlocuteur()`

### 5. **Articles** (`articles.ts`)
- `getArticle()` / `listArticles()` / `searchArticles()`
- `createArticle()` / `updateArticle()` / `deleteArticle()`

### 6. **RH** (`rh.ts`) - Complet
**Salariés:**
- `getSalarie()` / `listSalaries()` / `createSalarie()` / `updateSalarie()` / `deleteSalarie()`

**Absences:**
- `listAbsences()` / `addAbsence()` / `removeAbsence()`

**Techniciens:**
- `getTechnicien()` / `listTechniciens()` / `createTechnicien()` / `updateTechnicien()` / `deleteTechnicien()`

**Conducteurs:**
- `listConducteurs()` / `createConducteur()` / `updateConducteur()` / `deleteConducteur()`

**Véhicules:**
- `listVehicules()` / `createVehicule()` / `updateVehicule()` / `deleteVehicule()`

**Matériels:**
- `listMateriels()` / `createMateriel()` / `updateMateriel()` / `deleteMateriel()`

### 7. **Chantiers** (`chantiers.ts`)
- `getChantier()` / `listChantiers()`
- `createChantier()` / `updateChantier()` / `deleteChantier()`

### 8. **Interventions** (`interventions.ts`)
- `getIntervention()` / `listInterventions()`
- `createIntervention()` / `updateIntervention()` / `deleteIntervention()`
- `addInterventionPhotos()` - Ajouter des photos
- `signIntervention()` - Signature digitale
- `updateInterventionRapport()` - Constatations + préconisations

### 9. **Paramètres** (`parametres.ts`)
**Documents légaux:**
- `listDocuments()` / `createDocument()` / `updateDocument()` / `deleteDocument()`

**Sous-traitants:**
- `getSousTraitant()` / `listSousTraitants()`
- `createSousTraitant()` / `updateSousTraitant()` / `deleteSousTraitant()`

**Métiers personnalisés:**
- `listMetiersPerso()` / `createMetierPerso()` / `updateMetierPerso()` / `deleteMetierPerso()`

**Fournisseurs de contrôle:**
- `listFournisseursControle()` / `createFournisseurControle()` / ...

## 🔐 Sécurité

- ✅ Toutes les requêtes passent par **RLS** (Row Level Security)
- ✅ Paramètres protégés contre SQL injection
- ✅ Session Supabase requise
- ✅ Erreurs typées (`SupabaseError`)

## 📡 Real-time (bonus)

```typescript
import { onTableChange, offTableChange } from '@/api/client'

// S'abonner aux changements
const sub = onTableChange('devis', societeId, (payload) => {
  console.log('Changement:', payload)
  // UI update
})

// Arrêter
await offTableChange(sub)
```

## ⚙️ Helpers (`client.ts`)

```typescript
// Numérotation atomique (côté serveur)
const numero = await getNextNumero(societeId, 'devis') // DEV-2024-0001

// Dates
todayISO()     // "2024-09-07"
fmtDate("2024-09-07")  // "07/09/2024"
nowHeureFR()   // "14:30"

// UUID
uid()          // "1725794400000a1b2c"

// Formatage
money(1234.56) // "1 234,56 €"
```

## 🧪 Tests

```typescript
// Type-check
npm run type-check

// Build
npm run build
```

---

**Status**: ✅ Prêt pour Phase 3 (branchement HTML)
