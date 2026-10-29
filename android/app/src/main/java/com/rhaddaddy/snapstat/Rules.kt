package com.rhaddaddy.snapstat

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Screen text in a form that's easy to match: lowercase, without accents (the text reader sometimes reads "S" as "Ş"). */
fun plainText(text: String): String = java.text.Normalizer.normalize(text.lowercase(), java.text.Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")

/** Another screen worth saving while you play (your alliance, an event pass, a shop…), and how to spot it. It has to be up for [frames] checks in a row. */
data class Screen(val kind: String, val groups: List<List<String>>, val not: List<String>, val cooldownMin: Int, val frames: Int = 2,
                  /** Up to this many different pictures of it per [cooldownMin] minutes (each page of a list, each tab)… */
                  val maxPer: Int = 1,
                  /** …at least this many seconds apart… */
                  val minGapSec: Int = 4,
                  /** …and a page counts as already saved when this much of its text matches one that was. */
                  val same: Double = 0.85) {
    fun matches(t: String): Boolean = not.none { it.isNotBlank() && t.contains(it) } && groups.any { g -> g.isNotEmpty() && g.all { t.contains(it) } }
}

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
    /** Words that tell which game mode or event is on screen, like "conquest" or an event's name. */
    val modes: Map<String, List<String>> = emptyMap(),
    /** Other screens to save for SNAP Stat to read, each no more often than its cooldown. */
    val screens: List<Screen> = emptyList(),
    /** Screens whose words don't count for [modes], like the home screen, which lists every event that's on. */
    val modeNot: List<String> = emptyList(),
    /** Screens that mean the player left a mode (the home screen), so the last mode seen no longer applies. */
    val modeReset: List<String> = emptyList(),
) {
    fun resetsMode(text: String): Boolean { val t = plainText(text); return modeReset.any { it.isNotBlank() && t.contains(it) } }

    /** The kind of screen [text] shows, if it's one of [screens]. */
    fun screenIn(text: String): Screen? { val t = plainText(text); return screens.firstOrNull { it.matches(t) } }

    /** The mode whose words appear in [text], preferring the longest match. */
    fun modeIn(text: String): String? {
        val t = plainText(text)
        if (modeNot.any { it.isNotBlank() && t.contains(it) }) return null
        var best: String? = null; var bestLen = 0
        for ((name, words) in modes) for (w in words) if (w.length > bestLen && t.contains(w)) { best = name; bestLen = w.length }
        return best
    }

    fun matches(text: String): Boolean {
        val t = plainText(text)
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
            if (a == null) emptyList() else (0 until a.length()).map { plainText(a.optString(it)).trim() }.filter { it.isNotEmpty() }

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
                        if (g is JSONArray) words(g) else listOf(plainText(g.toString()).trim())
                    }.filter { it.isNotEmpty() },
                    not = if (j.has("not")) words(j.optJSONArray("not")) else d.not,
                    modes = j.optJSONObject("modes")?.let { m -> m.keys().asSequence().associateWith { words(m.optJSONArray(it)) }.filterValues { it.isNotEmpty() } } ?: d.modes,
                    screens = j.optJSONArray("screens")?.let { a -> (0 until a.length()).mapNotNull { i ->
                        val s = a.optJSONObject(i) ?: return@mapNotNull null
                        val kind = s.optString("kind").replace(Regex("[^A-Za-z0-9_-]"), "").take(24)
                        val any = s.optJSONArray("any")
                        val groups = if (any == null) emptyList() else (0 until any.length()).map { k -> val g = any.opt(k); if (g is JSONArray) words(g) else listOf(plainText(g.toString()).trim()) }.filter { it.isNotEmpty() }
                        if (kind.isEmpty() || groups.isEmpty()) null else Screen(kind, groups, words(s.optJSONArray("not")), s.optInt("cooldownMin", 20).coerceIn(2, 24 * 60), s.optInt("frames", 2).coerceIn(1, 5),
                            s.optInt("maxPer", 1).coerceIn(1, 40), s.optInt("minGapSec", 4).coerceIn(1, 600), s.optDouble("same", 0.85).coerceIn(0.3, 0.99))
                    } } ?: d.screens,
                    modeNot = if (j.has("modeNot")) words(j.optJSONArray("modeNot")) else d.modeNot,
                    modeReset = if (j.has("modeReset")) words(j.optJSONArray("modeReset")) else d.modeReset,
                )
            } catch (e: Exception) {
                null
            }
        }
    }
}
