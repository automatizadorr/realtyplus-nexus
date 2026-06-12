import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EditablePhoneCellProps {
  phone: string;
  onUpdated?: (newPhone: string) => void;
  className?: string;
}

export function EditablePhoneCell({ phone, onUpdated, className }: EditablePhoneCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(phone || "");
  }, [phone]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(phone || "");
    setEditing(true);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setValue(phone || "");
    setEditing(false);
  };

  const save = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("El teléfono no puede estar vacío");
      return;
    }
    if (trimmed === (phone || "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-lead-phone", {
        body: { oldPhone: phone, newPhone: trimmed },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Error al actualizar");
      }
      toast.success(
        data.sheet_updated
          ? `Teléfono actualizado en Google Sheets (${data.sheet_rows} fila${data.sheet_rows === 1 ? "" : "s"})`
          : "Teléfono actualizado en la base de datos",
      );
      onUpdated?.(trimmed);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={saving}
          className="h-7 px-2 text-sm w-36"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          onClick={cancel}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group inline-flex items-center gap-1.5 ${className || ""}`}>
      <span className="text-sm">{phone || "—"}</span>
      <button
        type="button"
        onClick={start}
        title="Editar teléfono"
        className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-primary"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
