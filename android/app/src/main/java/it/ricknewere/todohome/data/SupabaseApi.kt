package it.ricknewere.todohome.data

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal PostgREST client. Plain HttpURLConnection on purpose: the widget only
 * makes two kinds of call and pulling in a HTTP library would be dead weight.
 *
 * Every method blocks, so it must be called off the main thread.
 */
object SupabaseApi {

    private const val TAG = "ToDoHomeApi"
    /** Mobile data needs room for DNS plus a TLS handshake before a byte moves,
     *  so an ordinary read waits this long before giving up. */
    const val TIMEOUT_MS = 10_000

    /** A tick costs two calls plus the confirmation pause, and all of it runs
     *  inside a broadcast the system kills after about ten seconds. The repaint
     *  that follows the tick gets the short budget; the tick itself does not,
     *  because losing that would lose the press. */
    const val QUICK_TIMEOUT_MS = 3_500

    private val FIELDS = listOf(
        "id", "name", "emoji", "days_late", "riccardo_at", "roberta_at", "sort_order",
    ).joinToString(",")

    /** Reads the whole chore list with due dates already computed by Postgres,
     *  as the raw response body so callers can store it and re-read it later.
     *  Returns null when the call fails. */
    fun fetchStatus(baseUrl: String, anonKey: String, timeoutMs: Int = TIMEOUT_MS): String? {
        val url = "$baseUrl/rest/v1/chore_status?select=$FIELDS&order=sort_order"
        return request("GET", url, anonKey, null, timeoutMs)
    }

    /** Turns a stored or freshly fetched response into rows. */
    fun parseStatus(body: String): List<ChoreStatus>? = try {
        val array = JSONArray(body)
        (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            ChoreStatus(
                id = o.getString("id"),
                name = o.getString("name"),
                emoji = o.optString("emoji", "🏠"),
                daysLate = o.optInt("days_late", 0),
                riccardoChecked = !o.isNull("riccardo_at"),
                robertaChecked = !o.isNull("roberta_at"),
            )
        }
    } catch (e: Exception) {
        Log.w(TAG, "risposta non leggibile", e)
        null
    }

    /** Toggles one person's tick. The chore closes only once both have ticked,
     *  which is decided by the toggle_check function in Postgres. */
    fun toggle(baseUrl: String, anonKey: String, choreId: String, user: String): Boolean {
        val payload = JSONObject()
            .put("p_chore_id", choreId)
            .put("p_user", user)
            .toString()

        return request(
            "POST",
            "$baseUrl/rest/v1/rpc/toggle_check",
            anonKey,
            payload,
            TIMEOUT_MS,
        ) != null
    }

    private fun request(
        method: String,
        url: String,
        anonKey: String,
        body: String?,
        timeoutMs: Int,
    ): String? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = timeoutMs
                readTimeout = timeoutMs
                setRequestProperty("apikey", anonKey)
                setRequestProperty("Authorization", "Bearer $anonKey")
                setRequestProperty("Accept", "application/json")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }

            if (body != null) {
                conn.outputStream.use { it.write(body.toByteArray()) }
            }

            val code = conn.responseCode
            if (code !in 200..299) {
                Log.w(TAG, "$method $code su ${url.substringAfter("/rest/v1/")}")
                return null
            }

            conn.inputStream.bufferedReader().use(BufferedReader::readText)
        } catch (e: Exception) {
            Log.w(TAG, "chiamata fallita", e)
            null
        } finally {
            conn?.disconnect()
        }
    }
}
