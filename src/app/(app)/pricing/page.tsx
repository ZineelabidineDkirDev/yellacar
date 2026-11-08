import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { dateOnly, money } from "@/lib/format";
import { createOption, createProtection, createSeason, deleteSeason, saveRate, seedDefaults } from "./actions";

export const dynamic = "force-dynamic";

function RateForm({
  categoryId, seasonId, rate, fallback,
}: {
  categoryId: string; seasonId?: string;
  rate?: { dailyRate: unknown; weeklyRate: unknown; monthlyRate: unknown } | null; fallback?: number;
}) {
  return (
    <form action={saveRate} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="seasonId" value={seasonId ?? ""} />
      <input name="dailyRate" defaultValue={rate ? String(rate.dailyRate) : fallback ?? ""} placeholder="Jour" className="input w-24" />
      <input name="weeklyRate" defaultValue={rate?.weeklyRate ? String(rate.weeklyRate) : ""} placeholder="Semaine" className="input w-24" />
      <input name="monthlyRate" defaultValue={rate?.monthlyRate ? String(rate.monthlyRate) : ""} placeholder="Mois" className="input w-24" />
      <button className="btn">OK</button>
    </form>
  );
}

export default async function PricingPage() {
  const { companyId } = await requireSession();
  const [categories, seasons, options, protections] = await Promise.all([
    db.vehicleCategory.findMany({ where: { companyId }, include: { rates: true }, orderBy: { name: "asc" } }),
    db.season.findMany({ where: { companyId }, orderBy: { startDate: "asc" } }),
    db.rentalOption.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    db.protection.findMany({ where: { companyId }, orderBy: { pricePerDay: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Tarifs</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tarifs de base (toute l’année)</h2>
        {categories.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{c.name} <span className="text-xs text-gray-500">{c.code}</span></p>
            <RateForm categoryId={c.id} rate={c.rates.find((r) => !r.seasonId)} fallback={Number(c.defaultDailyRate)} />
          </div>
        ))}
        <p className="text-xs text-gray-500">Semaine et mois sont optionnels : s’ils sont remplis, ils remplacent le tarif jour pour les longues durées.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saisons</h2>
        <form action={createSeason} className="card grid gap-3 md:grid-cols-4">
          <input name="name" placeholder="Nom (ex : Été)" required className="input" />
          <input name="startDate" type="date" required className="input" />
          <input name="endDate" type="date" required className="input" />
          <button className="btn">Ajouter la saison</button>
        </form>
        {seasons.map((s) => (
          <div key={s.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{s.name} <span className="text-sm font-normal text-gray-500">{dateOnly(s.startDate)} → {dateOnly(s.endDate)}</span></p>
              <form action={deleteSeason}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-red-600 underline">Supprimer</button></form>
            </div>
            {categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{c.name}</span>
                <RateForm categoryId={c.id} seasonId={s.id} rate={c.rates.find((r) => r.seasonId === s.id)} />
              </div>
            ))}
          </div>
        ))}
        {seasons.length === 0 && <p className="text-sm text-gray-500">Aucune saison : le tarif de base s’applique toute l’année.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Options</h2>
          {(options.length === 0 || protections.length === 0) && (
            <form action={seedDefaults}><button className="btn">Créer options et protections par défaut</button></form>
          )}
        </div>
        <form action={createOption} className="card grid gap-3 md:grid-cols-5">
          <input name="name" placeholder="Nom" required className="input" />
          <input name="price" placeholder="Prix" required className="input" />
          <select name="priceType" className="input"><option value="PER_DAY">Par jour</option><option value="FLAT">Forfait</option></select>
          <input name="maxQty" type="number" min={1} defaultValue={1} className="input" />
          <button className="btn">Ajouter</button>
        </form>
        <div className="card divide-y divide-gray-100 p-0">
          {options.map((o) => (
            <div key={o.id} className="flex justify-between p-3 text-sm">
              <span>{o.name}</span><span>{money(Number(o.price))} {o.priceType === "PER_DAY" ? "/ jour" : "forfait"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Protections</h2>
        <form action={createProtection} className="card grid gap-3 md:grid-cols-4">
          <input name="name" placeholder="Nom" required className="input" />
          <input name="pricePerDay" placeholder="Prix / jour" required className="input" />
          <input name="deductible" placeholder="Franchise" required className="input" />
          <button className="btn">Ajouter</button>
        </form>
        <div className="card divide-y divide-gray-100 p-0">
          {protections.map((p) => (
            <div key={p.id} className="flex justify-between p-3 text-sm">
              <span>{p.name}</span><span>{money(Number(p.pricePerDay))} / jour · franchise {money(Number(p.deductible))}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
