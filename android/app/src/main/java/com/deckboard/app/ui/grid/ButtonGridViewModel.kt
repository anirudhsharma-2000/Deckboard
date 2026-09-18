package com.deckboard.app.ui.grid

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.deckboard.app.data.pairing.PairingRepository
import com.deckboard.app.data.protocol.BackgroundConfig
import com.deckboard.app.data.protocol.DeckMessage
import com.deckboard.app.data.socket.ConnectionState
import com.deckboard.app.data.socket.DeckSocketClient
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

data class ActionFeedback(val buttonId: String, val success: Boolean, val message: String?)

class ButtonGridViewModel(
    private val socketClient: DeckSocketClient,
    private val pairingRepository: PairingRepository,
) : ViewModel() {

    val connectionState: StateFlow<ConnectionState> = socketClient.connectionState
    val layoutState: StateFlow<DeckSocketClient.LayoutState?> = socketClient.layoutState
    val activeTarget: StateFlow<DeckSocketClient.PairingTarget?> = socketClient.activeTarget
    val backgroundState: StateFlow<BackgroundConfig?> = socketClient.backgroundState

    private val _feedback = MutableSharedFlow<ActionFeedback>(extraBufferCapacity = 8)
    val feedback: SharedFlow<ActionFeedback> = _feedback.asSharedFlow()

    init {
        viewModelScope.launch {
            socketClient.incoming.collect { message ->
                if (message is DeckMessage.ActionResult) {
                    _feedback.emit(ActionFeedback(message.payload.buttonId, message.payload.success, message.payload.message))
                }
            }
        }
    }

    fun onButtonPressed(buttonId: String, label: String) {
        socketClient.sendButtonPress(buttonId, label)
    }

    fun disconnect(onDone: () -> Unit) {
        viewModelScope.launch {
            pairingRepository.forgetPairing()
            onDone()
        }
    }
}

class ButtonGridViewModelFactory(
    private val socketClient: DeckSocketClient,
    private val pairingRepository: PairingRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ButtonGridViewModel(socketClient, pairingRepository) as T
    }
}
