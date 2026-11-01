export function Logo({ width = 48, height = 48 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mitad izquierda azul: tareas, organización, vida */}
      <path d="M 50 15 A 35 35 0 0 0 50 85" stroke="#3B82F6" strokeWidth="12" strokeLinecap="round" />
      {/* Mitad derecha verde: finanzas, ahorro, dinero */}
      <path d="M 50 15 A 35 35 0 0 1 50 85" stroke="#10B981" strokeWidth="12" strokeLinecap="round" />
      {/* Núcleo central: punto de convergencia */}
      <circle cx="50" cy="50" r="10" fill="#1E293B" />
    </svg>
  );
}
