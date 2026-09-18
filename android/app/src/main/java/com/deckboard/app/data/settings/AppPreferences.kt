package com.deckboard.app.data.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.deckboard.app.data.protocol.PageConfig
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.dataStore by preferencesDataStore(name = "deckboard_prefs")

data class SavedPairing(
    val deviceId: String,
    val deviceToken: String,
    val host: String,
    val port: Int,
)

/** Persists the device's own id (stable across re-pairs) and the last successful pairing. */
class AppPreferences(private val context: Context) {

    private object Keys {
        val DEVICE_ID = stringPreferencesKey("device_id")
        val DEVICE_TOKEN = stringPreferencesKey("device_token")
        val HOST = stringPreferencesKey("host")
        val PORT = intPreferencesKey("port")
        val LAST_LAYOUT_JSON = stringPreferencesKey("last_layout_json")
    }

    private val json = Json { ignoreUnknownKeys = true }

    /** Cached so the home-screen widget has something to show before its own connection lands. */
    suspend fun saveLastLayout(pages: List<PageConfig>) {
        context.dataStore.edit { it[Keys.LAST_LAYOUT_JSON] = json.encodeToString(pages) }
    }

    suspend fun getLastLayout(): List<PageConfig>? {
        val raw = context.dataStore.data.first()[Keys.LAST_LAYOUT_JSON] ?: return null
        return try {
            json.decodeFromString(raw)
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getOrCreateDeviceId(): String {
        val existing = context.dataStore.data.first()[Keys.DEVICE_ID]
        if (existing != null) return existing

        val newId = UUID.randomUUID().toString()
        context.dataStore.edit { it[Keys.DEVICE_ID] = newId }
        return newId
    }

    suspend fun savePairing(deviceId: String, deviceToken: String, host: String, port: Int) {
        context.dataStore.edit {
            it[Keys.DEVICE_ID] = deviceId
            it[Keys.DEVICE_TOKEN] = deviceToken
            it[Keys.HOST] = host
            it[Keys.PORT] = port
        }
    }

    suspend fun getSavedPairing(): SavedPairing? {
        val prefs = context.dataStore.data.first()
        val deviceId = prefs[Keys.DEVICE_ID] ?: return null
        val deviceToken = prefs[Keys.DEVICE_TOKEN] ?: return null
        val host = prefs[Keys.HOST] ?: return null
        val port = prefs[Keys.PORT] ?: return null
        return SavedPairing(deviceId, deviceToken, host, port)
    }

    /** Forgets the current pairing (and cached widget layout) so the app returns to
     * the pairing screen. DEVICE_ID is kept — it's a stable identity, not a secret,
     * and re-pairing under the same id is harmless. */
    suspend fun clearPairing() {
        context.dataStore.edit {
            it.remove(Keys.DEVICE_TOKEN)
            it.remove(Keys.HOST)
            it.remove(Keys.PORT)
            it.remove(Keys.LAST_LAYOUT_JSON)
        }
    }
}
