# ToDoHome

A shared household chore tracker for two people. A chore counts as done only
when **both** of them have ticked it off, so nothing gets quietly marked as
finished by one person alone.

It runs as a web app you can install on an iPhone home screen, and as an Android
app that adds a home screen widget with an increasingly angry mascot.

![The five moods of Casimiro](docs/casimiro.png)

## What it does

**Two people, double confirmation.** Every chore has two checkboxes, one for
Riccardo and one for Roberta. Each person can only tick their own box. The chore
is closed, and its next due date starts counting, only once both boxes are
ticked.

**Chores come back on their own.** Each chore has a cadence: every day, every
two days, every three days, weekly, fortnightly or monthly. Once it is closed,
it reappears when the cadence has elapsed. Chores marked as weekend jobs, like
cleaning the bathroom or the kitchen, always land on a Saturday or Sunday.

**A clear picture of what is late.** The list is grouped into late, due today
and on track. Anything overdue shows how many days it has been sitting there.

**Casimiro, the house mascot.** A little house with a face that reflects the
state of the home. He is calm when everything is under control, annoyed when one
chore slips, angry when several are late, and furious, steaming from the chimney
with a vein popping, when the place is falling apart.

**Editing the list.** The chores that ship with the app are only a starting
point. The plus button in the header creates a new one, and the pencil on any
card opens it for editing: name, icon, category, how often it comes back,
whether it is a weekend job, and a note. The same panel deletes it, behind a
second tap for confirmation.

**Android widget.** The mascot sits on the home screen with your own pending
chores underneath. Each row shows how late it is and whether the other person
has already confirmed it. Tapping the circle on the right ticks your box
without opening the app: the row turns green and says "Fatto ✓" for a moment,
then leaves the list, because from your side it is done. When you have ticked
everything the widget says whose turn it is now. Tapping the mascot forces a
refresh.

**Live sync.** A tick on one phone shows up on the other one straight away.

**History.** Every closed chore is logged, so you can see when something was
actually last done.

## Getting started

1. Create a free Supabase project and run the two SQL files in `supabase/`.
2. Put the project URL and anon key in `web/.env.local`.
3. Run `npm install` and `npm run dev` in `web/`.
4. Build the Android app with `./gradlew assembleRelease` in `android/`.

The full step by step, including publishing to GitHub Pages and adding the app
to an iPhone home screen, is in [docs/SETUP.md](docs/SETUP.md).

## Project layout

| Folder      | What is in it                                            |
| ----------- | -------------------------------------------------------- |
| `web/`      | The app itself, a React PWA. This is the UI on both phones |
| `android/`  | Native shell plus the home screen widget                  |
| `supabase/` | Database schema and the starting chore list               |
| `docs/`     | Setup guide                                               |
