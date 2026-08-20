// Lista fija de países para prospección/vendedores. El valor exacto (string)
// se guarda tal cual en prospeccion_leads.pais y vendedor_paises.pais — la
// RLS que filtra los leads de cada vendedor compara estos strings de forma
// literal, así que cualquier país nuevo debe agregarse aquí y usarse igual
// en el SQL de alta del vendedor.
export const PAISES_PROSPECCION = [
  "Chile",
  "México",
  "España",
  "Colombia",
  "Perú",
  "Argentina",
  "Ecuador",
  "Uruguay",
  "Panamá",
  "Estados Unidos",
] as const;

export type PaisProspeccion = (typeof PAISES_PROSPECCION)[number];
