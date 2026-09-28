import { apiPost, apiFetchBlob } from '@/lib/api';

/** Un rubro leído del archivo, ya listo para meterlo en el formulario. */
export interface RubroImportado {
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  /** '15' | '0' | 'NO_OBJETO' | 'EXENTO' | null (null = IVA general) */
  vatMode: string | null;
}

export interface LecturaArchivo {
  items: RubroImportado[];
  avisos: string[];
}

/** Manda el archivo al servidor y devuelve los rubros que entendió. */
export async function leerRubrosDeArchivo(file: File): Promise<LecturaArchivo> {
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
  return (await apiPost('/proformas/parse-items', {
    filename: file.name,
    fileBase64,
  })) as LecturaArchivo;
}

/** Descarga la plantilla de cómo debe venir ordenada la data. */
export async function descargarPlantillaRubros(): Promise<void> {
  const blob = await apiFetchBlob('/proformas/import-template');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Plantilla de rubros - CREACOM.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
