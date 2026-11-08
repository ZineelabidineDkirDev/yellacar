import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { METHOD_LABEL, monthRange, paidMap } from "@/lib/finance";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceHome({ searchParams }: { searchParams: { month?: string } }) {
  const { companyId } = await requireSession();
  const m = monthRange(searchParams.month);
  const period = { gte: m.start, lt: m.end };

  const [payments, invoices, expenses, deposits, open] = await Promise.all([
    db.payment.findMany({ where: { companyId, paidAt: period } }),
    db.invoice.aggregate({ where: { companyId, status: "ISSUED", issueDate: period }, _sum: { total: true } }),
    db.expense.aggregate({ where: { companyId, date: period }, _sum: { amount: true } }),
    db.deposit.aggregate({ where: { companyId, status: "HELD" }, _sum: { amount: true }, _count: true }),
    db.reservation.findMany({
      where: { companyId, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
      select: { id: true, total: true }, take: 1000,
    }),
  ]);

  const collected = payments.filter((p) => p.type === "PAYMENT").reduce((a, p) => a + Number(p.amount), 0);
  const refunded = payments.filter((p) => p.type === "REFUND").reduce((a, p) => a + Number(p.amount), 0);
  const net = collected - refunded;
  const spent = Number(expenses._sum.amount ?? 0);

  const paid = await paidMap(companyId, open.map((r) => r.id));
  const dueTotal = open.reduce((a, r) => a + Math.max(0, Number(r.total) - (paid.get(r.id) ?? 0)), 0);

  const byMethod = new Map<string, number>();
  for (const p of payments) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + (p.type === "PAYMENT" ? 1 : -1) * Number(p.amount));
  }

  const cards = [
    ["Net encaissé", money(net)],
    ["Facturé", money(Number(invoices._sum.total ?? 0))],
    ["Dépenses", money(spent)],
    ["Résultat opérationnel", money(net - spent)],
    ["Soldes dus (toutes réservations)", money(dueTotal)],
    [`Cautions détenues (${deposits._count})`, money(Number(deposits._sum.amount ?? 0))],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold capitalize">Finance · {m.label}</h1>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-lg border px-3 py-1" href={`/finance?month=${m.prev}`}>←</Link>
          <Link className="rounded-lg border px-3 py-1" href="/finance">Ce mois</Link>
          <Link className="rounded-lg border px-3 py-1" href={`/finance?month=${m.next}`}>→</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Encaissements par mode de paiement</h2>
        {byMethod.size === 0 && <p className="text-sm text-gray-500">Aucun encaissement sur la période.</p>}
        {[...byMethod.entries()].map(([k, v]) => (
          <p key={k} className="flex justify-between border-t border-gray-100 py-1 text-sm">
            <span>{METHOD_LABEL[k]}</span><span>{money(v)}</span>
          </p>
        ))}
        <p className="mt-3 text-xs text-gray-500">Les cautions ne sont jamais comptées comme chiffre d’affaires.</p>
      </div>
    </div>
  );
}
