package com.deckboard.app.data.pairing

import android.net.Uri

data class PairingUri(val host: String, val port: Int, val pin: String)

/** Parses `deckboard://pair?v=1&host=<ip>&port=8787&pin=<pin>` — see docs/protocol.md. */
object PairingUriParser {
    fun parse(raw: String): PairingUri? {
        val uri = runCatching { Uri.parse(raw) }.getOrNull() ?: return null
        if (uri.scheme != "deckboard" || uri.host != "pair") return null

        val host = uri.getQueryParameter("host") ?: return null
        val port = uri.getQueryParameter("port")?.toIntOrNull() ?: return null
        val pin = uri.getQueryParameter("pin") ?: return null
        return PairingUri(host, port, pin)
    }
}
