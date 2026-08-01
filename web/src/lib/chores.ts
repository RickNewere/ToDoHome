import type { ChoreState, ChoreStatusRow, ChoreView, Mood, Person } from './types'
import { PEOPLE } from './types'

export function toView(row: ChoreStatusRow): ChoreView {
  const checkedBy: Record<Person, boolean> = {
    riccardo: row.riccardo_at != null,
    roberta: row.roberta_at != null,
  }
  const state: ChoreState =
    row.days_late > 0 ? 'late' : row.days_late === 0 ? 'due' : 'upcoming'

  return {
    ...row,
    state,
    checkedBy,
    waitingFor: PEOPLE.filter((p) => !checkedBy[p]),
  }
}

/** Sort inside a group: the most overdue first, then by the fixed chore order. */
export function compareChores(a: ChoreView, b: ChoreView): number {
  if (a.days_late !== b.days_late) return b.days_late - a.days_late
  return a.sort_order - b.sort_order
}

/** How angry the mascot is, driven by how many chores are late and by how much.
 *  The same thresholds are mirrored in the Android widget (Mood.kt). */
export function computeMood(chores: ChoreView[]): Mood {
  const late = chores.filter((c) => c.state === 'late')
  const dueToday = chores.filter((c) => c.state === 'due').length
  const worst = late.reduce((max, c) => Math.max(max, c.days_late), 0)

  if (late.length === 0) return dueToday === 0 ? 'happy' : 'calm'
  if (late.length <= 1 && worst <= 2) return 'annoyed'
  if (late.length <= 3 && worst <= 4) return 'angry'
  return 'furious'
}

export const MOOD_META: Record<Mood, { title: string; line: string; color: string }> = {
  happy: {
    title: 'Casa in ordine',
    line: 'Non c’è niente da fare. Goditela.',
    color: '#22c55e',
  },
  calm: {
    title: 'Tutto sotto controllo',
    line: 'Qualcosa da fare oggi, ma siete in orario.',
    color: '#3b82f6',
  },
  annoyed: {
    title: 'Ehm, qualcosa manca',
    line: 'Una faccenda è scivolata. Recuperatela.',
    color: '#f59e0b',
  },
  angry: {
    title: 'Datevi una mossa',
    line: 'Ci sono faccende ferme da giorni.',
    color: '#ef4444',
  },
  furious: {
    title: 'Casa allo sbando',
    line: 'Così non si va avanti. Rimboccatevi le maniche.',
    color: '#991b1b',
  },
}

/** Human readable due label, e.g. "In ritardo di 3 giorni" or "Tra 2 giorni". */
export function dueLabel(chore: ChoreView): string {
  const n = chore.days_late
  if (n > 0) return n === 1 ? 'In ritardo di 1 giorno' : `In ritardo di ${n} giorni`
  if (n === 0) return 'Da fare oggi'
  if (n === -1) return 'Da fare domani'
  return `Tra ${-n} giorni`
}

export function cadenceLabel(chore: Pick<ChoreView, 'cadence_days' | 'weekend_only'>): string {
  const d = chore.cadence_days
  let base: string
  if (d === 1) base = 'Ogni giorno'
  else if (d === 7) base = '1 volta a settimana'
  else if (d === 14) base = 'Ogni 2 settimane'
  else if (d === 30) base = '1 volta al mese'
  else base = `Ogni ${d} giorni`
  return chore.weekend_only ? `${base}, sabato o domenica` : base
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'mai'
  // due_date is a bare YYYY-MM-DD, which Date reads as UTC midnight: west of
  // Greenwich that renders as the day before. Build it as a local date instead.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso)
  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
