import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { METHOD_LABEL, monthRange } from "@/lib/finance";
import { dateOnly, money } from "@/lib/format";
import { createExpense } from "../actions";

export const dynamic = "force-dynamic";

const CATEGORIES = ["entretien", "assurance", "carburant", "lavage", "amende", "salaire", "loyer", "autre"];

export default async function ExpensesPage({ searchParams }: { searchParams: { month?: string } }) {
  const { companyId } = await requireSession();
  const m = monthRange(searchParams.month);
  const [expenses, vehicles, suppliers] = await Promise.all([
    db.expense.findMany({
      where: { companyId, date: { gte: m.start, lt: m.end } },
      include: { vehicle: true, supplier: true }, orderBy: { date: "desc" },
    }),
    db.vehicle.findMany({ where: { companyId }, orderBy: { plate: "asc" } }),
    db.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold capitalize">Dépenses · {m.label}</h1>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-lg border px-3 py-1" href={`/finance/expenses?month=${m.prev}`}>←</Link>
          <Link className="rounded-lg border px-3 py-1" href="/finance/expenses">Ce mois</Link>
          <Link className="rounded-lg border px-3 py-1" href={`/finance/expenses?month=${m.next}`}>→</Link>
        </div>
      </div>

      <form action={createExpense} className="card grid gap-3 md:grid-cols-4">
        <input name="label" placeholder="Libellé" required className="input md:col-span-2" />
        <input name="amount" placeholder="Montant" required className="input" />
        <input name="date" type="date" className="input" />
        <select name="category" className="input">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="vehicleId" className="input"><option value="">Véhicule (optionnel)</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</select>
        <select name="supplierId" className="input"><option value="">Fournisseur (optionnel)</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="method" className="input">{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="paid" defaultChecked /> Payée</label>
        <button className="btn md:col-span-3">Ajouter la dépense</button>
      </form>

      <div className="card">
        <p className="flex justify-between font-semibold"><span>Total du mois</span><span>{money(total)}</span></p>
        {[...byCat.entries()].map(([k, v]) => (
          <p key={k} className="flex justify-between border-t border-gray-100 py-1 text-sm capitalize"><span>{k}</span><span>{money(v)}</span></p>
        ))}
      </div>

      <div className="card divide-y divide-gray-100 p-0">
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <p className="font-medium">{e.label}</p>
              <p className="text-xs text-gray-500">{dateOnly(e.date)} · {e.category}{e.vehicle ? ` · ${e.vehicle.plate}` : ""}{e.supplier ? ` · ${e.supplier.name}` : ""}{!e.paid ? " · à payer" : ""}</p>
            </div>
            <span>{money(Number(e.amount))}</span>
          </div>
        ))}
        {expenses.length === 0 && <p className="p-3 text-sm text-gray-500">Aucune dépense sur la période.</p>}
      </div>
    </div>
  );
}
