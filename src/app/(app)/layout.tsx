import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { logout } from "../login/actions";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/reservations", label: "Réservations" },
  { href: "/planning", label: "Planning" },
  { href: "/vehicles", label: "Flotte" },
  { href: "/customers", label: "Clients" },
  { href: "/pricing", label: "Tarifs" },
  { href: "/finance", label: "Finance" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-gray-200 bg-white p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="mb-4 text-xl font-bold">
          Yella<span className="text-brand">Car</span>
        </div>
        <nav className="flex flex-wrap gap-2 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm hover:bg-brand/20">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="mt-4">
          <p className="mb-2 text-xs text-gray-500">{session.name}</p>
          <button className="text-xs text-gray-500 underline">Déconnexion</button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
