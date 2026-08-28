import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";
import { Logo } from "../components/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: string } })?.response?.data;
      setError(typeof message === "string" && message ? message : "Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  };

  // The <form>'s native submit (GET to the current URL, with fields as a
  // query string) must never fire - it would leak the password into the URL.
  // preventDefault() alone wasn't reliably stopping it, so the button below
  // is type="button" and driven entirely by this onClick instead of relying
  // on form submission semantics.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm p-8">
        <div className="flex justify-center mb-2">
          <Logo width={40} height={40} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 text-white">Omnes</h1>
        <p className="text-sm text-neutral-400 text-center mb-6">Organiza tu vida y tus finanzas</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="button" onClick={submit} className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>
        <p className="text-sm text-center text-neutral-400 mt-4">
          ¿No tienes cuenta? <Link to="/register" className="text-indigo-600 font-medium">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
