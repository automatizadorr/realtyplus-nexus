// Icebreakers de WhatsApp para prospección en frío B2B (captar corredores).
// Objetivo: PRIMER contacto que genere RESPUESTA, no una venta de golpe.
// Ángulo (playbook LexHouse — MODO OUTBOUND): DIFERENCIACIÓN POR ECOSISTEMA.
//  - Hoy "una IA que responde WhatsApp" la tiene cualquiera; NO es diferencia.
//    Abrir con el CONTRASTE: no es un bot suelto, es el ecosistema completo del
//    corredor (capta, atiende, publica, comercializa y hace seguimiento).
//  - Anclar la amplitud con SOLO 2-3 piezas concretas (WhatsApp 24/7, publicador
//    +12 portales, reels, CRM con scoring, agente de voz). NUNCA listar las 12
//    → eso es feature-dump y hunde la respuesta.
//  - Corto (2-3 líneas), humano, trato de "tú", máx 1 emoji, sin markdown.
//  - CTA BLANDO (demo de 20 min o "¿te muestro?"). Sin presión.
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
  `Hola {nombre} 👋 hoy cualquiera te instala un chatbot de WhatsApp. Lo que nadie te da es el resto: captar el lead, publicar tu aviso en 12 portales y armarte los reels. LexHouse AI es el ecosistema completo, no una IA suelta. ¿Te muestro cómo se ve todo junto?`,

  `{nombre}, están saliendo mil "agentes IA" que solo responden mensajes. LexHouse AI no es eso: atiende tu WhatsApp, publica tus propiedades y hace tu marketing, todo integrado. ¿Te muestro la diferencia en 20 min?`,

  `Hola {nombre}. Un bot de WhatsApp lo tiene cualquiera. Un sistema que además capta leads, los califica, publica tus avisos y te arma los videos, no. Eso es LexHouse AI. ¿Te muestro cómo funcionaría con tus propiedades?`,

  `Buenas {nombre} 👋 la diferencia no es tener una IA que conteste; es tener todo el trabajo del corredor resuelto en un solo lugar: WhatsApp, publicación, seguimiento y reels. Eso es LexHouse AI. ¿Vemos una demo corta?`,

  `{nombre}, ¿otra IA de WhatsApp? No. LexHouse AI es un ecosistema para corredores: atiende, califica y agenda, publica tus propiedades y te genera el marketing. ¿Te cuento cómo encaja en tu día?`,

  `Hola {nombre} 👋 los chatbots contestan y ahí quedan. LexHouse AI se hace cargo de todo el ciclo: capta el lead, lo atiende por WhatsApp, publica el aviso y hace el seguimiento. ¿Te muestro el sistema completo?`,

  `{nombre}, te habrán ofrecido varias "IA que responde WhatsApp". La diferencia de LexHouse AI es que es el ecosistema entero: CRM, publicador en 12 portales, reels y agente de voz, integrados. ¿Te muestro cómo se ve?`,

  `Buenas {nombre}. No te ofrezco un bot más. LexHouse AI es la plataforma completa del corredor: atiende tu WhatsApp, publica tus avisos y arma tus videos, todo conectado. ¿Te muestro un ejemplo real con tus propiedades?`,

  `Hola {nombre} 👋 tener una IA que conteste ya no es diferencia; hoy la tiene cualquiera. La diferencia es tener también captación, publicación, reels y seguimiento en un solo sistema. Eso es LexHouse AI. ¿Vemos una demo?`,

  `{nombre}, la mayoría te vende una pieza suelta (un bot, o un CRM, o reels). LexHouse AI te da las piezas juntas y trabajando entre sí, hechas para corredores. ¿Te muestro cómo cambia tu operación?`,

  `Hola {nombre}. Un chatbot atiende; un ecosistema vende. LexHouse AI capta el lead, lo atiende por WhatsApp, publica tu propiedad en 12 portales y le hace seguimiento. ¿Te muestro en 20 min?`,

  `Buenas {nombre} 👋 ¿por qué armar tu operación con 5 apps distintas si LexHouse AI ya integra WhatsApp IA, CRM, publicador, reels y agente de voz en uno solo? ¿Te muestro cómo se ve todo junto?`,

  `{nombre}, lo fácil es instalar un bot de WhatsApp; lo que de verdad mueve la aguja es tener todo el flujo integrado. Eso construimos en LexHouse AI. ¿Te cuento cómo?`,

  `Hola {nombre} 👋 no es "una IA más": es un ecosistema para corredores que atiende tu WhatsApp, publica tus avisos, reactiva tu cartera dormida y te arma los reels. ¿Te muestro cómo funcionaría contigo?`,

  `{nombre}, si ya viste chatbots y no te convencieron, es porque un chatbot solo no basta. LexHouse AI suma CRM, publicación, marketing y reels alrededor de ese WhatsApp. ¿Te muestro la diferencia?`,

  `Buenas {nombre}. Todos prometen "IA para inmobiliarias". LexHouse AI lo respalda con un ecosistema real: WhatsApp 24/7, publicador en 12 portales, reels y hasta análisis de contratos. ¿Vemos una demo corta?`,

  `Hola {nombre} 👋 la pregunta ya no es si quieres una IA, sino si quieres una pieza suelta o el sistema completo. LexHouse AI es el sistema completo del corredor. ¿Te muestro qué incluye con tus propiedades?`,

  `{nombre}, un bot te ahorra responder; un ecosistema te ahorra el día entero. LexHouse AI cubre WhatsApp, publicación, seguimiento y reels en un solo lugar. ¿Te cuento cómo?`,

  `Hola {nombre}. Puedes juntar 4 herramientas y pelearte con las integraciones, o usar LexHouse AI donde WhatsApp IA, CRM, publicador y reels ya vienen conectados. ¿Te muestro cómo se ve?`,

  `Buenas {nombre} 👋 lo que hace único a LexHouse AI no es la IA de WhatsApp (esa la tienen muchos), sino que capta, publica, comercializa y da seguimiento por ti, todo integrado. ¿Vemos una demo?`,

  `{nombre}, no te sumo otra app a las que ya tienes: LexHouse AI las reemplaza con un solo ecosistema (WhatsApp, CRM, publicador, reels, voz) pensado para corredores. ¿Te muestro cómo?`,

  `Hola {nombre} 👋 mensaje corto: no es un bot, es el ecosistema completo del corredor — atiende tu WhatsApp, publica tus avisos y arma tus reels, todo junto. Se llama LexHouse AI. ¿Te muestro un ejemplo?`,
];

// English variants — same ecosystem-contrast angle for international leads.
const ICEBREAKERS_EN: string[] = [
  `Hi {nombre} 👋 anyone can set up a WhatsApp chatbot these days. What nobody gives you is the rest: capturing the lead, listing your property across portals and building the reels. LexHouse AI is the full ecosystem, not a standalone bot. Want to see it all together?`,

  `{nombre}, another "AI that answers WhatsApp"? That's not us. LexHouse AI handles the whole flow for agents: it answers, qualifies and books, lists your properties and builds your marketing. Want to see the difference in 20 min?`,

  `Hi {nombre}. A chatbot just replies; an ecosystem sells. LexHouse AI captures the lead, answers your WhatsApp, lists your property and follows up. Want me to show you with your listings?`,

  `Hey {nombre} 👋 the edge isn't having an AI that replies — everyone has that now. It's having capture, listing, reels and follow-up in one system. That's LexHouse AI. Fancy a short demo?`,

  `{nombre}, most people sell you one piece (a bot, or a CRM, or reels). LexHouse AI gives you the pieces working together, built for agents. Want to see how it changes your day?`,

  `Hi {nombre} 👋 why run your business on 5 separate apps when LexHouse AI already bundles WhatsApp AI, CRM, listing and reels into one? Want to see it all together?`,

  `Hey {nombre}. I'm not offering another bot. LexHouse AI is the agent's full platform: it answers your WhatsApp, lists your properties and makes your videos, all connected. Want a real example with your listings?`,

  `Hi {nombre} 👋 a bot saves you replying; an ecosystem saves your whole day. LexHouse AI covers WhatsApp, listing, follow-up and reels in one place. Can I show you how?`,

  `{nombre}, if chatbots left you unconvinced, it's because a bot alone isn't enough. LexHouse AI adds CRM, listing, marketing and reels around that WhatsApp. Want to see the difference?`,

  `Hi {nombre} 👋 short one: it's not a bot, it's the agent's full ecosystem — answers your WhatsApp, lists your properties and builds your reels, all together. It's LexHouse AI. Want an example?`,
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
