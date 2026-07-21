package com.app.natureswayproduction.nativeapp.data.billing

sealed interface BillingEvent {
    data class Purchased(
        val productId: String,
        val purchaseToken: String,
        val acknowledged: Boolean,
    ) : BillingEvent

    data class Pending(
        val productId: String,
    ) : BillingEvent

    data class Error(
        val message: String,
    ) : BillingEvent

    data object Cancelled : BillingEvent
}
