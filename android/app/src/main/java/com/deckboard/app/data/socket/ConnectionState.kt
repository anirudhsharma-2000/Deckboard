package com.deckboard.app.data.socket

sealed class ConnectionState {
    data object Disconnected : ConnectionState()
    data object Connecting : ConnectionState()
    data object AwaitingPairing : ConnectionState()
    data class Paired(val deviceName: String) : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}
