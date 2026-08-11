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

### SQL sul database remoto

Non serve nessun access token: bastano la CLI in `.tools/supabase.exe` e la
password in `.supabase-db-password`, entrambe già sul PC.

```
.tools/supabase.exe db query "<sql>" --db-url \
  "postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  --dns-resolver https
```

Il `<ref>` è il sottodominio dentro `VITE_SUPABASE_URL`. Il pooler risponde su
IPv4, l'host diretto `db.<ref>.supabase.co` no, quindi usare il pooler.

Due trappole:

- La CLI **esce con codice 0 anche quando Postgres rifiuta la query**. L'errore
  sta solo nel JSON di risposta, come `"_tag":"Error"`. Va letto il corpo, non
  il codice di uscita.
- `--file` manda tutto il contenuto come una prepared statement sola, quindi
  `schema.sql` intero fallisce con `cannot insert multiple commands into a
  prepared statement`. Va passata una istruzione per volta.

Ogni script che tocca quella password deve filtrare il proprio output prima di
stamparlo.

### Test

Non esiste nessuna suite di test automatici. Le verifiche si fanno contro il
progetto Supabase vero e sul telefono via adb. Le prove che scrivono dati vanno
fatte su una faccenda usa e getta, creata e cancellata dallo script, mai sulle
faccende di casa. Per costringere il widget a ridisegnarsi senza aspettare la
mezz'ora:

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
- Faccende a data fissa: `scheduled_on` è il giorno scelto, `yearly` dice se
  torna ogni anno o se capita una volta sola. Quando `scheduled_on` è
  valorizzata, `cadence_days` e `weekend_only` non contano: una data scelta non
  si sposta. Una annuale mai fatta punta alla prossima ricorrenza da oggi in
  poi (`next_yearly`), così aggiungerla dopo che il giorno è passato non la fa
  nascere in ritardo. Una una-tantum già fatta viene parcheggiata su
  `9999-12-31`: resta fra le "Fatte", dove si può ancora annullare, e la scheda
  scrive "Non torna più" invece di quella data finta.
- Su una faccenda a data fissa, un giro aperto tira la scadenza a oggi. Serve
  all'annullamento dalla scheda "Fatte": tolta la spunta la faccenda non risulta
  più completata, e senza questa regola una annuale finiva dritta all'anno
  prossimo invece di tornare fra quelle da fare.
- Rinvio: `postponed_to` sposta la scadenza, `postpone_count` conta quante
  volte, massimo due per ciclo. Il rinvio spinge solo in avanti, mai indietro,
  quindi un valore rimasto da un ciclo vecchio smette da solo di contare.
  `toggle_check` azzera entrambe le colonne quando la faccenda si chiude. La
  RPC `postpone` conta da oggi, non da una scadenza già passata: rimandare una
  cosa in ritardo di una settimana compra un giorno, non cancella l'arretrato.
- `house_state`: una riga sola, garantita dalla chiave primaria booleana. Tiene
  `clear_since` e `best_streak` per i giorni di fila senza ritardi. Va scritta
  mentre succede: da `chore_runs` non è ricostruibile quali giorni avessero
  qualcosa in ritardo. La RPC `touch_streak` la aggiorna e restituisce il conto,
  e la chiama la webapp a ogni caricamento e dopo ogni azione.

La vista costruisce `due_date` in tre passaggi incatenati, `raw` poi `shifted`
poi `due`: la data chiesta dalla regola della faccenda, poi lo spostamento al
weekend dove vale, poi l'eventuale rinvio.

Il rinvio si fa scorrendo la scheda verso destra, non con un pulsante. Il gesto
sta in `web/src/hooks/useSwipeRight.ts`, con `decideAxis` e `travel` esportate
apposta perché siano collaudabili senza un dito vero. Due regole non ovvie: in
diagonale vince sempre lo scorrimento verticale (una lista che smette di
scorrere dà più fastidio di un rinvio da ripetere), e `swallowedClick` controlla
anche `enabled`, perché un rinvio può essere proprio quello che consuma
l'ultimo tentativo e da lì in poi non arriva più nessun `pointerdown` ad
abbassare il flag.

`reload` ricarica lista, storico e serie insieme. Prima ricaricava solo la
lista: il pulsante "Aggiorna" sembrava rotto perché non cambiava niente a
schermo e le altre schede restavano vecchie.
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

Il widget conserva l'ultima lista letta in `SharedPreferences`, non solo in
memoria. Il processo di un widget viene ucciso fra un aggiornamento e l'altro,
quindi la cache in RAM è quasi sempre vuota al risveglio e bastava un intoppo di
rete per sostituire tutto con "Non riesco a leggere". Ora una lettura fallita
ridisegna la lista salvata e scrive "Aggiornato alle HH:MM" nel sottotitolo. La
schermata di errore resta solo per un telefono che non è mai riuscito a leggere.

I timeout di rete sono due: `TIMEOUT_MS` (10s) per le letture normali e
`QUICK_TIMEOUT_MS` (3,5s) per il solo ridisegno dopo una spunta, che deve stare
dentro i dieci secondi scarsi concessi a un broadcast. Abbassarli entrambi fa
comparire l'errore su rete mobile.

### Notifiche

Due notifiche distinte, due canali distinti.

**Faccende in ritardo**: un promemoria al giorno alle 9:00 con quelle in ritardo
**che quella persona non ha ancora spuntato**, stessa logica personale del
widget. Sta in `notify/LateReminder.kt`.

**Tocca a te confermare**: quando l'altra persona spunta qualcosa che tu non hai
confermato. Sta in `notify/PartnerNudge.kt` e non costa una chiamata in più: usa
la copia salvata dal widget come termine di paragone, quindi il confronto è fra
la lista di prima e quella appena letta. Silenziosa alla primissima lettura,
quando non c'è niente con cui confrontare.

Le sveglia entrambe `notify/ReminderReceiver.kt`, su due allarmi: quello
giornaliero e una rilettura ogni mezz'ora (`ELAPSED_REALTIME`, non serve
svegliare il telefono per una conferma). La rilettura passa da
`WidgetRenderer.update`, che apposta **non** si ferma quando non ci sono widget
appesi: la lettura serve comunque, altrimenti su un telefono senza widget la
notifica di conferma non arriverebbe mai.

L'allarme è `setInexactRepeating`: quello esatto richiede un permesso a parte su
Android recenti ed è sproporzionato per un promemoria che deve solo arrivare in
mattinata. Va riarmato dopo il riavvio e dopo un aggiornamento dell'app, da cui
`BOOT_COMPLETED` e `MY_PACKAGE_REPLACED` nel manifest. `notifiedOn` in `Prefs`
impedisce due notifiche nello stesso giorno.

Il receiver non è esportato in release. Per provarlo serve una build debug, dove
il manifest lo esporta apposta:

```
gradlew.bat assembleDebug
adb shell am broadcast -n it.ricknewere.todohome/.notify.ReminderReceiver \
  -a it.ricknewere.todohome.ACTION_CHECK
```

Senza faccende in ritardo non parte niente: per provarla creare una faccenda
usa e getta con `scheduled_on` nel passato e `yearly = false`.

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
