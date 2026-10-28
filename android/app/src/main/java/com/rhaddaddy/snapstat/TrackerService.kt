package com.rhaddaddy.snapstat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * The match tracker. With your permission it watches a small copy of the screen while MARVEL SNAP is open,
 * reads the words on it on the phone itself, and when it sees the end-of-match screen it saves that one
 * picture for SNAP Stat's AI to read. Nothing leaves the phone until SNAP Stat sends that picture to your AI service.
 */
class TrackerService : Service() {
    companion object {
        private const val CH_RUN = "tracker"
        private const val CH_DONE = "captured"
        private const val ID_RUN = 1
        private const val ID_DONE = 2
        private const val ACTION_STOP = "com.rhaddaddy.snapstat.STOP"

        @Volatile var running = false
            private set
        @Volatile var captured = 0
            private set
        /** Called when a picture is queued, so an open SNAP Stat can read it right away. */
        @Volatile var onQueued: (() -> Unit)? = null
        /** Called when tracking starts or stops. */
        @Volatile var onState: (() -> Unit)? = null

        fun start(ctx: Context, resultCode: Int, data: Intent) {
            val i = Intent(ctx, TrackerService::class.java).putExtra("code", resultCode).putExtra("data", data)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }

        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, TrackerService::class.java).setAction(ACTION_STOP))
        }

        fun channels(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_RUN, "Match tracker", NotificationManager.IMPORTANCE_LOW).apply { description = "Shown while SNAP Stat watches for the end of your matches" })
            nm.createNotificationChannel(NotificationChannel(CH_DONE, "Captured matches", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "When the tracker saves a match for SNAP Stat to log" })
        }
    }

    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var recognizer: TextRecognizer? = null
    private lateinit var rules: Rules
    private lateinit var usage: Usage.Tracker
    private var busy = false
    private var hits = 0
    private var cooldownUntil = 0L
    private var lastText = ""
    private var width = 0
    private var height = 0

    override fun onBind(intent: Intent?): IBinder? = null

    private fun openApp(): PendingIntent = PendingIntent.getActivity(
        this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    private fun runningNote(): Notification {
        val stop = PendingIntent.getService(this, 1, Intent(this, TrackerService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH_RUN) else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Tracking your matches")
            .setContentText(if (captured == 0) "Play MARVEL SNAP. Matches are saved when they end." else "$captured match${if (captured == 1) "" else "es"} saved. Open SNAP Stat to log them.")
            .setOngoing(true)
            .setContentIntent(openApp())
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_notify), "Stop", stop).build())
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        val code = intent?.getIntExtra("code", 0) ?: 0
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra("data", Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra("data")
        if (data == null || projection != null) return START_NOT_STICKY
        channels(this)
        // Android needs the notification showing before screen capture can start
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, runningNote(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        else startForeground(ID_RUN, runningNote())
        try { begin(code, data) } catch (e: Exception) {
            TrackerLog.add("Couldn't start tracking: ${e.message}")
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun begin(code: Int, data: Intent) {
        rules = Rules.load(this)
        usage = Usage.Tracker(this)
        val mpm = getSystemService(MediaProjectionManager::class.java)
        val mp = mpm.getMediaProjection(code, data) ?: throw IllegalStateException("no permission")
        projection = mp
        thread = HandlerThread("tracker").also { it.start() }
        handler = Handler(thread!!.looper)
        mp.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { stopSelf() }
        }, handler)
        val m = resources.displayMetrics
        width = (m.widthPixels * rules.scale).toInt().coerceAtLeast(240)
        height = (m.heightPixels * rules.scale).toInt().coerceAtLeast(400)
        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        display = mp.createVirtualDisplay("SNAP Stat tracker", width, height, m.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, handler)
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        running = true
        TrackerLog.add("Tracking started (${width}x$height, every ${rules.intervalMs} ms)")
        onState?.invoke()
        handler?.postDelayed(::tick, rules.intervalMs)
    }

    private fun grab(): Bitmap? {
        val img = reader?.acquireLatestImage() ?: return null
        return try {
            val plane = img.planes[0]
            val pixelStride = plane.pixelStride
            val rowPadding = plane.rowStride - pixelStride * img.width
            val wide = Bitmap.createBitmap(img.width + rowPadding / pixelStride, img.height, Bitmap.Config.ARGB_8888)
            wide.copyPixelsFromBuffer(plane.buffer)
            if (rowPadding == 0) wide else Bitmap.createBitmap(wide, 0, 0, img.width, img.height).also { wide.recycle() }
        } finally { img.close() }
    }

    private fun tick() {
        val h = handler ?: return
        h.postDelayed(::tick, rules.intervalMs)
        if (busy) return
        val now = System.currentTimeMillis()
        val front = usage.update()
        // Only look while the game is in front (when usage access is on; otherwise always)
        if (rules.onlyInSnap && front != null && front != ShotQueue.SNAP_PACKAGE) { reader?.acquireLatestImage()?.close(); hits = 0; return }
        if (now < cooldownUntil) { reader?.acquireLatestImage()?.close(); return }
        val bmp = grab() ?: return
        busy = true
        recognizer?.process(InputImage.fromBitmap(bmp, 0))
            ?.addOnSuccessListener { result ->
                h.post { look(result.text, bmp) }
            }
            ?.addOnFailureListener { e ->
                h.post { TrackerLog.add("Text reading failed: ${e.message}"); bmp.recycle(); busy = false }
            }
            ?: run { bmp.recycle(); busy = false }
    }

    private fun look(text: String, bmp: Bitmap) {
        try {
            val flat = text.replace(Regex("\\s+"), " ").trim()
            val match = rules.matches(flat)
            // Note the screen's words whenever they change, for tuning the rules
            if (flat.isNotEmpty() && similarity(flat, lastText) < 0.6) { TrackerLog.add("${if (match) "END" else "saw"}: $flat"); lastText = flat }
            hits = if (match) hits + 1 else 0
            if (hits >= rules.frames) {
                hits = 0
                cooldownUntil = System.currentTimeMillis() + rules.cooldownSec * 1000L
                if (ShotQueue.addBitmap(this, bmp, System.currentTimeMillis(), "tracker")) {
                    captured++
                    TrackerLog.add("Saved the end of a match")
                    notifyCaptured()
                    onQueued?.invoke()
                }
            }
        } finally {
            bmp.recycle(); busy = false
        }
    }

    private fun similarity(a: String, b: String): Double {
        if (a.isEmpty() || b.isEmpty()) return 0.0
        val wa = a.lowercase().split(" ").toSet(); val wb = b.lowercase().split(" ").toSet()
        return wa.intersect(wb).size.toDouble() / maxOf(1, wa.union(wb).size)
    }

    private fun notifyCaptured() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(ID_RUN, runningNote())
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH_DONE) else @Suppress("DEPRECATION") Notification.Builder(this)
        nm.notify(ID_DONE, b.setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Match saved")
            .setContentText("Open SNAP Stat to log ${if (captured == 1) "it" else "your $captured matches"}.")
            .setAutoCancel(true)
            .setContentIntent(openApp())
            .build())
    }

    override fun onDestroy() {
        running = false
        handler?.removeCallbacksAndMessages(null)
        try { display?.release() } catch (_: Exception) {}
        try { reader?.close() } catch (_: Exception) {}
        try { projection?.stop() } catch (_: Exception) {}
        try { recognizer?.close() } catch (_: Exception) {}
        thread?.quitSafely()
        display = null; reader = null; projection = null; recognizer = null
        TrackerLog.add("Tracking stopped")
        onState?.invoke()
        super.onDestroy()
    }
}
