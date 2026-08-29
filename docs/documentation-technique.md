# Documentation technique — Stop 3MR

**Destinataires :** équipe de développement, exploitation, administration système.  
**Application :** plateforme Stop Réfléchissant 3M (Stop 3MR) v2.0  
**Dépôt :** `stopReflechissant2`  
**Date :** 27 août 2026

Le guide métier se trouve dans [guide-utilisateur.md](./guide-utilisateur.md).

---

## 1. Vue d’ensemble

Application web **full-stack** de traçabilité des plaques réfléchissantes : production (numéro de série + QR), affectation aux commerciaux, ventes en centre de contrôle technique, authentification publique, CRM (factures / reçus), audit.

| Couche | Choix |
|--------|--------|
| UI | Next.js 15 (App Router), React 19, Tailwind CSS 4, SweetAlert2 |
| API | Route Handlers `src/app/api/**/route.ts` |
| Auth | NextAuth 4 (Credentials + JWT, 4 h) |
| ORM | Prisma 6 → MariaDB / MySQL (`stop3mr`) |
| PDF / QR | PDFKit, `qrcode`, Sharp (images catalogue) |
| Validation | Zod |
| Cartographie | Leaflet + tuiles OpenStreetMap |

Hébergement de développement observé : **XAMPP** (Apache non requis pour Next ; MySQL `C:\xampp\mysql`) + `npm run dev` sur `http://localhost:3000`.

---

## 2. Architecture

```
Navigateur
    │
    ├─ Pages App Router (RSC + client components)
    ├─ NextAuth  /api/auth/[...nextauth]
    └─ Fetch JSON  /api/*
            │
middleware.ts  (JWT, rôles pages/API, rate-limit public)
            │
src/lib/*  (prisma, auth, serial, crm, encryption, audit)
            │
MariaDB  stop3mr
```

- **Pas de backend séparé.** Toute la logique métier est dans Next.js.
- **Prisma Client** singleton : `src/lib/db.ts` (évite les multi-instances en hot-reload).
- **Middleware Edge** (`src/middleware.ts`) : protège `/api/*` (sauf `/api/auth` et `/api/register`) et les pages back-office. Les pages `/verify` et `/register` sont publiques mais **rate-limitées**.

### 2.1 Arborescence utile

```
src/app/           pages + API
src/components/    Navbar, pagination, PDF, selects métier
src/lib/           domaine (auth, serial, counters, crm, encryption, …)
prisma/schema.prisma
prisma/sql/        durcissements SQL manuels (CHECK, index)
prisma/seed*.ts    jeux de données
docs/              ce dossier
```

---

## 3. Environnement

Fichier `.env` (ne jamais committer les secrets). Modèle : `.env.example`.

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | `mysql://user:pass@host:3306/stop3mr` |
| `NEXTAUTH_URL` | URL canonique. **https://** en production (cookies `Secure`). |
| `NEXTAUTH_SECRET` | ≥ 32 caractères, unique. Refusé en prod s’il est dans la liste des secrets faibles (`src/lib/security.ts`). |
| `ENCRYPTION_KEY` | 64 hex (32 octets) AES-256-GCM **et** HMAC des hashes de recherche (`searchHash`). Sans clé, encrypt/searchHash échouent. Rotation ⇒ recalculer `nom_hash` / `telephone_hash` / `nom_prefix_hash` des clients. Perte ⇒ PII illisibles. |
| `APP_PUBLIC_URL` | Base des URLs QR / register. |
| `DEFAULT_SITE_CODE` | Repli série si pas de site (défaut code **YP**). |
| `SMTP_*` / `ADMIN_EMAIL` | Notification e-mail de vente. Port **465** ⇒ TLS implicite. |
| `TRUST_PROXY` | `true` uniquement derrière un reverse proxy qui **écrase** `X-Forwarded-For`. Sinon spoofing du rate-limit. |
| `COMPTE_CONTRIBUABLE` | Mention PDF / légale. |
| `SMS_API_*` | Optionnel, non central au flux actuel. |

Validation au boot serveur : `src/lib/env.ts` → `validateProductionSecrets()`. En `NODE_ENV=production`, secret / clé trop faibles ⇒ **process.exit(1)**.

Génération secrets :

```bash
openssl rand -base64 32    # NEXTAUTH_SECRET
openssl rand -hex 32       # ENCRYPTION_KEY
```

---

## 4. Scripts npm

| Script | Usage |
|--------|--------|
| `npm run dev` | Next.js 15, port 3000 |
| `npm run build` / `start` | Production (`output: "standalone"` dans `next.config.ts`) |
| `npm run db:generate` | Régénère le client Prisma (**obligatoire** après changement de `schema.prisma`) |
| `npm run db:seed` | 4 comptes démo |
| `npm run db:seed:territoire` | Centres + utilisateurs de test (lourd) |
| `npm run db:seed:demo` / `db:seed:volume` | Jeux volumineux |
| `npm run db:sync:passwords` | Aligne hash = identifiant ( bcrypt 12 ) — **outil de recette uniquement** |

### 4.1 Interdiction `prisma db push` sur la base live

La base a reçu des **CHECK MariaDB**, des index et des FK **hors** schéma Prisma (`prisma/sql/audit-hardening-2026-08-27.sql`).

`npx prisma db push` peut **supprimer** ces contraintes. Pour un changement de schéma :

1. Modifier `schema.prisma`.
2. `npx prisma generate` (arrêter `next dev` sous Windows si `EPERM` sur `query_engine-windows.dll.node`).
3. Appliquer le SQL équivalent à la main (ou une migration Prisma **revue** qui n’écrase pas les CHECK).

---

## 5. Modèle de données

SGBD : **MariaDB 10.4+** / MySQL 8, charset `utf8mb4`, collation cible `utf8mb4_unicode_ci`.

### 5.1 Tables (`@@map`)

`utilisateurs`, `centres_controle`, `produits`, `sites_production`, `compteurs_serie`, `compteurs_document`, `plaques`, `affectations_stock`, `verifications`, `clients`, `vehicules`, `ventes`, `factures`, `recus_paiement`, `rapports`, `journal_audit`, `parametres`.

Le module **devis** a été retiré (table droppée). Ne pas la recréer.

### 5.2 Règles d’intégrité (métier + SQL)

| Règle | Implémentation |
|-------|----------------|
| Une vente ↔ une plaque | `ventes.plaque_id` UNIQUE, plaque `VENDUE` |
| Plaque toujours cataloguée | `plaques.produit_id` NOT NULL, `ON DELETE RESTRICT` |
| Site usine connu | FK `plaques.site_production` → `sites_production(code)` |
| Un site usine actif | Logique applicative PATCH `/api/admin/sites/[id]` |
| Code commercial unique | `utilisateurs.code_commercial` UNIQUE, compteur type `COM` |
| TTC ≥ payé, TTC/HT ≥ 0 | CHECK `factures_montants_chk` + Zod |
| Reçu > 0 | CHECK `recus_montant_chk` |
| Commission ≤ prix | CHECK `ventes_montants_chk` |
| Taux 0–100 | CHECK `produits_prix_chk` |

**Reliquat accepté :** ~11 ventes historiques sans `centre_id` (nullable). Les **nouvelles** ventes commerciales exigent un centre.

Sites inactifs `PR` / `YK` / `BK` : conservés tant que des plaques historiques les référencent. Site actif attendu : **YP**.

### 5.3 Statuts plaque

`EN_STOCK` → `AFFECTEE` (allocation) → `VENDUE` (vente back-office ou POST public `/api/register`).

### 5.4 Compteurs atomiques

Fichier `src/lib/counters.ts` : `INSERT … ON DUPLICATE KEY UPDATE … LAST_INSERT_ID()` **dans la même connexion Prisma** (transaction).

- Série : `(site_code, date_prefix)` → `R3M-{SITE}-{AAMMJJ}-{000001}`.
- Documents : `(type, annee)` → `FAC-AAAA-00001`, `REC-AAAA-00001`.
- Codes commerciaux : type `COM`, `annee = 0`, `GREATEST` avec le max existant.

Ne **jamais** faire find → increment en deux requêtes : course concurrente.

### 5.5 PII clients

Champs chiffrés AES-256-GCM (`src/lib/encryption.ts`) : au minimum nom, téléphone, e-mail (voir `encryptClientData` / `decryptClientRecord` dans `src/lib/clients.ts`). Format stocké : `iv:authTag:ciphertext` (hex).

La recherche par nom **ne peut pas** se faire en SQL LIKE sur le chiffré : les listes avec `q` déchiffrent un sous-ensemble plafonné (ex. 500 clients, 2000 factures).

---

## 6. Authentification et autorisations

### 6.1 NextAuth

`src/lib/auth.ts`

- Provider Credentials, bcryptjs **cost 12**.
- Dummy hash **valide** si utilisateur inexistant (mitigation timing).
- Rate-limit login : 5 / 15 min par identifiant + 30 / 15 min sur POST `/api/auth`.
- JWT : `pwdFp` = SHA-256 tronqué du hash mot de passe → invalidation après reset / changement.
- Compte `actif = false` ⇒ `token.invalid`.
- `useSecureCookies` si `NEXTAUTH_URL` commence par `https://`.

Helpers API : `requireAuth(roles)` dans `src/lib/api-auth.ts`.

Matrice pages : `pageRoleMap` dans `middleware.ts`. Matrice API : chaque `route.ts` rappelle `requireAuth(ROLES.*)`.

| Préfixe | Rôles typiques |
|---------|----------------|
| `/api/admin`, `/api/export`, `/api/stats` | ADMIN (GET sites/centres aussi OPERATEUR) |
| `/api/plaques` POST | PRODUCTION |
| `/api/ventes`, `/api/clients` | COMMERCIAL + ADMIN |
| `/api/crm/*` | ADMIN uniquement (`ROLES.CRM`) |
| `/api/controle/*` | AGENT_CT + ADMIN |
| `/api/register/*` | **Public** (jeton plaque) |

IDOR commercial : `GET /api/plaques/[numero]` n’expose la fiche (client déchiffré) que si `commercialId` ou `vente.vendeurId` = utilisateur courant.

### 6.2 Mots de passe

- Politique : `isStrongPassword` (12 car., A-Z, a-z, chiffre).
- Création / reset admin : `generateTemporaryPassword()` renvoyé **une fois** dans le JSON (`motDePasseTemporaire`). Ne pas le journaliser.
- Comptes **seed existants** : beaucoup ont encore mot de passe = identifiant. Campagne métier à part (`db:sync:passwords` est l’inverse : il **aligne** sur l’identifiant — ne pas lancer en production).

### 6.3 En-têtes HTTP

`next.config.ts` : `X-Frame-Options: DENY`, nosniff, CSP (`object-src 'none'`, pas d’`unsafe-eval` en production), COOP/CORP `same-origin`, HSTS en production.

---

## 7. Flux métier côté code

### 7.1 Production de plaques

`POST /api/plaques`

1. Produit actif + vitesse si `vitessesDisponibles`.
2. `getUniqueProductionSite()` : un seul site `actif`.
3. Pour chaque unité : `generateNumeroSerie(code)` puis `create` en **transaction** (`qrCodeData` vide en base).
4. QR data-URL généré **uniquement** pour la réponse UI (dernière plaque). PDF : `src/lib/qr-pdf.ts` → `generatePrintQrPng` à la volée.

### 7.2 Affectation

`POST /api/allocations` : `SELECT … FOR UPDATE` sur plaques `EN_STOCK`, puis statut `AFFECTEE` + `commercialId` + ligne `affectations_stock`.

### 7.3 Vente

`POST /api/ventes` : isolation Repeatable Read, `FOR UPDATE` sur la plaque, `updateMany` conditionnel `EN_STOCK|AFFECTEE` → `VENDUE`, puis insert `ventes`. Commission : `src/lib/money.ts` `computeCommission`. Notification : `notifySale` (e-mail ou log sans PII).

Commercial : plaque doit être `AFFECTEE` et `commercial_id = userId` ; `centreId` obligatoire.

### 7.4 Facture / reçu

- Numéro **dans** la transaction (`generateDocumentNumber(type, tx)`).
- Reçu : `SELECT … FOR UPDATE` facture, `montantPaye: { increment }`, statut via `computeFactureStatut`.

### 7.5 Enregistrement public

`POST /api/register/[numero]` : jeton `timingSafeEqual`, `FOR UPDATE`, crée client chiffré + vente. GET : **403 unique** si série inconnue ou jeton faux (pas d’oracle 404).

---

## 8. API (référence)

Toutes les routes authentifiées exigent le cookie de session (même origine). CSRF : cookies `SameSite=Lax`.

| Méthode | Chemin | Accès | Notes |
|---------|--------|-------|--------|
| POST | `/api/auth/[...nextauth]` | Public | Login |
| GET/POST | `/api/plaques` | Prod / commercial GET | POST max 50 |
| GET | `/api/plaques/[numero]` | Prod / commercial (scopé) | |
| GET | `/api/plaques/qr-pdf` | Auth prod | |
| POST | `/api/allocations` | Prod | |
| GET/POST | `/api/ventes` | Ventes | |
| GET/POST | `/api/clients` | Clients | `q` plafonné |
| GET/PUT/DELETE | `/api/clients/[id]` | Clients ; DELETE admin | |
| GET/POST | `/api/crm/factures` | Admin | |
| GET | `/api/crm/factures/[id]/pdf` | Admin | |
| GET/POST | `/api/crm/recus` | Admin | |
| GET | `/api/export` | Admin | 5 / heure |
| GET/POST | `/api/admin/utilisateurs` | Admin | |
| PATCH/DELETE | `/api/admin/utilisateurs/[id]` | Admin | |
| GET | `/api/admin/comptes-test` | Admin | **404 en production** |
| GET/POST | `/api/register/[numero]` | Public | |

Liste complète : fichiers `src/app/api/**/route.ts`.

---

## 9. Sécurité — points d’attention exploitation

1. **Ne pas** exposer `prisma/data/comptes-test.csv` en production.
2. Rate-limit : middleware Edge délègue à `POST /api/internal/rate-limit` (seau MariaDB atomique). Session JWT relue en base à chaque refresh (plus de cache processus).
3. Export admin = dump PII déchiffré : journalisé (`EXPORT_DONNEES`), cellules CSV/XLSX assainies (`sanitizeCsvCell` / `csvEscape`).
4. Uploads catalogue : Sharp re-encode en WebP dans `public/uploads/produits/` (pas d’exécution SVG).
5. Open redirect login : uniquement `safeCallbackUrl` (`src/lib/security.ts`).
6. Perte de `ENCRYPTION_KEY` = perte des noms / téléphones clients (les ventes et séries restent lisibles).

---

## 10. Installation locale (recette)

Prérequis : Node.js 20+, MariaDB/MySQL, npm.

```bash
cp .env.example .env
# Éditer DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY
# CREATE DATABASE stop3mr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

npm install
npx prisma generate
# Schéma initial : prisma db push UNIQUEMENT sur une base vide neuve
# Base déjà durcie : ne pas db push — aligner via SQL
npm run db:seed
npm run dev
```

Comptes seed (identifiant = mot de passe tant qu’ils n’ont pas été recréés / reset) :

| Rôle | Identifiant |
|------|-------------|
| Administrateur | `admin` |
| Opérateur | `operateur` |
| Commercial | `commercial` |
| Agent CT | `agentct` |

Sous Windows, si `prisma generate` échoue (`EPERM` rename `query_engine-windows.dll.node`) : arrêter `npm run dev`, générer, relancer.

---

## 11. Déploiement production

1. Node LTS, MariaDB, Nginx (TLS), process manager (PM2 ou équivalent).
2. `NEXTAUTH_URL=https://…`, `APP_PUBLIC_URL` identique, secrets forts.
3. `npm run build` puis `npm start` (ou binaire `standalone`).
4. Nginx : proxy vers le port Node, en-têtes `X-Forwarded-For` / `X-Forwarded-Proto` **écrasés**, `TRUST_PROXY=true`.
5. Sauvegardes : `mysqldump` quotidien + fichier `.env` hors dépôt (clé de chiffrement).
6. Health : `GET /login` 200 ; smoke admin après déploiement.
7. Ne pas lancer `db:sync:passwords` ni `db:seed:territoire` sur la prod métier.

`next.config.ts` : `output: "standalone"`, `serverExternalPackages: ["sharp", "pdfkit"]`.

---

## 12. Observabilité

- Journal applicatif : table `journal_audit` (`logAudit` dans `src/lib/audit.ts`) — IP via `getTrustedClientIp`.
- Logs Node : erreurs Prisma, échecs SMTP (`notify.ts` ne log plus le nom client).
- Pas d’APM intégré.

---

## 13. Dette connue / décisions

| Sujet | Décision |
|-------|----------|
| `prisma db push` | Interdit sur base durcie |
| Compteurs | SQL `LAST_INSERT_ID`, pas d’autoincrement applicatif naïf |
| QR en base | Chaîne vide ; PDF régénère |
| Devis | Supprimé |
| Ventes sans véhicule | `vehiculeId` nullable (vente back-office) |
| Rate-limit | Mémoire process |
| CSP | `unsafe-inline` encore requis par Next (pas de nonces) |
| Seed 1 800 comptes | MDP = identifiant jusqu’à campagne de reset |

---

## 14. Faire évoluer le projet

1. Lire ce document + `prisma/schema.prisma` + `src/lib/roles.ts` / `menu.ts`.
2. Toute mutation concurrente (stock, vente, paiement, série) : **transaction + verrou `FOR UPDATE`**.
3. Toute liste longue : `skip`/`take` SQL ; recherche PII = plafond mémoire.
4. Nouveau rôle : étendre enum Prisma, `ROLES`, `menuForRole`, `pageRoleMap`, `requireAuth` des routes.
5. Tests manuels minimaux : login 4 rôles, produire 1 plaque, affecter, vendre (centre CT), facture + reçu, scan `/verify/{serie}`.
6. Après `schema.prisma` : `prisma generate` ; SQL manuel si contrainte CHECK / index hors Prisma.

Fichier SQL de référence intégrité : `prisma/sql/audit-hardening-2026-08-27.sql`.
