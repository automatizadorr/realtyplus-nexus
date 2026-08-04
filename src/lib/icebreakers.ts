// Icebreakers de WhatsApp para reactivación de leads (prospección).
// Mensajes VARIados (nunca iguales) que posicionan a AI-MaX Intelligence como
// desarrollador de IA y software para inmobiliarias, con sistemas ya corriendo
// y resultados directos. Cada llaman a probar los sistemas IA.
//
// `pickIcebreaker` rotoma determinísticamente por id del lead para que el mismo
// lead siempre reciba el mismo variant (evita enviar 2 icebreakers distintos al
// mismo contacto en sesiones distintas) y `renderIcebreaker` sustituye las vars.

export type IcebreakerVars = {
  nombre?: string | null;
  ciudad?: string | null;
  empresa?: string | null;
};

// Set de variantes ES (prospección inmobiliarias — focus IA/software).
// Marca a respetar: AI-MaX Intelligence. Tone: ICEBREAKER, corto, directo, pregunta abierta.
// Sin signos raros que rompan wa.me. Sin URLs largas (wa.me limita ~2048 chars en ?text=).
const ICEBREAKERS_ES: string[] = [
  `Hola {nombre} 👋 Soy Mario de AI-MaX Intelligence. Construimos IA para inmobiliarias: bots que atienden WhatsApp 24/7, califican leads y agendan visitas solos. Ya están corriendo en varias corredoras con resultados medibles. ¿Te muestro uno funcionando en 5 min?`,

  `Buenas, {nombre}. Te escribo de AI-MaX Intelligence. Hacemos software e IA para inmobiliarias: tenemos un sistema que responde cada mensaje de WhatsApp al instante y no deja leads enfriarse. Funciona hoy en corredoras reales. ¿Lo probamos con tus contactos esta semana?`,

  `Hola {nombre}, Mario de AI-MaX Intelligence 👋. Nos dedicamos a desarrollar IA para inmobiliarias con sistemas ya operando (atención automática, clasificación de leads, recordatorios). Me gustaría que lo veas en acción. ¿Te paso un demo corto?`,

  `Hola {nombre}. Soy Mario (AI-MaX Intelligence). Creamos IA y software para inmobiliarias: un asistente que contesta tus WhatsApp, califica y agenda visitas sin que tú toques el teléfono. Ya da resultados en otras corredoras. ¿Te muestro cómo trabaja?`,

  `Buenas {nombre} — Mario de AI-MaX Intelligence. Construimos IA para inmobiliarias con sistemas corriendo de verdad: atienden leads a cualquier hora, los filtran y reservan la visita. A varias corredoras ya les genera resultados. ¿Te animas a probarlo con 2 o 3 de tus leads?`,

  `Hola {nombre} 👋 Mario de AI-MaX Intelligence. Desarrollamos IA para inmobiliarias: un sistema que responde WhatsApp por ti, califica al lead y bloquea tu agenda con la visita. No es promesa, ya está funcionando. ¿Te paso una prueba de 10 minutos?`,

  `Hola {nombre}, Mario de AI-MaX Intelligence. Hacemos software e IA para inmobiliarias. Tenemos un sistema IA que se hace cargo de tus leads de WhatsApp de principio a fin, ya en producción con resultados. ¿Te gustaría verlo correr con un caso real?`,

  `Buenas {nombre}. Soy Mario de AI-MaX Intelligence. Nos dedicamos a crear IA para inmobiliarias: bots que conversan, califican y agendan visitas solas. Sistemas ya corriendo en corredoras, con métricas reales. ¿Probamos uno con tus próximos leads?`,

  `Hola {nombre} 👋 Soy Mario de AI-MaX Intelligence. Desarrollamos IA y software para inmobiliarias que ya trabaja en corredoras con resultados: atiende WhatsApp, clasifica y agenda. Me gustaría enseñarte una demo viva. ¿Cuándo te viene bien?`,

  `Hola {nombre}. Mario de AI-MaX Intelligence. Construimos IA para inmobiliarias con sistemas funcionando de verdad: capturan y atienden tus leads de WhatsApp sin que enfríen. Ya estamos dándole resultado a otras corredoras. ¿Te paso una prueba rápida?`,
];

// Set EN (mismo espíritu, por si la prospección es hispano/americana mixed).
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 Mario from AI-MaX Intelligence here. We build AI for real estate agencies: WhatsApp bots that answer 24/7, qualify leads and book showings on their own. Already running in real brokerages with measurable results. Want a 5-min live demo?`,

  `Hi {nombre}, Mario from AI-MaX Intelligence 👋. We build AI and software for real estate: a system that replies to every WhatsApp instantly and keeps leads warm. Working live in real brokerages now. Shall we try it with a few of your leads this week?`,
];

export const ICEBREAKERS = { es: ICEBREAKERS_ES, en: ICEBREAKERS_EN } as const;

function fill(text: string, v: IcebreakerVars): string {
  const nombre = (v.nombre || "").trim();
  return text
    .replace(/\{nombre\}/g, nombre || "👋")
    .replace(/\{ciudad\}/g, (v.ciudad || "").trim())
    .replace(/\{empresa\}/g, (v.empresa || "").trim());
}

// Hash determinístico simple → índice estable por id del lead.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickIcebreaker(seed: string, vars: IcebreakerVars, idioma: "es" | "en" = "es"): string {
  const pool = idioma === "en" ? ICEBREAKERS.en : ICEBREAKERS.es;
  const idx = hash(seed || "x") % pool.length;
  return fill(pool[idx], vars);
}

// Construye el link de WhatsApp con el icebreaker pre-cargado.
export function waLinkWithIcebreaker(
  telefono: string,
  vars: IcebreakerVars,
  opts: { seed?: string; idioma?: "es" | "en" } = {},
): string | null {
  const digits = (telefono || "").split("@")[0].replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  const seed = opts.seed || (telefono || "") + (vars.nombre || "");
  const msg = pickIcebreaker(seed, vars, opts.idioma || "es");
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
