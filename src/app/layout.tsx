import type { Metadata } from "next";
import { AppShell } from "@/ui/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestión Patrimonio",
  description: "Monthly patrimony tracking MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
