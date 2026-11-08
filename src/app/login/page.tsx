import { login } from "./actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">
          Yella<span className="text-brand">Car</span>
        </h1>
        <p className="text-sm text-gray-500">Connectez-vous à votre agence.</p>
        {searchParams.error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Email ou mot de passe incorrect.</p>
        )}
        <input name="email" type="email" placeholder="Email" required className="input" />
        <input name="password" type="password" placeholder="Mot de passe" required className="input" />
        <button className="btn w-full">Se connecter</button>
      </form>
    </main>
  );
}
