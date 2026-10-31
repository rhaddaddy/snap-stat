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
    // Resizing it switches between the small and the big layout
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, opts: android.os.Bundle) { Widget.refresh(ctx) }
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

    private fun open(ctx: Context, code: Int, route: String, play: Boolean = false): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", route)
        if (play) i.putExtra("trackPlay", true)
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    private fun n(v: Long): String = java.text.NumberFormat.getIntegerInstance().format(v)
    private fun signed(c: Int) = (if (c > 0) "+" else "") + c

    fun refresh(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = try { mgr.getAppWidgetIds(ComponentName(ctx, SnapWidget::class.java)) } catch (e: Exception) { IntArray(0) }
        if (ids.isEmpty()) return
        val f = File(ctx.filesDir, STATE)
        val j = try { if (f.exists()) JSONObject(f.readText()) else JSONObject() } catch (e: Exception) { JSONObject() }
        for (id in ids) {
            // Big when it's at least about 3 rows tall
            val h = try { mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) } catch (e: Exception) { 0 }
            val v = views(ctx, j, h >= 190)
            try { mgr.updateAppWidget(id, v) } catch (e: Exception) { TrackerLog.add("Widget update failed: ${e.message}") }
        }
    }

    private fun views(ctx: Context, j: JSONObject, big: Boolean): RemoteViews {
        val now = System.currentTimeMillis()
        val v = RemoteViews(ctx.packageName, if (big) R.layout.widget_big else R.layout.widget)
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
        val played = td != null && games > 0 && td.optString("day") == today
        v.setTextViewText(R.id.w_today, if (played) {
            "${td!!.optInt("w")}-${td.optInt("l")}${if (td.optInt("t") > 0) "-" + td.optInt("t") else ""} · ${signed(td.optInt("cubes"))}"
        } else "No games yet")
        // Live countdowns (Android ticks them, so they stay right without waking the app)
        val reset = ResetClock.nextDaily(ctx, now)
        v.setChronometer(R.id.w_reset, SystemClock.elapsedRealtime() + (reset - now), null, true)
        v.setChronometerCountDown(R.id.w_reset, true)
        v.setTextViewText(R.id.w_reset_at, "at " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(reset)))
        val alert = j.optString("alert")
        v.setTextViewText(R.id.w_alert, alert)
        v.setViewVisibility(R.id.w_alert, if (alert.isNotEmpty()) View.VISIBLE else View.GONE)
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, 9, if (alert.isNotEmpty()) "#home/shops" else "#home"))
        if (!big) return v

        // The rank tile's extra line: cubes toward the next rank
        val climb = j.optJSONObject("climb")
        v.setTextViewText(R.id.w_rank_sub, if (climb != null && climb.optInt("rank") in 1..99) "${climb.optInt("cubes")}/${climb.optInt("per", 7)} to next" else "")
        val missions = j.optInt("missionsLeft", -1)
        // Two or more wins in a row today shows instead of the game count (the record above already has the games)
        val streak = if (played) td!!.optInt("streak") else 0
        v.setTextViewText(R.id.w_today_sub, listOfNotNull(
            if (streak >= 2) "$streak wins in a row"
            else if (played && td!!.optInt("games") > 0) "${td.optInt("games")} game${if (td.optInt("games") == 1) "" else "s"}" else null,
            if (missions > 0) "$missions mission${if (missions == 1) "" else "s"} left" else if (missions == 0) "missions done" else null
        ).joinToString(" · "))
        val refresh = ResetClock.nextRefresh(ctx, now)
        v.setChronometer(R.id.w_refresh, SystemClock.elapsedRealtime() + (refresh - now), null, true)
        v.setChronometerCountDown(R.id.w_refresh, true)
        v.setTextViewText(R.id.w_refresh_at, "at " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(refresh)) + " · missions, shop")
        // This season
        val rec = season?.optJSONObject("rec")
        v.setTextViewText(R.id.w_seasonrec, if (rec != null && rec.optInt("games") > 0) "${rec.optInt("w")}-${rec.optInt("l")} · ${signed(rec.optInt("cubes"))}" else "No games yet")
        val pass = season?.optInt("pass") ?: 0; val passOf = season?.optInt("passOf") ?: 0
        v.setTextViewText(R.id.w_season_sub, listOfNotNull(
            if (pass > 0) "Pass level $pass${if (passOf > 0) "/$passOf" else ""}" else null,
            if (rec != null && rec.optInt("games") > 0) "${rec.optInt("wr")}% wins" else null
        ).joinToString(" · "))
        // The event that's on
        val ev = j.optJSONObject("event")
        if (ev != null) {
            val end = ev.optLong("endTs")
            v.setTextViewText(R.id.w_event, ev.optString("name"))
            val lv = ev.optInt("level"); val left = ev.optInt("left"); val cur = ev.optJSONObject("cur")
            v.setTextViewText(R.id.w_event_sub, listOfNotNull(
                if (lv > 0) "Lvl $lv" + (if (left > 0) " · ${n(left.toLong())} ${ev.optString("xpName").ifEmpty { "XP" }} to go" else "") else null,
                if (cur != null && cur.optString("name").isNotEmpty()) "${n(cur.optLong("amount"))} ${cur.optString("name")}" else null,
                if (end > now) "ends in ${ends(end, now)}" else null
            ).take(2).joinToString(" · "))
        } else { v.setTextViewText(R.id.w_event, "No event on"); v.setTextViewText(R.id.w_event_sub, "") }
        v.setOnClickPendingIntent(R.id.w_t_event, open(ctx, 11, "#events"))
        // The web shop's free credits
        val claimed = j.optJSONObject("webshop")?.optString("claimed") == ResetClock.gameDay(ctx, now)
        v.setTextViewText(R.id.w_web, if (claimed) "✓ Claimed today" else "Free credits ready")
        v.setTextColor(R.id.w_web, if (claimed) 0xFF7CE3A1.toInt() else 0xFFFFD23F.toInt())
        v.setTextViewText(R.id.w_web_sub, if (claimed) "more after the reset" else "tap to claim them")
        v.setOnClickPendingIntent(R.id.w_t_web, open(ctx, 12, "#webshop"))
        v.setOnClickPendingIntent(R.id.w_webbtn, open(ctx, 13, "#webshop"))
        // Your currencies
        val w = j.optJSONObject("wallet")
        v.setTextViewText(R.id.w_money, if (w != null) "${n(w.optLong("credits"))} · ${n(w.optLong("gold"))} · ${n(w.optLong("tokens"))}" else "—")
        v.setTextViewText(R.id.w_money_sub, listOfNotNull(
            w?.optLong("cl")?.takeIf { it > 0 }?.let { "CL ${n(it)}" },
            w?.optLong("wild")?.takeIf { it > 0 }?.let { "${n(it)} Wild Boosters" }
        ).joinToString(" · "))
        v.setOnClickPendingIntent(R.id.w_t_money, open(ctx, 14, "#home/shops"))
        // Your alliance
        val al = j.optJSONObject("alliance")
        if (al != null && al.optString("name").isNotEmpty()) {
            v.setTextViewText(R.id.w_ally, "${n(al.optLong("points"))} points")
            v.setTextViewText(R.id.w_ally_sub, listOfNotNull(al.optString("name"), if (al.optInt("bounties") > 0) "${al.optInt("bounties")} bount${if (al.optInt("bounties") == 1) "y" else "ies"} going" else null).joinToString(" · "))
        } else { v.setTextViewText(R.id.w_ally, "—"); v.setTextViewText(R.id.w_ally_sub, "Add your alliance in SNAP Stat") }
        v.setOnClickPendingIntent(R.id.w_t_ally, open(ctx, 15, "#social/alliance"))
        v.setOnClickPendingIntent(R.id.w_t_season, open(ctx, 16, "#home/stats"))
        // Track & play: starts the tracker (asking for screen capture the first time) and opens the game
        val tracking = TrackerService.running
        v.setTextViewText(R.id.w_play, if (tracking) "▶ Open MARVEL SNAP · tracking" else "▶ Track & play")
        v.setOnClickPendingIntent(R.id.w_play, open(ctx, 17, "#home", play = true))
        return v
    }
}

/**
 * The game's clock: the daily reset is at 19:00 UTC (12:00 PM Pacific in summer, 11:00 AM in winter), and some things
 * refresh every 8 hours from it (the mission refreshes). An alarm at each one updates the widget and, if you asked, sends a notification.
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

    /** The latest refresh at or before [now]. */
    private fun lastAt(hours: List<Int>, now: Long): Long {
        var best = 0L
        for (h in hours) {
            val c = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = now; set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
            if (c.timeInMillis > now) c.add(Calendar.DAY_OF_YEAR, -1)
            best = maxOf(best, c.timeInMillis)
        }
        return best
    }

    fun nextDaily(ctx: Context, now: Long): Long = nextAt(listOf(resetHour(clock(ctx))), now)
    fun nextRefresh(ctx: Context, now: Long): Long = nextAt(refreshHours(clock(ctx)), now)

    /** The game's day (the one that started at the last reset), like "2026-10-28". */
    fun gameDay(ctx: Context, now: Long): String =
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(now - resetHour(clock(ctx)) * 3_600_000L))

    private const val SLOT_DONE = "resetSlotDone"

    /**
     * Sets the alarm for the next refresh this alarm hasn't told you about yet. It used to always pick the next one
     * after "now", so opening SNAP Stat just after a refresh (before the alarm went off) moved it 8 hours on and that
     * refresh's notification never came.
     */
    fun schedule(ctx: Context) {
        val now = System.currentTimeMillis()
        val sp = ctx.getSharedPreferences("snapstat", 0)
        var done = sp.getLong(SLOT_DONE, 0L)
        // First time (or a time saved while the phone's clock was wrong): start from the refresh that has just passed
        if (done == 0L || done > now + 9 * 3600_000L) { done = lastAt(refreshHours(clock(ctx)), now); sp.edit().putLong(SLOT_DONE, done).apply() }
        val at = nextAt(refreshHours(clock(ctx)), maxOf(done, now - 60 * 60_000L))
        val pi = PendingIntent.getBroadcast(ctx, 7, Intent(ctx, ResetAlarm::class.java).putExtra("slot", at), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        // A window rather than an exact time, so no special permission is needed: it goes off within a few minutes of the refresh.
        try { ctx.getSystemService(AlarmManager::class.java).setWindow(AlarmManager.RTC_WAKEUP, at + 30_000L, 10 * 60_000L, pi) }
        catch (e: Exception) { TrackerLog.add("Couldn't set the reset alarm: ${e.message}") }
    }

    /** Called by the alarm: the notification for the refresh that just happened, if it's wanted. */
    fun fired(ctx: Context, slot0: Long = 0L) {
        val st = clock(ctx); val prefs = st?.optJSONObject("prefs")
        val now = System.currentTimeMillis()
        val sp = ctx.getSharedPreferences("snapstat", 0)
        // The refresh this alarm was set for (or, from an older alarm, the nearest whole hour)
        val slot = if (slot0 > 0L) slot0 else Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = now + 30 * 60_000L; set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        if (slot <= sp.getLong(SLOT_DONE, 0L) || slot > now + 60_000L) return
        sp.edit().putLong(SLOT_DONE, slot).apply()
        // Hours late (the phone was off): no point telling you now
        if (now - slot > 3 * 3600_000L) return
        val hour = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = slot }.get(Calendar.HOUR_OF_DAY)
        val h = refreshHours(st).firstOrNull { it == hour } ?: return
        if (prefs == null || !prefs.optBoolean("on")) return
        val daily = h == resetHour(st)
        // "a, b and c"
        val items = { k: String, def: String -> st?.optJSONObject("clock")?.optJSONArray(k)?.let { a -> val l = (0 until a.length()).map { a.optString(it) }.filter { it.isNotBlank() }
            if (l.size > 1) l.dropLast(1).joinToString(", ") + " and " + l.last() else l.firstOrNull() } ?: def }
        val refreshName = st?.optJSONObject("clock")?.optString("refreshName")?.ifBlank { null } ?: "Mission refresh"
        val tag = "reset:" + java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(slot)) + ":" + h
        val web = prefs.optBoolean("webshop", true)
        if (daily && prefs.optBoolean("resetDaily")) Alerts.show(ctx, "MARVEL SNAP's daily reset", items("daily", "Free shop credits, the daily offer, free Collector's Tokens and Gold Pass gold") + " are ready." + if (web) " Tap to claim your free web shop credits." else "", tag, if (web) "#webshop" else "#home", Alerts.REMIND)
        else if (daily && web) Alerts.show(ctx, "Free web shop credits", "Today's free credits are waiting in the web shop. Tap to claim them.", "webshop:$tag", "#webshop", Alerts.REMIND)
        else if (prefs.optBoolean("reset8h")) Alerts.show(ctx, refreshName, items("refresh", "2 new daily missions and new Collector's Token shop cards").replaceFirstChar { it.uppercase() } + " are here.", tag, "#home/missions", Alerts.REMIND)
    }
}

class ResetAlarm : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        TrackerLog.attach(ctx.applicationContext)
        try { ResetClock.fired(ctx, intent.getLongExtra("slot", 0L)) } catch (e: Exception) { TrackerLog.add("Reset alarm failed: ${e.message}") }
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
