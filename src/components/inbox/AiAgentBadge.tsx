import { Sparkles } from "lucide-react";

/**
 * Distintivo animado que marca contactos cuya conversación fue
 * iniciada por el Agente IA (primer mensaje saliente con plantilla).
 * Usa los tri-colores de Realtyplus: azul (#003366), rojo (#cc0000) y blanco.
 */
export function AiAgentBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="ai-agent-badge relative inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm overflow-hidden shrink-0"
      title="Conversación iniciada por el Agente IA"
      aria-label="Mensaje inicial del Agente IA"
    >
      <span className="ai-agent-badge__glow" aria-hidden />
      <Sparkles className="relative z-10 h-2.5 w-2.5 drop-shadow" strokeWidth={2.5} />
      {!compact && <span className="relative z-10">AI</span>}
      <span className="ai-agent-badge__dot" aria-hidden />
    </span>
  );
}

/**
 * Variante de "barra lateral" pequeña que se ancla a la izquierda
 * del item del contacto, con pulso constante para indicar realtime.
 */
export function AiAgentStripe() {
  return (
    <span
      className="ai-agent-stripe absolute left-0 top-0 bottom-0 w-[3px]"
      aria-hidden
    />
  );
}
