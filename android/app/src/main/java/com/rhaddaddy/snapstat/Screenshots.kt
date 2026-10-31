package com.rhaddaddy.snapstat

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore

/**
 * Finds screenshots taken since the last check and queues the ones taken in MARVEL SNAP.
 * With usage access it checks which app was open; without it, it goes by the file name
 * (Samsung and some other phones add the app's name to screenshot names).
 */
object Screenshots {
    private const val PREFS = "snapstat"
    private const val KEY_ON = "autoShots"
    private const val KEY_SINCE = "shotsSince"

    fun photoPermission(): String =
        if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE

    fun hasPhotos(ctx: Context): Boolean =
        ctx.checkSelfPermission(photoPermission()) == PackageManager.PERMISSION_GRANTED

    fun isOn(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, 0).getBoolean(KEY_ON, false)

    fun setOn(ctx: Context, on: Boolean) {
        val p = ctx.getSharedPreferences(PREFS, 0).edit().putBoolean(KEY_ON, on)
        // Start from now, so turning this on doesn't pull in old screenshots
        if (on) p.putLong(KEY_SINCE, System.currentTimeMillis() / 1000)
        p.apply()
    }

    private fun looksLikeSnap(name: String): Boolean {
        val n = name.lowercase()
        // Samsung names a screenshot after the app's label, and MARVEL SNAP's is just "SNAP": Screenshot_20261028_224037_SNAP.jpg
        return n.contains("marvel snap") || n.contains("marvel_snap") || n.contains("marvelsnap") || n.contains("nvsgames") ||
            Regex("_snap\\.(jpe?g|png|webp)$").containsMatchIn(n)
    }

    /** Returns how many screenshots were queued. Runs on a background thread. */
    @Synchronized
    fun scan(ctx: Context): Int {
        if (!isOn(ctx) || !hasPhotos(ctx)) return 0
        val prefs = ctx.getSharedPreferences(PREFS, 0)
        val since = prefs.getLong(KEY_SINCE, System.currentTimeMillis() / 1000)
        val usage = Usage.hasAccess(ctx)
        val cols = mutableListOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.DATE_ADDED, MediaStore.Images.Media.DATE_TAKEN, MediaStore.Images.Media.MIME_TYPE)
        if (Build.VERSION.SDK_INT >= 29) cols.add(MediaStore.Images.Media.RELATIVE_PATH)
        var newest = since
        var added = 0
        try {
            ctx.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cols.toTypedArray(),
                "${MediaStore.Images.Media.DATE_ADDED} > ?", arrayOf(since.toString()),
                "${MediaStore.Images.Media.DATE_ADDED} ASC"
            )?.use { c ->
                val iId = c.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                val iName = c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                val iAdded = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
                val iTaken = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN)
                val iMime = c.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)
                val iPath = if (Build.VERSION.SDK_INT >= 29) c.getColumnIndex(MediaStore.Images.Media.RELATIVE_PATH) else -1
                while (c.moveToNext()) {
                    val name = c.getString(iName) ?: ""
                    val path = if (iPath >= 0) c.getString(iPath) ?: "" else ""
                    val addedAt = c.getLong(iAdded)
                    newest = maxOf(newest, addedAt)
                    if (!(path + name).lowercase().contains("screenshot")) continue
                    val taken = c.getLong(iTaken).takeIf { it > 0 } ?: (addedAt * 1000)
                    val inSnap = if (usage) Usage.foregroundAt(ctx, taken) == ShotQueue.SNAP_PACKAGE || looksLikeSnap(name) else looksLikeSnap(name)
                    // Other apps' screenshot names stay out of the log (Samsung puts the app's name in them, like _Messages)
                    TrackerLog.add(if (inSnap) "Screenshot $name: from MARVEL SNAP, queued" else "A screenshot from another app was skipped")
                    if (!inSnap) continue
                    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, c.getLong(iId))
                    if (ShotQueue.addUri(ctx, uri, taken, "screenshot", c.getString(iMime))) added++
                }
            }
        } catch (e: Exception) {
            TrackerLog.add("Screenshot check failed: ${e.message}")
        }
        prefs.edit().putLong(KEY_SINCE, newest).apply()
        return added
    }
}
