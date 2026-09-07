# 🔐 Configuration Authentification

## Vue d'ensemble

L'app utilise **Supabase Auth** pour protéger l'accès. 

- ✅ Connexion obligatoire avant d'accéder à l'app
- ✅ Gestion des sessions côté serveur
- ✅ RLS (Row Level Security) filtre les données par utilisateur
- ✅ Déconnexion automatique si la session expire

## Architecture

```
/login.html
  ↓ (enter credentials)
Supabase Auth
  ↓ (session token)
/ (index.html)
  ↓ (protectRoute)
  ↓ (injectGlobalFunctions)
  ↓ (watchAuthState)
HTML app ready
```

## Setup Supabase

### 1. Activer l'authentification Email/Password

Dans Supabase Console:
1. **Authentication** → **Providers**
2. Activer **Email**
3. Configuration:
   - ✅ Enable Email Signup
   - ✅ Confirm email (ou désactiver si test)

### 2. Créer un utilisateur de test

```sql
-- Via Supabase Console → SQL Editor
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  'authenticated',
  'authenticated',
  'demo@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

Ou via l'UI: **Authentication** → **Users** → **Add user**

### 3. Créer le profil utilisateur

```sql
-- Table profiles (créée automatiquement avec Supabase)
INSERT INTO public.profiles (id, email, created_at)
VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  'demo@example.com',
  now()
);
```

## Utilisation

### Login

```html
<!-- src/pages/login.html -->
Email: demo@example.com
Password: password123
```

### Logout

Depuis l'app HTML, ajouter un bouton:

```html
<button onclick="logoutUser()">Déconnexion</button>

<script>
async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    window.location.href = '/login.html';
  }
}
</script>
```

### Accéder à l'utilisateur actuel

```typescript
import { getCurrentUser } from '@/integrations/auth-guard'

const user = await getCurrentUser()
console.log(user?.email)
```

## RLS (Row Level Security)

Toutes les tables ont des politiques RLS qui filtrent les données par `societe_id` et l'utilisateur.

```sql
-- Exemple: table "devis"
CREATE POLICY "Users can only see their own society's devis"
ON public.devis
FOR SELECT
USING (
  societe_id IN (
    SELECT societe_id FROM public.membres_societe
    WHERE user_id = auth.uid()
  )
);
```

Cela signifie:
- ✅ Chaque utilisateur ne voit que les données de sa société
- ✅ Pas d'accès SQL direct aux autres sociétés
- ✅ La sécurité est au niveau BD, pas juste au code

## Flux de connexion

```
1. Utilisateur ouvre /
   ↓
2. main.ts appelle protectRoute()
   ↓
3. protectRoute() vérifie getCurrentSession()
   ↓
4. Pas de session? → Redirection vers /login.html
   ↓
5. Utilisateur rentre email/password
   ↓
6. login.html appelle supabase.auth.signInWithPassword()
   ↓
7. Session créée
   ↓
8. Redirection vers / (main.ts)
   ↓
9. injectGlobalFunctions() branche l'API
   ↓
10. watchAuthState() écoute déconnexion
   ↓
11. App prête! stGet/stSet fonctionnent ✅
```

## Configuration environnement

Vérifier `.env.local`:

```bash
VITE_SUPABASE_URL=https://tjhljjuvfosmnpmzgbnl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Ces clés sont publiques (ANON_KEY), la sécurité vient de:
- ✅ RLS sur chaque table
- ✅ Policies SQL qui filtrent par utilisateur
- ✅ Supabase Auth qui gère les sessions

## Troubleshooting

### "Redirect to login" boucle infinie
→ Vérifier que les env vars `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont correctes

### "Email or password not found"
→ L'utilisateur n'existe pas. Le créer via Supabase Console.

### "User not in members_societe"
→ L'utilisateur doit être inscrit dans la table `membres_societe` avec un rôle et une société.

```sql
INSERT INTO public.membres_societe (
  id, user_id, societe_id, role, created_at
) VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  'user-id-here',
  'societe-id-here',
  'admin',
  now()
);
```

### RLS bloque toutes les requêtes
→ Vérifier que l'utilisateur a une ligne dans `membres_societe` et que la politique RLS référence le bon champ.

## Prochaines étapes

- [ ] Ajouter un bouton "Déconnexion" dans l'HTML
- [ ] Afficher le nom/email de l'utilisateur dans l'header
- [ ] Implémenter "forgot password"
- [ ] Ajouter 2FA si nécessaire
- [ ] Gérer les rôles (admin, conducteur, technicien, lecture)

---

**Status**: ✅ Auth intégrée - App protégée
