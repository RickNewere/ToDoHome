package it.ricknewere.todohome.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import it.ricknewere.todohome.MainActivity
import it.ricknewere.todohome.R
import it.ricknewere.todohome.data.ChoreStatus
import it.ricknewere.todohome.data.Prefs

/**
 * Tells this phone's owner that the other person has ticked something which is
 * now waiting on their confirmation.
 *
 * A chore only closes once both have ticked it, so without a nudge the second
 * tick depends on somebody happening to look. The comparison is free: the widget
 * already stores the previous list, so a chore that gained the partner's tick
 * since then is exactly what the notification is about.
 */
object PartnerNudge {

    private const val CHANNEL_ID = "confirm"
    private const val NOTIFICATION_ID = 2

    /** Posts when [after] shows partner ticks that [before] did not. Silent on
     *  the first ever read, when there is nothing to compare against. */
    fun check(context: Context, before: List<ChoreStatus>?, after: List<ChoreStatus>) {
        if (before == null) return
        val me = Prefs.user(context) ?: return

        val was = before.associateBy { it.id }
        val fresh = after.filter { now ->
            val then = was[now.id] ?: return@filter false
            // The partner has just ticked it and this phone still has not, so
            // the chore is stuck one tick short.
            now.checkedByPartnerOf(me) && !then.checkedByPartnerOf(me) && !now.checkedBy(me)
        }
        if (fresh.isEmpty()) return

        post(context, fresh, if (me == "riccardo") "Roberta" else "Riccardo")
    }

    private fun post(context: Context, chores: List<ChoreStatus>, partner: String) {
        if (!LateReminder.canNotify(context)) return
        ensureChannel(context)

        val title = if (chores.size == 1) {
            "$partner ha fatto ${chores[0].name}"
        } else {
            "$partner ha fatto ${chores.size} faccende"
        }
        val lines = chores.map { "${it.emoji} ${it.name}" }

        val style = NotificationCompat.InboxStyle().setSummaryText("Manca la tua conferma")
        lines.take(5).forEach { style.addLine(it) }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText("Tocca a te confermare")
            .setStyle(style)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(
                PendingIntent.getActivity(
                    context,
                    2,
                    Intent(context, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                ),
            )
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // Permission pulled between the check and the post.
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Da confermare",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Quando l'altra persona spunta qualcosa che aspetta la tua conferma"
            },
        )
    }
}
