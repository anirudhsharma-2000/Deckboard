package com.deckboard.app.data.socket

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.deckboard.app.data.protocol.BackgroundConfig
import com.deckboard.app.data.protocol.ButtonPressPayload
import com.deckboard.app.data.protocol.DeckMessage
import com.deckboard.app.data.protocol.HelloPayload
import com.deckboard.app.data.protocol.MessageCodec
import com.deckboard.app.data.protocol.MessageType
import com.deckboard.app.data.protocol.PageConfig
import com.deckboard.app.data.protocol.PairRequestPayload
import com.deckboard.app.data.protocol.PairResumePayload
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

private const val MIN_BACKOFF_MS = 1000L
private const val MAX_BACKOFF_MS = 15000L
private const val HEARTBEAT_INTERVAL_MS = 25_000L
private const val CLIENT_VERSION = "0.1.0"

/**
 * App-scoped WebSocket client. Held for the lifetime of the process (see
 * DeckBoardApp) so navigating between screens never drops the connection.
 * Handles reconnect with exponential backoff, an immediate retry the moment
 * WiFi comes back (ConnectivityManager.NetworkCallback), and re-sends
 * pair.resume automatically after the first successful pairing.
 */
class DeckSocketClient(
    private val appContext: Context,
) : DefaultLifecycleObserver {

    data class PairingTarget(val host: String, val port: Int)
    data class LayoutState(val pages: List<PageConfig>, val activePageId: String)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private var activeWebSocket: WebSocket? = null
    private var currentTarget: PairingTarget? = null
    private var backoffMs = MIN_BACKOFF_MS
    private var reconnectJob: Job? = null
    private var heartbeatJob: Job? = null
    private var resumeCredentials: Pair<String, String>? = null
    private var pendingPairRequest: PairRequestPayload? = null

    /** Set by an intentional stop() so onClosed/onFailure don't race to reconnect —
     * without this, a disconnect would silently re-establish itself moments later. */
    private var isStopped = false

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _incoming = MutableSharedFlow<DeckMessage>(extraBufferCapacity = 64)
    val incoming: SharedFlow<DeckMessage> = _incoming.asSharedFlow()

    private val _layoutState = MutableStateFlow<LayoutState?>(null)
    val layoutState: StateFlow<LayoutState?> = _layoutState.asStateFlow()

    /** Exposed so the UI can build absolute URLs for server-relative icon paths. */
    private val _activeTarget = MutableStateFlow<PairingTarget?>(null)
    val activeTarget: StateFlow<PairingTarget?> = _activeTarget.asStateFlow()

    private val _backgroundState = MutableStateFlow<BackgroundConfig?>(null)
    val backgroundState: StateFlow<BackgroundConfig?> = _backgroundState.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (isStopped) return
            val state = _connectionState.value
            if (state is ConnectionState.Disconnected || state is ConnectionState.Error) {
                reconnectNow()
            }
        }
    }

    /** Reconnect using a previously issued device token (silent pair.resume). */
    fun start(target: PairingTarget, deviceId: String, deviceToken: String) {
        isStopped = false
        currentTarget = target
        _activeTarget.value = target
        resumeCredentials = deviceId to deviceToken
        pendingPairRequest = null
        registerNetworkCallback()
        reconnectNow()
    }

    /** First-time pairing using the PIN shown on the dashboard. */
    fun connectAndPair(target: PairingTarget, pin: String, deviceId: String, deviceName: String) {
        isStopped = false
        currentTarget = target
        _activeTarget.value = target
        pendingPairRequest = PairRequestPayload(pin, deviceId, deviceName)
        resumeCredentials = null
        registerNetworkCallback()
        reconnectNow()
    }

    fun sendButtonPress(buttonId: String, label: String) {
        val payload = ButtonPressPayload(buttonId, label, System.currentTimeMillis())
        activeWebSocket?.send(MessageCodec.encode(MessageType.BUTTON_PRESS, payload))
    }

    /** Intentional disconnect — closes the socket and clears in-memory pairing state
     * so no stray reconnect/resume happens afterward. */
    fun stop() {
        isStopped = true
        reconnectJob?.cancel()
        heartbeatJob?.cancel()
        currentTarget = null
        resumeCredentials = null
        pendingPairRequest = null
        _activeTarget.value = null
        _layoutState.value = null
        _backgroundState.value = null
        _connectionState.value = ConnectionState.Disconnected
        activeWebSocket?.close(1000, "client stopped")
        activeWebSocket = null
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        runCatching { cm.unregisterNetworkCallback(networkCallback) }
    }

    override fun onStart(owner: LifecycleOwner) {
        if (isStopped) return
        val state = _connectionState.value
        if (state is ConnectionState.Disconnected || state is ConnectionState.Error) {
            reconnectNow()
        }
    }

    private fun registerNetworkCallback() {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        runCatching { cm.registerNetworkCallback(request, networkCallback) }
    }

    private fun connect() {
        val target = currentTarget ?: return
        _connectionState.value = ConnectionState.Connecting
        val request = Request.Builder().url("ws://${target.host}:${target.port}/ws").build()
        activeWebSocket = client.newWebSocket(request, listener)
    }

    private fun reconnectNow() {
        reconnectJob?.cancel()
        backoffMs = MIN_BACKOFF_MS
        connect()
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(backoffMs)
            backoffMs = (backoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)
            connect()
        }
    }

    private fun startHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (true) {
                delay(HEARTBEAT_INTERVAL_MS)
                activeWebSocket?.send(MessageCodec.encodeEmpty(MessageType.HEARTBEAT))
            }
        }
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            backoffMs = MIN_BACKOFF_MS
            _connectionState.value = ConnectionState.AwaitingPairing
            startHeartbeatLoop()

            webSocket.send(MessageCodec.encode(MessageType.HELLO, HelloPayload("controller", CLIENT_VERSION)))

            val resume = resumeCredentials
            val pairRequest = pendingPairRequest
            when {
                resume != null -> webSocket.send(
                    MessageCodec.encode(MessageType.PAIR_RESUME, PairResumePayload(resume.first, resume.second)),
                )
                pairRequest != null -> webSocket.send(
                    MessageCodec.encode(MessageType.PAIR_REQUEST, pairRequest),
                )
            }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val message = MessageCodec.decode(text) ?: return
            when (message) {
                is DeckMessage.PairSuccess -> {
                    resumeCredentials = message.payload.deviceId to message.payload.deviceToken
                    pendingPairRequest = null
                    _connectionState.value = ConnectionState.Paired(message.payload.deviceName)
                }
                is DeckMessage.PairError -> {
                    _connectionState.value = ConnectionState.Error(message.payload.message)
                }
                is DeckMessage.LayoutSnapshot -> {
                    _layoutState.value = LayoutState(message.payload.pages, message.payload.activePageId)
                }
                is DeckMessage.LayoutActivePage -> {
                    _layoutState.value = _layoutState.value?.copy(activePageId = message.payload.pageId)
                }
                is DeckMessage.BackgroundSnapshot -> {
                    _backgroundState.value = message.payload.background
                }
                else -> {}
            }
            scope.launch { _incoming.emit(message) }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            heartbeatJob?.cancel()
            if (isStopped) return
            _connectionState.value = ConnectionState.Disconnected
            scheduleReconnect()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            heartbeatJob?.cancel()
            if (isStopped) return
            _connectionState.value = ConnectionState.Disconnected
            scheduleReconnect()
        }
    }
}
