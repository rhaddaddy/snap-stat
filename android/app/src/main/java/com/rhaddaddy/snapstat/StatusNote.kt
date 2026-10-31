package com.rhaddaddy.snapstat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import java.text.DateFormat
import java.util.Date

/**
 * An optional, quiet notification that stays on the lock screen: a live countdown to the game's daily reset, with
 * Won / Lost / Tie buttons that open SNAP Stat's Quick log. Phones don't let apps put widgets on the lock screen or the
 * always-on display, so this is the closest thing; it also shows on a paired smartwatch like any notification.
 * Turned on in SNAP Stat › Settings › Android. Redrawn after each reset by the reset alarm (see ResetAlarm).
 */
object StatusNote {
    private const val CH = "status"
    private const val ID = 21
    private const val PREF = "statusNote"

    fun isOn(ctx: Context): Boolean = ctx.getSharedPreferences("snapstat", 0).getBoolean(PREF, false)

    fun setOn(ctx: Context, on: Boolean) {
        ctx.getSharedPreferences("snapstat", 0).edit().putBoolean(PREF, on).apply()
        if (on) refresh(ctx) else hide(ctx)
    }

    private fun channel(ctx: Context) {
        ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CH, "Reset countdown", NotificationManager.IMPORTANCE_LOW).apply {
                description = "A quiet countdown to the daily reset on your lock screen, with buttons to log a match"
                setShowBadge(false)
            })
    }

    private fun open(ctx: Context, code: Int, route: String): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", route)
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun refresh(ctx: Context) {
        if (!isOn(ctx) || !Alerts.canNotify(ctx)) return
        try {
            channel(ctx)
            val now = System.currentTimeMillis()
            val reset = ResetClock.nextDaily(ctx, now)
            val icon = Icon.createWithResource(ctx, R.drawable.ic_notify)
            val n = Notification.Builder(ctx, CH)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle("MARVEL SNAP daily reset")
                .setContentText("At " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(reset)) + ". Log a match with a tap.")
                .setWhen(reset)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_STATUS)
                .setContentIntent(open(ctx, 31, "#home"))
                .addAction(Notification.Action.Builder(icon, "Won", open(ctx, 32, "#quicklog=W")).build())
                .addAction(Notification.Action.Builder(icon, "Lost", open(ctx, 33, "#quicklog=L")).build())
                .addAction(Notification.Action.Builder(icon, "Tie", open(ctx, 34, "#quicklog=T")).build())
                .build()
            ctx.getSystemService(NotificationManager::class.java).notify(ID, n)
        } catch (e: Exception) { TrackerLog.add("Reset countdown failed: ${e.message}") }
    }

    fun hide(ctx: Context) {
        try { ctx.getSystemService(NotificationManager::class.java).cancel(ID) } catch (_: Exception) {}
    }
}
