import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Tag, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AiTag {
  id: string;
  nombre: string;
  color: string;
  leadCount: number;
}

/**
 * Panel de clasificación IA: muestra leads agrupados por etiqueta no-permanente.
 * Destino: src/components/tags/AiTagsOverview.tsx
 * Uso: importar y colocar en Dashboard.tsx o en una sección de Settings.
 *
 * <AiTagsOverview />
 */
export function AiTagsOverview() {
  const [tags, setTags] = useState<AiTag[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: tagRows } = await supabase
        .from("lead_tags")
        .select("id, nombre, color")
        .eq("es_permanente", false)
        .order("nombre");

      if (cancelled || !tagRows || tagRows.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      const withCounts = await Promise.all(
        tagRows.map(async (tag) => {
          const { count } = await supabase
            .from("leads_campana")
            .select("id", { count: "exact", head: true })
            .contains("tag_ids", [tag.id])
            .neq("archivado", true);
          return { ...tag, leadCount: count ?? 0 };
        }),
      );

      if (!cancelled) {
        setTags(withCounts.filter((t) => t.leadCount > 0));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
        <Tag size={16} />
        Clasificación IA de leads
      </h2>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sin leads clasificados por IA todavía
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => navigate(`/tagged-messages?tag=${tag.id}`)}
              className="group text-left rounded-xl border p-4 hover:shadow-md transition-all duration-150"
              style={{
                borderColor: `${tag.color}55`,
                background: `${tag.color}0d`,
              }}
            >
              {/* Badge */}
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-3"
                style={{
                  background: `${tag.color}22`,
                  color: tag.color,
                  border: `1px solid ${tag.color}55`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: tag.color }}
                />
                {tag.nombre}
              </span>

              {/* Count */}
              <div
                className="flex items-center gap-1.5 text-2xl font-bold"
                style={{ color: tag.color }}
              >
                <Users size={15} />
                {tag.leadCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">leads</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
