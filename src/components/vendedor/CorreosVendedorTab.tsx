import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Palette, Eye, Loader2, Trash2, Lock, Send, Inbox, Kanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fillTemplate } from "@/lib/fillTemplate";
import { bodyToHtml, buildProEmail, buildPlainEmail, LEXHOUSE_LOGO_URL } from "@/lib/emailTemplates";
import EmailDesignCard, { type DesignMode } from "@/components/correos/EmailDesignCard";
import RemitenteCard from "@/components/vendedor/RemitenteCard";
import { bodyRemitente, useRemitente } from "@/hooks/use-remitente";
import type { PlantillaEmail } from "@/components/vendedor/types";

const VARIABLES_HINT = "Variables: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Form = {
  nombre: string; asunto: string; cuerpo: string;
  designMode: DesignMode; titulo: string; ctaText: string; ctaUrl: string;
  brandColor: string; avatarUrl: string; footerText: string;
};

const formVacio = (): Form => ({
  nombre: "", asunto: "", cuerpo: "",
  designMode: "pro", titulo: "", ctaText: "", ctaUrl: "",
  brandColor: "#003DA5", avatarUrl: "", footerText: "",
});

const NUEVA = "__nueva__";

// Diseño del HTML que se envía en los correos (no es "correo personalizado"
// por destinatario — es la plantilla/branding que se usa según corresponda:
// título, colores, botones, firma). Se abre directo en el editor (sin lista
// intermedia ni diálogo); el logo institucional de LexHouse queda fijo.
export default function CorreosVendedorTab({
  plantillasEmail, onChanged,
}: {
  plantillasEmail: PlantillaEmail[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Remitente elegido por el vendedor: qué cuenta Resend usa (o si manda
  // desde su correo particular). Se configura aquí y también en la Bandeja.
  const { config: remitente } = useRemitente();
  const [plantillaId, setPlantillaId] = useState<string>(NUEVA);
  const [form, setForm] = useState<Form>(formVacio());
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [inicializado, setInicializado] = useState(false);
  const [enviandoPrueba, setEnviandoPrueba] = useState(false);

  const propias = useMemo(() => plantillasEmail.filter((p) => p.creado_por === user?.id), [plantillasEmail, user?.id]);
  const compartidas = useMemo(() => plantillasEmail.filter((p) => p.creado_por !== user?.id), [plantillasEmail, user?.id]);
  const actual = plantillasEmail.find((p) => p.id === plantillaId) || null;

  // Al entrar, abre directo el editor: la primera plantilla propia si existe,
  // o el formulario en blanco listo para crear — nunca una lista intermedia.
  useEffect(() => {
    if (inicializado) return;
    if (propias.length > 0) setPlantillaId(propias[0].id);
    setInicializado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propias, inicializado]);

  useEffect(() => {
    if (!inicializado) return;
    setShowPreview(false);
    if (!actual) { setForm(formVacio()); return; }
    setForm({
      nombre: actual.nombre, asunto: actual.asunto, cuerpo: actual.cuerpo_text || "",
      designMode: (actual.design_mode as DesignMode) || "pro",
      titulo: actual.titulo || "", ctaText: actual.cta_text || "", ctaUrl: actual.cta_url || "",
      brandColor: actual.brand_color || "#003DA5", avatarUrl: actual.avatar_url || "", footerText: actual.footer_text || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaId, inicializado]);

  const fromName = async (): Promise<string> => {
    // Prioriza el nombre configurado como remitente; si no hay, el nombre del
    // perfil de vendedor y, en último caso, su correo.
    if (remitente.remitente_from_name?.trim()) return remitente.remitente_from_name.trim();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return "Tu corredora";
    const { data } = await sb.from("vendedores").select("nombre_display").eq("user_id", uid).maybeSingle();
    return data?.nombre_display || userData.user?.email || "Tu corredora";
  };

  const composeHtml = (nombreRemitente: string) => {
    if (form.designMode === "pro") {
      return buildProEmail({
        fromName: nombreRemitente, titulo: form.titulo, body: form.cuerpo,
        ctaText: form.ctaText, ctaUrl: form.ctaUrl, brandColor: form.brandColor,
        logoUrl: LEXHOUSE_LOGO_URL, avatarUrl: form.avatarUrl, footerText: form.footerText,
      });
    }
    if (form.designMode === "personal") {
      return buildPlainEmail({
        fromName: nombreRemitente, titulo: form.titulo, body: form.cuerpo,
        ctaText: form.ctaText, ctaUrl: form.ctaUrl, brandColor: form.brandColor,
      });
    }
    return bodyToHtml(form.cuerpo);
  };

  const previewHtml = fillTemplate(composeHtml("Tu corredora"), { nombre: "Juan Pérez", pais: "Chile" });

  const guardar = async () => {
    if (!user || !form.nombre.trim()) return;
    setSaving(true);
    try {
      const nombreRemitente = await fromName();
      const campos = {
        nombre: form.nombre, asunto: form.asunto,
        cuerpo_text: form.cuerpo, cuerpo_html: composeHtml(nombreRemitente),
        design_mode: form.designMode, titulo: form.titulo || null,
        cta_text: form.ctaText || null, cta_url: form.ctaUrl || null,
        brand_color: form.brandColor, logo_url: LEXHOUSE_LOGO_URL,
        avatar_url: form.avatarUrl || null, footer_text: form.footerText || null,
      };
      if (actual) {
        const { error } = await sb.from("plantillas_email").update(campos).eq("id", actual.id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("plantillas_email")
          .insert({ ...campos, creado_por: user.id, activa: true })
          .select("id").single();
        if (error) throw error;
        if (data?.id) setPlantillaId(data.id);
      }
      toast({ title: actual ? "Diseño actualizado" : "Diseño creado" });
      onChanged();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActiva = async (v: boolean) => {
    if (!actual) return;
    const { error } = await sb.from("plantillas_email").update({ activa: v }).eq("id", actual.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  // Envía el correo real (vía Resend) a la propia casilla del vendedor, para
  // revisar en Gmail/Outlook si cae en Principal, Promociones o Spam antes
  // de usarlo con leads de verdad.
  const enviarPrueba = async () => {
    if (!user?.email || !form.asunto.trim()) return;
    setEnviandoPrueba(true);
    try {
      const nombreRemitente = await fromName();
      const { data, error } = await supabase.functions.invoke("send-personalized-campaign", {
        body: {
          ...bodyRemitente(remitente),
          test: true, testNombre: "Juan Pérez",
          subject: form.asunto, text: form.cuerpo, html: composeHtml(nombreRemitente),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Prueba enviada a ${user.email}`, description: "Revisa Principal, Promociones y Spam para ver dónde cayó." });
    } catch (e) {
      toast({ title: "No se pudo enviar la prueba", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setEnviandoPrueba(false);
    }
  };

  const eliminar = async () => {
    if (!actual || actual.creado_por !== user?.id) return;
    setEliminando(true);
    const { error } = await sb.from("plantillas_email").delete().eq("id", actual.id);
    setEliminando(false);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Diseño borrado" });
    setPlantillaId(NUEVA);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Palette className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight">Diseño de Correo</h2>
          <p className="text-sm text-muted-foreground">El HTML que se envía en los correos: título, botones, colores y firma. El logo de LexHouse queda siempre fijo.</p>
        </div>
        {/* Accesos directos al resto del flujo, sin volver al sidebar. */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/mis-leads/bandeja"><Inbox className="h-3.5 w-3.5" /> Enviar desde la Bandeja</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/mis-leads/pipeline"><Kanban className="h-3.5 w-3.5" /> Pipeline</Link>
          </Button>
        </div>
      </div>

      {/* Desde qué correo sale el envío: cuál de las dos cuentas Resend se usa
          (y su cupo diario) o el correo particular del vendedor. */}
      <RemitenteCard />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label className="text-xs">Plantilla que estás editando</Label>
              <Select value={plantillaId} onValueChange={setPlantillaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NUEVA}>+ Crear nueva plantilla</SelectItem>
                  {propias.length > 0 && propias.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  {compartidas.length > 0 && compartidas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre} (compartida)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {actual && actual.creado_por === user?.id && (
              <label className="flex items-center gap-1.5 pb-2 text-sm">
                <Switch checked={!!actual.activa} onCheckedChange={toggleActiva} /> Activa
              </label>
            )}
            {actual && actual.creado_por === user?.id && (
              <Button type="button" variant="ghost" size="sm" onClick={eliminar} disabled={eliminando} className="mb-0.5 gap-1.5 text-muted-foreground hover:text-red-600">
                {eliminando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Borrar
              </Button>
            )}
            {actual && actual.creado_por !== user?.id && (
              <span className="mb-2.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> Compartida por tu equipo</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre interno</Label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Seguimiento inicial" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Asunto</Label>
              <Input value={form.asunto} onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cuerpo del mensaje</Label>
            <Textarea
              value={form.cuerpo} onChange={(e) => setForm((f) => ({ ...f, cuerpo: e.target.value }))}
              className="min-h-[120px] text-sm" placeholder={"Hola {{nombre}},\n\nPárrafo…\n\n- Punto uno\n- Punto dos"}
            />
            <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
          </div>
        </CardContent>
      </Card>

      <EmailDesignCard
        userId={user?.id}
        designMode={form.designMode} setDesignMode={(m) => setForm((f) => ({ ...f, designMode: m }))}
        titulo={form.titulo} setTitulo={(v) => setForm((f) => ({ ...f, titulo: v }))}
        ctaText={form.ctaText} setCtaText={(v) => setForm((f) => ({ ...f, ctaText: v }))}
        ctaUrl={form.ctaUrl} setCtaUrl={(v) => setForm((f) => ({ ...f, ctaUrl: v }))}
        brandColor={form.brandColor} setBrandColor={(v) => setForm((f) => ({ ...f, brandColor: v }))}
        logoUrl={LEXHOUSE_LOGO_URL} setLogoUrl={() => {}}
        fixedLogo={{ url: LEXHOUSE_LOGO_URL, label: "LexHouse AI" }}
        avatarUrl={form.avatarUrl} setAvatarUrl={(v) => setForm((f) => ({ ...f, avatarUrl: v }))}
        footerText={form.footerText} setFooterText={(v) => setForm((f) => ({ ...f, footerText: v }))}
      />

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Consejo:</strong> mientras menos botones y menos "look de banner" tenga el correo (un solo botón, colores sobrios, sin exceso de imágenes), más chance tiene de caer en la bandeja Principal en vez de Promociones o Spam. Usa "Enviar prueba" para comprobarlo antes de mandarlo a leads de verdad.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5">
          <Eye className="h-4 w-4" /> {showPreview ? "Ocultar vista previa" : "Vista previa"}
        </Button>
        <Button
          type="button" variant="outline" size="sm" onClick={enviarPrueba}
          disabled={enviandoPrueba || !form.asunto.trim() || !form.cuerpo.trim()}
          className="gap-1.5"
        >
          {enviandoPrueba ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar prueba a mi correo
        </Button>
        <Button type="button" size="sm" onClick={guardar} disabled={saving || !form.nombre.trim()} className="ml-auto gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar diseño
        </Button>
      </div>

      {showPreview && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {fillTemplate(form.asunto, { nombre: "Juan Pérez", pais: "Chile" }) || "(sin asunto)"}
            </p>
            {form.designMode !== "texto" ? (
              <iframe title="Vista previa del correo" className={`w-full rounded-md border bg-white ${form.designMode === "pro" ? "h-[520px]" : "h-[280px]"}`} srcDoc={previewHtml} />
            ) : (
              <div className="prose prose-sm max-w-none rounded-md border bg-white p-4 text-[14px] [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
