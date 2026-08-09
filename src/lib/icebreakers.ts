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
  `Hola {nombre} 👋 soy Camil-AI de LexHouse AI. CRM con IA que extrae, activa y reactiva leads por ti, más reels automáticos de 3+ min con tus propiedades. ROI desde el primer mes. ¿Te muestro una demo de 5 min?`,

  `{nombre}, buenas. Camil-AI de LexHouse AI. RealtyPlus Nexus extrae, activa y reactiva leads, y arma reels de 3+ min sin que muevas un dedo. Corredoras ya recuperaron la inversión en semanas. ¿Vemos una demo rápida?`,

  `Hola {nombre}, Camil-AI de LexHouse AI 👋. CRM enterprise con IA que extrae leads nuevos, activa los que llegan y revive a los inactivos, más reels de 3+ min para cada propiedad. Retorno en menos de 30 días. ¿Quieres verlo funcionando?`,

  `Buenas {nombre}. Soy Camil-AI de LexHouse AI. RealtyPlus Nexus hace triple trabajo: extrae, activa y reactiva leads, más reels de +3 min con música, voz y texto. Todo integrado y corriendo ya. ¿Te enseño cómo funciona?`,

  `Hola {nombre} 👋 Camil-AI de LexHouse AI. Ecosistema de IA que cubre todo el ciclo del lead: CRM, extracción, activación, reactivación y reels de 3+ min. Cada módulo probado y con retorno. ¿Hacemos una videollamada de 10 min?`,

  `{nombre}, soy Camil-AI de LexHouse AI. Tres motores de IA en un CRM: extracción de leads, activación con secuencias y reactivación de contactos fríos, más reels de +3 min para Instagram y TikTok. ¿Probamos con un par de tus propiedades?`,

  `Buenas {nombre} — Camil-AI de LexHouse AI. CRM con IA que extrae, activa y reactiva leads, más reels que convierten tus fotos en videos de 3+ min. No es un bot, es un sistema probado. ¿Te interesa verlo con tus datos?`,

  `Hola {nombre}, Camil-AI de LexHouse AI. RealtyPlus Nexus: CRM con IA que extrae, califica, activa y reactiva contactos sin que intervengas, más reels de +3 min listos para publicar. ¿Te lo demuestro en vivo?`,

  `{nombre} 👋 Camil-AI de LexHouse AI. Ecosistema de IA completo: CRM enterprise, extracción 24/7, activación y reactivación automática, y reels de 3+ min con tus propiedades. ROI rápido y comprobado. ¿Vemos cómo aplicarlo?`,

  `Hola {nombre} 👋, Camil-AI de LexHouse AI. Un sistema que extrae leads, revive los fríos y arma reels de 3+ min, todo automático. ¿Te muestro un caso real en 5 min?`,

  `{nombre}, buenas. Camil-AI de LexHouse AI. La mayoría pierde leads por velocidad. Nuestro sistema actúa al instante: CRM, reactivación automática y reels de +3 min. ¿Vemos la demo rápida?`,

  `Hola {nombre} 👋. Mensaje corto, resultado concreto: RealtyPlus Nexus extrae, activa y reactiva leads, y arma reels de 3+ min con tus fotos. ¿Hablamos 3 min hoy?`,

  `{nombre}, una pregunta honesta: ¿cuántos leads de tu cartera no responden desde hace más de un mes? La IA de LexHouse los reactiva, mientras el CRM extrae nuevos. ¿Te cuento cómo funciona?`,

  `Buenas {nombre}, Camil-AI de LexHouse AI. No te vendo una herramienta: te ofrezco el sistema que trabaja por ti. Captura, activa, reactiva leads y arma reels con tus propiedades. ¿Lo vemos funcionando ahora?`,

  `Hola {nombre}, soy Camil-AI. Un CRM con IA que responde, clasifica y reactiva leads, y un generador de reels de 3+ min sin editar nada. Eso es LexHouse AI. ¿Te lo muestro esta semana?`,

  `{nombre} 👋, Camil-AI de LexHouse AI. Una corredora nos dijo: "nunca más quiero una hoja de cálculo". Ahora su CRM extrae, actúa y reactiva solo, con reels de 3+ min. ¿Quieres lo mismo? Te lo enseño en una llamada corta.`,

  `Hola {nombre}, directo al grano: extracción de leads 24/7, activación inmediata, reactivación de cartera y reels integrados en un solo CRM. ¿Te muestro el panel y un caso similar?`,

  `Muy buenas {nombre}, Camil-AI de LexHouse AI. Las corredoras que dejaron de perseguir leads automatizan todo: captura, contacto, reactivación y reels de 3+ min. ¿En 5 min vemos si encaja?`,

  `¡Hola {nombre}! Lo que antes requería horas, hoy lo hace LexHouse AI: CRM con IA, extracción, reactivación y reels de 3+ min medibles. ¿Te hago una demo ahora?`,

  `Hola {nombre}, Camil-AI de LexHouse AI. Ecosistema de IA completo: CRM enterprise, extracción 24/7, activación inmediata, reactivación de cartera fría y reels de 3+ min. Ya corre en corredoras reales. ¿Te paso una demo rápida?`,

  `Buenas {nombre}, Camil-AI de LexHouse AI. Una plataforma que extrae leads, los activa, reactiva los fríos y produce reels de 3+ min, con todo medido en un CRM enterprise. ¿Te muestro el panel en vivo?`,

  `Hola {nombre}, Camil-AI de LexHouse AI. CRM enterprise que captura, activa y revive leads, y arma reels de 3+ min con tus propiedades. Sin que configure nada, retorno desde la primera semana. ¿Vemos cómo funcionaría?`,

  `{nombre}, oye, Camil-AI de LexHouse AI. Una plataforma que resuelve todo el ciclo: extracción, activación, reactivación y CRM con reportes, más reels de 3+ min. Corredoras ya lo usan. ¿Te enseño una demo breve?`,

  `Hola {nombre} 👋, Camil-AI de LexHouse AI. Un solo sistema para tu agencia: CRM con IA, extracción, activación, reactivación y reels de 3+ min generados solos. El ROI se ve desde el primer mes. ¿Coordinamos 10 min con tu equipo?`,
];

// English variants — same ecosystem pitch for international leads.
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 Camil-AI from LexHouse AI. Full AI ecosystem for real estate: CRM, lead extraction, cold-lead reactivation, and 3+ min auto reels. Proven ROI in weeks. Want a 5-min demo?`,

  `{nombre}, hey — Camil-AI from LexHouse AI. Our AI-powered CRM (RealtyPlus Nexus) extracts, activates and reactivates leads, plus auto reels of 3+ min. Agencies see ROI in under a month. Shall we run a quick demo?`,

  `Hi {nombre} 👋, Camil-AI from LexHouse AI. One system that extracts leads, revives the cold ones, and builds 3+ min reels from your photos. All automatic. Want me to show a real case in 5 min?`,

  `Hey {nombre}, real estate runs on speed. Our AI answers the moment a lead lands, warms up cold contacts, and keeps everything in one CRM — plus 3+ min auto reels. Want a quick demo?`,

  `Hi {nombre} — Camil-AI. No promises, just a working system: enterprise CRM, 24/7 lead extraction, instant activation, and AI reels of 3+ min. Agencies see ROI in weeks. 15-min call today?`,

  `{nombre}, honest question: how many leads on your list haven't replied in two months? LexHouse AI reactivates them while the CRM captures new ones, and the reel generator works while you sleep. Curious?`,

  `Hey {nombre} 👋. We built LexHouse AI for agents who hate chasing leads: extraction, activation, reactivation, and property reels — fully automatic, in one workspace. Quick walkthrough?`,

  `{nombre}, Camil-AI here. Imagine: your CRM captures every lead, replies instantly, revives old ones, and your properties get 3+ min cinematic reels without touching a camera. That's live today. Can I show you how?`,

  `Hi {nombre}. One agency moved from spreadsheets to our AI stack — now leads move on their own and reels do the marketing. That's the LexHouse model. Would 10 min be enough to check if it fits?`,

  `{nombre}, short one: leads don't get lost when a system never sleeps. Ours handles extraction, activation, reactivation, and self-made reels — proven in real agencies with ROI in weeks. Free for a quick demo?`,
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
