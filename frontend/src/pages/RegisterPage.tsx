import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Empieza a organizar tu vida</p>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>
        <p className="text-sm text-center text-slate-500 mt-4">
          ¿Ya tienes cuenta? <Link to="/login" className="text-indigo-600 font-medium">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
