import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { dateOnly, money } from "@/lib/format";
import { cancelInvoice } from "../actions";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { companyId } = await requireSession();
  const invoices = await db.invoice.findMany({
    where: { companyId }, include: { customer: true }, orderBy: { issueDate: "desc" }, take: 100,
  });
  const billed = invoices.filter((i) => i.status === "ISSUED").reduce((a, i) => a + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Factures</h1>
      <div className="card max-w-xs">
        <p className="text-sm text-gray-500">Total facturé</p>
        <p className="text-2xl font-bold">{money(billed)}</p>
      </div>
      <p className="text-xs text-gray-500">Une facture se génère depuis la fiche de la réservation.</p>
      <div className="card divide-y divide-gray-100 p-0">
        {invoices.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-3 text-sm">
            <Link href={`/invoice/${i.id}`} className="flex-1">
              <p className={`font-medium ${i.status === "CANCELLED" ? "text-gray-400 line-through" : ""}`}>{i.number}</p>
              <p className="text-xs text-gray-500">{i.customer.firstName} {i.customer.lastName} · {dateOnly(i.issueDate)}</p>
            </Link>
            <span className="mr-3">{money(Number(i.total))}</span>
            {i.status === "ISSUED" && (
              <form action={cancelInvoice}><input type="hidden" name="id" value={i.id} /><button className="text-xs text-red-600 underline">Annuler</button></form>
            )}
          </div>
        ))}
        {invoices.length === 0 && <p className="p-3 text-sm text-gray-500">Aucune facture.</p>}
      </div>
    </div>
  );
}
