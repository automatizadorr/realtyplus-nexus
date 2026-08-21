import { useEffect, useState } from "react";
import { Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fillTemplate } from "@/lib/fillTemplate";
import { bodyToHtml, buildProEmail, buildPlainEmail } from "@/lib/emailTemplates";
import EmailDesignCard, { type DesignMode } from "@/components/correos/EmailDesignCard";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

const VARIABLES_HINT = "Variables: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type EmailForm = {
  nombre: string; asunto: string; cuerpo: string;
  designMode: DesignMode; titulo: string; ctaText: string; ctaUrl: string;
  brandColor: string; logoUrl: string; avatarUrl: string; footerText: string;
};

const emailFormVacio = (): EmailForm => ({
  nombre: "", asunto: "", cuerpo: "",
  designMode: "pro", titulo: "", ctaText: "", ctaUrl: "",
  brandColor: "#003DA5", logoUrl: "", avatarUrl: "", footerText: "",
});

// Diálogo de edición compartido por Mis Plantillas y la Bandeja. `plantilla`
// null = crear nueva; con datos = editar (propia o compartida — la RLS decide
// si el guardado se acepta, no hace falta chequearlo acá).
//
// El email reutiliza el mismo compositor visual de HTML que Correos
// Personalizados (admin): EmailDesignCard + buildProEmail/buildPlainEmail/
// bodyToHtml (src/lib/emailTemplates.ts). Solo se trae el diseño/HTML, no el
// resto de esa herramienta (destinatarios, ganchos, secuencias, envío).
export default function EditarPlantillaDialog({
  open, onOpenChange, canal, plantilla, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canal: "whatsapp" | "email";
  plantilla: PlantillaWa | PlantillaEmail | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [wa, setWa] = useState({ nombre: "", contenido: "" });
  const [email, setEmail] = useState<EmailForm>(emailFormVacio());
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowPreview(false);
    if (!plantilla) {
      setWa({ nombre: "", contenido: "" });
      setEmail(emailFormVacio());
    } else if (canal === "whatsapp") {
      const w = plantilla as PlantillaWa;
      setWa({ nombre: w.nombre, contenido: w.contenido });
    } else {
      const e = plantilla as PlantillaEmail;
      setEmail({
        nombre: e.nombre, asunto: e.asunto, cuerpo: e.cuerpo_text || "",
        designMode: (e.design_mode as DesignMode) || "pro",
        titulo: e.titulo || "", ctaText: e.cta_text || "", ctaUrl: e.cta_url || "",
        brandColor: e.brand_color || "#003DA5", logoUrl: e.logo_url || "", avatarUrl: e.avatar_url || "",
        footerText: e.footer_text || "",
      });
    }
  }, [open, plantilla, canal]);

  // Nombre del remitente para el encabezado/firma del correo Profesional:
  // el nombre público del vendedor (vendedores.nombre_display) o su email.
  const fromName = async (): Promise<string> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return "Tu corredora";
    const { data } = await sb.from("vendedores").select("nombre_display").eq("user_id", uid).maybeSingle();
    return data?.nombre_display || userData.user?.email || "Tu corredora";
  };

  const composeHtml = (nombre: string) => {
    if (email.designMode === "pro") {
      return buildProEmail({
        fromName: nombre, titulo: email.titulo, body: email.cuerpo,
        ctaText: email.ctaText, ctaUrl: email.ctaUrl, brandColor: email.brandColor,
        logoUrl: email.logoUrl, avatarUrl: email.avatarUrl, footerText: email.footerText,
      });
    }
    if (email.designMode === "personal") {
      return buildPlainEmail({
        fromName: nombre, titulo: email.titulo, body: email.cuerpo,
        ctaText: email.ctaText, ctaUrl: email.ctaUrl, brandColor: email.brandColor,
      });
    }
    return bodyToHtml(email.cuerpo);
  };

  const previewHtml = fillTemplate(composeHtml("Tu corredora"), { nombre: "Juan Pérez", pais: "Chile" });

  const guardar = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (canal === "whatsapp") {
        if (!wa.nombre.trim()) return;
        const payload = { nombre: wa.nombre, contenido: wa.contenido, creado_por: user.id, activa: true };
        const { error } = plantilla
          ? await sb.from("plantillas_whatsapp").update(payload).eq("id", plantilla.id)
          : await sb.from("plantillas_whatsapp").insert(payload);
        if (error) throw error;
      } else {
        if (!email.nombre.trim()) return;
        const nombreRemitente = await fromName();
        const payload = {
          nombre: email.nombre, asunto: email.asunto,
          cuerpo_text: email.cuerpo, cuerpo_html: composeHtml(nombreRemitente),
          design_mode: email.designMode, titulo: email.titulo || null,
          cta_text: email.ctaText || null, cta_url: email.ctaUrl || null,
          brand_color: email.brandColor, logo_url: email.logoUrl || null,
          avatar_url: email.avatarUrl || null, footer_text: email.footerText || null,
          creado_por: user.id, activa: true,
        };
        const { error } = plantilla
          ? await sb.from("plantillas_email").update(payload).eq("id", plantilla.id)
          : await sb.from("plantillas_email").insert(payload);
        if (error) throw error;
      }
      toast({ title: plantilla ? "Plantilla actualizada" : "Plantilla creada" });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plantilla ? "Editar" : "Nueva"} plantilla · {canal === "whatsapp" ? "WhatsApp" : "Email"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {canal === "whatsapp" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre interno</Label>
                <Input value={wa.nombre} onChange={(e) => setWa((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensaje</Label>
                <Textarea value={wa.contenido} onChange={(e) => setWa((f) => ({ ...f, contenido: e.target.value }))} className="min-h-[120px] text-sm" />
                <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre interno</Label>
                  <Input value={email.nombre} onChange={(e) => setEmail((f) => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Asunto</Label>
                  <Input value={email.asunto} onChange={(e) => setEmail((f) => ({ ...f, asunto: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cuerpo del mensaje</Label>
                <Textarea
                  value={email.cuerpo} onChange={(e) => setEmail((f) => ({ ...f, cuerpo: e.target.value }))}
                  className="min-h-[120px] text-sm" placeholder={"Hola {{nombre}},\n\nPárrafo…\n\n- Punto uno\n- Punto dos"}
                />
                <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
              </div>

              <EmailDesignCard
                userId={user?.id}
                designMode={email.designMode} setDesignMode={(m) => setEmail((f) => ({ ...f, designMode: m }))}
                titulo={email.titulo} setTitulo={(v) => setEmail((f) => ({ ...f, titulo: v }))}
                ctaText={email.ctaText} setCtaText={(v) => setEmail((f) => ({ ...f, ctaText: v }))}
                ctaUrl={email.ctaUrl} setCtaUrl={(v) => setEmail((f) => ({ ...f, ctaUrl: v }))}
                brandColor={email.brandColor} setBrandColor={(v) => setEmail((f) => ({ ...f, brandColor: v }))}
                logoUrl={email.logoUrl} setLogoUrl={(v) => setEmail((f) => ({ ...f, logoUrl: v }))}
                avatarUrl={email.avatarUrl} setAvatarUrl={(v) => setEmail((f) => ({ ...f, avatarUrl: v }))}
                footerText={email.footerText} setFooterText={(v) => setEmail((f) => ({ ...f, footerText: v }))}
              />

              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5">
                <Eye className="h-4 w-4" /> {showPreview ? "Ocultar vista previa" : "Vista previa"}
              </Button>
              {showPreview && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {fillTemplate(email.asunto, { nombre: "Juan Pérez", pais: "Chile" }) || "(sin asunto)"}
                  </p>
                  {email.designMode !== "texto" ? (
                    <iframe title="Vista previa del correo" className={`w-full rounded-md border bg-white ${email.designMode === "pro" ? "h-[480px]" : "h-[260px]"}`} srcDoc={previewHtml} />
                  ) : (
                    <div className="prose prose-sm max-w-none text-[14px] [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={saving} className="bg-[#003DA5] hover:bg-[#003DA5]/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
