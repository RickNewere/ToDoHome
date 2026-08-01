package it.ricknewere.todohome.data

import android.content.Context

/**
 * Everything the widget needs to work on its own.
 *
 * The Supabase credentials are not compiled into the app: the web app hands
 * them over through the JavaScript bridge the first time it loads, so there is
 * a single place to configure them.
 */
object Prefs {

    private const val FILE = "todohome"
    private const val KEY_USER = "user"
    private const val KEY_URL = "supabase_url"
    private const val KEY_ANON = "supabase_anon"
    private const val KEY_SYNC = "last_sync"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** "riccardo" or "roberta", whoever is using this phone. */
    fun user(ctx: Context): String? = prefs(ctx).getString(KEY_USER, null)

    fun setUser(ctx: Context, user: String) {
        if (user != "riccardo" && user != "roberta") return
        prefs(ctx).edit().putString(KEY_USER, user).apply()
    }

    fun supabaseUrl(ctx: Context): String? = prefs(ctx).getString(KEY_URL, null)

    fun supabaseKey(ctx: Context): String? = prefs(ctx).getString(KEY_ANON, null)

    /** Returns true when the stored credentials actually changed, so the caller
     *  knows the widget cache is now stale. */
    fun setSupabase(ctx: Context, url: String, anonKey: String): Boolean {
        if (url.isBlank() || anonKey.isBlank()) return false
        val clean = url.trimEnd('/')
        if (clean == supabaseUrl(ctx) && anonKey == supabaseKey(ctx)) return false
        prefs(ctx).edit()
            .putString(KEY_URL, clean)
            .putString(KEY_ANON, anonKey)
            .apply()
        return true
    }

    fun isConfigured(ctx: Context) = supabaseUrl(ctx) != null && supabaseKey(ctx) != null

    fun lastSync(ctx: Context): Long = prefs(ctx).getLong(KEY_SYNC, 0L)

    fun markSynced(ctx: Context) {
        prefs(ctx).edit().putLong(KEY_SYNC, System.currentTimeMillis()).apply()
    }
}
