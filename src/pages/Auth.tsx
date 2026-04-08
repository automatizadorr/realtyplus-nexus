import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Info, X } from "lucide-react";

// Colores corporativos extraídos del logo de Realtyplus
const BRAND = {
  navy: "#0f2b5a",
  red: "#cf142b",
};

const REALTYPLUS_ROLES = [
  { value: "agente", label: "Agente Inmobiliario (BK2)" },
  { value: "franquiciado", label: "Franquiciado / Master" },
  { value: "inversor", label: "Inversor (InvestPlus)" },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("agente");
  const [loading, setLoading] = useState(false);

  // Nuevo estado para controlar la ventana emergente (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setPassword("");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Error", description: "Ingresa un correo válido.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Correo enviado", description: "Revisa tu bandeja para restablecer tu contraseña." });
      setIsForgotPassword(false);
    }
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Por favor, ingresa un correo corporativo o válido.");
    }
    if (password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }
    if (!isLogin && fullName.trim().length < 3) {
      throw new Error("Ingresa tu nombre completo para el registro.");
    }
  };

  const parseAuthError = (error: unknown): string => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
      if (msg.includes("already registered")) return "Este correo ya está registrado en la red.";
      return error.message;
    }
    return "Ocurrió un error inesperado de red.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      validateForm();
      setLoading(true);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              rp_role: role,
              network: "Realtyplus International",
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "¡Solicitud recibida!",
          description: "Revisa tu bandeja de entrada para confirmar el acceso.",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Error de acceso",
        description: parseAuthError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 font-sans">
      {/* --- INICIO DEL MODAL EMERGENTE DE INFORMACIÓN --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b" style={{ borderColor: BRAND.navy }}>
              <img src="/logo.png" alt="Realtyplus Logo" className="h-8 object-contain" />
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors rounded-full p-1 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-slate-700">
              <h3 className="text-xl font-bold" style={{ color: BRAND.navy }}>
                Información de la Red y Acceso
              </h3>
              <p className="text-sm leading-relaxed">
                El Portal CRM es la herramienta centralizada para todos los miembros de la red internacional Realtyplus.
                Dependiendo de tu perfil, tendrás acceso a diferentes módulos:
              </p>
              <ul className="space-y-3 text-sm mt-4">
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BRAND.red }}></div>
                  <p>
                    <strong>Agente Inmobiliario (BK2):</strong> Gestión de clientes (leads), portafolio de propiedades
                    compartidas y herramientas de valoración.
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BRAND.red }}></div>
                  <p>
                    <strong>Franquiciado / Master:</strong> Métricas de rendimiento de tu oficina, gestión de equipo y
                    soporte corporativo directo.
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BRAND.red }}></div>
                  <p>
                    <strong>Inversor (InvestPlus):</strong> Acceso exclusivo a carteras de alta rentabilidad y
                    oportunidades Off-Market.
                  </p>
                </li>
              </ul>
            </div>
            <div className="bg-slate-50 p-4 border-t text-center">
              <Button
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto"
                style={{ backgroundColor: BRAND.navy }}
              >
                Entendido, volver al login
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* --- FIN DEL MODAL --- */}

      {/* CABECERA CON LOGO REAL */}
      <div className="mb-6 text-center w-full max-w-md">
        <img
          src="/logo.png"
          alt="Realtyplus Servicios Inmobiliarios"
          className="mx-auto h-20 md:h-24 object-contain mb-4"
        />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-t-8" style={{ borderTopColor: BRAND.navy }}>
        <CardHeader className="text-center space-y-2 pb-4">
          <CardTitle className="text-2xl font-extrabold tracking-tight" style={{ color: BRAND.navy }}>
            Portal CRM Integrado
          </CardTitle>
          <CardDescription className="text-sm font-medium">
            {isForgotPassword
              ? "Te enviaremos un enlace para restablecer tu contraseña"
              : isLogin
              ? "Introduce tus credenciales corporativas"
              : "Solicita tu alta en el sistema"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@realty-plus.org"
                  disabled={loading}
                  className="focus-visible:ring-[#0f2b5a]"
                />
              </div>
              <Button
                type="submit"
                className="w-full text-white shadow-md hover:opacity-90"
                style={{ backgroundColor: BRAND.red }}
                disabled={loading}
              >
                {loading ? "Enviando…" : "Enviar enlace de recuperación"}
              </Button>
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="w-full text-sm font-semibold transition-colors"
                style={{ color: BRAND.navy }}
              >
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-700">
                    Nombre y Apellidos
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Mario Valdés"
                    disabled={loading}
                    className="focus-visible:ring-[#0f2b5a]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-700">
                    Perfil en la Red
                  </Label>
                  <div className="relative">
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="flex h-10 w-full appearance-none items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-[#0f2b5a] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={loading}
                    >
                      {REALTYPLUS_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {/* Icono personalizado para el select para evitar el estilo feo del navegador */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@realty-plus.org"
                disabled={loading}
                className="focus-visible:ring-[#0f2b5a]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-slate-700">
                  Contraseña
                </Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-slate-500 hover:text-[#cf142b] cursor-pointer transition-colors"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="focus-visible:ring-[#0f2b5a]"
              />
            </div>

            <Button
              type="submit"
              className="w-full text-white transition-all hover:opacity-90 shadow-md"
              style={{ backgroundColor: BRAND.red }}
              disabled={loading}
            >
              {loading ? (
                "Verificando..."
              ) : isLogin ? (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Acceder al Portal
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Solicitar Acceso
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={toggleAuthMode}
              className="text-sm font-semibold transition-colors underline-offset-4 hover:underline"
              style={{ color: BRAND.navy }}
              disabled={loading}
            >
              {isLogin ? "¿No tienes acceso? Solicita tu cuenta" : "Ya pertenezco a la red. Iniciar sesión"}
            </button>

            {/* BOTÓN DISPARADOR DEL MODAL */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 px-3 py-1.5 rounded-full"
            >
              <Info className="h-3.5 w-3.5" />
              ¿Qué incluye el Portal CRM?
            </button>
          </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t flex flex-col space-y-1 text-xs text-center text-slate-500 py-4 rounded-b-xl">
          <p className="font-medium" style={{ color: BRAND.navy }}>
            Soporte Internacional: +34 911 107 727
          </p>
          <p>contacto@realty-plus.org | www.realty-plus.org</p>
        </CardFooter>
      </Card>
    </div>
  );
}
