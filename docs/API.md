# API Reference

## Queries

### Bons de Commande
- `getBonCommande(id)` - Récupérer un BC
- `listBonsCommande()` - Lister tous les BC
- `saveBonCommande(data)` - Créer/éditer

### Factures
- `getFacture(id)`
- `listFactures()`
- `saveFacture(data)`
- `createFactureFromBC(bcId)` - Générer depuis BC

...

See [types.ts](../src/api/types.ts) for complete type definitions.
