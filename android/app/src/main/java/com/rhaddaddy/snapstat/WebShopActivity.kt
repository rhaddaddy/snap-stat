package com.rhaddaddy.snapstat

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * MARVEL SNAP's web shop, opened inside SNAP Stat so your Web Points and claimed rewards can be kept up to date.
 *
 * What it reads, and only on shop.marvelsnap.com: the shop's own catalog (the same list anyone can see), with your
 * Web Points, which Web Points rewards you've claimed and how many of today's free rewards are left. It never reads
 * the page's text, what you type, or anything on the sign-in or payment pages, and whether you're signed in is
 * checked without looking at your account details. Everything else is dropped before it's saved (see [clean]).
 *
 * Signing in: the shop's "Sign in with Google" opens Google in a pop-up window that hands the result back to the shop
 * page and closes itself. A WebView can't do that on its own (Google's page used to replace the shop and end on a blank
 * white page), so pop-ups open here as a second window over the shop ([onCreateWindow]) and close when they're done.
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
  var cat = fetch('/api/catalog?lang=en', {credentials: 'include'}).then(function(r){ return r.ok ? r.json() : null; });
  Promise.all([me, cat]).then(function(a){
    var j = a[1];
    if (!j || typeof j.webPoints !== 'number') return;
    SnapStatShop.got(JSON.stringify({ loggedIn: a[0], webPoints: j.webPoints,
      chains: (j.rewardChains || []).map(function(c){ return { id: c.id, steps: (c.steps || []).map(function(s){ return { id: s.id, claimed: !!s.isClaimed }; }) }; }),
      free: (j.offers || []).filter(function(o){ return o.isFree; }).map(function(o){ return { key: o.offerKey, name: o.name, available: o.available }; }) }));
  }).catch(function(){});
})();"""
    }

    private lateinit var web: WebView
    private lateinit var frame: FrameLayout
    private lateinit var title: TextView
    private var popup: WebView? = null
    private var popupLeftShop = false
    private val main = Handler(Looper.getMainLooper())
    private var lastSaved = ""
    private val again = object : Runnable { override fun run() { read(); main.postDelayed(this, 20_000) } }

    private fun isShop(url: String?): Boolean = try { Uri.parse(url ?: "").host == HOST } catch (e: Exception) { false }

    /** Links to other apps (a payment app, mail, a Google app) open outside; web pages stay in the window. */
    private fun openOutside(u: Uri?): Boolean {
        if (u == null || u.scheme == "https" || u.scheme == "http") return false
        try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: Exception) {}
        return true
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        TrackerLog.attach(applicationContext)
        val dp = resources.displayMetrics.density
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#14112B")); setPadding((12 * dp).toInt(), (8 * dp).toInt(), (8 * dp).toInt(), (8 * dp).toInt())
        }
        title = TextView(this).apply { text = "Web shop"; setTextColor(Color.WHITE); textSize = 17f }
        bar.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this).apply { text = "Open in Chrome"; isAllCaps = false; setOnClickListener {
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(if (isShop(web.url)) web.url else SHOP))) } catch (_: Exception) {}
        } })
        bar.addView(Button(this).apply { text = "Done"; isAllCaps = false; setOnClickListener { finish() } })
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        // Sign-in pop-ups get their own window (see onCreateWindow) instead of replacing the shop
        web.settings.setSupportMultipleWindows(true)
        web.settings.javaScriptCanOpenWindowsAutomatically = true
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(ShopBridge(), "SnapStatShop")
        web.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                val msg = resultMsg ?: return false
                val transport = msg.obj as? WebView.WebViewTransport ?: return false
                transport.webView = openPopup()
                msg.sendToTarget()
                return true
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) { if (isShop(url)) main.postDelayed({ read() }, 2500) }
            override fun shouldOverrideUrlLoading(view: WebView?, req: WebResourceRequest?): Boolean = openOutside(req?.url)
        }
        frame = FrameLayout(this)
        frame.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(frame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        // Keep the title bar and the page clear of the status bar, the camera cutout and the navigation bar
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        web.loadUrl(SHOP)
    }

    private fun read() { if (::web.isInitialized && isShop(web.url)) web.evaluateJavascript(READ, null) }

    /**
     * A window the shop page opened (Google's sign-in), shown over the shop. It keeps its link back to the shop page,
     * so Google can hand over the sign-in and close it. It never gets the SnapStatShop bridge, so nothing is read from it.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun openPopup(): WebView {
        closePopup(false)
        val pop = WebView(this)
        pop.settings.javaScriptEnabled = true
        pop.settings.domStorageEnabled = true
        pop.settings.javaScriptCanOpenWindowsAutomatically = true
        CookieManager.getInstance().setAcceptThirdPartyCookies(pop, true)
        pop.setBackgroundColor(Color.parseColor("#14112B"))
        popupLeftShop = false
        pop.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, req: WebResourceRequest?): Boolean = openOutside(req?.url)
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                if (url != null && url.startsWith("http") && !isShop(url)) popupLeftShop = true
                val host = try { Uri.parse(url ?: "").host ?: "" } catch (e: Exception) { "" }
                if (popup === view) title.text = if (host.startsWith("accounts.") || host.startsWith("appleid.")) "Sign in" else "Web shop"
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                // A sign-in that ends on the shop's own page inside the pop-up instead of closing it: close it and
                // reload the shop, which is signed in by then
                if (isShop(url) && popupLeftShop) main.postDelayed({
                    if (popup === view && isShop(view?.url)) { closePopup(); web.reload() }
                }, 4000)
            }
        }
        pop.webChromeClient = object : WebChromeClient() {
            override fun onCloseWindow(window: WebView?) { if (popup === window) closePopup() }
        }
        frame.addView(pop, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        popup = pop
        TrackerLog.add("Web shop: opened a pop-up window (sign-in)")
        return pop
    }

    /** Takes the pop-up away; then checks the shop again, since you're usually signed in by now. */
    private fun closePopup(readAfter: Boolean = true) {
        val p = popup ?: return
        popup = null
        frame.removeView(p)
        title.text = "Web shop"
        main.post { try { p.stopLoading(); p.destroy() } catch (_: Exception) {} }
        if (readAfter) main.postDelayed({ read() }, 2500)
    }

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
        // Only a real answer from the shop (an error page or a changed format would have wiped your saved progress)
        if (!j.optBoolean("loggedIn", false) || j.opt("webPoints") !is Number) null else {
            val out = JSONObject().put("loggedIn", true).put("webPoints", j.optInt("webPoints", 0).coerceIn(0, 10_000_000))
            val chains = JSONArray()
            val cs = j.optJSONArray("chains") ?: JSONArray()
            for (i in 0 until minOf(cs.length(), 4)) {
                val c = cs.optJSONObject(i) ?: continue
                val steps = JSONArray(); val ss = c.optJSONArray("steps") ?: JSONArray()
                for (k in 0 until minOf(ss.length(), 40)) { val s = ss.optJSONObject(k) ?: continue; steps.put(JSONObject().put("id", s.opt("id")?.toString()?.filter { it.isLetterOrDigit() || it == '-' || it == '_' }?.take(24) ?: "").put("claimed", s.optBoolean("claimed"))) }
                chains.put(JSONObject().put("id", c.optString("id").filter { it.isDigit() }.take(12)).put("steps", steps))
            }
            val free = JSONArray(); val fs = j.optJSONArray("free") ?: JSONArray()
            for (i in 0 until minOf(fs.length(), 10)) { val f = fs.optJSONObject(i) ?: continue
                free.put(JSONObject().put("key", f.optString("key").filter { it.isLetterOrDigit() || it == '_' }.take(40)).put("name", f.optString("name").replace(SAFE_TEXT, "").take(40)).put("available", f.optInt("available", -1))) }
            out.put("chains", chains).put("free", free)
        }
    } catch (e: Exception) { null }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        val p = popup
        if (p != null) { if (p.canGoBack()) p.goBack() else closePopup() }
        else if (web.canGoBack()) web.goBack()
        else super.onBackPressed()
    }

    // Checks every 20 seconds only while the shop is on screen (it kept going in the background before)
    override fun onResume() { super.onResume(); web.onResume(); popup?.onResume(); main.removeCallbacks(again); main.postDelayed(again, 20_000) }
    override fun onPause() { read(); main.removeCallbacks(again); popup?.onPause(); web.onPause(); CookieManager.getInstance().flush(); super.onPause() }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        try { popup?.destroy() } catch (_: Exception) {}
        popup = null
        try { web.destroy() } catch (_: Exception) {}
        super.onDestroy()
    }
}
