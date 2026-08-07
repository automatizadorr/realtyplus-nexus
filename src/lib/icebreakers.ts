// Icebreakers de WhatsApp para prospección inmobiliaria.
// Cada mensaje presenta el ecosistema LexHouse AI — CRM enterprise,
// extracción/activación/reactivación de leads (RealtyPlus Nexus) y
// generador de reels automatizados (3+ min) — con ROI comprobado.
// Rotación determinística por id del lead para que el mismo lead siempre
// reciba el mismo variant.
//
// Variables: {nombre}, {empresa}, {ciudad}, {pais}

export type IcebreakerVars = {
  nombre?: string | null;
  ciudad?: string | null;
  empresa?: string | null;
  pais?: string | null;
};

const ICEBREAKERS_ES: string[] = [
  `Hola {nombre} 👋 soy Mario de LexHouse AI. Hemos construido un ecosistema completo de IA para inmobiliarias que ya está operando: CRM nivel enterprise, extracción automática de leads, reactivación de contactos fríos y un generador de reels de 3+ minutos que se arma solo con tus propiedades. Todo medible, todo con ROI desde el primer mes. ¿Te muestro el sistema en 5 minutos?`,

  `{nombre}, buenas. Mario de LexHouse AI. Nuestro CRM con IA —RealtyPlus Nexus— extrae leads de portales y redes, los activa automáticamente y reactiva a los que dejaste de hablar hace meses. A eso súmale un generador de reels que produce videos de 3+ minutos sin que muevas un dedo. Varias corredoras ya lo usan y recuperaron la inversión en semanas. ¿Lo ves conmigo en una demo rápida?`,

  `Hola {nombre}, Mario de LexHouse AI 👋. Te cuento lo que hacemos: un CRM enterprise con inteligencia artificial que no solo gestiona tu cartera —extrae leads nuevos, activa los que llegan y revive a los inactivos automáticamente— más un motor de reels que te arma videos profesionales de más de 3 minutos para cada propiedad. Retorno comprobado en menos de 30 días. ¿Quieres verlo funcionando?`,

  `Buenas {nombre}. Soy Mario de LexHouse AI. Imagina un CRM que hace triple trabajo: extrae leads sin que los busques, los activa con secuencias inteligentes y reactiva a los que tenías olvidados. Eso es RealtyPlus Nexus. Y como bonus, un generador de reels automatizado que crea videos inmobiliarios de +3 minutos con música, voz y texto. Todo integrado y corriendo ya. ¿Te enseño cómo funciona con tus propios leads?`,

  `Hola {nombre} 👋 Mario de LexHouse AI. Nuestro ecosistema de IA para inmobiliarias cubre todo el ciclo del lead: CRM enterprise, extracción automatizada, activación inmediata, reactivación de cartera fría y contenido —reels de 3+ minutos generados solos para tus propiedades. Cada módulo ya está probado y generando retorno. ¿Hacemos una videollamada de 10 min para que lo veas?`,

  `{nombre}, soy Mario de LexHouse AI. Hemos integrado tres motores de IA en un solo CRM enterprise: extracción de leads desde portales, activación con secuencias automáticas y reactivación de leads que no respondían hace meses. Y además, el generador de reels te produce videos de +3 minutos para Instagram y TikTok sin editar nada. Resultados medibles desde la primera semana. ¿Probamos con un par de tus propiedades?`,

  `Buenas {nombre} — Mario de LexHouse AI. Te resumo el ecosistema LexHouse: un CRM enterprise con IA que extrae, activa y reactiva leads por ti, más un generador de reels que convierte tus fotos de propiedades en videos de 3+ minutos automáticamente. No es un bot, es un sistema probado con ROI en semanas. ¿Te interesa verlo con tus propios datos?`,

  `Hola {nombre}, Mario de LexHouse AI. RealtyPlus Nexus es nuestro CRM con IA para inmobiliarias: extrae leads automáticamente, los califica, activa campañas y reactiva contactos inactivos sin que intervengas. Y el generador de reels te crea contenido de +3 minutos listo para publicar. Todo el ecosistema trabaja junto y se paga solo con los cierres extra. ¿Quieres que te lo demuestre en vivo?`,

  `{nombre} 👋 Mario de LexHouse AI. Construimos el ecosistema de IA más completo para inmobiliarias: CRM enterprise, extracción de leads 24/7, activación y reactivación automática con RealtyPlus Nexus, y un generador de reels que produce videos de 3+ minutos con tus propiedades. ROI rápido, resultados comprobados. ¿Vemos juntos cómo aplicarlo a tu operación?`,

  `Hola {nombre} 👋, Mario de LexHouse AI. Un solo mensaje y una sola idea: un sistema que extrae leads, revive los que se enfriaron y arma reels de 3+ minutos con tus propiedades, todo automáticamente. ¿Te muestro un caso real en 5 minutos?`,

  `{nombre}, buenas. Mario de LexHouse AI. La mayoría de las agencias pierde leads por falta de velocidad, no por falta de trabajo. Nuestro sistema actúa al instante, todos los días: CRM, reactivación automática y reels de +3 minutos sin mover un dedo. ¿Vemos juntos la demo rápida?`,

  `Hola {nombre} 👋. Mensaje corto, resultado concreto: RealtyPlus Nexus extrae leads de portales, los activa y reactiva tu cartera fría mientras duermes. Y de regalo, un generador de reels que arma videos de 3+ minutos con tus fotos. ¿Hablamos 3 minutos hoy?`,

  `{nombre}, una pregunta honesta: ¿cuántos leads de tu cartera no responden desde hace más de un mes? La IA de LexHouse los reactiva solos, mientras el CRM extrae nuevos. Extracción, activación, reactivación y reels: todo operando en semanas, no en años. ¿Te cuento cómo funciona?`,

  `Buenas {nombre}, Mario de LexHouse AI. No te vengo a vender otra herramienta que tienes que aprender: te ofrezco el sistema que trabaja por ti. Captura leads, los activa, reactiva a los que se enfriaron y arma reels promocionales con tus propiedades. ¿Lo vemos funcionando ahora?`,

  `Hola {nombre}, soy Mario. Un dato que cambia el juego: hoy un CRM con IA puede responder, clasificar y reactivar leads por ti, y un generador de reels crea videos de 3+ minutos sin editar nada. Eso es LexHouse AI y está operando en corredoras reales. ¿Te lo muestro esta semana?`,

  `{nombre} 👋, Mario de LexHouse AI. Una corredora nos dijo: "nunca más quiero una hoja de cálculo". Ahora su CRM extrae, actúa y reactiva sin que ella intervenga, y sus propiedades tienen reels de 3+ minutos. ¿Quieres lo mismo? Te lo enseño en una llamada corta, sin compromiso.`,

  `Hola {nombre}, directo al grano: extracción de leads 24/7, activación inmediata, reactivación de cartera y generador de reels integrado en un solo CRM. Sin instalaciones complicadas, sin hacer malabares. ¿Te muestro el panel y un caso de una agencia similar a la tuya?`,

  `Muy buenas {nombre}, Mario de LexHouse AI. ¿Qué hicieron las corredoras que dejaron de perseguir leads? Automatizan todo el ciclo: captura, contacto, reactivación y contenido. Los reels de 3+ minutos se hacen solos con cada propiedad. ¿En 5 minutos vemos si encaja con tu agencia?`,

  `¡Hola {nombre}! Lo que antes requería horas y una persona dedicada (perseguir leads, dar seguimiento, crear videos) hoy lo hace LexHouse AI: CRM con IA, extracción automática, reactivación y reels de 3+ minutos medibles. ¿Te hago una demo ahora, sin compromiso?`,

  `Hola {nombre}, Mario de LexHouse AI. Te cuento qué hacemos para que no te quedes con dudas: un ecosistema de IA completo para inmobiliarias, con CRM enterprise, extracción de leads desde portales y redes 24/7, activación inmediata y reactivación de la cartera fría. A eso se suma un generador de reels que produce videos de 3+ minutos con tus propiedades. Ya está corriendo en corredoras reales, con retorno comprobado desde el primer mes. ¿Te paso una demo rápida para verlo juntos?`,

  `Buenas {nombre}, Mario de LexHouse AI. Nuestro ecosistema de IA hace todo el trabajo en una sola plataforma: extrae leads nuevos automáticamente, los activa con secuencias de contacto, reactiva a los que se enfriaron y produce reels de 3+ minutos por cada propiedad, sin que muevas un dedo. Incluye también un CRM enterprise donde cada lead, cada conversación y cada resultado está medido. Ya opera en corredoras reales y funciona desde que lo conectas. ¿Te muestro el panel en vivo ahora?`,

  `Hola {nombre}, Mario de LexHouse AI. Te resumo en un punto y aparte lo que hacemos: un CRM enterprise que captura leads en portales y redes, los activa con secuencias automáticas, revive a los que no respondían hace meses y, además, arma reels de 3+ minutos con tus propias propiedades. Todo integrado y funcionando, sin que tengas que configurar nada. El retorno se mide desde la primera semana. ¿Vemos juntos cómo funcionaría con tus leads?`,

  `{nombre}, oye, Mario de LexHouse AI. Quiero mostrarte una sola plataforma que resuelve todo el ciclo: extracción de leads automatizada, activación inmediata del primer contacto, reactivación de tu cartera fría y un CRM enterprise con reportes. De extra, un generador de reels que produce videos de 3+ minutos para Instagram y TikTok con tus fotos. Corredoras reales ya lo usan y recuperan la inversión en semanas. ¿Te enseño una demo breve?`,

  `Hola {nombre} 👋, Mario de LexHouse AI. El ecosistema LexHouse une en un solo sistema todo lo que tu agencia necesita: CRM enterprise con IA, extracción automática de leads, activación y seguimiento, reactivación de contactos fríos y reels de 3+ minutos generados solos. Nada de configuración, nada que aprender: ya funciona y el ROI se ve desde el primer mes. ¿Coordinamos una breve de 10 minutos con tu equipo esta semana?`,
];

// English variants — same ecosystem pitch for international leads.
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 Mario from LexHouse AI. We built a full AI ecosystem for real estate: enterprise CRM, automated lead extraction, cold-lead reactivation, and a reel generator that creates 3+ minute property videos automatically. Proven ROI in weeks. Want a 5-min demo?`,

  `{nombre}, hey — Mario from LexHouse AI. Our AI-powered CRM (RealtyPlus Nexus) extracts leads from portals, activates them instantly, and reactivates dormant contacts. Plus an auto reel generator that turns property photos into 3+ minute videos. Agencies are already getting ROI in under a month. Shall we run a quick demo?`,

  `Hi {nombre} 👋, Mario from LexHouse AI. One message, one idea: a system that extracts leads, revives the ones gone cold, and builds 3+ minute reels from your property photos. All automatic. Want me to show you a real case in 5 minutes?`,

  `Hey {nombre}, real estate runs on speed. Our AI answers the moment a lead lands, warms up dormant contacts, and keeps everything in one CRM — plus auto reels of 3+ minutes. Want a quick demo?`,

  `Hi {nombre} — Mario. No promises, just a working system: enterprise CRM, 24/7 lead extraction, instant activation, cold-lead reactivation, and an AI that turns your photos into 3+ minute reels. Agencies are seeing ROI in a few weeks. 15-minute call today?`,

  `{nombre}, honest question: how many leads on your list haven't replied in two months? LexHouse AI reactivates them automatically while the CRM captures new ones. And the reel generator works while you sleep. Curious? It takes two minutes to show.`,

  `Hey {nombre} 👋. We built LexHouse AI for agents who hate chasing leads: extraction, activation, reactivation, and property reels — fully automatic, in one workspace. Results you can measure in the first month. Quick walkthrough?`,

  `{nombre}, Mario here. Imagine the perfect day: your CRM captures every lead, replies instantly, revives old ones — and your properties get 3+ minute cinematic reels without you touching a camera. That's live today. Can I show you how?`,

  `Hi {nombre}. One agency moved from spreadsheets to our AI stack — now leads move on their own and the reels do the marketing. That's the LexHouse model. Would 10 minutes be enough for you to check if it fits your operation?`,

  `{nombre}, short one: leads don't get lost when a system never sleeps. Ours handles extraction, activation, reactivation, and self-made reels — proven in real agencies with ROI in weeks. Free for a quick demo this week?`,
];

export const ICEBREAKERS = { es: ICEBREAKERS_ES, en: ICEBREAKERS_EN } as const;

// Mapa de países a código internacional. Claves en minúsculas: nombres
// en español, inglés e ISO 3166-1 alpha-2. Si un número llega sin prefijo
// se le antepone el código según el país del lead.
const PAIS_CODIGO: Record<string, string> = {
  // Chile
  chile: "56", cl: "56", chi: "56",
  // España
  españa: "34", spain: "34", es: "34", esp: "34",
  // México
  mexico: "52", méxico: "52", mx: "52", mex: "52",
  // Argentina
  argentina: "54", ar: "54", arg: "54",
  // Colombia
  colombia: "57", co: "57", col: "57",
  // Perú
  peru: "51", perú: "51", pe: "51", per: "51",
  // Ecuador
  ecuador: "593", ec: "593", ecu: "593",
  // Bolivia
  bolivia: "591", bo: "591", bol: "591",
  // Paraguay
  paraguay: "595", py: "595", pry: "595",
  // Uruguay
  uruguay: "598", uy: "598", ury: "598",
  // Brasil
  brasil: "55", brazil: "55", br: "55", bra: "55",
  // Portugal
  portugal: "351", pt: "351", prt: "351",
  // Estados Unidos / Canadá
  "estados unidos": "1", "ee.uu.": "1", "eeuu": "1", usa: "1", us: "1", "united states": "1",
  canadá: "1", canada: "1", ca: "1", can: "1",
  // Italia
  italia: "39", italy: "39", it: "39", ita: "39",
  // Francia
  francia: "33", france: "33", fr: "33", fra: "33",
  // Alemania
  alemania: "49", germany: "49", de: "49", deu: "49",
  // Reino Unido
  "reino unido": "44", uk: "44", gb: "44", gbr: "44",
  // Australia
  australia: "61", au: "61", aus: "61",
  // Costa Rica
  "costa rica": "506", cr: "506", cri: "506",
  // Panamá
  panama: "507", panamá: "507", pa: "507", pan: "507",
  // República Dominicana
  "república dominicana": "1", "republica dominicana": "1", do: "1", dom: "1",
  // Venezuela
  venezuela: "58", ve: "58", ven: "58",
  // Guatemala
  guatemala: "502", gt: "502", gtm: "502",
  // Cuba
  cuba: "53", cu: "53", cub: "53",
  // Honduras
  honduras: "504", hn: "504", hnd: "504",
  // El Salvador
  "el salvador": "503", sv: "503", slv: "503",
  // Nicaragua
  nicaragua: "505", ni: "505", nic: "505",
  // Puerto Rico
  "puerto rico": "1", pr: "1", pri: "1",
};

function cleanDigits(tel: string): string {
  return tel.split("@")[0].replace(/[^\d]/g, "");
}

// Prefijos internacionales más comunes → código ISO (para detectar país desde el número).
const PREFIJO_PAIS: [string, string][] = [
  ["593", "ec"], ["591", "bo"], ["595", "py"], ["598", "uy"], ["507", "pa"],
  ["506", "cr"], ["502", "gt"], ["504", "hn"], ["503", "sv"], ["505", "ni"],
  ["58", "ve"], ["57", "co"], ["56", "cl"], ["55", "br"], ["54", "ar"],
  ["53", "cu"], ["52", "mx"], ["51", "pe"], ["49", "de"], ["44", "gb"],
  ["39", "it"], ["34", "es"], ["33", "fr"], ["351", "pt"], ["1", "us"],
];

function detectarPais(digits: string): string | null {
  for (const [pref, iso] of PREFIJO_PAIS) {
    if (digits.startsWith(pref) && digits.length - pref.length >= 7) return iso;
  }
  return null;
}

// Busca si el string (pais/ciudad/region) contiene alguna clave conocida.
function buscarClave(raw: string): string | null {
  const s = raw.toLowerCase();
  if (PAIS_CODIGO[s]) return PAIS_CODIGO[s];
  for (const [k, v] of Object.entries(PAIS_CODIGO)) {
    if (k.length >= 2 && s.includes(k)) return v;
  }
  return null;
}

// Ciudades → código ISO para detectar país cuando solo hay ciudad.
const CIUDAD_PAIS: Record<string, string> = {
  // España
  madrid: "es", barcelona: "es", valencia: "es", sevilla: "es", zaragoza: "es",
  málaga: "es", malaga: "es", murcia: "es", palma: "es", bilbao: "es",
  alicante: "es", córdoba: "es", cordoba: "es", valladolid: "es", vigo: "es",
  gijón: "es", gijon: "es", granada: "es", oviedo: "es", santander: "es",
  pamplona: "es", san_sebastián: "es", "san sebastián": "es", "san sebastian": "es",
  burgos: "es", salamanca: "es", toledo: "es", santiago: "es", lugo: "es",
  marbella: "es", ibiza: "es", menorca: "es", tenerife: "es", "las palmas": "es",
  // Chile
  "la serena": "cl", coquimbo: "cl", santiago: "cl", viña: "cl", "viña del mar": "cl",
  valparaíso: "cl", valparaiso: "cl", concepción: "cl", concepcion: "cl",
  antofagasta: "cl", iquique: "cl", temuco: "cl", "puerto montt": "cl",
  // México
  "ciudad de méxico": "mx", "ciudad de mexico": "mx", guadalajara: "mx",
  monterrey: "mx", puebla: "mx", tijuana: "mx", cancún: "mx", cancun: "mx",
  mérida: "mx", merida: "mx", querétaro: "mx", queretaro: "mx",
  // Argentina
  "buenos aires": "ar", córdoba: "ar", rosario: "ar", mendoza: "ar", "la plata": "ar",
  "mar del plata": "ar", tucumán: "ar", tucuman: "ar",
  // Colombia
  bogotá: "co", bogota: "co", medellín: "co", medellin: "co", cali: "co",
  barranquilla: "co", cartagena: "co", bucaramanga: "co",
  // Perú
  lima: "pe", arequipa: "pe", cusco: "pe", trujillo: "pe",
  // Uruguay
  montevideo: "uy", punta: "uy",
  // Panamá
  "panamá": "pa", "panama": "pa",
  // Costa Rica
  "san josé": "cr", "san jose": "cr",
  // Ecuador
  quito: "ec", guayaquil: "ec", cuenca: "ec",
};

function buscarCiudad(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, "").trim();
  if (CIUDAD_PAIS[s]) return PAIS_CODIGO[CIUDAD_PAIS[s]] || null;
  for (const [ciudad, iso] of Object.entries(CIUDAD_PAIS)) {
    if (ciudad.length >= 4 && s.includes(ciudad)) return PAIS_CODIGO[iso] || null;
  }
  return null;
}

// Heurística por longitud y primer dígito cuando no se detecta el país.
function heuristicaPais(digits: string): string | null {
  const len = digits.length;
  const first = digits[0];
  // 9 dígitos empezando con 6 o 7 → España
  if (len === 9 && (first === "6" || first === "7")) return "es";
  // 9 dígitos empezando con 9 → Chile
  if (len === 9 && first === "9") return "cl";
  // 10 dígitos empezando con 1 → posible México/Argentina/Colombia (40 casos)
  if (len === 10 && first === "1") return "mx";
  // 8 dígitos → varios países (Brasil, Perú...), sin suficiente info
  // 11 dígitos empezando con 1 → USA/Canadá
  if (len === 11 && first === "1") return "us";
  return null;
}

// Normaliza un teléfono agregando código de país si es necesario.
// Detecta el país desde: el propio número (prefijo), el campo pais,
// o buscando en el texto de pais/region/ciudad.
export function normalizePhone(tel: string, pais?: string | null): string {
  const digits = cleanDigits(tel);
  if (digits.length < 8) return digits;
  // Si ya tiene prefijo internacional conocido, respetar
  if (detectarPais(digits)) return digits;
  // 10+ dígitos y no empieza con 0 local → probablemente ya internacional
  if (digits.length >= 10 && !digits.startsWith("0")) return digits;
  // 1. Detectar desde el campo pais/region/ciudad
  if (pais) {
    const code = buscarClave(pais) || buscarCiudad(pais);
    if (code) return digits.startsWith("0") ? code + digits.slice(1) : code + digits;
  }
  // 2. Heurística por patrón del número
  const iso = heuristicaPais(digits);
  const fallback = iso ? PAIS_CODIGO[iso] : null;
  if (fallback) return fallback + digits;
  // Sin país detectable → devolver sin modificar
  return digits;
}

function fill(text: string, v: IcebreakerVars): string {
  const nombre = (v.nombre || "").trim();
  return text
    .replace(/\{nombre\}/g, nombre || "👋")
    .replace(/\{empresa\}/g, (v.empresa || "").trim())
    .replace(/\{ciudad\}/g, (v.ciudad || "").trim())
    .replace(/\{pais\}/g, (v.pais || "").trim());
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

// Construye el link de WhatsApp con el icebreaker pre-cargado y código de país.
export function waLinkWithIcebreaker(
  telefono: string,
  vars: IcebreakerVars,
  opts: { seed?: string; idioma?: "es" | "en" } = {},
): string | null {
  const digits = normalizePhone(telefono, vars.pais);
  if (digits.length < 8) return null;
  const seed = opts.seed || (telefono || "") + (vars.nombre || "");
  const msg = pickIcebreaker(seed, vars, opts.idioma || "es");
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
