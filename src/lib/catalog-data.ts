export type CatalogProduitSeed = {
  code: string;
  libelle: string;
  description: string;
  famille: "LIMITATION" | "PLAQUE_ROUGE" | "PLAQUE_BLANCHE" | "BANDES_ROUGE_JAUNE" | "BANDES_ROUGE_BLANC";
  dimensions: string;
  visibilite: string;
  prixHt: number;
  commissionTaux: number;
  usagePrincipal: string;
  vitessesDisponibles: string | null;
  barre: boolean;
  imagePath: string;
  ordre: number;
};

const USAGE_VL = "Véhicules / Poids lourds / mini-bus / engins";
const VITESSES = "50,60,70,75,80,85,90";

export const CATALOGUE_PRODUITS: CatalogProduitSeed[] = [
  {
    code: "LIM-GRIS-BARRE",
    libelle: "Limitation réfléchissante — fond gris, bordure rouge barrée",
    description:
      "Disque de limitation de vitesse, fond gris réfléchissant, bordure rouge et barre diagonale. Chiffres noirs. Vitesses : 50, 60, 70, 75, 80, 85, 90 km/h.",
    famille: "LIMITATION",
    dimensions: "18 × 18 cm",
    visibilite: "~ 120 m",
    prixHt: 1000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: VITESSES,
    barre: true,
    imagePath: "/catalogue/lim-gris-barre.png",
    ordre: 10,
  },
  {
    code: "LIM-GRIS",
    libelle: "Limitation réfléchissante — fond gris, bordure rouge",
    description:
      "Disque de limitation de vitesse, fond gris réfléchissant, bordure rouge sans barre. Chiffres noirs. Vitesses : 50, 60, 70, 75, 80, 85, 90 km/h.",
    famille: "LIMITATION",
    dimensions: "18 × 18 cm",
    visibilite: "~ 120 m",
    prixHt: 1000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: VITESSES,
    barre: false,
    imagePath: "/catalogue/lim-gris.png",
    ordre: 20,
  },
  {
    code: "LIM-JAUNE-BARRE",
    libelle: "Limitation réfléchissante — fond jaune, bordure rouge barrée",
    description:
      "Disque de limitation de vitesse, fond jaune réfléchissant, bordure rouge et barre diagonale. Chiffres noirs. Vitesses : 50, 60, 70, 75, 80, 85, 90 km/h.",
    famille: "LIMITATION",
    dimensions: "18 × 18 cm",
    visibilite: "~ 120 m",
    prixHt: 1000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: VITESSES,
    barre: true,
    imagePath: "/catalogue/lim-jaune-barre.png",
    ordre: 30,
  },
  {
    code: "ROUGE-1240",
    libelle: "Plaque réfléchissante rouge 12 × 40 cm",
    description: "Bande réfléchissante rouge de haute visibilité, marquage STOP intégré au film.",
    famille: "PLAQUE_ROUGE",
    dimensions: "12 × 40 cm",
    visibilite: "120-150 m",
    prixHt: 3000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/plaque-rouge.png",
    ordre: 40,
  },
  {
    code: "ROUGE-1220",
    libelle: "Plaque réfléchissante rouge 12 × 20 cm",
    description: "Bande réfléchissante rouge compacte, marquage STOP intégré au film.",
    famille: "PLAQUE_ROUGE",
    dimensions: "12 × 20 cm",
    visibilite: "120-150 m",
    prixHt: 1500,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/plaque-rouge.png",
    ordre: 50,
  },
  {
    code: "BLANC-1240",
    libelle: "Plaque réfléchissante blanche 12 × 40 cm",
    description: "Bande réfléchissante blanche de haute visibilité pour véhicules et engins.",
    famille: "PLAQUE_BLANCHE",
    dimensions: "12 × 40 cm",
    visibilite: "120-150 m",
    prixHt: 3000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/plaque-blanche.png",
    ordre: 60,
  },
  {
    code: "BAND-RJ-1353",
    libelle: "Plaque à bandes rouge / jaune 13 × 53 cm",
    description: "Marquage chevrons rouge et jaune, visibilité longue distance.",
    famille: "BANDES_ROUGE_JAUNE",
    dimensions: "13 × 53 cm",
    visibilite: "200-250 m",
    prixHt: 5000,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/bandes.png",
    ordre: 70,
  },
  {
    code: "BAND-RJ-6526",
    libelle: "Plaque à bandes rouge / jaune 6,5 × 26,5 cm",
    description: "Format compact chevrons rouge et jaune.",
    famille: "BANDES_ROUGE_JAUNE",
    dimensions: "6,5 × 26,5 cm",
    visibilite: "200-250 m",
    prixHt: 2500,
    commissionTaux: 10,
    usagePrincipal: USAGE_VL,
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/bandes.png",
    ordre: 80,
  },
  {
    code: "BAND-RB-1353",
    libelle: "Plaque à bandes rouge / blanc 13 × 53 cm",
    description: "Marquage chevrons rouge et blanc, visibilité longue distance.",
    famille: "BANDES_ROUGE_BLANC",
    dimensions: "13 × 53 cm",
    visibilite: "200-250 m",
    prixHt: 5000,
    commissionTaux: 10,
    usagePrincipal: "Véhicules / engins",
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/bandes.png",
    ordre: 90,
  },
  {
    code: "BAND-RB-6526",
    libelle: "Plaque à bandes rouge / blanc 6,5 × 26,5 cm",
    description: "Format compact chevrons rouge et blanc.",
    famille: "BANDES_ROUGE_BLANC",
    dimensions: "6,5 × 26,5 cm",
    visibilite: "200-250 m",
    prixHt: 2500,
    commissionTaux: 10,
    usagePrincipal: "Véhicules / engins",
    vitessesDisponibles: null,
    barre: false,
    imagePath: "/catalogue/bandes.png",
    ordre: 100,
  },
];
