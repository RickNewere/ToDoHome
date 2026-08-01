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
    /** A tick costs two calls plus the confirmation pause, and all of it runs
     *  inside a broadcast that the system kills after about ten seconds. Keeping
     *  each call short is what stops a slow network from losing the repaint. */
    private const val TIMEOUT_MS = 4_000

    private val FIELDS = listOf(
        "id", "name", "emoji", "days_late", "riccardo_at", "roberta_at", "sort_order",
    ).joinToString(",")

    /** Reads the whole chore list with due dates already computed by Postgres.
     *  Returns null when the call fails, so callers can keep the previous view. */
    fun fetchStatus(baseUrl: String, anonKey: String): List<ChoreStatus>? {
        val url = "$baseUrl/rest/v1/chore_status?select=$FIELDS&order=sort_order"
        val body = request("GET", url, anonKey, null) ?: return null

        return try {
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
    }

    /** Toggles one person's tick. The chore closes only once both have ticked,
     *  which is decided by the toggle_check function in Postgres. */
    fun toggle(baseUrl: String, anonKey: String, choreId: String, user: String): Boolean {
        val payload = JSONObject()
            .put("p_chore_id", choreId)
            .put("p_user", user)
            .toString()

        return request("POST", "$baseUrl/rest/v1/rpc/toggle_check", anonKey, payload) != null
    }

    private fun request(method: String, url: String, anonKey: String, body: String?): String? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
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
