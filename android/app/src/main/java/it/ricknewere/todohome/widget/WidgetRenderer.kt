package it.ricknewere.todohome.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import it.ricknewere.todohome.MainActivity
import it.ricknewere.todohome.R
import it.ricknewere.todohome.data.ChoreStatus
import it.ricknewere.todohome.data.Mood
import it.ricknewere.todohome.data.Prefs
import it.ricknewere.todohome.data.SupabaseApi

/**
 * Builds the widget content. Every method blocks on network and must run on a
 * background thread.
 */
object WidgetRenderer {

    private const val CACHE_MS = 45_000L
    private const val MASCOT_DP = 46

    /** Header height plus padding, in dp: what is left over goes to the rows. */
    private const val CHROME_DP = 68
    private const val ROW_DP = 34

    /** How long the "Fatto ✓" confirmation stays on screen before the row goes. */
    private const val CONFIRM_MS = 1500L

    @Volatile private var cache: List<ChoreStatus>? = null
    @Volatile private var cachedAt = 0L

    /** Chore currently showing the confirmation badge, if any. */
    @Volatile private var justTicked: String? = null

    fun update(context: Context, ids: IntArray, forceFetch: Boolean) {
        if (ids.isEmpty()) return

        val manager = AppWidgetManager.getInstance(context)
        val url = Prefs.supabaseUrl(context)
        val key = Prefs.supabaseKey(context)

        if (url == null || key == null) {
            ids.forEach { manager.updateAppWidget(it, notConfiguredView(context)) }
            return
        }

        val chores = loadChores(context, url, key, forceFetch)
        if (chores == null) {
            ids.forEach { manager.updateAppWidget(it, offlineView(context)) }
            return
        }

        paint(context, manager, ids, chores)
    }

    private fun paint(
        context: Context,
        manager: AppWidgetManager,
        ids: IntArray,
        chores: List<ChoreStatus>,
    ) {
        ids.forEach { id ->
            manager.updateAppWidget(id, buildView(context, chores, rowsFor(context, manager, id)))
        }
    }

    /**
     * Toggles this phone's owner tick.
     *
     * When adding a tick the row is repainted straight away with a "Fatto ✓"
     * badge and held there for a moment, so the press is acknowledged before
     * the chore leaves the list. Removing a tick skips the confirmation.
     */
    fun toggle(context: Context, choreId: String) {
        val url = Prefs.supabaseUrl(context) ?: return
        val key = Prefs.supabaseKey(context) ?: return
        val user = Prefs.user(context) ?: return

        val manager = AppWidgetManager.getInstance(context)
        val ids = ChoreWidgetProvider.allWidgetIds(context)
        val known = cache
        val adding = known?.firstOrNull { it.id == choreId }?.checkedBy(user) == false

        if (adding && known != null) {
            justTicked = choreId
            paint(
                context,
                manager,
                ids,
                known.map { if (it.id == choreId) it.withTickFrom(user) else it },
            )
        }

        SupabaseApi.toggle(url, key, choreId, user)
        cache = null

        if (adding) Thread.sleep(CONFIRM_MS)
        justTicked = null
        update(context, ids, forceFetch = true)
    }

    private fun loadChores(
        context: Context,
        url: String,
        key: String,
        forceFetch: Boolean,
    ): List<ChoreStatus>? {
        val cached = cache
        val fresh = System.currentTimeMillis() - cachedAt < CACHE_MS
        if (!forceFetch && cached != null && fresh) return cached

        val fetched = SupabaseApi.fetchStatus(url, key)
        if (fetched != null) {
            cache = fetched
            cachedAt = System.currentTimeMillis()
            Prefs.markSynced(context)
            return fetched
        }
        // Network failed: better to keep showing the last known state than nothing.
        return cached
    }

    /**
     * Rows that fit in the current widget height.
     *
     * The launcher reports the bounds for both orientations at once, because a
     * rotation does not trigger a widget update: the lower bound is the height
     * in landscape, the upper bound the height in portrait. Reading the lower
     * bound in portrait understates the space by more than half and leaves the
     * widget nearly empty.
     */
    private fun rowsFor(context: Context, manager: AppWidgetManager, id: Int): Int {
        val options = manager.getAppWidgetOptions(id)
        val landscape =
            context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val key = if (landscape) {
            AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT
        } else {
            AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT
        }
        val heightDp = options.getInt(key, 0).takeIf { it > 0 }
            ?: options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        return ((heightDp - CHROME_DP) / ROW_DP).coerceIn(1, 6)
    }

    private fun buildView(context: Context, chores: List<ChoreStatus>, maxRows: Int): RemoteViews {
        val me = Prefs.user(context)
        val mood = Mood.of(chores)
        val late = chores.count { it.isLate }
        val dueToday = chores.count { it.isDueToday }

        val rv = RemoteViews(context.packageName, R.layout.widget_chore)
        rv.setImageViewBitmap(R.id.mascot, MascotDrawing.render(mood, dp(context, MASCOT_DP)))
        rv.setTextViewText(R.id.title, mood.title)
        rv.setTextViewText(R.id.subtitle, summary(late, dueToday, me))

        rv.setOnClickPendingIntent(R.id.header, openApp(context))
        rv.setOnClickPendingIntent(R.id.mascot, refreshIntent(context))

        rv.removeAllViews(R.id.rows)

        // The widget is this person's own list: once you tick a chore it leaves,
        // even though it stays open until the other one ticks it too. The row
        // just ticked is held for a moment so the confirmation is visible.
        //
        // Most overdue first; the server order breaks ties because sortedBy is
        // stable, so a row never jumps out from under the finger pressing it.
        val mine = chores.filter { it.isPending && !it.checkedBy(me) }
        val visible = chores
            .filter { it.isPending && (!it.checkedBy(me) || it.id == justTicked) }
            .sortedByDescending { it.daysLate }
            .take(maxRows)

        if (visible.isEmpty()) {
            rv.setViewVisibility(R.id.empty, View.VISIBLE)
            rv.setTextViewText(R.id.empty, emptyMessage(chores, me))
        } else {
            rv.setViewVisibility(R.id.empty, View.GONE)
            visible.forEach { rv.addView(R.id.rows, rowView(context, it, me)) }
        }

        // Nothing left for you, but the house is not done: say whose turn it is.
        if (mine.isEmpty() && chores.any { it.isPending }) {
            rv.setTextViewText(R.id.subtitle, "Hai fatto la tua parte")
        }

        return rv
    }

    private fun emptyMessage(chores: List<ChoreStatus>, me: String?): String {
        val waitingOnPartner = chores.any {
            it.isPending && it.checkedBy(me) && !it.checkedByPartnerOf(me)
        }
        val partner = if (me == "riccardo") "Roberta" else "Riccardo"
        return when {
            waitingOnPartner -> "Tutto spuntato da te. Ora tocca a $partner."
            else -> "Niente in sospeso. Casimiro è contento."
        }
    }

    private fun rowView(context: Context, chore: ChoreStatus, me: String?): RemoteViews {
        val row = RemoteViews(context.packageName, R.layout.widget_row)
        val mineDone = chore.checkedBy(me)
        val partnerDone = chore.checkedByPartnerOf(me)

        row.setTextViewText(R.id.row_emoji, chore.emoji)
        row.setTextViewText(R.id.row_name, chore.name)

        // Freshly ticked rows confirm the press instead of showing the deadline.
        if (chore.id == justTicked) {
            row.setTextViewText(R.id.row_days, "Fatto ✓")
            row.setTextColor(R.id.row_days, context.getColor(R.color.widget_ok))
        } else {
            row.setTextViewText(R.id.row_days, chore.badge())
            row.setTextColor(
                R.id.row_days,
                context.getColor(if (chore.isLate) R.color.widget_late else R.color.widget_due),
            )
        }

        // Shows whether the other person has already confirmed this chore.
        val partnerLabel = if (me == "riccardo") "Ro" else "Ri"
        row.setTextViewText(R.id.row_partner, if (partnerDone) "$partnerLabel ✓" else partnerLabel)
        row.setTextColor(
            R.id.row_partner,
            context.getColor(if (partnerDone) R.color.widget_ok else R.color.widget_dim),
        )

        row.setTextViewText(R.id.row_tick, if (mineDone) "✓" else "")
        row.setInt(
            R.id.row_tick,
            "setBackgroundResource",
            if (mineDone) R.drawable.tick_on else R.drawable.tick_off,
        )
        row.setTextColor(R.id.row_tick, Color.WHITE)

        // Without a known owner a tick would be meaningless, so send them to the app.
        row.setOnClickPendingIntent(
            R.id.row_tick,
            if (me == null) openApp(context) else toggleIntent(context, chore.id),
        )
        row.setOnClickPendingIntent(R.id.row_body, openApp(context))

        return row
    }

    private fun summary(late: Int, dueToday: Int, me: String?): String {
        if (me == null) return "Apri l’app e scegli chi sei"
        val parts = buildList {
            if (late > 0) add("$late in ritardo")
            if (dueToday > 0) add("$dueToday oggi")
        }
        return if (parts.isEmpty()) "Tutto fatto" else parts.joinToString(" · ")
    }

    private fun notConfiguredView(context: Context): RemoteViews {
        val rv = RemoteViews(context.packageName, R.layout.widget_chore)
        rv.setImageViewBitmap(R.id.mascot, MascotDrawing.render(Mood.CALM, dp(context, MASCOT_DP)))
        rv.setTextViewText(R.id.title, "ToDoHome")
        rv.setTextViewText(R.id.subtitle, "Apri l’app per collegare il database")
        rv.removeAllViews(R.id.rows)
        rv.setViewVisibility(R.id.empty, View.GONE)
        rv.setOnClickPendingIntent(R.id.header, openApp(context))
        return rv
    }

    private fun offlineView(context: Context): RemoteViews {
        val rv = RemoteViews(context.packageName, R.layout.widget_chore)
        rv.setImageViewBitmap(
            R.id.mascot,
            MascotDrawing.render(Mood.ANNOYED, dp(context, MASCOT_DP)),
        )
        rv.setTextViewText(R.id.title, "Non riesco a leggere")
        rv.setTextViewText(R.id.subtitle, "Tocca la casetta per riprovare")
        rv.removeAllViews(R.id.rows)
        rv.setViewVisibility(R.id.empty, View.GONE)
        rv.setOnClickPendingIntent(R.id.mascot, refreshIntent(context))
        rv.setOnClickPendingIntent(R.id.header, openApp(context))
        return rv
    }

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun refreshIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        1,
        Intent(context, ChoreWidgetProvider::class.java)
            .setAction(ChoreWidgetProvider.ACTION_REFRESH),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun toggleIntent(context: Context, choreId: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            // Distinct request code per chore, otherwise the extras of one
            // PendingIntent would overwrite the others.
            choreId.hashCode(),
            Intent(context, ChoreWidgetProvider::class.java)
                .setAction(ChoreWidgetProvider.ACTION_TOGGLE)
                .putExtra(ChoreWidgetProvider.EXTRA_CHORE_ID, choreId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
