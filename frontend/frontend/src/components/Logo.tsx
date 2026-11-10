export function Logo({ width = 48, height = 48, core = "#ef233c" }: { width?: number; height?: number; core?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Mitad izquierda roja: lo importante */}
      <path d="M 50 15 A 35 35 0 0 0 50 85" stroke="#ef233c" strokeWidth="12" strokeLinecap="round" />
      {/* Mitad derecha clara: finanzas, ahorro, dinero */}
      <path d="M 50 15 A 35 35 0 0 1 50 85" stroke="#dfe5eb" strokeWidth="12" strokeLinecap="round" />
      {/* Núcleo central: punto de convergencia */}
      <circle cx="50" cy="50" r="10" fill={core} />
    </svg>
  );
}
