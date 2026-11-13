import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";
import { Logo } from "../components/Logo";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName);
      navigate("/");
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-night px-4 py-10 bg-[radial-gradient(circle_at_15%_10%,rgba(229,101,21,0.28),transparent_45%),radial-gradient(circle_at_90%_95%,rgba(248,248,248,0.07),transparent_40%)]">
      <div className="w-full max-w-sm bg-paper rounded-[28px] shadow-2xl p-8 motion-safe:animate-dialog-in">
        <div className="flex justify-center mb-2">
          <Logo width={40} height={40} />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-center mb-1 text-ink">Crear cuenta</h1>
        <p className="text-sm text-mid-gray text-center mb-6">Empieza a ordenar tus finanzas</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input placeholder="Nombre" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-sm text-ember">{error}</p>}
          <Button type="button" onClick={submit} className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>
        <p className="text-sm text-center text-mid-gray mt-4">
          ¿Ya tienes cuenta? <Link to="/login" className="text-accent font-semibold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
