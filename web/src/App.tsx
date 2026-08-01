import { useEffect, useState, type ReactNode } from 'react'
import Casimiro, { MASCOT_NAME } from './components/Mascot'
import ChoreCard, { EmptyState } from './components/ChoreCard'
import PersonPicker from './components/PersonPicker'
import { useChores } from './hooks/useChores'
import { MOOD_META } from './lib/chores'
import { credentials, isConfigured } from './lib/supabase'
import { isAndroidApp, requestPinWidget, syncConfigToWidget, syncUserToWidget } from './lib/bridge'
import { PEOPLE, PERSON_LABEL, type ChoreView, type Person } from './lib/types'

const STORAGE_KEY = 'todohome.person'

type Tab = 'todo' | 'all' | 'history'

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
  const { groups, history, mood, loading, error, busy, toggle, reopen, reload, clearError } =
    useChores(me)

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
      onReopen={reopen}
      done={done}
    />
  )

  return (
    <div className="app" style={{ '--mood': meta.color } as React.CSSProperties}>
      <header className="topbar">
        <div className="topbar__brand">
          <span aria-hidden="true">🏠</span> ToDoHome
        </div>
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
      </header>

      {!online && (
        <div className="banner">Sei offline. I dati potrebbero non essere aggiornati.</div>
      )}

      <section className="mood">
        <Casimiro mood={mood} size={116} />
        <div className="mood__text">
          <h1 className="mood__title">{meta.title}</h1>
          <p className="mood__line">{meta.line}</p>
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
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          Tutte
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          Storico
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

        {!loading &&
          tab === 'history' &&
          (history.length === 0 ? (
            <EmptyState
              title="Storico vuoto"
              line="Qui finiscono le faccende chiuse da entrambi."
            />
          ) : (
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
          ))}
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
