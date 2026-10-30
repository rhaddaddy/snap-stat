package com.rhaddaddy.snapstat

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import kotlin.concurrent.thread

/** SNAP Stat's website in a full-screen window, with the Android-only extras wired in through [Bridge]. */
class MainActivity : ComponentActivity() {
    companion object {
        const val HOME = "https://rhaddaddy.github.io/snap-stat/"
        const val SIGN_IN_URL = HOME + "native-signin.html"
        private const val HOST = "rhaddaddy.github.io"
        private const val PATH = "/snap-stat"
    }

    private lateinit var web: WebView
    private lateinit var bridge: Bridge
    private var pageIsReady = false
    private val pending = mutableListOf<Pair<String, String>>()
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val cb = fileCallback ?: return@registerForActivityResult
        fileCallback = null
        val data = r.data
        if (r.resultCode != RESULT_OK || data == null) { cb.onReceiveValue(null); return@registerForActivityResult }
        val clip = data.clipData
        val uris = if (clip != null && clip.itemCount > 0) Array(clip.itemCount) { clip.getItemAt(it).uri } else data.data?.let { arrayOf(it) }
        cb.onReceiveValue(uris)
    }

    private val photosAsk = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        emit("perm", bridge.info())
        if (ok) scanScreenshots()
    }

    private val notifyAsk = registerForActivityResult(ActivityResultContracts.RequestPermission()) { emit("perm", bridge.info()) }

    private val notifyThenTrack = registerForActivityResult(ActivityResultContracts.RequestPermission()) { askScreenCapture() }

    private val captureAsk = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val data = r.data
        if (r.resultCode == RESULT_OK && data != null) {
            TrackerService.start(this, r.resultCode, data)
            if (playAfterStart) { playAfterStart = false; window.decorView.postDelayed({ playNow() }, 700) }
        } else { playAfterStart = false; TrackerLog.add("Screen capture wasn't allowed") }
        emit("tracker", bridge.info())
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        TrackerService.channels(this)
        TrackerLog.attach(applicationContext)
        Alerts.channel(this)
        ResetClock.schedule(this); Widget.refresh(this)
        bridge = Bridge(this)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0A0918")) }
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        // Keep the page clear of the status bar, navigation bar and keyboard
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString SnapStatAndroid/${bridge.version()}"
        }
        web.setBackgroundColor(Color.parseColor("#0A0918"))
        web.addJavascriptInterface(bridge, "SnapStatNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = route(request.url)
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) { pageIsReady = false }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = cb
                val i = params.createIntent()
                if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                return try { pickFiles.launch(i); true } catch (e: Exception) { fileCallback = null; false }
            }
        }
        web.setDownloadListener { url, _, _, _, _ -> if (url.startsWith("https://")) openExternal(url) }

        TrackerService.onQueued = { runOnUiThread { emit("queue", ShotQueue.count(this).toString()) } }
        TrackerService.onState = { runOnUiThread { emit("tracker", bridge.info()) } }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Let the page close an open panel first, then go back a page, then leave
                web.evaluateJavascript("(window.snapNative && window.snapNative.back) ? window.snapNative.back() : false") { r ->
                    if (r == "true") return@evaluateJavascript
                    if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        if (web.url == null) web.loadUrl(HOME)
        if (savedInstanceState == null) handleIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        emit("resume", bridge.info())
        scanScreenshots()
        checkUpdate(false)
    }

    /** Looks for a newer version of the app on GitHub each time the app opens (at most once a minute unless asked). */
    fun checkUpdate(now: Boolean) {
        if (!now && System.currentTimeMillis() - Updater.lastCheck(this) < 60_000L) return
        thread {
            val r = Updater.check(applicationContext)
            runOnUiThread { emit("update", r.put("canInstall", Updater.canInstall(this)).toString()) }
        }
    }

    override fun onDestroy() {
        TrackerService.onQueued = null
        TrackerService.onState = null
        super.onDestroy()
    }

    /** Pages of SNAP Stat stay in the app; everything else opens in the browser. */
    private fun route(uri: Uri): Boolean {
        val scheme = uri.scheme ?: ""
        if (scheme == "https" && uri.host == HOST && (uri.path ?: "").startsWith(PATH) && !(uri.path ?: "").endsWith("native-signin.html")) return false
        if (scheme == "https" && uri.host == HOST && (uri.path ?: "").endsWith("native-signin.html")) { startSignIn(); return true }
        if (scheme == "http" || scheme == "https") { openExternal(uri.toString()); return true }
        try {
            val i = if (scheme == "intent") Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME) else Intent(Intent.ACTION_VIEW, uri)
            i.addCategory(Intent.CATEGORY_BROWSABLE); i.component = null; i.selector = null
            startActivity(i)
        } catch (_: Exception) {}
        return true
    }

    fun openExternal(url: String) {
        try { CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, Uri.parse(url)) }
        catch (e: Exception) { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {} }
    }

    /**
     * Starts Google sign-in in Chrome with a one-time code. The sign-in that comes back is only used if it carries the
     * same code and arrives within 10 minutes, so a sign-in link from anywhere else (a post, another app) can't switch
     * SNAP Stat to someone else's account.
     */
    fun startSignIn() {
        val b = ByteArray(16); java.security.SecureRandom().nextBytes(b)
        val state = b.joinToString("") { "%02x".format(it) }
        getSharedPreferences("snapstat", 0).edit().putString("signinState", state).putLong("signinAt", System.currentTimeMillis()).apply()
        openInChrome("$SIGN_IN_URL?state=$state")
    }
    private fun signInOk(state: String?): Boolean {
        val p = getSharedPreferences("snapstat", 0)
        val want = p.getString("signinState", "") ?: ""; val at = p.getLong("signinAt", 0L)
        val ok = want.isNotEmpty() && state == want && System.currentTimeMillis() - at < 10 * 60_000L
        if (ok) p.edit().remove("signinState").remove("signinAt").apply()
        return ok
    }

    /** Google sign-in runs in Chrome (Google doesn't allow it inside apps' web views), then comes back here. */
    fun openInChrome(url: String) {
        val i = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        val chrome = try { packageManager.getPackageInfo("com.android.chrome", 0); true } catch (e: Exception) { false }
        if (chrome) i.setPackage("com.android.chrome")
        try { startActivity(i) } catch (e: Exception) { i.setPackage(null); try { startActivity(i) } catch (_: Exception) {} }
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return
        // A tapped notification: open that part of the app
        intent.getStringExtra("route")?.let { r ->
            if (r.startsWith("#")) emit("route", JSONObject.quote(r))
            intent.removeExtra("route")
        }
        // The widget's Track & play button
        if (intent.getBooleanExtra("trackPlay", false)) {
            intent.removeExtra("trackPlay")
            window.decorView.postDelayed({ trackAndPlay() }, 600)
        }
        val data = intent.data
        if (intent.action == Intent.ACTION_VIEW && data?.scheme == "snapstat" && data.host == "signin") {
            val token = data.getQueryParameter("token") ?: ""
            setIntent(Intent())
            if (signInOk(data.getQueryParameter("state"))) emit("signin", JSONObject.quote(token))
            else { TrackerLog.add("Ignored a sign-in this app didn't start"); emit("signin", "\"\"") } // the page shows "try again" instead of waiting forever
            return
        }
        if (intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE) {
            val uris = mutableListOf<Uri>()
            if (intent.action == Intent.ACTION_SEND) {
                val u: Uri? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
                u?.let { uris.add(it) }
            } else {
                val list: ArrayList<Uri>? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) else @Suppress("DEPRECATION") intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
                list?.let { uris.addAll(it) }
            }
            val type = intent.type
            setIntent(Intent())
            // Only files another app shares (content links), never the app's own files or a raw file path
            val mine = "$packageName.files"
            uris.retainAll { it.scheme == "content" && it.authority != mine }
            thread {
                var n = 0
                for (u in uris.take(20)) {
                    val mime = contentResolver.getType(u) ?: type
                    if (ShotQueue.addUri(this, u, System.currentTimeMillis(), "share", mime)) n++
                }
                if (n > 0) runOnUiThread { emit("queue", ShotQueue.count(this).toString()) }
            }
        }
    }

    /** Sends an event to the page. [json] must be valid JSON. Waits if the page is still loading. */
    fun emit(type: String, json: String) {
        if (!::web.isInitialized) return
        if (!pageIsReady) { pending.add(type to json); return }
        web.evaluateJavascript("window.snapNative && window.snapNative.on(${JSONObject.quote(type)}, $json)", null)
    }

    fun pageReady() {
        pageIsReady = true
        val waiting = pending.toList(); pending.clear()
        waiting.forEach { (t, j) -> emit(t, j) }
        if (ShotQueue.count(this) > 0) emit("queue", ShotQueue.count(this).toString())
    }

    fun scanScreenshots() {
        thread {
            val n = Screenshots.scan(applicationContext)
            if (n > 0) runOnUiThread { emit("queue", ShotQueue.count(this).toString()) }
        }
    }

    /** Opens Android's installer for a downloaded update, with a notification to tap as a backup. */
    fun installApk(f: java.io.File) {
        try { Updater.notifyReady(this, f) } catch (e: Exception) { TrackerLog.add("Update notification failed: ${e.message}") }
        try {
            startActivity(Updater.installIntent(this, f))
            TrackerLog.add("Opened the installer")
            emit("update-installing", JSONObject.quote(""))
        } catch (e: Exception) {
            TrackerLog.add("Couldn't open the installer: ${e.message}")
            emit("update-error", JSONObject.quote("Android didn't open the installer. Tap the SNAP Stat update notification instead."))
        }
    }

    fun askPhotos() { photosAsk.launch(Screenshots.photoPermission()) }

    fun askNotify() {
        if (Build.VERSION.SDK_INT >= 33) notifyAsk.launch(Manifest.permission.POST_NOTIFICATIONS) else emit("perm", bridge.info())
    }

    /** Set by "Track & play": open MARVEL SNAP as soon as tracking has started. */
    var playAfterStart = false

    fun openSnapGame(): Boolean {
        val i = packageManager.getLaunchIntentForPackage(ShotQueue.SNAP_PACKAGE) ?: return false
        return try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true } catch (e: Exception) { false }
    }

    private fun playNow() {
        if (!openSnapGame()) android.widget.Toast.makeText(this, "Couldn't find MARVEL SNAP on this phone. Tracking is on, so open the game yourself.", android.widget.Toast.LENGTH_LONG).show()
    }

    /** Starts tracking (asking for screen capture if needed), then opens MARVEL SNAP. */
    fun trackAndPlay() {
        if (TrackerService.running) { playNow(); return }
        playAfterStart = true
        startTracker()
    }

    fun startTracker() {
        if (TrackerService.running) { emit("tracker", bridge.info()); return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifyThenTrack.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else askScreenCapture()
    }

    private fun askScreenCapture() {
        val mpm = getSystemService(MediaProjectionManager::class.java)
        try { captureAsk.launch(mpm.createScreenCaptureIntent()) } catch (e: Exception) { TrackerLog.add("Couldn't ask for screen capture: ${e.message}") }
    }
}
