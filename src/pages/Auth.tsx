import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, LogIn, UserPlus, Globe2 } from "lucide-react";

// Definimos los roles basados en el ecosistema Realtyplus
const REALTYPLUS_ROLES = [
  { value: "agente", label: "Agente Inmobiliario (BK2)" },
  { value: "franquiciado", label: "Franquiciado / Master" },
  { value: "inversor", label: "Inversor (InvestPlus)" },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("agente");
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Limpieza de estado al cambiar de modo para evitar datos "fantasmas"
  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setPassword("");
    // No limpiamos el email por si el usuario se equivocó y quiere registrarlo
  };

  // Validación defensiva en el cliente (Reemplaza a los débiles atributos HTML)
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Por favor, ingresa un correo corporativo o válido.");
    }
    if (password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres por seguridad.");
    }
    if (!isLogin && fullName.trim().length < 3) {
      throw new Error("Ingresa tu nombre completo real para el registro en el CRM.");
    }
  };

  // Traducción amigable de errores del Backend
  const parseAuthError = (error: unknown): string => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
      if (msg.includes("already registered")) return "Este correo ya está registrado en la red Realtyplus.";
      return error.message;
    }
    return "Ocurrió un error inesperado de red.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. Validamos antes de tocar la red
      validateForm();
      setLoading(true);

      if (isLogin) {
        // 2. Proceso de Login
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error; // Se pasa al catch

        navigate("/");
      } else {
        // 3. Proceso de Registro con metadatos de Realtyplus
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              rp_role: role, // Almacenamos el rol en los metadatos de Supabase
              network: "Realtyplus International",
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        toast({
          title: "¡Bienvenido a la red internacional!",
          description: "Hemos enviado un correo de confirmación a tu bandeja de entrada.",
        });
      }
    } catch (err: unknown) {
      // Eliminado el "any", usamos unknown
      toast({
        title: "Problema de Autenticación",
        description: parseAuthError(err), // Procesamos el error para no exponer el DB layer
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      {/* Elemento de Branding Corporativo */}
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <Globe2 className="h-8 w-8 text-blue-600" />
          Realtyplus Group
        </h1>
        <p className="text-slate-500 font-medium">Red Inmobiliaria Internacional y Franquicias Rentables</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-blue-100">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800">Portal CRM Integrado</CardTitle>
            <CardDescription className="mt-1">
              {isLogin ? "Accede al ecosistema con tus credenciales" : "Únete a nuestra red de profesionales"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre y Apellidos</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Mario Valdés"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Usuario en Realtyplus</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    {REALTYPLUS_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico corporativo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@realty-plus.org"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña de acceso</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? (
                "Procesando solicitud..."
              ) : isLogin ? (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Iniciar sesión en el CRM
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Solicitar acceso a la Red
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center border-t pt-4">
            <button
              type="button"
              onClick={toggleAuthMode}
              className="text-sm font-medium text-slate-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
              disabled={loading}
            >
              {isLogin ? "¿Eres nuevo en el grupo? Regístrate aquí" : "¿Ya eres miembro? Inicia sesión"}
            </button>
          </div>
        </CardContent>

        {/* Footer corporativo con datos de contacto internacionales */}
        <CardFooter className="bg-slate-50 border-t flex flex-col space-y-1 text-xs text-center text-slate-500 py-4">
          <p>Soporte Internacional: +34 911 107 727</p>
          <p>contacto@realty-plus.org | www.realty-plus.org</p>
        </CardFooter>
      </Card>
    </div>
  );
}
