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
    private const val MAX_ITEMS = 150
    private const val MAX_SIDE = 1600

    private fun dir(ctx: Context): File = File(ctx.filesDir, "queue").apply { mkdirs() }

    fun count(ctx: Context): Int = items(ctx).size

    private fun items(ctx: Context): List<File> =
        (dir(ctx).listFiles() ?: emptyArray()).filter { it.isFile && !it.name.endsWith(".tmp") && !it.name.endsWith(".hint") && !it.name.endsWith(".meta") }.sortedBy { it.name }

    private fun nameFor(time: Long, source: String, ext: String): String {
        val rnd = (100000..999999).random()
        return "${time.toString().padStart(14, '0')}_${source}_$rnd.$ext"
    }

    private fun drop(f: File) { f.delete(); File(f.path + ".hint").delete(); File(f.path + ".meta").delete() }
    private fun hintOf(f: File): String = try { File(f.path + ".hint").takeIf { it.exists() }?.readText() ?: "" } catch (_: Exception) { "" }

    /**
     * Keeps the queue under [MAX_ITEMS]. Turn pictures and saved screens go first (oldest first), so the end-of-match
     * pictures and the screenshots you shared are the last to be dropped. Half-written files left by a crash are removed.
     */
    private fun trim(ctx: Context) {
        val old = System.currentTimeMillis() - 10 * 60_000L
        (dir(ctx).listFiles() ?: emptyArray()).filter { it.name.endsWith(".tmp") && it.lastModified() < old }.forEach { it.delete() }
        val all = items(ctx)
        var extra = all.size - MAX_ITEMS
        if (extra <= 0) return
        val minor = all.filter { val h = hintOf(it); h.startsWith("turn:") || h.startsWith("screen:") }
        for (f in minor) { if (extra <= 0) break; drop(f); extra-- }
        if (extra > 0) items(ctx).take(extra).forEach { drop(it) }
    }

    /** Shrinks a picture to at most 1600 pixels on its long side and saves it as a JPEG. */
    /** [meta] is a short JSON note from the tracker about the picture (how quickly the opponent played, say). */
    fun addBitmap(ctx: Context, bmp: Bitmap, time: Long, source: String, hint: String = "", meta: String = ""): Boolean {
        val scale = MAX_SIDE.toFloat() / max(bmp.width, bmp.height)
        val out = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
        val f = File(dir(ctx), nameFor(time, source, "jpg"))
        val tmp = File(f.path + ".tmp")
        // A full phone (or anything else going wrong while saving) loses this picture, not the app
        return try {
            tmp.outputStream().use { out.compress(Bitmap.CompressFormat.JPEG, 85, it) }
            if (hint.isNotBlank()) File(f.path + ".hint").writeText(hint.take(80))
            if (meta.isNotBlank()) File(f.path + ".meta").writeText(meta.take(2000))
            val ok = tmp.renameTo(f)
            trim(ctx)
            ok
        } catch (e: Exception) {
            tmp.delete(); File(f.path + ".hint").delete(); File(f.path + ".meta").delete()
            TrackerLog.add("Couldn't save a picture: ${e.message}")
            false
        } finally { if (out !== bmp) out.recycle() }
    }

    /** A small JSON file for the web app, like your web shop progress. */
    fun addJson(ctx: Context, text: String, source: String): Boolean = try {
        val f = File(dir(ctx), nameFor(System.currentTimeMillis(), source, "json")); f.writeText(text.take(20_000)); trim(ctx); true
    } catch (e: Exception) { false }

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
            .put("name", if (json) "${if (parts.getOrNull(1) == "webshop") "webshop" else "snapvault"}-${parts.getOrNull(0)}.json" else "${parts.getOrNull(1) ?: "shot"}-${parts.getOrNull(0)}.jpg")
            .put("type", if (json) "application/json" else "image/jpeg")
            .put("time", parts.getOrNull(0)?.toLongOrNull() ?: f.lastModified())
            .put("source", parts.getOrNull(1) ?: "")
            .put("hint", File(f.path + ".hint").takeIf { it.exists() }?.readText() ?: "")
            .put("meta", File(f.path + ".meta").takeIf { it.exists() }?.readText() ?: "")
            .put("b64", Base64.encodeToString(bytes, Base64.NO_WRAP))
            .toString()
    }

    fun done(ctx: Context, id: String) {
        if (id.contains("/") || id.contains("..")) return
        File(dir(ctx), id).delete()
        File(dir(ctx), "$id.hint").delete()
        File(dir(ctx), "$id.meta").delete()
    }

    fun jpegBytes(bmp: Bitmap): ByteArray = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) }.toByteArray()
}

/** A short, readable log of what the app and the tracker saw, so tracking can be tuned from a copy of it. Kept across restarts. */
object TrackerLog {
    /** Enough for a whole play session, so the tracker's rules can be tuned from it. */
    private const val MAX = 800
    private val lines = ArrayDeque<String>()
    private val fmt = java.text.SimpleDateFormat("MM-dd HH:mm:ss", java.util.Locale.US)
    private var file: File? = null
    private var appended = 0

    @Synchronized
    fun attach(ctx: Context) {
        if (file != null) return
        val f = File(ctx.filesDir, "log.txt"); file = f
        try { if (f.exists()) f.readLines().filter { it.isNotBlank() }.takeLast(MAX).forEach { lines.addLast(it) } } catch (_: Exception) {}
    }

    @Synchronized
    fun add(line: String) {
        val l = "${fmt.format(java.util.Date())} ${line.take(300)}"
        lines.addLast(l)
        while (lines.size > MAX) lines.removeFirst()
        // Add to the end of the file, and rewrite it now and then so it doesn't keep growing
        try {
            val f = file ?: return
            if (++appended > MAX / 2) { f.writeText(lines.joinToString("\n") + "\n"); appended = 0 } else f.appendText(l + "\n")
        } catch (_: Exception) {}
    }

    @Synchronized
    fun text(): String = lines.joinToString("\n")
}
