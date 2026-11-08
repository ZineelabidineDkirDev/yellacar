import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { dt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { companyId, name } = await requireSession();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [total, available, rented, customers, departures, returns] = await Promise.all([
    db.vehicle.count({ where: { companyId } }),
    db.vehicle.count({ where: { companyId, status: "AVAILABLE" } }),
    db.vehicle.count({ where: { companyId, status: "RENTED" } }),
    db.customer.count({ where: { companyId } }),
    db.reservation.findMany({
      where: { companyId, status: { in: ["PENDING", "CONFIRMED"] }, pickupAt: { gte: dayStart, lt: dayEnd } },
      include: { customer: true, vehicle: true }, orderBy: { pickupAt: "asc" },
    }),
    db.reservation.findMany({
      where: { companyId, status: "IN_PROGRESS", returnAt: { lt: dayEnd } },
      include: { customer: true, vehicle: true }, orderBy: { returnAt: "asc" },
    }),
  ]);

  const stats = [
    { label: "Véhicules", value: total },
    { label: "Disponibles", value: available },
    { label: "En location", value: rented },
    { label: "Clients", value: customers },
  ];

  const List = ({ title, items, date }: { title: string; items: typeof departures; date: "pickupAt" | "returnAt" }) => (
    <div className="card">
      <h2 className="mb-2 font-semibold">{title} ({items.length})</h2>
      {items.length === 0 && <p className="text-sm text-gray-500">Rien de prévu.</p>}
      {items.map((r) => (
        <Link key={r.id} href={`/reservations/${r.id}`} className="block border-t border-gray-100 py-2 text-sm hover:bg-gray-50">
          <p className="font-medium">{r.customer.firstName} {r.customer.lastName} · {r.vehicle?.plate ?? "—"}</p>
          <p className="text-xs text-gray-500">{r.number} · {dt(r[date])}</p>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Bonjour, {name}</h1>
        <Link href="/reservations/new" className="btn">Nouvelle réservation</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <List title="Départs du jour" items={departures} date="pickupAt" />
        <List title="Retours du jour et retards" items={returns} date="returnAt" />
      </div>
    </div>
  );
}
