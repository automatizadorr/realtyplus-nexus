// Guion de llamada en frío para el vendedor.
//
// La llamada telefónica es el canal donde más se improvisa y peor se
// convierte: el vendedor tiene 15 segundos para que no le corten. Este guion
// se genera ya personalizado con los datos del lead (nombre, país, gancho de
// la IA de Buscar Leads) y se descarga como .txt para tenerlo al lado del
// teléfono, sin depender de que la app esté abierta.
//
// No inventa cifras ni promete resultados: mismo criterio que los mensajes de
// WhatsApp/email que genera Buscar Leads.

export type DatosGuion = {
  nombre?: string | null;
  empresa?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  /** Primer "problema" detectado por la IA de Buscar Leads: sirve de gancho. */
  gancho?: string | null;
  propuestaValor?: string | null;
  /** Nombre con el que se presenta el vendedor. */
  vendedor?: string | null;
  telefono?: string | null;
};

const NADA = "—";

function limpio(v: string | null | undefined, fallback = ""): string {
  const s = (v ?? "").toString().trim();
  return s || fallback;
}

/** Primer nombre, para que el saludo no suene a lectura de padrón. */
export function primerNombre(nombre: string | null | undefined): string {
  const s = limpio(nombre);
  if (!s) return "";
  return s.split(/\s+/)[0];
}

export function construirGuionLlamada(d: DatosGuion): string {
  const nombre = primerNombre(d.nombre) || "hola";
  const empresa = limpio(d.empresa) || limpio(d.nombre) || "su empresa";
  const lugar = limpio(d.ciudad) || limpio(d.pais);
  const vendedor = limpio(d.vendedor) || "[tu nombre]";
  const gancho = limpio(d.gancho);
  const valor = limpio(d.propuestaValor) || "ordenar la captación y el seguimiento de contactos para que no se pierda ninguno";

  const lineaGancho = gancho
    ? `Vi que ${gancho.charAt(0).toLowerCase()}${gancho.slice(1)}`
    : `Vi su ficha${lugar ? ` en ${lugar}` : ""} y me llamó la atención lo que hacen`;

  return `GUION DE LLAMADA EN FRÍO
=========================================
Lead: ${limpio(d.nombre, NADA)}${lugar ? ` · ${lugar}` : ""}
Teléfono: ${limpio(d.telefono, NADA)}
Generado: ${new Date().toLocaleString("es-CL")}

REGLA DE ORO
- Los primeros 15 segundos deciden la llamada. No leas: usa esto como apoyo.
- Habla más lento de lo que crees. Pausa después de cada pregunta.
- No des precios por teléfono. El objetivo NO es vender: es agendar 15 minutos.

-----------------------------------------
1) APERTURA (10 segundos)
-----------------------------------------
"Hola, ¿hablo con ${nombre}?
Te llamo de parte de LexHouse, soy ${vendedor}.
Te robo 30 segundos y si no te sirve, cortamos. ¿Va?"

  → Si dice "estoy ocupado":
    "Perfecto, te entiendo. ¿Te llamo mañana a esta hora o prefieres que te
     mande un WhatsApp con lo justo?"  (agenda día y hora concretos)

-----------------------------------------
2) MOTIVO REAL DE LA LLAMADA (15 segundos)
-----------------------------------------
"${lineaGancho}.
Trabajo con ${empresa === "su empresa" ? "empresas del rubro" : "gente como ustedes"} en ${valor}."

-----------------------------------------
3) PREGUNTA QUE ABRE LA CONVERSACIÓN
-----------------------------------------
Elige UNA. Después cállate y escucha.

  a) "¿Hoy cómo llegan los contactos nuevos a ustedes, y quién les hace el seguimiento?"
  b) "De los contactos que les escriben en un mes, ¿cuántos se les enfrían sin respuesta?"
  c) "¿Qué es lo que más tiempo les come del día a día en la parte comercial?"

-----------------------------------------
4) OBJECIONES FRECUENTES
-----------------------------------------
"No me interesa"
  → "Sin problema. Solo por curiosidad, ¿es porque ya tienen algo montado
     o porque ahora no es el momento?"   (la respuesta te dice si vale insistir)

"Ya tenemos un sistema / una agencia"
  → "Buenísimo, entonces esto se suma, no reemplaza.
     ¿Qué es lo que ese sistema hoy NO les resuelve?"

"Mándame información por correo"
  → "Te la mando ahora mismo. Para no mandarte un genérico:
     ¿qué parte te interesa ver primero?"   (y confirma el correo en la llamada)

"¿Cuánto cuesta?"
  → "Depende del tamaño del equipo, por eso prefiero no tirarte un número al aire.
     En 15 minutos te muestro cómo quedaría en tu caso y ahí el precio se explica solo."

-----------------------------------------
5) CIERRE (agendar, no vender)
-----------------------------------------
"Te propongo esto: 15 minutos, te lo muestro funcionando con tus propios datos,
y si no te sirve me lo dices y no te molesto más.
¿Te va mejor ${manana()} o ${pasado()}?"

  → Cierra con día Y hora concretos. Repítelos en voz alta antes de colgar.
  → Confirma por WhatsApp apenas cuelgues, con el link de la reunión.

-----------------------------------------
6) DESPUÉS DE COLGAR (30 segundos, no lo saltes)
-----------------------------------------
[ ] Registrar la llamada en el CRM (botón "Llamar" → resultado).
[ ] Mover la etapa del lead si avanzó.
[ ] Si quedó en "volver a llamar", programar el seguimiento con fecha.
[ ] Anotar en 1 línea lo que dijo textual: eso es oro para la próxima llamada.
`;
}

function diaHabil(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  // Salta fin de semana: nadie agenda una demo para el domingo.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}
const manana = () => diaHabil(1);
const pasado = () => diaHabil(2);

/** Nombre de archivo seguro para cualquier sistema de archivos. */
export function nombreArchivoGuion(nombreLead: string | null | undefined): string {
  const base = limpio(nombreLead, "lead")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  return `guion-llamada-${base || "lead"}.txt`;
}

/** Dispara la descarga del guion como .txt (sin backend). */
export function descargarGuion(d: DatosGuion): void {
  const texto = construirGuionLlamada(d);
  // BOM al inicio: sin el, el Bloc de notas de Windows abre el .txt con los
  // acentos rotos.
  const blob = new Blob([`﻿${texto}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivoGuion(d.nombre);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera en el siguiente tick: si se revoca de inmediato, Safari cancela
  // la descarga antes de empezarla.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Link tel: normalizado (o null si el número no es marcable). */
export function telLink(telefono: string | null | undefined): string | null {
  const digits = (telefono ?? "").replace(/[^\d+]/g, "");
  const soloDigitos = digits.replace(/\D/g, "");
  if (soloDigitos.length < 8) return null;
  return `tel:${digits.startsWith("+") ? digits : `+${soloDigitos}`}`;
}
