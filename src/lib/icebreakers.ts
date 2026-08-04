// Icebreakers de WhatsApp para reactivación de leads (prospección).
// Mensajes VARIados (nunca iguales) que posicionan a LexHouse AI como
// desarrollador de sistemas de IA y software para inmobiliarias, probados,
// con retorno de inversión rápido y resultados medibles.
//
// `pickIcebreaker` rota deterministicamente por id del lead para que el mismo
// lead siempre reciba el mismo variant (evita enviar 2 icebreakers distintos al
// mismo contacto en sesiones distintas).

export type IcebreakerVars = {
  nombre?: string | null;
  ciudad?: string | null;
  empresa?: string | null;
};

// Set de variantes ES (prospección inmobiliarias — focus IA/software).
// Marca a respetar: AI-MaX Intelligence. Tone: ICEBREAKER, corto, directo, pregunta abierta.
// Sin signos raros que rompan wa.me. Sin URLs largas (wa.me limita ~2048 chars en ?text=).
const ICEBREAKERS_ES: string[] = [
  `Hola {nombre} 👋 Soy Mario de LexHouse AI. Desarrollamos sistemas de IA para inmobiliarias que ya están generando retorno de inversión en corredoras reales: atienden WhatsApp 24/7, califican leads y agendan visitas. En menos de un mes pagan el setup con los cierres que generan. ¿Te muestro uno funcionando en 5 min?`,

  `Buenas, {nombre}. Te escribo de LexHouse AI. Somos una software factory especializada en inmobiliarias. Nuestro sistema de IA —probado y corriendo en corredoras— responde cada consulta de WhatsApp al instante y no deja leads enfriarse. Los clientes recuperan la inversión en semanas con las ventas adicionales que captura. ¿Lo probamos con tus contactos esta semana?`,

  `Hola {nombre}, Mario de LexHouse AI 👋. Creamos sistemas de IA para inmobiliarias que ya operan con resultados comprobados: atención automática, clasificación de leads, recordatorios. Cada cliente nuestro ve retorno en el primer mes. Me gustaría que lo veas en acción. ¿Te paso un demo corto?`,

  `Hola {nombre}. Soy Mario de LexHouse AI. Desarrollamos software e IA para inmobiliarias con sistemas probados: un asistente que contesta tus WhatsApp, califica y agenda visitas sin que toques el teléfono. La inversión se paga sola con los cierres extra que genera desde el primer mes. ¿Te muestro cómo trabaja en vivo?`,

  `Buenas {nombre} — Mario de LexHouse AI. Desarrollamos sistemas de IA para inmobiliarias con resultados comprobados: atienden leads a cualquier hora, los filtran y reservan la visita. Varias corredoras ya recuperaron su inversión en semanas. ¿Te animas a probarlo con 2 o 3 de tus leads?`,

  `Hola {nombre} 👋 Mario de LexHouse AI. Construimos software e IA para inmobiliarias. Nuestro sistema probado responde WhatsApp por ti, califica al lead y agenda la visita automáticamente. Retorno de inversión rápido y medible desde el primer mes. ¿Te paso una prueba de 10 minutos?`,

  `Hola {nombre}, Mario de LexHouse AI. Somos una software factory de IA para inmobiliarias. Nuestro sistema ya probado se hace cargo de tus leads de WhatsApp de principio a fin, con métricas de conversión reales que pagan el servicio en el primer mes. ¿Te gustaría verlo correr con un caso real?`,

  `Buenas {nombre}. Soy Mario de LexHouse AI. Nos dedicamos a crear sistemas de IA para inmobiliarias que ya están corriendo en corredoras con retorno de inversión comprobado. Atienden WhatsApp, califican y agendan visitas sin intervención humana, y se financian solos con los cierres que generan. ¿Probamos uno con tus próximos leads?`,

  `Hola {nombre} 👋 Soy Mario de LexHouse AI. Desarrollamos sistemas de IA para inmobiliarias con resultados medibles y ROI rápido. El sistema atiende WhatsApp, clasifica y agenda, y nuestros clientes recuperan la inversión en el primer mes. Me gustaría enseñarte una demo viva. ¿Cuándo te viene bien?`,

  `Hola {nombre}. Mario de LexHouse AI. Creamos software e IA para inmobiliarias con sistemas probados y retorno de inversión inmediato: capturan y atienden tus leads de WhatsApp sin que enfríen, pagan el setup con los primeros cierres. Ya estamos dándole resultado a otras corredoras. ¿Te paso una prueba rápida?`,
];

// Set EN (mismo espíritu, por si la prospección es hispano/americana mixed).
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 Mario from LexHouse AI here. We build AI systems for real estate agencies that are already generating ROI in production: 24/7 WhatsApp response, lead qualification and automated bookings. Our clients recover the investment in weeks with the extra deals closed. Want a 5-min live demo?`,

  `Hi {nombre}, Mario from LexHouse AI 👋. We're a software factory specialized in real estate. Our proven AI system replies to every WhatsApp instantly and keeps leads warm — pays for itself in the first month with the additional sales it captures. Shall we try it with a few of your leads this week?`,
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
