package it.ricknewere.todohome.notify

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import it.ricknewere.todohome.MainActivity
import it.ricknewere.todohome.R
import it.ricknewere.todohome.data.ChoreStatus
import it.ricknewere.todohome.data.Prefs
import it.ricknewere.todohome.data.SupabaseApi
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * The daily nudge about chores this phone's owner is late on.
 *
 * One alarm a day rather than a live check: a household chore that slipped
 * yesterday is not more urgent at 14:07 than at nine in the morning, and a
 * reminder that arrives at odd hours gets silenced within a week.
 */
object LateReminder {

    private const val CHANNEL_ID = "late"
    private const val NOTIFICATION_ID = 1
    private const val REQUEST_CODE = 42
    private const val REQUEST_SYNC = 43

    /** Hour of day the reminder goes out. */
    const val HOUR = 9

    /** Puts both alarms in place, replacing any previous ones.
     *
     *  Inexact on purpose: an exact alarm needs a special permission on recent
     *  Android and would be a heavy hammer for a reminder that only has to
     *  arrive some time in the morning. */
    fun schedule(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return

        alarms.setInexactRepeating(
            AlarmManager.RTC_WAKEUP,
            nextRun(),
            AlarmManager.INTERVAL_DAY,
            alarmIntent(context),
        )

        // Half hourly re-read, which is what spots the other person's tick.
        // ELAPSED_REALTIME rather than the wakeup variant: a confirmation can
        // wait until the phone is awake anyway, and this way it costs nothing
        // while the phone sits in a pocket.
        alarms.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_HALF_HOUR,
            AlarmManager.INTERVAL_HALF_HOUR,
            syncIntent(context),
        )
    }

    /** Reads the list and posts the reminder when something of this person's is
     *  overdue. Blocks on network, so it must run off the main thread. */
    fun run(context: Context) {
        val me = Prefs.user(context) ?: return
        val url = Prefs.supabaseUrl(context) ?: return
        val key = Prefs.supabaseKey(context) ?: return

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.ITALY).format(Calendar.getInstance().time)
        if (Prefs.notifiedOn(context) == today) return

        val body = SupabaseApi.fetchStatus(url, key) ?: return
        val chores = SupabaseApi.parseStatus(body) ?: return
        Prefs.setSnapshot(context, body)

        // This person's own backlog: a chore the other one still owes is not
        // something this phone can do anything about.
        val late = chores
            .filter { it.isLate && !it.checkedBy(me) }
            .sortedByDescending { it.daysLate }
        if (late.isEmpty()) return

        if (post(context, late)) Prefs.setNotifiedOn(context, today)
    }

    private fun post(context: Context, late: List<ChoreStatus>): Boolean {
        if (!canNotify(context)) return false
        ensureChannel(context)

        val title = if (late.size == 1) {
            "1 faccenda in ritardo"
        } else {
            "${late.size} faccende in ritardo"
        }
        val lines = late.map { "${it.emoji} ${it.name} · ${it.badge()}" }

        val style = NotificationCompat.InboxStyle()
        lines.take(5).forEach { style.addLine(it) }
        if (lines.size > 5) style.setSummaryText("e altre ${lines.size - 5}")

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(lines.joinToString(" · "))
            .setStyle(style)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(
                PendingIntent.getActivity(
                    context,
                    0,
                    Intent(context, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                ),
            )
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            true
        } catch (e: SecurityException) {
            // Permission revoked between the check and the post.
            false
        }
    }

    /** False when the user has not granted notifications, or switched them off. */
    fun canNotify(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Faccende in ritardo",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Un promemoria al mattino quando qualcosa è rimasto indietro"
        }
        manager.createNotificationChannel(channel)
    }

    /** Today at [HOUR] if that is still ahead, tomorrow otherwise. */
    private fun nextRun(): Long {
        val at = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, HOUR)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (at.timeInMillis <= System.currentTimeMillis()) {
            at.add(Calendar.DAY_OF_YEAR, 1)
        }
        return at.timeInMillis
    }

    private fun alarmIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        Intent(context, ReminderReceiver::class.java).setAction(ReminderReceiver.ACTION_CHECK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun syncIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_SYNC,
        Intent(context, ReminderReceiver::class.java).setAction(ReminderReceiver.ACTION_SYNC),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}
