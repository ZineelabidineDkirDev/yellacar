"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ACTIVE, withBuffer } from "@/lib/availability";
import { priceRental } from "@/lib/pricing";
import { nextNumber } from "@/lib/sequence";

export async function createReservation(fd: FormData) {
  const s = await requireSession();
  const pickupRaw = String(fd.get("pickup") ?? "");
  const returnRaw = String(fd.get("return") ?? "");
  const back = (error: string) =>
    `/reservations/new?pickup=${encodeURIComponent(pickupRaw)}&return=${encodeURIComponent(returnRaw)}&error=${error}`;

  const pickupAt = new Date(pickupRaw);
  const returnAt = new Date(returnRaw);
  if (isNaN(pickupAt.getTime()) || isNaN(returnAt.getTime()) || returnAt <= pickupAt) redirect(back("dates"));

  const vehicleId = String(fd.get("vehicleId") ?? "");
  const customerId = String(fd.get("customerId") ?? "");
  if (!vehicleId || !customerId) redirect(back("missing"));

  const [company, vehicle, customer] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: s.companyId } }),
    db.vehicle.findFirst({
      where: { id: vehicleId, companyId: s.companyId },
      include: { category: { include: { rates: { include: { season: true } } } } },
    }),
    db.customer.findFirst({ where: { id: customerId, companyId: s.companyId } }),
  ]);
  if (!vehicle || !customer) redirect(back("missing"));
  if (customer.status === "BLACKLISTED") redirect(back("blacklisted"));

  const protectionId = String(fd.get("protectionId") ?? "") || null;
  const protection = protectionId
    ? await db.protection.findFirst({ where: { id: protectionId, companyId: s.companyId } })
    : null;

  const allOptions = await db.rentalOption.findMany({ where: { companyId: s.companyId, isActive: true } });
  const chosen = allOptions
    .map((o) => ({ o, qty: Math.min(o.maxQty, Math.max(0, Number(fd.get(`opt_${o.id}`) ?? 0) || 0)) }))
    .filter((x) => x.qty > 0);

  const price = priceRental({
    category: vehicle.category,
    rates: vehicle.category.rates,
    pickup: pickupAt,
    ret: returnAt,
    options: chosen.map((x) => ({ price: Number(x.o.price), perDay: x.o.priceType === "PER_DAY", qty: x.qty })),
    protectionPerDay: protection ? Number(protection.pricePerDay) : 0,
    taxRate: Number(company.taxRate),
    pricesIncludeTax: company.pricesIncludeTax,
  });

  const deposit = protection?.deposit ?? vehicle.category.defaultDeposit ?? null;
  const { from, to } = withBuffer(pickupAt, returnAt);

  const result = await db.$transaction(async (tx) => {
    const conflict = await tx.reservation.findFirst({
      where: { vehicleId, status: { in: ACTIVE }, pickupAt: { lt: to }, returnAt: { gt: from } },
    });
    if (conflict) return { error: "conflict" as const };

    const number = await nextNumber(tx, s.companyId, fd.get("asQuote") ? "quote" : "reservation");
    const r = await tx.reservation.create({
      data: {
        companyId: s.companyId,
        number,
        customerId,
        vehicleId,
        categoryId: vehicle.categoryId,
        protectionId: protection?.id ?? null,
        createdById: s.userId,
        status: fd.get("asQuote") ? "QUOTE" : "PENDING",
        pickupAt,
        returnAt,
        pickupBranchId: vehicle.branchId,
        returnBranchId: vehicle.branchId,
        dailyRate: price.avgDailyRate,
        days: price.days,
        subtotal: price.subtotal,
        taxAmount: price.taxAmount,
        total: price.total,
        depositAmount: deposit,
        source: String(fd.get("source") ?? "") || null,
        notes: String(fd.get("notes") ?? "") || null,
        options: {
          create: chosen.map((x) => ({ optionId: x.o.id, quantity: x.qty, unitPrice: x.o.price })),
        },
      },
    });
    await tx.auditLog.create({
      data: { companyId: s.companyId, userId: s.userId, action: "create", entity: "Reservation", entityId: r.id },
    });
    return { id: r.id };
  });

  if ("error" in result) redirect(back("conflict"));
  redirect(`/reservations/${result.id}`);
}
