import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { METHOD_LABEL, paidMap } from "@/lib/finance";
import { dt, money } from "@/lib/format";
import { recordPayment } from "../actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  amount: "Montant invalide.",
  overpay: "Le montant dépasse le solde dû.",
  refund: "Le remboursement dépasse le montant encaissé.",
};

export default async function PaymentsPage({ searchParams }: { searchParams: { error?: string } }) {
  const { companyId } = await requireSession();
  const [reservations, payments] = await Promise.all([
    db.reservation.findMany({
      where: { companyId, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
      include: { customer: true }, orderBy: { pickupAt: "desc" }, take: 200,
    }),
    db.payment.findMany({
      where: { companyId }, include: { reservation: { include: { customer: true } } },
      orderBy: { paidAt: "desc" }, take: 50,
    }),
  ]);
  const paid = await paidMap(companyId, reservations.map((r) => r.id));
  const due = reservations
    .map((r) => ({ r, balance: Number(r.total) - (paid.get(r.id) ?? 0) }))
    .filter((x) => x.balance > 0.005);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paiements</h1>
      {searchParams.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERR[searchParams.error] ?? "Erreur."}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">Encaisser un solde ({due.length})</h2>
        {due.map(({ r, balance }) => (
          <form key={r.id} action={recordPayment} className="card flex flex-wrap items-center gap-2">
            <input type="hidden" name="reservationId" value={r.id} />
            <input type="hidden" name="returnTo" value="/finance/payments" />
            <div className="min-w-40 flex-1 text-sm">
              <Link href={`/reservations/${r.id}`} className="font-semibold underline">{r.number}</Link>
              <p className="text-gray-500">{r.customer.firstName} {r.customer.lastName} · solde {money(balance)}</p>
            </div>
            <input name="amount" defaultValue={balance.toFixed(2)} className="input w-28" />
            <select name="method" className="input w-36">
              {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn">Encaisser</button>
          </form>
        ))}
        {due.length === 0 && <p className="text-sm text-gray-500">Aucun solde à encaisser.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Derniers paiements</h2>
        <div className="card divide-y divide-gray-100 p-0">
          {payments.map((p) => (
            <Link key={p.id} href={`/receipt/${p.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-gray-50">
              <div>
                <p className="font-medium">{p.receiptNumber} · {p.reservation.customer.lastName}</p>
                <p className="text-xs text-gray-500">{dt(p.paidAt)} · {METHOD_LABEL[p.method]}</p>
              </div>
              <span className={p.type === "REFUND" ? "text-red-600" : "text-green-700"}>
                {p.type === "REFUND" ? "−" : "+"}{money(Number(p.amount))}
              </span>
            </Link>
          ))}
          {payments.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun paiement.</p>}
        </div>
      </section>
    </div>
  );
}
