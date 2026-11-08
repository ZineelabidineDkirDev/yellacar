import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YellaCar",
  description: "Gestion d'agence de location de voitures",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
