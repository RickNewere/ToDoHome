package it.ricknewere.todohome.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import java.util.concurrent.Executors

/**
 * Home screen widget. Network work runs on a background executor kept alive by
 * goAsync(), which is what lets a broadcast receiver do I/O.
 */
class ChoreWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        runAsync { WidgetRenderer.update(context, ids, forceFetch = false) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        // The widget was resized: re-render so the row count matches the height.
        runAsync { WidgetRenderer.update(context, intArrayOf(appWidgetId), forceFetch = false) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_TOGGLE -> {
                val choreId = intent.getStringExtra(EXTRA_CHORE_ID)
                if (choreId.isNullOrEmpty()) return
                runAsync { WidgetRenderer.toggle(context, choreId) }
            }

            ACTION_REFRESH -> runAsync {
                WidgetRenderer.update(context, allWidgetIds(context), forceFetch = true)
            }

            else -> super.onReceive(context, intent)
        }
    }

    /** Runs [block] off the main thread while keeping the broadcast alive.
     *  goAsync() is only valid inside onReceive, which is where every path here
     *  ends up (onUpdate is dispatched by super.onReceive). */
    private fun runAsync(block: () -> Unit) {
        val pending = goAsync()
        executor.execute {
            try {
                block()
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_TOGGLE = "it.ricknewere.todohome.ACTION_TOGGLE"
        const val ACTION_REFRESH = "it.ricknewere.todohome.ACTION_REFRESH"
        const val EXTRA_CHORE_ID = "chore_id"

        private val executor = Executors.newSingleThreadExecutor()

        fun allWidgetIds(context: Context): IntArray =
            AppWidgetManager.getInstance(context).getAppWidgetIds(
                ComponentName(context, ChoreWidgetProvider::class.java),
            )

        /** Asks every placed widget to reload. Called by the app after a tick. */
        fun requestUpdate(context: Context) {
            context.sendBroadcast(
                Intent(context, ChoreWidgetProvider::class.java).setAction(ACTION_REFRESH),
            )
        }
    }
}
