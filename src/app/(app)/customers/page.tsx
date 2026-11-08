import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createCustomer } from "./actions";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { companyId } = await requireSession();
  const customers = await db.customer.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clients ({customers.length})</h1>

      <form action={createCustomer} className="card grid gap-3 md:grid-cols-4">
        <input name="firstName" placeholder="Prénom" required className="input" />
        <input name="lastName" placeholder="Nom" required className="input" />
        <input name="phone" placeholder="Téléphone" required className="input" />
        <input name="email" type="email" placeholder="Email" className="input" />
        <select name="idType" className="input">
          <option value="CIN">CIN</option>
          <option value="PASSPORT">Passeport</option>
          <option value="RESIDENCE_PERMIT">Titre de séjour</option>
        </select>
        <input name="idNumber" placeholder="N° pièce d'identité" className="input" />
        <input name="licenseNumber" placeholder="N° permis" className="input" />
        <button className="btn">Ajouter</button>
      </form>

      <div className="card divide-y divide-gray-100 p-0">
        {customers.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <p className="font-semibold">{c.firstName} {c.lastName}</p>
              <p className="text-gray-500">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
            </div>
            {c.status !== "NORMAL" && (
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs">{c.status}</span>
            )}
          </div>
        ))}
        {customers.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun client pour le moment.</p>}
      </div>
    </div>
  );
}
