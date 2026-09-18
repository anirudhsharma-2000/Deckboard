package com.deckboard.app.data.protocol

import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put

/** Encodes/decodes the DeckBoard wire envelope — see docs/protocol.md. */
object MessageCodec {
    @PublishedApi
    internal val json = Json { ignoreUnknownKeys = true }

    fun encode(type: String, payload: JsonElement): String {
        val envelope = buildJsonObject {
            put("v", PROTOCOL_VERSION)
            put("type", type)
            put("id", UUID.randomUUID().toString())
            put("ts", System.currentTimeMillis())
            put("payload", payload)
        }
        return envelope.toString()
    }

    inline fun <reified T> encode(type: String, payload: T): String {
        return encode(type, json.encodeToJsonElement(payload))
    }

    fun encodeEmpty(type: String): String {
        return encode(type, buildJsonObject {})
    }

    fun decode(raw: String): DeckMessage? {
        return try {
            val root = json.parseToJsonElement(raw).jsonObject
            val type = root["type"]?.jsonPrimitive?.content ?: return null
            val id = root["id"]?.jsonPrimitive?.content ?: return null
            val ts = root["ts"]?.jsonPrimitive?.long ?: 0L
            val payload = root["payload"] ?: JsonObject(emptyMap())

            when (type) {
                MessageType.HELLO -> DeckMessage.Hello(id, ts, json.decodeFromJsonElement(payload))
                MessageType.HELLO_ACK -> DeckMessage.HelloAck(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIR_REQUEST -> DeckMessage.PairRequest(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIR_RESUME -> DeckMessage.PairResume(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIR_SUCCESS -> DeckMessage.PairSuccess(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIR_ERROR -> DeckMessage.PairError(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIRING_SESSION -> DeckMessage.PairingSession(id, ts, json.decodeFromJsonElement(payload))
                MessageType.PAIRING_REGENERATE -> DeckMessage.PairingRegenerate(id, ts)
                MessageType.BUTTON_PRESS -> DeckMessage.ButtonPress(id, ts, json.decodeFromJsonElement(payload))
                MessageType.BUTTON_PRESS_ACK -> DeckMessage.ButtonPressAck(id, ts, json.decodeFromJsonElement(payload))
                MessageType.DEVICE_CONNECTED -> DeckMessage.DeviceConnected(id, ts, json.decodeFromJsonElement(payload))
                MessageType.DEVICE_DISCONNECTED -> DeckMessage.DeviceDisconnected(id, ts, json.decodeFromJsonElement(payload))
                MessageType.HEARTBEAT -> DeckMessage.Heartbeat(id, ts)
                MessageType.ERROR -> DeckMessage.Error(id, ts, json.decodeFromJsonElement(payload))
                MessageType.LAYOUT_SNAPSHOT -> DeckMessage.LayoutSnapshot(id, ts, json.decodeFromJsonElement(payload))
                MessageType.ACTION_RESULT -> DeckMessage.ActionResult(id, ts, json.decodeFromJsonElement(payload))
                MessageType.LAYOUT_ACTIVE_PAGE -> DeckMessage.LayoutActivePage(id, ts, json.decodeFromJsonElement(payload))
                MessageType.BACKGROUND_SNAPSHOT -> DeckMessage.BackgroundSnapshot(id, ts, json.decodeFromJsonElement(payload))
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }
}
