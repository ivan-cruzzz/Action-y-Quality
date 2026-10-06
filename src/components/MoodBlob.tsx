import { useEffect, useMemo, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";

export interface MoodStyle {
  /** Blob body fill. */
  body: string;
  /** Soft glow under the blob. */
  glow: string;
  /** Big label color under the character (contrast-checked against bg). */
  label: string;
  /** Face stroke (eyes/mouth). */
  face: string;
  /** Full-screen background gradient (top → bottom). */
  bg: [string, string];
  /** Strong text color for headings on this mood's background. */
  inkStrong: string;
  /** Soft (secondary) text color on this mood's background. */
  inkSoft: string;
}

export const MOOD_STYLES: Record<number, MoodStyle> = {
  1: { body: "#5A6B85", glow: "#39445A", label: "#E4EBF3", face: "rgba(255,255,255,0.85)", bg: ["#3F4A5C", "#232A36"], inkStrong: "#F1F5F9", inkSoft: "rgba(255,255,255,0.8)" },
  2: { body: "#7FA8CC", glow: "#5E7A97", label: "#25476B", face: "rgba(11,37,64,0.65)", bg: ["#8FA9C4", "#5E7A97"], inkStrong: "#0B2540", inkSoft: "rgba(11,37,64,0.78)" },
  3: { body: "#7CC7F2", glow: "#3AA7E8", label: "#134C7C", face: "rgba(11,37,64,0.6)", bg: ["#4FB8F0", "#A9DFFB"], inkStrong: "#0B2540", inkSoft: "rgba(11,37,64,0.78)" },
  4: { body: "#86DFB2", glow: "#30A46C", label: "#0A5C36", face: "rgba(6,60,35,0.6)", bg: ["#52C98A", "#B9F0CF"], inkStrong: "#0B2540", inkSoft: "rgba(11,37,64,0.78)" },
  5: { body: "#FFC24B", glow: "#F97316", label: "#9E3D06", face: "rgba(80,40,0,0.6)", bg: ["#FFB36B", "#FFE3C2"], inkStrong: "#431F00", inkSoft: "rgba(67,31,0,0.78)" },
};

export const DEFAULT_MOOD = 3;

/** Premium hue override (0-360) applied in HSL. */
function bodyColor(style: MoodStyle, hue: number | null): string {
  if (hue === null) return style.body;
  return `hsl(${hue} 72% 66%)`;
}

/**
 * Builds a closed blob path with exactly 8 cubic segments for every mood, so
 * motion can morph the `d` attribute (spring shape-shifting, not an image swap).
 */
function blobPath(cx: number, cy: number, rx: number, ry: number, wobble: number[]): string {
  const n = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const w = 1 + wobble[i % wobble.length] * Math.sin(a * 3 + i);
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  // Catmull-Rom → cubic bezier, closed
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}

const SHAPES: Record<number, { rx: number; ry: number; wob: number[]; eyeY: number; mouth: string; brow: number; glasses: number }> = {
  1: { rx: 76, ry: 68, wob: [0.1, 0.05, 0.08, 0.04], eyeY: 6, mouth: "M102 154 C114 140,146 140,158 154", brow: 1, glasses: 0 },
  2: { rx: 80, ry: 72, wob: [0.06, 0.08, 0.05, 0.07], eyeY: 7, mouth: "M102 148 C114 140,146 140,158 148", brow: 0, glasses: 0 },
  3: { rx: 84, ry: 76, wob: [0.05, 0.04, 0.06, 0.04], eyeY: 4.5, mouth: "M102 144 C114 144,146 144,158 144", brow: 0, glasses: 0 },
  4: { rx: 86, ry: 75, wob: [0.07, 0.06, 0.08, 0.05], eyeY: 8.5, mouth: "M102 140 C114 156,146 156,158 140", brow: 0, glasses: 0 },
  5: { rx: 84, ry: 78, wob: [0.08, 0.09, 0.06, 0.08], eyeY: 8.5, mouth: "M100 138 C114 162,146 162,160 138", brow: 0, glasses: 1 },
};

interface MoodBlobProps {
  mood: number;
  hue?: number | null;
}

export function MoodBlob({ mood, hue = null }: MoodBlobProps) {
  const reduced = useReducedMotion();
  const controls = useAnimationControls();
  const [blinking, setBlinking] = useState(false);
  const style = MOOD_STYLES[mood] ?? MOOD_STYLES[DEFAULT_MOOD];
  const shape = SHAPES[mood] ?? SHAPES[DEFAULT_MOOD];
  const path = useMemo(
    () => blobPath(130, 112, shape.rx, shape.ry, shape.wob),
    [shape],
  );

  // Blink every 3–5 seconds.
  useEffect(() => {
    if (reduced) return;
    let timer: number;
    const loop = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 130);
        loop();
      }, 3000 + Math.random() * 2000);
    };
    loop();
    return () => window.clearTimeout(timer);
  }, [reduced]);

  const bounce = () => {
    if (reduced) return;
    void controls.start({
      scale: [1, 0.94, 1.04, 1],
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    });
  };

  const eyeRy = blinking ? 1.2 : shape.eyeY;

  return (
    <svg
      viewBox="0 0 260 236"
      className="h-[240px] w-[264px] max-w-[70vw]"
      role="img"
      aria-label="mood"
      onClick={bounce}
      style={{ cursor: "pointer", touchAction: "manipulation" }}
    >
      <defs>
        <filter id="blobGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <linearGradient id="blobGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* soft glow under the blob */}
      <motion.ellipse
        cx={130}
        cy={212}
        rx={72}
        ry={13}
        animate={{ fill: style.glow, opacity: 0.5 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        filter="url(#blobGlow)"
      />

      {/* breathing loop */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={reduced ? undefined : { scaleY: [1, 1.025, 1], scaleX: [1, 0.99, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* the blob body */}
        <motion.g animate={controls} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <motion.path
            d={path}
            animate={{ fill: bodyColor(style, hue) }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            style={{ filter: "drop-shadow(0 14px 24px rgba(11,37,64,0.25))" }}
          />
          {/* gloss highlight */}
          <path
            d={path}
            fill="url(#blobGloss)"
            opacity={0.65}
            style={{ transformBox: "fill-box", transformOrigin: "center", pointerEvents: "none" }}
          />

          {/* eyes */}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={{ scaleY: blinking ? 0.15 : 1 }}
            transition={{ duration: 0.09 }}
          >
            <motion.ellipse
              cx={107}
              cy={102}
              rx={6.5}
              animate={{ ry: eyeRy, fill: style.face }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            />
            <motion.ellipse
              cx={153}
              cy={102}
              rx={6.5}
              animate={{ ry: eyeRy, fill: style.face }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            />
          </motion.g>

          {/* brows (mood 1) */}
          <motion.g
            animate={{ opacity: shape.brow }}
            transition={{ duration: 0.25 }}
            stroke={style.face}
            strokeWidth={4}
            strokeLinecap="round"
          >
            <path d="M96 84 L114 90" />
            <path d="M164 84 L146 90" />
          </motion.g>

          {/* mouth */}
          <motion.path
            d={shape.mouth}
            animate={{ stroke: style.face }}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
          />

          {/* sunglasses (mood 5) */}
          <motion.g
            animate={{ opacity: shape.glasses, y: shape.glasses ? 0 : -8, scale: shape.glasses ? 1 : 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <rect x={88} y={92} width={34} height={22} rx={9} fill="#1B1B1F" />
            <rect x={138} y={92} width={34} height={22} rx={9} fill="#1B1B1F" />
            <path d="M122 100 Q130 94 138 100" stroke="#1B1B1F" strokeWidth={4} fill="none" />
            <path d="M88 96 L78 92" stroke="#1B1B1F" strokeWidth={4} strokeLinecap="round" />
            <path d="M172 96 L182 92" stroke="#1B1B1F" strokeWidth={4} strokeLinecap="round" />
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
