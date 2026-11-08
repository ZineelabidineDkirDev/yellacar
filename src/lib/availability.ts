import type { ReservationStatus } from "@prisma/client";
import { db } from "./db";
import { PREP_MINUTES } from "./pricing";

export const ACTIVE: ReservationStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

export function withBuffer(pickup: Date, ret: Date) {
  const ms = PREP_MINUTES * 60_000;
  return { from: new Date(pickup.getTime() - ms), to: new Date(ret.getTime() + ms) };
}

export async function availableVehicles(companyId: string, pickup: Date, ret: Date, categoryId?: string) {
  const { from, to } = withBuffer(pickup, ret);
  return db.vehicle.findMany({
    where: {
      companyId,
      ...(categoryId ? { categoryId } : {}),
      status: { notIn: ["MAINTENANCE", "BLOCKED"] },
      reservations: {
        none: { status: { in: ACTIVE }, pickupAt: { lt: to }, returnAt: { gt: from } },
      },
    },
    include: { category: { include: { rates: { include: { season: true } } } } },
    orderBy: [{ categoryId: "asc" }, { plate: "asc" }],
  });
}
