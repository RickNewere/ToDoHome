package it.ricknewere.todohome

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.webkit.JavascriptInterface
import it.ricknewere.todohome.data.Prefs
import it.ricknewere.todohome.widget.ChoreWidgetProvider

/**
 * The only channel between the web app and the native side.
 *
 * Handing the Supabase credentials over from the page means the APK carries no
 * secrets and there is a single place to configure the backend. The interface
 * is only reachable from the app origin: the WebViewClient sends every other
 * URL to the system browser.
 */
class WebAppBridge(private val context: Context) {

    /** Stores which of the two people uses this phone, so the widget knows
     *  whose tick its quick button toggles. */
    @JavascriptInterface
    fun setUser(user: String) {
        Prefs.setUser(context, user)
        ChoreWidgetProvider.requestUpdate(context)
    }

    @JavascriptInterface
    fun setConfig(url: String, anonKey: String) {
        val wasConfigured = Prefs.isConfigured(context)
        Prefs.setSupabase(context, url, anonKey)
        if (!wasConfigured) ChoreWidgetProvider.requestUpdate(context)
    }

    @JavascriptInterface
    fun refreshWidget() {
        ChoreWidgetProvider.requestUpdate(context)
    }

    /** Asks the launcher to drop the widget on the home screen, so the user does
     *  not have to hunt for it in the widget drawer. Returns false when the
     *  launcher does not support pinning. */
    @JavascriptInterface
    fun pinWidget(): Boolean {
        val manager = AppWidgetManager.getInstance(context)
        if (!manager.isRequestPinAppWidgetSupported) return false
        return manager.requestPinAppWidget(
            ComponentName(context, ChoreWidgetProvider::class.java),
            null,
            null,
        )
    }

    companion object {
        const val NAME = "ToDoHomeAndroid"
    }
}
