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

## Déploiement production (sans Docker)

1. **Serveur** : VPS avec Node.js LTS, MySQL 8, Nginx, PM2
2. **Build** : `npm run build`
3. **PM2** : `pm2 start npm --name stop3mr -- start`
4. **Nginx** : reverse proxy vers port 3000 + certificat HTTPS (Certbot)
5. **Sauvegardes** : cron + `mysqldump stop3mr`
6. **Variables** : configurer `.env` avec `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, SMTP

Voir le cahier des charges section 5.5 pour le détail complet.

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
