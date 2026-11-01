import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";
import { Logo } from "../components/Logo";

export default function RegisterWorkerPage() {
  const { registerWorker } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const email = await registerWorker(firstName, lastName, password);
      setGeneratedEmail(email);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: string } })?.response?.data ?? "No se pudo crear la cuenta.";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  if (generatedEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm bg-paper rounded-[24px] border border-hairline shadow-sm p-8 text-center">
          <div className="flex justify-center mb-2">
            <Logo width={40} height={40} />
          </div>
          <h1 className="text-2xl font-bold mb-1 text-ink">¡Cuenta creada!</h1>
          <p className="text-sm text-mid-gray mb-4">Tu correo de acceso a Omnes es:</p>
          <p className="text-lg font-semibold text-ink bg-canvas border border-hairline rounded-[18px] py-2 mb-6">
            {generatedEmail}
          </p>
          <p className="text-xs text-mid-gray mb-6">Guárdalo, lo vas a necesitar para iniciar sesión la próxima vez.</p>
          <Button type="button" onClick={() => navigate("/")} className="w-full">
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm bg-paper rounded-[24px] border border-hairline shadow-sm p-8">
        <div className="flex justify-center mb-2">
          <Logo width={40} height={40} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 text-ink">Cuenta de trabajador</h1>
        <p className="text-sm text-mid-gray text-center mb-6">
          Te vamos a asignar un correo de la empresa automáticamente.
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="button" onClick={submit} className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>
        <p className="text-sm text-center text-mid-gray mt-4">
          ¿Ya tienes cuenta? <Link to="/login" className="text-ink font-semibold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
