# 🏗️ ERP Chantier

Gestion complète des chantiers : devis, factures, bons de commande, rapports, RH.

## 📋 Features

- **Devis & Factures** : Création, suivi, numérotation automatique
- **Bons de Commande** : Planification, tracking, rapprochement
- **Rapports d'intervention** : Photos, signature digitale, PDF
- **RH** : Salariés, habilitations, congés, documents
- **Notifications** : Alertes automatiques (expiration certif, CT, etc.)
- **Analytics** : Dashboard revenue, clients top, tendances

## 🏗️ Architecture

- **Frontend**: HTML/CSS/JS (design client préservé)
- **Backend**: TypeScript + Supabase
- **Database**: PostgreSQL (46 tables relationnelles)
- **Auth**: Supabase Auth
- **Storage**: Bucket privé pour documents/photos

## 📦 Setup

```bash
npm install
npm run dev
```

Env: `.env.local`
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 📚 Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Workflows](./docs/WORKFLOWS.md)

## 📝 License

Propriétaire
