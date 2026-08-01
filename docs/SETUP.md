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
- Ogni riga mostra la faccenda, di quanti giorni è in ritardo e se l'altra
  persona ha già confermato (`Ro ✓` o `Ri ✓`).
- Il cerchio a destra è la **tua** spunta: toccalo per confermare senza aprire
  l'app.
- Toccando la casetta forza un aggiornamento, toccando il resto apre l'app.

## 6. Cambiare le faccende

Le faccende stanno nella tabella `chores` su Supabase. Puoi modificarle dal
**Table Editor**:

- `cadence_days`: ogni quanti giorni torna.
- `weekend_only`: se `true`, la scadenza slitta al primo sabato utile.
- `active`: mettila a `false` per togliere una faccenda senza perdere lo storico.
- `sort_order`: l'ordine in cui compaiono.

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
