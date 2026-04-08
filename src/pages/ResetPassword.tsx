import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, CheckCircle } from "lucide-react";

const BRAND = {
  navy: "#0f2b5a",
  red: "#cf142b",
};

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
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
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

  if (!isRecovery && !window.location.hash.includes("type=recovery")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8" style={{ borderTopColor: BRAND.navy }}>
          <CardHeader className="text-center">
            <CardTitle style={{ color: BRAND.navy }}>Enlace inválido</CardTitle>
            <CardDescription>Este enlace de recuperación no es válido o ha expirado.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/auth")} style={{ backgroundColor: BRAND.navy }} className="text-white">
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-t-8" style={{ borderTopColor: BRAND.navy }}>
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle className="mx-auto h-16 w-16" style={{ color: BRAND.navy }} />
            <h2 className="text-xl font-bold" style={{ color: BRAND.navy }}>¡Contraseña actualizada!</h2>
            <p className="text-slate-600 text-sm">Redirigiendo al portal…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <div className="mb-6">
        <img src="/logo.png" alt="Realtyplus" className="mx-auto h-20 object-contain" />
      </div>
      <Card className="w-full max-w-md shadow-2xl border-t-8" style={{ borderTopColor: BRAND.navy }}>
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-extrabold" style={{ color: BRAND.navy }}>
            Nueva contraseña
          </CardTitle>
          <CardDescription>Ingresa tu nueva contraseña para acceder al Portal CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Nueva contraseña</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
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
              {loading ? "Actualizando…" : (
                <><KeyRound className="mr-2 h-5 w-5" />Restablecer contraseña</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
