import { AiTagsOverview } from "@/components/tags/AiTagsOverview";
import { TagManager } from "@/components/tags/TagManager";
import { Tag } from "lucide-react";

export default function Etiquetas() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-10">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">Clasificación</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Tag className="h-6 w-6 text-accent" />
          Etiquetas IA
        </h2>
        <p className="text-sm text-muted-foreground">
          Clasificación automática de leads según su conversación con el agente IA
        </p>
      </div>

      <AiTagsOverview />

      <hr className="border-border" />

      <TagManager />
    </div>
  );
}
