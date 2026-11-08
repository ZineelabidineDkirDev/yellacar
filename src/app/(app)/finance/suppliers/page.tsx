import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createSupplier } from "../actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { companyId } = await requireSession();
  const suppliers = await db.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fournisseurs ({suppliers.length})</h1>
      <form action={createSupplier} className="card grid gap-3 md:grid-cols-5">
        <input name="name" placeholder="Nom" required className="input" />
        <select name="type" className="input">
          <option value="">Type</option><option>garage</option><option>assureur</option><option>leasing</option><option>partenaire</option>
        </select>
        <input name="phone" placeholder="Téléphone" className="input" />
        <input name="city" placeholder="Ville" className="input" />
        <button className="btn">Ajouter</button>
      </form>
      <div className="card divide-y divide-gray-100 p-0">
        {suppliers.map((s) => (
          <div key={s.id} className="p-3 text-sm">
            <p className="font-medium">{s.name} {s.type && <span className="text-xs text-gray-500">· {s.type}</span>}</p>
            <p className="text-xs text-gray-500">{[s.phone, s.city].filter(Boolean).join(" · ")}</p>
          </div>
        ))}
        {suppliers.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun fournisseur.</p>}
      </div>
    </div>
  );
}
