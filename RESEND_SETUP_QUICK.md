# Resend + Supabase SMTP - Configuration Rapide

## 1. Resend: Récupérer la clé API

1. Aller sur https://resend.com/dashboard
2. **Settings** → **API Keys**
3. Copier la clé (commence par `re_...`)
4. Note: Garder `noreply@resend.dev` pour tester (ou vérifier domaine custom si tu l'as)

---

## 2. Supabase: Configurer SMTP

**Console:** https://app.supabase.com → Ton projet → **Authentication** → **SMTP Settings**

Remplir exactement:
```
SMTP Host:      smtp.resend.com
SMTP Port:      465
SMTP User:      default
SMTP Password:  <PASTE TON API KEY RESEND>
Sender Email:   noreply@resend.dev
Sender Name:    Halles Biltoki
```

**Tester immédiatement:**
- Cliquer "Send test email"
- Vérifier inbox (check spam!)
- Si OK → passer à étape 3

---

## 3. Supabase: URL Configuration

**Console:** Authentication → **URL Configuration**

**Site URL:**
```
https://portail-toulon-commercant.netlify.app
```

**Redirect URLs (ajouter TOUTES):**
```
https://portail-toulon-commercant.netlify.app/
https://portail-toulon-commercant.netlify.app/login
https://portail-toulon-commercant.netlify.app/reset-password/update
```

⚠️ **CRITIQUE:** Sans `/reset-password/update`, les liens email reset seront des 404!

**Save.**

---

## 4. Supabase: Email Policies

**Console:** Authentication → **Policies** ou **Settings**

### Recommandé pour production:
- ✅ **Confirm email for new signups** → ON
- ✅ **Require email for signup** → ON
- ✅ **Email whitelist/blocklist** → selon besoin
- ✅ **Auto send confirmation/recovery** → ON

---

## 5. Tests en Local + Prod

### Test 5.1: Reset Password (LOCAL d'abord)
```bash
npm run dev
```

1. Aller: http://localhost:5173/reset-password
2. Entrer un email existant (crée un compte de test si besoin)
3. **Vérifier inbox** → email reçu en <5s
4. Cliquer le lien → page charge avec session active
5. Changer mot de passe → succès → redirect login
6. Se reconnecter avec nouveau MDP → ✅

**Si email n'arrive pas:**
- Vérifier spam
- Vérifier Resend Dashboard > Events (vois les appels SMTP)
- Vérifier Supabase Logs > Auth Providers

---

### Test 5.2: Must Change Password (APRÈS local OK)

**Prérequis:** Créer un compte test avec flag `must_change_password=true`

**Option A: Via Supabase Dashboard (rapide)**
1. Authentication > Users
2. Ajouter user manuellement
3. ⚠️ Dashboard ne permet pas setter le flag directement
   → Utiliser script Node (Option B) ou editer via SQL

**Option B: Via Script (recommandé)**
```bash
# Copy la clé service role depuis Supabase Settings
export SUPABASE_SERVICE_ROLE_KEY="eyJh..."
export VITE_SUPABASE_URL="https://ocgesbspdhxisnrzotfx.supabase.co"

node scripts/create-admin-user.mjs
```

**Logique du test:**
1. Login avec compte `must_change_password=true`
2. App redirige automatiquement → `/security/update-password`
3. Forcer changement MDP
4. Accès dashboard → ✅

---

### Test 5.3: Reconnexion Normale
1. Déconnecter
2. Login email + MDP changé
3. Accès dashboard → ✅
4. Refresh page → session maintenue → ✅

---

## 6. Deploy Netlify

**Prérequis:**
- [ ] Resend SMTP testé ✅
- [ ] Redirect URLs complètes ✅
- [ ] Test 5.1 passé ✅
- [ ] Test 5.2 passé (si applicable) ✅
- [ ] Test 5.3 passé ✅

**Build + Deploy:**
```bash
npm run build
# Push to Git → Netlify auto-deploys
```

**Post-deploy (test prod):**
1. https://portail-toulon-commercant.netlify.app/reset-password
2. Email test → vérifier inbox
3. Reset flow complet
4. Reconnecter → ✅

---

## Debug Checklist

| Problème | Solution |
|----------|----------|
| Email n'arrive pas | Vérifier Resend Dashboard > Events, Supabase Logs |
| Reset link 404 | Vérifier `/reset-password/update` dans Redirect URLs |
| must_change_password ignored | Vérifier `ProtectedRoute.tsx` et `AuthProvider.tsx` |
| Session perdue après refresh | Vérifier `onAuthStateChange` listener dans `AuthProvider.tsx` |

---

## Next: Pennylane Sync

Une fois Auth 100% stable:
1. **Backend Pennylane connector** (Railway ou Vercel)
2. **Scheduled sync** (cron job)
3. **Idempotent upsert** (merchants + standards + charges)
4. **Dashboard real-time** (vs mock data)

