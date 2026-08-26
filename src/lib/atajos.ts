// ---------------------------------------------------------------------
// Atajos de teclado: helpers compartidos.
//
// La cola de "Hoy" se trabaja de a un lead por vez y siempre con la misma
// secuencia (abrir canal -> marcar desenlace -> guardar). Con el mouse son
// tres viajes por lead; con el teclado, tres teclas. Ahí está la diferencia
// entre tocar 20 leads en una sesión y tocar 60.
// ---------------------------------------------------------------------

/** El usuario está escribiendo: los atajos de una sola letra no deben robar la tecla. */
export function escribiendoEnCampo(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

/** Combinación con modificador: se deja pasar al navegador (copiar, refrescar, etc.). */
export function conModificador(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}
