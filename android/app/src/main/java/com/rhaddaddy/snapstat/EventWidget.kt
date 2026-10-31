package com.rhaddaddy.snapstat

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

/**
 * A small second widget just for the event that's on: its name and a live countdown to its end. It reads the same
 * "event" the main widget shows (sent by the web app with the rest of the widget's data).
 */
class EventWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { EventWidgets.refresh(ctx) }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, opts: android.os.Bundle) { EventWidgets.refresh(ctx) }
}

object EventWidgets {
    fun refresh(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = try { mgr.getAppWidgetIds(ComponentName(ctx, EventWidget::class.java)) } catch (e: Exception) { IntArray(0) }
        if (ids.isEmpty()) return
        val f = File(ctx.filesDir, "widget.json")
        val j = try { if (f.exists()) JSONObject(f.readText()) else JSONObject() } catch (e: Exception) { JSONObject() }
        val now = System.currentTimeMillis()
        val v = RemoteViews(ctx.packageName, R.layout.widget_event)
        val ev = j.optJSONObject("event")
        val end = ev?.optLong("endTs") ?: 0L
        if (ev != null && ev.optString("name").isNotEmpty() && end > now) {
            v.setTextViewText(R.id.e_name, ev.optString("name"))
            v.setChronometer(R.id.e_count, SystemClock.elapsedRealtime() + (end - now), null, true)
            v.setChronometerCountDown(R.id.e_count, true)
            v.setViewVisibility(R.id.e_count, View.VISIBLE)
            val lv = ev.optInt("level")
            v.setTextViewText(R.id.e_sub, if (lv > 0) "ends in · level $lv" else "ends in")
        } else {
            v.setTextViewText(R.id.e_name, "No event on right now")
            v.setViewVisibility(R.id.e_count, View.GONE)
            v.setTextViewText(R.id.e_sub, "Open SNAP Stat to update")
        }
        // The app's accent for the countdown
        val accent = try { Color.parseColor(j.optJSONObject("look")?.optString("text")?.ifBlank { null } ?: "#FFC53D") } catch (e: Exception) { Color.parseColor("#FFC53D") }
        v.setTextColor(R.id.e_count, accent)
        val i = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", "#home/events")
        v.setOnClickPendingIntent(R.id.e_root, PendingIntent.getActivity(ctx, 41, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        for (id in ids) try { mgr.updateAppWidget(id, v) } catch (e: Exception) { TrackerLog.add("Event widget update failed: ${e.message}") }
    }
}
