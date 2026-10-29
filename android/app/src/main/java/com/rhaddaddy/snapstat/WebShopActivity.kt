package com.rhaddaddy.snapstat

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject

/**
 * MARVEL SNAP's web shop, opened inside SNAP Stat so your Web Points and claimed rewards can be kept up to date.
 *
 * What it reads, and only on shop.marvelsnap.com: the shop's own catalog (the same list anyone can see), with your
 * Web Points, which Web Points rewards you've claimed and how many of today's free rewards are left. It never reads
 * the page's text, what you type, or anything on the sign-in or payment pages, and whether you're signed in is
 * checked without looking at your account details. Everything else is dropped before it's saved (see [clean]).
 */
class WebShopActivity : Activity() {
    companion object {
        const val SHOP = "https://shop.marvelsnap.com/"
        private const val HOST = "shop.marvelsnap.com"
        private val SAFE_TEXT = Regex("[^A-Za-z0-9 '&.+-]")
        // Runs inside the shop's page: asks the shop for its catalog, the same way the page itself does
        private const val READ = """(function(){
  if (location.host !== 'shop.marvelsnap.com' || !window.SnapStatShop) return;
  var me = fetch('/api/auth/me', {credentials: 'include'}).then(function(r){ return r.ok; }).catch(function(){ return false; });
  var cat = fetch('/api/catalog?lang=en', {credentials: 'include'}).then(function(r){ return r.json(); });
  Promise.all([me, cat]).then(function(a){
    var j = a[1] || {};
    SnapStatShop.got(JSON.stringify({ loggedIn: a[0], webPoints: j.webPoints,
      chains: (j.rewardChains || []).map(function(c){ return { id: c.id, steps: (c.steps || []).map(function(s){ return { id: s.id, claimed: !!s.isClaimed }; }) }; }),
      free: (j.offers || []).filter(function(o){ return o.isFree; }).map(function(o){ return { key: o.offerKey, name: o.name, available: o.available }; }) }));
  }).catch(function(){});
})();"""
    }

    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private var lastSaved = ""
    private val again = object : Runnable { override fun run() { read(); main.postDelayed(this, 20_000) } }

    private fun isShop(url: String?): Boolean = try { Uri.parse(url ?: "").host == HOST } catch (e: Exception) { false }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        TrackerLog.attach(applicationContext)
        val dp = resources.displayMetrics.density
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#14112B")); setPadding((12 * dp).toInt(), (8 * dp).toInt(), (8 * dp).toInt(), (8 * dp).toInt())
        }
        val title = TextView(this).apply { text = "Web shop"; setTextColor(Color.WHITE); textSize = 17f }
        bar.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this).apply { text = "Open in Chrome"; isAllCaps = false; setOnClickListener {
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(if (isShop(web.url)) web.url else SHOP))) } catch (_: Exception) {}
        } })
        bar.addView(Button(this).apply { text = "Done"; isAllCaps = false; setOnClickListener { finish() } })
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(ShopBridge(), "SnapStatShop")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) { if (isShop(url)) main.postDelayed({ read() }, 2500) }
            override fun shouldOverrideUrlLoading(view: WebView?, req: WebResourceRequest?): Boolean {
                val u = req?.url ?: return false
                if (u.scheme == "https" || u.scheme == "http") return false
                // Links to other apps (a payment app, mail) open outside
                try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: Exception) {}
                return true
            }
        }
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        web.loadUrl(SHOP)
        main.postDelayed(again, 20_000)
    }

    private fun read() { if (::web.isInitialized && isShop(web.url)) web.evaluateJavascript(READ, null) }

    inner class ShopBridge {
        @JavascriptInterface fun got(json: String) { main.post { keep(json) } }
    }

    private fun keep(json: String) {
        if (!isShop(web.url)) return
        val c = clean(json) ?: return
        val sig = c.optInt("webPoints").toString() + c.optJSONArray("chains").toString() + c.optJSONArray("free").toString()
        if (sig == lastSaved) return
        lastSaved = sig
        c.put("at", System.currentTimeMillis())
        if (ShotQueue.addJson(this, c.toString(), "webshop")) TrackerLog.add("Web shop: saved your Web Points and rewards")
    }

    /** Keeps only numbers, yes/no values and short plain names; anything else is dropped. */
    private fun clean(json: String): JSONObject? = try {
        val j = JSONObject(json)
        if (!j.optBoolean("loggedIn", false)) null else {
            val out = JSONObject().put("loggedIn", true).put("webPoints", j.optInt("webPoints", 0).coerceIn(0, 10_000_000))
            val chains = JSONArray()
            val cs = j.optJSONArray("chains") ?: JSONArray()
            for (i in 0 until minOf(cs.length(), 4)) {
                val c = cs.optJSONObject(i) ?: continue
                val steps = JSONArray(); val ss = c.optJSONArray("steps") ?: JSONArray()
                for (k in 0 until minOf(ss.length(), 40)) { val s = ss.optJSONObject(k) ?: continue; steps.put(JSONObject().put("id", s.optInt("id")).put("claimed", s.optBoolean("claimed"))) }
                chains.put(JSONObject().put("id", c.optString("id").filter { it.isDigit() }.take(12)).put("steps", steps))
            }
            val free = JSONArray(); val fs = j.optJSONArray("free") ?: JSONArray()
            for (i in 0 until minOf(fs.length(), 10)) { val f = fs.optJSONObject(i) ?: continue
                free.put(JSONObject().put("key", f.optString("key").filter { it.isLetterOrDigit() || it == '_' }.take(40)).put("name", f.optString("name").replace(SAFE_TEXT, "").take(40)).put("available", f.optInt("available", -1))) }
            out.put("chains", chains).put("free", free)
        }
    } catch (e: Exception) { null }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed() }

    override fun onPause() { read(); CookieManager.getInstance().flush(); super.onPause() }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        try { web.destroy() } catch (_: Exception) {}
        super.onDestroy()
    }
}
