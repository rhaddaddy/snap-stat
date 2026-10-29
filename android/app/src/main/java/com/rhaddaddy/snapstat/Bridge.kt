package com.rhaddaddy.snapstat

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

/**
 * What SNAP Stat's web app can ask the Android app to do. The web app finds this as window.SnapStatNative.
 * Answers that take a while come back as events through window.snapNative.on(type, data).
 */
class Bridge(private val act: MainActivity) {
    private val ctx = act.applicationContext

    @JavascriptInterface fun version(): String = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "1" } catch (e: Exception) { "1" }

    @JavascriptInterface fun info(): String = JSONObject()
        .put("version", version())
        .put("sdk", Build.VERSION.SDK_INT)
        .put("photos", Screenshots.hasPhotos(ctx))
        .put("usage", Usage.hasAccess(ctx))
        .put("notify", Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
        .put("autoShots", Screenshots.isOn(ctx))
        .put("tracking", TrackerService.running)
        .put("captured", TrackerService.captured)
        .put("queue", ShotQueue.count(ctx))
        .put("snap", isInstalled(ShotQueue.SNAP_PACKAGE))
        .put("versionCode", Updater.current(ctx))
        .toString()

    private fun isInstalled(pkg: String): Boolean = try { ctx.packageManager.getPackageInfo(pkg, 0); true } catch (e: Exception) { false }

    /** The web app is loaded and listening: send anything that came in while it was loading. */
    @JavascriptInterface fun ready() { act.runOnUiThread { act.pageReady() } }

    @JavascriptInterface fun openSignIn() { act.runOnUiThread { act.openInChrome(MainActivity.SIGN_IN_URL) } }

    @JavascriptInterface fun openUrl(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return
        act.runOnUiThread { act.openExternal(url) }
    }

    @JavascriptInterface fun toast(text: String) { act.runOnUiThread { Toast.makeText(act, text, Toast.LENGTH_SHORT).show() } }

    /** Saves a file the web app made (a deck picture, a backup) to Downloads. */
    @JavascriptInterface fun saveFile(name: String, mime: String, b64: String): Boolean {
        return try {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "snap-stat-file" }
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safe)
                    put(MediaStore.Downloads.MIME_TYPE, mime.ifBlank { "application/octet-stream" })
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SNAP Stat")
                }
                val uri = ctx.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                ctx.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            } else {
                val dir = File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "SNAP Stat").apply { mkdirs() }
                File(dir, safe).writeBytes(bytes)
            }
            act.runOnUiThread { Toast.makeText(act, "Saved to Downloads › SNAP Stat", Toast.LENGTH_SHORT).show() }
            true
        } catch (e: Exception) {
            act.runOnUiThread { Toast.makeText(act, "Couldn't save the file", Toast.LENGTH_SHORT).show() }
            false
        }
    }

    /** Android's share menu, for decks, pictures and links. {title, text, url, files: [{name, type, b64}]} */
    @JavascriptInterface fun share(json: String) {
        try {
            val j = JSONObject(json)
            val text = listOf(j.optString("text"), j.optString("url")).filter { it.isNotBlank() }.joinToString("\n")
            val files = j.optJSONArray("files")
            val intent: Intent
            if (files != null && files.length() > 0) {
                val dir = File(ctx.cacheDir, "shared").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
                val uris = ArrayList<Uri>()
                var type = ""
                for (i in 0 until files.length()) {
                    val f = files.getJSONObject(i)
                    val out = File(dir, f.optString("name", "file").replace(Regex("[\\\\/:*?\"<>|]"), "_"))
                    out.writeBytes(Base64.decode(f.optString("b64"), Base64.DEFAULT))
                    uris.add(FileProvider.getUriForFile(ctx, ctx.packageName + ".files", out))
                    type = f.optString("type", "*/*")
                }
                intent = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
                else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                intent.type = if (uris.size == 1) type else "*/*"
                if (text.isNotBlank()) intent.putExtra(Intent.EXTRA_TEXT, text)
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
                intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            }
            if (j.optString("title").isNotBlank()) intent.putExtra(Intent.EXTRA_SUBJECT, j.optString("title"))
            act.runOnUiThread { act.startActivity(Intent.createChooser(intent, j.optString("title").ifBlank { "Share" })) }
        } catch (e: Exception) {
            toast("Couldn't share that")
        }
    }

    // ---- Pictures waiting for the web app ----
    @JavascriptInterface fun queueCount(): Int = ShotQueue.count(ctx)
    /** MARVEL SNAP's web shop inside SNAP Stat, so your Web Points and claimed rewards are kept (see WebShopActivity). */
    @JavascriptInterface fun openWebShop(): Boolean = try { act.runOnUiThread { act.startActivity(Intent(act, WebShopActivity::class.java)) }; true } catch (e: Exception) { false }
    @JavascriptInterface fun next(): String = ShotQueue.next(ctx)
    @JavascriptInterface fun done(id: String) = ShotQueue.done(ctx, id)

    // ---- Automatic screenshots ----
    @JavascriptInterface fun setAutoShots(on: Boolean) {
        Screenshots.setOn(ctx, on)
        val state = info()
        act.runOnUiThread {
            if (on && !Screenshots.hasPhotos(ctx)) act.askPhotos()
            act.emit("perm", state)
        }
    }

    @JavascriptInterface fun askPhotos() { act.runOnUiThread { act.askPhotos() } }

    @JavascriptInterface fun askUsage() {
        act.runOnUiThread {
            try { act.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).setData(Uri.parse("package:" + ctx.packageName))) }
            catch (e: Exception) { act.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
        }
    }

    @JavascriptInterface fun askNotify() { act.runOnUiThread { act.askNotify() } }

    @JavascriptInterface fun openAppSettings() {
        act.runOnUiThread { act.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))) }
    }

    @JavascriptInterface fun scanNow() { act.scanScreenshots() }

    // ---- Match tracker ----
    @JavascriptInterface fun startTracker() { act.runOnUiThread { act.startTracker() } }
    /** Starts the tracker if it isn't running, then opens MARVEL SNAP. */
    @JavascriptInterface fun trackAndPlay() { act.runOnUiThread { act.trackAndPlay() } }
    @JavascriptInterface fun stopTracker() { TrackerService.stop(ctx) }
    @JavascriptInterface fun setRules(json: String): Boolean = Rules.save(ctx, json)
    @JavascriptInterface fun log(): String = TrackerLog.text()
    // ---- Updates to the app itself ----
    /** The last update check: {current, latest, url, name}. */
    @JavascriptInterface fun updateInfo(): String {
        val saved = ctx.getSharedPreferences("snapstat", 0).getString("update", null)
        val j = try { if (saved != null) JSONObject(saved) else JSONObject() } catch (e: Exception) { JSONObject() }
        return j.put("current", Updater.current(ctx)).put("canInstall", Updater.canInstall(ctx)).toString()
    }

    @JavascriptInterface fun checkUpdate() { act.checkUpdate(true) }

    @JavascriptInterface fun installUpdate() {
        if (!Updater.canInstall(ctx)) {
            act.runOnUiThread {
                toast("Allow SNAP Stat to install updates, then come back and tap Update again")
                try { Updater.askInstallPermission(act) } catch (_: Exception) {}
            }
            return
        }
        val url = try { JSONObject(updateInfo()).optString("url") } catch (e: Exception) { "" }
        kotlin.concurrent.thread {
            try {
                val f = Updater.download(ctx, url) { pct -> act.runOnUiThread { act.emit("update-progress", pct.toString()) } }
                act.runOnUiThread { act.installApk(f) }
            } catch (e: Exception) {
                TrackerLog.add("Update failed: ${e.message}")
                act.runOnUiThread { act.emit("update-error", JSONObject.quote(e.message ?: "The update didn't work.")) }
            }
        }
    }

    // ---- Sale, event and reminder notifications ----
    /** What to watch for (the same state the web version gives its service worker). */
    @JavascriptInterface fun setAlerts(json: String): Boolean = Alerts.save(ctx, json)
    @JavascriptInterface fun showAlert(title: String, body: String, tag: String, route: String): Boolean = Alerts.show(ctx, title.take(120), body.take(400), tag.take(120), if (route.startsWith("#")) route.take(40) else "#home")
    @JavascriptInterface fun canNotify(): Boolean = Alerts.canNotify(ctx)
    // ---- Home-screen widget and the game's reset times ----
    /** What the widget shows: {handle, rank, season: {name, endTs}, today: {day, games, w, l, t, cubes}, alert}. */
    @JavascriptInterface fun setWidget(json: String): Boolean = Widget.save(ctx, json)
    @JavascriptInterface fun widgetCount(): Int = Widget.count(ctx)
    @JavascriptInterface fun pinWidget(): Boolean = Widget.requestPin(ctx)
    /** Sets the alarm for the next reset or 8-hour refresh (used for the widget and the reset notifications). */
    @JavascriptInterface fun resetAlarms(): Boolean { ResetClock.schedule(ctx); return true }
    @JavascriptInterface fun checkAlertsNow() { kotlin.concurrent.thread { try { Alerts.check(ctx) } catch (e: Exception) { TrackerLog.add("Alert check failed: ${e.message}") } } }

    @JavascriptInterface fun openSnap() {
        act.runOnUiThread {
            val i = ctx.packageManager.getLaunchIntentForPackage(ShotQueue.SNAP_PACKAGE)
            if (i != null) act.startActivity(i) else toast("MARVEL SNAP isn't installed")
        }
    }
}
