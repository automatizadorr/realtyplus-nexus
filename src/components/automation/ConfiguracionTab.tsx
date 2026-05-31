import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Webhook, Bell, Volume2, Clock, Tag, Plus, Trash2, Loader2,
  RefreshCw, CheckCircle2, AlertCircle, Save, Eye, EyeOff,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";

// Persiste en localStorage por clave
function usePersist<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s !== null ? JSON.parse(s) : initial;
    } catch { return initial; }
  });
  const set = (v: T) => { setVal(v); localStorage.setItem(key, JSON.stringify(v)); };
  return [val, set];
}

interface TagRow { id: string; nombre: string; color: string }

export function ConfiguracionTab() {
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();

  // Notificaciones
  const [sonidoActivo, setSonidoActivo] = usePersist("auto_sound", true);
  const [notifBrowser, setNotifBrowser] = usePersist("auto_notif_browser", false);

  // Webhook config
  const [webhookUrl, setWebhookUrl] = usePersist("auto_webhook_url", "");
  const [showWebhook, setShowWebhook] = useState(false);
  const [testingWh, setTestingWh] = useState(false);
  const [whStatus, setWhStatus] = useState<"idle" | "ok" | "error">("idle");

  // Secuencia días
  const [diasSecuencia, setDiasSecuencia] = usePersist("auto_dias_seq", "1,3,7,14");
  const [delayHoras, setDelayHoras] = usePersist("auto_delay_h", "1");

  // Filtros activos
  const [filtroPais, setFiltroPais] = usePersist("auto_filtro_pais", "");
  const [filtroMinDias, setFiltroMinDias] = usePersist("auto_min_dias", "0");

  // Tags
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [newTagNombre, setNewTagNombre] = useState("");
  const [newTagColor, setNewTagColor] = useState("#cf142b");
  const [savingTag, setSavingTag] = useState(false);

  // Stats de la config
  const [stats, setStats] = useState<{ total: number; activos: number } | null>(null);

  const loadTags = async () => {
    setLoadingTags(true);
    const { data } = await (supabase as any)
      .from("lead_tags")
      .select("id, nombre, color")
      .order("nombre");
    setTags((data || []) as TagRow[]);
    setLoadingTags(false);
  };

  const loadStats = async () => {
    const { count: total } = await (supabase as any)
      .from("vista_inbox_automatizacion")
      .select("telefono", { count: "exact", head: true });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const { count: activos } = await (supabase as any)
      .from("vista_inbox_automatizacion")
      .select("telefono", { count: "exact", head: true })
      .gte("last_message_at", hoy.toISOString());
    setStats({ total: total || 0, activos: activos || 0 });
  };

  useEffect(() => { loadTags(); loadStats(); }, []);

  const testWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({ title: "Ingresa una URL de webhook", variant: "destructive" });
      return;
    }
    setTestingWh(true);
    setWhStatus("idle");
    try {
      const { error } = await supabase.functions.invoke("send-n8n-webhook", {
        body: {
          target: "test_ping",
          payload: { test: true, timestamp: new Date().toISOString(), source: "realtyplus_config" },
        },
      });
      if (error) throw error;
      setWhStatus("ok");
      toast({ title: "Webhook activo ✓", description: "La conexión con n8n funciona correctamente." });
    } catch (e: any) {
      setWhStatus("error");
      toast({ title: "Error en el webhook", description: e.message, variant: "destructive" });
    } finally {
      setTestingWh(false);
    }
  };

  const createTag = async () => {
    if (!newTagNombre.trim()) return;
    setSavingTag(true);
    const { error } = await (supabase as any)
      .from("lead_tags")
      .insert({ nombre: newTagNombre.trim(), color: newTagColor });
    setSavingTag(false);
    if (error) {
      toast({ title: "Error al crear etiqueta", description: error.message, variant: "destructive" });
      return;
    }
    setNewTagNombre("");
    toast({ title: "Etiqueta creada" });
    loadTags();
  };

  const deleteTag = async (id: string) => {
    const { error } = await (supabase as any).from("lead_tags").delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    loadTags();
  };

  const requestBrowserNotif = async () => {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifBrowser(true);
      toast({ title: "Notificaciones activadas" });
    } else {
      toast({ title: "Permiso denegado", description: "Actívalas manualmente en la configuración del navegador.", variant: "destructive" });
    }
  };

  const saveSequence = () => {
    toast({ title: "Configuración de secuencia guardada" });
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Estado del sistema */}
      {stats && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Sistema de automatización activo</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total} contactos totales · {stats.activos} con actividad hoy
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadStats(); loadTags(); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook n8n */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            Conexión con n8n
          </CardTitle>
          <CardDescription className="text-xs">
            URL del webhook configurada en la Edge Function de Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL del webhook (referencia)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showWebhook ? "text" : "password"}
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://tu-n8n.app.n8n.cloud/webhook/..."
                  className="pr-10 font-mono text-xs"
                />
                <button
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowWebhook(!showWebhook)}
                  type="button"
                >
                  {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testWebhook}
                disabled={testingWh}
                className="shrink-0"
              >
                {testingWh ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Probar"
                )}
              </Button>
            </div>
            {whStatus === "ok" && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Webhook respondió correctamente
              </p>
            )}
            {whStatus === "error" && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> No se pudo conectar con el webhook
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed">
            La URL real del webhook se configura en las variables de entorno de la Edge Function
            <code className="mx-1 px-1 bg-muted rounded">send-n8n-webhook</code> en el panel de Supabase.
            Este campo es solo para referencia y pruebas.
          </p>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                Sonido al recibir mensaje
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reproduce un tono cuando llega un mensaje nuevo del lead
              </p>
            </div>
            <Switch checked={sonidoActivo} onCheckedChange={setSonidoActivo} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notificaciones del navegador
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alerta emergente aunque la app esté en segundo plano
              </p>
            </div>
            {notifBrowser ? (
              <Switch checked={true} onCheckedChange={() => setNotifBrowser(false)} />
            ) : (
              <Button variant="outline" size="sm" onClick={requestBrowserNotif}>
                Activar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Secuencia de días */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Secuencia de seguimiento
          </CardTitle>
          <CardDescription className="text-xs">
            Configura en qué días n8n enviará mensajes de seguimiento automático
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Días de secuencia (separados por coma)</Label>
              <Input
                value={diasSecuencia}
                onChange={(e) => setDiasSecuencia(e.target.value)}
                placeholder="1,3,7,14,30"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Ej: 1,3,7,14 = día 1, día 3, día 7, día 14
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Delay inicial (horas)</Label>
              <Input
                type="number"
                min="0"
                max="72"
                value={delayHoras}
                onChange={(e) => setDelayHoras(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tiempo de espera antes del primer mensaje
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Filtro por país (código ISO)</Label>
              <Input
                value={filtroPais}
                onChange={(e) => setFiltroPais(e.target.value)}
                placeholder="AR, CL, MX... (vacío = todos)"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Días mínimos sin actividad</Label>
              <Input
                type="number"
                min="0"
                value={filtroMinDias}
                onChange={(e) => setFiltroMinDias(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Solo leads inactivos hace X días o más
              </p>
            </div>
          </div>

          <Button size="sm" onClick={saveSequence}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar configuración
          </Button>
        </CardContent>
      </Card>

      {/* Etiquetas */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Etiquetas de leads
            </CardTitle>
            <CardDescription className="text-xs">
              Crea etiquetas para clasificar tus oportunidades calientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lista de etiquetas */}
            {loadingTags ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin etiquetas creadas</p>
                ) : (
                  tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
                      style={{ borderColor: tag.color, color: tag.color, background: `${tag.color}15` }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: tag.color }} />
                      {tag.nombre}
                      <button
                        onClick={() => deleteTag(tag.id)}
                        className="ml-0.5 hover:opacity-70 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Crear etiqueta */}
            <Separator />
            <div className="flex items-end gap-2">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">Nombre de la etiqueta</Label>
                <Input
                  value={newTagNombre}
                  onChange={(e) => setNewTagNombre(e.target.value)}
                  placeholder="Ej: Interesado, Vendido, Seguimiento..."
                  onKeyDown={(e) => e.key === "Enter" && createTag()}
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-9 rounded border cursor-pointer p-0.5"
                  />
                  <Badge style={{ background: `${newTagColor}20`, color: newTagColor, borderColor: newTagColor }} variant="outline">
                    {newTagNombre || "Previsualización"}
                  </Badge>
                </div>
              </div>
              <Button size="sm" onClick={createTag} disabled={savingTag || !newTagNombre.trim()}>
                {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
