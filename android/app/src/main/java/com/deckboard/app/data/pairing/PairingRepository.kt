package com.deckboard.app.data.pairing

import android.content.Context
import android.os.Build
import com.deckboard.app.data.protocol.DeckMessage
import com.deckboard.app.data.settings.AppPreferences
import com.deckboard.app.data.socket.ConnectionState
import com.deckboard.app.data.socket.DeckSocketClient
import com.deckboard.app.widget.WidgetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Bridges the transport (DeckSocketClient) and persistence (AppPreferences),
 * so a successful pairing survives app restarts and server restarts alike. */
class PairingRepository(
    private val appContext: Context,
    private val socketClient: DeckSocketClient,
    private val preferences: AppPreferences,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var currentTarget: DeckSocketClient.PairingTarget? = null

    val connectionState: StateFlow<ConnectionState> = socketClient.connectionState

    init {
        scope.launch {
            socketClient.incoming.collect { message ->
                when (message) {
                    is DeckMessage.PairSuccess -> {
                        val target = currentTarget ?: return@collect
                        preferences.savePairing(
                            deviceId = message.payload.deviceId,
                            deviceToken = message.payload.deviceToken,
                            host = target.host,
                            port = target.port,
                        )
                    }
                    is DeckMessage.LayoutSnapshot -> {
                        // Cached so the home-screen widget can render buttons even
                        // before it establishes its own short-lived connection.
                        preferences.saveLastLayout(message.payload.pages)
                        WidgetUpdater.refreshAll(appContext)
                    }
                    else -> {}
                }
            }
        }
    }

    /** Returns true if a saved pairing existed and a silent reconnect was started. */
    suspend fun attemptSilentResume(): Boolean {
        val saved = preferences.getSavedPairing() ?: return false
        currentTarget = DeckSocketClient.PairingTarget(saved.host, saved.port)
        socketClient.start(currentTarget!!, saved.deviceId, saved.deviceToken)
        return true
    }

    suspend fun pairWithPin(host: String, port: Int, pin: String) {
        val deviceId = preferences.getOrCreateDeviceId()
        val deviceName = Build.MODEL ?: "Android device"
        currentTarget = DeckSocketClient.PairingTarget(host, port)
        socketClient.connectAndPair(currentTarget!!, pin, deviceId, deviceName)
    }

    /** Disconnects and forgets the current pairing so the user can pair again,
     * with the same server or a different one. */
    suspend fun forgetPairing() {
        socketClient.stop()
        currentTarget = null
        preferences.clearPairing()
    }
}
