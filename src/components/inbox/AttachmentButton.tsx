import { useRef, useState } from "react";
import { Paperclip, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  isAdmin: boolean;
  onUploaded: (url: string, type: string) => void;
}

export function AttachmentButton({ isAdmin, onUploaded }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleClick = () => {
    if (!isAdmin) {
      toast({ title: "Solo administradores", description: "Esta función requiere permisos de admin.", variant: "destructive" });
      return;
    }
    ref.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 20MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await (supabase as any).storage.from("whatsapp-media").upload(path, file, {
        contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await (supabase as any).storage.from("whatsapp-media").createSignedUrl(path, 60 * 60 * 24 * 7);
      const url = signed?.signedUrl;
      if (!url) throw new Error("No se pudo generar URL");
      onUploaded(url, file.type);
      toast({ title: "Archivo listo", description: "Se enviará al confirmar el mensaje." });
    } catch (err: any) {
      toast({ title: "Error al subir", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,audio/*"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl relative"
        onClick={handleClick}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAdmin ? (
          <Paperclip className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4 opacity-60" />
        )}
      </Button>
    </>
  );
}
