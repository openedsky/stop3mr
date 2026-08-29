import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { mapVehiculeInput, VehiculePayload } from "./vehicules";

export async function syncClientVehicules(clientId: number, vehicules: VehiculePayload[]) {
  const existing = await prisma.vehicule.findMany({ where: { clientId, actif: true } });
  const incomingIds = new Set(vehicules.filter((v) => v.id).map((v) => v.id!));

  for (const old of existing) {
    if (!incomingIds.has(old.id)) {
      const hasVentes = await prisma.vente.count({ where: { vehiculeId: old.id } });
      if (hasVentes > 0) {
        await prisma.vehicule.update({ where: { id: old.id }, data: { actif: false } });
      } else {
        await prisma.vehicule.delete({ where: { id: old.id } });
      }
    }
  }

  for (const v of vehicules) {
    const data = mapVehiculeInput(v);
    if (v.id) {
      const owned = await prisma.vehicule.findFirst({ where: { id: v.id, clientId } });
      if (owned) {
        await prisma.vehicule.update({ where: { id: v.id }, data });
      }
    } else {
      await prisma.vehicule.create({ data: { ...data, clientId } });
    }
  }
}

export async function findOrCreateVehiculeForClient(
  tx: Prisma.TransactionClient,
  clientId: number,
  vehicule: VehiculePayload
) {
  const immat = mapVehiculeInput(vehicule).immatriculation;
  const existing = await tx.vehicule.findUnique({ where: { immatriculation: immat } });

  if (existing) {
    if (existing.clientId !== clientId) {
      throw new Error("IMMAT_OTHER_CLIENT");
    }
    return existing;
  }

  return tx.vehicule.create({
    data: { ...mapVehiculeInput(vehicule), clientId },
  });
}

export async function createClientVehicules(clientId: number, vehicules: VehiculePayload[]) {
  for (const v of vehicules) {
    await prisma.vehicule.create({
      data: { ...mapVehiculeInput(v), clientId },
    });
  }
}
