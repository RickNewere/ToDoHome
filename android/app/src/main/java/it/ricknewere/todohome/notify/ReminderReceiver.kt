package it.ricknewere.todohome.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
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

            ACTION_CHECK -> {
                // Reading the list blocks, so it cannot run on the main thread.
                val pending = goAsync()
                val app = context.applicationContext
                executor.execute {
                    try {
                        LateReminder.run(app)
                    } finally {
                        pending.finish()
                    }
                }
            }
        }
    }

    companion object {
        const val ACTION_CHECK = "it.ricknewere.todohome.ACTION_CHECK_LATE"

        private val executor = Executors.newSingleThreadExecutor()
    }
}
