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
    <main className="min-h-screen flex items-center justify-center bg-night px-4 py-10 bg-[radial-gradient(circle_at_15%_10%,rgba(239,35,60,0.28),transparent_45%),radial-gradient(circle_at_90%_95%,rgba(223,229,235,0.07),transparent_40%)]">
      <div className="w-full max-w-sm bg-paper rounded-[28px] shadow-2xl p-8">
        <div className="flex justify-center mb-2">
          <Logo width={40} height={40} />
        </div>
        <h1 className="font-display text-4xl font-extrabold text-center mb-1 text-ink">
          Omnes
        </h1>
        <p className="text-sm text-mid-gray text-center mb-6">Tus finanzas y presupuestos, cotizados con IA</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-ember">{error}</p>}
          <Button type="button" onClick={submit} className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>
        <p className="text-sm text-center text-mid-gray mt-4">
          ¿No tienes cuenta?{" "}
          <Link to="/registro-trabajador" className="text-accent font-semibold hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}
