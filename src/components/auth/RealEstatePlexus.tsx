import { useEffect, useRef } from "react";

/**
 * Plexus animado temático real estate.
 * Nodos en forma de pequeñas casas/edificios conectados por líneas
 * que evocan una red inmobiliaria internacional.
 */
export function RealEstatePlexus() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let animationId = 0;

    type Node = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      kind: "house" | "dot" | "tower";
      size: number;
      pulse: number;
    };

    let nodes: Node[] = [];

    const NAVY = "15, 43, 90"; // #0f2b5a
    const RED = "207, 20, 43"; // #cf142b

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Densidad adaptada al área
      const target = Math.min(90, Math.max(40, Math.floor((width * height) / 22000)));
      nodes = Array.from({ length: target }, () => {
        const r = Math.random();
        const kind: Node["kind"] = r < 0.18 ? "house" : r < 0.26 ? "tower" : "dot";
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          kind,
          size: kind === "dot" ? 1.6 + Math.random() * 1.4 : 5 + Math.random() * 3,
          pulse: Math.random() * Math.PI * 2,
        };
      });
    };

    const drawHouse = (n: Node) => {
      const s = n.size;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.strokeStyle = `rgba(${NAVY}, 0.55)`;
      ctx.fillStyle = `rgba(${RED}, 0.18)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      // base
      ctx.moveTo(-s, s * 0.4);
      ctx.lineTo(-s, -s * 0.2);
      // techo
      ctx.lineTo(0, -s);
      ctx.lineTo(s, -s * 0.2);
      ctx.lineTo(s, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // chevron rojo (logo Realtyplus)
      ctx.strokeStyle = `rgba(${RED}, 0.7)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.25);
      ctx.lineTo(0, -s * 0.75);
      ctx.lineTo(s * 0.7, -s * 0.25);
      ctx.stroke();
      ctx.restore();
    };

    const drawTower = (n: Node) => {
      const s = n.size;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.strokeStyle = `rgba(${NAVY}, 0.5)`;
      ctx.fillStyle = `rgba(${NAVY}, 0.08)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-s * 0.6, -s, s * 1.2, s * 1.6);
      ctx.fill();
      ctx.stroke();
      // ventanas
      ctx.fillStyle = `rgba(${RED}, 0.55)`;
      const cols = 2;
      const rows = 3;
      const w = (s * 1.2) / (cols * 2 + 1);
      const h = (s * 1.6) / (rows * 2 + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(-s * 0.6 + w * (c * 2 + 1), -s + h * (r * 2 + 1), w, h);
        }
      }
      ctx.restore();
    };

    const drawDot = (n: Node, t: number) => {
      const pulse = 0.6 + Math.sin(t * 0.002 + n.pulse) * 0.4;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${NAVY}, 0.55)`;
      ctx.fill();
    };

    const tick = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      // Mover nodos
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // Conexiones
      const maxDist = Math.min(180, Math.max(120, width / 9));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            const alpha = (1 - d / maxDist) * 0.35;
            const isAccent = a.kind !== "dot" && b.kind !== "dot";
            ctx.strokeStyle = isAccent
              ? `rgba(${RED}, ${alpha * 0.9})`
              : `rgba(${NAVY}, ${alpha})`;
            ctx.lineWidth = isAccent ? 0.9 : 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Nodos
      for (const n of nodes) {
        if (n.kind === "house") drawHouse(n);
        else if (n.kind === "tower") drawTower(n);
        else drawDot(n, t);
      }

      animationId = requestAnimationFrame(tick);
    };

    resize();
    animationId = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden
    />
  );
}
