import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Info, X, ArrowLeft, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RealEstatePlexus } from "@/components/auth/RealEstatePlexus";
import { BrandShowcase } from "@/components/auth/BrandShowcase";
import lexLogo from "@/assets/lexhouse-logo.webp";

const BRAND = { navy: "#003DA5", red: "#DC1C2E" };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ROLES = [
  { value: "agente", label: "Agente Inmobiliario (BK2)" },
  { value: "franquiciado", label: "Franquiciado / Master" },
  { value: "inversor", label: "Inversor (InvestPlus)" },
];

type IconInputProps = {
  icon: React.ElementType;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  suffix?: React.ReactNode;
};

function IconInput({ icon: Icon, id, type = "text", value, onChange, placeholder, disabled, suffix }: IconInputProps) {
  return (
    <div className="relative flex items-center">
      <Icon className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none z-10" />
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9 pr-10 focus-visible:ring-[#003DA5]"
      />
      {suffix && <div className="absolute right-3 z-10">{suffix}</div>}
    </div>
  );
}

export default function Auth() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("agente");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const isLogin = tab === "login";

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setIsForgotPassword(false);
    setPassword("");
    setShowPassword(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Por favor, ingresa un correo corporativo o válido.");
    if (password.length < 6)
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    if (!isLogin && fullName.trim().length < 3)
      throw new Error("Ingresa tu nombre completo para el registro.");
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
            data: { full_name: fullName, rp_role: role, network: "Realtyplus International" },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast({ title: "¡Solicitud recibida!", description: "Revisa tu bandeja de entrada para confirmar el acceso." });
      }
    } catch (err: unknown) {
      toast({ title: "Error de acceso", description: parseAuthError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <aside className="hidden lg:block relative">
        <BrandShowcase />
      </aside>

      <div className="relative flex flex-col items-center justify-center p-4 py-8 overflow-hidden">
        {/* Fondos decorativos */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(0,61,165,0.09), transparent 60%), radial-gradient(ellipse 70% 55% at 85% 90%, rgba(220,28,46,0.07), transparent 65%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 pointer-events-none">
          <RealEstatePlexus />
        </div>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,61,165,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,61,165,0.18) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 90%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,61,165,0.12) 100%)" }}
          aria-hidden
        />

        {/* Botón volver */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-md px-3.5 py-2 text-sm font-semibold shadow-md ring-1 ring-white/60 transition-all hover:bg-white"
          style={{ color: BRAND.navy }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </button>

        {/* Modal informativo */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              >
                <div className="flex justify-between items-center p-5 border-b">
                  <span className="inline-flex items-center justify-center rounded-lg bg-white ring-1 ring-slate-100 px-3 py-2">
                    <img src={lexLogo} alt="LexHouse AI" className="h-9 object-contain" />
                  </span>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 transition-colors rounded-full p-1 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4 text-slate-700">
                  <h3 className="text-xl font-bold" style={{ color: BRAND.navy }}>
                    Información de la Red y Acceso
                  </h3>
                  <p className="text-sm leading-relaxed">
                    LexHouse AI es la herramienta centralizada para todos los miembros de la red inmobiliaria.
                  </p>
                  <ul className="space-y-3 text-sm">
                    {[
                      { role: "Agente Inmobiliario (BK2)", desc: "Gestión de clientes, portafolio de propiedades compartidas y herramientas de valoración." },
                      { role: "Franquiciado / Master", desc: "Métricas de rendimiento de tu oficina, gestión de equipo y soporte corporativo directo." },
                      { role: "Inversor (InvestPlus)", desc: "Acceso exclusivo a carteras de alta rentabilidad y oportunidades Off-Market." },
                    ].map(({ role: r, desc }) => (
                      <li key={r} className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BRAND.red }} />
                        <p><strong>{r}:</strong> {desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 p-4 border-t text-center">
                  <Button onClick={() => setIsModalOpen(false)} className="text-white" style={{ backgroundColor: BRAND.navy }}>
                    Entendido, volver al login
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero móvil */}
        <motion.div
          className="relative z-10 lg:hidden mb-5 text-center"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="inline-flex flex-col items-center gap-2 bg-white/80 backdrop-blur-md rounded-2xl px-6 py-4 shadow-lg ring-1 ring-white/60">
            <span className="inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-100 px-4 py-2.5 shadow-md">
              <img src={lexLogo} alt="LexHouse AI" className="h-12 object-contain" />
            </span>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">CRM inmobiliario · sobre WhatsApp</p>
            </div>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.07 }}
        >
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
            {/* Barra de acento RE/MAX */}
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${BRAND.navy} 0%, ${BRAND.red} 100%)` }} />

            <div className="px-7 pt-6 pb-5">
              {/* Logo desktop */}
              <div className="hidden lg:flex justify-center mb-5">
                <span className="inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-100 px-5 py-3 shadow-md">
                  <img src={lexLogo} alt="LexHouse AI" className="h-14 object-contain" />
                </span>
              </div>

              {!isForgotPassword && (
                <div className="text-center mb-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-1">LexHouse AI · Portal CRM</p>
                  <h1 className="text-2xl font-display font-extrabold tracking-tight" style={{ color: BRAND.navy }}>
                    {isLogin ? (
                      <>Bienvenido de{" "}<span className="font-serif italic font-normal" style={{ color: BRAND.red }}>vuelta</span></>
                    ) : (
                      <>Únete a la{" "}<span className="font-serif italic font-normal" style={{ color: BRAND.red }}>red</span></>
                    )}
                  </h1>
                </div>
              )}

              {/* Tabs Login / Registro */}
              {!isForgotPassword && (
                <div
                  className="flex mb-6 rounded-xl p-1 gap-1"
                  style={{ backgroundColor: "rgba(0,61,165,0.06)" }}
                >
                  {(["login", "register"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => switchTab(t)}
                      className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                      style={
                        tab === t
                          ? { backgroundColor: BRAND.navy, color: "white", boxShadow: "0 2px 8px rgba(0,61,165,0.22)" }
                          : { color: BRAND.navy, opacity: 0.65 }
                      }
                    >
                      {t === "login" ? "Acceder" : "Solicitar acceso"}
                    </button>
                  ))}
                </div>
              )}

              {/* Formulario recuperar contraseña */}
              {isForgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-display font-bold" style={{ color: BRAND.navy }}>
                      Recuperar contraseña
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Te enviaremos un enlace de restablecimiento</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-forgot" className="text-sm text-slate-700">Correo electrónico</Label>
                    <IconInput
                      icon={Mail}
                      id="email-forgot"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@realty-plus.org"
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full text-white shadow-md hover:opacity-90" style={{ backgroundColor: BRAND.red }} disabled={loading}>
                    {loading ? "Enviando…" : "Enviar enlace"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors"
                    style={{ color: BRAND.navy }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver al inicio de sesión
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Campos solo en registro */}
                  <AnimatePresence initial={false}>
                    {!isLogin && (
                      <motion.div
                        key="register"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="fullName" className="text-sm text-slate-700">Nombre y Apellidos</Label>
                          <IconInput
                            icon={User}
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ej. Mario Valdés"
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="role" className="text-sm text-slate-700">Perfil en la Red</Label>
                          <div className="relative">
                            <select
                              id="role"
                              value={role}
                              onChange={(e) => setRole(e.target.value)}
                              className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003DA5] disabled:opacity-50"
                              disabled={loading}
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm text-slate-700">Correo electrónico</Label>
                    <IconInput
                      icon={Mail}
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@realty-plus.org"
                      disabled={loading}
                    />
                  </div>

                  {/* Contraseña */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password" className="text-sm text-slate-700">Contraseña</Label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs text-slate-500 hover:text-[#DC1C2E] transition-colors"
                        >
                          ¿Olvidaste tu clave?
                        </button>
                      )}
                    </div>
                    <IconInput
                      icon={Lock}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      suffix={
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full text-white shadow-md transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
                    style={{ backgroundColor: isLogin ? BRAND.navy : BRAND.red }}
                    disabled={loading}
                  >
                    {loading ? "Verificando..." : isLogin ? (
                      <><LogIn className="mr-2 h-4 w-4" /> Acceder al Portal</>
                    ) : (
                      <><UserPlus className="mr-2 h-4 w-4" /> Solicitar Acceso</>
                    )}
                  </Button>
                </form>
              )}

              {/* OAuth + info */}
              {!isForgotPassword && (
                <>
                  <div className="relative my-5">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 font-mono text-[10px] text-slate-400 uppercase tracking-[0.18em] whitespace-nowrap">
                      o continuar con
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-2 font-semibold hover:bg-slate-50 transition-all"
                    style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                    disabled={loading}
                    onClick={async () => {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: `${window.location.origin}/dashboard` },
                      });
                      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Acceder con Google
                  </Button>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full"
                    >
                      <Info className="h-3 w-3" />
                      ¿Qué incluye el Portal CRM?
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-3 bg-slate-50 border-t text-center font-mono text-[10px] text-slate-500 rounded-b-2xl tracking-wide space-y-1.5">
              <div>
                <span className="font-semibold" style={{ color: BRAND.navy }}>Soporte</span>
                {" · "}+34 911 107 727 · contacto@realty-plus.org
              </div>
              <div>
                Parte de la familia{" "}
                <a
                  href="https://www.lexhouse-ai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline"
                  style={{ color: BRAND.red }}
                >
                  LexHouse AI
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
