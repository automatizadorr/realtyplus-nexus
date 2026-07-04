import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useReducedMotion } from 'framer-motion';

/*
  HydroRipple — simulación de superficie de agua en Canvas 2D (height-field).

  Independiente de GPU (no usa WebGL): funciona en cualquier navegador/dispositivo.
  Dos buffers Float32Array que propagan la ecuación de onda; el gradiente de
  altura desplaza los píxeles de la imagen → refracción real. Cada "drop" inyecta
  altura en un círculo → ondas concéntricas como una piedra al agua.

  API:
    forwardRef<HydroRippleHandle> → triggerSplash() para el modo passthrough.
    cover       → rellena el contenedor (absolute inset-0).
    passthrough → pointer-events:none, el padre gestiona los eventos.
*/

// ── Física (intensidad SUAVE — ondas sutiles, poco intrusivas) ──────────────────
const DAMPING     = 0.976;    // menor = las ondas se disipan rápido (menos acumulación)
const SIM_W_MAX   = 460;      // ancho del buffer (CSS escala el canvas)
const ENTER_R     = 7;
const ENTER_STR   = 95;       // impacto de entrada suave
const TRAIL_R     = 4;
const TRAIL_STR   = 24;       // estela muy tenue al mover el cursor
const MIN_DIST_SQ = 50 * 50;  // gotas bien espaciadas → menos "huellas"
const DISPLACE    = 0.48;     // refracción sutil (poca deformación)

export interface HydroRippleHandle {
  triggerSplash(clientX: number, clientY: number, type: 'enter' | 'trail'): void;
}

interface HydroRippleProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  cover?: boolean;
  passthrough?: boolean;
  width?: number;
  height?: number;
  fetchPriority?: 'high' | 'low' | 'auto';
  decoding?: 'async' | 'sync' | 'auto';
  loading?: 'lazy' | 'eager';
}

export const HydroRipple = forwardRef<HydroRippleHandle, HydroRippleProps>(
  function HydroRipple(
    { src, alt, className, imgClassName, imgStyle, cover, passthrough,
      width, height, fetchPriority, decoding, loading },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const reduce       = useReducedMotion();

    const buf1Ref   = useRef<Float32Array | null>(null);
    const buf2Ref   = useRef<Float32Array | null>(null);
    const pixelsRef = useRef<Uint8ClampedArray | null>(null);
    const wRef      = useRef(0);
    const hRef      = useRef(0);
    const rafRef    = useRef(0);
    const readyRef  = useRef(false);
    const lastPos   = useRef({ x: -9999, y: -9999 });

    // ── Impacto (piedra → agua) ────────────────────────────────────────────
    const doSplash = useCallback((clientX: number, clientY: number, radius: number, strength: number) => {
      if (!readyRef.current || !canvasRef.current || !buf1Ref.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const W = wRef.current, H = hRef.current;
      const cx = Math.round((clientX - rect.left) * W / rect.width);
      const cy = Math.round((clientY - rect.top)  * H / rect.height);
      const B1 = buf1Ref.current;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < W - 1 && py > 0 && py < H - 1) {
              const dist = Math.sqrt(dx * dx + dy * dy) / radius;
              B1[py * W + px] += strength * (1 - dist * 0.5);
            }
          }
        }
      }
    }, []);

    useImperativeHandle(ref, () => ({
      triggerSplash(clientX, clientY, type) {
        doSplash(clientX, clientY,
          type === 'enter' ? ENTER_R : TRAIL_R,
          type === 'enter' ? ENTER_STR : TRAIL_STR);
      },
    }), [doSplash]);

    const onMouseEnter = useCallback((e: React.MouseEvent) => {
      doSplash(e.clientX, e.clientY, ENTER_R, ENTER_STR);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }, [doSplash]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      if (dx * dx + dy * dy < MIN_DIST_SQ) return;
      doSplash(e.clientX, e.clientY, TRAIL_R, TRAIL_STR);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }, [doSplash]);

    // ── Simulación ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (reduce) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        requestAnimationFrame(() => {
          const container = containerRef.current;
          if (!container) return;

          let W: number, H: number;
          const cW = container.offsetWidth  || SIM_W_MAX;
          const cH = container.offsetHeight || Math.round(SIM_W_MAX * 9 / 16);
          if (cover) {
            W = Math.min(cW, SIM_W_MAX);
            H = Math.max(1, Math.round(W * cH / cW));
          } else {
            W = Math.min(SIM_W_MAX, cW);
            H = Math.round(W * img.naturalHeight / img.naturalWidth);
          }

          canvas.width = W; canvas.height = H;
          wRef.current = W; hRef.current = H;

          // Dibuja la imagen con cover-scaling (llena el canvas sin deformar)
          const imgR = img.naturalWidth / img.naturalHeight;
          const canR = W / H;
          let dw = W, dh = H, ox = 0, oy = 0;
          if (imgR > canR) { dh = H; dw = dh * imgR; ox = (W - dw) / 2; }
          else             { dw = W; dh = dw / imgR;  oy = (H - dh) / 2; }
          ctx.drawImage(img, ox, oy, dw, dh);

          try {
            pixelsRef.current = new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data);
          } catch {
            canvas.style.display = 'none'; // CORS fallback: deja ver la <img>
            return;
          }

          buf1Ref.current = new Float32Array(W * H);
          buf2Ref.current = new Float32Array(W * H);
          readyRef.current = true;
          const out = ctx.createImageData(W, H);

          const tick = () => {
            const B1 = buf1Ref.current!, B2 = buf2Ref.current!, px = pixelsRef.current!;

            for (let y = 1; y < H - 1; y++) {
              for (let x = 1; x < W - 1; x++) {
                const i = y * W + x;
                B2[i] = (B1[i - 1] + B1[i + 1] + B1[i - W] + B1[i + W]) / 2 - B2[i];
                B2[i] *= DAMPING;
              }
            }
            buf1Ref.current = B2; buf2Ref.current = B1;

            const B = buf1Ref.current;
            for (let y = 1; y < H - 1; y++) {
              for (let x = 1; x < W - 1; x++) {
                const i  = y * W + x;
                const sx = Math.max(0, Math.min(W - 1, x + Math.round((B[i + 1] - B[i - 1]) * DISPLACE)));
                const sy = Math.max(0, Math.min(H - 1, y + Math.round((B[i + W] - B[i - W]) * DISPLACE)));
                const si = (sy * W + sx) * 4;
                const di = i * 4;
                // Realce especular: pendiente positiva = brillo
                const shade = (B[i] - B[i + 1]) * 2;
                out.data[di]     = Math.max(0, Math.min(255, px[si]     + shade));
                out.data[di + 1] = Math.max(0, Math.min(255, px[si + 1] + shade));
                out.data[di + 2] = Math.max(0, Math.min(255, px[si + 2] + shade));
                out.data[di + 3] = 255;
              }
            }
            ctx.putImageData(out, 0, 0);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        });
      };

      img.onerror = () => { if (canvasRef.current) canvasRef.current.style.display = 'none'; };
      img.src = src;

      return () => {
        cancelAnimationFrame(rafRef.current);
        readyRef.current = false;
        buf1Ref.current = null;
        buf2Ref.current = null;
        pixelsRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, cover, reduce]);

    const canvasStyle: React.CSSProperties = cover
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...imgStyle }
      : { display: 'block', width: '100%', height: 'auto', ...imgStyle };

    return (
      <div
        ref={containerRef}
        className={className}
        style={passthrough ? { pointerEvents: 'none' } : undefined}
        onMouseEnter={passthrough ? undefined : onMouseEnter}
        onMouseMove={passthrough  ? undefined : onMouseMove}
      >
        {/* Fallback estático: reduced-motion o CORS/carga fallida (queda debajo del canvas) */}
        <img
          src={src} alt={alt}
          className={imgClassName}
          style={cover ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...imgStyle } : imgStyle}
          width={width} height={height}
          fetchPriority={fetchPriority} decoding={decoding} loading={loading}
          aria-hidden={!reduce}
        />
        {!reduce && (
          <canvas ref={canvasRef} className={imgClassName} style={canvasStyle} aria-hidden />
        )}
      </div>
    );
  }
);
