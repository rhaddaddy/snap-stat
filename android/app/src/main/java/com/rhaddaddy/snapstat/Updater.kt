package com.rhaddaddy.snapstat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Updates the Android part of SNAP Stat from the GitHub release.
 * (Everything else in SNAP Stat comes from the website, so it updates by itself.)
 * The new version opens in Android's installer, where you tap Update.
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

    /** Downloads the newest app to the app's own storage. Returns the file, or throws with a message. [progress] gets 0–100. */
    fun download(ctx: Context, url: String, progress: (Int) -> Unit): File {
        if (!url.startsWith("https://github.com/rhaddaddy/snap-stat/releases/")) throw IllegalStateException("That isn't SNAP Stat's download.")
        val c = get(url, "application/octet-stream")
        if (c.responseCode != 200) throw IllegalStateException("The download didn't work (${c.responseCode}).")
        val total = c.contentLengthLong
        val dir = File(ctx.cacheDir, "updates").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
        val f = File(dir, "snap-stat.apk")
        c.inputStream.use { input ->
            f.outputStream().use { out ->
                val buf = ByteArray(64 * 1024); var done = 0L; var last = -1
                while (true) {
                    val n = input.read(buf); if (n < 0) break
                    out.write(buf, 0, n); done += n
                    if (total > 0) { val pct = (done * 100 / total).toInt(); if (pct != last) { last = pct; progress(pct) } }
                }
            }
        }
        if (f.length() < 100_000) throw IllegalStateException("The download was incomplete. Try again.")
        TrackerLog.add("Update downloaded (${f.length() / 1024} KB)")
        return f
    }

    /** Android's own installer screen for the downloaded file. */
    fun installIntent(ctx: Context, f: File): Intent {
        val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
        return Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    /** A notification to tap, in case the installer window didn't open. */
    fun notifyReady(ctx: Context, f: File) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("updates", "App updates", NotificationManager.IMPORTANCE_HIGH))
        val pi = PendingIntent.getActivity(ctx, 7, installIntent(ctx, f), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, "updates") else @Suppress("DEPRECATION") Notification.Builder(ctx)
        nm.notify(3, b.setSmallIcon(R.drawable.ic_notify).setContentTitle("SNAP Stat update ready").setContentText("Tap to install it.").setContentIntent(pi).setAutoCancel(true).build())
    }
}
