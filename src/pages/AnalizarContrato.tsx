import { useState, useRef } from "react";
import { FileText, Upload, Loader2, AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, ShieldOff, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const N8N_WEBHOOK = "https://n8n.lexhouse-ai.online/webhook/analisis-legallex";
const BUCKET = "contratos";

type Resultado = {
  summary: string;
  risk_score: number;
  contract_type: string;
  key_clauses: string[];
  risks: string[];
};

function RiskBadge({ score }: { score: number }) {
  if (score <= 3) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-sm px-3 py-1"><ShieldCheck className="h-4 w-4 mr-1" />Riesgo bajo ({score}/10)</Badge>;
  if (score <= 6) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-sm px-3 py-1"><ShieldAlert className="h-4 w-4 mr-1" />Riesgo moderado ({score}/10)</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200 text-sm px-3 py-1"><ShieldOff className="h-4 w-4 mr-1" />Riesgo alto ({score}/10)</Badge>;
}

export default function AnalizarContrato() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "Solo se aceptan archivos PDF", variant: "destructive" });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "El archivo no puede superar 20 MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setResultado(null);
  }

  async function analizar() {
    if (!file) return;
    setLoading(true);
    try {
      // 1. Subir PDF a Supabase Storage
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw new Error(`Error al subir: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      const downloadUrl = urlData.publicUrl;

      // 2. Llamar al webhook de análisis
      const res = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadUrl }),
      });
      if (!res.ok) throw new Error(`El análisis devolvió error ${res.status}`);
      const data = await res.json();
      if (!data?.summary) throw new Error("Respuesta inválida del analizador");
      setResultado(data as Resultado);

      // Limpiar el archivo del storage tras obtener resultado
      supabase.storage.from(BUCKET).remove([filename]).catch(() => {});
    } catch (e: unknown) {
      toast({ title: "Error en el análisis", description: e instanceof Error ? e.message : "Error desconocido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Análisis de Contrato IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube un contrato en PDF y Lex Advisor lo analizará detectando cláusulas clave y riesgos legales.
        </p>
      </div>

      {/* Zona de carga */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0] ?? null); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors
              ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"}`}
          >
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <>
                <FileText className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setResultado(null); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" /> Quitar archivo
                </button>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">Arrastra el PDF aquí o haz clic para seleccionar</p>
                  <p className="text-xs text-muted-foreground">PDF · máx. 20 MB</p>
                </div>
              </>
            )}
          </div>

          <Button onClick={analizar} disabled={!file || loading} className="mt-4 w-full" size="lg">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analizando contrato…</> : "✦ Analizar contrato"}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          {/* Cabecera del resultado */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Resultado del análisis</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">{resultado.contract_type}</p>
                </div>
                <RiskBadge score={resultado.risk_score} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">{resultado.summary}</p>
            </CardContent>
          </Card>

          {/* Cláusulas clave */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Cláusulas clave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {resultado.key_clauses.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">{i + 1}</span>
                    <span className="text-foreground/85">{c}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Riesgos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Riesgos detectados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {resultado.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{i + 1}</span>
                    <span className="text-foreground/85">{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => { setFile(null); setResultado(null); }}>
            Analizar otro contrato
          </Button>
        </div>
      )}
    </div>
  );
}
