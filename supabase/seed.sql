-- ToDoHome - starting chore list
-- Run this after schema.sql. Re-running it will not create duplicates.

insert into public.chores (name, emoji, category, cadence_days, weekend_only, note, sort_order)
values
  -- Rifiuti
  ('Buttare l''immondizia',            '🗑️', 'Rifiuti',  2,  false, 'Indifferenziata e umido',                   10),
  ('Portare fuori vetro e plastica',   '♻️', 'Rifiuti',  7,  false, null,                                        20),
  ('Portare fuori carta e cartone',    '📦', 'Rifiuti',  7,  false, 'Schiacciare gli scatoloni',                 30),

  -- Pulizie
  ('Lavare il pavimento',              '🧽', 'Pulizie',  3,  false, null,                                        40),
  ('Passare Pino',                     '🤖', 'Pulizie',  3,  false, 'Svuotare il contenitore quando finisce',    50),
  ('Passare lo Swiffer',               '🧹', 'Pulizie',  3,  false, null,                                        60),
  ('Spolverare i mobili',              '🪶', 'Pulizie',  7,  true,  null,                                        70),
  ('Lavare il bagno',                  '🛁', 'Pulizie',  7,  true,  'Doccia, box e piastrelle',                  80),
  ('Lavare i sanitari',                '🚽', 'Pulizie',  7,  true,  'Water, bidet e lavandino',                  90),
  ('Lavare la cucina',                 '🍳', 'Pulizie',  7,  true,  'Ante, top e fuori elettrodomestici',       100),
  ('Pulire specchi e vetri',           '🪞', 'Pulizie', 30,  true,  null,                                       110),

  -- Cucina
  ('Svuotare la lavastoviglie',        '🍽️', 'Cucina',   1,  false, null,                                       120),
  ('Pulire piano cottura e lavello',   '✨', 'Cucina',   2,  false, null,                                       130),
  ('Pulire il frigo e le scadenze',    '🧊', 'Cucina',  30,  true,  'Buttare quello che e'' scaduto',           140),

  -- Bucato
  ('Fare la lavatrice',                '🌀', 'Bucato',   3,  false, null,                                       150),
  ('Stendere e piegare il bucato',     '👕', 'Bucato',   3,  false, null,                                       160),
  ('Cambiare gli asciugamani',         '🧴', 'Bucato',   7,  true,  'Bagno e cucina',                           170),
  ('Cambiare le lenzuola',             '🛏️', 'Bucato',  14,  true,  null,                                       180),

  -- Gestione casa
  ('Segnare le spese',                 '💶', 'Gestione', 7,  false, 'Aggiornare il conto condiviso',             190),
  ('Fare la spesa settimanale',        '🛒', 'Gestione', 7,  false, null,                                       200),
  ('Innaffiare le piante',             '🪴', 'Gestione', 3,  false, null,                                       210),
  ('Controllare bollette e scadenze',  '📄', 'Gestione', 30, false, null,                                       220),
  ('Manutenzione aspirapolvere',       '🔧', 'Gestione', 30, true,  'Filtri, spazzole e sacchetto',             230)
on conflict (name) do nothing;
