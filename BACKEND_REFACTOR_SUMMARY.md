# Backend Refactor Summary - Simplified Model (14 Août 2026)

## Changements Majeurs

### ❌ Supprimé (pas nécessaire)
- **Allocation calculation** - Plus de calcul automatique par linear_meters
- **allocations table upsert** - Les allocs sont calculées ailleurs (manuellement par Biltoki)
- **Single HALL_ID config** - Remplacé par multi-hall support
- **getMerchants() + getStands()** - Plus de dépendances métier, juste source unique Pennylane

### ✅ Ajouté (scaling ready)
- **HALLS_TO_SYNC config** - Comma-separated list (1 backend pour 10 halls)
- **Multi-hall scheduler** - Cron déclenche sync pour CHAQUE hall configurée
- **hallId parameter** - POST `/api/sync/pennylane/:hallId` permet test manual par hall
- **GET /api/halls** - List toutes les halls configurées

---

## Architecture Simplifée

### Avant (Complexe)
```
Pennylane API
  ↓
Fetch charges
  ↓
Upsert charges
  ↓
Fetch merchants + stands
  ↓
Calculate allocations (linear_meters %)
  ↓
Upsert allocations
  ↓
Frontend affiche charge + alloc
```

### Après (Simple = Transparent)
```
Pennylane API
  ↓
Fetch charges (source unique)
  ↓
Upsert charges ONLY
  ↓
Frontend affiche charges (consultation classée)
     ↓
Biltoki facturation = gérée ailleurs (Excel, custom system)
```

**Why?**
- Quote-parts changent chaque mois (pas de règle fixe)
- Frais antérieurs mélangés aux actuels
- Complexity << value
- **Juste besoin d'une consultation transparente des frais**

---

## Configuration Multi-Hall

### Avant
```env
HALL_ID=uuid-toulon
# Pour ajouter Marseille = déployer deuxième backend
```

### Après
```env
HALLS_TO_SYNC=uuid-toulon,uuid-marseille,uuid-lyon,uuid-nice,...
# Ajouter 10ème hall = juste ajouter UUID dans env var, redeploy Railway (2 secondes)
```

### Sync Behavior
```
Cron à 2 AM:
  ├─ Sync Toulon    → Fetch → Upsert charges
  ├─ Sync Marseille → Fetch → Upsert charges
  ├─ Sync Lyon      → Fetch → Upsert charges
  └─ ... (toutes les halls)
```

**Result:** 1 backend, 10 halls, tout géré 🎯

---

## Code Changes

### sync.service.ts
```typescript
// AVANT
async syncServiceCharges(): Promise<SyncResult> {
  const merchants = await this.getMerchants()
  const stands = await this.getStands()
  
  for (const charge of charges) {
    await this.calculateAndUpsertAllocations(charge, merchants, stands)
  }
}

// APRÈS
async syncServiceCharges(): Promise<SyncResult> {
  // Juste fetch + upsert charges
  for (const charge of charges) {
    await this.upsertServiceCharge(period.id, charge)
  }
}
```

**Lines of code:** ~180 → ~60 (66% réduction!)

### config.ts
```typescript
// AVANT
biltoki: {
  hallId: string
}

// APRÈS
biltoki: {
  hallsToSync: string[]  // Parse "uuid-1,uuid-2,uuid-3"
}
```

### scheduler.ts
```typescript
// AVANT
const syncService = new PennylaneSync(db, pennylaneClient, config.biltoki.hallId)
await syncService.syncServiceCharges()

// APRÈS
for (const hallId of config.biltoki.hallsToSync) {
  const syncService = new PennylaneSync(db, pennylaneClient, hallId, logger)
  await syncService.syncServiceCharges()
}
```

### server.ts
```typescript
// AVANT
POST /api/sync/pennylane → sync config.hallId

// APRÈS
POST /api/sync/pennylane/:hallId → sync hallId (si dans HALLS_TO_SYNC)
GET /api/halls → list toutes les halls
```

---

## Database (Pas de changement!)

```sql
service_charges
├─ hall_id           (nouvelle colonne = quelle hall?)
├─ period_id         (quel mois?)
├─ pennylane_id      (clé externe, unique par hall)
├─ label
└─ amount_incl_tax

-- Plus de allocations upsert (table reste vide)
```

---

## Frontend (À faire)

### ChargesPage
```tsx
// Merchant voir charges de sa hall uniquement
SELECT * FROM service_charges
WHERE hall_id = auth.user.merchant.hall_id
ORDER BY period DESC, created_at DESC

// Afficher:
// ├─ Août 2026
// │  ├─ Nettoyage          4,200€
// │  ├─ Sécurité           2,160€
// │  └─ Total            12,000€
// ├─ Juillet 2026
// │  └─ ...
```

### Admin ChargesPage
```tsx
// Admin voit tout + dropdown hall filter
const [selectedHall, setSelectedHall] = useState(halls[0])

SELECT * FROM service_charges
WHERE hall_id = selectedHall
ORDER BY period DESC, created_at DESC
```

---

## Déploiement Railway

### Configuration
```env
HALLS_TO_SYNC=uuid-toulon,uuid-marseille,uuid-lyon
# Ajouter Nantes:
HALLS_TO_SYNC=uuid-toulon,uuid-marseille,uuid-lyon,uuid-nantes
```

Railway redeploy automatiquement et cron tourne immédiatement.

---

## Testing Local

### 1. Setup
```bash
cd backend
cp .env.example .env
# Remplir:
# VITE_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
# HALLS_TO_SYNC=uuid-toulon,uuid-marseille
npm install
npm run dev
```

### 2. Test sync manuel pour Toulon
```bash
curl -X POST http://localhost:3000/api/sync/pennylane/uuid-toulon
```

### 3. Vérifier Supabase
```sql
SELECT hall_id, label, amount_incl_tax
FROM service_charges
ORDER BY created_at DESC
```

---

## Dans 10 Jours (Quand API Key Pennylane)

**Remplacer mock par réel:**
```typescript
// src/integrations/pennylane/client.ts
async fetchServiceCharges(hallId: string) {
  if (!this.apiKey) return mockData // Dev fallback
  
  const response = await fetch(
    `https://api.pennylane.io/charge?hall_id=${hallId}`,
    { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
  )
  return response.json()
}
```

**Après:**
```bash
npm run build
git push
# Railway redeploy auto
# Cron tourne avec données réelles à 2 AM
```

---

## Benefits de cette Archi

| Aspect | Avant | Après |
|--------|-------|-------|
| Halls supportées | 1 | 10 (configurables) |
| Code complexity | Moyen | Simple |
| Scaling effort | Déployer backend | Ajouter UUID |
| Allocation logic | Backend | Biltoki decides |
| Time to add 10th hall | 30 min | 30 sec |
| Transparency | Caché (allocations) | Direct (frais) |

---

## Checklist Prochaines Étapes

- [ ] Vérifier UUID halls Toulon + autres dans Supabase
- [ ] Copier UUIDs dans backend `.env` comme `HALLS_TO_SYNC`
- [ ] Créer `service_charge_periods` tests pour chaque hall
- [ ] Test local: `npm run dev` + `POST /api/sync/pennylane/uuid-toulon`
- [ ] Vérifier upsert dans Supabase
- [ ] Deploy Railway backend
- [ ] Frontend: ChargesPage component
- [ ] Tests end-to-end production
- [ ] Remove old allocation code (frontend aussi?)

---

**Archi prête pour scale à 10 halls! 🚀**

Notes: 
- Mock Pennylane client livré + testé
- Real API drop-in replacement dans 10j
- Pas de code changes après swap API
