import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { METHOD_LABEL } from "@/lib/finance";
import { dateOnly, money } from "@/lib/format";
import { settleDeposit } from "../actions";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  HELD: "Détenue", RETURNED: "Restituée", RETAINED: "Retenue", PARTIAL: "Retenue partielle",
};

export default async function DepositsPage() {
  const { companyId } = await requireSession();
  const deposits = await db.deposit.findMany({
    where: { companyId },
    include: { reservation: { include: { customer: true } } },
    orderBy: { receivedAt: "desc" }, take: 100,
  });
  const held = deposits.filter((d) => d.status === "HELD");
  const total = held.reduce((a, d) => a + Number(d.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cautions</h1>
      <div className="card max-w-xs">
        <p className="text-sm text-gray-500">Total détenu ({held.length})</p>
        <p className="text-2xl font-bold">{money(total)}</p>
      </div>
      <p className="text-xs text-gray-500">Les cautions sont enregistrées depuis la fiche de la réservation.</p>

      <div className="space-y-3">
        {deposits.map((d) => (
          <div key={d.id} className="card space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <Link href={`/reservations/${d.reservationId}`} className="font-semibold underline">{d.reservation.number}</Link>
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs">{LABEL[d.status]}</span>
            </div>
            <p className="text-gray-500">
              {d.reservation.customer.firstName} {d.reservation.customer.lastName} · {METHOD_LABEL[d.method]} · reçue le {dateOnly(d.receivedAt)}
            </p>
            <p className="font-medium">{money(Number(d.amount))}
              {d.status !== "HELD" && <span className="font-normal text-gray-500"> · rendue {money(Number(d.returnedAmount))} · retenue {money(Number(d.retainedAmount))}</span>}
            </p>
            {d.reason && <p className="text-xs text-gray-500">Motif : {d.reason}</p>}
            {d.status === "HELD" && (
              <form action={settleDeposit} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={d.id} />
                <input name="retained" defaultValue="0" className="input w-28" title="Montant retenu" />
                <input name="reason" placeholder="Motif de retenue" className="input min-w-40 flex-1" />
                <button className="btn">Restituer</button>
              </form>
            )}
          </div>
        ))}
        {deposits.length === 0 && <p className="text-sm text-gray-500">Aucune caution.</p>}
      </div>
    </div>
  );
}
