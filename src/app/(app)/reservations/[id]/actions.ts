"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { nextNumber } from "@/lib/sequence";

const ALLOWED: Record<string, ReservationStatus[]> = {
  QUOTE: ["PENDING", "CONFIRMED", "CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
};

export async function setStatus(fd: FormData) {
  const s = await requireSession();
  const id = String(fd.get("id") ?? "");
  const next = String(fd.get("status") ?? "") as ReservationStatus;

  const r = await db.reservation.findFirst({ where: { id, companyId: s.companyId } });
  if (!r || !(ALLOWED[r.status] ?? []).includes(next)) return;

  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { status: next } });
    if (r.vehicleId) {
      if (next === "IN_PROGRESS") await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "RENTED" } });
      if (next === "COMPLETED" || next === "CANCELLED")
        await tx.vehicle.updateMany({ where: { id: r.vehicleId, status: "RENTED" }, data: { status: "AVAILABLE" } });
    }
    await tx.auditLog.create({
      data: { companyId: s.companyId, userId: s.userId, action: `status:${next}`, entity: "Reservation", entityId: id },
    });
  });
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
}

export async function generateContract(fd: FormData) {
  const s = await requireSession();
  const id = String(fd.get("id") ?? "");
  const r = await db.reservation.findFirst({ where: { id, companyId: s.companyId }, include: { contract: true } });
  if (!r) return;
  if (!r.contract) {
    await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, s.companyId, "contract");
      await tx.contract.create({ data: { companyId: s.companyId, reservationId: id, number, language: "fr" } });
    });
  }
  redirect(`/contract/${id}`);
}
