import { AppRole } from "@/lib/roles";

export type MenuChild = {
  label: string;
  href: string;
  dividerBefore?: boolean;
};

export type MenuItem = {
  label: string;
  href?: string;
  align?: "left" | "right";
  children?: MenuChild[];
};

const accueil: MenuItem = { label: "Accueil", href: "/dashboard" };
const carte: MenuItem = { label: "Carte", href: "/carte" };

const production: MenuItem = {
  label: "Production",
  children: [
    { label: "Plaques & QR codes", href: "/operator" },
    { label: "Stock produits", href: "/production/stock" },
    { label: "Mettre à disposition", href: "/production/affectation" },
    { label: "Catalogue", href: "/catalogue", dividerBefore: true },
  ],
};

const ventesAdmin: MenuItem = {
  label: "Ventes",
  children: [
    { label: "Clients", href: "/clients" },
    { label: "Nouvelle vente", href: "/ventes/nouvelle" },
    { label: "Vente directe (sans commission)", href: "/ventes/nouvelle?canal=DIRECTE" },
    { label: "Ventes enregistrées", href: "/ventes" },
    { label: "Commissions", href: "/ventes/commissions" },
    { label: "Stock des vendeurs", href: "/commercial/stock", dividerBefore: true },
  ],
};

const ventesCommercial: MenuItem = {
  label: "Ventes",
  children: [
    { label: "Clients", href: "/clients" },
    { label: "Nouvelle vente", href: "/ventes/nouvelle" },
    { label: "Ventes enregistrées", href: "/ventes" },
    { label: "Mon stock", href: "/commercial/stock" },
    { label: "Mes commissions", href: "/ventes/commissions" },
    { label: "Catalogue", href: "/catalogue", dividerBefore: true },
  ],
};

const controle: MenuItem = {
  label: "Contrôle",
  children: [
    { label: "Vérifier une plaque", href: "/controle/verification" },
    { label: "Historique des contrôles", href: "/controle/historique" },
    { label: "Commissions contrôleurs", href: "/controle/commissions" },
  ],
};

const crm: MenuItem = {
  label: "CRM",
  children: [
    { label: "Clients", href: "/clients" },
    { label: "Factures", href: "/crm/factures" },
    { label: "Reçus de paiement", href: "/crm/recus" },
    { label: "Situation client", href: "/crm/situation" },
  ],
};

const administration: MenuItem = {
  label: "Admin",
  align: "right",
  children: [
    { label: "Statistiques & export", href: "/admin" },
    { label: "Performances", href: "/performances" },
    { label: "Rapports de situation", href: "/rapports" },
    { label: "Utilisateurs", href: "/admin/utilisateurs" },
    { label: "Commissions & validité", href: "/admin/commissions" },
    { label: "Paiement des commissions", href: "/admin/paiements-commissions" },
    { label: "Plaques expirées", href: "/admin/expirations" },
    { label: "Sites de production (usine)", href: "/admin/sites" },
    { label: "Centres de contrôle technique", href: "/admin/centres" },
    { label: "Historique global", href: "/admin/historique" },
    { label: "Paramètres QR", href: "/admin/parametres" },
  ],
};

export const ACCOUNT_LINKS: MenuChild[] = [
  { label: "Mon profil", href: "/profile" },
  { label: "Mot de passe", href: "/profile/mot-de-passe" },
  { label: "Mon historique", href: "/profile/historique" },
];

export function menuForRole(role: AppRole): MenuItem[] {
  switch (role) {
    case "AGENT_CT":
      return [
        accueil,
        { label: "Vérifier", href: "/controle/verification" },
        { label: "Historique", href: "/controle/historique" },
        { label: "Mes commissions", href: "/controle/commissions" },
        { label: "Rapports", href: "/rapports" },
        { label: "Performances", href: "/performances" },
      ];
    case "COMMERCIAL":
      return [
        accueil,
        ventesCommercial,
        { label: "Rapports", href: "/rapports" },
        { label: "Performances", href: "/performances" },
      ];
    case "OPERATEUR":
      return [accueil, carte, production];
    case "ADMINISTRATEUR":
      return [accueil, carte, production, ventesAdmin, controle, crm, administration];
    default:
      return [accueil];
  }
}

const EXACT_HREFS = new Set([
  "/admin",
  "/dashboard",
  "/ventes",
  "/profile",
  "/controle/verification",
  "/controle/historique",
]);

export function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (EXACT_HREFS.has(href)) return false;
  return pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname: string, item: MenuItem) {
  if (item.href) return isNavActive(pathname, item.href);
  return item.children?.some((child) => isNavActive(pathname, child.href)) ?? false;
}
