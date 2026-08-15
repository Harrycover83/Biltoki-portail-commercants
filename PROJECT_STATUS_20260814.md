# 🎯 Projet Biltoki - État d'Avancement (14 Août 2026)

## Résumé Exécutif

Deux axes de travail complètement **scaffoldés et prêts au test:**

1. **🔐 Authentification Supabase** - Code ✅, Config manuelle en attente (domaine + Resend)
2. **📊 Pennylane Sync Backend** - Entièrement construit avec mock data, prêt à tester

---

## Axe 1: Authentification Supabase

### ✅ État Actuel
- **Frontend:** Routes auth complètes (login, reset-password, must_change_password flow)
- **Code:** AuthProvider, ProtectedRoute, UpdatePasswordPage, ResetPasswordPage ✅
- **Variables:** VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY déjà configurées ✅

### ⏳ En Attente
- **Domaine commercial** (pour adresse sender email)
- **Clé API Resend** (disponible immédiatement)
- → Configuration manuelle Supabase Dashboard (5-10 min):
  - SMTP Settings (Resend)
  - URL Configuration (redirect URLs)
  - Email Policies

### 📋 Checklist Config
Voir: [`RESEND_SETUP_QUICK.md`](RESEND_SETUP_QUICK.md)

1. Supabase > Authentication > SMTP Settings (Resend)
   - Host: smtp.resend.com
   - Port: 465
   - Key: [API key Resend]
   - Sender: noreply@resend.dev (ou domaine custom)

2. Supabase > Authentication > URL Configuration
   - Site URL: https://portail-toulon-commercant.netlify.app
   - Redirect URLs: 3 URLs (surtout `/reset-password/update`)

3. Supabase > Authentication > Policies
   - Confirm email: ON
   - Auto send: ON

### ✅ Tests Prêts Après Config
- Reset password (email reçu → lien fonctionnel)
- Must change password (login → redirection forcée)
- Reconnexion normale

---

## Axe 2: Pennylane Sync Backend (Railway)

### ✅ Entièrement Construit

**Stack:** Node.js 20 + Express + Supabase Admin + node-cron

**Source:** `/backend/src/`

```
config.ts                    ← Env vars + validation
├─ db/supabase.ts           ← Supabase Admin client
├─ integrations/pennylane/
│  ├─ types.ts              ← API type defs
│  └─ client.ts             ← Mock Pennylane client (5 charges simulées)
├─ services/sync.service.ts ← Core: fetch → upsert → allocate → track
├─ server.ts                ← Express + 3 endpoints
├─ scheduler.ts             ← Cron (2 AM nightly par défaut)
└─ main.ts                  ← Entry + graceful shutdown
```

### 🔄 Flow Sync Automatisé

```
[2:00 AM] node-cron déclenche
    ↓
Pennylane API (mock ou réel)
    ↓
Backend fetch charges
    ↓
Upsert service_charges (idempotent sur pennylane_id)
    ↓
Calculate allocations (linear meters)
    ↓
Upsert allocations
    ↓
Enregistrer trace dans pennylane_syncs
    ↓
Frontend affiche frais actualisés + quote-parts
```

### 🚀 Démarrage Immédiat

**En local (tests):**
```bash
cd backend
cp .env.example .env
# Remplir: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HALL_ID
npm install
npm run dev
# Server http://localhost:3000
# POST http://localhost:3000/api/sync/pennylane → test sync manuelle
```

**Sur Railway (production):**
```bash
# Push code → Railway auto-détecte Node.js
railway link
railway up
# Railway setup env vars → cron tourne toutes les nuits
```

### 📝 Docs
- [`PENNYLANE_BACKEND_PLAN.md`](PENNYLANE_BACKEND_PLAN.md) - Architecture complète
- [`backend/README.md`](backend/README.md) - Setup + déploiement

### 🔧 Points Clés à Remplir

1. **Hall ID Toulon**
   ```sql
   # Dans Supabase SQL
   SELECT id FROM public.halls WHERE name = 'Halles de Biltoki Toulon';
   ```
   → Copier UUID dans `HALL_ID` env var

2. **Service Charge Period**
   ```sql
   # Créer au moins une période active pour test
   INSERT INTO public.service_charge_periods 
     (hall_id, label, period_start, period_end, status)
   VALUES 
     ('<HALL_ID>', 'Août 2026', '2026-08-01', '2026-08-31', 'draft');
   ```

3. **Merchants + Stands**
   - Existent déjà via seed toulon_real_stands.sql ✅

4. **Test**
   ```bash
   curl -X POST http://localhost:3000/api/sync/pennylane
   # Vérifier upsert dans Supabase > service_charges + allocations
   ```

### 🔄 Remplacer Mock par API Réelle (Dans 10 jours)

Quando você tiver PENNYLANE_API_KEY:
1. Atualizar `.env` com chave
2. Substituir `getMockServiceCharges()` em `src/integrations/pennylane/client.ts` com chamadas HTTP reais
3. Nenhuma outra mudança de código necessária! ✅

---

## 📊 État Détaillé par Composant

| Composant | État | Pronto Para | Blocador |
|-----------|------|-------------|----------|
| **Frontend Auth Routes** | ✅ Pronto | Login/Reset locally | Nenhum |
| **AuthProvider + Guards** | ✅ Pronto | must_change_password flow | Nenhum |
| **Supabase Config** | ⏳ Manual | SMTP + URLs | Domínio + Resend key |
| **Backend Infrastructure** | ✅ Pronto | Development testing | Env vars (Hall ID, DB) |
| **Pennylane Mock Client** | ✅ Pronto | Local testing | API key real (10 dias) |
| **Sync Service (Upsert)** | ✅ Pronto | Integration tests | Service charge period no DB |
| **Allocation Calculator** | ✅ Pronto | Calculation tests | Merchants + stands |
| **Cron Scheduler** | ✅ Pronto | Production scheduling | Railway deploy |
| **Express Endpoints** | ✅ Pronto | Manual testing | Nenhum |

---

## 🎯 Próximos Passos (Prioritários)

### Curtíssimo Prazo (Hoje/Amanhã)
1. [ ] Comprar domínio
2. [ ] Obter clé Resend (ou criar conta)
3. [ ] Configurar SMTP no Supabase (5 min)
4. [ ] Configurar Redirect URLs (2 min)
5. [ ] Testar fluxo de reset password localmente

### Curto Prazo (Esta Semana)
1. [ ] Deploy Auth em Netlify
2. [ ] Testar Reset Password em produção (email real)
3. [ ] Testar must_change_password flow
4. [ ] Criar conta admin de teste com flag

### Médio Prazo (Próximas Semanas)
1. [ ] Configurar Railway para backend
2. [ ] Criar service_charge_periods de teste
3. [ ] Testar sync local (npm run dev)
4. [ ] Verificar upsert em Supabase
5. [ ] Deploy em Railway + cron noturno

### Longo Prazo (Em 10 Dias)
1. [ ] Integração real com Pennylane API
2. [ ] Testes end-to-end
3. [ ] Prod smooth sync
4. [ ] Dashboard atualizado em tempo real

---

## 🔗 Arquivos & Documentação

### Raiz do Projeto
- [`RESEND_SETUP_QUICK.md`](RESEND_SETUP_QUICK.md) - Setup email (5 passos)
- [`SUPABASE_AUTH_SETUP.md`](SUPABASE_AUTH_SETUP.md) - Auth detalhado (referência)
- [`PENNYLANE_BACKEND_PLAN.md`](PENNYLANE_BACKEND_PLAN.md) - Backend design

### Frontend (`src/`)
- `features/auth/AuthProvider.tsx` - Context + session
- `features/auth/pages/LoginPage.tsx`
- `features/auth/pages/ResetPasswordPage.tsx`
- `features/auth/pages/ResetPasswordUpdatePage.tsx`
- `features/auth/pages/UpdatePasswordPage.tsx` - must_change_password
- `app/guards/ProtectedRoute.tsx` - Redirection logic
- `app/AppRouter.tsx` - Route definitions

### Backend (`backend/`)
- `package.json` - Dependencies
- `tsconfig.json` - TS config
- `.env.example` - Template env
- `.gitignore`
- `Dockerfile` - Railway image
- `README.md` - Setup guide
- `src/config.ts` - Env validation
- `src/main.ts` - Entry point
- `src/server.ts` - Express app
- `src/scheduler.ts` - Cron setup
- `src/db/supabase.ts` - Admin client
- `src/services/sync.service.ts` - Sync logic
- `src/integrations/pennylane/` - Pennylane client

### Scripts
- `scripts/create-admin-user.mjs` - Criar admin com must_change_password

---

## ✨ Destaques Técnicos

### Idempotência Garantida
- Charges upsert em `(hall_id, pennylane_id)` → sem duplicatas
- Allocations recalculadas a cada sync → sempre corretas

### Precision Monetária
- Valores em cents (centavos) para evitar floating-point errors
- Linear meters em millimeters para precision
- Allocation % em basis points (bps)

### Robustez
- Graceful shutdown (SIGTERM/SIGINT)
- Health checks Railway
- Retry logic built-in (via DB uniqueness)
- Detailed logging (Pino)

### Escalabilidade
- Architecture permite múltiplas halls (adaptado de HALL_ID fixo)
- Sync parallelizável por periodo/tipo
- Backend stateless (pronto para Railway auto-scaling)

---

## 🚨 Observações Importantes

1. **Auth Email:** Sem Resend key configurada, reset password não envia (mas URLs estão prontas)
2. **Pennylane Mock:** Retorna 5 charges simuladas - suficiente para testar lógica toda
3. **Hall ID:** Precisão é UUID da hall Toulon (não string!)
4. **Service Period:** Backend falha gracefully se nenhuma período ativa aujourd'hui
5. **Railway:** Recomendado usar seu plano gratuito com $5/mês credits

---

## 📞 Suporte

### Se der erro ao testar:
1. Verifique logs com `railway logs --follow` (ou `npm run dev`)
2. Consulte `.env.example` para todos os required vars
3. Rode health check: `curl http://localhost:3000/health`

### Próxima reunião: 
Confirmar Hall ID + Resend, depois testes locais completos!

---

**Gerado:** 14 Agosto 2026  
**Stack:** React 19 + TypeScript + Vite | Node 20 + Express | Supabase  
**Status:** 🟢 Ready to Test (Auth + Backend)
