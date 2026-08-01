package it.ricknewere.todohome

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import it.ricknewere.todohome.widget.ChoreWidgetProvider

/**
 * Thin native shell around the web app. The UI lives in the PWA so it stays
 * identical to the iPhone one; what the shell adds is the home screen widget
 * and the bridge that feeds it.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        root.addView(web)
        setContentView(root)

        // Android 15 draws edge to edge, so the shell has to keep the page out
        // from under the status and navigation bars itself. The keyboard is in
        // there too: without it the WebView keeps its full height and the
        // keyboard sits on top of whatever field is being typed into.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Lets the page tell that it is running inside the wrapper.
            userAgentString = "$userAgentString ToDoHomeAndroid"
        }

        web.addJavascriptInterface(WebAppBridge(applicationContext), WebAppBridge.NAME)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val target = request.url
                // Anything outside the app origin belongs in the real browser.
                if (target.host != null && target.host == Uri.parse(BuildConfig.WEB_URL).host) {
                    return false
                }
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, target)) }
                return true
            }
        }

        // restoreState returns null when the saved history could not be read back,
        // which happens if the bundle was trimmed while the app sat in the
        // background. Without the fallback the WebView would just stay blank.
        val restored = savedInstanceState?.let { web.restoreState(it) } != null
        if (!restored) {
            web.loadUrl(BuildConfig.WEB_URL)
        }

        onBackPressedDispatcher.addCallback(this) {
            if (web.canGoBack()) {
                web.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        // Leaving the app is the moment the widget is about to be looked at.
        ChoreWidgetProvider.requestUpdate(this)
    }
}
