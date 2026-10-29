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
        private const val ID_BOT = 3
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
    private var lastMode = ""
    private var lastModeAt = 0L
    private var width = 0
    private var height = 0
    // Other screens: when each kind was last saved, what it said then, and how many checks in a row it's been on screen
    private val screenLog = HashMap<String, ArrayDeque<Pair<Long, String>>>()
    private var screenKind = ""
    private var screenHits = 0
    private var shotsSaved = 0
    // The bot check: how long you wait for the opponent after ending each turn ("PLAYING...").
    // A bot ends its turns at once; a person usually takes a while on some of them.
    private var turnState = ""
    private var turnStart = 0L
    private var waitStart = 0L
    private var yourTime = 0L
    private var botFast = 0
    private var botSlow = 0
    private var botMaxWait = 0L
    private var botTold = false
    private var matchSeenAt = 0L
    private val playing = Regex("playing\\.{1,3}")

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
            .setContentText(if (captured == 0 && shotsSaved == 0) "Play MARVEL SNAP. Matches, your alliance, event passes and shops are saved as you go."
                else listOfNotNull(if (captured > 0) "$captured match${if (captured == 1) "" else "es"}" else null, if (shotsSaved > 0) "$shotsSaved screen${if (shotsSaved == 1) "" else "s"}" else null).joinToString(" and ") + " saved. Open SNAP Stat to update.")
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
        TrackerLog.attach(applicationContext)
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
        running = true; Widget.refresh(this)
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
            // Remember the last game mode or event the screen named (the main menu shows it before a match)
            if (!match && lastMode.isNotEmpty() && rules.resetsMode(flat)) { TrackerLog.add("Mode: back on the home screen"); lastMode = "" }
            if (!match) rules.modeIn(flat)?.let { if (it != lastMode) TrackerLog.add("Mode: $it"); lastMode = it; lastModeAt = System.currentTimeMillis() }
            // Note the screen's words whenever they change, for tuning the rules
            if (flat.isNotEmpty() && similarity(flat, lastText) < 0.6) { TrackerLog.add("${if (match) "END" else "saw"}: $flat"); lastText = flat }
            if (!match) watchTurns(flat.lowercase())
            hits = if (match) hits + 1 else 0
            if (!match) saveScreen(flat, bmp)
            if (hits >= rules.frames) {
                hits = 0
                cooldownUntil = System.currentTimeMillis() + rules.cooldownSec * 1000L
                val hint = if (System.currentTimeMillis() - lastModeAt < 20 * 60_000L) lastMode else ""
                val meta = if (botFast + botSlow > 0) org.json.JSONObject().put("bot", org.json.JSONObject().put("fast", botFast).put("slow", botSlow).put("maxWait", (botMaxWait / 1000).toInt()).put("told", botTold)).toString() else ""
                resetTurns()
                if (ShotQueue.addBitmap(this, bmp, System.currentTimeMillis(), "tracker", hint, meta)) {
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

    /**
     * An alliance, event pass, shop or other screen from [Rules.screens]: saved when it stays up for a moment and shows
     * something new. Scrolling a list or switching tabs counts as new, so each page gets saved, up to [Screen.maxPer]
     * pictures of that kind per [Screen.cooldownMin] minutes and no closer together than [Screen.minGapSec] seconds.
     */
    private fun saveScreen(flat: String, bmp: Bitmap) {
        val s = rules.screenIn(flat)
        if (s == null) { screenKind = ""; screenHits = 0; return }
        screenHits = if (s.kind == screenKind) screenHits + 1 else 1
        screenKind = s.kind
        if (screenHits < s.frames) return
        val now = System.currentTimeMillis()
        val log = screenLog.getOrPut(s.kind) { ArrayDeque() }
        while (log.isNotEmpty() && now - log.first().first > s.cooldownMin * 60_000L) log.removeFirst()
        if (log.isNotEmpty() && now - log.last().first < s.minGapSec * 1000L) return
        if (log.size >= s.maxPer) return
        if (log.any { similarity(flat, it.second) > s.same }) return  // that page was saved already
        log.addLast(now to flat); screenHits = 0
        if (ShotQueue.addBitmap(this, bmp, now, "tracker", "screen:" + s.kind)) {
            shotsSaved++
            TrackerLog.add("Saved the ${s.kind} screen (${log.size} of up to ${s.maxPer})")
            getSystemService(NotificationManager::class.java).notify(ID_RUN, runningNote())
            onQueued?.invoke()
        }
    }

    private fun resetTurns() { turnState = ""; turnStart = 0L; waitStart = 0L; yourTime = 0L; botFast = 0; botSlow = 0; botMaxWait = 0L; botTold = false }

    private fun watchTurns(t: String) {
        val now = System.currentTimeMillis()
        if (t.contains("searching for") || (matchSeenAt > 0 && now - matchSeenAt > 3 * 60_000L)) { if (botFast + botSlow > 0 || t.contains("searching for")) resetTurns(); matchSeenAt = 0L }
        val inMatch = t.contains("retreat") || t.contains("end turn") || playing.containsMatchIn(t)
        if (!inMatch) return
        matchSeenAt = now
        val state = if (playing.containsMatchIn(t)) "wait" else if (t.contains("end turn")) "turn" else return
        if (state == turnState) return
        if (state == "turn") {
            // The opponent finished: how long did you wait, on a turn you played quickly yourself?
            if (turnState == "wait" && waitStart > 0) {
                val w = now - waitStart
                // A long wait means a person was thinking; a short one only counts if you didn't take ages yourself
                if (w >= 12_000L) botSlow++ else if (w <= 6_000L && yourTime in 1..30_000L) botFast++
                botMaxWait = maxOf(botMaxWait, w)
            }
            turnStart = now
        } else {
            yourTime = if (turnStart > 0) now - turnStart else 0L
            waitStart = now
        }
        turnState = state
        if (!botTold && botFast >= 4 && botSlow == 0) { botTold = true; notifyBot() }
    }

    private fun notifyBot() {
        TrackerLog.add("Bot check: the opponent answered $botFast quick turns right away")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH_DONE) else @Suppress("DEPRECATION") Notification.Builder(this)
        getSystemService(NotificationManager::class.java).notify(ID_BOT, b.setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Your opponent might be a bot")
            .setContentText("They've answered every turn right away. SNAP Stat checks again when the match ends.")
            .setAutoCancel(true)
            .setTimeoutAfter(5 * 60_000L)
            .setContentIntent(openApp())
            .build())
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
        running = false; Widget.refresh(this)
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
