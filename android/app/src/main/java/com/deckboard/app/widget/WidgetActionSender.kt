package com.deckboard.app.widget

import android.content.Context
import com.deckboard.app.data.protocol.ButtonPressPayload
import com.deckboard.app.data.protocol.DeckMessage
import com.deckboard.app.data.protocol.HelloPayload
import com.deckboard.app.data.protocol.MessageCodec
import com.deckboard.app.data.protocol.MessageType
import com.deckboard.app.data.protocol.PairResumePayload
import com.deckboard.app.data.settings.AppPreferences
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

private const val CLIENT_VERSION = "0.1.0"
private const val CONNECT_TIMEOUT_MS = 4000L
// Generous relative to connectTimeout: readTimeout also bounds the idle gap
// between WebSocket frames, and some actions (OBS scene switches, etc.) take
// a moment to execute server-side before action.result comes back.
private const val READ_TIMEOUT_MS = 8000L

// Short, explicit timeouts — this now runs inside WidgetActionService's own
// foreground-service lifetime rather than sharing Glance's tight callback
// window, but a hung LAN connection still shouldn't hold the service (and
// its notification) open indefinitely.
private fun newWidgetHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    .writeTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    .build()

/**
 * A short-lived, one-shot WebSocket round trip for widget taps — deliberately
 * NOT the app-scoped DeckSocketClient, which is built for a long-lived
 * foreground connection with reconnect/backoff/heartbeat. A widget tap just
 * needs: connect, resume pairing, send one button press, wait for the
 * result, disconnect.
 */
object WidgetActionSender {
    suspend fun sendButtonPress(context: Context, buttonId: String, label: String): Boolean {
        val saved = AppPreferences(context).getSavedPairing() ?: return false

        return suspendCancellableCoroutine { cont ->
            val client = newWidgetHttpClient()
            val request = Request.Builder().url("ws://${saved.host}:${saved.port}/ws").build()

            val ws = client.newWebSocket(
                request,
                object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocket.send(MessageCodec.encode(MessageType.HELLO, HelloPayload("controller", CLIENT_VERSION)))
                        webSocket.send(
                            MessageCodec.encode(MessageType.PAIR_RESUME, PairResumePayload(saved.deviceId, saved.deviceToken)),
                        )
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        when (val message = MessageCodec.decode(text)) {
                            is DeckMessage.PairSuccess -> {
                                webSocket.send(
                                    MessageCodec.encode(
                                        MessageType.BUTTON_PRESS,
                                        ButtonPressPayload(buttonId, label, System.currentTimeMillis()),
                                    ),
                                )
                            }
                            is DeckMessage.ActionResult -> {
                                if (cont.isActive) cont.resume(message.payload.success)
                                webSocket.close(1000, "done")
                            }
                            is DeckMessage.PairError -> {
                                if (cont.isActive) cont.resume(false)
                                webSocket.close(1000, "pair failed")
                            }
                            else -> {}
                        }
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        if (cont.isActive) cont.resume(false)
                    }
                },
            )

            cont.invokeOnCancellation { ws.cancel() }
        }
    }

    /** Same one-shot connect/disconnect pattern, but fetches+caches the current
     * layout instead of pressing a button — lets the widget refresh itself
     * (e.g. after editing the layout on the dashboard) without opening the app. */
    suspend fun refreshLayout(context: Context): Boolean {
        val preferences = AppPreferences(context)
        val saved = preferences.getSavedPairing() ?: return false

        val pages = suspendCancellableCoroutine<List<com.deckboard.app.data.protocol.PageConfig>?> { cont ->
            val client = newWidgetHttpClient()
            val request = Request.Builder().url("ws://${saved.host}:${saved.port}/ws").build()

            val ws = client.newWebSocket(
                request,
                object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocket.send(MessageCodec.encode(MessageType.HELLO, HelloPayload("controller", CLIENT_VERSION)))
                        webSocket.send(
                            MessageCodec.encode(MessageType.PAIR_RESUME, PairResumePayload(saved.deviceId, saved.deviceToken)),
                        )
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        when (val message = MessageCodec.decode(text)) {
                            is DeckMessage.LayoutSnapshot -> {
                                if (cont.isActive) cont.resume(message.payload.pages)
                                webSocket.close(1000, "done")
                            }
                            is DeckMessage.PairError -> {
                                if (cont.isActive) cont.resume(null)
                                webSocket.close(1000, "pair failed")
                            }
                            else -> {}
                        }
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        if (cont.isActive) cont.resume(null)
                    }
                },
            )

            cont.invokeOnCancellation { ws.cancel() }
        }

        if (pages == null) return false
        preferences.saveLastLayout(pages)
        return true
    }
}
