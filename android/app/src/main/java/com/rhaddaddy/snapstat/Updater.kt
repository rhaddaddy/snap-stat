package com.rhaddaddy.snapstat

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Updates the Android part of SNAP Stat from the GitHub release.
 * (Everything else in SNAP Stat comes from the website, so it updates by itself.)
 * Android asks you to confirm an update, unless it allows the app to update itself quietly (Android 12 and newer, after the first update).
 */
object Updater {
    private const val RELEASE = "https://api.github.com/repos/rhaddaddy/snap-stat/releases/tags/android"
    private const val PREFS = "snapstat"

    fun current(ctx: Context): Long = try {
        val p = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else @Suppress("DEPRECATION") p.versionCode.toLong()
    } catch (e: Exception) { 0L }

    private fun get(url: String, accept: String): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.setRequestProperty("User-Agent", "SNAP-Stat-Android")
        c.setRequestProperty("Accept", accept)
        c.connectTimeout = 15_000; c.readTimeout = 60_000
        c.instanceFollowRedirects = true
        return c
    }

    /** {current, latest, url, name}. Runs on a background thread. Remembers the answer for the web app. */
    fun check(ctx: Context): JSONObject {
        val out = JSONObject().put("current", current(ctx))
        try {
            val c = get(RELEASE, "application/vnd.github+json")
            if (c.responseCode != 200) return out.put("error", "GitHub answered ${c.responseCode}")
            val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
            val name = j.optString("name")
            val latest = Regex("1\\.(\\d+)").find(name)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
            val assets = j.optJSONArray("assets")
            var url = ""
            if (assets != null) for (i in 0 until assets.length()) {
                val a = assets.getJSONObject(i)
                if (a.optString("name").endsWith(".apk")) url = a.optString("browser_download_url")
            }
            out.put("latest", latest).put("url", url).put("name", name)
            ctx.getSharedPreferences(PREFS, 0).edit().putString("update", out.toString()).putLong("updateChecked", System.currentTimeMillis()).apply()
        } catch (e: Exception) {
            out.put("error", e.message ?: "Couldn't check")
        }
        return out
    }

    fun lastCheck(ctx: Context): Long = ctx.getSharedPreferences(PREFS, 0).getLong("updateChecked", 0L)

    fun canInstall(ctx: Context): Boolean = Build.VERSION.SDK_INT < 26 || ctx.packageManager.canRequestPackageInstalls()

    fun askInstallPermission(ctx: Context) {
        val i = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
    }

    /** Downloads the newest app and hands it to Android to install. [progress] gets 0–100. Runs on a background thread. */
    fun install(ctx: Context, url: String, progress: (Int) -> Unit): String {
        if (!url.startsWith("https://github.com/rhaddaddy/snap-stat/releases/")) return "That isn't SNAP Stat's download."
        val c = get(url, "application/octet-stream")
        if (c.responseCode != 200) return "The download didn't work (${c.responseCode})."
        val total = c.contentLengthLong
        val installer = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id = installer.createSession(params)
        installer.openSession(id).use { s ->
            c.inputStream.use { input ->
                s.openWrite("snap-stat.apk", 0, if (total > 0) total else -1).use { out ->
                    val buf = ByteArray(64 * 1024); var done = 0L; var last = -1
                    while (true) {
                        val n = input.read(buf); if (n < 0) break
                        out.write(buf, 0, n); done += n
                        if (total > 0) { val pct = (done * 100 / total).toInt(); if (pct != last) { last = pct; progress(pct) } }
                    }
                    s.fsync(out)
                }
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            val pending = PendingIntent.getBroadcast(ctx, id, Intent(ctx, UpdateReceiver::class.java), flags)
            s.commit(pending.intentSender)
        }
        TrackerLog.add("Update downloaded, installing")
        return ""
    }
}

/** Android reports back here: either it needs you to confirm the update, or it's done (or it failed). */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT)
                confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let { ctx.startActivity(it) }
            }
            PackageInstaller.STATUS_SUCCESS -> TrackerLog.add("Update installed")
            else -> TrackerLog.add("Update didn't install: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
        }
    }
}
