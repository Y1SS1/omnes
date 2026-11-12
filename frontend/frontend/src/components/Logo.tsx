// `side` is the right half: dark on light cards (login), light on the dark top bar.
export function Logo({
  width = 48,
  height = 48,
  core = "#e56515",
  side = "#1a1b1d",
}: {
  width?: number;
  height?: number;
  core?: string;
  side?: string;
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Mitad izquierda naranja: lo importante */}
      <path d="M 50 15 A 35 35 0 0 0 50 85" stroke="#e56515" strokeWidth="12" strokeLinecap="round" />
      {/* Mitad derecha: finanzas, ahorro, dinero */}
      <path d="M 50 15 A 35 35 0 0 1 50 85" stroke={side} strokeWidth="12" strokeLinecap="round" />
      {/* Núcleo central: punto de convergencia */}
      <circle cx="50" cy="50" r="10" fill={core} />
    </svg>
  );
}
