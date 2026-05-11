import type { Metadata } from 'next';
import './globals.css';
import { WelcomePreloader } from '@/components/ui/WelcomePreloader';

export const metadata: Metadata = {
  title: 'CREACOM — Control de proyectos',
  description: 'Sistema de gestión de obra · Innovación, Proyectos, Servicios',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <WelcomePreloader />
        {children}
      </body>
    </html>
  );
}
