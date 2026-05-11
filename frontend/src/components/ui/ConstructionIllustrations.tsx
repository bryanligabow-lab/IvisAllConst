/**
 * Ilustraciones flat-cartoon de construcción para la página de login.
 * Estilo simple, geométrico, con la paleta CREACOM (rojo + crema + dark).
 */

const RED = '#C73E2C';
const RED_DARK = '#9C2A1C';
const RED_LIGHT = '#FCEDEA';
const CREAM = '#FAF7F4';
const DARK = '#1A1A1A';
const SKIN = '#FFD3B6';
const HAT = '#FFFFFF';
const VEST = '#E55B47';

/* ============================================================
 * Helper: figura humana simplificada (estilo plano)
 * ============================================================ */
function Worker({
  x,
  y,
  facing = 'right',
  pose = 'standing',
}: {
  x: number;
  y: number;
  facing?: 'left' | 'right';
  pose?: 'standing' | 'pointing' | 'sitting';
}) {
  const flip = facing === 'left' ? -1 : 1;
  return (
    <g transform={`translate(${x},${y}) scale(${flip},1)`}>
      {/* Sombra */}
      <ellipse cx="0" cy="90" rx="22" ry="3" fill={DARK} opacity="0.12" />

      {/* Piernas */}
      <rect x="-12" y="55" width="9" height="35" rx="2" fill={DARK} />
      <rect x="3" y="55" width="9" height="35" rx="2" fill={DARK} />

      {/* Zapatos */}
      <rect x="-14" y="85" width="13" height="6" rx="2" fill={DARK} />
      <rect x="1" y="85" width="13" height="6" rx="2" fill={DARK} />

      {/* Torso (chaleco rojo) */}
      <path d="M -16 25 L -14 60 L 14 60 L 16 25 Q 10 18, 0 18 Q -10 18, -16 25 Z" fill={VEST} />
      {/* Franja reflectiva */}
      <rect x="-16" y="38" width="32" height="3" fill="#E0E0E0" opacity="0.7" />

      {pose === 'pointing' ? (
        /* brazo apuntando */
        <>
          <rect x="-22" y="28" width="8" height="18" rx="3" fill={VEST} />
          <rect x="14" y="20" width="18" height="6" rx="2" fill={VEST} />
          <circle cx="34" cy="23" r="4" fill={SKIN} />
        </>
      ) : (
        /* brazos relajados */
        <>
          <rect x="-22" y="28" width="8" height="22" rx="3" fill={VEST} />
          <rect x="14" y="28" width="8" height="22" rx="3" fill={VEST} />
          <circle cx="-18" cy="52" r="4" fill={SKIN} />
          <circle cx="18" cy="52" r="4" fill={SKIN} />
        </>
      )}

      {/* Cabeza */}
      <circle cx="0" cy="8" r="11" fill={SKIN} />

      {/* Casco */}
      <path
        d="M -13 8 Q -13 -8, 0 -8 Q 13 -8, 13 8 L 13 9 L -13 9 Z"
        fill={HAT}
        stroke={DARK}
        strokeWidth="0.5"
      />
      <rect x="-13" y="7" width="26" height="2.5" fill={RED} />

      {/* Detalle facial muy simple */}
      <circle cx="-3" cy="9" r="0.9" fill={DARK} />
      <circle cx="3" cy="9" r="0.9" fill={DARK} />
    </g>
  );
}

/* ============================================================
 * ILUSTRACIÓN 1 — Equipo planeando un proyecto
 * Trabajadora con laptop + colega apuntando a la pizarra
 * ============================================================ */
export function IllustrationPlanning() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="boardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0EAE4" />
        </linearGradient>
      </defs>

      {/* Suelo */}
      <ellipse cx="300" cy="450" rx="240" ry="12" fill={DARK} opacity="0.08" />

      {/* Pizarra con plano */}
      <g>
        <rect x="180" y="80" width="280" height="200" rx="6" fill="url(#boardGrad)" stroke={DARK} strokeWidth="2" />
        {/* Marco del soporte */}
        <rect x="190" y="280" width="6" height="100" fill={DARK} />
        <rect x="444" y="280" width="6" height="100" fill={DARK} />
        {/* Diseño en la pizarra: una grúa + edificio */}
        {/* Edificio */}
        <rect x="220" y="170" width="80" height="90" fill="none" stroke={RED} strokeWidth="2" />
        <rect x="232" y="185" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="256" y="185" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="280" y="185" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="232" y="210" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="256" y="210" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="280" y="210" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="232" y="235" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        <rect x="256" y="235" width="14" height="14" fill="none" stroke={RED} strokeWidth="1.5" />
        {/* Grúa */}
        <line x1="320" y1="260" x2="320" y2="110" stroke={RED} strokeWidth="3" />
        <line x1="320" y1="115" x2="430" y2="115" stroke={RED} strokeWidth="3" />
        <line x1="320" y1="115" x2="290" y2="135" stroke={RED} strokeWidth="2" />
        <line x1="320" y1="115" x2="290" y2="100" stroke={RED} strokeWidth="1.5" />
        <line x1="400" y1="115" x2="400" y2="160" stroke={RED} strokeWidth="1.5" />
        <rect x="392" y="160" width="16" height="14" fill={RED} />
        <line x1="320" y1="260" x2="310" y2="265" stroke={RED} strokeWidth="2" />
        <line x1="320" y1="260" x2="330" y2="265" stroke={RED} strokeWidth="2" />
      </g>

      {/* Trabajador apuntando (izquierda) */}
      <Worker x={135} y={270} facing="right" pose="pointing" />

      {/* Mesa */}
      <rect x="320" y="320" width="180" height="8" fill={DARK} />
      <rect x="328" y="328" width="6" height="60" fill={DARK} />
      <rect x="486" y="328" width="6" height="60" fill={DARK} />

      {/* Laptop sobre la mesa */}
      <g>
        <rect x="365" y="298" width="80" height="6" fill={DARK} />
        <path d="M 365 304 L 358 320 L 452 320 L 445 304 Z" fill={DARK} />
        <rect x="370" y="278" width="70" height="22" rx="2" fill={DARK} />
        <rect x="373" y="281" width="64" height="16" fill={RED_LIGHT} />
        {/* Líneas de código simbólicas */}
        <rect x="376" y="284" width="20" height="1.5" fill={RED} />
        <rect x="376" y="288" width="14" height="1.5" fill={RED} />
        <rect x="376" y="292" width="24" height="1.5" fill={RED} />
      </g>

      {/* Trabajadora sentada con laptop (derecha) */}
      <g transform="translate(420, 260)">
        {/* Silla simple */}
        <rect x="-10" y="50" width="36" height="6" fill={DARK} />
        <rect x="-12" y="0" width="6" height="56" fill={DARK} />
        <rect x="-12" y="55" width="6" height="35" fill={DARK} />
        <rect x="24" y="55" width="6" height="35" fill={DARK} />
        {/* Cabeza */}
        <circle cx="8" cy="10" r="11" fill={SKIN} />
        <path d="M -3 1 Q 8 -8, 19 1 L 19 14 Q 16 16, 14 13 Q 12 11, 8 11 Q 4 11, 2 13 Q 0 16, -3 14 Z" fill={DARK} />
        {/* Sweater rojo */}
        <path d="M -6 22 L -8 50 L 24 50 L 22 22 Q 16 18, 8 18 Q 0 18, -6 22 Z" fill={RED} />
        {/* Brazos hacia la laptop (más bajo) */}
        <rect x="-10" y="28" width="8" height="20" rx="3" fill={RED} />
        <rect x="18" y="28" width="8" height="20" rx="3" fill={RED} />
      </g>

      {/* Cono de tráfico */}
      <g transform="translate(80, 410)">
        <ellipse cx="0" cy="20" rx="20" ry="4" fill={DARK} opacity="0.12" />
        <path d="M -16 18 L 16 18 L 10 -25 L -10 -25 Z" fill={RED} />
        <rect x="-12" y="0" width="24" height="4" fill="#FFFFFF" />
        <rect x="-10" y="-12" width="20" height="3" fill="#FFFFFF" />
        <rect x="-18" y="18" width="36" height="5" fill={DARK} />
      </g>

      {/* Pequeña pila de tierra */}
      <g transform="translate(180, 420)">
        <ellipse cx="0" cy="0" rx="32" ry="8" fill="#9C7B5C" />
        <ellipse cx="0" cy="-4" rx="20" ry="6" fill="#A88862" />
      </g>

      {/* Barricada */}
      <g transform="translate(60, 380)">
        <rect x="-2" y="0" width="4" height="40" fill={DARK} />
        <rect x="36" y="0" width="4" height="40" fill={DARK} />
        <rect x="-2" y="6" width="42" height="10" fill="#FFFFFF" stroke={DARK} strokeWidth="1" />
        <path d="M 0 6 L 10 16 M 8 6 L 18 16 M 16 6 L 26 16 M 24 6 L 34 16" stroke={RED} strokeWidth="3" />
      </g>
    </svg>
  );
}

/* ============================================================
 * ILUSTRACIÓN 2 — Operario revisando plano
 * ============================================================ */
export function IllustrationBlueprint() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {/* Suelo */}
      <ellipse cx="300" cy="450" rx="240" ry="12" fill={DARK} opacity="0.08" />

      {/* Plano grande extendido */}
      <g>
        <rect x="100" y="200" width="400" height="220" rx="4" fill="#FFFFFF" stroke={DARK} strokeWidth="2" />
        {/* Líneas de plano arquitectónico */}
        <rect x="130" y="230" width="160" height="100" fill="none" stroke={RED} strokeWidth="2" />
        <line x1="130" y1="280" x2="290" y2="280" stroke={RED} strokeWidth="1" />
        <line x1="210" y1="230" x2="210" y2="330" stroke={RED} strokeWidth="1" />
        <rect x="160" y="240" width="20" height="20" fill="none" stroke={RED} strokeWidth="1" />
        <rect x="230" y="240" width="20" height="20" fill="none" stroke={RED} strokeWidth="1" />
        <rect x="160" y="295" width="40" height="25" fill="none" stroke={RED} strokeWidth="1" />
        <rect x="240" y="295" width="40" height="25" fill="none" stroke={RED} strokeWidth="1" />

        {/* Otro bloque */}
        <rect x="310" y="230" width="160" height="100" fill="none" stroke={RED} strokeWidth="2" />
        <line x1="310" y1="280" x2="470" y2="280" stroke={RED} strokeWidth="1" />
        <circle cx="390" cy="280" r="20" fill="none" stroke={RED} strokeWidth="1" />
        <line x1="370" y1="260" x2="410" y2="300" stroke={RED} strokeWidth="0.5" />

        {/* Cotas */}
        <text x="220" y="380" textAnchor="middle" fontSize="11" fill={DARK} fontFamily="monospace">
          12.5 m
        </text>
        <text x="390" y="380" textAnchor="middle" fontSize="11" fill={DARK} fontFamily="monospace">
          8.0 m
        </text>

        {/* Esquina doblada (efecto papel) */}
        <path d="M 480 200 L 500 200 L 500 220 Z" fill="#E8DFD3" />
        <path d="M 480 200 L 500 220" stroke={DARK} strokeWidth="0.5" />
      </g>

      {/* Trabajador estudiando el plano */}
      <Worker x={240} y={100} facing="right" pose="pointing" />

      {/* Lápiz */}
      <g transform="translate(380, 180) rotate(35)">
        <rect x="0" y="0" width="60" height="6" fill="#F4B860" />
        <rect x="50" y="0" width="10" height="6" fill="#E8E2DA" />
        <path d="M 0 0 L -8 3 L 0 6 Z" fill={DARK} />
      </g>

      {/* Regla */}
      <g transform="translate(120, 175)">
        <rect x="0" y="0" width="100" height="10" fill="#F0EAE4" stroke={DARK} strokeWidth="1" />
        <line x1="10" y1="0" x2="10" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="20" y1="0" x2="20" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="30" y1="0" x2="30" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="40" y1="0" x2="40" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="50" y1="0" x2="50" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="60" y1="0" x2="60" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="70" y1="0" x2="70" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="80" y1="0" x2="80" y2="5" stroke={DARK} strokeWidth="0.5" />
        <line x1="90" y1="0" x2="90" y2="5" stroke={DARK} strokeWidth="0.5" />
      </g>

      {/* Café */}
      <g transform="translate(80, 360)">
        <ellipse cx="0" cy="40" rx="22" ry="3" fill={DARK} opacity="0.15" />
        <path d="M -16 0 L -14 40 L 14 40 L 16 0 Z" fill="#FFFFFF" stroke={DARK} strokeWidth="1.5" />
        <ellipse cx="0" cy="0" rx="16" ry="3" fill={RED_DARK} />
        <path d="M 16 10 Q 28 10, 28 22 Q 28 32, 16 32" fill="none" stroke={DARK} strokeWidth="1.5" />
        <path d="M -8 -8 Q -8 -16, 0 -16 Q 8 -16, 8 -8" fill="none" stroke="#9B9B9B" strokeWidth="1" strokeDasharray="3,2" />
      </g>
    </svg>
  );
}

/* ============================================================
 * ILUSTRACIÓN 3 — Sitio de construcción con grúa
 * ============================================================ */
export function IllustrationSite() {
  return (
    <svg viewBox="0 0 600 500" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {/* Sol */}
      <circle cx="500" cy="80" r="38" fill={RED_LIGHT} />
      <circle cx="500" cy="80" r="26" fill={RED} opacity="0.4" />

      {/* Suelo */}
      <ellipse cx="300" cy="450" rx="280" ry="14" fill={DARK} opacity="0.08" />
      <line x1="40" y1="430" x2="560" y2="430" stroke={DARK} strokeWidth="2" />

      {/* Edificio terminado (izquierda) */}
      <g>
        <rect x="60" y="220" width="120" height="210" fill={CREAM} stroke={DARK} strokeWidth="2" />
        {/* Ventanas */}
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={80 + col * 28}
              y={240 + row * 35}
              width="18"
              height="22"
              fill={RED}
              opacity={(row + col) % 2 === 0 ? 0.85 : 0.55}
            />
          )),
        )}
        {/* Puerta */}
        <rect x="105" y="400" width="30" height="30" fill={DARK} />
        <circle cx="129" cy="416" r="1.5" fill={RED_LIGHT} />
      </g>

      {/* Edificio en construcción (derecha) */}
      <g>
        <rect x="280" y="280" width="140" height="150" fill="#E8DFD3" stroke={DARK} strokeWidth="2" />
        {/* Líneas de andamio */}
        <line x1="280" y1="320" x2="420" y2="320" stroke={DARK} strokeWidth="1" />
        <line x1="280" y1="365" x2="420" y2="365" stroke={DARK} strokeWidth="1" />
        <line x1="320" y1="280" x2="320" y2="430" stroke={DARK} strokeWidth="1" />
        <line x1="380" y1="280" x2="380" y2="430" stroke={DARK} strokeWidth="1" />
        {/* Ventanas parciales */}
        <rect x="295" y="335" width="20" height="20" fill={RED_LIGHT} />
        <rect x="330" y="335" width="20" height="20" fill={RED_LIGHT} />
        <rect x="365" y="335" width="20" height="20" fill={DARK} opacity="0.3" />
        <rect x="395" y="335" width="20" height="20" fill={DARK} opacity="0.3" />
        {/* Marca de "en progreso" */}
        <path d="M 280 280 L 295 295 L 280 295 Z" fill={RED} />
      </g>

      {/* Grúa */}
      <g>
        {/* Mástil */}
        <rect x="440" y="120" width="10" height="310" fill={DARK} />
        <line x1="440" y1="150" x2="450" y2="160" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="180" x2="450" y2="190" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="210" x2="450" y2="220" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="240" x2="450" y2="250" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="270" x2="450" y2="280" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="300" x2="450" y2="310" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="330" x2="450" y2="340" stroke={DARK} strokeWidth="1" />
        <line x1="440" y1="360" x2="450" y2="370" stroke={DARK} strokeWidth="1" />
        {/* Brazo horizontal */}
        <rect x="290" y="115" width="200" height="8" fill={RED} />
        <line x1="295" y1="123" x2="305" y2="133" stroke={DARK} strokeWidth="0.8" />
        <line x1="315" y1="123" x2="325" y2="133" stroke={DARK} strokeWidth="0.8" />
        <line x1="335" y1="123" x2="345" y2="133" stroke={DARK} strokeWidth="0.8" />
        <line x1="355" y1="123" x2="365" y2="133" stroke={DARK} strokeWidth="0.8" />
        {/* Contrapeso */}
        <rect x="478" y="108" width="18" height="22" fill={DARK} />
        {/* Cabina */}
        <rect x="438" y="125" width="14" height="14" fill={DARK} />
        {/* Cable + carga */}
        <line x1="340" y1="123" x2="340" y2="220" stroke={DARK} strokeWidth="1" />
        <rect x="325" y="220" width="30" height="14" fill={RED_DARK} stroke={DARK} strokeWidth="1" />
        <line x1="335" y1="234" x2="345" y2="234" stroke={DARK} strokeWidth="0.5" />
      </g>

      {/* Trabajador con casco abajo */}
      <Worker x={220} y={360} facing="right" pose="standing" />

      {/* Carretilla */}
      <g transform="translate(380, 410)">
        <rect x="0" y="-25" width="42" height="14" rx="2" fill={RED_DARK} />
        <circle cx="6" cy="8" r="9" fill={DARK} />
        <circle cx="6" cy="8" r="3" fill={CREAM} />
        <rect x="40" y="-12" width="25" height="3" rx="1" fill={DARK} />
      </g>

      {/* Pequeños arbustos */}
      <g>
        <circle cx="50" cy="425" r="10" fill="#3D7C47" />
        <circle cx="58" cy="420" r="8" fill="#4A8E54" />
        <circle cx="540" cy="425" r="10" fill="#3D7C47" />
        <circle cx="548" cy="420" r="8" fill="#4A8E54" />
      </g>
    </svg>
  );
}

/* ============================================================
 * Lista exportable para el carrusel
 * ============================================================ */
export const LOGIN_ILLUSTRATIONS = [
  IllustrationPlanning,
  IllustrationBlueprint,
  IllustrationSite,
];
