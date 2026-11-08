"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { nextNumber } from "@/lib/sequence";
import {
  cashTotals, currentCashSession, paidMap, parseAmount, parseMethod, safeReturn, withParam,
} from "@/lib/finance";

// ── Paiements et remboursements ──
export async function recordPayment(fd: FormData) {
  const s = await requireSession();
  const returnTo = safeReturn(fd.get("returnTo"), "/finance/payments");
  const reservationId = String(fd.get("reservationId") ?? "");
  const type = fd.get("type") === "REFUND" ? "REFUND" : "PAYMENT";
  const method = parseMethod(fd.get("method"));
  const amount = parseAmount(fd.get("amount"));
  if (!reservationId || !(amount > 0)) redirect(withParam(returnTo, "error", "amount"));

  const r = await db.reservation.findFirst({ where: { id: reservationId, companyId: s.companyId } });
  if (!r) redirect(withParam(returnTo, "error", "amount"));
  const paid = (await paidMap(s.companyId, [reservationId])).get(reservationId) ?? 0;
  if (type === "PAYMENT" && amount > Number(r.total) - paid + 0.005) redirect(withParam(returnTo, "error", "overpay"));
  if (type === "REFUND" && amount > paid + 0.005) redirect(withParam(returnTo, "error", "refund"));

  const session = method === "CASH" ? await currentCashSession(s.companyId, s.userId) : null;
  await db.$transaction(async (tx) => {
    const receiptNumber = await nextNumber(tx, s.companyId, "receipt");
    const p = await tx.payment.create({
      data: {
        companyId: s.companyId, reservationId, receivedById: s.userId, type, method, amount,
        receiptNumber, cashSessionId: session?.id ?? null,
        reference: String(fd.get("reference") ?? "").trim() || null,
      },
    });
    await tx.auditLog.create({
      data: { companyId: s.companyId, userId: s.userId, action: type === "REFUND" ? "refund" : "payment", entity: "Payment", entityId: p.id },
    });
  });
  revalidatePath("/finance", "layout");
  redirect(returnTo);
}

// ── Caisse ──
export async function openCash(fd: FormData) {
  const s = await requireSession();
  if (await currentCashSession(s.companyId, s.userId)) return;
  const openingFloat = parseAmount(fd.get("openingFloat"));
  await db.cashSession.create({
    data: {
      companyId: s.companyId, openedById: s.userId,
      openingFloat: openingFloat >= 0 ? openingFloat : 0,
      notes: String(fd.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath("/finance/cash");
}

export async function closeCash(fd: FormData) {
  const s = await requireSession();
  const session = await currentCashSession(s.companyId, s.userId);
  const counted = parseAmount(fd.get("countedCash"));
  if (!session || !(counted >= 0)) return;
  const t = await cashTotals(session.id, Number(session.openingFloat));
  await db.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED", closedAt: new Date(), expectedCash: t.expected, countedCash: counted,
      difference: Math.round((counted - t.expected) * 100) / 100,
    },
  });
  revalidatePath("/finance/cash");
}

// ── Cautions ──
export async function recordDeposit(fd: FormData) {
  const s = await requireSession();
  const returnTo = safeReturn(fd.get("returnTo"), "/finance/deposits");
  const reservationId = String(fd.get("reservationId") ?? "");
  const amount = parseAmount(fd.get("amount"));
  const method = parseMethod(fd.get("method"));
  if (!reservationId || !(amount > 0)) redirect(withParam(returnTo, "error", "amount"));
  const r = await db.reservation.findFirst({ where: { id: reservationId, companyId: s.companyId }, include: { deposit: true } });
  if (!r || r.deposit) redirect(withParam(returnTo, "error", "deposit"));
  const session = method === "CASH" ? await currentCashSession(s.companyId, s.userId) : null;
  await db.deposit.create({
    data: { companyId: s.companyId, reservationId, amount, method, receivedSessionId: session?.id ?? null },
  });
  revalidatePath("/finance", "layout");
  redirect(returnTo);
}

export async function settleDeposit(fd: FormData) {
  const s = await requireSession();
  const id = String(fd.get("id") ?? "");
  const retained = parseAmount(fd.get("retained") ?? "0");
  const dep = await db.deposit.findFirst({ where: { id, companyId: s.companyId, status: "HELD" } });
  if (!dep) return;
  const amount = Number(dep.amount);
  const kept = retained >= 0 ? Math.min(retained, amount) : 0;
  const returned = Math.round((amount - kept) * 100) / 100;
  const session = dep.method === "CASH" ? await currentCashSession(s.companyId, s.userId) : null;
  await db.deposit.update({
    where: { id },
    data: {
      status: kept === 0 ? "RETURNED" : kept === amount ? "RETAINED" : "PARTIAL",
      retainedAmount: kept, returnedAmount: returned, closedAt: new Date(),
      reason: String(fd.get("reason") ?? "").trim() || null,
      returnSessionId: session?.id ?? null,
    },
  });
  revalidatePath("/finance/deposits");
}

// ── Factures ──
export async function createInvoice(fd: FormData) {
  const s = await requireSession();
  const reservationId = String(fd.get("reservationId") ?? "");
  const r = await db.reservation.findFirst({
    where: { id: reservationId, companyId: s.companyId },
    include: { vehicle: true, protection: true, options: { include: { option: true } }, invoices: true },
  });
  if (!r) return;
  const existing = r.invoices.find((i) => i.status === "ISSUED");
  if (existing) redirect(`/invoice/${existing.id}`);

  const lines: { description: string; quantity: number; unitPrice: number; total: number }[] = [];
  let extras = 0;
  for (const o of r.options) {
    const mult = o.option.priceType === "PER_DAY" ? r.days : 1;
    const total = Number(o.unitPrice) * o.quantity * mult;
    extras += total;
    lines.push({ description: o.option.name, quantity: o.quantity * mult, unitPrice: Number(o.unitPrice), total });
  }
  if (r.protection && Number(r.protection.pricePerDay) > 0) {
    const total = Number(r.protection.pricePerDay) * r.days;
    extras += total;
    lines.push({ description: r.protection.name, quantity: r.days, unitPrice: Number(r.protection.pricePerDay), total });
  }
  const rental = Math.round((Number(r.subtotal) - extras) * 100) / 100;
  lines.unshift({
    description: `Location ${r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})` : ""} — ${r.days} jour${r.days > 1 ? "s" : ""}`,
    quantity: 1, unitPrice: rental, total: rental,
  });

  const invoice = await db.$transaction(async (tx) => {
    const number = await nextNumber(tx, s.companyId, "invoice");
    return tx.invoice.create({
      data: {
        companyId: s.companyId, reservationId, customerId: r.customerId, number,
        subtotal: r.subtotal, taxAmount: r.taxAmount, total: r.total,
        lines: { create: lines },
      },
    });
  });
  redirect(`/invoice/${invoice.id}`);
}

export async function cancelInvoice(fd: FormData) {
  const s = await requireSession();
  await db.invoice.updateMany({ where: { id: String(fd.get("id") ?? ""), companyId: s.companyId }, data: { status: "CANCELLED" } });
  revalidatePath("/finance/invoices");
}

// ── Dépenses et fournisseurs ──
export async function createExpense(fd: FormData) {
  const s = await requireSession();
  const amount = parseAmount(fd.get("amount"));
  const label = String(fd.get("label") ?? "").trim();
  if (!label || !(amount > 0)) return;
  const paid = fd.get("paid") === "on";
  const method = paid ? parseMethod(fd.get("method")) : null;
  const session = method === "CASH" ? await currentCashSession(s.companyId, s.userId) : null;
  const date = new Date(String(fd.get("date") ?? ""));
  await db.expense.create({
    data: {
      companyId: s.companyId, label, amount, paid, method,
      category: String(fd.get("category") ?? "autre"),
      date: isNaN(date.getTime()) ? new Date() : date,
      vehicleId: String(fd.get("vehicleId") ?? "") || null,
      supplierId: String(fd.get("supplierId") ?? "") || null,
      cashSessionId: session?.id ?? null,
    },
  });
  revalidatePath("/finance", "layout");
}

export async function createSupplier(fd: FormData) {
  const s = await requireSession();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  await db.supplier.create({
    data: {
      companyId: s.companyId, name,
      type: String(fd.get("type") ?? "") || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      city: String(fd.get("city") ?? "").trim() || null,
      ice: String(fd.get("ice") ?? "").trim() || null,
    },
  });
  revalidatePath("/finance/suppliers");
}
