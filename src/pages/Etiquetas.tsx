import { AiTagsOverview } from "@/components/tags/AiTagsOverview";
import { TagManager } from "@/components/tags/TagManager";
import { Tag } from "lucide-react";

export default function Etiquetas() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-10">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-accent" />
        <div>
          <h2 className="text-2xl font-bold">Etiquetas IA</h2>
          <p className="text-sm text-muted-foreground">
            Clasificación automática de leads según su conversación con el agente IA
          </p>
        </div>
      </div>

      <AiTagsOverview />

      <hr className="border-border" />

      <TagManager />
    </div>
  );
}
