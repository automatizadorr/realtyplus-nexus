// Icebreakers de WhatsApp para prospección en frío B2B (captar corredores).
// Objetivo: PRIMER contacto que genere RESPUESTA, no una venta de golpe.
// Reglas (playbook LexHouse — MODO OUTBOUND):
//  - Abrir con el DOLOR real del corredor (WhatsApp que no da abasto, leads que
//    se enfrían), no con la herramienta ni presentándose como bot.
//  - UN solo foco: la IA que atiende su WhatsApp 24/7, califica y agenda visitas.
//    Nada de listar features (reels/CRM/etc.); eso es cross-sell posterior.
//  - Corto (2-3 líneas), humano, trato de "tú", máx 1 emoji, sin markdown.
//  - CTA BLANDO (pregunta de sí/no o demo de 20 min). Sin presión.
//  - PROHIBIDO (Ley 19.496): cifras, %, "ROI", "recuperar inversión",
//    rentabilidades o resultados garantizados. Sin precios en frío.
// Rotación determinística por id del lead para que el mismo lead siempre
// reciba el mismo variant.
//
// Variables: {nombre} (nombre del negocio/corredor), {empresa}, {ciudad}, {pais}

export type IcebreakerVars = {
  nombre?: string | null;
  ciudad?: string | null;
  empresa?: string | null;
  pais?: string | null;
};

const ICEBREAKERS_ES: string[] = [
  `Hola {nombre} 👋 ¿cuántas consultas de tus propiedades se te enfrían por no alcanzar a responder a tiempo? Con LexHouse AI una IA atiende tu WhatsApp 24/7, califica el lead y te agenda la visita. ¿Te muestro cómo quedaría con tus propiedades?`,

  `{nombre}, una pregunta honesta: ¿respondes tú mismo cada mensaje de WhatsApp de tus avisos? Hay una IA (LexHouse AI) que lo hace por ti 24/7 y te agenda las visitas ya calificadas. ¿Te cuento cómo en una llamada corta?`,

  `Hola {nombre}. El lead que no respondes en minutos casi siempre se va a otro corredor. LexHouse AI contesta tu WhatsApp al instante, de día y de noche, y te agenda la visita. ¿Te muestro un ejemplo con tus propiedades?`,

  `Buenas {nombre} 👋 ¿te gustaría dejar de vivir pegado al WhatsApp? Una IA de LexHouse AI atiende tus consultas 24/7, filtra a los curiosos y te pasa solo los leads listos para visita. ¿Vemos una demo de 20 min?`,

  `{nombre}, buena parte del día se te va respondiendo consultas y persiguiendo leads, ¿cierto? LexHouse AI hace ese trabajo por ti: atiende tu WhatsApp, califica y agenda. ¿Te muestro cómo funciona?`,

  `Hola {nombre} 👋 ¿te ha pasado que un buen lead te escribe un domingo y lo ves el lunes… tarde? LexHouse AI responde tu WhatsApp al instante todos los días y te agenda la visita. ¿Te cuento cómo?`,

  `{nombre}, ¿tienes cientos de contactos antiguos que nunca retomaste? LexHouse AI reactiva esa cartera por WhatsApp sin que muevas un dedo y te avisa cuando alguien vuelve a interesarse. ¿Te muestro cómo?`,

  `Buenas {nombre}. No te escribo para venderte otra "app más". LexHouse AI es una IA que responde tu WhatsApp, califica los leads y agenda tus visitas sola. ¿Te muestro un ejemplo real con tus propiedades?`,

  `Hola {nombre} 👋 imagina abrir el celular y tener las visitas de la semana ya agendadas, sin haber respondido un solo mensaje. Eso hace LexHouse AI con tu WhatsApp. ¿Vemos una demo corta?`,

  `{nombre}, ¿cuánto vale un lead que se enfría porque nadie respondió a tiempo? LexHouse AI contesta tu WhatsApp 24/7 y agenda la visita antes de que se vaya a otro corredor. ¿Te muestro cómo?`,

  `Hola {nombre}. Los compradores escriben a varios corredores a la vez; suele ganar el que responde primero. LexHouse AI responde por ti al instante y agenda la visita. ¿Te muestro en 20 min?`,

  `Buenas {nombre} 👋 ¿y si tu WhatsApp trabajara solo mientras estás en una propiedad o durmiendo? LexHouse AI atiende, califica y agenda por ti. ¿Te cuento cómo en una llamada corta?`,

  `{nombre}, a muchos corredores se les escapan ventas por seguimiento lento, no por malas propiedades. LexHouse AI responde y da seguimiento por WhatsApp de forma automática. ¿Te muestro cómo se vería con tu cartera?`,

  `Hola {nombre} 👋 ¿te imaginas no volver a perder una consulta por estar ocupado? LexHouse AI atiende tu WhatsApp 24/7 y te entrega los leads ya calificados y agendados. ¿Vemos una demo?`,

  `{nombre}, si tuvieras un asistente que respondiera cada mensaje al segundo y agendara tus visitas, ¿lo probarías? Eso es LexHouse AI, conectado a tu propio WhatsApp. ¿Te muestro en 20 min?`,

  `Buenas {nombre}. Sé que el WhatsApp de un corredor no para. LexHouse AI lo atiende por ti: responde, filtra curiosos y agenda solo a los interesados de verdad. ¿Te cuento cómo funciona?`,

  `Hola {nombre} 👋 te escribo directo: una IA que contesta tu WhatsApp 24/7, califica los leads y te llena la agenda de visitas. Es LexHouse AI. ¿Te muestro un ejemplo con tus propiedades?`,

  `{nombre}, ¿qué harías con las horas que hoy gastas respondiendo y coordinando visitas? LexHouse AI se encarga de eso por WhatsApp para que tú solo cierres. ¿Vemos una demo corta?`,

  `Hola {nombre}. Cada consulta sin responder es una visita que no ocurre. LexHouse AI responde tu WhatsApp al instante y agenda la visita en tu calendario. ¿Te muestro cómo en 20 min?`,

  `Buenas {nombre} 👋 ¿alcanzas a responder todos los mensajes el mismo día? LexHouse AI lo hace en segundos, califica y agenda. ¿Te cuento cómo se adaptaría a tu operación?`,

  `{nombre}, hoy los clientes esperan respuesta inmediata y a toda hora. LexHouse AI le da eso a tu WhatsApp sin que tú estés pendiente, y te agenda las visitas. ¿Te muestro cómo?`,

  `Hola {nombre} 👋 mensaje corto: una IA responde tu WhatsApp, separa a los curiosos de los compradores reales y te agenda las visitas. Se llama LexHouse AI. ¿Te muestro un ejemplo?`,
];

// English variants — same pain-first WhatsApp angle for international leads.
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 how many WhatsApp enquiries about your listings go cold before you can reply? LexHouse AI answers your WhatsApp 24/7, qualifies each lead and books the viewing. Want a quick 20-min demo?`,

  `{nombre}, honest question: do you reply to every WhatsApp from your listings yourself? LexHouse AI does it for you 24/7 and books qualified viewings. Can I show you how?`,

  `Hi {nombre}. The lead you don't answer in minutes usually goes to another agent. LexHouse AI replies to your WhatsApp instantly, day or night, and books the viewing. Want an example with your listings?`,

  `Hey {nombre} 👋 what if your WhatsApp worked on its own while you're out at a property or asleep? LexHouse AI answers, qualifies and books for you. Fancy a short demo?`,

  `{nombre}, a big chunk of an agent's day goes into replying and following up. LexHouse AI handles that on your WhatsApp — answers, qualifies, books. Can I show you how it works?`,

  `Hi {nombre} 👋 got hundreds of old contacts you never followed up? LexHouse AI re-engages them over WhatsApp automatically and flags anyone who's interested again. Want to see how?`,

  `{nombre}, buyers message several agents at once — the fastest reply usually wins. LexHouse AI replies for you instantly and books the viewing. Shall I show you in 20 min?`,

  `Hey {nombre}. I'm not pitching another app. LexHouse AI is an AI that answers your WhatsApp, qualifies leads and books your viewings. Want a real example with your listings?`,

  `Hi {nombre} 👋 imagine opening your phone to a week of viewings already booked, without replying to a single message. That's LexHouse AI on your WhatsApp. Up for a quick demo?`,

  `{nombre}, what would you do with the hours you spend replying and coordinating viewings? LexHouse AI takes that over on WhatsApp so you just close. Want a short demo?`,
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
