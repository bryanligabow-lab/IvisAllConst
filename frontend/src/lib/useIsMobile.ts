import { useEffect, useState } from 'react';

/**
 * true en pantallas de celular (<768px). Devuelve null hasta que monta, para
 * no renderizar la vista equivocada durante la hidratación.
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isMobile;
}
