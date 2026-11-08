import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { availableVehicles } from "@/lib/availability";
import { priceRental } from "@/lib/pricing";
import { money } from "@/lib/format";
import { createReservation } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  dates: "Dates invalides : le retour doit être après le départ.",
  missing: "Choisissez un véhicule et un client.",
  conflict: "Ce véhicule vient d’être réservé sur cette période. Choisissez-en un autre.",
  blacklisted: "Ce client est en liste noire.",
};

export default async function NewReservation({
  searchParams,
}: {
  searchParams: { pickup?: string; return?: string; categoryId?: string; error?: string };
}) {
  const { companyId } = await requireSession();
  const pickup = searchParams.pickup ? new Date(searchParams.pickup) : null;
  const ret = searchParams.return ? new Date(searchParams.return) : null;
  const valid = !!pickup && !!ret && !isNaN(pickup.getTime()) && !isNaN(ret.getTime()) && ret > pickup;

  const categories = await db.vehicleCategory.findMany({ where: { companyId, isActive: true }, orderBy: { name: "asc" } });
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

  let vehicles: Awaited<ReturnType<typeof availableVehicles>> = [];
  let customers: { id: string; firstName: string; lastName: string; phone: string }[] = [];
  let options: Awaited<ReturnType<typeof db.rentalOption.findMany>> = [];
  let protections: Awaited<ReturnType<typeof db.protection.findMany>> = [];

  if (valid) {
    [vehicles, customers, options, protections] = await Promise.all([
      availableVehicles(companyId, pickup!, ret!, searchParams.categoryId || undefined),
      db.customer.findMany({
        where: { companyId, status: { not: "BLACKLISTED" } },
        orderBy: { lastName: "asc" },
        take: 300,
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      db.rentalOption.findMany({ where: { companyId, isActive: true } }),
      db.protection.findMany({ where: { companyId }, orderBy: { pricePerDay: "asc" } }),
    ]);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nouvelle réservation</h1>
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[searchParams.error] ?? "Erreur."}</p>
      )}

      <form className="card grid gap-3 md:grid-cols-5">
        <label className="text-sm">Départ
          <input name="pickup" type="datetime-local" required defaultValue={searchParams.pickup} className="input mt-1" />
        </label>
        <label className="text-sm">Retour
          <input name="return" type="datetime-local" required defaultValue={searchParams.return} className="input mt-1" />
        </label>
        <label className="text-sm">Catégorie
          <select name="categoryId" defaultValue={searchParams.categoryId ?? ""} className="input mt-1">
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button className="btn self-end md:col-span-2">Vérifier les disponibilités</button>
      </form>

      {valid && (
        <form action={createReservation} className="space-y-6">
          <input type="hidden" name="pickup" value={searchParams.pickup} />
          <input type="hidden" name="return" value={searchParams.return} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Véhicules disponibles ({vehicles.length})</h2>
            {vehicles.length === 0 && <p className="text-sm text-gray-500">Aucun véhicule disponible sur cette période.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {vehicles.map((v) => {
                const p = priceRental({
                  category: v.category, rates: v.category.rates, pickup: pickup!, ret: ret!,
                  taxRate: Number(company.taxRate), pricesIncludeTax: company.pricesIncludeTax,
                });
                return (
                  <label key={v.id} className="card flex cursor-pointer items-center gap-3 has-[:checked]:border-brand has-[:checked]:ring-2 has-[:checked]:ring-brand/40">
                    <input type="radio" name="vehicleId" value={v.id} required />
                    <div className="flex-1">
                      <p className="font-semibold">{v.brand} {v.model}</p>
                      <p className="text-xs text-gray-500">{v.plate} · {v.category.name}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{money(p.subtotal, company.currency)}</p>
                      <p className="text-xs text-gray-500">{p.days} j · {money(p.avgDailyRate, company.currency)}/j</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {vehicles.length > 0 && (
            <>
              <section className="card space-y-3">
                <h2 className="text-lg font-semibold">Client</h2>
                <select name="customerId" required className="input">
                  <option value="">Choisir un client…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.lastName} {c.firstName} — {c.phone}</option>
                  ))}
                </select>
                <Link href="/customers" className="text-xs underline">Créer un nouveau client</Link>
              </section>

              <section className="card space-y-3">
                <h2 className="text-lg font-semibold">Protection et options</h2>
                <select name="protectionId" className="input" defaultValue="">
                  <option value="">Sans protection</option>
                  {protections.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {money(Number(p.pricePerDay), company.currency)}/j · franchise {money(Number(p.deductible), company.currency)}</option>
                  ))}
                </select>
                {options.map((o) => (
                  <label key={o.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{o.name} <span className="text-gray-500">({money(Number(o.price), company.currency)}{o.priceType === "PER_DAY" ? "/j" : ""})</span></span>
                    <input name={`opt_${o.id}`} type="number" min={0} max={o.maxQty} defaultValue={0} className="input w-20" />
                  </label>
                ))}
                <input name="source" placeholder="Source (téléphone, WhatsApp, site…)" className="input" />
                <textarea name="notes" placeholder="Notes" className="input" rows={2} />
              </section>

              <div className="flex flex-wrap gap-3">
                <button className="btn">Créer la réservation</button>
                <button name="asQuote" value="1" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Enregistrer comme devis</button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
