import type { Mood } from '../lib/types'

export const MASCOT_NAME = 'Casimiro'

interface Palette {
  main: string
  dark: string
  light: string
}

/** Same five palettes are reproduced in the Android widget (MascotDrawing.kt). */
const PALETTE: Record<Mood, Palette> = {
  happy: { main: '#22c55e', dark: '#15803d', light: '#dcfce7' },
  calm: { main: '#3b82f6', dark: '#1d4ed8', light: '#dbeafe' },
  annoyed: { main: '#f59e0b', dark: '#b45309', light: '#fef3c7' },
  angry: { main: '#ef4444', dark: '#b91c1c', light: '#fee2e2' },
  furious: { main: '#991b1b', dark: '#7f1d1d', light: '#fecaca' },
}

interface Face {
  /** Eyebrow height at the outer and inner end. Inner lower means angrier. */
  browOuter: number
  browInner: number
  /** Vertical pupil offset and radius. */
  pupilDy: number
  pupilR: number
  /** Quadratic control point of the mouth. Below the line is a smile. */
  mouthCp: number
  openMouth: boolean
  steam: boolean
  vein: boolean
  sparkles: boolean
}

const FACE: Record<Mood, Face> = {
  happy: {
    browOuter: 64, browInner: 58, pupilDy: -1, pupilR: 5.5,
    mouthCp: 116, openMouth: false, steam: false, vein: false, sparkles: true,
  },
  calm: {
    browOuter: 62, browInner: 62, pupilDy: 0, pupilR: 5.5,
    mouthCp: 109, openMouth: false, steam: false, vein: false, sparkles: false,
  },
  annoyed: {
    browOuter: 60, browInner: 68, pupilDy: 1, pupilR: 5.5,
    mouthCp: 97, openMouth: false, steam: false, vein: false, sparkles: false,
  },
  angry: {
    browOuter: 57, browInner: 72, pupilDy: 2, pupilR: 5,
    mouthCp: 92, openMouth: false, steam: true, vein: false, sparkles: false,
  },
  furious: {
    browOuter: 54, browInner: 74, pupilDy: 2.5, pupilR: 4.5,
    mouthCp: 90, openMouth: true, steam: true, vein: true, sparkles: false,
  },
}

function sparkle(cx: number, cy: number, s: number): string {
  return [
    `M${cx} ${cy - s}`,
    `Q${cx} ${cy} ${cx + s} ${cy}`,
    `Q${cx} ${cy} ${cx} ${cy + s}`,
    `Q${cx} ${cy} ${cx - s} ${cy}`,
    `Q${cx} ${cy} ${cx} ${cy - s}`,
    'Z',
  ].join(' ')
}

interface Props {
  mood: Mood
  size?: number
  /** Disables the wobble on the angriest states. */
  still?: boolean
  className?: string
}

export default function Mascot({ mood, size = 132, still = false, className }: Props) {
  const p = PALETTE[mood]
  const f = FACE[mood]
  const animated = !still && (mood === 'angry' || mood === 'furious')

  return (
    <svg
      viewBox="0 0 120 128"
      width={size}
      height={(size * 128) / 120}
      role="img"
      aria-label={`${MASCOT_NAME}, umore ${mood}`}
      className={[className, animated ? `mascot--shake mascot--${mood}` : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* Ground shadow */}
      <ellipse cx="60" cy="121" rx="43" ry="6" fill="rgba(15, 23, 42, 0.13)" />

      {/* Steam out of the chimney when things get heated */}
      {f.steam && (
        <g fill={p.dark} opacity="0.45">
          <circle cx="86" cy="6" r="4" />
          <circle cx="95" cy="3" r="5.5" />
          <circle cx="104" cy="8" r="4.5" />
        </g>
      )}

      {/* Chimney, drawn before the roof so the roof hides its base */}
      <rect x="86" y="14" width="13" height="28" rx="3" fill={p.dark} />

      {/* Roof */}
      <path d="M4 55 L60 7 L116 55 Z" fill={p.main} />
      <path d="M4 55 L60 7 L116 55 Z" fill="none" stroke={p.dark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 48 L60 14 L100 48" fill="none" stroke={p.dark} strokeWidth="1.6" opacity="0.28" />

      {/* Body */}
      <rect x="16" y="50" width="88" height="66" rx="14" fill={p.light} stroke={p.dark} strokeWidth="3" />

      {/* Anger vein, on the cheek where nothing else is drawn */}
      {f.vein && (
        <g stroke={p.dark} strokeWidth="2.8" strokeLinecap="round" fill="none">
          <path d="M21 96 L27 90 L33 96" />
          <path d="M21 104 L27 98 L33 104" />
        </g>
      )}

      {/* Eyes: the windows of the house */}
      {[44, 76].map((cx) => (
        <ellipse key={cx} cx={cx} cy="80" rx="11.5" ry="12.5" fill="#ffffff" stroke={p.dark} strokeWidth="2.6" />
      ))}
      {[44, 76].map((cx) => (
        <circle key={cx} cx={cx} cy={80 + f.pupilDy} r={f.pupilR} fill="#1e293b" />
      ))}

      {/* Eyebrows, drawn over the eyes so an angry brow presses into them */}
      <g stroke={p.dark} strokeWidth="6" strokeLinecap="round">
        <path d={`M30 ${f.browOuter} L56 ${f.browInner}`} />
        <path d={`M90 ${f.browOuter} L64 ${f.browInner}`} />
      </g>

      {/* Mouth */}
      {f.openMouth ? (
        <>
          <path d="M44 96 Q60 91 76 96 Q76 115 60 115 Q44 115 44 96 Z" fill="#1e293b" />
          <path d="M45 97 L50 104 L55 97 L60 104 L65 97 L70 104 L75 97 Z" fill="#ffffff" />
        </>
      ) : (
        <path
          d={`M46 102 Q60 ${f.mouthCp} 74 102`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}

      {/* Sparkles when the house is spotless */}
      {f.sparkles && (
        <g fill={p.main}>
          <path d={sparkle(14, 30, 7)} />
          <path d={sparkle(107, 24, 5)} />
        </g>
      )}
    </svg>
  )
}
