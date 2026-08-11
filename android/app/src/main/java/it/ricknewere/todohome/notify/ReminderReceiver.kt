package it.ricknewere.todohome.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import it.ricknewere.todohome.widget.ChoreWidgetProvider
import it.ricknewere.todohome.widget.WidgetRenderer
import java.util.concurrent.Executors

/**
 * Wakes on the daily alarm and again after a reboot, which clears every alarm
 * the app had set.
 */
class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
                LateReminder.schedule(context)
            }

            ACTION_CHECK -> offMainThread(context) { LateReminder.run(it) }

            // Re-reads the list, which both refreshes the widget and spots a
            // tick the other person has just added.
            ACTION_SYNC -> offMainThread(context) {
                WidgetRenderer.update(it, ChoreWidgetProvider.allWidgetIds(it), forceFetch = true)
            }
        }
    }

    /** Reading the list blocks, so it cannot run on the main thread, and the
     *  broadcast has to be held open while it does. */
    private fun offMainThread(context: Context, block: (Context) -> Unit) {
        val pending = goAsync()
        val app = context.applicationContext
        executor.execute {
            try {
                block(app)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_CHECK = "it.ricknewere.todohome.ACTION_CHECK_LATE"
        const val ACTION_SYNC = "it.ricknewere.todohome.ACTION_SYNC"

        private val executor = Executors.newSingleThreadExecutor()
    }
}
