package com.deckboard.app.data.protocol

import kotlinx.serialization.Serializable

@Serializable
data class HelloPayload(val role: String, val clientVersion: String)

@Serializable
data class HelloAckPayload(val serverVersion: String, val protocolVersion: Int)

@Serializable
data class PairRequestPayload(val pin: String, val deviceId: String, val deviceName: String)

@Serializable
data class PairResumePayload(val deviceId: String, val deviceToken: String)

@Serializable
data class PairSuccessPayload(val deviceId: String, val deviceToken: String, val deviceName: String)

@Serializable
data class PairErrorPayload(val code: String, val message: String)

@Serializable
data class PairingSessionPayload(val pin: String, val host: String, val port: Int, val qrUri: String, val expiresAt: Long)

@Serializable
data class ButtonPressPayload(val buttonId: String, val label: String, val pressedAt: Long)

@Serializable
data class ButtonPressAckPayload(val buttonId: String, val receivedAt: Long)

@Serializable
data class DeviceConnectedPayload(val deviceId: String, val deviceName: String, val at: Long)

@Serializable
data class DeviceDisconnectedPayload(val deviceId: String, val deviceName: String, val at: Long)

@Serializable
data class ErrorPayload(val code: String, val message: String)

@Serializable
data class LayoutSnapshotPayload(val pages: List<PageConfig>, val activePageId: String)

@Serializable
data class ActionResultPayload(val buttonId: String, val success: Boolean, val message: String? = null)

@Serializable
data class LayoutActivePagePayload(val pageId: String)

@Serializable
data class BackgroundSnapshotPayload(val background: BackgroundConfig)

object MessageType {
    const val HELLO = "hello"
    const val HELLO_ACK = "hello.ack"
    const val PAIR_REQUEST = "pair.request"
    const val PAIR_RESUME = "pair.resume"
    const val PAIR_SUCCESS = "pair.success"
    const val PAIR_ERROR = "pair.error"
    const val PAIRING_SESSION = "pairing.session"
    const val PAIRING_REGENERATE = "pairing.regenerate"
    const val BUTTON_PRESS = "button.press"
    const val BUTTON_PRESS_ACK = "button.press.ack"
    const val DEVICE_CONNECTED = "device.connected"
    const val DEVICE_DISCONNECTED = "device.disconnected"
    const val HEARTBEAT = "heartbeat"
    const val ERROR = "error"
    const val LAYOUT_GET = "layout.get"
    const val LAYOUT_SNAPSHOT = "layout.snapshot"
    const val LAYOUT_UPDATE = "layout.update"
    const val ACTION_RESULT = "action.result"
    const val LAYOUT_ACTIVE_PAGE = "layout.activePage"
    const val BACKGROUND_SNAPSHOT = "background.snapshot"
    const val BACKGROUND_UPDATE = "background.update"
}

sealed class DeckMessage {
    abstract val id: String
    abstract val ts: Long

    data class Hello(override val id: String, override val ts: Long, val payload: HelloPayload) : DeckMessage()
    data class HelloAck(override val id: String, override val ts: Long, val payload: HelloAckPayload) : DeckMessage()
    data class PairRequest(override val id: String, override val ts: Long, val payload: PairRequestPayload) : DeckMessage()
    data class PairResume(override val id: String, override val ts: Long, val payload: PairResumePayload) : DeckMessage()
    data class PairSuccess(override val id: String, override val ts: Long, val payload: PairSuccessPayload) : DeckMessage()
    data class PairError(override val id: String, override val ts: Long, val payload: PairErrorPayload) : DeckMessage()
    data class PairingSession(override val id: String, override val ts: Long, val payload: PairingSessionPayload) : DeckMessage()
    data class PairingRegenerate(override val id: String, override val ts: Long) : DeckMessage()
    data class ButtonPress(override val id: String, override val ts: Long, val payload: ButtonPressPayload) : DeckMessage()
    data class ButtonPressAck(override val id: String, override val ts: Long, val payload: ButtonPressAckPayload) : DeckMessage()
    data class DeviceConnected(override val id: String, override val ts: Long, val payload: DeviceConnectedPayload) : DeckMessage()
    data class DeviceDisconnected(override val id: String, override val ts: Long, val payload: DeviceDisconnectedPayload) : DeckMessage()
    data class Heartbeat(override val id: String, override val ts: Long) : DeckMessage()
    data class Error(override val id: String, override val ts: Long, val payload: ErrorPayload) : DeckMessage()
    data class LayoutSnapshot(override val id: String, override val ts: Long, val payload: LayoutSnapshotPayload) : DeckMessage()
    data class ActionResult(override val id: String, override val ts: Long, val payload: ActionResultPayload) : DeckMessage()
    data class LayoutActivePage(override val id: String, override val ts: Long, val payload: LayoutActivePagePayload) : DeckMessage()
    data class BackgroundSnapshot(override val id: String, override val ts: Long, val payload: BackgroundSnapshotPayload) : DeckMessage()
}
