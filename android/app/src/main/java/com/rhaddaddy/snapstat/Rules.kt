package com.rhaddaddy.snapstat

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * How the tracker spots the end of a match, from tracker-rules.json on the SNAP Stat website.
 * The web app passes the newest copy in, so these can be tuned without a new app.
 *
 * A frame counts as the end of a match when its text contains every word of any one "end" group,
 * and none of the "not" words. It has to match on [frames] checks in a row, and after a capture
 * the tracker waits [cooldownSec] seconds before the next one.
 */
data class Rules(
    val intervalMs: Long = 1500,
    val scale: Float = 0.6f,
    val frames: Int = 2,
    val cooldownSec: Int = 45,
    val onlyInSnap: Boolean = true,
    val end: List<List<String>> = listOf(
        listOf("victory"), listOf("defeat"), listOf("you won"), listOf("you lost"), listOf("escaped"),
        listOf("retreated"), listOf("cubes", "collect"), listOf("cubes", "next"), listOf("cubes", "continue")
    ),
    val not: List<String> = emptyList(),
) {
    fun matches(text: String): Boolean {
        val t = text.lowercase()
        if (not.any { it.isNotBlank() && t.contains(it) }) return false
        return end.any { group -> group.isNotEmpty() && group.all { t.contains(it) } }
    }

    companion object {
        private const val KEY = "trackerRules"

        fun load(ctx: Context): Rules = parse(ctx.getSharedPreferences("snapstat", 0).getString(KEY, null)) ?: Rules()

        fun save(ctx: Context, json: String): Boolean {
            if (parse(json) == null) return false
            ctx.getSharedPreferences("snapstat", 0).edit().putString(KEY, json).apply()
            return true
        }

        private fun words(a: JSONArray?): List<String> =
            if (a == null) emptyList() else (0 until a.length()).map { a.optString(it).lowercase().trim() }.filter { it.isNotEmpty() }

        fun parse(json: String?): Rules? {
            if (json.isNullOrBlank()) return null
            return try {
                val j = JSONObject(json)
                val d = Rules()
                val endA = j.optJSONArray("end")
                Rules(
                    intervalMs = j.optLong("intervalMs", d.intervalMs).coerceIn(500, 10_000),
                    scale = j.optDouble("scale", d.scale.toDouble()).toFloat().coerceIn(0.25f, 1f),
                    frames = j.optInt("frames", d.frames).coerceIn(1, 5),
                    cooldownSec = j.optInt("cooldownSec", d.cooldownSec).coerceIn(5, 600),
                    onlyInSnap = j.optBoolean("onlyInSnap", d.onlyInSnap),
                    end = if (endA == null) d.end else (0 until endA.length()).map { i ->
                        val g = endA.opt(i)
                        if (g is JSONArray) words(g) else listOf(g.toString().lowercase().trim())
                    }.filter { it.isNotEmpty() },
                    not = if (j.has("not")) words(j.optJSONArray("not")) else d.not,
                )
            } catch (e: Exception) {
                null
            }
        }
    }
}
