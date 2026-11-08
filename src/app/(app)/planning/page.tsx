import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ACTIVE } from "@/lib/availability";
import { STATUS_COLOR } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function PlanningPage({ searchParams }: { searchParams: { start?: string } }) {
  const { companyId } = await requireSession();

  const base = searchParams.start ? new Date(`${searchParams.start}T00:00:00`) : new Date();
  const start = isNaN(base.getTime()) ? new Date() : base;
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const end = new Date(start.getTime() + 7 * DAY);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [vehicles, reservations] = await Promise.all([
    db.vehicle.findMany({ where: { companyId }, orderBy: { plate: "asc" } }),
    db.reservation.findMany({
      where: { companyId, status: { in: [...ACTIVE, "COMPLETED"] }, pickupAt: { lt: end }, returnAt: { gt: start } },
      include: { customer: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Planning</h1>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-lg border px-3 py-1" href={`/planning?start=${iso(new Date(start.getTime() - 7 * DAY))}`}>← Semaine précédente</Link>
          <Link className="rounded-lg border px-3 py-1" href="/planning">Aujourd’hui</Link>
          <Link className="rounded-lg border px-3 py-1" href={`/planning?start=${iso(end)}`}>Semaine suivante →</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-36 border bg-white p-2 text-left">Véhicule</th>
              {days.map((d) => (
                <th key={d.toISOString()} className="border bg-white p-2">
                  {d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="border bg-white p-2"><p className="font-semibold">{v.brand} {v.model}</p><p className="text-gray-500">{v.plate}</p></td>
                {days.map((d) => {
                  const dayEnd = new Date(d.getTime() + DAY);
                  const here = reservations.filter((r) => r.vehicleId === v.id && r.pickupAt < dayEnd && r.returnAt > d);
                  return (
                    <td key={d.toISOString()} className="h-14 border bg-white p-1 align-top">
                      {here.map((r) => (
                        <Link key={r.id} href={`/reservations/${r.id}`}
                          className={`mb-1 block truncate rounded px-1 py-0.5 ${STATUS_COLOR[r.status]}`}>
                          {r.customer.lastName}
                        </Link>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">Ajoutez des véhicules pour voir le planning.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
