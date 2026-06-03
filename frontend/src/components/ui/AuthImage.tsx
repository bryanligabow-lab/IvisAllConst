'use client';

import { useEffect, useState } from 'react';
import { apiFetchBlob } from '@/lib/api';

interface Props {
  path: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Imagen servida por la API protegida con Bearer token (no se puede usar
// <img src> directo). Descarga el binario como blob y lo muestra vía objectURL.
export function AuthImage({ path, alt = '', className, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setFailed(false);
    setUrl(null);
    apiFetchBlob(path)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-muted text-[10px] text-ink-tertiary ${className ?? ''}`}>
        sin imagen
      </div>
    );
  }
  if (!url) {
    return <div className={`animate-pulse bg-surface-muted ${className ?? ''}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}
