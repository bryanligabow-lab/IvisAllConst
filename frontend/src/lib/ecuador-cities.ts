// Ciudades principales de Ecuador con coordenadas aproximadas (lat, lng).
// Usadas para el selector al crear proyecto y para el mapa del dashboard.

export interface EcuadorCity {
  name: string;
  province: string;
  lat: number;
  lng: number;
}

export const ECUADOR_CITIES: EcuadorCity[] = [
  { name: 'Quito', province: 'Pichincha', lat: -0.1807, lng: -78.4678 },
  { name: 'Guayaquil', province: 'Guayas', lat: -2.1709, lng: -79.9224 },
  { name: 'Cuenca', province: 'Azuay', lat: -2.9006, lng: -79.0045 },
  { name: 'Santo Domingo', province: 'Santo Domingo de los Tsáchilas', lat: -0.2533, lng: -79.1717 },
  { name: 'Machala', province: 'El Oro', lat: -3.2581, lng: -79.9606 },
  { name: 'Manta', province: 'Manabí', lat: -0.9677, lng: -80.7089 },
  { name: 'Portoviejo', province: 'Manabí', lat: -1.0541, lng: -80.4525 },
  { name: 'Ambato', province: 'Tungurahua', lat: -1.2491, lng: -78.6168 },
  { name: 'Riobamba', province: 'Chimborazo', lat: -1.6635, lng: -78.6547 },
  { name: 'Loja', province: 'Loja', lat: -3.9931, lng: -79.2042 },
  { name: 'Esmeraldas', province: 'Esmeraldas', lat: 0.9592, lng: -79.6539 },
  { name: 'Ibarra', province: 'Imbabura', lat: 0.3508, lng: -78.1223 },
  { name: 'Latacunga', province: 'Cotopaxi', lat: -0.9333, lng: -78.6167 },
  { name: 'Quevedo', province: 'Los Ríos', lat: -1.0227, lng: -79.4615 },
  { name: 'Babahoyo', province: 'Los Ríos', lat: -1.8019, lng: -79.5345 },
  { name: 'Milagro', province: 'Guayas', lat: -2.1342, lng: -79.5872 },
  { name: 'Daule', province: 'Guayas', lat: -1.8617, lng: -79.9778 },
  { name: 'Durán', province: 'Guayas', lat: -2.1717, lng: -79.8347 },
  { name: 'Tulcán', province: 'Carchi', lat: 0.8129, lng: -77.7172 },
  { name: 'Macas', province: 'Morona Santiago', lat: -2.3083, lng: -78.1167 },
  { name: 'Nueva Loja (Lago Agrio)', province: 'Sucumbíos', lat: 0.0856, lng: -76.8889 },
  { name: 'Puyo', province: 'Pastaza', lat: -1.4833, lng: -77.9833 },
  { name: 'Tena', province: 'Napo', lat: -0.9933, lng: -77.8156 },
  { name: 'Zamora', province: 'Zamora Chinchipe', lat: -4.0667, lng: -78.95 },
  { name: 'Azogues', province: 'Cañar', lat: -2.7333, lng: -78.85 },
  { name: 'Salinas', province: 'Santa Elena', lat: -2.2139, lng: -80.9617 },
  { name: 'Otavalo', province: 'Imbabura', lat: 0.2333, lng: -78.2667 },
];

export function findCity(name: string): EcuadorCity | undefined {
  return ECUADOR_CITIES.find((c) => c.name === name);
}
