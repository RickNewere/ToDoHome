export type Person = 'riccardo' | 'roberta'

export const PEOPLE: Person[] = ['riccardo', 'roberta']

export const PERSON_LABEL: Record<Person, string> = {
  riccardo: 'Riccardo',
  roberta: 'Roberta',
}

export const PERSON_INITIAL: Record<Person, string> = {
  riccardo: 'R',
  roberta: 'Ro',
}

/** One row of the `chore_status` view. Due date and lateness come from Postgres
 *  so that the web app and the Android widget always agree. */
export interface ChoreStatusRow {
  id: string
  name: string
  emoji: string
  category: string
  cadence_days: number
  weekend_only: boolean
  note: string | null
  sort_order: number
  last_completed_at: string | null
  open_run_id: string | null
  riccardo_at: string | null
  roberta_at: string | null
  /** YYYY-MM-DD */
  due_date: string
  /** Positive when overdue, 0 when due today, negative when still upcoming. */
  days_late: number
}

export type ChoreState = 'upcoming' | 'due' | 'late'

export interface ChoreView extends ChoreStatusRow {
  state: ChoreState
  checkedBy: Record<Person, boolean>
  /** Who still has to tick before the chore counts as done. */
  waitingFor: Person[]
}

export type Mood = 'happy' | 'calm' | 'annoyed' | 'angry' | 'furious'

/** What the editor form works on. `id` is null when creating a new chore. */
export interface ChoreDraft {
  id: string | null
  name: string
  emoji: string
  category: string
  cadenceDays: number
  weekendOnly: boolean
  note: string
}

export const EMPTY_DRAFT: ChoreDraft = {
  id: null,
  name: '',
  emoji: '🏠',
  category: 'Casa',
  cadenceDays: 7,
  weekendOnly: false,
  note: '',
}

export function draftFrom(chore: ChoreStatusRow): ChoreDraft {
  return {
    id: chore.id,
    name: chore.name,
    emoji: chore.emoji,
    category: chore.category,
    cadenceDays: chore.cadence_days,
    weekendOnly: chore.weekend_only,
    note: chore.note ?? '',
  }
}
