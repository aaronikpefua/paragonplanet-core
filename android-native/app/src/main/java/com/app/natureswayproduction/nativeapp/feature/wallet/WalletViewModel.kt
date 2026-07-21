package com.app.natureswayproduction.nativeapp.feature.wallet

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.api.WalletBalance
import com.app.natureswayproduction.nativeapp.data.api.WalletBankOption
import com.app.natureswayproduction.nativeapp.data.api.WalletProduct
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.app.natureswayproduction.nativeapp.data.billing.BillingEvent
import com.app.natureswayproduction.nativeapp.data.billing.BillingRepository
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class WalletViewModel(
    private val sessionRepository: SessionRepository,
    private val apiService: ParagonApiService,
    private val billingRepository: BillingRepository,
    private val appCheckRepository: AppCheckRepository,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        collectBillingEvents()
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    status = "Refreshing wallet...",
                    message = null
                )
            }

            val diagnostics = mutableListOf(
                "Wallet balance endpoint: GET /api/wallet/balance",
                "Google Billing verify endpoint: POST /api/google-play-billing/wallet/verify",
                "Deposit endpoint: POST /deposit/initialize",
                "Withdraw endpoint: POST /withdraw/request",
            )

            try {
                val session = sessionRepository.loadSessionSummary()
                val uid = session.uid ?: throw IllegalStateException("Sign in first to load wallet.")
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first to load wallet.")

                val balance = runCatching { apiService.fetchWalletBalance(idToken) }
                    .recoverCatching { apiService.ensureWallet(idToken) }
                    .getOrThrow()

                val transactions = loadTransactions(uid)

                val products = runCatching { billingRepository.queryProducts() }
                    .onSuccess { diagnostics += "Google Billing products: ${it.size}" }
                    .onFailure { diagnostics += "Google Billing query: ${it.message ?: "failed"}" }
                    .getOrDefault(emptyList())

                runCatching { billingRepository.syncExistingPurchases() }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        status = "Wallet ready.",
                        balance = balance,
                        products = products,
                        transactions = transactions,
                        diagnostics = diagnostics,
                        googleBillingMessage = if (products.isEmpty()) {
                            "Google Play Billing connected, but no wallet packs are available for this account yet."
                        } else ""
                    )
                }
            } catch (error: Exception) {
                diagnostics += "Refresh error: ${error.message ?: error.javaClass.simpleName}"
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        status = "Wallet needs attention.",
                        diagnostics = diagnostics,
                        message = error.message ?: "Wallet refresh failed."
                    )
                }
            }
        }
    }

    fun openDeposit() {
        _uiState.update {
            it.copy(
                showDeposit = true,
                depositMessage = "",
                message = null
            )
        }
        if (_uiState.value.products.isEmpty()) {
            refresh()
        }
    }

    fun closeDeposit() {
        _uiState.update { it.copy(showDeposit = false, depositMessage = "") }
    }

    fun openWithdraw() {
        _uiState.update {
            it.copy(
                showWithdraw = true,
                message = null
            )
        }
        loadBanks()
    }

    fun closeWithdraw() {
        _uiState.update {
            it.copy(
                showWithdraw = false,
                selectedBankCode = "",
                accountNumber = "",
                accountName = "",
                withdrawAmount = ""
            )
        }
    }

    fun updateDepositAmount(value: String) {
        _uiState.update { it.copy(depositAmount = value.filter(Char::isDigit)) }
    }

    fun updateWithdrawAmount(value: String) {
        _uiState.update { it.copy(withdrawAmount = value.filter(Char::isDigit)) }
    }

    fun updateAccountNumber(value: String) {
        _uiState.update { it.copy(accountNumber = value.filter(Char::isDigit), accountName = "") }
    }

    fun updateSelectedBank(code: String) {
        _uiState.update { it.copy(selectedBankCode = code, accountName = "") }
    }

    fun convertParagToGbazilo() {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isConverting = true, message = null) }
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                apiService.convertParagToGbazilo(idToken, appCheckToken)
                refresh()
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(message = error.message ?: "Conversion failed")
                }
            } finally {
                _uiState.update { it.copy(isConverting = false) }
            }
        }
    }

    fun convertGbaziloToParag() {
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isConverting = true, message = null) }
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                apiService.convertGbaziloToParag(idToken, appCheckToken)
                refresh()
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(message = error.message ?: "Conversion failed")
                }
            } finally {
                _uiState.update { it.copy(isConverting = false) }
            }
        }
    }

    fun loadBanks() {
        viewModelScope.launch {
            try {
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                val banks = apiService.listBanks(idToken, appCheckToken)
                _uiState.update {
                    it.copy(banks = banks, message = if (banks.isEmpty()) "No banks returned yet." else null)
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(message = error.message ?: "Could not load bank list.")
                }
            }
        }
    }

    fun verifyAccount() {
        viewModelScope.launch {
            val state = _uiState.value
            if (state.selectedBankCode.isBlank() || state.accountNumber.isBlank()) {
                _uiState.update { it.copy(message = "Enter account number and select bank") }
                return@launch
            }
            try {
                _uiState.update { it.copy(isVerifyingAccount = true, message = null) }
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                val result = apiService.resolveBankAccount(
                    idToken = idToken,
                    appCheckToken = appCheckToken,
                    accountNumber = state.accountNumber,
                    bankCode = state.selectedBankCode
                )
                _uiState.update { it.copy(accountName = result.accountName) }
            } catch (error: Exception) {
                _uiState.update { it.copy(message = error.message ?: "Account verification failed.") }
            } finally {
                _uiState.update { it.copy(isVerifyingAccount = false) }
            }
        }
    }

    fun handleDepositPaystack() {
        viewModelScope.launch {
            val amount = _uiState.value.depositAmount.toIntOrNull() ?: 0
            if (amount < 100) {
                _uiState.update { it.copy(depositMessage = "Minimum deposit is ₦100") }
                return@launch
            }

            try {
                _uiState.update { it.copy(isProcessing = true, depositMessage = "") }
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                val result = apiService.initializeDeposit(idToken, appCheckToken, amount)
                if (result.authorizationUrl.isBlank()) {
                    throw IllegalStateException("Deposit could not be initialized. Please try again.")
                }
                _uiState.update {
                    it.copy(
                        pendingExternalUrl = result.authorizationUrl,
                        depositMessage = "Opening Paystack..."
                    )
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(depositMessage = error.message ?: "Deposit could not be initialized. Please try again.")
                }
            } finally {
                _uiState.update { it.copy(isProcessing = false) }
            }
        }
    }

    fun consumePendingExternalUrl() {
        _uiState.update { it.copy(pendingExternalUrl = null) }
    }

    fun purchase(activity: Activity, productId: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    purchaseInFlightProductId = productId,
                    depositMessage = "Launching Google Play purchase for $productId..."
                )
            }

            try {
                billingRepository.launchPurchase(activity, productId)
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        purchaseInFlightProductId = null,
                        depositMessage = error.message ?: "Failed to launch purchase."
                    )
                }
            }
        }
    }

    fun handleWithdraw() {
        viewModelScope.launch {
            val state = _uiState.value
            val amount = state.withdrawAmount.toIntOrNull() ?: 0
            if (amount <= 0) {
                _uiState.update { it.copy(message = "Enter withdrawal amount") }
                return@launch
            }
            try {
                _uiState.update { it.copy(isProcessing = true, message = null) }
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in first")
                val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
                apiService.requestWithdraw(
                    idToken = idToken,
                    appCheckToken = appCheckToken,
                    amount = amount,
                    bankCode = state.selectedBankCode,
                    accountNumber = state.accountNumber
                )
                _uiState.update {
                    it.copy(
                        message = "Withdrawal request submitted",
                        showWithdraw = false,
                        selectedBankCode = "",
                        accountNumber = "",
                        accountName = "",
                        withdrawAmount = ""
                    )
                }
                refresh()
            } catch (error: Exception) {
                _uiState.update { it.copy(message = error.message ?: "Withdrawal failed") }
            } finally {
                _uiState.update { it.copy(isProcessing = false) }
            }
        }
    }

    private fun collectBillingEvents() {
        viewModelScope.launch {
            billingRepository.events.collect { event ->
                when (event) {
                    is BillingEvent.Purchased -> verifyPurchase(event)
                    is BillingEvent.Pending -> {
                        _uiState.update {
                            it.copy(
                                purchaseInFlightProductId = null,
                                depositMessage = "Purchase for ${event.productId} is pending approval."
                            )
                        }
                    }

                    BillingEvent.Cancelled -> {
                        _uiState.update {
                            it.copy(
                                purchaseInFlightProductId = null,
                                depositMessage = "Purchase cancelled."
                            )
                        }
                    }

                    is BillingEvent.Error -> {
                        _uiState.update {
                            it.copy(
                                purchaseInFlightProductId = null,
                                depositMessage = event.message
                            )
                        }
                    }
                }
            }
        }
    }

    private fun verifyPurchase(event: BillingEvent.Purchased) {
        viewModelScope.launch {
            try {
                val idToken = sessionRepository.getFreshIdToken()
                    ?: throw IllegalStateException("Sign in again before verifying purchase.")

                val verifyResult = apiService.verifyWalletPurchase(
                    idToken = idToken,
                    productId = event.productId,
                    purchaseToken = event.purchaseToken
                )

                if (!event.acknowledged) {
                    billingRepository.acknowledgeIfNeeded(event.purchaseToken)
                }

                refresh()
                _uiState.update {
                    it.copy(
                        purchaseInFlightProductId = null,
                        showDeposit = false,
                        depositMessage = if (verifyResult.alreadyProcessed) {
                            "This Google Play purchase was already credited."
                        } else {
                            formatCreditedPurchase(verifyResult.creditedParag, verifyResult.creditedGbazilo)
                        },
                        diagnostics = it.diagnostics + "Verified purchase: ${event.productId}"
                    )
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        purchaseInFlightProductId = null,
                        depositMessage = error.message ?: "Purchase verification failed.",
                        diagnostics = it.diagnostics + "Verify error: ${error.message ?: error.javaClass.simpleName}"
                    )
                }
            }
        }
    }

    private suspend fun loadTransactions(uid: String): List<WalletTransactionItem> {
        return runCatching {
            firestore.collection("ledger_entries")
                .whereEqualTo("accountId", uid)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .get()
                .await()
                .documents
                .map { doc ->
                    val data = doc.data.orEmpty()
                    WalletTransactionItem(
                        id = doc.id,
                        direction = data["direction"]?.toString().orEmpty().ifBlank { "entry" },
                        currency = data["currency"]?.toString().orEmpty().ifBlank { "PARAG" },
                        amount = data["amount"]?.toString().orEmpty().ifBlank { "0" },
                        createdAtText = formatTimestamp(data["createdAt"])
                    )
                }
        }.getOrDefault(emptyList())
    }

    private fun formatTimestamp(value: Any?): String {
        val millis = (value as? Timestamp)?.toDate()?.time ?: return ""
        return SimpleDateFormat("MMM d, yyyy h:mm a", Locale.getDefault()).format(Date(millis))
    }

    private fun formatCreditedPurchase(parag: Int, gbazilo: Int): String {
        val parts = buildList {
            if (parag > 0) add("$parag PARAG")
            if (gbazilo > 0) add("$gbazilo GBAZILO")
        }
        return "${parts.joinToString(" and ")} credited to your wallet."
    }

    companion object {
        fun factory(
            sessionRepository: SessionRepository,
            apiService: ParagonApiService,
            billingRepository: BillingRepository,
            appCheckRepository: AppCheckRepository,
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                if (modelClass.isAssignableFrom(WalletViewModel::class.java)) {
                    @Suppress("UNCHECKED_CAST")
                    return WalletViewModel(
                        sessionRepository = sessionRepository,
                        apiService = apiService,
                        billingRepository = billingRepository,
                        appCheckRepository = appCheckRepository
                    ) as T
                }
                throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
            }
        }
    }
}

data class WalletTransactionItem(
    val id: String,
    val direction: String,
    val currency: String,
    val amount: String,
    val createdAtText: String,
)

data class WalletUiState(
    val isLoading: Boolean = true,
    val isProcessing: Boolean = false,
    val isVerifyingAccount: Boolean = false,
    val isConverting: Boolean = false,
    val status: String = "Preparing wallet...",
    val balance: WalletBalance = WalletBalance(parag = 0, gbazilo = 0),
    val transactions: List<WalletTransactionItem> = emptyList(),
    val products: List<WalletProduct> = emptyList(),
    val banks: List<WalletBankOption> = emptyList(),
    val diagnostics: List<String> = emptyList(),
    val purchaseInFlightProductId: String? = null,
    val message: String? = null,
    val depositMessage: String = "",
    val googleBillingMessage: String = "",
    val showDeposit: Boolean = false,
    val showWithdraw: Boolean = false,
    val depositAmount: String = "",
    val withdrawAmount: String = "",
    val selectedBankCode: String = "",
    val accountNumber: String = "",
    val accountName: String = "",
    val pendingExternalUrl: String? = null,
)
