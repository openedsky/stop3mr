import fs from "fs";
import { generateDevisPdf } from "../src/lib/pdf.ts";

async function main() {
  const buf = await generateDevisPdf({
    numero: "DEV-001",
    dateEmission: new Date(),
    statut: "BROUILLON",
    nombrePlaques: 2,
    prixUnitaire: 15000,
    montantHt: 30000,
    montantTtc: 35400,
    tva: 5400,
    client: {
      nom: "Traoré Koné",
      telephone: "+225 07 00 00 00",
      vehicules: ["AB-123-CD", "EF-456-GH"],
      adresse: "Cocody",
      commune: "Cocody",
      ville: "Abidjan",
    },
  });

  fs.writeFileSync("test-devis.pdf", buf);
  console.log("PDF size:", buf.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
