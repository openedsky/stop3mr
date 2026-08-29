# Guide utilisateur — Stop Réfléchissant 3M (Stop 3MR)

**Plateforme de traçabilité, d’authentification et de commercialisation des plaques réfléchissantes.**

Version application : 2.0 · Côte d’Ivoire · août 2026

Ce guide décrit l’utilisation quotidienne de l’application. Il s’adresse aux opérateurs de production, commerciaux / vendeurs, agents de contrôle technique et administrateurs.

---

## 1. À quoi sert l’application ?

Stop 3MR suit chaque plaque de l’usine jusqu’au véhicule :

1. L’usine **fabrique** une plaque et lui attribue un numéro de série et un QR code.
2. Le stock usine est **mis à disposition** d’un commercial (stock vendeur).
3. Le commercial **enregistre la vente** chez un client, dans un centre de contrôle technique.
4. Le client, un agent CT ou tout citoyen peut **scanner le QR** pour vérifier que le produit est authentique.
5. L’administrateur suit les stocks, les ventes, la facturation et les utilisateurs.

Les astérisques rouges (`*`) indiquent un champ obligatoire.

---

## 2. Connexion et compte

### 2.1 Se connecter

1. Ouvrez l’adresse de la plateforme (en local : `http://localhost:3000`).
2. Saisissez votre **identifiant** et votre **mot de passe**.
3. Cliquez sur le bouton de connexion.

Après une connexion réussie, vous arrivez sur l’écran d’accueil de votre rôle.

En cas d’échec répété, l’accès est temporairement bloqué (environ 15 minutes). Contactez un administrateur si vous avez oublié vos identifiants.

### 2.2 Menu compte (en haut à droite)

Cliquez sur votre nom pour accéder à :

| Menu | Usage |
|------|--------|
| **Mon profil** | Consulter vos informations (identifiant, rôle, centre habituel le cas échéant). |
| **Mot de passe** | Changer votre mot de passe. |
| **Mon historique** | Voir vos actions enregistrées (connexions, ventes, etc.). |
| **Déconnexion** | Quitter la session. |

### 2.3 Changer son mot de passe

Chemin : **votre nom → Mot de passe**.

Le nouveau mot de passe doit contenir :

- au moins **12 caractères** ;
- une **majuscule**, une **minuscule** et un **chiffre**.

Vous devez confirmer le mot de passe actuel. Après enregistrement, utilisez le nouveau mot de passe dès la connexion suivante.

Si un administrateur **réinitialise** votre mot de passe, il vous communique un mot de passe temporaire **affiché une seule fois**. Changez-le immédiatement via **Mot de passe**.

La session reste active **4 heures**. Au-delà, reconnectez-vous.

---

## 3. Les quatre rôles

Chaque compte n’a **qu’un rôle**. Le menu et l’écran d’accueil s’adaptent.

| Rôle | Accueil après connexion | Mission principale |
|------|-------------------------|--------------------|
| **Opérateur production** | Tableau de bord | Produire les plaques, imprimer les QR, alimenter le stock vendeur, consulter le catalogue. |
| **Commercial / vendeur** | Nouvelle vente | Gérer ses clients, vendre son stock, suivre ses commissions et faire des rapports. |
| **Agent contrôle technique** | Vérifier une plaque | Contrôler l’authenticité sur site, historiser, signaler une anomalie. |
| **Administrateur** | Tableau de bord | Accès à tous les modules, utilisateurs, usine, centres CT, CRM, exports. |

Un commercial ne voit **que son stock** et **ses ventes**. Un agent CT ne voit **que ses contrôles**.

---

## 4. Cycle de vie d’une plaque

Chaque plaque a un statut :

| Statut | Signification |
|--------|----------------|
| **En stock** | En usine, pas encore attribuée à un vendeur. Vendable par un administrateur. |
| **Affectée** | Dans le stock d’un commercial. Lui seul (ou un admin) peut la vendre. |
| **Vendue** | Liée à une vente. Le QR reste valable pour l’authentification. |

Numéro de série (exemple) : `R3M-YP-260827-000042`

- `R3M` : marque Stop 3MR  
- `YP` : code du site de production (usine)  
- `260827` : date de fabrication (AAMMJJ)  
- `000042` : compteur du jour  

Le QR code imprimé ouvre la page publique de **vérification d’authenticité**.

---

## 5. Opérateur production

Menus : **Accueil**, **Carte**, **Production**.

### 5.1 Produire des plaques et imprimer les QR

Chemin : **Production → Plaques & QR codes**.

1. Choisissez le **produit du catalogue** (obligatoire).
2. Si le produit est une limitation de vitesse, choisissez la **vitesse** (km/h) parmi celles autorisées.
3. Indiquez la **quantité** (1 à 50 par opération).
4. Validez. Le système attribue automatiquement le site d’usine actif et les numéros de série.
5. Un aperçu QR s’affiche pour la dernière plaque du lot.
6. Imprimez le PDF QR (format 2 cm × 2 cm, avec le logo) via le lien PDF de la ligne.

La liste en bas de page permet de **rechercher** un numéro, de **filtrer** par statut et de **paginer**.

### 5.2 Stock produits

Chemin : **Production → Stock produits**.

Vue d’ensemble des quantités par produit et par statut (usine / affecté / vendu), avec alertes de seuil le cas échéant.

### 5.3 Mettre à disposition (stock vendeur)

Chemin : **Production → Mettre à disposition**.

Deux modes :

- **Par lot** : choisir un commercial, un produit, une quantité. Les plaques **en stock** les plus récentes sont affectées.
- **Par séries** : cocher des plaques précises dans la liste (recherche possible).

Le commercial apparaît avec son **code commercial** et le niveau de son stock actuel.

Après affectation, les plaques passent au statut **Affectée**.

### 5.4 Catalogue

Chemin : **Production → Catalogue** (également visible des commerciaux en lecture).

Consultez les produits (code, libellé, dimensions, prix HT, taux de commission, vitesses). Seul l’administrateur peut modifier le catalogue et les images.

### 5.5 Carte

Chemin : **Carte**.

Carte des sites de production et des centres de contrôle technique (localisation). Utile pour vérifier qu’un centre existe bien sur le territoire.

---

## 6. Commercial / vendeur

Menus : **Accueil**, **Ventes**, **Rapports**, **Performances**.

### 6.1 Tableau de bord

Affiche votre stock vendeur (plaques affectées), le nombre de ventes et le montant de commissions.

Raccourcis : nouvelle vente, clients, mon stock, mes commissions.

### 6.2 Clients

Chemin : **Ventes → Clients**.

- Recherche par nom, téléphone, immatriculation, NCC.
- Filtres type de client (particulier / entreprise) et statut FNE.
- **Nouveau client** : au moins **un véhicule** est obligatoire.
- Fiche client : identité, véhicules, historique des ventes, situation financière (facturé / payé / solde) si des factures existent.

**Particulier** : nom, téléphone ivoirien (ex. `07 XX XX XX XX`).  
**Entreprise** : raison sociale obligatoire ; NCC si facturation FNE.

Immatriculation attendue au format ivoirien (ex. `AB-123-CD`).

Les champs sensibles (nom, téléphone, e-mail, etc.) sont protégés côté serveur ; vous les voyez en clair une fois connecté.

### 6.3 Nouvelle vente

Chemin : **Ventes → Nouvelle vente**.

1. Sélectionnez un **client** (recherche dans la liste).
2. Sélectionnez une **plaque de votre stock** (statut Affectée). Vous pouvez coller ou chercher le numéro de série.
3. Indiquez le **centre de contrôle technique** où la commercialisation a lieu (obligatoire pour un commercial). Vous pouvez mémoriser votre centre habituel.
4. Confirmez. Le prix et la commission se calculent d’après le catalogue.

La plaque passe à **Vendue**. Elle ne peut plus être vendue une seconde fois.

Un administrateur peut vendre une plaque encore **en stock** usine (sans passer par l’affectation).

### 6.4 Ventes enregistrées

Chemin : **Ventes → Ventes enregistrées**.

Historique paginé : série, client, centre, date, montant, commission. Filtres dates et centre. Recherche série / client / commercial / centre.

### 6.5 Mon stock

Chemin : **Ventes → Mon stock**.

Plaques qui vous sont affectées et non encore vendues, par produit.

### 6.6 Mes commissions

Chemin : **Ventes → Mes commissions**.

Cumul par période et par produit (quantité, chiffre d’affaires, commission). Les montants sont en **F CFA**.

### 6.7 Rapports de situation

Chemin : **Rapports**.

Un commercial peut déclarer notamment : situation de vente, rupture de stock, incident sur site, autre. Brouillon puis **soumission**. L’administrateur peut marquer le rapport comme **lu**.

### 6.8 Performances

Chemin : **Performances**.

Indicateurs **de votre activité uniquement** (ventes, volume) sur la période choisie.

---

## 7. Agent de contrôle technique

Menus : **Accueil**, **Vérifier**, **Historique**, **Rapports**, **Performances**.

### 7.1 Vérifier une plaque

Chemin : **Vérifier** (ou **Contrôle → Vérifier une plaque** pour un admin).

1. Saisissez le **numéro de série** (tel qu’imprimé ou lu sur le QR).
2. Le système indique si la plaque est connue et propose un résultat (authentique / inconnue).
3. Complétez si besoin l’**immatriculation observée** et des **notes**.
4. Enregistrez le résultat :
   - **Authentique** — produit reconnu ;
   - **Inconnue / non référencée** — numéro absent de la base ;
   - **Contrefaçon suspectée** — à signaler.

Chaque contrôle est horodaté et lié à votre compte.

### 7.2 Historique des contrôles

Chemin : **Historique**.

Liste de **vos** vérifications, filtrable par résultat, dates et recherche (numéro saisi, immatriculation).

### 7.3 Rapports

Types adaptés au terrain : anomalie de contrôle, contrefaçon, incident sur site, autre.

### 7.4 Page publique (sans compte)

Toute personne qui scanne un QR arrive sur une page **Produit authentique Stop 3MR** si le numéro existe, sans se connecter. Cette page ne permet pas d’enregistrer un contrôle métier : seul l’agent CT le fait dans **Vérifier**.

---

## 8. Administrateur

L’administrateur dispose de **tous** les menus : production, ventes, contrôle, CRM, administration, carte.

### 8.1 Statistiques et export

Chemin : **Admin → Statistiques & export**.

Indicateurs globaux (plaques, stock, vendues, taux). Export **Excel** ou **CSV** (données plaques + clients déchiffrés). L’export est limité (quelques fois par heure) et journalisé.

### 8.2 Utilisateurs

Chemin : **Admin → Utilisateurs**.

- Créer un compte : identifiant, prénom, nom, rôle, éventuellement centre CT (obligatoire pour commercial et agent CT).
- Un **mot de passe temporaire** s’affiche **une seule fois** à la création : communiquez-le à l’utilisateur et demandez-lui de le changer.
- Modifier, activer / désactiver, **réinitialiser le mot de passe** (même principe : mot de passe temporaire unique).
- Suppression uniquement si le compte n’a aucune activité (ventes, contrôles, plaques). Sinon : **désactiver**.
- Impossible de désactiver ou supprimer le **dernier administrateur** actif, ni de se désactiver soi-même.

En environnement de démonstration uniquement, un lien peut proposer le CSV des comptes de test. Ce fichier n’est **pas** disponible en production.

### 8.3 Catalogue et commissions

- **Production → Catalogue** : fiches produits, image (PNG/JPG/WEBP, max 4 Mo).
- **Admin → Commissions catalogue** : taux de commission par produit (0 à 100 %).

### 8.4 Site de production (usine)

Chemin : **Admin → Sites de production (usine)**.

Un **seul site actif** à la fois (ex. usine Yopougon, code `YP`). Les anciens codes (historiques) restent en base s’ils figurent encore sur des plaques, mais sont inactifs. On ne peut pas désactiver le dernier site actif.

L’usine n’est **pas** un centre de contrôle technique.

### 8.5 Centres de contrôle technique

Chemin : **Admin → Centres de contrôle technique**.

Fiches des centres (libellé, ville, commune, géolocalisation). Ils sont utilisés à la vente et sur la carte. Un centre inactif n’est plus proposable.

### 8.6 Paramètres QR

Chemin : **Admin → Paramètres QR**.

URL de vérification (localhost / production) utilisée pour générer les QR. Les images QR ne sont plus stockées en base : elles sont **régénérées à l’impression**.

### 8.7 Historique global

Chemin : **Admin → Historique global**.

Journal d’audit de toute la plateforme (connexions, ventes, exports, modifications utilisateurs, etc.).

### 8.8 CRM (facturation)

Menus **CRM** (administrateur uniquement).

#### Clients

Même module que les ventes, avec vue complète.

#### Factures

Chemin : **CRM → Factures**.

- Créer une facture : client, montants HT et TTC (le TTC doit être ≥ HT), TVA, échéance, description.
- Numérotation automatique : `FAC-AAAA-00001`.
- Statuts : brouillon, émise, partiellement payée, payée, annulée.
- PDF imprimable. Lien **Paiement** si un solde reste dû.
- Filtres : statut, impayées, dates, recherche n° / client.

#### Reçus de paiement

Chemin : **CRM → Reçus de paiement**.

- Saisir un encaissement lié à une facture (espèces, virement, chèque, mobile money, autre).
- Le montant ne peut pas dépasser le **solde**.
- Numérotation : `REC-AAAA-00001`.
- La facture passe automatiquement en partiellement payée ou payée.
- PDF du reçu.

#### Situation client

Chemin : **CRM → Situation client**.

Synthèse facturé / payé / solde pour un client donné.

---

## 9. Parcours public (sans connexion)

### 9.1 Vérifier un QR (`/verify/…`)

Page d’authentification officielle : numéro de série, type de produit, date de fabrication, site. Accessible à tous. Un quota de consultations par adresse limite les abus.

### 9.2 Enregistrement client (`/register/…`)

Lien avec **jeton** (fourni à la production). Permet d’associer un client et un véhicule à une plaque encore non vendue. Sans jeton valide, l’accès est refusé. Ce parcours est secondaire par rapport à la **vente back-office**.

---

## 10. Recherche, listes et impressions

- Les tableaux longs sont **paginés** (souvent 20 lignes).
- La recherche porte sur le numéro, le nom, le centre, etc. selon l’écran.
- Les PDF (QR, facture, reçu) s’ouvrent dans un nouvel onglet.
- Les montants s’affichent en **F CFA**.

---

## 11. Bonnes pratiques

- Ne communiquez **jamais** votre mot de passe. L’administrateur ne le connaît pas (il ne voit qu’un temporaire à la création / reset).
- Un commercial ne vend **que** les plaques de son stock affecté.
- Indiquez toujours le **centre CT** réel de la transaction.
- En cas de suspicion de contrefaçon, enregistrez un contrôle **Contrefaçon** et un **rapport**.
- Ne scannez / ne diffusez pas les QR de plaques encore en stock hors circuit officiel.
- Déconnectez-vous sur un poste partagé.

---

## 12. Problèmes fréquents

| Situation | Que faire |
|-----------|-----------|
| Identifiant ou mot de passe refusé | Vérifier la casse ; attendre 15 min après trop d’essais ; demander un reset à l’admin. |
| « Cette plaque n’est pas dans votre stock vendeur » | Demander une affectation à l’opérateur ; vérifier le numéro. |
| « Plaque déjà vendue » | La série a déjà une vente. Chercher dans **Ventes enregistrées**. |
| Centre de contrôle obligatoire | Les commerciaux doivent choisir le centre à chaque vente. |
| TTC refusé à la facture | Le TTC doit être supérieur ou égal au HT. |
| Paiement refusé | Le montant dépasse le solde de la facture, ou la facture est annulée. |
| Aucun site de production | Un administrateur doit activer **un** site usine. |
| QR illisible à l’impression | Réimprimer le PDF depuis la liste des plaques (régénération automatique). |
| Page « Accès refusé » / redirection | Votre rôle n’a pas droit à cet écran. Utilisez le menu de votre profil. |

Pour toute anomalie technique (page blanche, erreur serveur), notez l’heure, l’écran et le numéro de série concerné, puis contactez l’équipe technique.
