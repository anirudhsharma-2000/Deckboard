package com.deckboard.app.ui.pairing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.deckboard.app.data.pairing.PairingRepository
import com.deckboard.app.data.pairing.PairingUriParser
import com.deckboard.app.data.socket.ConnectionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PairingUiState {
    data object CheckingSavedPairing : PairingUiState()
    data object NeedsPairing : PairingUiState()
    data object Connecting : PairingUiState()
    data class Failed(val message: String) : PairingUiState()
}

class PairingViewModel(private val repository: PairingRepository) : ViewModel() {

    private val _uiState = MutableStateFlow<PairingUiState>(PairingUiState.CheckingSavedPairing)
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    val connectionState: StateFlow<ConnectionState> = repository.connectionState

    init {
        viewModelScope.launch {
            val resumed = repository.attemptSilentResume()
            _uiState.value = if (resumed) PairingUiState.Connecting else PairingUiState.NeedsPairing
        }
    }

    fun onQrScanned(rawUri: String) {
        val parsed = PairingUriParser.parse(rawUri)
        if (parsed == null) {
            _uiState.value = PairingUiState.Failed("That QR code doesn't look like a DeckBoard pairing code")
            return
        }
        pair(parsed.host, parsed.port, parsed.pin)
    }

    fun onManualEntry(host: String, port: Int, pin: String) {
        pair(host, port, pin)
    }

    /** Called after a disconnect so the entry screen doesn't stay stuck showing a
     * stale "Connecting…" spinner from the pairing that just ended. */
    fun resetToNeedsPairing() {
        _uiState.value = PairingUiState.NeedsPairing
    }

    private fun pair(host: String, port: Int, pin: String) {
        _uiState.value = PairingUiState.Connecting
        viewModelScope.launch {
            repository.pairWithPin(host, port, pin)
        }
    }
}

class PairingViewModelFactory(private val repository: PairingRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return PairingViewModel(repository) as T
    }
}
