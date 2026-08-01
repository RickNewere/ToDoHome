import type { Person } from './types'

/** Methods exposed by the Android wrapper through addJavascriptInterface.
 *  Absent when the app runs in a normal browser (iPhone, desktop). */
interface AndroidBridge {
  setUser(user: string): void
  setConfig(url: string, anonKey: string): void
  refreshWidget(): void
}

declare global {
  interface Window {
    ToDoHomeAndroid?: AndroidBridge
  }
}

export const isAndroidApp = (): boolean =>
  typeof window !== 'undefined' && typeof window.ToDoHomeAndroid !== 'undefined'

/** Tells the widget which of the two people is using this phone, so its quick
 *  tick button knows whose check to toggle. */
export function syncUserToWidget(person: Person): void {
  try {
    window.ToDoHomeAndroid?.setUser(person)
  } catch {
    /* not running inside the Android wrapper */
  }
}

/** Hands the Supabase credentials to the native side so the widget can read the
 *  chore list on its own. Keeping them here means the APK ships no secrets and
 *  there is a single place to configure the backend. */
export function syncConfigToWidget(url: string, anonKey: string): void {
  try {
    window.ToDoHomeAndroid?.setConfig(url, anonKey)
  } catch {
    /* not running inside the Android wrapper */
  }
}

export function refreshWidget(): void {
  try {
    window.ToDoHomeAndroid?.refreshWidget()
  } catch {
    /* not running inside the Android wrapper */
  }
}
