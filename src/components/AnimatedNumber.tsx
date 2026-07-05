import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Número que cuenta hacia arriba al montar (respeta prefers-reduced-motion). */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <>
      {display.toLocaleString("es-ES", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}

/** Variantes de entrada escalonada para grillas de tarjetas KPI. */
export const kpiGrid = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const kpiItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};
