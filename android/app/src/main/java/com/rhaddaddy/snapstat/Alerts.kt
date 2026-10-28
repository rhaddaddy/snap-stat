package com.rhaddaddy.snapstat

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Sale, event and reminder notifications for the Android app (the web version uses its service worker for these).
 * The web app hands over what to watch (your wishlist, events, goals) with [save]; a background job then checks
 * every few hours, even when the app is closed, using the same rules as the web version.
 */
object Alerts {
    private const val JOB_ID = 4711
    const val CHANNEL = "alerts"
    private const val STATE = "alerts.json"
    private const val SEEN = "alerts-seen.json"
    @Volatile private var lastRun = 0L

    fun channel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Sales, events and reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Wishlist items on sale, events starting, and your daily reminders"
            })
    }

    fun canNotify(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Saves what to watch, makes sure the background check is scheduled, and checks once right away. */
    fun save(ctx: Context, json: String): Boolean {
        return try {
            val j = JSONObject(json)
            File(ctx.filesDir, STATE).writeText(j.toString())
            if (j.optJSONObject("prefs")?.optBoolean("on") == true) schedule(ctx) else cancel(ctx)
            ResetClock.schedule(ctx)
            // Check right away, but not more than every 10 minutes (the web app saves this often)
            if (System.currentTimeMillis() - lastRun > 10 * 60_000L) {
                lastRun = System.currentTimeMillis()
                thread { try { check(ctx) } catch (e: Exception) { TrackerLog.add("Alert check failed: ${e.message}") } }
            }
            true
        } catch (e: Exception) { false }
    }

    fun schedule(ctx: Context) {
        val js = ctx.getSystemService(JobScheduler::class.java)
        if (js.getPendingJob(JOB_ID) != null) return
        val job = JobInfo.Builder(JOB_ID, ComponentName(ctx, AlertJob::class.java))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(3 * 3600_000L, 3600_000L)
            .setPersisted(true)
            .build()
        try { js.schedule(job) } catch (e: Exception) { TrackerLog.add("Couldn't schedule alerts: ${e.message}") }
    }

    private fun cancel(ctx: Context) { ctx.getSystemService(JobScheduler::class.java).cancel(JOB_ID) }

    /** Shows a notification now. [route] is the part of the app to open, like "#shops". */
    fun show(ctx: Context, title: String, body: String, tag: String, route: String): Boolean {
        if (!canNotify(ctx)) return false
        channel(ctx)
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", route)
        val pi = PendingIntent.getActivity(ctx, tag.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = android.app.Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        return try { ctx.getSystemService(NotificationManager::class.java).notify(tag, 1, n); true } catch (e: Exception) { false }
    }

    private fun day(c: Calendar): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.time)

    private fun fetchJson(u: String): JSONObject? = try {
        val con = URL(u).openConnection() as HttpURLConnection
        con.connectTimeout = 15000; con.readTimeout = 20000; con.useCaches = false
        con.setRequestProperty("Cache-Control", "no-cache")
        if (con.responseCode in 200..299) JSONObject(con.inputStream.bufferedReader().use { it.readText() }) else null
    } catch (e: Exception) { null }

    private fun arr(j: JSONObject?, k: String): JSONArray = j?.optJSONArray(k) ?: JSONArray()

    /** The same checks as the web version's service worker. Each notice is shown once. */
    fun check(ctx: Context) {
        val f = File(ctx.filesDir, STATE); if (!f.exists()) return
        val st = try { JSONObject(f.readText()) } catch (e: Exception) { return }
        val prefs = st.optJSONObject("prefs") ?: return
        if (!prefs.optBoolean("on") || !canNotify(ctx)) return
        val seenFile = File(ctx.filesDir, SEEN)
        val seen = try { if (seenFile.exists()) JSONObject(seenFile.readText()) else JSONObject() } catch (e: Exception) { JSONObject() }
        val cal = Calendar.getInstance(); val today = day(cal)
        val tomorrow = day((cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) })
        val hour = cal.get(Calendar.HOUR_OF_DAY); val now = System.currentTimeMillis()
        data class Note(val tag: String, val title: String, val body: String, val route: String)
        val notes = mutableListOf<Note>()
        fun once(id: String, title: String, body: String, route: String) { if (!seen.has(id) && notes.none { it.tag == id }) notes.add(Note(id, title, body, route)) }

        val wishCats = arr(st, "wishCats"); val wishCards = arr(st, "wishCards")
        if (prefs.optBoolean("wish") && (wishCats.length() > 0 || wishCards.length() > 0)) {
            var sched: JSONObject? = null
            val urls = arr(st, "urls")
            for (i in 0 until urls.length()) { sched = fetchJson(urls.optString(i)); if (sched != null) break }
            val shops = arr(sched, "shops")
            for (i in 0 until shops.length()) {
                val s = shops.optJSONObject(i) ?: continue
                val end = s.optString("end")
                if (end.isNotEmpty() && end < today) continue
                val items = arr(s, "items")
                for (n in 0 until items.length()) {
                    val it = items.optJSONObject(n) ?: continue
                    val cat = it.optString("cat"); val cardId = it.optString("cardId")
                    var name: String? = null
                    if (cat.isNotEmpty()) { for (w in 0 until wishCats.length()) { val x = wishCats.optJSONObject(w); if (x?.optString("cat") == cat) { name = x.optString("name"); break } } }
                    else if (it.optString("variantId").isEmpty()) { for (w in 0 until wishCards.length()) { val x = wishCards.optJSONObject(w); if (x?.optString("id") == cardId) { name = x.optString("name"); break } } }
                    if (name == null) continue
                    val where = s.optString("title").ifEmpty { s.optString("shop") }
                    once("shop:${cat.ifEmpty { cardId }}:${s.optString("shop")}:$end", "On your wishlist and on sale", "$name · $where${if (end.isNotEmpty()) " · until $end" else ""}", "#shops")
                }
            }
        }
        if (prefs.optBoolean("events")) {
            val evs = arr(st, "events")
            for (i in 0 until evs.length()) { val e = evs.optJSONObject(i) ?: continue; if (e.optString("start") == today) once("event:${e.optString("id")}", "Starting today", e.optString("name"), "#events") }
        }
        if (prefs.optBoolean("goals", true) && hour >= 18) {
            val gs = arr(st, "goals")
            for (i in 0 until gs.length()) { val g = gs.optJSONObject(i) ?: continue; if (g.optString("day") == today && g.optInt("left") > 0) once("goal:${g.optString("id")}:$today", "Today's goal", "${g.optString("text")}: ${g.optInt("left")} to go.", "#home") }
        }
        val mi = st.optJSONObject("missions")
        if (prefs.optBoolean("missions", true) && mi != null && mi.optInt("left") > 0) {
            val reset = mi.optLong("resetAt")
            if (reset > now && reset - now < 3 * 3600_000L) { val left = mi.optInt("left"); once("missions:${mi.optString("key")}", "Daily checklist", "$left thing${if (left > 1) "s" else ""} left before the game's day resets.", "#home") }
        }
        val td = st.optJSONObject("today")
        if (prefs.optBoolean("daily", true) && td != null && td.optString("day") == today && td.optInt("games") > 0 && hour >= 21) {
            val g = td.optInt("games"); val t = td.optInt("t"); val cubes = td.optInt("cubes")
            once("daily:$today", "Your day in MARVEL SNAP", "$g game${if (g > 1) "s" else ""} · ${td.optInt("w")}-${td.optInt("l")}${if (t > 0) "-$t" else ""} · ${if (cubes > 0) "+" else ""}$cubes cubes", "#home")
        }
        val season = st.optJSONObject("season")
        if (prefs.optBoolean("season") && season != null && season.optString("end") == tomorrow)
            once("season:${season.optString("id")}", "The season ends tomorrow", "${season.optString("name")}: finish your pass and climb while you can.", "#seasons")

        // Up to five at a time. Each is remembered only once it was shown.
        for (n in notes.take(5)) if (show(ctx, n.title, n.body, n.tag, n.route)) seen.put(n.tag, now)
        val old = mutableListOf<String>()
        seen.keys().forEach { k -> if (now - seen.optLong(k) > 60 * 86400_000L) old.add(k) }
        old.forEach { seen.remove(it) }
        seenFile.writeText(seen.toString())
    }
}

/** Android runs this every few hours to check for alerts. */
class AlertJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        TrackerLog.attach(applicationContext)
        thread {
            try { Alerts.check(applicationContext) } catch (e: Exception) { TrackerLog.add("Alert check failed: ${e.message}") }
            jobFinished(params, false)
        }
        return true
    }
    override fun onStopJob(params: JobParameters): Boolean = true
}
