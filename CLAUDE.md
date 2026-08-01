# ToDoHome

Gestione delle faccende domestiche condivise fra Riccardo e Roberta.

## Regola fondamentale del dominio

Una faccenda è completata **solo quando entrambi** l'hanno spuntata. Non esiste
nessun percorso che chiuda un ciclo con una sola spunta. La regola è applicata
lato database, non lato interfaccia: la funzione `toggle_check` valorizza
`completed_at` solo quando `riccardo_at` e `roberta_at` sono entrambi non nulli.
Nell'app ogni persona può toccare esclusivamente la propria casella.

Se questa regola va cambiata, il punto da modificare è `supabase/schema.sql`,
non i client.

## Struttura

| Cartella    | Contenuto                                                       |
| ----------- | --------------------------------------------------------------- |
| `web/`      | React 19 + TypeScript + Vite. È la UI su entrambi i telefoni     |
| `android/`  | Shell WebView in Kotlin + widget home screen con RemoteViews     |
| `supabase/` | `schema.sql` (tabelle, vista, RPC, RLS) e `seed.sql` (faccende)  |
| `docs/`     | Guida di installazione                                          |

## Modello dati

- `chores`: definizione della faccenda. `cadence_days` è ogni quanti giorni
  torna, `weekend_only` la sposta al primo sabato utile.
- `chore_runs`: un giro aperto per faccenda, con le due spunte e
  `completed_at`. Un indice unico parziale su `chore_id where completed_at is
  null` impedisce che due telefoni creino giri doppi.
- `chore_status`: vista che calcola `due_date` e `days_late` in Postgres con
  fuso `Europe/Rome`. Web e widget leggono da qui, così non possono mai
  discordare su cosa è in ritardo.
- RPC `toggle_check(chore_id, user)` e `reopen_last(chore_id)`.

RLS aperta al ruolo `anon`: l'app è pubblica su GitHub Pages e la anon key sta
nel bundle. Non ci sono dati personali oltre ai nomi delle faccende.

## Mascotte

Si chiama Casimiro, è una casa con la faccia. Cinque umori calcolati dalla
stessa soglia in due posti che vanno tenuti allineati:

- `web/src/lib/chores.ts` → `computeMood`
- `android/.../data/ChoreStatus.kt` → `Mood.of`

Soglie: nessun ritardo e niente oggi → `happy`; nessun ritardo ma qualcosa oggi
→ `calm`; 1 ritardo entro 2 giorni → `annoyed`; fino a 3 ritardi entro 4 giorni
→ `angry`; oltre → `furious`.

Il disegno esiste in due forme che devono restare identiche, entrambe
impostate sullo spazio 120x128:

- `web/src/components/Mascot.tsx` (SVG)
- `android/.../widget/MascotDrawing.kt` (Canvas)

Toccando la geometria in uno, va riportata nell'altro.

## Android

Nessuna dipendenza Compose: il widget usa RemoteViews. Le uniche librerie sono
`androidx.core-ktx` e `androidx.activity-ktx`.

L'APK **non contiene credenziali**. La pagina web passa URL e anon key al nativo
via `WebAppBridge.setConfig`, che le salva in SharedPreferences; il widget legge
da lì e interroga PostgREST da solo con `HttpURLConnection`. Quindi il widget
non funziona finché l'app non è stata aperta almeno una volta.

### Comportamento del widget

Il widget è la lista **personale** di chi usa quel telefono, non lo specchio
della casa: mostra solo le faccende che quella persona non ha ancora spuntato.
Toccando il cerchio parte una conferma di 1,5 secondi (badge "Fatto ✓", riga
tenuta in vita da `justTicked`), poi la riga sparisce. La faccenda resta
comunque aperta finché non spunta anche l'altra persona.

L'ordinamento delle righe non dipende da chi ha spuntato: `sortedByDescending`
è stabile e mantiene l'ordine del server a parità di ritardo. Serve a evitare
che una riga si sposti sotto il dito mentre la si tocca.

L'umore di Casimiro invece resta sullo stato della casa, non su quello
personale.

`TODOHOME_URL` in `gradle.properties` decide cosa carica la WebView. Per provare
contro il dev server:

```
./gradlew assembleDebug -PTODOHOME_URL=http://<ip-del-pc>:5173/ToDoHome/
```

Il traffico in chiaro è permesso solo nelle build debug
(`app/src/debug/AndroidManifest.xml`).

## Deploy

- `deploy-web.yml` pubblica `web/dist` su GitHub Pages. Le credenziali arrivano
  dai secret `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `build-android.yml` produce l'APK release come artifact.

`base` di Vite è `/ToDoHome/`: se il repository cambia nome va aggiornato in
`web/vite.config.ts` o passato con `VITE_BASE`.

## Ambiente di sviluppo

Android SDK in `%LOCALAPPDATA%\Android\Sdk`, JDK 17 Microsoft. `local.properties`
non è versionato.
