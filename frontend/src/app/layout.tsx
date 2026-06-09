import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WelcomePreloader } from '@/components/ui/WelcomePreloader';
import { THEME_INIT_SCRIPT } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: 'CREACOM — Control de proyectos',
  description: 'Sistema de gestión de obra · Innovación, Proyectos, Servicios',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Aplicar el tema guardado antes del primer render para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <WelcomePreloader />
        {children}
      </body>
    </html>
  );
}
