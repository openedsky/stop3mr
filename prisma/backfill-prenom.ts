/**
 * Ajoute la colonne prenom + table rapports si besoin, puis remplit les prénoms.
 * Usage : npx tsx prisma/backfill-prenom.ts
 */
import { PrismaClient } from "@prisma/client";
import { identitePersonne } from "../src/lib/territoire";

const prisma = new PrismaClient();

const DEMOS: Record<string, { prenom: string; nom: string }> = {
  admin: { prenom: "Jean", nom: "Kouassi" },
  operateur: { prenom: "Koffi", nom: "N'Guessan" },
  commercial: { prenom: "Kouadio", nom: "Yao" },
  agentct: { prenom: "Awa", nom: "Traoré" },
};

function splitNom(nom: string | null): { prenom: string; nom: string } {
  if (!nom?.trim()) return { prenom: "Utilisateur", nom: "Sans nom" };
  const cleaned = nom.replace(/\s+[—-]\s+.+$/, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { prenom: parts[0], nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

async function ensureSchema() {
  const cols = await prisma.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM utilisateurs");
  if (!cols.some((c) => c.Field === "prenom")) {
    await prisma.$executeRawUnsafe("ALTER TABLE utilisateurs ADD COLUMN prenom VARCHAR(100) NULL AFTER role");
    console.log("Colonne utilisateurs.prenom ajoutée");
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rapports (
      id INT NOT NULL AUTO_INCREMENT,
      auteur_id INT NOT NULL,
      centre_id INT NULL,
      type ENUM('SITUATION_VENTE','RUPTURE_STOCK','ANOMALIE_CONTROLE','CONTREFACON','INCIDENT_SITE','AUTRE') NOT NULL,
      statut ENUM('BROUILLON','SOUMIS','LU') NOT NULL DEFAULT 'SOUMIS',
      titre VARCHAR(200) NOT NULL,
      contenu TEXT NOT NULL,
      periode_debut DATETIME(3) NULL,
      periode_fin DATETIME(3) NULL,
      cree_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      mis_a_jour_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX (auteur_id),
      INDEX (centre_id),
      INDEX (cree_le),
      CONSTRAINT rapports_auteur_fk FOREIGN KEY (auteur_id) REFERENCES utilisateurs(id),
      CONSTRAINT rapports_centre_fk FOREIGN KEY (centre_id) REFERENCES centres_controle(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function main() {
  await ensureSchema();

  const users = await prisma.utilisateur.findMany({
    select: { id: true, identifiant: true, prenom: true, nom: true },
  });

  let updated = 0;
  const ops: Array<{ id: number; prenom: string; nom: string }> = [];

  for (const user of users) {
    let prenom = user.prenom?.trim() || "";
    let nom = user.nom?.trim() || "";

    const demo = DEMOS[user.identifiant];
    if (demo) {
      prenom = demo.prenom;
      nom = demo.nom;
    } else {
      const match = user.identifiant.match(/^(vendeur|agent)\.(\d+)$/);
      if (match) {
        const identite = identitePersonne(Number(match[2]) - 1, match[1] as "vendeur" | "agent");
        prenom = identite.prenom;
        nom = identite.nom;
      } else if (!prenom) {
        const split = splitNom(user.nom);
        prenom = split.prenom;
        nom = split.nom;
      } else if (nom.includes("—") || nom.includes(" - ")) {
        const split = splitNom(user.nom);
        nom = split.nom;
        if (!prenom) prenom = split.prenom;
      }
    }

    if (prenom === user.prenom && nom === user.nom) continue;
    ops.push({ id: user.id, prenom, nom });
  }

  for (let i = 0; i < ops.length; i += 80) {
    const batch = ops.slice(i, i + 80);
    await prisma.$transaction(
      batch.map((row) =>
        prisma.utilisateur.update({
          where: { id: row.id },
          data: { prenom: row.prenom, nom: row.nom },
        })
      )
    );
    updated += batch.length;
    console.log(`  ${updated} / ${ops.length}`);
  }

  console.log(`Prénoms mis à jour : ${updated} / ${users.length} utilisateurs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
