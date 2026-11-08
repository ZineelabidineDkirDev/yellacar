import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { METHOD_LABEL } from "@/lib/finance";
import { dt, money } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const p = await db.payment.findFirst({
    where: { id: params.id, companyId },
    include: { reservation: { include: { customer: true } }, receivedBy: true },
  });
  if (!p) notFound();
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

  return (
    <div className="mx-auto max-w-md space-y-4 bg-white p-8 text-sm print:p-0">
      <div>
        <h1 className="text-xl font-bold">{company.name}</h1>
        <p>{[company.city, company.phone].filter(Boolean).join(" · ")}</p>
      </div>
      <p className="text-lg font-bold">{p.type === "REFUND" ? "REMBOURSEMENT" : "REÇU DE PAIEMENT"} N° {p.receiptNumber}</p>
      <div className="space-y-1 rounded border p-3">
        <p>Date : {dt(p.paidAt)}</p>
        <p>Client : {p.reservation.customer.firstName} {p.reservation.customer.lastName}</p>
        <p>Réservation : {p.reservation.number}</p>
        <p>Mode : {METHOD_LABEL[p.method]}{p.reference ? ` (${p.reference})` : ""}</p>
        <p className="pt-2 text-lg font-bold">Montant : {money(Number(p.amount), company.currency)}</p>
      </div>
      <p className="text-xs text-gray-500">Encaissé par {p.receivedBy.name}</p>
      <PrintButton />
    </div>
  );
}
