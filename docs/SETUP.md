# Installazione passo passo

## Via rapida: lo script fa tutto

Se hai un account Supabase, `scripts/setup-supabase.ps1` crea il progetto,
carica schema e faccende, recupera la chiave anon, scrive `web/.env.local` e
imposta i secret su GitHub. Ti serve solo un token:

1. Vai su <https://supabase.com/dashboard/account/tokens> e genera un token.
2. Salvalo nel file `.supabase-token` nella cartella del progetto.
3. Lancia `powershell -File scripts\setup-supabase.ps1`.

Il token, la chiave anon e la password del database non vengono mai stampati a
schermo e non finiscono mai in un commit.

Se preferisci fare a mano, sotto ci sono tutti i passaggi.

## 1. Creare il database su Supabase

Serve un account gratuito su [supabase.com](https://supabase.com). Il piano free
basta e avanza per due persone.

1. **New project**. Dai un nome (per esempio `todohome`), scegli una password
   per il database e come regione **Central EU (Frankfurt)**, la più vicina.
2. Aspetta un paio di minuti che il progetto finisca di crearsi.
3. Vai su **SQL Editor** > **New query**, incolla tutto il contenuto di
   [`supabase/schema.sql`](../supabase/schema.sql) e premi **Run**.
4. Nuova query, incolla [`supabase/seed.sql`](../supabase/seed.sql) e **Run**.
   Questo carica le 23 faccende di partenza.
5. Vai su **Project Settings** > **Data API** e copia il **Project URL**.
   Poi **API Keys** e copia la chiave **anon public**.

> La chiave anon è una chiave pubblica: è pensata per stare dentro il codice
> della pagina. Il controllo accessi sta nelle policy RLS che hai appena creato.
> La password del database invece non serve mai all'app: tienila da parte.

## 2. Far girare la webapp sul PC

```
cd web
copy .env.example .env.local
```

Apri `.env.local` e incolla i due valori del punto 1.5. Poi:

```
npm install
npm run dev
```

Apri `http://localhost:5173/ToDoHome/`. Al primo avvio ti chiede chi sei.

## 3. Pubblicare su GitHub Pages

1. Crea il repository `ToDoHome` su GitHub e fai il push del progetto.
2. Nel repository, **Settings** > **Secrets and variables** > **Actions** >
   **New repository secret**, aggiungine due:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings** > **Pages** > **Source**: scegli **GitHub Actions**.
4. Fai un push su `main`. Il workflow `Deploy webapp` compila e pubblica.

L'indirizzo finale sarà `https://ricknewere.github.io/ToDoHome/`.

## 4. Installare su iPhone

1. Apri l'indirizzo con **Safari** (non Chrome: solo Safari sa installare le
   web app su iOS).
2. Tocca il pulsante **Condividi**, poi **Aggiungi a Home**.
3. Da quel momento si apre a schermo intero come una normale app.

## 5. Installare su Android

Serve l'Android SDK e un JDK 17.

```
cd android
gradlew assembleRelease
```

L'APK esce in `app/build/outputs/apk/release/`. Copialo sul telefono e
installalo, oppure con il telefono collegato via USB e il debug USB attivo:

```
adb install -r app\build\outputs\apk\release\app-release.apk
```

In alternativa, senza compilare niente in locale: apri la scheda **Actions** su
GitHub, il workflow **Build APK**, e scarica l'artifact `todohome-apk`.

### Aggiungere il widget

1. **Apri prima l'app almeno una volta** e scegli chi sei. Il widget prende da
   lì le credenziali del database e sa di chi è la spunta rapida.
2. Tieni premuto su uno spazio vuoto della schermata Home > **Widget**.
3. Cerca **ToDoHome** e trascina il widget dove vuoi.
4. Il widget si ridimensiona: più lo allarghi in altezza, più faccende mostra.

Cosa fa il widget:

- La casetta cambia faccia a seconda della situazione: serena se non c'è niente
  da fare, neutra se c'è roba in giornata ma sei in tempo, poi via via più
  arrabbiata man mano che le cose restano indietro.
- Le righe sono la **tua** lista: compaiono solo le faccende che tu non hai
  ancora spuntato.
- Ogni riga mostra di quanti giorni è in ritardo e se l'altra persona ha già
  confermato (`Ro ✓` o `Ri ✓`).
- Il cerchio a destra è la tua spunta. Toccandolo la riga diventa verde e
  scrive "Fatto ✓" per un secondo e mezzo, poi sparisce. La faccenda resta
  comunque aperta finché non spunta anche l'altra persona.
- Quando hai spuntato tutto, il widget ti dice che tocca all'altro.
- Toccando la casetta forza un aggiornamento, toccando il resto apre l'app.
- Se la rete non risponde il widget continua a mostrare l'ultima lista letta e
  scrive a che ora l'ha letta, invece di svuotarsi.

### Notifiche

Al primo avvio l'app chiede il permesso di mandare notifiche. Ne manda di due
tipi, che si possono accendere e spegnere separatamente:

- **Faccende in ritardo**: ogni mattina alle 9, se qualcosa che **tu** non hai
  ancora spuntato è in ritardo. Se hai già fatto la tua parte non ti disturba, e
  non ne arriva più di una al giorno.
- **Da confermare**: quando l'altra persona spunta qualcosa che aspetta la tua
  conferma. Serve perché una faccenda si chiude solo con tutte e due le spunte,
  e senza avviso la seconda dipende dal caso.

Per spegnerle basta il pannello di Android: **Impostazioni** > **App** >
**ToDoHome** > **Notifiche**.

## 6. Cambiare le faccende

Si fa direttamente dall'app, senza passare da Supabase:

- Il **+** in alto a destra crea una faccenda nuova.
- La **matita** su una scheda la apre in modifica: nome, icona, quando va fatta,
  se è un lavoro da weekend e la nota.
- Sotto **Quando** ci sono due modi. **Si ripete** è la cadenza di sempre, ogni
  tot giorni. **In una data** la lega a un giorno preciso del calendario, per le
  cose che dipendono dalla data e non da un ritmo: il cambio di stagione, la
  revisione della caldaia, una scadenza. Con **Torna ogni anno** ricompare lo
  stesso giorno l'anno dopo, altrimenti si fa una volta e sparisce. Una data
  scelta non viene mai spostata al weekend.
- Nello stesso pannello c'è **Elimina**, che chiede una seconda conferma.
  Eliminare una faccenda cancella anche il suo storico.

## 7. Rimandare una faccenda

Sulle faccende in ritardo o in scadenza oggi compare **+1g** accanto alla
matita: sposta la scadenza di un giorno senza segnarla fatta e senza mettere
nessuna spunta.

Si può fare **due volte per ciclo**, poi il pulsante sparisce e la faccenda va
fatta. Il conteggio riparte da zero quando la spuntate entrambi. Sotto il nome
compare "rimandata 1×" così si vede quante volte è già slittata.

Il pulsante non c'è se uno dei due ha già spuntato: spostare la scadenza a quel
punto sprecherebbe la conferma dell'altro.

## 8. La serie senza ritardi

In alto, sotto la frase di Casimiro, c'è da quanti giorni di fila la casa non ha
niente in ritardo, con il record. Basta una faccenda in ritardo per azzerarla.

## 9. Le tre schede

- **Da fare**: quello che è in ritardo o scade oggi.
- **Fatte**: le faccende chiuse da entrambi, con la data in cui sono state
  fatte e quando torneranno. Togliendo la tua spunta la faccenda rientra
  subito fra quelle da fare, conservando la spunta dell'altro. Sotto c'è lo
  storico dei completamenti.
- **Tutte**: l'elenco completo raggruppato per stato.

Se preferisci lavorare sui dati grezzi, la tabella è `chores` nel **Table
Editor** di Supabase. Lì c'è anche `active`: mettila a `false` per togliere una
faccenda dalle liste conservando lo storico, cosa che dall'app non si può fare.

## Problemi comuni

**La webapp mostra "Manca la configurazione".** Il file `.env.local` non c'è o è
vuoto. Su GitHub Pages significa che mancano i due secret.

**Il widget dice "Apri l'app per collegare il database".** L'app non è mai stata
aperta su quel telefono, quindi il widget non ha ancora le credenziali.

**Il widget dice "Apri l'app e scegli chi sei".** Manca la scelta fra Riccardo e
Roberta.

**Il widget non si aggiorna da solo.** Si aggiorna ogni mezz'ora, quando apri e
chiudi l'app, e quando tocchi la casetta. Su Samsung controlla che l'app non sia
in sospensione: **Impostazioni** > **Batteria** > **Limiti uso in background**.

**Il progetto Supabase si è messo in pausa.** Il piano free sospende i progetti
dopo una settimana senza chiamate. Basta riattivarlo dalla dashboard.
