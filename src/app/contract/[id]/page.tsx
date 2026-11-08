import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { dt, money } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const CLAUSES = [
  "Le locataire reconnaît avoir reçu le véhicule en bon état, propre et avec les accessoires listés à l’état des lieux.",
  "Le véhicule doit être restitué à la date, à l’heure et au lieu convenus. Tout retard peut entraîner la facturation de jours supplémentaires.",
  "Seuls le locataire et les conducteurs additionnels déclarés, titulaires d’un permis valide, sont autorisés à conduire.",
  "Le carburant doit être restitué au même niveau qu’au départ, sinon le manquant est facturé.",
  "Le locataire est responsable des amendes, péages et infractions commis pendant la période de location.",
  "En cas de dommage ou de sinistre, le locataire prévient immédiatement le loueur ; la franchise de la protection choisie s’applique.",
  "Il est interdit de sous-louer le véhicule, de l’utiliser pour des courses ou de le conduire hors du territoire sans accord écrit.",
  "La caution est restituée au retour du véhicule, après vérification de son état, déduction faite des sommes éventuellement dues.",
];

export default async function ContractPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const r = await db.reservation.findFirst({
    where: { id: params.id, companyId },
    include: { customer: true, vehicle: true, protection: true, contract: true, options: { include: { option: true } } },
  });
  if (!r) notFound();
  if (!r.contract) redirect(`/reservations/${r.id}`);
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm print:p-0">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p>{[company.city, company.phone, company.email].filter(Boolean).join(" · ")}</p>
          {company.ice && <p>ICE : {company.ice}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">CONTRAT DE LOCATION</p>
          <p>N° {r.contract.number}</p>
          <p>Réservation {r.number}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded border p-3">
          <p className="mb-1 font-bold">Locataire</p>
          <p>{r.customer.firstName} {r.customer.lastName}</p>
          <p>Tél : {r.customer.phone}</p>
          {r.customer.idNumber && <p>{r.customer.idType ?? "Pièce"} : {r.customer.idNumber}</p>}
          {r.customer.licenseNumber && <p>Permis : {r.customer.licenseNumber}</p>}
        </div>
        <div className="rounded border p-3">
          <p className="mb-1 font-bold">Véhicule</p>
          {r.vehicle ? (<><p>{r.vehicle.brand} {r.vehicle.model}</p><p>Immatriculation : {r.vehicle.plate}</p><p>Kilométrage départ : {r.vehicle.mileage} km</p></>) : <p>—</p>}
        </div>
      </div>

      <div className="mb-4 rounded border p-3">
        <p><b>Départ :</b> {dt(r.pickupAt)} &nbsp; <b>Retour prévu :</b> {dt(r.returnAt)} &nbsp; <b>Durée :</b> {r.days} j</p>
        {r.protection && <p><b>Protection :</b> {r.protection.name} (franchise {money(Number(r.protection.deductible))})</p>}
        {r.options.length > 0 && <p><b>Options :</b> {r.options.map((o) => `${o.option.name} ×${o.quantity}`).join(", ")}</p>}
        <p className="mt-2 text-base"><b>Total :</b> {money(Number(r.total))}
          {r.depositAmount && <> &nbsp; <b>Caution :</b> {money(Number(r.depositAmount))}</>}</p>
      </div>

      <ol className="mb-6 list-decimal space-y-1 pl-5">
        {CLAUSES.map((c, i) => <li key={i}>{c}</li>)}
      </ol>

      <div className="grid grid-cols-2 gap-8 pt-6">
        <div className="h-24 rounded border p-2">Signature du locataire</div>
        <div className="h-24 rounded border p-2">Signature et cachet du loueur</div>
      </div>
      <p className="mt-4 text-xs text-gray-500">Modèle indicatif : faites-le valider par un professionnel du droit avant usage.</p>

      <div className="mt-6"><PrintButton /></div>
    </div>
  );
}
