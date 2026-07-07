import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WelcomePreloader } from '@/components/ui/WelcomePreloader';
import { THEME_INIT_SCRIPT } from '@/components/ui/ThemeToggle';
import { PWARegister } from '@/components/ui/PWARegister';
import { InstallPWA } from '@/components/ui/InstallPWA';

export const metadata: Metadata = {
  title: 'CREACOM — Control de proyectos',
  description: 'Sistema de gestión de obra · Innovación, Proyectos, Servicios',
  applicationName: 'CREACOM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CREACOM',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#C73E2C',
  viewportFit: 'cover',
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
        <PWARegister />
        <InstallPWA />
      </body>
    </html>
  );
}
