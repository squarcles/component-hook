import type { Metadata } from "next";
import Link from "next/link";
import { BuildProvider } from "@/lib/build";
import ExtensionNotice from "@/components/ExtensionNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Component Hook",
  description: "Composez votre PC et trouvez le meilleur prix pour chaque composant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <BuildProvider>
          <header className="header">
            <Link href="/" className="logo">
              Component Hook
            </Link>
            <span className="tagline">Le comparateur de prix pour monter votre PC</span>
          </header>
          <main className="main">
            <ExtensionNotice />
            {children}
          </main>
        </BuildProvider>
      </body>
    </html>
  );
}
