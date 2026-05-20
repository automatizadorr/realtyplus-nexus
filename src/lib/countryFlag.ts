// Maps a country name (Spanish or English) to its ISO-3166 alpha-2 code,
// then converts that code to the corresponding flag emoji.

const NAME_TO_CODE: Record<string, string> = {
  // América
  argentina: "AR",
  bolivia: "BO",
  brasil: "BR", brazil: "BR",
  canada: "CA", "canadá": "CA",
  chile: "CL",
  colombia: "CO",
  "costa rica": "CR",
  cuba: "CU",
  ecuador: "EC",
  "el salvador": "SV",
  "estados unidos": "US", "united states": "US", usa: "US", eeuu: "US", "ee.uu.": "US",
  guatemala: "GT",
  haiti: "HT", "haití": "HT",
  honduras: "HN",
  mexico: "MX", "méxico": "MX",
  nicaragua: "NI",
  panama: "PA", "panamá": "PA",
  paraguay: "PY",
  peru: "PE", "perú": "PE",
  "puerto rico": "PR",
  "republica dominicana": "DO", "república dominicana": "DO",
  uruguay: "UY",
  venezuela: "VE",
  // Europa
  alemania: "DE", germany: "DE",
  austria: "AT",
  belgica: "BE", "bélgica": "BE",
  dinamarca: "DK",
  espana: "ES", "españa": "ES", spain: "ES",
  finlandia: "FI",
  francia: "FR", france: "FR",
  grecia: "GR",
  irlanda: "IE",
  italia: "IT", italy: "IT",
  noruega: "NO",
  "paises bajos": "NL", "países bajos": "NL", holanda: "NL", netherlands: "NL",
  polonia: "PL",
  portugal: "PT",
  "reino unido": "GB", "united kingdom": "GB", uk: "GB", inglaterra: "GB",
  "republica checa": "CZ", "república checa": "CZ",
  rumania: "RO", "rumanía": "RO",
  rusia: "RU", russia: "RU",
  suecia: "SE",
  suiza: "CH",
  turquia: "TR", "turquía": "TR",
  ucrania: "UA",
  // Asia / Oceanía / África
  arabia: "SA", "arabia saudita": "SA",
  australia: "AU",
  china: "CN",
  "corea del sur": "KR", corea: "KR",
  egipto: "EG",
  filipinas: "PH",
  india: "IN",
  indonesia: "ID",
  israel: "IL",
  japon: "JP", "japón": "JP", japan: "JP",
  malasia: "MY",
  marruecos: "MA",
  "nueva zelanda": "NZ",
  pakistan: "PK", "pakistán": "PK",
  singapur: "SG",
  sudafrica: "ZA", "sudáfrica": "ZA",
  tailandia: "TH",
  vietnam: "VN",
};

function normalize(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function countryToCode(name?: string | null): string | null {
  if (!name) return null;
  const raw = name.trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const key = raw.toLowerCase();
  if (NAME_TO_CODE[key]) return NAME_TO_CODE[key];
  const norm = normalize(raw);
  return NAME_TO_CODE[norm] ?? null;
}

export function countryFlag(name?: string | null): string {
  const code = countryToCode(name);
  if (!code) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - 65),
    A + (code.charCodeAt(1) - 65)
  );
}
