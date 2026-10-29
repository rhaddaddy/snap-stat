package com.rhaddaddy.snapstat

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process

/**
 * Which app was on screen at a given time, from Android's usage access.
 * Used so SNAP Stat only reads screenshots taken in MARVEL SNAP, and the tracker only looks while the game is open.
 */
object Usage {
    fun hasAccess(ctx: Context): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // 1 = an app came to the front (ACTIVITY_RESUMED), 2 = it went to the back (ACTIVITY_PAUSED), 23 = ACTIVITY_STOPPED
    private fun isStart(type: Int) = type == 1
    private fun isStop(type: Int) = type == 2 || type == 23

    /** The system bars and the screenshot toolbar, which come to the front for a moment over the app in use. */
    fun isOverlay(pkg: String?): Boolean {
        val p = pkg ?: return true
        return p == "com.android.systemui" || p.contains("smartcapture") || p.contains("screenshot") || p.contains("screencapture")
    }

    /** The app in front at time [at] (milliseconds), or null if it can't be told. */
    fun foregroundAt(ctx: Context, at: Long): String? {
        if (!hasAccess(ctx)) return null
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(at - 3 * 3600_000L, at + 1500) ?: return null
        var front: String? = null
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.timeStamp > at + 1500) break
            // The screenshot toolbar and the system bars come to the front for a moment; they aren't the app in use
            if (isStart(e.eventType) && !isOverlay(e.packageName)) front = e.packageName
            else if (isStop(e.eventType) && e.packageName == front && e.timeStamp < at - 1500) front = null
        }
        return front
    }

    /** Keeps track of the app in front cheaply by reading only the events since the last check. */
    class Tracker(private val ctx: Context) {
        private var since = System.currentTimeMillis() - 10 * 60_000L
        var front: String? = null
            private set

        fun update(): String? {
            if (!hasAccess(ctx)) return null
            val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(since, now) ?: return front
            val e = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(e)
                // The screenshot toolbar and the system bars come to the front for a moment; they aren't the app in use
                if (isStart(e.eventType) && !isOverlay(e.packageName)) front = e.packageName
                else if (isStop(e.eventType) && e.packageName == front) front = null
            }
            since = now
            return front
        }
    }
}
