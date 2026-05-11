/**
 * Ilustraciones flat-design (corporate illustration) de construcción.
 * Inspiradas en el estilo de Storyset / unDraw: figuras humanas
 * proporcionadas, sombras suaves, paleta sólida CREACOM.
 */

const RED = '#C73E2C';
const RED_DARK = '#8E2419';
const RED_DEEP = '#5D1810';
const RED_LIGHT = '#E55B47';
const ORANGE = '#F47C5A';
const SKIN = '#F4C8A8';
const SKIN_SHADOW = '#D9A87F';
const HAIR_DARK = '#2D1B14';
const HAIR_BROWN = '#5E3E2B';
const HAT = '#FFFFFF';
const HAT_SHADOW = '#E8E1D8';
const VEST = '#E55B47';
const VEST_DARK = '#B73B2C';
const REFLECT = '#FCE9A6';
const PANT = '#2D2D33';
const PANT_LIGHT = '#3F3F47';
const SHOE = '#1A1A1F';
const GLOVE = '#3F3F47';
const BOARD_WOOD = '#A87049';
const BOARD_WOOD_DARK = '#7A4F30';
const PAPER = '#FBF5E8';
const DIRT = '#9C7B5C';
const DIRT_DARK = '#7C5A3E';

/* ============================================================
 * PERSONAJE MASCULINO — pose: apuntando hacia adelante
 * ============================================================ */
function MalePointing({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Sombra en el suelo */}
      <ellipse cx="0" cy="248" rx="55" ry="6" fill="#000" opacity="0.18" />

      {/* === PIERNAS === */}
      {/* Pierna izquierda (atrás) */}
      <path d="M -22 145 Q -24 175, -22 210 L -22 245 L -8 245 L -8 210 Q -10 175, -10 145 Z" fill={PANT} />
      {/* Pierna derecha (adelantada) */}
      <path d="M 4 145 Q 6 175, 8 210 L 8 245 L 22 245 L 22 210 Q 24 175, 22 145 Z" fill={PANT_LIGHT} />
      {/* Zapatos */}
      <ellipse cx="-15" cy="245" rx="14" ry="5" fill={SHOE} />
      <ellipse cx="15" cy="245" rx="14" ry="5" fill={SHOE} />

      {/* === TORSO === */}
      {/* Camisa interior negra (cuello + bajo el chaleco) */}
      <path d="M -8 50 L -7 70 L 7 70 L 8 50 Z" fill={PANT} />
      {/* Chaleco rojo (parte trasera/sombras) */}
      <path
        d="M -30 60 L -32 145 L 32 145 L 30 60 Q 22 50, 0 50 Q -22 50, -30 60 Z"
        fill={VEST_DARK}
      />
      {/* Chaleco frontal */}
      <path
        d="M -28 62 L -29 142 L 29 142 L 28 62 Q 20 54, 0 54 Q -20 54, -28 62 Z"
        fill={VEST}
      />
      {/* Cierre central vertical */}
      <line x1="0" y1="56" x2="0" y2="142" stroke={VEST_DARK} strokeWidth="1.5" />
      {/* Apertura del chaleco — V */}
      <path d="M -10 54 L 0 75 L 10 54 Z" fill={PANT} />
      {/* Franja reflectiva amarilla */}
      <rect x="-29" y="95" width="58" height="6" fill={REFLECT} />
      <rect x="-29" y="105" width="58" height="2" fill={REFLECT} opacity="0.7" />
      {/* Bolsillos */}
      <rect x="-22" y="115" width="14" height="14" rx="1" fill={VEST_DARK} />
      <rect x="8" y="115" width="14" height="14" rx="1" fill={VEST_DARK} />

      {/* === BRAZO IZQUIERDO (sosteniendo tablero) === */}
      {/* Hombro/brazo superior */}
      <path d="M -30 60 Q -38 70, -42 100 L -32 100 L -28 70 Z" fill={VEST} />
      {/* Antebrazo doblado (hacia el frente) */}
      <path d="M -42 100 Q -45 115, -38 132 L -28 132 L -32 100 Z" fill={VEST} />
      {/* Mano agarrando tablero */}
      <ellipse cx="-35" cy="138" rx="7" ry="6" fill={SKIN} />
      {/* Tablero/portapapeles */}
      <g transform="translate(-50, 110)">
        <rect x="0" y="0" width="32" height="42" rx="2" fill={BOARD_WOOD} />
        <rect x="2" y="2" width="28" height="36" fill={PAPER} />
        <rect x="11" y="-3" width="10" height="6" rx="1" fill={SHOE} />
        {/* Líneas en el papel */}
        <line x1="5" y1="10" x2="25" y2="10" stroke={PANT} strokeWidth="0.8" />
        <line x1="5" y1="15" x2="22" y2="15" stroke={PANT} strokeWidth="0.8" />
        <line x1="5" y1="20" x2="25" y2="20" stroke={PANT} strokeWidth="0.8" />
        <line x1="5" y1="25" x2="18" y2="25" stroke={PANT} strokeWidth="0.8" />
        <line x1="5" y1="30" x2="25" y2="30" stroke={PANT} strokeWidth="0.8" />
      </g>

      {/* === BRAZO DERECHO (apuntando) === */}
      <path d="M 28 60 Q 40 65, 52 78 L 45 88 Q 38 80, 28 78 Z" fill={VEST} />
      {/* Antebrazo extendido apuntando */}
      <path d="M 45 78 Q 60 75, 78 70 L 80 80 Q 65 85, 50 88 Z" fill={VEST} />
      {/* Mano/dedo apuntando */}
      <ellipse cx="82" cy="74" rx="6" ry="5" fill={SKIN} />
      <rect x="86" y="71" width="10" height="3.5" rx="1.5" fill={SKIN} />

      {/* === CABEZA + CARA === */}
      {/* Cuello */}
      <rect x="-6" y="45" width="12" height="12" fill={SKIN} />
      <path d="M -6 56 Q 0 60, 6 56 L 6 57 L -6 57 Z" fill={SKIN_SHADOW} />
      {/* Cabeza */}
      <ellipse cx="0" cy="28" rx="22" ry="24" fill={SKIN} />
      {/* Sombra suave en la cara */}
      <ellipse cx="6" cy="33" rx="12" ry="14" fill={SKIN_SHADOW} opacity="0.35" />
      {/* Cabello — flequillo asomando bajo el casco */}
      <path
        d="M -20 18 Q -16 12, -8 12 Q 0 10, 8 12 Q 16 14, 20 18 L 18 26 Q 14 22, 8 22 Q 0 22, -8 22 Q -14 22, -18 26 Z"
        fill={HAIR_BROWN}
      />
      {/* Patillas */}
      <path d="M -22 22 L -22 32 L -19 30 L -19 22 Z" fill={HAIR_BROWN} />
      <path d="M 22 22 L 22 32 L 19 30 L 19 22 Z" fill={HAIR_BROWN} />
      {/* Ojos */}
      <ellipse cx="-7" cy="30" rx="1.5" ry="2.5" fill={SHOE} />
      <ellipse cx="7" cy="30" rx="1.5" ry="2.5" fill={SHOE} />
      {/* Cejas */}
      <path d="M -11 25 Q -8 23, -5 25" stroke={HAIR_DARK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 5 25 Q 8 23, 11 25" stroke={HAIR_DARK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Boca (sonrisa) */}
      <path
        d="M -5 39 Q 0 43, 5 39"
        stroke={HAIR_DARK}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Mejilla rosada */}
      <circle cx="-12" cy="37" r="3" fill={RED_LIGHT} opacity="0.35" />
      <circle cx="12" cy="37" r="3" fill={RED_LIGHT} opacity="0.35" />

      {/* === CASCO === */}
      {/* Sombra del casco */}
      <ellipse cx="0" cy="13" rx="26" ry="6" fill="#000" opacity="0.12" />
      {/* Visera */}
      <ellipse cx="0" cy="13" rx="26" ry="5" fill={HAT_SHADOW} />
      <ellipse cx="0" cy="12" rx="26" ry="4" fill={HAT} />
      {/* Cuerpo del casco */}
      <path d="M -24 12 Q -24 -10, 0 -12 Q 24 -10, 24 12 Z" fill={HAT} />
      <path d="M -24 12 Q -24 -10, 0 -12 Q -8 -10, -14 -4 Q -22 4, -24 12 Z" fill={HAT_SHADOW} />
      {/* Banda roja del casco */}
      <path d="M -24 11 L 24 11 L 24 14 L -24 14 Z" fill={RED} />
      {/* Detalle frontal del casco (logo) */}
      <circle cx="0" cy="-2" r="2.5" fill={RED} />
    </g>
  );
}

/* ============================================================
 * PERSONAJE FEMENINO — pose: sentada con laptop
 * ============================================================ */
function FemaleSitting({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Sombra en el suelo */}
      <ellipse cx="0" cy="220" rx="55" ry="6" fill="#000" opacity="0.18" />

      {/* === SILLA (parte trasera) === */}
      <rect x="-32" y="120" width="6" height="100" fill={PANT} />
      <rect x="-28" y="-5" width="5" height="115" fill={PANT_LIGHT} />

      {/* === PIERNAS (sentada) === */}
      <path d="M -22 140 L -10 200 L 24 200 L 22 140 Q 22 130, 0 130 Q -22 130, -22 140 Z" fill={PANT} />
      {/* Zapatos */}
      <ellipse cx="-2" cy="210" rx="11" ry="5" fill={SHOE} />
      <ellipse cx="18" cy="210" rx="11" ry="5" fill={SHOE} />

      {/* === TORSO — sweater rojo de manga larga === */}
      <path d="M -28 55 L -32 138 L 30 138 L 26 55 Q 16 48, 0 48 Q -18 48, -28 55 Z" fill={VEST_DARK} />
      <path d="M -26 58 L -28 130 L 26 130 L 24 58 Q 14 52, 0 52 Q -16 52, -26 58 Z" fill={RED} />
      {/* Cuello del sweater */}
      <path d="M -8 50 Q 0 56, 8 50 L 8 58 Q 0 62, -8 58 Z" fill={VEST_DARK} />

      {/* === BRAZOS (hacia el laptop, doblados) === */}
      <path d="M -28 60 Q -34 75, -36 95 L -22 95 Q -22 75, -22 65 Z" fill={RED} />
      <path d="M 28 60 Q 34 75, 36 95 L 22 95 Q 22 75, 22 65 Z" fill={RED} />
      {/* Antebrazos hacia adelante hacia el teclado */}
      <path d="M -36 95 Q -36 115, -24 130 L -14 122 L -22 95 Z" fill={RED} />
      <path d="M 36 95 Q 36 115, 24 130 L 14 122 L 22 95 Z" fill={RED} />
      {/* Manos */}
      <ellipse cx="-20" cy="132" rx="8" ry="6" fill={SKIN} />
      <ellipse cx="20" cy="132" rx="8" ry="6" fill={SKIN} />

      {/* === CABEZA === */}
      <rect x="-6" y="42" width="12" height="10" fill={SKIN} />
      <ellipse cx="0" cy="26" rx="21" ry="23" fill={SKIN} />
      <ellipse cx="6" cy="30" rx="10" ry="13" fill={SKIN_SHADOW} opacity="0.3" />

      {/* === CABELLO LARGO === */}
      {/* Mechón frontal/flequillo */}
      <path
        d="M -20 20 Q -16 8, -8 8 Q 0 6, 8 8 Q 16 10, 20 20 L 18 26 Q 14 20, 8 20 Q 0 20, -8 20 Q -14 20, -18 26 Z"
        fill={HAIR_DARK}
      />
      {/* Mechones laterales largos */}
      <path
        d="M -22 18 Q -28 30, -28 55 Q -28 75, -22 90 L -16 85 Q -18 65, -18 45 Q -18 28, -16 22 Z"
        fill={HAIR_DARK}
      />
      <path
        d="M 22 18 Q 28 30, 28 55 Q 28 75, 22 90 L 16 85 Q 18 65, 18 45 Q 18 28, 16 22 Z"
        fill={HAIR_DARK}
      />

      {/* === CARA === */}
      <ellipse cx="-7" cy="28" rx="1.5" ry="2.5" fill={SHOE} />
      <ellipse cx="7" cy="28" rx="1.5" ry="2.5" fill={SHOE} />
      <path d="M -10 23 Q -7 21, -4 23" stroke={HAIR_DARK} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M 4 23 Q 7 21, 10 23" stroke={HAIR_DARK} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M -4 38 Q 0 41, 4 38" stroke={HAIR_DARK} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="-11" cy="35" r="2.5" fill={RED_LIGHT} opacity="0.4" />
      <circle cx="11" cy="35" r="2.5" fill={RED_LIGHT} opacity="0.4" />

      {/* === CASCO === */}
      <ellipse cx="0" cy="11" rx="25" ry="5" fill={HAT_SHADOW} />
      <ellipse cx="0" cy="10" rx="25" ry="4" fill={HAT} />
      <path d="M -23 10 Q -23 -12, 0 -14 Q 23 -12, 23 10 Z" fill={HAT} />
      <path d="M -23 10 Q -23 -12, 0 -14 Q -8 -12, -14 -6 Q -21 2, -23 10 Z" fill={HAT_SHADOW} />
      <path d="M -23 9 L 23 9 L 23 12 L -23 12 Z" fill={RED} />
      <circle cx="0" cy="-3" r="2.2" fill={RED} />
    </g>
  );
}

/* ============================================================
 * ILUSTRACIÓN 1 — Equipo planeando (mimics reference image)
 * ============================================================ */
export function IllustrationPlanning() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="dotBg" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#FFFFFF" opacity="0.06" />
        </pattern>
        <linearGradient id="paperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={PAPER} />
          <stop offset="100%" stopColor="#EDE3D0" />
        </linearGradient>
      </defs>

      {/* Patrón de puntos sutil de fondo */}
      <rect x="0" y="0" width="600" height="500" fill="url(#dotBg)" />

      {/* === PIZARRA / TABLERO === */}
      <g>
        {/* Soporte trasero */}
        <rect x="155" y="80" width="8" height="280" fill={BOARD_WOOD_DARK} />
        <rect x="427" y="80" width="8" height="280" fill={BOARD_WOOD_DARK} />
        {/* Marco de madera */}
        <rect x="140" y="60" width="310" height="220" rx="4" fill={BOARD_WOOD} />
        {/* Superficie blanca */}
        <rect x="152" y="72" width="286" height="196" fill="url(#paperGrad)" />

        {/* Boceto: grúa torre */}
        <g stroke={PANT_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round">
          {/* Mástil vertical */}
          <line x1="265" y1="240" x2="265" y2="100" />
          {/* Estructura del mástil (cruces) */}
          <line x1="258" y1="115" x2="272" y2="125" />
          <line x1="272" y1="115" x2="258" y2="125" />
          <line x1="258" y1="135" x2="272" y2="145" />
          <line x1="272" y1="135" x2="258" y2="145" />
          <line x1="258" y1="155" x2="272" y2="165" />
          <line x1="272" y1="155" x2="258" y2="165" />
          <line x1="258" y1="175" x2="272" y2="185" />
          <line x1="272" y1="175" x2="258" y2="185" />
          <line x1="258" y1="195" x2="272" y2="205" />
          <line x1="272" y1="195" x2="258" y2="205" />
          {/* Pluma horizontal */}
          <line x1="265" y1="100" x2="395" y2="100" />
          <line x1="265" y1="108" x2="395" y2="108" />
          {/* Tirantes diagonales */}
          <line x1="265" y1="90" x2="320" y2="100" />
          <line x1="265" y1="90" x2="375" y2="100" />
          {/* Contrapeso */}
          <line x1="240" y1="100" x2="265" y2="100" />
          <rect x="225" y="95" width="15" height="13" fill={PANT_LIGHT} />
          {/* Cabina */}
          <rect x="260" y="100" width="12" height="10" fill={PANT_LIGHT} />
          {/* Cable + gancho */}
          <line x1="345" y1="108" x2="345" y2="170" />
          <rect x="335" y="170" width="20" height="10" fill={RED} stroke={RED_DARK} />
        </g>

        {/* Boceto: edificio simple debajo */}
        <g stroke={RED} strokeWidth="2" fill="none">
          <rect x="180" y="220" width="60" height="40" />
          <line x1="195" y1="220" x2="195" y2="260" />
          <line x1="210" y1="220" x2="210" y2="260" />
          <line x1="225" y1="220" x2="225" y2="260" />
        </g>
        <g fill={RED} opacity="0.6">
          <circle cx="186" cy="230" r="1.5" />
          <circle cx="201" cy="230" r="1.5" />
          <circle cx="216" cy="230" r="1.5" />
          <circle cx="231" cy="230" r="1.5" />
          <circle cx="186" cy="245" r="1.5" />
          <circle cx="216" cy="245" r="1.5" />
          <circle cx="231" cy="245" r="1.5" />
        </g>
      </g>

      {/* === MESA Y LAPTOP === */}
      <g>
        {/* Tabla */}
        <rect x="320" y="350" width="230" height="10" fill={BOARD_WOOD_DARK} />
        <rect x="320" y="346" width="230" height="6" fill={BOARD_WOOD} />
        {/* Patas */}
        <rect x="328" y="360" width="8" height="80" fill={BOARD_WOOD_DARK} />
        <rect x="534" y="360" width="8" height="80" fill={BOARD_WOOD_DARK} />

        {/* Laptop */}
        <g transform="translate(385, 305)">
          {/* Base */}
          <path d="M -5 40 L 90 40 L 95 50 L -10 50 Z" fill={PANT} />
          <rect x="-5" y="38" width="95" height="4" fill={PANT_LIGHT} />
          {/* Pantalla */}
          <rect x="2" y="0" width="80" height="40" rx="2" fill={PANT} />
          <rect x="5" y="3" width="74" height="34" fill="#1E2A3A" />
          {/* Líneas de código simbólicas en la pantalla */}
          <rect x="9" y="8" width="22" height="2" fill={RED_LIGHT} />
          <rect x="9" y="13" width="16" height="2" fill="#7CB8FF" />
          <rect x="9" y="18" width="32" height="2" fill={REFLECT} />
          <rect x="9" y="23" width="20" height="2" fill={RED_LIGHT} />
          <rect x="9" y="28" width="38" height="2" fill="#7CB8FF" />
          {/* Logo */}
          <circle cx="42" cy="20" r="2" fill={HAT} opacity="0.5" />
        </g>
      </g>

      {/* === PERSONAJES === */}
      <MalePointing x={130} y={140} scale={0.95} />
      <FemaleSitting x={440} y={170} scale={0.95} />

      {/* === ELEMENTOS DE OBRA EN PRIMER PLANO === */}

      {/* Pila de tierra */}
      <g transform="translate(130, 470)">
        <ellipse cx="0" cy="10" rx="45" ry="6" fill={DIRT_DARK} opacity="0.4" />
        <path d="M -38 10 Q -25 -10, -10 -5 Q 5 -18, 20 -8 Q 35 -12, 40 10 Z" fill={DIRT} />
        <path d="M -38 10 Q -25 -10, -10 -5 Q 0 -8, 0 10 Z" fill={DIRT_DARK} />
        <circle cx="-15" cy="3" r="3" fill={DIRT_DARK} opacity="0.6" />
        <circle cx="10" cy="0" r="2.5" fill={DIRT_DARK} opacity="0.6" />
      </g>

      {/* Cono de tráfico */}
      <g transform="translate(55, 470)">
        <ellipse cx="0" cy="15" rx="22" ry="4" fill="#000" opacity="0.2" />
        <path d="M -18 12 L 18 12 L 12 -45 L -12 -45 Z" fill={ORANGE} />
        <path d="M -18 12 L 18 12 L 12 -45 L 0 -45 L 0 12 Z" fill={RED} opacity="0.5" />
        <rect x="-14" y="-8" width="28" height="6" fill={HAT} />
        <rect x="-11" y="-25" width="22" height="5" fill={HAT} />
        <rect x="-21" y="12" width="42" height="7" fill={PANT} />
      </g>

      {/* Barricada con franjas diagonales */}
      <g transform="translate(490, 455)">
        <rect x="-2" y="0" width="4" height="45" fill={PANT} />
        <rect x="42" y="0" width="4" height="45" fill={PANT} />
        <rect x="-2" y="8" width="48" height="14" fill={HAT} stroke={PANT} strokeWidth="1" />
        <path
          d="M 0 8 L 14 22 M 8 8 L 22 22 M 16 8 L 30 22 M 24 8 L 38 22 M 32 8 L 46 22 M 40 8 L 46 14"
          stroke={RED}
          strokeWidth="4"
        />
        <rect x="-2" y="26" width="48" height="14" fill={HAT} stroke={PANT} strokeWidth="1" />
        <path
          d="M 0 26 L 14 40 M 8 26 L 22 40 M 16 26 L 30 40 M 24 26 L 38 40 M 32 26 L 46 40 M 40 26 L 46 32"
          stroke={RED}
          strokeWidth="4"
        />
      </g>

      {/* Pequeño cable enrollado */}
      <g transform="translate(220, 480)">
        <circle cx="0" cy="0" r="14" fill="none" stroke={RED_DEEP} strokeWidth="3" />
        <circle cx="0" cy="0" r="10" fill="none" stroke={RED_DEEP} strokeWidth="3" />
        <circle cx="0" cy="0" r="6" fill="none" stroke={RED_DEEP} strokeWidth="3" />
      </g>
    </svg>
  );
}

/* ============================================================
 * ILUSTRACIÓN 2 — Trabajador estudiando plano
 * ============================================================ */
export function IllustrationBlueprint() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="dotBg2" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#FFFFFF" opacity="0.06" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="600" height="500" fill="url(#dotBg2)" />

      {/* Mesa grande con plano */}
      <g>
        <rect x="60" y="320" width="480" height="14" fill={BOARD_WOOD_DARK} />
        <rect x="60" y="316" width="480" height="6" fill={BOARD_WOOD} />
        <rect x="70" y="334" width="10" height="120" fill={BOARD_WOOD_DARK} />
        <rect x="520" y="334" width="10" height="120" fill={BOARD_WOOD_DARK} />

        {/* Plano sobre la mesa */}
        <g transform="translate(110, 220)">
          <rect x="0" y="0" width="380" height="100" fill={PAPER} stroke={PANT} strokeWidth="2" />
          {/* Líneas de planta arquitectónica */}
          <rect x="20" y="15" width="140" height="70" fill="none" stroke={RED} strokeWidth="2" />
          <line x1="20" y1="50" x2="160" y2="50" stroke={RED} strokeWidth="1.5" />
          <line x1="90" y1="15" x2="90" y2="85" stroke={RED} strokeWidth="1.5" />
          <rect x="35" y="25" width="18" height="15" fill="none" stroke={RED} strokeWidth="1" />
          <rect x="100" y="25" width="18" height="15" fill="none" stroke={RED} strokeWidth="1" />
          <rect x="35" y="60" width="22" height="18" fill="none" stroke={RED} strokeWidth="1" />
          <rect x="100" y="60" width="22" height="18" fill="none" stroke={RED} strokeWidth="1" />

          <rect x="180" y="15" width="180" height="70" fill="none" stroke={RED} strokeWidth="2" />
          <circle cx="270" cy="50" r="22" fill="none" stroke={RED} strokeWidth="1.5" />
          <line x1="248" y1="28" x2="292" y2="72" stroke={RED} strokeWidth="0.8" opacity="0.5" />
          <line x1="292" y1="28" x2="248" y2="72" stroke={RED} strokeWidth="0.8" opacity="0.5" />

          {/* Esquina doblada */}
          <path d="M 360 0 L 380 0 L 380 20 Z" fill="#E8DFC9" />
          <line x1="360" y1="0" x2="380" y2="20" stroke={PANT} strokeWidth="0.5" />
        </g>

        {/* Regla */}
        <g transform="translate(380, 215)">
          <rect x="0" y="0" width="110" height="10" fill="#FBEBA0" stroke={PANT} strokeWidth="1" />
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={i}
              x1={10 * (i + 1)}
              y1="0"
              x2={10 * (i + 1)}
              y2={i % 5 === 4 ? 8 : 5}
              stroke={PANT}
              strokeWidth="0.6"
            />
          ))}
        </g>

        {/* Lápiz */}
        <g transform="translate(160, 200) rotate(28)">
          <rect x="0" y="0" width="90" height="8" fill="#F4B860" />
          <rect x="80" y="0" width="10" height="8" fill="#E8E2DA" />
          <rect x="90" y="2" width="3" height="4" fill={RED_LIGHT} />
          <path d="M 0 0 L -10 4 L 0 8 Z" fill={HAIR_DARK} />
        </g>
      </g>

      {/* Personaje (mismo masculino apuntando al plano) */}
      <MalePointing x={300} y={70} scale={1} />

      {/* Café */}
      <g transform="translate(75, 250)">
        <ellipse cx="0" cy="50" rx="25" ry="4" fill="#000" opacity="0.15" />
        <path d="M -18 0 L -16 50 L 16 50 L 18 0 Z" fill={HAT} stroke={PANT} strokeWidth="1.5" />
        <ellipse cx="0" cy="0" rx="18" ry="3" fill={RED_DARK} />
        <path d="M 18 12 Q 32 12, 32 26 Q 32 38, 18 38" fill="none" stroke={PANT} strokeWidth="1.5" />
        <path
          d="M -8 -10 Q -8 -18, -4 -18 M 0 -10 Q 0 -22, 4 -22 M 8 -10 Q 8 -16, 12 -16"
          stroke="#A0A0A0"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Sombra general */}
      <ellipse cx="300" cy="475" rx="200" ry="6" fill="#000" opacity="0.1" />
    </svg>
  );
}

/* ============================================================
 * ILUSTRACIÓN 3 — Sitio de construcción con grúa y edificios
 * ============================================================ */
export function IllustrationSite() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="dotBg3" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#FFFFFF" opacity="0.06" />
        </pattern>
        <linearGradient id="buildingFinished" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={PAPER} />
          <stop offset="100%" stopColor="#EDE3D0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="600" height="500" fill="url(#dotBg3)" />

      {/* Sol decorativo */}
      <circle cx="510" cy="80" r="38" fill={ORANGE} opacity="0.25" />
      <circle cx="510" cy="80" r="26" fill={ORANGE} opacity="0.4" />
      <circle cx="510" cy="80" r="16" fill={REFLECT} opacity="0.7" />

      {/* Línea de suelo */}
      <rect x="0" y="430" width="600" height="50" fill={DIRT_DARK} opacity="0.18" />
      <line x1="0" y1="432" x2="600" y2="432" stroke={PANT} strokeWidth="1.5" />

      {/* Edificio terminado izquierda */}
      <g>
        <rect x="60" y="200" width="130" height="232" fill="url(#buildingFinished)" stroke={PANT} strokeWidth="2" />
        {/* Tapa superior */}
        <rect x="55" y="195" width="140" height="10" fill={RED_DARK} />
        {/* Ventanas */}
        {[0, 1, 2, 3, 4, 5].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={75 + col * 32}
              y={215 + row * 32}
              width="22"
              height="22"
              fill={RED}
              opacity={(row + col) % 2 === 0 ? 0.9 : 0.55}
              stroke={RED_DARK}
              strokeWidth="0.5"
            />
          )),
        )}
        {/* Puerta */}
        <rect x="105" y="400" width="40" height="32" fill={PANT} />
        <circle cx="138" cy="416" r="1.8" fill={REFLECT} />
      </g>

      {/* Edificio en construcción derecha */}
      <g>
        <rect x="270" y="270" width="160" height="162" fill="#E8DFD3" stroke={PANT} strokeWidth="2" />
        {/* Andamio */}
        <g stroke={PANT} strokeWidth="1.2">
          <line x1="270" y1="305" x2="430" y2="305" />
          <line x1="270" y1="345" x2="430" y2="345" />
          <line x1="270" y1="385" x2="430" y2="385" />
          <line x1="310" y1="270" x2="310" y2="432" />
          <line x1="350" y1="270" x2="350" y2="432" />
          <line x1="390" y1="270" x2="390" y2="432" />
        </g>
        {/* Ventanas parciales */}
        <rect x="285" y="315" width="20" height="24" fill={RED_LIGHT} opacity="0.7" />
        <rect x="320" y="315" width="20" height="24" fill={RED_LIGHT} opacity="0.7" />
        <rect x="360" y="315" width="20" height="24" fill={PANT} opacity="0.35" />
        <rect x="400" y="315" width="20" height="24" fill={PANT} opacity="0.35" />
        {/* Esquina marcada */}
        <path d="M 270 270 L 290 290 L 270 290 Z" fill={RED} />
      </g>

      {/* GRÚA TORRE */}
      <g>
        {/* Mástil */}
        <rect x="445" y="130" width="12" height="302" fill={PANT} />
        {/* Cruces estructurales del mástil */}
        {Array.from({ length: 9 }).map((_, i) => (
          <g key={i}>
            <line x1="445" y1={150 + i * 30} x2="457" y2={170 + i * 30} stroke={PANT_LIGHT} strokeWidth="1" />
            <line x1="457" y1={150 + i * 30} x2="445" y2={170 + i * 30} stroke={PANT_LIGHT} strokeWidth="1" />
          </g>
        ))}
        {/* Pluma horizontal */}
        <rect x="280" y="125" width="220" height="10" fill={RED} />
        <rect x="280" y="135" width="220" height="3" fill={RED_DARK} />
        {/* Tirantes triangulares */}
        <polygon points="451,110 290,128 500,128" fill={RED} opacity="0.85" />
        <line x1="451" y1="115" x2="295" y2="128" stroke={PANT} strokeWidth="1.2" />
        <line x1="451" y1="115" x2="495" y2="128" stroke={PANT} strokeWidth="1.2" />
        {/* Contrapeso */}
        <rect x="488" y="120" width="20" height="22" fill={PANT} />
        {/* Cabina */}
        <rect x="443" y="138" width="16" height="14" fill={PANT} />
        <rect x="445" y="140" width="12" height="6" fill="#7CB8FF" opacity="0.5" />
        {/* Cable + carga */}
        <line x1="350" y1="135" x2="350" y2="220" stroke={PANT} strokeWidth="1.2" />
        <rect x="332" y="220" width="36" height="18" fill={RED_DARK} stroke={PANT} strokeWidth="1" />
        <line x1="345" y1="238" x2="355" y2="238" stroke={PANT} strokeWidth="0.5" />
      </g>

      {/* Personaje en primer plano */}
      <MalePointing x={210} y={300} scale={0.85} />

      {/* Carretilla */}
      <g transform="translate(400, 410)">
        <rect x="-5" y="-22" width="50" height="18" rx="2" fill={RED_DARK} />
        <rect x="-5" y="-26" width="50" height="6" fill={RED} />
        <circle cx="5" cy="10" r="11" fill={PANT} />
        <circle cx="5" cy="10" r="5" fill={REFLECT} />
        <rect x="42" y="-12" width="30" height="4" rx="1" fill={PANT_LIGHT} />
        <rect x="68" y="-15" width="8" height="12" rx="2" fill={PANT} />
      </g>

      {/* Arbustos pequeños */}
      <g>
        <ellipse cx="35" cy="432" rx="18" ry="6" fill="#3D7C47" opacity="0.7" />
        <circle cx="30" cy="425" r="10" fill="#4A8E54" />
        <circle cx="42" cy="427" r="8" fill="#3D7C47" />
        <ellipse cx="565" cy="432" rx="18" ry="6" fill="#3D7C47" opacity="0.7" />
        <circle cx="560" cy="425" r="10" fill="#4A8E54" />
        <circle cx="572" cy="427" r="8" fill="#3D7C47" />
      </g>
    </svg>
  );
}

/* ============================================================
 * Lista exportable
 * ============================================================ */
export const LOGIN_ILLUSTRATIONS = [
  IllustrationPlanning,
  IllustrationBlueprint,
  IllustrationSite,
];
