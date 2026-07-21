package com.app.natureswayproduction.nativeapp.data.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.app.natureswayproduction.nativeapp.data.api.WalletProduct
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class BillingRepository(context: Context) {
    private val productCatalog = listOf(
        ProductSeed("parag_5", "Parag 5", 5, 0),
        ProductSeed("gbazilo_1", "Gbazilo 1", 0, 1),
        ProductSeed("gbazilo_2", "Gbazilo 2", 0, 2),
        ProductSeed("gbazilo_5", "Gbazilo 5", 0, 5),
        ProductSeed("gbazilo_10", "Gbazilo 10", 0, 10),
    )

    private val productDetailsById = linkedMapOf<String, ProductDetails>()
    private val _events = MutableSharedFlow<BillingEvent>(
        replay = 0,
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<BillingEvent> = _events.asSharedFlow()

    private val billingClient = BillingClient.newBuilder(context.applicationContext)
        .enablePendingPurchases()
        .setListener(::onPurchasesUpdated)
        .build()

    suspend fun queryProducts(): List<WalletProduct> {
        val client = ensureReady()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                productCatalog.map { seed ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(seed.productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                }
            )
            .build()

        val result = queryProductDetails(client, params)

        productDetailsById.clear()
        result.productDetailsList.orEmpty().forEach { details ->
            productDetailsById[details.productId] = details
        }

        return productCatalog.mapNotNull { seed ->
            val details = productDetailsById[seed.productId] ?: return@mapNotNull null
            val offer = details.oneTimePurchaseOfferDetails
            WalletProduct(
                productId = seed.productId,
                displayName = details.name.ifBlank { seed.displayName },
                parag = seed.parag,
                gbazilo = seed.gbazilo,
                priceLabel = offer?.formattedPrice.orEmpty(),
                description = details.description
            )
        }
    }

    suspend fun syncExistingPurchases() {
        val client = ensureReady()
        val result = queryPurchases(
            client,
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )
        emitPurchaseEvents(result)
    }

    suspend fun launchPurchase(activity: Activity, productId: String) {
        val details = productDetailsById[productId]
            ?: throw IllegalStateException("Product details not loaded for $productId")

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .build()
                )
            )
            .build()

        val result = billingClient.launchBillingFlow(activity, flowParams)
        if (result.responseCode != BillingResponseCode.OK) {
            throw IllegalStateException(result.debugMessage.ifBlank {
                "Billing launch failed with ${result.responseCode}"
            })
        }
    }

    suspend fun acknowledgeIfNeeded(purchaseToken: String) {
        val purchase = purchaseFromCurrentSnapshot(purchaseToken) ?: return
        if (purchase.isAcknowledged) return
        val client = ensureReady()
        val result = acknowledgePurchase(
            client,
            AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build()
        )
        if (result.responseCode != BillingResponseCode.OK) {
            throw IllegalStateException(result.debugMessage.ifBlank {
                "Acknowledge failed with ${result.responseCode}"
            })
        }
    }

    private fun purchaseFromCurrentSnapshot(purchaseToken: String): Purchase? {
        return latestPurchases.firstOrNull { it.purchaseToken == purchaseToken }
    }

    private var latestPurchases: List<Purchase> = emptyList()

    private fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingResponseCode.OK -> emitPurchaseEvents(purchases.orEmpty())
            BillingResponseCode.USER_CANCELED -> _events.tryEmit(BillingEvent.Cancelled)
            else -> _events.tryEmit(
                BillingEvent.Error(
                    result.debugMessage.ifBlank { "Billing error ${result.responseCode}" }
                )
            )
        }
    }

    private fun emitPurchaseEvents(purchases: List<Purchase>) {
        latestPurchases = purchases
        purchases.forEach { purchase ->
            val productId = purchase.products.firstOrNull().orEmpty()
            when (purchase.purchaseState) {
                Purchase.PurchaseState.PURCHASED -> _events.tryEmit(
                    BillingEvent.Purchased(productId, purchase.purchaseToken, purchase.isAcknowledged)
                )
                Purchase.PurchaseState.PENDING -> _events.tryEmit(BillingEvent.Pending(productId))
                else -> Unit
            }
        }
    }

    private suspend fun ensureReady(): BillingClient {
        if (billingClient.isReady) return billingClient
        return suspendCancellableCoroutine { continuation ->
            billingClient.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (continuation.isCompleted) return
                    if (billingResult.responseCode == BillingResponseCode.OK) {
                        continuation.resume(billingClient)
                    } else {
                        continuation.resumeWith(
                            Result.failure(
                                IllegalStateException(
                                    billingResult.debugMessage.ifBlank {
                                        "Billing setup failed with ${billingResult.responseCode}"
                                    }
                                )
                            )
                        )
                    }
                }

                override fun onBillingServiceDisconnected() {
                    if (continuation.isCompleted) return
                    continuation.resumeWith(
                        Result.failure(IllegalStateException("Billing service disconnected"))
                    )
                }
            })
        }
    }

    private suspend fun queryProductDetails(
        client: BillingClient,
        params: QueryProductDetailsParams,
    ): ProductDetailsResult = suspendCancellableCoroutine { continuation ->
        client.queryProductDetailsAsync(params, ProductDetailsResponseListener { billingResult, productDetailsList ->
            if (continuation.isCompleted) return@ProductDetailsResponseListener
            if (billingResult.responseCode == BillingResponseCode.OK) {
                continuation.resume(ProductDetailsResult(billingResult, productDetailsList.orEmpty()))
            } else {
                continuation.resumeWithException(
                    IllegalStateException(
                        billingResult.debugMessage.ifBlank {
                            "Product query failed with ${billingResult.responseCode}"
                        }
                    )
                )
            }
        })
    }

    private suspend fun queryPurchases(
        client: BillingClient,
        params: QueryPurchasesParams,
    ): List<Purchase> = suspendCancellableCoroutine { continuation ->
        client.queryPurchasesAsync(params, PurchasesResponseListener { billingResult, purchases ->
            if (continuation.isCompleted) return@PurchasesResponseListener
            if (billingResult.responseCode == BillingResponseCode.OK) {
                continuation.resume(purchases.orEmpty())
            } else {
                continuation.resumeWithException(
                    IllegalStateException(
                        billingResult.debugMessage.ifBlank {
                            "Purchase query failed with ${billingResult.responseCode}"
                        }
                    )
                )
            }
        })
    }

    private suspend fun acknowledgePurchase(
        client: BillingClient,
        params: AcknowledgePurchaseParams,
    ): BillingResult = suspendCancellableCoroutine { continuation ->
        client.acknowledgePurchase(params) { billingResult ->
            if (continuation.isCompleted) return@acknowledgePurchase
            continuation.resume(billingResult)
        }
    }

    private data class ProductSeed(
        val productId: String,
        val displayName: String,
        val parag: Int,
        val gbazilo: Int,
    )

    private data class ProductDetailsResult(
        val billingResult: BillingResult,
        val productDetailsList: List<ProductDetails>,
    )
}
