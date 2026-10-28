package com.rhaddaddy.snapstat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max

/**
 * Pictures (and SnapVault files) waiting for SNAP Stat's web app to read them.
 * They're kept in the app's private storage until the web app has taken them.
 * File names hold the details: <time>_<source>_<random>.<jpg|json>
 */
object ShotQueue {
    const val SNAP_PACKAGE = "com.nvsgames.snap"
    private const val MAX_ITEMS = 60
    private const val MAX_SIDE = 1600

    private fun dir(ctx: Context): File = File(ctx.filesDir, "queue").apply { mkdirs() }

    fun count(ctx: Context): Int = items(ctx).size

    private fun items(ctx: Context): List<File> =
        (dir(ctx).listFiles() ?: emptyArray()).filter { it.isFile && !it.name.endsWith(".tmp") }.sortedBy { it.name }

    private fun nameFor(time: Long, source: String, ext: String): String {
        val rnd = (100000..999999).random()
        return "${time.toString().padStart(14, '0')}_${source}_$rnd.$ext"
    }

    private fun trim(ctx: Context) {
        val all = items(ctx)
        if (all.size > MAX_ITEMS) all.take(all.size - MAX_ITEMS).forEach { it.delete() }
    }

    /** Shrinks a picture to at most 1600 pixels on its long side and saves it as a JPEG. */
    fun addBitmap(ctx: Context, bmp: Bitmap, time: Long, source: String): Boolean {
        val scale = MAX_SIDE.toFloat() / max(bmp.width, bmp.height)
        val out = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
        val f = File(dir(ctx), nameFor(time, source, "jpg"))
        val tmp = File(f.path + ".tmp")
        tmp.outputStream().use { out.compress(Bitmap.CompressFormat.JPEG, 85, it) }
        if (out !== bmp) out.recycle()
        val ok = tmp.renameTo(f)
        trim(ctx)
        return ok
    }

    fun addUri(ctx: Context, uri: Uri, time: Long, source: String, mime: String?): Boolean {
        return try {
            if (mime != null && (mime.contains("json") || mime.startsWith("text/"))) {
                val bytes = ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return false
                if (bytes.size > 8_000_000) return false
                val f = File(dir(ctx), nameFor(time, source, "json"))
                f.writeBytes(bytes); trim(ctx); true
            } else {
                // Read the size first, then load a smaller copy so big screenshots don't use much memory
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                var sample = 1
                while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
                val opts = BitmapFactory.Options().apply { inSampleSize = sample }
                val bmp = ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return false
                val ok = addBitmap(ctx, bmp, time, source)
                bmp.recycle(); ok
            }
        } catch (e: Exception) {
            TrackerLog.add("Couldn't read a shared file: ${e.message}")
            false
        }
    }

    /** The oldest waiting item, as JSON for the web app, or "" when nothing is waiting. */
    fun next(ctx: Context): String {
        val f = items(ctx).firstOrNull() ?: return ""
        val parts = f.nameWithoutExtension.split("_")
        val json = f.extension == "json"
        val bytes = try { f.readBytes() } catch (e: Exception) { f.delete(); return "" }
        return JSONObject()
            .put("id", f.name)
            .put("name", if (json) "snapvault-${parts.getOrNull(0)}.json" else "${parts.getOrNull(1) ?: "shot"}-${parts.getOrNull(0)}.jpg")
            .put("type", if (json) "application/json" else "image/jpeg")
            .put("time", parts.getOrNull(0)?.toLongOrNull() ?: f.lastModified())
            .put("source", parts.getOrNull(1) ?: "")
            .put("b64", Base64.encodeToString(bytes, Base64.NO_WRAP))
            .toString()
    }

    fun done(ctx: Context, id: String) {
        if (id.contains("/") || id.contains("..")) return
        File(dir(ctx), id).delete()
    }

    fun jpegBytes(bmp: Bitmap): ByteArray = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) }.toByteArray()
}

/** A short, readable log of what the app and the tracker saw, so tracking can be tuned from a copy of it. */
object TrackerLog {
    private val lines = ArrayDeque<String>()
    private val fmt = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US)

    @Synchronized
    fun add(line: String) {
        lines.addLast("${fmt.format(java.util.Date())} ${line.take(300)}")
        while (lines.size > 120) lines.removeFirst()
    }

    @Synchronized
    fun text(): String = lines.joinToString("\n")
}
