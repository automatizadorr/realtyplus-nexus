import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Info, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RealEstatePlexus } from "@/components/auth/RealEstatePlexus";
import { BrandShowcase } from "@/components/auth/BrandShowcase";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

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
        navigate("/dashboard");
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
            emailRedirectTo: `${window.location.origin}/dashboard`,
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
    <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] font-sans overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Panel lateral izquierdo (solo desktop) */}
      <aside className="hidden lg:block relative">
        <BrandShowcase />
      </aside>

      {/* Columna derecha: formulario con fondo plexus */}
      <div className="relative flex flex-col items-center justify-center p-4 py-8 overflow-hidden">
      {/* Capa de gradiente radial corporativo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(15,43,90,0.10), transparent 60%), radial-gradient(ellipse 70% 55% at 85% 90%, rgba(207,20,43,0.08), transparent 65%)",
        }}
        aria-hidden
      />
      {/* Plexus animado de red inmobiliaria */}
      <div className="absolute inset-0 pointer-events-none">
        <RealEstatePlexus />
      </div>
      {/* Grid sutil tipo plano arquitectónico */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,43,90,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(15,43,90,0.18) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 90%)",
        }}
        aria-hidden
      />
      {/* Viñeta para concentrar la atención */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(15,43,90,0.18) 100%)",
        }}
        aria-hidden
      />

      {/* --- INICIO DEL MODAL EMERGENTE DE INFORMACIÓN --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b" style={{ borderColor: BRAND.navy }}>
              <img src={realtyplusLogo} alt="Realtyplus Logo" className="h-8 object-contain" />
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
      <div className="relative z-10 mb-6 text-center w-full max-w-md">
        <div className="inline-block bg-white/70 backdrop-blur-md rounded-2xl px-6 py-4 shadow-xl ring-1 ring-white/60">
          <img
            src={realtyplusLogo}
            alt="Realtyplus Servicios Inmobiliarios"
            className="mx-auto h-16 md:h-20 object-contain drop-shadow-sm"
          />
        </div>
      </div>

      <Card className="relative z-10 w-full max-w-md shadow-2xl border-t-8 bg-white/95 backdrop-blur-md ring-1 ring-white/60" style={{ borderTopColor: BRAND.navy }}>
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
          <>
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

          <div className="relative my-5">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400 uppercase tracking-wider">
              o continuar con
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-2 font-semibold shadow-sm hover:opacity-90 transition-all"
            style={{ borderColor: BRAND.navy, color: BRAND.navy }}
            disabled={loading}
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/dashboard` },
              });
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
              }
            }}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Acceder con Google
          </Button>

          <div className="mt-5 flex flex-col items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={toggleAuthMode}
              className="text-sm font-semibold transition-colors underline-offset-4 hover:underline"
              style={{ color: BRAND.navy }}
              disabled={loading}
            >
              {isLogin ? "¿No tienes acceso? Solicita tu cuenta" : "Ya pertenezco a la red. Iniciar sesión"}
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 px-3 py-1.5 rounded-full"
            >
              <Info className="h-3.5 w-3.5" />
              ¿Qué incluye el Portal CRM?
            </button>
          </div>
          </>
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
    </div>
  );
}
