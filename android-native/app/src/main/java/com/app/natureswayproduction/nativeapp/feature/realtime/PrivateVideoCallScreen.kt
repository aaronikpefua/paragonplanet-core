package com.app.natureswayproduction.nativeapp.feature.realtime

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.app.natureswayproduction.nativeapp.data.api.CallPlan
import com.app.natureswayproduction.nativeapp.data.api.JoinCallResult
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.api.PrivateCallSession
import com.app.natureswayproduction.nativeapp.data.api.RealtimeProviderInfo
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID

class PrivateVideoCallViewModel(
    private val apiService: ParagonApiService = ParagonApiService(),
    private val appCheckRepository: AppCheckRepository = AppCheckRepository(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(PrivateVideoCallUiState())
    val uiState: StateFlow<PrivateVideoCallUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, message = "Loading realtime calls...")
            runCatching {
                val token = idToken()
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                val plans = apiService.fetchRealtimeCallPlans(token, appCheck)
                val calls = apiService.fetchMyRealtimeCalls(token, appCheck)
                Triple(auth.currentUser?.uid.orEmpty(), plans, calls)
            }.onSuccess { (currentUid, plans, calls) ->
                _uiState.value = _uiState.value.copy(
                    currentUid = currentUid,
                    plans = plans.plans,
                    selectedPlanId = _uiState.value.selectedPlanId.ifBlank { plans.plans.firstOrNull()?.id.orEmpty() },
                    provider = plans.provider,
                    calls = calls,
                    isLoading = false,
                    message = if (_uiState.value.recipientId.isBlank()) {
                        "Open another user's profile or creator card to start a paid video call."
                    } else {
                        "Choose a plan, then request the call."
                    },
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(isLoading = false, message = error.message ?: "Could not load realtime calls.")
            }
        }
    }

    fun updateRecipient(value: String, displayName: String? = null, role: String? = null) {
        _uiState.value = _uiState.value.copy(
            recipientId = value.trim(),
            recipientName = displayName?.trim().orEmpty(),
            recipientRole = role?.trim().orEmpty(),
        )
    }

    fun selectPlan(planId: String) {
        _uiState.value = _uiState.value.copy(selectedPlanId = planId)
    }

    fun requestCall() {
        val state = _uiState.value
        val currentUid = auth.currentUser?.uid.orEmpty()
        if (state.recipientId.isBlank()) {
            _uiState.value = state.copy(message = "Open another user profile or creator card before requesting a video call.")
            return
        }
        if (state.recipientId == currentUid) {
            _uiState.value = state.copy(message = "You cannot request a video call with yourself. Open another user's profile first.")
            return
        }
        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, message = "Reserving PARAG and sending call request...")
            runCatching {
                val token = idToken()
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.requestPrivateVideoCall(
                    idToken = token,
                    appCheckToken = appCheck,
                    recipientId = state.recipientId,
                    planId = state.selectedPlanId,
                    idempotencyKey = UUID.randomUUID().toString(),
                )
            }.onSuccess { call ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    calls = listOf(call) + _uiState.value.calls.filterNot { it.id == call.id },
                    message = "CALL REQUEST SENT\n${call.recipientName}\n${call.planLabel} • ${call.durationMinutes} minutes • ${call.priceParag} PARAG\nWaiting for response...",
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(isLoading = false, message = error.message ?: "Could not request call.")
            }
        }
    }

    fun accept(callId: String) = updateCall(callId, "accept", "Accepted. Realtime room is being prepared.")
    fun cancel(callId: String) = updateCall(callId, "cancel", "Call request cancelled. Reserved PARAG released.")
    fun decline(callId: String) = updateCall(callId, "decline", "Declined. Reserved PARAG released.")
    fun markConnected(callId: String) = updateCall(callId, "connected", "Connected signal sent. Charge finalizes only after both participants connect.")
    fun end(callId: String) = updateCall(callId, "end", "Call ended.")

    fun join(callId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, message = "Requesting secure realtime token...")
            runCatching {
                val token = idToken()
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.joinRealtimeCall(token, appCheck, callId)
            }.onSuccess { result ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    activeJoin = result,
                    message = "Realtime token issued for ${result.call.planLabel}. Attach Cloudflare RealtimeKit UI with this token.",
                )
            }.onFailure { error ->
                val rawMessage = error.message ?: "Could not join call."
                val userMessage = if (
                    rawMessage.contains("cloudflare", ignoreCase = true) ||
                    rawMessage.contains("realtime", ignoreCase = true) ||
                    rawMessage.contains("configured", ignoreCase = true)
                ) {
                    "Video calling is temporarily unavailable."
                } else {
                    rawMessage
                }
                _uiState.value = _uiState.value.copy(isLoading = false, message = userMessage)
            }
        }
    }

    private fun updateCall(callId: String, action: String, successMessage: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, message = "Updating call...")
            runCatching {
                val token = idToken()
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.updateRealtimeCall(token, appCheck, callId, action)
            }.onSuccess {
                _uiState.value = _uiState.value.copy(isLoading = false, message = successMessage)
                refresh()
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(isLoading = false, message = error.message ?: "Could not update call.")
            }
        }
    }

    private suspend fun idToken(): String {
        val user = auth.currentUser ?: error("Sign in first.")
        return user.getIdToken(false).await().token ?: error("Could not get auth token.")
    }

    companion object {
        fun factory(apiService: ParagonApiService, appCheckRepository: AppCheckRepository): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return PrivateVideoCallViewModel(apiService = apiService, appCheckRepository = appCheckRepository) as T
            }
        }
    }
}

data class PrivateVideoCallUiState(
    val currentUid: String = "",
    val plans: List<CallPlan> = emptyList(),
    val selectedPlanId: String = "",
    val recipientId: String = "",
    val recipientName: String = "",
    val recipientRole: String = "",
    val provider: RealtimeProviderInfo = RealtimeProviderInfo("cloudflare-realtimekit", false, "OFF"),
    val calls: List<PrivateCallSession> = emptyList(),
    val activeJoin: JoinCallResult? = null,
    val isLoading: Boolean = false,
    val message: String = "Preparing private video calls...",
)

@Composable
fun PrivateVideoCallScreen(
    viewModel: PrivateVideoCallViewModel,
    onOpenWallet: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    LaunchedEffect(Unit) { viewModel.refresh() }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text("Private Video Call", color = Color.White, fontWeight = FontWeight.Bold)
            Text("Paid realtime calls reserve PARAG first, then charge only after both participants connect.", color = Color(0xFFEAD9B8))
            Spacer(Modifier.height(8.dp))
            Text(state.message, color = if (state.message.contains("Insufficient", true)) Color(0xFFFFC107) else Color.White)
            if (state.message.contains("Insufficient", true)) {
                Button(onClick = onOpenWallet, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE4B122))) {
                    Text("Fund Your Wallet", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
            if (state.isLoading) CircularProgressIndicator(color = Color(0xFFE4B122))
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111111)), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    RecipientIdentityCard(state)
                    state.plans.forEach { plan ->
                        Button(
                            onClick = { viewModel.selectPlan(plan.id) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.selectedPlanId == plan.id) Color(0xFFE4B122) else Color(0xFF1D2939),
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("${plan.label} • ${plan.durationMinutes} min • ${plan.priceParag} PARAG", color = if (state.selectedPlanId == plan.id) Color.Black else Color.White)
                        }
                    }
                    Button(
                        onClick = viewModel::requestCall,
                        enabled = state.recipientId.isNotBlank() && state.selectedPlanId.isNotBlank() && !state.isLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE4B122)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        val plan = state.plans.firstOrNull { it.id == state.selectedPlanId }
                        Text("Request ${plan?.durationMinutes ?: 0}-Min Call · ${plan?.priceParag ?: 0} PARAG", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Text("Call Requests", color = Color.White, fontWeight = FontWeight.Bold)
        }

        items(state.calls, key = { it.id }) { call ->
            CallCard(
                call = call,
                currentUid = state.currentUid,
                onAccept = { viewModel.accept(call.id) },
                onCancel = { viewModel.cancel(call.id) },
                onDecline = { viewModel.decline(call.id) },
                onJoin = { viewModel.join(call.id) },
                onConnected = { viewModel.markConnected(call.id) },
                onEnd = { viewModel.end(call.id) },
            )
        }

        state.activeJoin?.let { join ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF102A1C)), shape = RoundedCornerShape(18.dp)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Secure realtime token ready", color = Color.White, fontWeight = FontWeight.Bold)
                        Text("Room: ${join.token.roomId}", color = Color.White)
                        Text("Participant: ${join.token.participantId}", color = Color.White)
                        Text("Next: attach Cloudflare RealtimeKit native UI and call Connected when media renders.", color = Color(0xFFEAD9B8))
                    }
                }
            }
        }
    }
}

@Composable
private fun RecipientIdentityCard(state: PrivateVideoCallUiState) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF050505)), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("VIDEO CALL WITH", color = Color(0xFFE4B122), fontWeight = FontWeight.Bold)
            if (state.recipientId.isBlank()) {
                Text("No recipient selected", color = Color.White, fontWeight = FontWeight.Bold)
                Text("Open another user's profile or creator card, then tap 📹 Video Call.", color = Color(0xFFEAD9B8))
            } else {
                Text("@${state.recipientName.ifBlank { "username" }}", color = Color.White, fontWeight = FontWeight.Bold)
                Text(state.recipientName.ifBlank { "Paragon Member" }, color = Color(0xFFEAD9B8))
                Text(state.recipientRole.ifBlank { "Paragon Member" }, color = Color(0xFFEAD9B8))
            }
        }
    }
}

@Composable
private fun CallCard(
    call: PrivateCallSession,
    currentUid: String,
    onAccept: () -> Unit,
    onCancel: () -> Unit,
    onDecline: () -> Unit,
    onJoin: () -> Unit,
    onConnected: () -> Unit,
    onEnd: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151515)), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (call.status == "RINGING" && call.recipientId == currentUid) {
                Text("📹 Incoming Video Call", color = Color.White, fontWeight = FontWeight.Bold)
                Text("${call.requesterName} wants a ${call.durationMinutes}-minute video call.", color = Color(0xFFEAD9B8))
            }
            if (call.status == "RINGING" && call.requesterId == currentUid) {
                Text("CALL REQUEST SENT", color = Color.White, fontWeight = FontWeight.Bold)
                Text("Waiting for ${call.recipientName} to respond...", color = Color(0xFFEAD9B8))
            }
            Text("${call.planLabel} • ${call.durationMinutes} min • ${call.priceParag} PARAG", color = Color.White, fontWeight = FontWeight.Bold)
            Text("${call.requesterName} → ${call.recipientName}", color = Color(0xFFEAD9B8))
            Text("Status: ${call.status}", color = Color.White)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                if (call.status == "RINGING" && call.recipientId == currentUid) {
                    Button(onClick = onAccept, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF147D4A))) { Text("Accept") }
                    Button(onClick = onDecline, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF641E16))) { Text("Decline") }
                }
                if (call.status == "RINGING" && call.requesterId == currentUid) {
                    Button(onClick = onCancel, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF641E16))) { Text("Cancel Request") }
                }
                if (call.status in listOf("ACCEPTED", "CONNECTING", "CONNECTED")) {
                    Button(onClick = onJoin, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE4B122))) { Text("Join", color = Color.Black) }
                    Button(onClick = onConnected) { Text("Connected") }
                    Button(onClick = onEnd) { Text("End") }
                }
            }
        }
    }
}
