import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IvisAllConst — Control de proyectos',
  description: 'Sistema de gestión de proyectos de construcción',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
