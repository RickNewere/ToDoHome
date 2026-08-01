import Casimiro from './Mascot'
import { cadenceLabel, dueLabel, formatDate } from '../lib/chores'
import { PERSON_LABEL, PEOPLE, type ChoreView, type Person } from '../lib/types'

interface Props {
  chore: ChoreView
  me: Person
  busy: boolean
  onToggle: (chore: ChoreView) => void
  onReopen: (chore: ChoreView) => void
  onEdit: (chore: ChoreView) => void
  /** Rendered in the "Fatte" group: shows the last completion instead of ticks. */
  done?: boolean
}

export default function ChoreCard({
  chore,
  me,
  busy,
  onToggle,
  onReopen,
  onEdit,
  done = false,
}: Props) {
  return (
    <article className={`card card--${chore.state}${busy ? ' card--busy' : ''}`}>
      <div className="card__head">
        <span className="card__emoji" aria-hidden="true">
          {chore.emoji}
        </span>
        <div className="card__text">
          <h3 className="card__name">{chore.name}</h3>
          <p className="card__due">{done ? `Fatta il ${formatDate(chore.last_completed_at)}` : dueLabel(chore)}</p>
          <p className="card__meta">
            {cadenceLabel(chore)}
            {chore.note ? ` · ${chore.note}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="card__edit"
          onClick={() => onEdit(chore)}
          aria-label={`Modifica ${chore.name}`}
        >
          ✎
        </button>
      </div>

      {done ? (
        <div className="card__actions">
          <span className="card__nextdue">Torna il {formatDate(chore.due_date)}</span>
          <button type="button" className="btn-undo" onClick={() => onReopen(chore)} disabled={busy}>
            Annulla
          </button>
        </div>
      ) : (
        <div className="card__ticks">
          {PEOPLE.map((person) => {
            const checked = chore.checkedBy[person]
            const mine = person === me
            return (
              <button
                key={person}
                type="button"
                className={`tick${checked ? ' tick--on' : ''}${mine ? ' tick--mine' : ''}`}
                onClick={() => mine && onToggle(chore)}
                disabled={!mine || busy}
                aria-pressed={checked}
                title={mine ? 'Tocca per spuntare' : `Deve spuntare ${PERSON_LABEL[person]}`}
              >
                <span className="tick__box" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                <span className="tick__name">{PERSON_LABEL[person]}</span>
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

/** Empty state shown when a tab has nothing in it. */
export function EmptyState({ title, line }: { title: string; line: string }) {
  return (
    <div className="empty">
      <Casimiro mood="happy" size={104} still />
      <h3>{title}</h3>
      <p>{line}</p>
    </div>
  )
}
