package com.rhaddaddy.snapstat

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * The "SNAP tracker" tile in Quick Settings: starts and stops the match tracker. Stopping happens right away.
 * Starting needs Android's screen-recording permission, which only an open app can ask for, so the tile opens
 * SNAP Stat with the same "trackPlay" extra as the widget's Track & play button: SNAP Stat asks, starts tracking,
 * then opens MARVEL SNAP.
 */
class TrackerTile : TileService() {
    companion object {
        /** Asks Android to redraw the tile, when tracking starts or stops somewhere else. */
        fun refresh(ctx: Context) {
            try { TileService.requestListeningState(ctx, ComponentName(ctx, TrackerTile::class.java)) } catch (_: Exception) {}
        }
    }

    override fun onStartListening() {
        super.onStartListening()
        show(TrackerService.running)
    }

    override fun onClick() {
        super.onClick()
        TrackerLog.attach(applicationContext)
        if (TrackerService.running) {
            try { TrackerService.stop(this) } catch (e: Exception) { TrackerLog.add("The tile couldn't stop the tracker: ${e.message}") }
            show(false)
            return
        }
        if (isLocked) unlockAndRun { openToStart() } else openToStart()
    }

    private fun openToStart() {
        val i = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("trackPlay", true)
        try {
            // Android 14 and later only take a PendingIntent here (the Intent version throws)
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, 18, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            } else {
                @Suppress("DEPRECATION") startActivityAndCollapse(i)
            }
        } catch (e: Exception) { TrackerLog.add("The tile couldn't open SNAP Stat: ${e.message}") }
    }

    private fun show(on: Boolean) {
        val t = qsTile ?: return
        t.state = if (on) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        t.label = getString(R.string.tile_label)
        t.icon = Icon.createWithResource(this, R.drawable.ic_notify)
        if (Build.VERSION.SDK_INT >= 29) t.subtitle = if (on) "Tracking" else "Off"
        t.updateTile()
    }
}
