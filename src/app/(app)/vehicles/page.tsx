import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createVehicle } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  AVAILABLE: "Disponible",
  RENTED: "En location",
  MAINTENANCE: "Maintenance",
  BLOCKED: "Bloqué",
};

export default async function VehiclesPage() {
  const { companyId } = await requireSession();
  const [vehicles, categories] = await Promise.all([
    db.vehicle.findMany({ where: { companyId }, include: { category: true }, orderBy: { createdAt: "desc" } }),
    db.vehicleCategory.findMany({ where: { companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Flotte ({vehicles.length})</h1>

      <form action={createVehicle} className="card grid gap-3 md:grid-cols-6">
        <input name="plate" placeholder="Immatriculation" required className="input" />
        <input name="brand" placeholder="Marque" required className="input" />
        <input name="model" placeholder="Modèle" required className="input" />
        <select name="categoryId" required className="input">
          <option value="">Catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="transmission" className="input">
          <option value="MANUAL">Manuelle</option>
          <option value="AUTOMATIC">Automatique</option>
        </select>
        <button className="btn">Ajouter</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((v) => (
          <div key={v.id} className="card">
            <p className="font-semibold">{v.brand} {v.model}</p>
            <p className="text-sm text-gray-500">{v.plate} · {v.category.name}</p>
            <span className="mt-2 inline-block rounded-full bg-brand/20 px-2 py-0.5 text-xs">
              {STATUS[v.status]}
            </span>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-sm text-gray-500">Aucun véhicule pour le moment.</p>}
      </div>
    </div>
  );
}
