import Casimiro, { MASCOT_NAME } from './Mascot'
import { PEOPLE, PERSON_LABEL, type Person } from '../lib/types'

/** First launch screen: the app needs to know whose ticks it is toggling. */
export default function PersonPicker({ onPick }: { onPick: (p: Person) => void }) {
  return (
    <div className="picker">
      <Casimiro mood="calm" size={150} still />
      <h1 className="picker__title">ToDoHome</h1>
      <p className="picker__line">
        Ciao, sono {MASCOT_NAME}. Tengo il conto delle faccende di casa.
        <br />
        Chi sei?
      </p>
      <div className="picker__buttons">
        {PEOPLE.map((p) => (
          <button key={p} type="button" className="picker__btn" onClick={() => onPick(p)}>
            {PERSON_LABEL[p]}
          </button>
        ))}
      </div>
      <p className="picker__hint">Puoi cambiarlo quando vuoi dall’intestazione.</p>
    </div>
  )
}
