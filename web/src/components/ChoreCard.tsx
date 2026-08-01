import Casimiro from './Mascot'
import { cadenceLabel, dueLabel, formatDate } from '../lib/chores'
import { PERSON_LABEL, PEOPLE, type ChoreView, type Person } from '../lib/types'

interface Props {
  chore: ChoreView
  me: Person
  busy: boolean
  onToggle: (chore: ChoreView) => void
  onUntick: (chore: ChoreView) => void
  onEdit: (chore: ChoreView) => void
  /** Rendered in the "Fatte" list: both ticks are in, untick yours to undo. */
  done?: boolean
}

/** Second line of a finished card. A chore pinned to a single date has no next
 *  run, so the placeholder date the view parks it on is never shown. */
function doneMeta(chore: ChoreView): string {
  if (chore.scheduled_on && !chore.yearly) return 'Non torna più'
  return `Torna il ${formatDate(chore.due_date)}`
}

export default function ChoreCard({
  chore,
  me,
  busy,
  onToggle,
  onUntick,
  onEdit,
  done = false,
}: Props) {
  return (
    <article className={`card card--${done ? 'done' : chore.state}${busy ? ' card--busy' : ''}`}>
      <div className="card__head">
        <span className="card__emoji" aria-hidden="true">
          {chore.emoji}
        </span>
        <div className="card__text">
          <h3 className="card__name">{chore.name}</h3>
          <p className="card__due">
            {done ? `Fatta il ${formatDate(chore.last_completed_at)}` : dueLabel(chore)}
          </p>
          <p className="card__meta">
            {done ? doneMeta(chore) : cadenceLabel(chore)}
            {!done && chore.note ? ` · ${chore.note}` : ''}
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

      <div className="card__ticks">
        {PEOPLE.map((person) => {
          // A completed chore was ticked by both, by definition.
          const checked = done || chore.checkedBy[person]
          const mine = person === me
          return (
            <button
              key={person}
              type="button"
              className={`tick${checked ? ' tick--on' : ''}${mine ? ' tick--mine' : ''}`}
              onClick={() => {
                if (!mine) return
                if (done) onUntick(chore)
                else onToggle(chore)
              }}
              disabled={!mine || busy}
              aria-pressed={checked}
              title={
                mine
                  ? done
                    ? 'Togli la spunta per rimetterla da fare'
                    : 'Tocca per spuntare'
                  : `Deve spuntare ${PERSON_LABEL[person]}`
              }
            >
              <span className="tick__box" aria-hidden="true">
                {checked ? '✓' : ''}
              </span>
              <span className="tick__name">{PERSON_LABEL[person]}</span>
            </button>
          )
        })}
      </div>
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
