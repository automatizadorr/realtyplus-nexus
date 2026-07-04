import { useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarUploadDialog } from "@/components/AvatarUploadDialog";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** Controla el tamaño y forma (ej. "h-9 w-9"). */
  className?: string;
  /** Tamaño de la inicial de respaldo (ej. "text-sm", "text-2xl"). */
  textClassName?: string;
  /** Si es true, al hacer clic abre el diálogo de subida y muestra overlay de cámara. */
  editable?: boolean;
}

/**
 * Avatar del usuario actual: muestra la foto de perfil (user_metadata.avatar_url)
 * o la inicial. Fuente única de verdad → se sincroniza en sidebar, header y
 * Configuración porque todos leen de useAuth() y editan con supabase.auth.updateUser.
 */
export function UserAvatar({ className, textClassName, editable = false }: UserAvatarProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || undefined;
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const initial = displayName.charAt(0).toUpperCase();

  const face = (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-foreground",
        textClassName,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );

  if (!editable) {
    return <div className={cn("relative shrink-0 rounded-full", className)}>{face}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambiar foto de perfil"
        className={cn("group/ua relative shrink-0 rounded-full", className)}
      >
        {face}
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover/ua:opacity-100">
          <Camera className="h-1/3 w-1/3 text-white" />
        </span>
      </button>
      {user && <AvatarUploadDialog open={open} onOpenChange={setOpen} userId={user.id} />}
    </>
  );
}
