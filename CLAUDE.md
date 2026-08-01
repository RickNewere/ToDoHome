# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Comandi

Web, dalla cartella `web/`:

```
npm install
npm run dev      # http://localhost:5173/ToDoHome/
npm run build    # tsc -b poi vite build: è esattamente ciò che gira in CI
npm run lint     # oxlint
```

`npm run build` va lanciato prima di ogni push. Il dev server non fa il
type check completo, quindi un errore di tipi si manifesta solo in build ed è
già successo di scoprirlo dalla CI invece che in locale.

Android, dalla cartella `android/`:

```
gradlew.bat assembleRelease
gradlew.bat assembleDebug -PTODOHOME_URL=http://<ip-del-pc>:5173/ToDoHome/
adb install -r app\build\outputs\apk\release\app-release.apk
```

La release è firmata con la chiave di debug apposta: l'app si installa a mano su
due telefoni e non passa dal Play Store.

Non esiste nessuna suite di test automatici. Le verifiche si fanno contro il
progetto Supabase vero via PostgREST e sul telefono via adb. Per costringere il
widget a ridisegnarsi senza aspettare la mezz'ora:

```
adb shell am broadcast -n it.ricknewere.todohome/.widget.ChoreWidgetProvider -a it.ricknewere.todohome.ACTION_REFRESH
```

## Modifiche

Quando si tocca il codice o si aggiunge qualcosa, elencare a Riccardo le
modifiche fatte: quali file, cosa è cambiato e perché. Non basta dire che è
fatto.

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

Ciclicità verificata: una faccenda con cadenza 3 completata oggi scade fra 3
giorni, al terzo giorno risulta `days_late = 0` e torna fra quelle da fare, al
quarto è in ritardo di 1. Con `weekend_only`, se la scadenza calcolata cade
infrasettimanale slitta al primo sabato utile; se cade già di sabato o domenica
resta lì.

L'annullamento dalla scheda "Fatte" non passa da `reopen_last`: il client cerca
l'ultimo giro chiuso e lo riapre azzerando la spunta di chi ha annullato, così
la faccenda torna da fare conservando la conferma dell'altro. Sta in
`untickCompleted` dentro `useChores`.

La colonna `category` esiste ancora in `chores` e in `ChoreDraft`, con default
`Casa`: è stato tolto solo il campo dal form. Chi la rimuove davvero deve
toccare schema, seed, tipi e `saveChore` insieme.

RLS aperta al ruolo `anon`: l'app è pubblica su GitHub Pages e la anon key sta
nel bundle. Non ci sono dati personali oltre ai nomi delle faccende.

## Credenziali

La webapp legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` da
`web/.env.local` in locale e dai secret omonimi in CI. Sono gli unici due valori
di configurazione dell'intero progetto.

`web/src/lib/supabase.ts` toglie il BOM e verifica che l'URL sia parsabile prima
di dichiarare la app configurata. Non è difensivismo inutile: un BOM finito
dentro il secret di GitHub ha già prodotto una pagina bianca in produzione,
perché `new URL()` sollevava e `isConfigured` restava falso senza dirlo. Quel
controllo va lasciato dov'è.

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

In Kotlin `Face(...)` si costruisce per posizione, quindi i quattro booleani in
fondo (`openMouth`, `steam`, `vein`, `sparkles`) sono facilissimi da invertire
senza che il compilatore dica niente: `angry` è rimasto a lungo con la bocca
aperta di `furious` e senza fumo. Confrontare i due file campo per campo, non a
occhio.

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

Il numero di righe lo calcola `rowsFor` dall'altezza del widget. Il launcher
comunica i limiti per entrambi gli orientamenti insieme, perché la rotazione non
genera un aggiornamento: `OPTION_APPWIDGET_MIN_HEIGHT` è l'altezza da
orizzontale, `OPTION_APPWIDGET_MAX_HEIGHT` quella da verticale. Leggendo il
minimo in verticale il widget mostrava una riga sola lasciando il resto vuoto.

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
