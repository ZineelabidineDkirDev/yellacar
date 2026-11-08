import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { STATUS_COLOR, STATUS_LABEL, dt, money } from "@/lib/format";
import { METHOD_LABEL, paidMap } from "@/lib/finance";
import { createInvoice, recordDeposit, recordPayment } from "../../finance/actions";
import { generateContract, setStatus } from "./actions";

export const dynamic = "force-dynamic";

const NEXT_ACTIONS: Record<string, [string, string][]> = {
  QUOTE: [["CONFIRMED", "Confirmer"], ["CANCELLED", "Annuler"]],
  PENDING: [["CONFIRMED", "Confirmer"], ["CANCELLED", "Annuler"], ["NO_SHOW", "Non présenté"]],
  CONFIRMED: [["IN_PROGRESS", "Effectuer le départ"], ["CANCELLED", "Annuler"]],
  IN_PROGRESS: [["COMPLETED", "Enregistrer le retour"]],
};

const ERR: Record<string, string> = {
  amount: "Montant invalide.",
  overpay: "Le montant dépasse le solde dû.",
  refund: "Le remboursement dépasse le montant encaissé.",
  deposit: "Une caution existe déjà pour cette réservation.",
};

export default async function ReservationDetail({
  params, searchParams,
}: { params: { id: string }; searchParams: { error?: string } }) {
  const { companyId } = await requireSession();
  const r = await db.reservation.findFirst({
    where: { id: params.id, companyId },
    include: { customer: true, vehicle: true, protection: true, contract: true, deposit: true, options: { include: { option: true } } },
  });
  if (!r) notFound();
  const paid = (await paidMap(companyId, [r.id])).get(r.id) ?? 0;
  const balance = Math.max(0, Number(r.total) - paid);
  const back = `/reservations/${r.id}`;

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/reservations" className="text-sm underline">← Réservations</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{r.number}</h1>
        <span className={`rounded-full px-3 py-1 text-sm ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      </div>

      <div className="card space-y-1 text-sm">
        <p><b>Client :</b> {r.customer.firstName} {r.customer.lastName} · {r.customer.phone}</p>
        <p><b>Véhicule :</b> {r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})` : "Non affecté"}</p>
        <p><b>Départ :</b> {dt(r.pickupAt)}</p>
        <p><b>Retour :</b> {dt(r.returnAt)} ({r.days} jour{r.days > 1 ? "s" : ""})</p>
        {r.protection && <p><b>Protection :</b> {r.protection.name}</p>}
        {r.options.map((o) => <p key={o.id}><b>Option :</b> {o.option.name} × {o.quantity}</p>)}
        {r.notes && <p><b>Notes :</b> {r.notes}</p>}
      </div>

      <div className="card space-y-1 text-sm">
        <p className="flex justify-between"><span>Sous-total</span><span>{money(Number(r.subtotal))}</span></p>
        <p className="flex justify-between"><span>Dont taxe</span><span>{money(Number(r.taxAmount))}</span></p>
        <p className="flex justify-between text-base font-bold"><span>Total</span><span>{money(Number(r.total))}</span></p>
        {r.depositAmount && <p className="flex justify-between"><span>Caution</span><span>{money(Number(r.depositAmount))}</span></p>}
      </div>

      {searchParams.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERR[searchParams.error] ?? "Erreur."}</p>
      )}

      {r.status !== "QUOTE" && r.status !== "CANCELLED" && (
        <div className="card space-y-3 text-sm">
          <h2 className="font-semibold">Paiement</h2>
          <p className="flex justify-between"><span>Encaissé</span><span>{money(paid)}</span></p>
          <p className="flex justify-between font-bold"><span>Solde dû</span><span>{money(balance)}</span></p>

          {balance > 0.005 && (
            <form action={recordPayment} className="flex flex-wrap gap-2">
              <input type="hidden" name="reservationId" value={r.id} />
              <input type="hidden" name="returnTo" value={back} />
              <input name="amount" defaultValue={balance.toFixed(2)} className="input w-28" />
              <select name="method" className="input w-40">
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn">Encaisser</button>
            </form>
          )}
          {paid > 0 && (
            <form action={recordPayment} className="flex flex-wrap gap-2">
              <input type="hidden" name="reservationId" value={r.id} />
              <input type="hidden" name="returnTo" value={back} />
              <input type="hidden" name="type" value="REFUND" />
              <input name="amount" placeholder="Montant à rembourser" className="input w-44" />
              <select name="method" className="input w-40">
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700">Rembourser</button>
            </form>
          )}

          <div className="border-t pt-3">
            <p className="mb-2 font-semibold">Caution</p>
            {r.deposit ? (
              <p>{money(Number(r.deposit.amount))} · {METHOD_LABEL[r.deposit.method]} · {r.deposit.status === "HELD" ? "détenue" : "clôturée"}</p>
            ) : (
              <form action={recordDeposit} className="flex flex-wrap gap-2">
                <input type="hidden" name="reservationId" value={r.id} />
                <input type="hidden" name="returnTo" value={back} />
                <input name="amount" defaultValue={r.depositAmount ? String(r.depositAmount) : ""} placeholder="Montant" className="input w-28" />
                <select name="method" className="input w-40">
                  {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn">Encaisser la caution</button>
              </form>
            )}
          </div>

          <form action={createInvoice} className="border-t pt-3">
            <input type="hidden" name="reservationId" value={r.id} />
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Générer / voir la facture</button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(NEXT_ACTIONS[r.status] ?? []).map(([status, label]) => (
          <form key={status} action={setStatus}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={status} />
            <button className={status === "CANCELLED" || status === "NO_SHOW" ? "rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700" : "btn"}>{label}</button>
          </form>
        ))}
        {r.status !== "QUOTE" && r.status !== "CANCELLED" && (
          <form action={generateContract}>
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
              {r.contract ? `Voir le contrat ${r.contract.number}` : "Générer le contrat"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
