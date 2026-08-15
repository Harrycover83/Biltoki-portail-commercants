# Checklist Supabase Auth - Production Setup

## État actuel du projet
✅ Code Auth en place:
- `AuthProvider.tsx` avec `must_change_password` metadata support
- `LoginPage.tsx` - connexion normale
- `ResetPasswordPage.tsx` - demande reinitialisation
- `ResetPasswordUpdatePage.tsx` - flux avec validation
- Supabase Client configuré dans `src/lib/supabase.ts`
- Variables d'env: `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`

**Prod URL (Netlify):** https://portail-toulon-commercant.netlify.app

---

## Phase 1: Configuration Supabase Console (OBLIGATOIRE)

### 📧 Étape 1.1: SMTP Settings (Email)
**Lieu:** Supabase Dashboard > Authentication > SMTP Settings

**Choix provider:**
- **Resend** (recommandé, simple, bon délivrabilité)
  - URL: https://resend.com
  - Crée compte → générer API key
  - Crée domaine vérifié (SPF/DKIM auto)
  - Déploiement rapide (~5min)

- **Brevo** (alternative, bulk email)
  - URL: https://www.brevo.com
  - Plus complexe (SPF/DKIM manuel)
  - Bon pour volume

**Actions Resend (plus simple):**
1. Créer compte Resend → API Key
2. Ajouter domaine custom (ou vérifier resend.dev)
3. Copier la clé API
4. Dans Supabase Console SMTP Settings:
   - **SMTP Host:** smtp.resend.com
   - **SMTP Port:** 465
   - **SMTP User:** default
   - **SMTP Password:** [API Key Resend]
   - **Sender Email:** noreply@toulon-commercants.biltoki.fr (ou resend.dev)
   - **Sender Name:** Halles Biltoki

5. Tester: cliquer "Send test email" dans la console
   → Email doit arriver

**SPF/DKIM/DMARC:**
- Resend gère automatiquement si domaine vérifié
- Sinon: Resend fournit les records DNS à ajouter dans votre DNS provider

---

### 🔐 Étape 1.2: URL Configuration
**Lieu:** Supabase Dashboard > Authentication > URL Configuration

**À remplir:**
1. **Site URL:** `https://portail-toulon-commercant.netlify.app`
2. **Redirect URLs (ajouter chacune):**
   - `https://portail-toulon-commercant.netlify.app/`
   - `https://portail-toulon-commercant.netlify.app/login`
   - `https://portail-toulon-commercant.netlify.app/reset-password/update`
   - `https://portail-toulon-commercant.netlify.app/dashboard` (si applicable)

**En dev local (facultatif, pour tests):**
- `http://localhost:5173/`

⚠️ **CRITIQUE:** Oublier `/reset-password/update` = les links email reset ne fonctionneront pas!

---

### 📋 Étape 1.3: Email Policies
**Lieu:** Supabase Dashboard > Authentication > Policies

**Recommandé pour production:**

1. **Confirm email for new signups**
   - ON ou OFF selon policy:
     - ON = email confirmation obligatoire avant utilisation compte
     - OFF = comptes créés par admin sans vérifier (risk de typos)
   
   **Choix:** ON (plus sûr)

2. **Require email for signup** → toujours ON

3. **Double confirm changes to email** → selon besoin (ON recommandé)

4. **Enable email change confirmation** → ON

5. **Automatically send new user confirmation and recovery emails** → ON

---

### 👥 Étape 1.4: User Sessions & Security
**Lieu:** Supabase Dashboard > Authentication > Policies

- **Session duration:** 24h ou 7j (par défaut OK)
- **Disable sign up:** probablement OFF (les admins créeront les comptes via Admin API)

---

## Phase 2.5: Admin API pour créer comptes avec must_change_password

**Context:** Les comptes admin doivent être créés par l'admin sans que l'utilisateur les crée lui-même.

### Option 1: Via Supabase Dashboard (simple, 1-5 comptes)
1. Supabase Dashboard > Authentication > Users
2. Cliquer "Add user"
3. Email + MDP temporaire
4. ⚠️ **LIMITATION:** Le Dashboard ne permet pas de setter `must_change_password` directement
   → Utiliser Script + Admin API (Option 2) ou accepter MDP initial

### Option 2: Via Admin API Script (recommandé pour bulk)
Créer un script `scripts/create-admin-user.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js';

const ADMIN_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ADMIN_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(ADMIN_URL, SERVICE_ROLE_KEY);

async function createUserWithMustChangePassword(email, tempPassword = 'TempPass123!') {
  console.log(`Creating user: ${email}`);

  // 1. Créer auth user
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: false, // Force email confirm ou laisse l'email en attente
    user_metadata: {
      must_change_password: true, // FLAG IMPORTANT
    },
  });

  if (error) {
    console.error('Error creating user:', error);
    return;
  }

  console.log(`✅ User created: ${data.user.id}`);

  // 2. OPTIONNEL: Créer profile associé
  // const { error: profileError } = await admin
  //   .from('profiles')
  //   .insert({
  //     id: data.user.id,
  //     email,
  //     first_name: 'Admin',
  //     last_name: 'User',
  //     role: 'admin',
  //   });

  // if (profileError) {
  //   console.error('Error creating profile:', profileError);
  // }
}

// Usage:
await createUserWithMustChangePassword('admin@biltoki.fr');
```

**À ajouter en .env:**
```
# Supabase Service Role Key (jamais exposer en frontend!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Exécuter:**
```bash
node scripts/create-admin-user.mjs
```

### Option 3: Via Supabase CLI
```bash
supabase functions deploy create-admin-user
```
(Crée une fonction backend dans Supabase)



### ✅ Check 3.1: AuthProvider metadata
Vérifier que `AuthProvider.tsx` écoute le flag `must_change_password`:
```typescript
const mustChangePassword = user?.user_metadata?.must_change_password === true
```
→ **État:** ✅ PRÉSENT (ligne ~20)

### ✅ Check 2.2: ResetPasswordUpdatePage flow
Vérifier que la page attend un utilisateur avec session:
```typescript
if (!user && success) {
  return <Navigate to="/login" replace />
}
```
→ **État:** ✅ PRÉSENT (`src/features/auth/pages/ResetPasswordUpdatePage.tsx` ligne ~7)

### ✅ Check 2.3: Redirect URL en App Router
Routes Auth configurées:
- `/login` → LoginPage ✅
- `/reset-password` → ResetPasswordPage (demander email) ✅
- `/reset-password/update` → ResetPasswordUpdatePage (link email) ✅
- `/security/update-password` → UpdatePasswordPage (must_change_password) ✅

**État:** ✅ TOUTES PRÉSENTES (`src/app/AppRouter.tsx`)

### ✅ Check 2.4: must_change_password Guard
`ProtectedRoute.tsx` redirige si flag actif:
```typescript
if (mustChangePassword && location.pathname !== '/security/update-password') {
  return <Navigate to="/security/update-password" replace />
}
```
→ **État:** ✅ PRÉSENT (`src/app/guards/ProtectedRoute.tsx` ligne 19-21)

---

## Phase 3: Tests Critiques (AVANT production)

### Test 3.1: Mot de passe oublié (email + reset)
1. Aller sur https://portail-toulon-commercant.netlify.app/reset-password
2. Entrer un email de test (compte préexistant)
3. Email doit arriver dans inbox avec lien reset
4. Cliquer lien → doit atterrir sur page avec session active
5. Changer le mot de passe → succès
6. Se déconnecter et tester login avec nouveau MDP → OK

**Vérifier:**
- Email reçu en ~5 secondes (vs 30s+ = problème SMTP)
- Lien fonctionne (vs 404 = mauvaise URL)
- Pas d'erreur auth après reset

---

### Test 3.2: Première connexion forcée (must_change_password)
**Prérequis:** Admin crée un compte avec `must_change_password=true` via Supabase Admin API

1. Se connecter avec ce compte
2. App doit rediriger vers `/reset-password` ou `/update-password` (vérifier logique `AppRouter`)
3. Forcer changement MDP
4. Après changement, accès normal au dashboard

**Note:** Cette logique dépend de l'implémentation dans `AppRouter.tsx` + `RoleRoute.tsx` + `ProtectedRoute.tsx`

---

### Test 3.3: Reconnexion normale
1. Se déconnecter
2. Entrer email + nouveau MDP
3. Accès dashboard → OK
4. Session maintenue rafraîchissement page

---

## Phase 4: Deployment Checklist

- [ ] SMTP testé en Supabase console
- [ ] Redirect URLs complètes (surtout `/reset-password/update`)
- [ ] Site URL correcte
- [ ] Email policies configurées
- [ ] Test 3.1 passé (reset password)
- [ ] Test 3.2 passé (must_change_password, si applicable)
- [ ] Test 3.3 passé (reconnexion)
- [ ] Logs Supabase consultés (aucun error d'auth)
- [ ] Netlify build réussit
- [ ] Env vars correctes en production

---

## Phase 5: Après Auth ✅ → Intégration Pennylane

**Étapes suivantes (Une fois Auth stable):**
1. Connecteur Pennylane côté backend
2. Eliminer double saisie → source unique Pennylane
3. Railway + sync planifiée + upsert idempotent
4. Dashboards synchronisés

---

## Support & Debug

### Email ne reçoit pas l'invite de confirmation
1. Vérifier SMTP Settings (Host, Port, Auth OK?)
2. Vérifier Resend dashboard (domain verified? rates OK?)
3. Consulter logs Supabase > Auth Providers
4. Tester avec Resend test email depuis console

### Reset password link ne fonctionne pas
1. Vérifier URL dans Supabase est correcte
2. Vérifier lien contient `#access_token=...&type=recovery`
3. Vérifier `/reset-password/update` route existe
4. Consulter browser console (erreur JS?)

### must_change_password flag ne déclenche pas redirection
1. Vérifier Admin API définit bien le flag lors création compte
2. Vérifier `AppRouter.tsx` ou `ProtectedRoute.tsx` check le flag
3. Vérifier AuthProvider propage bien le flag au contexte

---

**Ordre d'exécution dès maintenant:**
1. ✅ Sections 1.1 → 1.4 dans Supabase Console
2. ✅ Sections 2 → vérifier code présent
3. ✅ Sections 3 → tester chaque parcours
4. ✅ Section 4 → valider avant deploy
