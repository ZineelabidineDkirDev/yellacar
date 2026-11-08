import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { dateOnly, money } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const inv = await db.invoice.findFirst({
    where: { id: params.id, companyId },
    include: { customer: true, lines: true, reservation: true },
  });
  if (!inv) notFound();
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const cur = company.currency;
  const total = Number(inv.total);
  const tax = Number(inv.taxAmount);
  const ht = total - tax;

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p>{[company.city, company.phone, company.email].filter(Boolean).join(" · ")}</p>
          {company.ice && <p>ICE : {company.ice}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">FACTURE {inv.status === "CANCELLED" && "(ANNULÉE)"}</p>
          <p>N° {inv.number}</p>
          <p>Date : {dateOnly(inv.issueDate)}</p>
          {inv.reservation && <p>Réservation {inv.reservation.number}</p>}
        </div>
      </div>

      <div className="rounded border p-3">
        <p className="font-bold">Client</p>
        <p>{inv.customer.firstName} {inv.customer.lastName}</p>
        <p>{inv.customer.phone}</p>
      </div>

      <table className="w-full">
        <thead><tr className="border-b text-left"><th className="py-2">Description</th><th>Qté</th><th>Prix unitaire</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2">{l.description}</td>
              <td>{Number(l.quantity)}</td>
              <td>{money(Number(l.unitPrice), cur)}</td>
              <td className="text-right">{money(Number(l.total), cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1">
        <p className="flex justify-between"><span>Total HT</span><span>{money(ht, cur)}</span></p>
        <p className="flex justify-between"><span>TVA ({Number(company.taxRate)} %)</span><span>{money(tax, cur)}</span></p>
        <p className="flex justify-between border-t pt-1 text-base font-bold"><span>Total TTC</span><span>{money(total, cur)}</span></p>
      </div>

      <PrintButton />
    </div>
  );
}
