/**
 * Jeu de données de démonstration Stop 3MR
 * Usage : npm run db:seed:demo
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { encryptClientData, ClientPayload } from "../src/lib/clients";
import { figerValiditeVente } from "../src/lib/validite";
import { figerTarifVente } from "../src/lib/tarif";

const prisma = new PrismaClient();

const DEMO_IMMATS = [
  "AB-123-CD",
  "AB-124-CD",
  "EF-456-GH",
  "GH-789-IJ",
  "GH-790-IJ",
  "GH-791-IJ",
  "KL-012-MN",
  "KL-013-MN",
  "OP-345-QR",
  "ST-001-CI",
  "ST-002-CI",
  "ST-003-CI",
] as const;

const DEMO_PLAQUE_SERIES = [
  "R3M-PR-250823-900001",
  "R3M-PR-250823-900002",
  "R3M-PR-250823-900003",
  "R3M-YK-250823-900004",
  "R3M-YK-250823-900005",
  "R3M-YK-250823-900006",
  "R3M-BK-250823-900007",
  "R3M-BK-250823-900008",
  "R3M-PR-250823-900009",
  "R3M-PR-250823-900010",
  "R3M-YK-250823-900011",
  "R3M-YK-250823-900012",
  "R3M-BK-250823-900013",
  "R3M-PR-250823-900014",
  "R3M-PR-250823-900015",
  "R3M-YK-250823-900016",
  "R3M-BK-250823-900017",
  "R3M-PR-250823-900018",
  "R3M-YK-250823-900019",
  "R3M-BK-250823-900020",
] as const;

const DEMO_FACTURE_NUMEROS = ["FAC-2026-90001", "FAC-2026-90002", "FAC-2026-90003", "FAC-2026-90004"] as const;
const DEMO_RECU_NUMEROS = ["REC-2026-90001", "REC-2026-90002", "REC-2026-90003"] as const;

const PLACEHOLDER_QR =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#f1f5f9" width="200" height="200"/><text x="100" y="100" text-anchor="middle" font-size="14" fill="#64748b">DEMO QR</text></svg>'
  );

const CLIENTS_DEMO: ClientPayload[] = [
  {
    typeClient: "PARTICULIER",
    nom: "Kouassi Jean-Baptiste",
    telephone: "0701020304",
    email: "kouassi.jb@email.ci",
    adresse: "Rue des Jardins, Cocody Angré",
    commune: "Cocody",
    ville: "Abidjan",
    typePieceIdentite: "CNI",
    numeroPieceIdentite: "CI001234567",
    fneStatut: "NON_APPLICABLE",
  },
  {
    typeClient: "PARTICULIER",
    nom: "Traoré Aminata",
    telephone: "0505060708",
    email: "aminata.traore@gmail.com",
    adresse: "Quartier Selmer, Yopougon",
    commune: "Yopougon",
    ville: "Abidjan",
    typePieceIdentite: "CNI",
    numeroPieceIdentite: "CI009876543",
    fneStatut: "NON_APPLICABLE",
  },
  {
    typeClient: "ENTREPRISE",
    nom: "Moussa Koné",
    raisonSociale: "Transport Koné SARL",
    telephone: "0102030405",
    email: "contact@transport-kone.ci",
    ncc: "CI-NCC-78452",
    rccm: "CI-ABJ-2020-B-12345",
    adresse: "Zone industrielle, Vridi",
    commune: "Port-Bouët",
    ville: "Abidjan",
    fneStatut: "VALIDE",
    fneReference: "FNE-2026-004521",
  },
  {
    typeClient: "ENTREPRISE",
    nom: "Ibrahim Diallo",
    raisonSociale: "BTP Diallo & Fils",
    telephone: "0708091011",
    email: "compta@btp-diallo.ci",
    ncc: "CI-NCC-33210",
    rccm: "CI-ABJ-2018-B-98765",
    adresse: "Boulevard Latrille, Deux-Plateaux",
    commune: "Cocody",
    ville: "Abidjan",
    fneStatut: "EN_ATTENTE",
  },
  {
    typeClient: "PARTICULIER",
    nom: "N'Guessan Paul",
    telephone: "0755443322",
    adresse: "Quartier Air France",
    commune: "Centre",
    ville: "Bouaké",
    typePieceIdentite: "CNI",
    numeroPieceIdentite: "CI004433221",
    fneStatut: "NON_APPLICABLE",
  },
  {
    typeClient: "ENTREPRISE",
    nom: "Directeur Parc SOTRA",
    raisonSociale: "SOTRA — Société des Transports Abidjanais",
    telephone: "2722240505",
    email: "parc.auto@sotra.ci",
    ncc: "CI-NCC-00100",
    rccm: "CI-ABJ-1960-B-00001",
    adresse: "Adjamé gare routière",
    commune: "Adjamé",
    ville: "Abidjan",
    fneStatut: "SOUMIS",
    fneReference: "FNE-2026-001122",
  },
];

const VEHICULES_DEMO: Array<Array<{ immatriculation: string; marqueVehicule: string; modeleVehicule: string }>> = [
  [
    { immatriculation: "AB-123-CD", marqueVehicule: "Toyota", modeleVehicule: "Corolla" },
    { immatriculation: "AB-124-CD", marqueVehicule: "Toyota", modeleVehicule: "RAV4" },
  ],
  [{ immatriculation: "EF-456-GH", marqueVehicule: "Hyundai", modeleVehicule: "Tucson" }],
  [
    { immatriculation: "GH-789-IJ", marqueVehicule: "Mercedes", modeleVehicule: "Actros" },
    { immatriculation: "GH-790-IJ", marqueVehicule: "Mercedes", modeleVehicule: "Actros" },
    { immatriculation: "GH-791-IJ", marqueVehicule: "Volvo", modeleVehicule: "FH" },
  ],
  [
    { immatriculation: "KL-012-MN", marqueVehicule: "Isuzu", modeleVehicule: "NQR" },
    { immatriculation: "KL-013-MN", marqueVehicule: "Renault", modeleVehicule: "Kerax" },
  ],
  [{ immatriculation: "OP-345-QR", marqueVehicule: "Peugeot", modeleVehicule: "301" }],
  [
    { immatriculation: "ST-001-CI", marqueVehicule: "Iveco", modeleVehicule: "Crossway" },
    { immatriculation: "ST-002-CI", marqueVehicule: "Iveco", modeleVehicule: "Crossway" },
    { immatriculation: "ST-003-CI", marqueVehicule: "Mercedes", modeleVehicule: "Citaro" },
  ],
];

async function cleanupDemoData() {
  await prisma.recuPaiement.deleteMany({ where: { numero: { in: [...DEMO_RECU_NUMEROS] } } });
  await prisma.facture.deleteMany({ where: { numero: { in: [...DEMO_FACTURE_NUMEROS] } } });

  const demoVehicules = await prisma.vehicule.findMany({
    where: { immatriculation: { in: [...DEMO_IMMATS] } },
    select: { clientId: true },
  });
  const clientIds = [...new Set(demoVehicules.map((v) => v.clientId))];

  if (clientIds.length) {
    const ventes = await prisma.vente.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    await prisma.recuPaiement.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.facture.deleteMany({ where: { OR: [{ clientId: { in: clientIds } }, { venteId: { in: ventes.map((v) => v.id) } }] } });
    await prisma.vente.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  }

  const demoPlaques = await prisma.plaque.findMany({
    where: { numeroSerie: { in: [...DEMO_PLAQUE_SERIES] } },
    select: { id: true },
  });
  if (demoPlaques.length) {
    await prisma.vente.deleteMany({ where: { plaqueId: { in: demoPlaques.map((p) => p.id) } } });
    await prisma.plaque.deleteMany({ where: { id: { in: demoPlaques.map((p) => p.id) } } });
  }
  console.log("  Données DEMO précédentes supprimées.");
}

async function main() {
  console.log("=== Seed données de démonstration Stop 3MR ===\n");

  const admin = await prisma.utilisateur.findUnique({ where: { identifiant: "admin" } });
  const operateur = await prisma.utilisateur.findUnique({ where: { identifiant: "operateur" } });
  if (!admin || !operateur) {
    console.error("Exécutez d'abord : npm run db:seed");
    process.exit(1);
  }

  await cleanupDemoData();

  const clients = [];
  const vehiculeByImmat = new Map<string, { id: number; clientId: number }>();

  for (let i = 0; i < CLIENTS_DEMO.length; i++) {
    const client = await prisma.client.create({
      data: { ...encryptClientData(CLIENTS_DEMO[i]), createurId: operateur.id },
    });
    clients.push(client);

    for (const v of VEHICULES_DEMO[i]) {
      const vehicule = await prisma.vehicule.create({
        data: {
          clientId: client.id,
          immatriculation: v.immatriculation,
          marqueVehicule: v.marqueVehicule,
          modeleVehicule: v.modeleVehicule,
        },
      });
      vehiculeByImmat.set(v.immatriculation, { id: vehicule.id, clientId: client.id });
    }
  }

  const [kouassi, traore, transportKone, btpDiallo] = clients;
  const rouge = await prisma.produit.findUnique({ where: { code: "ROUGE-1240" } });
  const lim = await prisma.produit.findUnique({ where: { code: "LIM-GRIS-BARRE" } });

  const plaqueDefs: Array<{
    numero: (typeof DEMO_PLAQUE_SERIES)[number];
    site: string;
    type: "STOP" | "LIMITATION_VITESSE";
    statut: "EN_STOCK" | "VENDUE";
    vehiculeImmat?: string;
    daysAgo?: number;
  }> = [
    { numero: "R3M-PR-250823-900001", site: "PR", type: "STOP", statut: "VENDUE", vehiculeImmat: "AB-123-CD", daysAgo: 30 },
    { numero: "R3M-PR-250823-900002", site: "PR", type: "STOP", statut: "VENDUE", vehiculeImmat: "EF-456-GH", daysAgo: 25 },
    { numero: "R3M-PR-250823-900003", site: "PR", type: "LIMITATION_VITESSE", statut: "VENDUE", vehiculeImmat: "GH-789-IJ", daysAgo: 20 },
    { numero: "R3M-YK-250823-900004", site: "YK", type: "STOP", statut: "VENDUE", vehiculeImmat: "GH-790-IJ", daysAgo: 18 },
    { numero: "R3M-YK-250823-900005", site: "YK", type: "STOP", statut: "VENDUE", vehiculeImmat: "KL-012-MN", daysAgo: 15 },
    { numero: "R3M-YK-250823-900006", site: "YK", type: "LIMITATION_VITESSE", statut: "VENDUE", vehiculeImmat: "OP-345-QR", daysAgo: 10 },
    { numero: "R3M-BK-250823-900007", site: "BK", type: "STOP", statut: "VENDUE", vehiculeImmat: "AB-124-CD", daysAgo: 8 },
    { numero: "R3M-BK-250823-900008", site: "BK", type: "STOP", statut: "VENDUE", vehiculeImmat: "ST-001-CI", daysAgo: 5 },
    { numero: "R3M-PR-250823-900009", site: "PR", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-PR-250823-900010", site: "PR", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-YK-250823-900011", site: "YK", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-YK-250823-900012", site: "YK", type: "LIMITATION_VITESSE", statut: "EN_STOCK" },
    { numero: "R3M-BK-250823-900013", site: "BK", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-PR-250823-900014", site: "PR", type: "LIMITATION_VITESSE", statut: "EN_STOCK" },
    { numero: "R3M-PR-250823-900015", site: "PR", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-YK-250823-900016", site: "YK", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-BK-250823-900017", site: "BK", type: "LIMITATION_VITESSE", statut: "EN_STOCK" },
    { numero: "R3M-PR-250823-900018", site: "PR", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-YK-250823-900019", site: "YK", type: "STOP", statut: "EN_STOCK" },
    { numero: "R3M-BK-250823-900020", site: "BK", type: "STOP", statut: "EN_STOCK" },
  ];

  const now = new Date();
  const ventesParSerie = new Map<string, { id: number; clientId: number; prixVente: number }>();

  for (const def of plaqueDefs) {
    const fabDate = new Date(now);
    if (def.daysAgo) fabDate.setDate(fabDate.getDate() - def.daysAgo);
    const produit = def.type === "LIMITATION_VITESSE" ? lim : rouge;
    if (!produit) throw new Error(`Produit manquant pour ${def.type}`);
    const prixReference = produit.prixHt;

    const plaque = await prisma.plaque.create({
      data: {
        numeroSerie: def.numero,
        qrCodeData: PLACEHOLDER_QR,
        tokenEnregistrement: randomBytes(32).toString("hex"),
        typeProduit: def.type,
        produitId: produit.id,
        siteProduction: def.site,
        statut: def.statut,
        dateFabrication: fabDate,
        prixReference,
        createurId: operateur.id,
      },
    });

    if (def.statut === "VENDUE" && def.vehiculeImmat) {
      const veh = vehiculeByImmat.get(def.vehiculeImmat)!;
      const venteDate = new Date(fabDate);
      venteDate.setDate(venteDate.getDate() + 1);
      const tarif = figerTarifVente({
        prixCatalogue: produit?.prixHt ?? 0,
        prixReference,
        commissionTauxCatalogue: produit?.commissionTaux ?? 10,
        avecCommission: false,
      });
      const validiteFigee = figerValiditeVente(venteDate, 24);
      const vente = await prisma.vente.create({
        data: {
          plaqueId: plaque.id,
          clientId: veh.clientId,
          vehiculeId: veh.id,
          vendeurId: operateur.id,
          canal: "DIRECTE",
          prixVente: tarif.prixVente,
          commissionTaux: tarif.commissionTaux,
          commissionMontant: tarif.commissionMontant,
          dateVente: venteDate,
          validiteMois: validiteFigee.validiteMois,
          dateExpiration: validiteFigee.dateExpiration,
          alerteExpirationJours: validiteFigee.alerteExpirationJours,
          dateAlerte: validiteFigee.dateAlerte,
        },
      });
      ventesParSerie.set(def.numero, {
        id: vente.id,
        clientId: veh.clientId,
        prixVente: tarif.prixVente,
      });
    }
  }

  type FacDemo = {
    numero: (typeof DEMO_FACTURE_NUMEROS)[number];
    serie: string;
    statut: "PAYEE" | "PARTIELLEMENT_PAYEE" | "EMISE";
    paye?: number;
    clientId: number;
    createurId: number;
  };
  const factureDefs: FacDemo[] = [
    { numero: "FAC-2026-90001", serie: "R3M-PR-250823-900001", statut: "PAYEE", clientId: kouassi.id, createurId: admin.id },
    { numero: "FAC-2026-90002", serie: "R3M-YK-250823-900005", statut: "PARTIELLEMENT_PAYEE", paye: 1500, clientId: btpDiallo.id, createurId: admin.id },
    { numero: "FAC-2026-90003", serie: "R3M-PR-250823-900002", statut: "EMISE", clientId: traore.id, createurId: operateur.id },
    { numero: "FAC-2026-90004", serie: "R3M-PR-250823-900003", statut: "PAYEE", clientId: transportKone.id, createurId: admin.id },
  ];

  const facturesCreees = new Map<string, { id: number; clientId: number; montant: number }>();
  for (const def of factureDefs) {
    const vente = ventesParSerie.get(def.serie);
    if (!vente) continue;
    const montantPaye = def.statut === "PAYEE" ? vente.prixVente : def.paye ?? 0;
    const echeance = new Date(now);
    echeance.setDate(echeance.getDate() + 30);
    const facture = await prisma.facture.create({
      data: {
        numero: def.numero,
        clientId: def.clientId,
        venteId: vente.id,
        montantHt: vente.prixVente,
        montantTtc: vente.prixVente,
        montantPaye,
        tva: 0,
        statut: def.statut,
        dateEcheance: echeance,
        description: `Vente plaque ${def.serie}`,
        createurId: def.createurId,
      },
    });
    facturesCreees.set(def.numero, { id: facture.id, clientId: def.clientId, montant: montantPaye || vente.prixVente });
  }

  let extraFac = 90005;
  for (const [serie, vente] of ventesParSerie) {
    if (factureDefs.some((d) => d.serie === serie)) continue;
    const echeance = new Date(now);
    echeance.setDate(echeance.getDate() + 30);
    await prisma.facture.create({
      data: {
        numero: `FAC-2026-${String(extraFac).padStart(5, "0")}`,
        clientId: vente.clientId,
        venteId: vente.id,
        montantHt: vente.prixVente,
        montantTtc: vente.prixVente,
        montantPaye: 0,
        tva: 0,
        statut: "EMISE",
        dateEcheance: echeance,
        description: `Vente plaque ${serie}`,
        createurId: operateur.id,
      },
    });
    extraFac += 1;
  }

  const payDate1 = new Date(now);
  payDate1.setDate(payDate1.getDate() - 10);
  const payDate2 = new Date(now);
  payDate2.setDate(payDate2.getDate() - 5);
  const recuPayee = facturesCreees.get("FAC-2026-90001");
  const recuPartielle = facturesCreees.get("FAC-2026-90002");
  const recuTransport = facturesCreees.get("FAC-2026-90004");
  const recus = [
    recuPayee && {
      numero: "REC-2026-90001",
      factureId: recuPayee.id,
      clientId: recuPayee.clientId,
      montant: recuPayee.montant,
      modePaiement: "MOBILE_MONEY" as const,
      datePaiement: payDate1,
      reference: "WAVE-7845219034",
      createurId: operateur.id,
    },
    recuPartielle && {
      numero: "REC-2026-90002",
      factureId: recuPartielle.id,
      clientId: recuPartielle.clientId,
      montant: recuPartielle.montant,
      modePaiement: "VIREMENT" as const,
      datePaiement: payDate2,
      reference: "VIR-SGBCI-20260815",
      createurId: admin.id,
    },
    recuTransport && {
      numero: "REC-2026-90003",
      factureId: recuTransport.id,
      clientId: recuTransport.clientId,
      montant: recuTransport.montant,
      modePaiement: "CHEQUE" as const,
      datePaiement: payDate1,
      reference: "CHQ-458712",
      createurId: admin.id,
    },
  ].filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (recus.length) await prisma.recuPaiement.createMany({ data: recus });

  console.log("\n✓ Données DEMO insérées.\n");
  console.log("Clients : 6 avec 12 véhicules au total");
  console.log("  • Kouassi : 2 véhicules (AB-123-CD, AB-124-CD)");
  console.log("  • Transport Koné : 3 camions");
  console.log("  • SOTRA : 3 bus");
  console.log("\nRelancez l'app et testez /clients, /ventes/nouvelle");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
