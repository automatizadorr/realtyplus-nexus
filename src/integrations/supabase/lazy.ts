import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Accesor perezoso del cliente Supabase.
 *
 * `./client` importa estáticamente `@supabase/supabase-js` (~110 KB gzip). Si un
 * módulo EAGER (AuthContext, use-is-admin…) lo importa estático, ese peso cae en
 * el bundle crítico de la landing. Con `getSupabase()` el cliente se carga en un
 * chunk aparte, bajo demanda, fuera del critical path.
 *
 * Es un singleton: `./client` se evalúa una sola vez, así que comparte la misma
 * instancia (y sesión) con los `import { supabase }` estáticos de las páginas lazy.
 */
let clientPromise: Promise<SupabaseClient<Database>> | null = null;

export function getSupabase(): Promise<SupabaseClient<Database>> {
  if (!clientPromise) {
    clientPromise = import("./client").then((m) => m.supabase as SupabaseClient<Database>);
  }
  return clientPromise;
}
