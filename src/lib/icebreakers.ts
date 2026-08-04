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
  pais?: string | null;
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
