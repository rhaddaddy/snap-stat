package com.rhaddaddy.snapstat

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.DateFormat
import java.util.Calendar
import java.util.Date
import java.util.TimeZone

/**
 * The home-screen widget: your rank, today's games, the season, a countdown to the game's daily reset,
 * and anything on your wishlist that's on sale. The web app sends what to show with [save].
 */
class SnapWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { Widget.refresh(ctx); ResetClock.schedule(ctx) }
    override fun onEnabled(ctx: Context) { ResetClock.schedule(ctx) }
}

object Widget {
    private const val STATE = "widget.json"

    fun save(ctx: Context, json: String): Boolean = try {
        File(ctx.filesDir, STATE).writeText(JSONObject(json).toString()); refresh(ctx); true
    } catch (e: Exception) { false }

    fun count(ctx: Context): Int = try {
        AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, SnapWidget::class.java)).size
    } catch (e: Exception) { 0 }

    /** Asks the home screen to add the widget (most launchers show a "Add to home screen" pop-up). */
    fun requestPin(ctx: Context): Boolean = try {
        val mgr = AppWidgetManager.getInstance(ctx)
        mgr.isRequestPinAppWidgetSupported && mgr.requestPinAppWidget(ComponentName(ctx, SnapWidget::class.java), null, null)
    } catch (e: Exception) { false }

    private fun ends(ts: Long, now: Long): String {
        val d = ts - now; if (d <= 0) return "ended"
        val days = d / 86_400_000L; val h = (d % 86_400_000L) / 3_600_000L
        return if (days > 0) "${days}d ${h}h" else "${h}h ${(d % 3_600_000L) / 60_000L}m"
    }

    fun refresh(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = try { mgr.getAppWidgetIds(ComponentName(ctx, SnapWidget::class.java)) } catch (e: Exception) { IntArray(0) }
        if (ids.isEmpty()) return
        val f = File(ctx.filesDir, STATE)
        val j = try { if (f.exists()) JSONObject(f.readText()) else JSONObject() } catch (e: Exception) { JSONObject() }
        val now = System.currentTimeMillis()
        val v = RemoteViews(ctx.packageName, R.layout.widget)
        val rank = j.optString("rank")
        v.setTextViewText(R.id.w_rank, if (rank.isNotEmpty()) rank else "—")
        v.setTextViewText(R.id.w_name, j.optString("handle").ifEmpty { "SNAP Stat" })
        val season = j.optJSONObject("season")
        v.setTextViewText(R.id.w_season, if (season != null) {
            val end = season.optLong("endTs")
            season.optString("name") + if (end > now) " · ends in ${ends(end, now)}" else ""
        } else "Open SNAP Stat to fill this in")
        val td = j.optJSONObject("today")
        val games = td?.optInt("games") ?: 0
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(Date(now))
        v.setTextViewText(R.id.w_today, if (td != null && games > 0 && td.optString("day") == today) {
            val c = td.optInt("cubes"); "${td.optInt("w")}-${td.optInt("l")}${if (td.optInt("t") > 0) "-" + td.optInt("t") else ""} · ${if (c > 0) "+" else ""}$c"
        } else "No games yet")
        // A live countdown to the daily reset (Android ticks it, so it stays right without waking the app)
        val reset = ResetClock.nextDaily(ctx, now)
        v.setChronometer(R.id.w_reset, SystemClock.elapsedRealtime() + (reset - now), null, true)
        v.setChronometerCountDown(R.id.w_reset, true)
        v.setTextViewText(R.id.w_reset_at, "at " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(reset)))
        val alert = j.optString("alert")
        v.setTextViewText(R.id.w_alert, alert)
        v.setViewVisibility(R.id.w_alert, if (alert.isNotEmpty()) View.VISIBLE else View.GONE)
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", if (alert.isNotEmpty()) "#home/shops" else "#home")
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 9, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        try { mgr.updateAppWidget(ids, v) } catch (e: Exception) { TrackerLog.add("Widget update failed: ${e.message}") }
    }
}

/**
 * The game's clock: the daily reset is at 19:00 UTC (12:00 PM Pacific in summer, 11:00 AM in winter), and some things
 * refresh every 8 hours from it. An alarm at each refresh updates the widget and, if you asked, sends a notification.
 */
object ResetClock {
    private fun clock(ctx: Context): JSONObject? = try {
        val f = File(ctx.filesDir, "alerts.json"); if (f.exists()) JSONObject(f.readText()) else null
    } catch (e: Exception) { null }

    private fun resetHour(st: JSONObject?): Int = st?.optJSONObject("clock")?.optInt("resetUtcHour", 19) ?: 19
    private fun refreshHours(st: JSONObject?): List<Int> {
        val a = st?.optJSONObject("clock")?.optJSONArray("refreshUtcHours") ?: JSONArray("[3,11,19]")
        return (0 until a.length()).map { a.optInt(it) }.filter { it in 0..23 }.ifEmpty { listOf(3, 11, 19) }
    }

    private fun nextAt(hours: List<Int>, now: Long): Long {
        var best = Long.MAX_VALUE
        for (h in hours) {
            val c = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = now; set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
            if (c.timeInMillis <= now) c.add(Calendar.DAY_OF_YEAR, 1)
            best = minOf(best, c.timeInMillis)
        }
        return best
    }

    fun nextDaily(ctx: Context, now: Long): Long = nextAt(listOf(resetHour(clock(ctx))), now)

    /** The game's day (the one that started at the last reset), like "2026-10-28". */
    fun gameDay(ctx: Context, now: Long): String =
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(now - resetHour(clock(ctx)) * 3_600_000L))

    fun schedule(ctx: Context) {
        val at = nextAt(refreshHours(clock(ctx)), System.currentTimeMillis())
        val pi = PendingIntent.getBroadcast(ctx, 7, Intent(ctx, ResetAlarm::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        // A window rather than an exact time, so no special permission is needed: it goes off within a few minutes of the refresh.
        try { ctx.getSystemService(AlarmManager::class.java).setWindow(AlarmManager.RTC_WAKEUP, at + 30_000L, 10 * 60_000L, pi) }
        catch (e: Exception) { TrackerLog.add("Couldn't set the reset alarm: ${e.message}") }
    }

    /** Called by the alarm: the notification for the refresh that just happened, if it's wanted. */
    fun fired(ctx: Context) {
        val st = clock(ctx); val prefs = st?.optJSONObject("prefs")
        val now = System.currentTimeMillis()
        // The refresh that just happened: the nearest whole hour (the alarm goes off a few minutes after it)
        val hour = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = now + 30 * 60_000L }.get(Calendar.HOUR_OF_DAY)
        val h = refreshHours(st).firstOrNull { it == hour } ?: return
        if (prefs == null || !prefs.optBoolean("on")) return
        val daily = h == resetHour(st)
        val items = { k: String, def: String -> st?.optJSONObject("clock")?.optJSONArray(k)?.let { a -> (0 until a.length()).joinToString(", ") { a.optString(it) } } ?: def }
        val tag = "reset:" + java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(now)) + ":" + h
        val web = prefs.optBoolean("webshop", true)
        if (daily && prefs.optBoolean("resetDaily")) Alerts.show(ctx, "MARVEL SNAP's daily reset", items("daily", "Daily free credits, Gold Pass claim, Collector's Shop free tokens and a new daily shop") + " are ready." + if (web) " Tap to claim your free web shop credits." else "", tag, if (web) "#webshop" else "#home")
        else if (daily && web) Alerts.show(ctx, "Free web shop credits", "Today's free credits are waiting in the web shop. Tap to claim them.", "webshop:$tag", "#webshop")
        else if (prefs.optBoolean("reset8h")) Alerts.show(ctx, "8-hour refresh", items("refresh", "Missions, free credits, Collector's Shop cards, shop cosmetics and bonus boosters") + " just refreshed.", tag, "#home")
    }
}

class ResetAlarm : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        TrackerLog.attach(ctx.applicationContext)
        try { ResetClock.fired(ctx) } catch (e: Exception) { TrackerLog.add("Reset alarm failed: ${e.message}") }
        Widget.refresh(ctx)
        ResetClock.schedule(ctx)
    }
}

/** Alarms don't survive a restart, so set the next one again when the phone starts. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        ResetClock.schedule(ctx); Widget.refresh(ctx)
    }
}
