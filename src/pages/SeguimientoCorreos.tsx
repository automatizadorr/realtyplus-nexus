import { MailCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import CorreoSeguimiento from "@/components/correos/CorreoSeguimiento";

// Misma clave que usa Correos Personalizados para recibir destinatarios.
const LEADS_IMPORT_KEY = "prospeccion_leads_import";

export default function SeguimientoCorreos() {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <MailCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Seguimiento de correos</h1>
          <p className="text-sm text-muted-foreground">
            Recibido / abierto / clic de tus envíos vía webhook de Resend (últimos 30 días).
          </p>
        </div>
      </div>

      <CorreoSeguimiento
        onCargarLeads={(leads) => {
          if (!leads.length) {
            toast({ title: "Nadie abrió aún", description: "Cuando haya aperturas podrás armar la campaña.", variant: "destructive" });
            return;
          }
          sessionStorage.setItem(
            LEADS_IMPORT_KEY,
            JSON.stringify(leads.map((l) => ({ email: l.email, empresa: l.empresa, ciudad: "", gancho: "" }))),
          );
          navigate("/correos-personalizados");
          toast({ title: `${leads.length} leads cargados`, description: "Solo los que abrieron un correo. Ajusta el mensaje y envía tu campaña." });
        }}
      />
    </div>
  );
}
