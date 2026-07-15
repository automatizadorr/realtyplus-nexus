import { useState, useEffect } from "react";
import { TagManager } from "@/components/tags/TagManager";
import { UserAvatar } from "@/components/UserAvatar";
import { Settings2, Check, LogOut, Palette, SlidersHorizontal, Eye, UserCircle, Bell, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  THEME_PRESETS,
  PRIMARY_SWATCHES,
  ACCENT_SWATCHES,
  RADIUS_OPTIONS,
  DEFAULT_THEME,
  ThemeConfig,
} from "@/lib/themePresets";

const NOTIF_KEY = "rp_notif_config";
const DEFAULT_NOTIF = {
  sound: true,
  campaigns: true,
  errors: true,
  dailySummary: false,
};

export default function Settings() {
  const { theme, applyTheme, saveTheme } = useTheme();
  const { user, signOut } = useAuth();

  // Local working copy for the "Ajuste avanzado" section + live preview
  const [draft, setDraft] = useState<ThemeConfig>(theme);

  useEffect(() => {
    setDraft(theme);
  }, [theme.themeName]);

  const handlePreset = (preset: ThemeConfig) => {
    saveTheme(preset);
    setDraft(preset);
    toast.success(`Tema "${preset.themeName}" aplicado`);
  };

  const handleApplyDraft = () => {
    saveTheme({ ...draft, themeName: "Personalizado" });
    toast.success("✅ Tema guardado correctamente");
  };

  const handleRestore = () => {
    saveTheme(DEFAULT_THEME);
    setDraft(DEFAULT_THEME);
    toast.success("Tema restaurado a Clásico NexusPlus-AI");
  };

  // ── Account
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success("Nombre actualizado");
  };

  // ── Notifications
  const [notif, setNotif] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      return raw ? { ...DEFAULT_NOTIF, ...JSON.parse(raw) } : DEFAULT_NOTIF;
    } catch {
      return DEFAULT_NOTIF;
    }
  });

  const updateNotif = (key: keyof typeof DEFAULT_NOTIF, value: boolean) => {
    const next = { ...notif, [key]: value };
    setNotif(next);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      toast.success("Preferencia guardada");
    } catch {
      toast.error("No se pudo guardar", {
        description: "El almacenamiento del navegador puede estar lleno o bloqueado.",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">Ajustes</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6 text-accent" />
          Configuración
        </h2>
        <p className="text-sm text-muted-foreground">Apariencia, cuenta, notificaciones y etiquetas</p>
      </div>

      <Tabs defaultValue="apariencia">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="apariencia" className="gap-1.5"><Palette className="h-4 w-4" />Apariencia</TabsTrigger>
          <TabsTrigger value="cuenta" className="gap-1.5"><UserCircle className="h-4 w-4" />Cuenta</TabsTrigger>
          <TabsTrigger value="notificaciones" className="gap-1.5"><Bell className="h-4 w-4" />Notificaciones</TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-1.5"><Tag className="h-4 w-4" />Etiquetas</TabsTrigger>
        </TabsList>

        {/* ───────────── APARIENCIA ───────────── */}
        <TabsContent value="apariencia" className="space-y-6 mt-6">
          {/* SECCIÓN A — Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <Palette className="h-4 w-4" />
                </span>
                Presets de tema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {THEME_PRESETS.map((preset) => {
                  const isActive = theme.themeName === preset.themeName;
                  return (
                    <motion.button
                      key={preset.themeName}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePreset(preset)}
                      className={`relative text-left border rounded-lg overflow-hidden transition-all ${
                        isActive ? "ring-2 ring-accent border-accent" : "border-border"
                      }`}
                    >
                      <div className="flex h-20">
                        <div
                          className="w-10 flex flex-col items-center justify-center gap-1"
                          style={{ background: `hsl(${preset.sidebarBackground})` }}
                        >
                          <div
                            className="w-5 h-1.5 rounded"
                            style={{ background: `hsl(${preset.sidebarAccent})` }}
                          />
                          <div
                            className="w-5 h-1.5 rounded opacity-50"
                            style={{ background: `hsl(${preset.sidebarAccent})` }}
                          />
                        </div>
                        <div
                          className="flex-1 flex items-center justify-center gap-2"
                          style={{ background: `hsl(${preset.background})` }}
                        >
                          <div
                            className="w-8 h-3 rounded"
                            style={{ background: `hsl(${preset.primary})` }}
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: `hsl(${preset.accent})` }}
                          />
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-between bg-card">
                        <span className="font-semibold text-sm">{preset.themeName}</span>
                        {isActive && (
                          <Badge variant="default" className="bg-accent text-accent-foreground text-[10px]">
                            <Check className="h-3 w-3 mr-0.5" /> Activo
                          </Badge>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* SECCIÓN B — Ajuste avanzado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                Ajuste avanzado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Color primario (sidebar y botones principales)</Label>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft({ ...draft, primary: c, sidebarBackground: c })}
                      className="w-10 h-10 rounded-md border-2 border-border relative flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: `hsl(${c})` }}
                    >
                      {draft.primary === c && <Check className="h-5 w-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Color de acento (botones de acción y alertas)</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft({ ...draft, accent: c })}
                      className="w-10 h-10 rounded-md border-2 border-border relative flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: `hsl(${c})` }}
                    >
                      {draft.accent === c && <Check className="h-5 w-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Radio de bordes</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setDraft({ ...draft, radius: r.value })}
                      className={`flex flex-col items-center gap-2 p-3 border-2 transition-all ${
                        draft.radius === r.value
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-muted-foreground"
                      }`}
                      style={{ borderRadius: r.value }}
                    >
                      <div
                        className="w-12 h-8 bg-primary"
                        style={{ borderRadius: r.value }}
                      />
                      <span className="text-xs font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleApplyDraft}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Aplicar cambios
              </Button>
            </CardContent>
          </Card>

          {/* SECCIÓN C — Preview en vivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <Eye className="h-4 w-4" />
                </span>
                Vista previa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex border overflow-hidden h-64"
                style={{ borderRadius: draft.radius }}
              >
                {/* Sidebar */}
                <div
                  className="w-20 flex flex-col gap-3 p-3"
                  style={{ background: `hsl(${draft.sidebarBackground})` }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{
                          background: i === 1 ? `hsl(${draft.accent})` : "rgba(255,255,255,0.2)",
                        }}
                      />
                      <div className="flex-1 h-1.5 rounded bg-white/20" />
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div
                  className="flex-1 p-4 space-y-3"
                  style={{ background: `hsl(${draft.background})` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-32 bg-foreground/30 rounded" />
                    <div
                      className="h-7 w-20"
                      style={{
                        background: `hsl(${draft.primary})`,
                        borderRadius: draft.radius,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="bg-card border p-3 space-y-2"
                        style={{ borderRadius: draft.radius }}
                      >
                        <div className="h-2 w-3/4 bg-muted-foreground/30 rounded" />
                        <div className="h-2 w-1/2 bg-muted-foreground/20 rounded" />
                        {i === 0 && (
                          <span
                            className="inline-block text-[10px] px-2 py-0.5 text-white"
                            style={{
                              background: `hsl(${draft.accent})`,
                              borderRadius: draft.radius,
                            }}
                          >
                            Activo
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECCIÓN D — Restaurar */}
          <div className="text-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-sm text-muted-foreground hover:text-foreground underline">
                  Restaurar valores por defecto
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Restaurar el tema original de NexusPlus-AI?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se aplicará el preset "Clásico NexusPlus-AI" y se descartarán tus personalizaciones.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore}>Restaurar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* ───────────── CUENTA ───────────── */}
        <TabsContent value="cuenta" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <UserCircle className="h-4 w-4" />
                </span>
                Datos de la cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <UserAvatar editable className="h-16 w-16" textClassName="text-2xl" />
                <div>
                  <div className="font-semibold">{fullName || "Sin nombre"}</div>
                  <div className="text-sm text-muted-foreground">{user?.email}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Haz clic en la foto para cambiarla</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={user?.email || ""} readOnly className="bg-muted" />
                  <Badge variant="default" className="bg-green-600">Verificado</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <div className="flex gap-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                  <Button onClick={handleSaveName} disabled={savingName}>
                    {savingName ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fecha de registro</Label>
                <div className="text-sm text-muted-foreground">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="destructive" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── NOTIFICACIONES ───────────── */}
        <TabsContent value="notificaciones" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <Bell className="h-4 w-4" />
                </span>
                Preferencias de notificación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                {
                  key: "sound" as const,
                  title: "Sonido al recibir mensaje",
                  desc: "Reproduce un sonido cuando llega un mensaje nuevo en el inbox.",
                },
                {
                  key: "campaigns" as const,
                  title: "Notificaciones de nuevas campañas",
                  desc: "Recibe avisos cuando se cree una nueva campaña.",
                },
                {
                  key: "errors" as const,
                  title: "Alertas de errores de envío",
                  desc: "Te avisamos si un mensaje no se entregó correctamente.",
                },
                {
                  key: "dailySummary" as const,
                  title: "Resumen diario por email",
                  desc: "Recibe un resumen diario de actividad en tu correo.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-4 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                  </div>
                  <Switch
                    checked={notif[item.key]}
                    onCheckedChange={(v) => updateNotif(item.key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── ETIQUETAS ───────────── */}
        <TabsContent value="etiquetas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <Tag className="h-4 w-4" />
                </span>
                Gestión de etiquetas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TagManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

