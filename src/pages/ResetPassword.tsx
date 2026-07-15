import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, CheckCircle, Lock } from "lucide-react";
import nexusLogo from "@/assets/nexusplus-logo.png";

const NAVY = "#003DA5";
const RED  = "#DC1C2E";

function GradientCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`w-full max-w-md shadow-2xl overflow-hidden border-0 ring-1 ring-black/5 ${className}`}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${NAVY}, ${RED})` }} />
      {children}
    </Card>
  );
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    }
  };

  const _url = new URL(window.location.href);
  const hasRecoveryToken =
    _url.hash.includes("type=recovery") ||
    _url.searchParams.get("type") === "recovery";

  const wrapper = "min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4";

  if (!isRecovery && !hasRecoveryToken) {
    return (
      <div className={wrapper}>
        <span className="inline-flex items-center justify-center rounded-xl bg-[#0e1c3a] px-4 py-2.5 mb-6"><img src={nexusLogo} alt="NexusPlus-AI" className="h-9 object-contain" /></span>
        <GradientCard>
          <CardHeader className="text-center pt-6">
            <CardTitle className="font-display font-bold text-xl" style={{ color: NAVY }}>
              Enlace inválido
            </CardTitle>
            <CardDescription className="text-sm">
              Este enlace de recuperación no es válido o ha expirado.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <Button onClick={() => navigate("/auth")} className="text-white" style={{ backgroundColor: NAVY }}>
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </GradientCard>
      </div>
    );
  }

  if (success) {
    return (
      <div className={wrapper}>
        <span className="inline-flex items-center justify-center rounded-xl bg-[#0e1c3a] px-4 py-2.5 mb-6"><img src={nexusLogo} alt="NexusPlus-AI" className="h-9 object-contain" /></span>
        <GradientCard>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="mx-auto h-14 w-14" style={{ color: NAVY }} />
            <h2 className="font-display font-bold text-xl" style={{ color: NAVY }}>
              ¡Contraseña actualizada!
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Redirigiendo al portal…
            </p>
          </CardContent>
        </GradientCard>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <span className="inline-flex items-center justify-center rounded-xl bg-[#0e1c3a] px-4 py-2.5 mb-6"><img src={nexusLogo} alt="NexusPlus-AI" className="h-9 object-contain" /></span>
      <GradientCard>
        <CardHeader className="text-center space-y-1 pt-6 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">Portal CRM · IA</p>
          <CardTitle className="font-display font-extrabold text-2xl tracking-tight" style={{ color: NAVY }}>
            Nueva contraseña
          </CardTitle>
          <CardDescription>
            Ingresa tu nueva contraseña para acceder al Portal CRM
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-slate-700">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-9 focus-visible:ring-[#003DA5]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm text-slate-700">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-9 focus-visible:ring-[#003DA5]"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full text-white shadow-md transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
              style={{ backgroundColor: RED }}
              disabled={loading}
            >
              {loading ? "Actualizando…" : (
                <><KeyRound className="mr-2 h-4 w-4" />Restablecer contraseña</>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400 hover:text-slate-600 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </CardContent>

        <div className="px-6 py-3 bg-slate-50 border-t text-center font-mono text-[10px] text-slate-500 tracking-wide">
          <span className="font-semibold" style={{ color: NAVY }}>Soporte</span>
          {" · "}+34 911 107 727 · contacto@realty-plus.org
        </div>
      </GradientCard>
    </div>
  );
}
