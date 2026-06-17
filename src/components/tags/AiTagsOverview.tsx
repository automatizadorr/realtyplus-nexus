import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Tag, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { orderTags } from "@/lib/permanentTags";

interface TagWithCount {
  id: string;
  nombre: string;
  color: string;
  es_permanente: boolean;
  leadCount: number;
}

/**
 * Panel de etiquetas: muestra TODAS las etiquetas (permanentes + IA + custom)
 * con el conteo de leads activos por etiqueta.
 */
export function AiTagsOverview() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Traer TODAS las etiquetas sin filtrar por es_permanente
      const { data: tagRows } = await supabase
        .from("lead_tags")
        .select("id, nombre, color, es_permanente");

      if (cancelled || !tagRows || tagRows.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Contar leads activos por cada etiqueta
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
        // Ordenar: permanentes primero (en orden canónico), luego resto alfabético
        const ordered = orderTags(withCounts);
        setTags(ordered);
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

  const permanentes = tags.filter((t) => t.es_permanente);
  const custom = tags.filter((t) => !t.es_permanente);

  function TagCard({ tag }: { tag: TagWithCount }) {
    return (
      <button
        onClick={() => navigate(`/tagged?tag=${tag.id}`)}
        className="group text-left rounded-xl border p-4 hover:shadow-md transition-all duration-150"
        style={{ borderColor: `${tag.color}55`, background: `${tag.color}0d` }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-3"
          style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tag.color }} />
          {tag.nombre}
        </span>
        <div className="flex items-center gap-1.5 text-2xl font-bold" style={{ color: tag.color }}>
          <Users size={15} />
          {tag.leadCount}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">leads</p>
      </button>
    );
  }

  return (
    <section className="space-y-8">
      {/* Etiquetas permanentes */}
      {permanentes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Tag size={13} /> Etiquetas principales
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {permanentes.map((tag) => <TagCard key={tag.id} tag={tag} />)}
          </div>
        </div>
      )}

      {/* Etiquetas IA y custom */}
      {custom.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Tag size={13} /> Etiquetas IA
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {custom.map((tag) => <TagCard key={tag.id} tag={tag} />)}
          </div>
        </div>
      )}

      {tags.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No hay etiquetas creadas todavía
        </p>
      )}
    </section>
  );
}
