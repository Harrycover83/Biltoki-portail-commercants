# ✨ Prisma Setup - Mode Transparent

Tu voulais un outil "intelligent" pour gérer l'évolution de la base de données sans SQL brut. **Prisma est là pour ça!**

## 🎯 Ce qui s'est passé

J'ai configuré Prisma pour que tu n'aies jamais à toucher du SQL à la main. Voici le setup:

### ✅ Créé
- **`backend/prisma/schema.prisma`** — Définition de tout ton modèle de données (organisations, halles, commerçants, etc.)
- **`backend/prisma/seed.ts`** — Script qui créé automatiquement les 10 halles Biltoki après chaque migration
- **`backend/package.json`** — Scripts Prisma (migrate, seed, studio)
- **`backend/PRISMA_SETUP.md`** — Documentation complète
- **`backend/setup-prisma.ps1`** — Script PowerShell qui t'aide à tout configurer

### 🔀 Workflow intelligent
Quand tu veux changer quelque chose:

1. **Tu modifies `schema.prisma`** (ajouter un champ, une table, etc.)
2. **Tu lances `npm run prisma:migrate`**
3. **Prisma crée automatiquement:**
   - La migration SQL
   - Applique la migration à la DB
   - Génère le Prisma Client (type-safe!)
   - Lance le seed script (recrée les données)

**Aucun SQL à écrire. Tout automatique.**

## 🚀 Comment démarrer

### Option 1: Script automatisé (recommandé)
```powershell
cd backend
.\setup-prisma.ps1
```

Le script va:
1. Te demander ta connection string Supabase
2. La sauvegarder dans `.env.local`
3. Lancer les migrations
4. Afficher ton `HALLS_TO_SYNC` pour Railway

### Option 2: Faire manuellement
```bash
# 1. Récupère ton DATABASE_URL depuis Supabase
# Supabase Dashboard → Project Settings → Database → Connection Pooler → Copy URI

# 2. Mets-le dans backend/.env.local
# DATABASE_URL="postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres"

# 3. Lance les migrations
cd backend
npm run prisma:migrate
# Quand ça demande: "Enter a name for this migration" → tape "init" ou "create_schema"
```

## 📊 Explorer les données

Une fois que tout est setup:

```bash
npm run prisma:studio
```

**Ça ouvre une belle interface web où tu peux:**
- Voir toutes tes tables et données
- Ajouter/modifier/supprimer des lignes
- Faire des requêtes de test
- Inspirer la structure de la DB

## 🛠️ Changer le schéma

**Exemple: ajouter un champ `website` à la table `halls`**

```prisma
model Hall {
  // ... autres champs ...
  address      String?
  website      String?  // ← Nouveau champ ajouté ici
  active       Boolean  @default(true)
  // ...
}
```

Puis:
```bash
npm run prisma:migrate
# Donne un nom: "add_website_to_halls"
```

**Prisma va:**
1. Générer un SQL `ALTER TABLE` automatiquement
2. L'appliquer à ta DB
3. Mettre à jour le Prisma Client
4. Tout sera typé en TypeScript 💪

## 📝 Seed script intelligent

Quand tu lances les migrations, le script `seed.ts` s'exécute et:

1. ✅ Crée l'organisation "Biltoki"
2. ✅ Crée les 10 halles avec noms + villes francisées
3. ✅ `upsert` = créé ou met à jour si existe déjà
4. ✅ Affiche les UUIDs des halles = **ton `HALLS_TO_SYNC`** pour Railway

**Ou relancer manuellement:**
```bash
npm run prisma:seed
```

## 🗄️ Utiliser Prisma dans le code backend

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Récupérer toutes les halles
const halls = await prisma.hall.findMany();

// Créer une période
const period = await prisma.serviceChargePeriod.create({
  data: {
    hallId: hallId,
    label: "Janvier 2025",
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    status: "draft",
  },
});

// Récupérer les frais d'une période avec relations
const charges = await prisma.serviceCharge.findMany({
  where: { periodId: periodId },
  include: {
    period: true,
    hall: true,
  },
});

// Complexe: tous les commerçants d'une halle avec leurs postes
const merchants = await prisma.merchant.findMany({
  where: { hallId: hallId },
  include: {
    stands: {
      where: { active: true },
    },
  },
});
```

**Tout est auto-complété et type-safe en TypeScript!**

## 📋 Commandes utiles

```bash
# Voir la DB dans une interface web
npm run prisma:studio

# Créer/appliquer une migration
npm run prisma:migrate

# Relancer la seed (recrée les données)
npm run prisma:seed

# Réinitialiser (attention: supprime tout!)
npm run prisma:migrate:reset

# Générer le Prisma Client (fait auto dans migrate)
npm run prisma:generate

# Déployer sur production (applique migrations sans reset)
npm run db:setup
```

## 🚀 Déployer sur Railway

Après setup local avec Prisma:

1. **Récupère le `HALLS_TO_SYNC`** depuis output du seed
2. **Ajoute à Railway environment:**
   ```
   DATABASE_URL=postgresql://...  # Même connection string
   HALLS_TO_SYNC=uuid1,uuid2,...  # Depuis seed output
   SUPABASE_SERVICE_ROLE_KEY=...
   PENNYLANE_API_KEY=... (quand tu l'as)
   ```

3. **Railway fait automatiquement:**
   - Build l'image Docker
   - Lance `npm run prisma:generate`
   - Lance `npm run db:setup` (migrations + seed)
   - Démarre le serveur


4. **Voilà! Tout est prêt.**

## ❓ Problèmes courants

**Q: "DATABASE_URL not set"**
- Vérifie que `backend/.env.local` a une ligne `DATABASE_URL=...`

**Q: "FATAL: Too many connections"**
- Utilise la "Session pooler" URI (port 6543), pas la connexion directe

**Q: Réinitialiser tout?**
- `npm run prisma:migrate:reset` (attention: supprime les données)
- Puis refait les migrations

**Q: Ajouter des données en dur?**
- Modifie `prisma/seed.ts` → ajoute `prisma.MODEL.create(...)` → relance `npm run prisma:seed`

## 📚 Ressources

- Docs Prisma: https://www.prisma.io/docs
- Prisma ORM Guide: https://www.prisma.io/docs/orm/prisma-client
- Schema syntax: https://www.prisma.io/docs/orm/reference/prisma-schema-reference

---

**Bottom line:** Tu modifies le schéma dans Prisma → Les migrations se font toutes seules → Zéro SQL brut! 🎉
