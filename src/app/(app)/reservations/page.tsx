import Link from "next/link";
import type { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { STATUS_COLOR, STATUS_LABEL, dt, money } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [
  ["", "Toutes"], ["PENDING", "En attente"], ["CONFIRMED", "Confirmées"],
  ["IN_PROGRESS", "En location"], ["COMPLETED", "Terminées"], ["QUOTE", "Devis"],
];

export default async function ReservationsPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const { companyId } = await requireSession();
  const status = searchParams.status as ReservationStatus | undefined;
  const q = searchParams.q?.trim();

  const reservations = await db.reservation.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(q ? { OR: [
        { number: { contains: q, mode: "insensitive" } },
        { customer: { lastName: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q } } },
        { vehicle: { plate: { contains: q, mode: "insensitive" } } },
      ] } : {}),
    },
    include: { customer: true, vehicle: true },
    orderBy: { pickupAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Réservations</h1>
        <Link href="/reservations/new" className="btn">Nouvelle réservation</Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="N°, client, téléphone, immatriculation" className="input max-w-sm" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn">Rechercher</button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map(([v, label]) => (
          <Link key={v} href={v ? `/reservations?status=${v}` : "/reservations"}
            className={`rounded-full border px-3 py-1 ${(status ?? "") === v ? "border-brand bg-brand/30" : "border-gray-300"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {reservations.map((r) => (
          <Link key={r.id} href={`/reservations/${r.id}`} className="card block hover:border-brand">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{r.number}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            <p className="text-sm">{r.customer.firstName} {r.customer.lastName} · {r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})` : "—"}</p>
            <p className="text-xs text-gray-500">{dt(r.pickupAt)} → {dt(r.returnAt)} · {money(Number(r.total))}</p>
          </Link>
        ))}
        {reservations.length === 0 && <p className="text-sm text-gray-500">Aucune réservation.</p>}
      </div>
    </div>
  );
}
