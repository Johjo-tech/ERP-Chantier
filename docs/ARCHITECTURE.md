# Architecture ERP Chantier

## Structure

```
src/
├── api/           # Couche données
│   ├── client.ts
│   ├── types.ts
│   ├── queries/   # CRUD par entité
│   └── operations/  # Workflows complexes
├── pages/         # HTML du client
├── styles/        # CSS
└── components/    # Composants réutilisables
```

## Workflow: BC → Facture

1. Créer Bon de Commande
2. Planifier (technicien, date)
3. Générer Facture
4. Tracker réception
5. Rapprocher
6. Clôturer

Voir: [WORKFLOWS.md](./WORKFLOWS.md)
