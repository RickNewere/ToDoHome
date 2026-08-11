import { useEffect, useState, type ReactNode } from 'react'
import Casimiro, { MASCOT_NAME } from './components/Mascot'
import ChoreCard, { EmptyState } from './components/ChoreCard'
import PersonPicker from './components/PersonPicker'
import { useChores } from './hooks/useChores'
import { MOOD_META } from './lib/chores'
import { credentials, isConfigured } from './lib/supabase'
import { isAndroidApp, requestPinWidget, syncConfigToWidget, syncUserToWidget } from './lib/bridge'
import ChoreEditor from './components/ChoreEditor'
import {
  EMPTY_DRAFT,
  PEOPLE,
  PERSON_LABEL,
  draftFrom,
  type ChoreDraft,
  type ChoreView,
  type Person,
} from './lib/types'

const STORAGE_KEY = 'todohome.person'

type Tab = 'todo' | 'done' | 'all'

function usePerson(): [Person | null, (p: Person) => void] {
  const [person, setPerson] = useState<Person | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'riccardo' || saved === 'roberta' ? saved : null
  })

  // Keep the Android widget in sync with who is using this phone.
  useEffect(() => {
    if (person) syncUserToWidget(person)
  }, [person])

  const pick = (p: Person) => {
    localStorage.setItem(STORAGE_KEY, p)
    setPerson(p)
  }

  return [person, pick]
}

export default function App() {
  const [me, setMe] = usePerson()
  const [tab, setTab] = useState<Tab>('todo')
  const [online, setOnline] = useState(navigator.onLine)
  const [editing, setEditing] = useState<ChoreDraft | null>(null)
  const {
    groups,
    history,
    streak,
    mood,
    loading,
    error,
    busy,
    toggle,
    postpone,
    untickCompleted,
    saveChore,
    deleteChore,
    reload,
    clearError,
  } = useChores(me)

  // The Android widget queries Supabase directly, so it needs the credentials
  // this build was compiled with.
  useEffect(() => {
    if (isConfigured) syncConfigToWidget(credentials.url, credentials.anonKey)
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!isConfigured) return <SetupScreen />
  if (!me) return <PersonPicker onPick={setMe} />

  const meta = MOOD_META[mood]
  const todoCount = groups.late.length + groups.due.length

  const render = (chore: ChoreView, done = false) => (
    <ChoreCard
      key={chore.id}
      chore={chore}
      me={me}
      busy={busy.has(chore.id)}
      onToggle={toggle}
      onPostpone={postpone}
      onUntick={untickCompleted}
      onEdit={(c) => setEditing(draftFrom(c))}
      done={done}
    />
  )

  return (
    <div className="app" style={{ '--mood': meta.color } as React.CSSProperties}>
      <header className="topbar">
        <div className="topbar__brand">
          {/* The app icon itself, drawn small. Same artwork as the home screen
              icon, so the header matches what you tapped to get here. */}
          <Casimiro mood="calm" size={26} still className="topbar__icon" />
          <span>ToDoHome</span>
        </div>
        <div className="topbar__right">
          <div className="switcher" role="group" aria-label="Chi sta usando l’app">
            {PEOPLE.map((p) => (
              <button
                key={p}
                type="button"
                className={`switcher__btn${p === me ? ' switcher__btn--on' : ''}`}
                onClick={() => setMe(p)}
              >
                {PERSON_LABEL[p]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-add"
            onClick={() => setEditing({ ...EMPTY_DRAFT })}
            aria-label="Nuova faccenda"
            title="Nuova faccenda"
          >
            +
          </button>
        </div>
      </header>

      {!online && (
        <div className="banner">Sei offline. I dati potrebbero non essere aggiornati.</div>
      )}

      <section className="mood">
        <Casimiro mood={mood} size={116} />
        <div className="mood__text">
          <h1 className="mood__title">{meta.title}</h1>
          <p className="mood__line">{meta.line}</p>
          {streak && <StreakLine streak={streak.streak} best={streak.best} />}
        </div>
        <div className="mood__stats">
          <Stat n={groups.late.length} label="in ritardo" tone="late" />
          <Stat n={groups.due.length} label="oggi" tone="due" />
          <Stat n={groups.upcoming.length} label="a posto" tone="ok" />
        </div>
      </section>

      <nav className="tabs" role="tablist">
        <TabButton active={tab === 'todo'} onClick={() => setTab('todo')}>
          Da fare {todoCount > 0 && <span className="tabs__badge">{todoCount}</span>}
        </TabButton>
        <TabButton active={tab === 'done'} onClick={() => setTab('done')}>
          Fatte {groups.done.length > 0 && <span className="tabs__count">{groups.done.length}</span>}
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          Tutte
        </TabButton>
      </nav>

      <main className="list">
        {loading && <p className="muted">Carico le faccende…</p>}

        {!loading &&
          tab === 'todo' &&
          (todoCount === 0 ? (
            <EmptyState
              title="Non c’è niente in sospeso"
              line={`${MASCOT_NAME} è contento. Tornate domani.`}
            />
          ) : (
            <>
              <Group title="In ritardo" n={groups.late.length}>
                {groups.late.map((c) => render(c))}
              </Group>
              <Group title="Da fare oggi" n={groups.due.length}>
                {groups.due.map((c) => render(c))}
              </Group>
            </>
          ))}

        {!loading &&
          tab === 'done' &&
          (groups.done.length === 0 && history.length === 0 ? (
            <EmptyState
              title="Ancora niente di fatto"
              line="Qui finiscono le faccende chiuse da entrambi."
            />
          ) : (
            <>
              <Group title="Fatte, in attesa del prossimo giro" n={groups.done.length}>
                {groups.done.map((c) => render(c, true))}
              </Group>

              {groups.done.length > 0 && (
                <p className="hint">
                  Togliendo la tua spunta la faccenda torna subito fra quelle da fare.
                </p>
              )}

              {history.length > 0 && (
                <section className="group">
                  <h2 className="group__title">Storico</h2>
                  <ul className="history">
                    {history.map((h) => (
                      <li key={h.id} className="history__row">
                        <span aria-hidden="true">{h.emoji}</span>
                        <span className="history__name">{h.name}</span>
                        <time dateTime={h.completed_at}>
                          {new Date(h.completed_at).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ))}

        {!loading && tab === 'all' && (
          <>
            <Group title="In ritardo" n={groups.late.length}>
              {groups.late.map((c) => render(c))}
            </Group>
            <Group title="Da fare oggi" n={groups.due.length}>
              {groups.due.map((c) => render(c))}
            </Group>
            <Group title="A posto" n={groups.upcoming.length}>
              {groups.upcoming.map((c) =>
                render(c, Boolean(c.last_completed_at) && !c.open_run_id),
              )}
            </Group>
          </>
        )}
      </main>

      <footer className="foot">
        <div className="foot__buttons">
          <button type="button" className="btn-ghost" onClick={() => void reload()}>
            Aggiorna
          </button>
          {isAndroidApp() && (
            <button type="button" className="btn-ghost" onClick={() => requestPinWidget()}>
              Aggiungi il widget
            </button>
          )}
        </div>
        <p className="muted">Una faccenda è chiusa solo quando la spuntano entrambi.</p>
      </footer>

      {editing && (
        <ChoreEditor
          draft={editing}
          onSave={saveChore}
          onDelete={deleteChore}
          onClose={() => setEditing(null)}
        />
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Chiudi">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

/** Milestones worth a word. Past the last one the flame speaks for itself. */
const MILESTONES = [7, 14, 30, 60, 100, 365]

function StreakLine({ streak, best }: { streak: number; best: number }) {
  if (streak === 0) {
    return best > 0 ? (
      <p className="streak streak--broken">
        Serie interrotta. Il record resta {best} {best === 1 ? 'giorno' : 'giorni'}.
      </p>
    ) : null
  }

  const hit = MILESTONES.includes(streak)
  const record = streak >= best && streak > 1
  return (
    <p className={`streak${hit ? ' streak--milestone' : ''}`}>
      <span aria-hidden="true">🔥</span> {streak} {streak === 1 ? 'giorno' : 'giorni'} senza
      ritardi
      {hit && ' · traguardo!'}
      {!hit && record && ' · è il vostro record'}
      {!hit && !record && best > streak && ` · record ${best}`}
    </p>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`stat stat--${tone}`}>
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`tabs__btn${active ? ' tabs__btn--on' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Group({ title, n, children }: { title: string; n: number; children: ReactNode }) {
  if (n === 0) return null
  return (
    <section className="group">
      <h2 className="group__title">
        {title} <span className="group__count">{n}</span>
      </h2>
      {children}
    </section>
  )
}

function SetupScreen() {
  return (
    <div className="picker">
      <Casimiro mood="annoyed" size={140} still />
      <h1 className="picker__title">Manca la configurazione</h1>
      <p className="picker__line">
        Questa build non ha le credenziali Supabase. Compila <code>web/.env.local</code> con il
        Project URL e la chiave <code>anon public</code> del tuo progetto.
      </p>
      <p className="picker__hint">I passaggi completi sono in docs/SETUP.md.</p>
    </div>
  )
}
