import type { PaymentMethod } from "@prisma/client";
import { db } from "./db";

export const METHOD_LABEL: Record<string, string> = {
  CASH: "Espèces", CARD: "Carte bancaire", TRANSFER: "Virement", CHEQUE: "Chèque",
};

export const parseMethod = (v: FormDataEntryValue | null): PaymentMethod =>
  v === "CARD" || v === "TRANSFER" || v === "CHEQUE" ? v : "CASH";

export const parseAmount = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

export function safeReturn(p: FormDataEntryValue | null | undefined, fallback: string) {
  const v = String(p ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

export const withParam = (url: string, key: string, value: string) =>
  `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;

// Montant encaissé net (paiements − remboursements) par réservation
export async function paidMap(companyId: string, reservationIds?: string[]) {
  const rows = await db.payment.groupBy({
    by: ["reservationId", "type"],
    where: { companyId, ...(reservationIds ? { reservationId: { in: reservationIds } } : {}) },
    _sum: { amount: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = Number(r._sum.amount ?? 0);
    m.set(r.reservationId, (m.get(r.reservationId) ?? 0) + (r.type === "PAYMENT" ? v : -v));
  }
  return m;
}

export function currentCashSession(companyId: string, userId: string) {
  return db.cashSession.findFirst({ where: { companyId, openedById: userId, status: "OPEN" } });
}

// Espèces attendues dans le tiroir pour une session
export async function cashTotals(sessionId: string, openingFloat: number) {
  const [pay, dep, depRet, exp] = await Promise.all([
    db.payment.findMany({ where: { cashSessionId: sessionId, method: "CASH" } }),
    db.deposit.findMany({ where: { receivedSessionId: sessionId, method: "CASH" } }),
    db.deposit.findMany({ where: { returnSessionId: sessionId, method: "CASH" } }),
    db.expense.findMany({ where: { cashSessionId: sessionId, method: "CASH", paid: true } }),
  ]);
  const sum = (xs: { amount: unknown }[]) => xs.reduce((a, x) => a + Number(x.amount), 0);
  const payments = pay.filter((p) => p.type === "PAYMENT").reduce((a, p) => a + Number(p.amount), 0);
  const refunds = pay.filter((p) => p.type === "REFUND").reduce((a, p) => a + Number(p.amount), 0);
  const depositsIn = sum(dep);
  const depositsOut = depRet.reduce((a, d) => a + Number(d.returnedAmount), 0);
  const expenses = sum(exp);
  const expected = openingFloat + payments - refunds + depositsIn - depositsOut - expenses;
  return { payments, refunds, depositsIn, depositsOut, expenses, expected: Math.round(expected * 100) / 100 };
}

export function monthRange(month?: string) {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  const y = m ? Number(m[1]) : now.getFullYear();
  const mo = m ? Number(m[2]) : now.getMonth() + 1;
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 1);
  const value = `${y}-${String(mo).padStart(2, "0")}`;
  const prev = new Date(y, mo - 2, 1);
  const next = new Date(y, mo, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return {
    start, end, value, prev: fmt(prev), next: fmt(next),
    label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
  };
}
