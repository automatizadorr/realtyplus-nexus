import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Workflow,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Info,
  Zap,
  Database,
  Send,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignName: string;
  totalLeads: number;
  channel: string | null;
  onConfirm: () => void;
}

// Precios WhatsApp Business API por categoría (USD, región Latinoamérica, 2025)
const WA_PRICING = [
  {
    category: "Marketing",
    description: "Promociones, ofertas, campañas de reactivación",
    price: "$0.0499",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700",
    highlight: true,
  },
  {
    category: "Utilidad",
    description: "Confirmaciones, actualizaciones de transacciones",
    price: "$0.0263",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    highlight: false,
  },
  {
    category: "Autenticación",
    description: "Contraseñas de un solo uso (OTP)",
    price: "$0.0319",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-700",
    highlight: false,
  },
  {
    category: "Servicio",
    description: "Respuestas a mensajes iniciados por el cliente",
    price: "Gratis",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    highlight: false,
  },
];

const N8N_STEPS = [
  {
    icon: Zap,
    title: "Recepción del webhook",
    desc: "NexusPlus-AI envía un HTTP POST al endpoint configurado en n8n con el payload completo: ID de campaña, lista de leads, plantilla del mensaje y filtros de segmentación.",
    color: "text-blue-600",
  },
  {
    icon: Database,
    title: "Procesamiento de leads",
    desc: "n8n itera sobre cada lead del array recibido. Para cada uno extrae el número de teléfono, nombre y datos personalizados para construir el mensaje con variables dinámicas (ej. {{nombre}}, {{propiedad}}).",
    color: "text-indigo-600",
  },
  {
    icon: MessageCircle,
    title: "Envío via API de Meta",
    desc: "n8n llama a la Graph API de WhatsApp Business (v18.0+) para cada lead usando el template pre-aprobado por Meta. Se respeta el límite de velocidad (rate limit) para evitar bloqueos de la cuenta.",
    color: "text-green-600",
  },
  {
    icon: CheckCircle2,
    title: "Confirmación y registro",
    desc: "Por cada mensaje enviado exitosamente, n8n actualiza el registro en Supabase con el estado 'contacted'. Los errores (número inválido, opt-out) se registran por separado para revisión.",
    color: "text-emerald-600",
  },
  {
    icon: Database,
    title: "Actualización de métricas",
    desc: "Al finalizar el flujo, n8n actualiza los contadores de la campaña en Supabase: contacted_whatsapp, responded y timestamp de última ejecución.",
    color: "text-violet-600",
  },
];

export default function CampaignExecuteWarning({
  open,
  onOpenChange,
  campaignName,
  totalLeads,
  channel,
  onConfirm,
}: Props) {
  const [checkedTemplates, setCheckedTemplates] = useState(false);
  const [checkedCosts, setCheckedCosts] = useState(false);
  const [checkedOptOut, setCheckedOptOut] = useState(false);

  const isWhatsApp = channel === "whatsapp" || channel === "whatsapp_email";
  const estimatedCost = (totalLeads * 0.0499).toFixed(2);
  const allChecked = checkedTemplates && checkedCosts && checkedOptOut;

  const handleConfirm = () => {
    if (!allChecked) return;
    // El envío REAL (payload completo con la lista de leads, target_filters y sheet) lo
    // hace el componente padre en onConfirm (Scanner.launchCampaign / Ejecutar campaña),
    // que postea a /camapañas_segmentadas vía send-n8n-webhook. Aquí solo se confirma.
    onConfirm();
    onOpenChange(false);
    setCheckedTemplates(false);
    setCheckedCosts(false);
    setCheckedOptOut(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Información antes de ejecutar la campaña
          </DialogTitle>
          <DialogDescription>
            Revisa con atención lo que ocurrirá y los costos asociados antes de continuar.
          </DialogDescription>
        </DialogHeader>

        {/* Banner campaña */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
          <Send className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{campaignName}</p>
            <p className="text-xs text-muted-foreground">
              {totalLeads} leads · Canal: {channel || "—"}
            </p>
          </div>
          {isWhatsApp && (
            <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
              WhatsApp + Meta
            </Badge>
          )}
        </div>

        {/* ── Sección 1: ¿Qué ocurrirá en n8n? ── */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-base">
            <Workflow className="h-5 w-5 text-primary" />
            ¿Qué ocurrirá en n8n?
          </h3>
          <div className="space-y-2">
            {N8N_STEPS.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <step.icon className={`h-4 w-4 ${step.color} shrink-0`} />
                      <span className="font-semibold text-sm">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < N8N_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 self-center" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <strong>Tiempo estimado:</strong> entre 2 y 15 minutos dependiendo del volumen de leads y
              los límites de velocidad de la API de Meta. No cierres la aplicación durante la ejecución.
            </p>
          </div>
        </div>

        {/* ── Sección 2: Costos WhatsApp Meta ── */}
        {isWhatsApp && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-base">
              <DollarSign className="h-5 w-5 text-amber-500" />
              Costos de WhatsApp Business API (Meta) — 2025
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Meta cobra <strong>por conversación abierta</strong>, no por mensaje individual.
              Una conversación dura <strong>24 horas</strong> desde el primer mensaje. Si el mismo
              usuario responde dentro de esa ventana, no se genera un nuevo cargo. Los precios varían
              por país; los valores abajo corresponden a la región <strong>Latinoamérica</strong>.
            </p>

            <div className="grid grid-cols-1 gap-2">
              {WA_PRICING.map((p) => (
                <div
                  key={p.category}
                  className={`flex items-center justify-between p-3 rounded-lg border ${p.border} ${p.bg} ${p.highlight ? "ring-1 ring-orange-300" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {p.highlight && (
                      <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{p.category}</span>
                        {p.highlight && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.badge} font-medium`}>
                            Aplica a esta campaña
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-base shrink-0 ml-4 ${p.color}`}>
                    {p.price}
                    {p.price !== "Gratis" && (
                      <span className="text-xs font-normal text-muted-foreground"> /conv.</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Estimación de costo */}
            <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50 space-y-3">
              <p className="font-semibold text-sm text-amber-800 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Estimación de costo para esta campaña
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-2xl font-black text-amber-700">{totalLeads}</p>
                  <p className="text-xs text-muted-foreground">leads a contactar</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-2xl font-black text-amber-700">$0.0499</p>
                  <p className="text-xs text-muted-foreground">por conversación</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-300">
                  <p className="text-2xl font-black text-orange-600">~${estimatedCost}</p>
                  <p className="text-xs text-muted-foreground">costo estimado USD</p>
                </div>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Nota:</strong> Este es el costo máximo estimado asumiendo que todos los leads
                abren una conversación nueva. El costo real puede ser menor si algunos leads ya
                tienen una conversación activa en las últimas 24 horas. El cargo se aplica directamente
                en tu cuenta de WhatsApp Business de Meta, no en NexusPlus-AI.
              </p>
            </div>

            <div className="flex gap-2 p-3 rounded-lg bg-slate-50 border text-slate-700">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed space-y-1">
                <p>
                  <strong>Templates pre-aprobados:</strong> Los mensajes de tipo Marketing
                  <strong> deben estar aprobados por Meta</strong> antes de poder enviarse. Si el
                  template no está aprobado, el mensaje fallará y la conversación no se abrirá, pero
                  el intento podría generar un costo parcial.
                </p>
                <p>
                  <strong>Opt-out:</strong> Los usuarios que hayan bloqueado mensajes de marketing
                  de tu número no recibirán el mensaje ni generarán cargo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmaciones ── */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Debes confirmar los siguientes puntos para continuar
          </p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <Checkbox
                id="check-templates"
                checked={checkedTemplates}
                onCheckedChange={(v) => setCheckedTemplates(!!v)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm leading-relaxed">
                Confirmo que las plantillas de mensaje de esta campaña{" "}
                <strong>están aprobadas por Meta</strong> y cumplen con las{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  políticas de WhatsApp Business
                </a>
                .
              </span>
            </label>

            {isWhatsApp && (
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <Checkbox
                  id="check-costs"
                  checked={checkedCosts}
                  onCheckedChange={(v) => setCheckedCosts(!!v)}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm leading-relaxed">
                  Entiendo que esta campaña puede generar un costo estimado de{" "}
                  <strong className="text-amber-600">~${estimatedCost} USD</strong> en mi cuenta de
                  WhatsApp Business de Meta, y autorizo la ejecución.
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <Checkbox
                id="check-optout"
                checked={checkedOptOut}
                onCheckedChange={(v) => setCheckedOptOut(!!v)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm leading-relaxed">
                Confirmo que la lista de contactos ha sido obtenida con el{" "}
                <strong>consentimiento del usuario</strong> y que respeté las solicitudes de opt-out.
                Entiendo que soy responsable del cumplimiento normativo (RGPD / LGPD).
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!allChecked}
            onClick={handleConfirm}
            className={`gap-2 ${
              allChecked
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <Send className="h-4 w-4" />
            Confirmar y ejecutar campaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
