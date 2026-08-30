# Stop 3MR — Plateforme de traçabilité QR Code

Plateforme **Stop Réfléchissant 3M** (marque verbale **Stop 3MR**) — traçabilité, authentification et gestion des ventes par QR code.

**Documentation :**

- [Guide utilisateur](docs/guide-utilisateur.md)
- [Documentation technique](docs/documentation-technique.md)

**Stack :** Next.js 15 · React · TypeScript · MariaDB / MySQL · Prisma · NextAuth · Tailwind CSS

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **Numérotation auto** | Format `R3M-YP-AAMMJJ-XXXXXX`, compteur transactionnel sans doublon |
| **QR Code** | Génération automatique + page publique `/verify/[numero]` |
| **Fiche client** | Formulaire public `/register/[numero]` lié à la plaque |
| **Notification vente** | E-mail admin via Nodemailer (fallback console) |
| **Back-office** | Opérateur + Administrateur avec rôles, audit, export Excel/CSV |
| **Sécurité** | Auth, chiffrement AES-256 des données clients, protection marque |

## Prérequis

- Node.js 20+ (LTS)
- MySQL 8 (XAMPP ou serveur dédié)
- npm

## Installation (développement local)

```bash
# 1. Copier la configuration
cp .env.example .env

# 2. Créer la base MySQL
# Dans phpMyAdmin ou mysql CLI :
# CREATE DATABASE stop3mr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. Installer les dépendances
npm install

# 4. Appliquer le schéma
npm run db:push

# 5. Peupler les comptes par défaut
npm run db:seed

# 6. Lancer le serveur de dev
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

### Comptes par défaut (seed)

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Administrateur | `admin` | `admin` |
| Opérateur | `operateur` | `operateur` |
| Commercial | `commercial` | `commercial` |
| Agent CT | `agentct` | `agentct` |

Le mot de passe de chaque compte est identique à son identifiant (`vendeur.0001` / `vendeur.0001`, etc.).

## Structure du projet

```
src/
├── app/
│   ├── api/          # Route Handlers (plaques, auth, export, register, stats)
│   ├── admin/        # Dashboard administrateur
│   ├── dashboard/    # Tableau de bord
│   ├── login/        # Connexion back-office
│   ├── operator/     # Module production
│   ├── register/     # Formulaire client (public)
│   └── verify/       # Vérification QR (public)
├── components/
└── lib/              # db, auth, serial, qr, encryption, audit, notify
prisma/
└── schema.prisma     # Schéma MySQL
```

## Déploiement Hostinger — stop3mr.babitechs.com

Stop 3MR est une app **Node.js (Next.js)**, pas du PHP. Le dossier `public_html/stop3mr` sert uniquement de vitrine Apache ; Hostinger y pose un `.htaccess` et fait tourner Node **à côté**, dans `~/domains/stop3mr.babitechs.com/nodejs`. Ne pas y copier le projet à la main.

**Plan requis :** Business Web Hosting, ou Cloud Startup / Professional / Enterprise (Web App Node.js dans hPanel).

### 1. Base MySQL

1. hPanel → **Bases de données** → MySQL → créer `stop3mr` (utf8mb4).
2. Noter utilisateur, mot de passe, hôte (`localhost` si Node et MySQL sont sur le même compte).
3. `DATABASE_URL` : `mysql://USER:PASSWORD@localhost:3306/NOM_BASE`  
   (encoder `@`, `#`, `%` dans le mot de passe : `@` → `%40`).

### 2. Site Node.js (pas un site PHP)

Si le sous-domaine a été créé comme site PHP/HTML, **retirez-le** des Websites (le dossier vide peut rester). Puis :

1. hPanel → **Websites** → **Add Website** → **Node.js web app**.
2. **Import Git repository** → Connect with GitHub → autoriser **openedsky/stop3mr**.
3. Branche `main`, domaine **stop3mr.babitechs.com**.
4. Réglages (Hostinger les pré-remplit souvent) :
   - Framework : **Next.js**
   - Node.js : **20** ou **22**
   - Build : `npm run build`
   - Output : `.next`
   - Entry file : `server.js`
   - Start : `npm start` (écoute 0.0.0.0 / PORT Hostinger)
5. **Variables d’environnement** (avant le premier Deploy) :

| Clé | Valeur |
|-----|--------|
| `NODE_ENV` | `production` |
| `HOSTNAME` | `0.0.0.0` |
| `NEXTAUTH_URL` | `https://stop3mr.babitechs.com` |
| `APP_PUBLIC_URL` | `https://stop3mr.babitechs.com` |
| `TRUST_PROXY` | `true` |
| `DATABASE_URL` | chaîne MySQL ci-dessus |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `RL_INTERNAL_SECRET` | autre `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (64 caractères) |
| `DEFAULT_SITE_CODE` | `PR` |

6. **Deploy**. Les prochains `git push` sur `main` relancent le build.

### 3. Schéma et premier admin

Après un build vert, en SSH (Terminal hPanel) :

```bash
cd ~/domains/stop3mr.babitechs.com/nodejs
npx prisma db push
npx prisma db seed
```

(Si `tsx` n’est pas dispo en prod, lancer le seed une fois depuis votre PC avec le `DATABASE_URL` Hostinger et l’accès distant MySQL activé.)

Comptes seed : `admin` / `admin` — **changer le mot de passe tout de suite**.

### 4. SSL et DNS

- DNS : enregistrement **A** de `stop3mr` vers l’IP du plan Hostinger (souvent déjà là).
- SSL : hPanel → SSL → activer Let’s Encrypt sur `stop3mr.babitechs.com`.

Logs : dashboard du site Node → **Runtime Logs** / **Deployments**. 403 après un redeploy : relancer un Deploy pour régénérer le `.htaccess` (ne pas l’éditer à la main).

## Déploiement production (VPS)

1. **Serveur** : VPS avec Node.js LTS, MySQL 8, Nginx, PM2
2. **Build** : `npm run build`
3. **PM2** : `pm2 start npm --name stop3mr -- start`
4. **Nginx** : reverse proxy vers port 3000 + certificat HTTPS (Certbot)
5. **Sauvegardes** : cron + `mysqldump stop3mr`
6. **Variables** : configurer `.env` avec `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, SMTP

## API principales

| Route | Méthode | Accès | Description |
|-------|---------|-------|-------------|
| `/api/plaques` | GET/POST | Auth | Liste / création plaque |
| `/api/plaques/[numero]` | GET | Auth | Détail plaque (données déchiffrées) |
| `/api/register/[numero]` | GET/POST | Public | Vérification / enregistrement client |
| `/api/export` | GET | Admin | Export xlsx/csv |
| `/api/stats` | GET | Admin | Statistiques et audit |

## Numérotation

Format : `R3M-{SITE}-{AAMMJJ}-{XXXXXX}`

- **R3M** : préfixe marque
- **SITE** : code usine actif (défaut `YP`)
- **AAMMJJ** : date d'enregistrement
- **XXXXXX** : compteur séquentiel (6 chiffres, transaction MySQL)

## Licence

Projet privé — Stop Réfléchissant 3M / Stop 3MR © 2026
