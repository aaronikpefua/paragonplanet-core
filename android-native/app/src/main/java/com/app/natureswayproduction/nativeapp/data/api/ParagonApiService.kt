package com.app.natureswayproduction.nativeapp.data.api

import android.os.SystemClock
import android.util.Log
import com.app.natureswayproduction.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class ParagonApiService {
    private val perfRunId = "android_" + SystemClock.elapsedRealtime().toString(36)

    private val bottleActionKeys = listOf(
        "mineral",
        "malt",
        "juice",
        "mocktail",
        "beer",
        "gin",
        "rum",
        "vodka",
        "whiskey",
        "cocktail",
    )

    suspend fun fetchAuthenticatedUser(idToken: String): MobileUser = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/auth/me",
            method = "GET",
            authorization = "Bearer $idToken"
        )
        val json = JSONObject(response)
        MobileUser(
            uid = json.optString("uid"),
            email = json.optString("email").ifBlank { null },
            role = json.optString("role").ifBlank { null }
        )
    }

    suspend fun startNativeXAuth(): NativeXAuthStart = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/native-x-auth/start",
            method = "POST",
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString()
        )
        val json = JSONObject(response)
        NativeXAuthStart(
            authUrl = json.optString("authUrl"),
            requestToken = json.optString("requestToken"),
            state = json.optString("state")
        )
    }

    suspend fun fetchRealtimeCallPlans(idToken: String, appCheckToken: String? = null): CallPlansResponse = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/realtime/plans",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
        )
        val json = JSONObject(response)
        val plansArray = json.optJSONArray("plans") ?: JSONArray()
        CallPlansResponse(
            plans = buildList {
                for (index in 0 until plansArray.length()) {
                    val item = plansArray.getJSONObject(index)
                    add(
                        CallPlan(
                            id = item.optString("id"),
                            label = item.optString("label"),
                            durationMinutes = item.optInt("durationMinutes", 0),
                            priceParag = item.optInt("priceParag", 0),
                            participantLimit = item.optInt("participantLimit", 2),
                        )
                    )
                }
            },
            provider = json.optJSONObject("provider")?.toRealtimeProviderInfo() ?: RealtimeProviderInfo(
                provider = "cloudflare-realtimekit",
                configured = false,
                recordingDefault = "OFF",
            )
        )
    }

    suspend fun startParagonLive(
        idToken: String,
        appCheckToken: String?,
        hostRole: String,
        purpose: String,
        title: String,
        description: String,
    ): StartLiveResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/start",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("hostRole", hostRole)
                .put("purpose", purpose)
                .put("title", title)
                .put("description", description)
                .put("audience", "Public")
                .toString(),
        )
        JSONObject(response).toStartLiveResult()
    }

    suspend fun scheduleParagonLive(
        idToken: String,
        appCheckToken: String?,
        hostRole: String,
        purpose: String,
        title: String,
        description: String,
        scheduledAt: String,
    ): LiveSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/schedule",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("hostRole", hostRole)
                .put("purpose", purpose)
                .put("title", title)
                .put("description", description)
                .put("audience", "Public")
                .put("scheduledAt", scheduledAt)
                .toString(),
        )
        JSONObject(response).getJSONObject("session").toLiveSession()
    }

    suspend fun endParagonLive(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
    ): LiveSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/end",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString(),
        )
        JSONObject(response).getJSONObject("session").toLiveSession()
    }

    suspend fun markParagonLiveActive(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
    ): LiveSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/active",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString(),
        )
        JSONObject(response).getJSONObject("session").toLiveSession()
    }

    suspend fun heartbeatParagonLive(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
    ): LiveSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/heartbeat",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString(),
        )
        JSONObject(response).getJSONObject("session").toLiveSession()
    }

    suspend fun listParagonLiveSessions(
        idToken: String,
        appCheckToken: String?,
        tab: String,
    ): LiveSessionsResponse = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions?tab=${java.net.URLEncoder.encode(tab, "UTF-8")}",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
        )
        JSONObject(response).toLiveSessionsResponse()
    }

    suspend fun fetchParagonLiveChat(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
    ): List<LiveChatMessage> = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/chat",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
        )
        val array = JSONObject(response).optJSONArray("messages") ?: JSONArray()
        buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(item.toLiveChatMessage())
            }
        }
    }

    suspend fun fetchParagonLiveRoomToken(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
    ): LiveRoomTokenResponse = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/room-token",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
        )
        JSONObject(response).toLiveRoomTokenResponse()
    }

    suspend fun postParagonLiveChat(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
        text: String,
    ): LiveChatMessage = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/live/sessions/$sessionId/chat",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().put("text", text).toString(),
        )
        JSONObject(response).getJSONObject("message").toLiveChatMessage()
    }

    suspend fun sendParagonLiveSupport(
        idToken: String,
        appCheckToken: String?,
        sessionId: String,
        actionKey: String,
        customParagAmount: Int? = null,
        customGbaziloAmount: Int? = null,
    ): LiveSupportResult = withContext(Dispatchers.IO) {
        val payload = JSONObject().put("actionKey", actionKey)
        if (customParagAmount != null) payload.put("customParagAmount", customParagAmount)
        if (customGbaziloAmount != null) payload.put("customGbaziloAmount", customGbaziloAmount)
        val response = request(
            path = "/api/live/sessions/$sessionId/support",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = payload.toString(),
        )
        val json = JSONObject(response)
        LiveSupportResult(
            ok = json.optBoolean("ok", true),
            sessionId = json.optString("sessionId"),
            actionKey = json.optString("actionKey"),
            amountParag = json.optInt("amountParag", 0),
            amountGbazilo = json.optInt("amountGbazilo", 0),
        )
    }

    suspend fun requestPrivateVideoCall(
        idToken: String,
        appCheckToken: String?,
        recipientId: String,
        planId: String,
        idempotencyKey: String,
    ): PrivateCallSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/realtime/calls/request",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("recipientId", recipientId)
                .put("planId", planId)
                .put("idempotencyKey", idempotencyKey)
                .toString(),
        )
        JSONObject(response).getJSONObject("call").toPrivateCallSession()
    }

    suspend fun fetchMyRealtimeCalls(idToken: String, appCheckToken: String? = null): List<PrivateCallSession> = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/realtime/calls",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
        )
        val array = JSONObject(response).optJSONArray("calls") ?: JSONArray()
        buildList {
            for (index in 0 until array.length()) {
                add(array.getJSONObject(index).toPrivateCallSession())
            }
        }
    }

    suspend fun updateRealtimeCall(
        idToken: String,
        appCheckToken: String?,
        callId: String,
        action: String,
    ): PrivateCallSession = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/realtime/calls/$callId/$action",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString(),
        )
        JSONObject(response).getJSONObject("call").toPrivateCallSession()
    }

    suspend fun joinRealtimeCall(
        idToken: String,
        appCheckToken: String?,
        callId: String,
    ): JoinCallResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/realtime/calls/$callId/join",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject().toString(),
        )
        val json = JSONObject(response)
        JoinCallResult(
            call = json.getJSONObject("call").toPrivateCallSession(),
            token = json.getJSONObject("token").toRealtimeToken(),
        )
    }

    suspend fun fetchFeed(appCheckToken: String? = null): List<VideoSummary> = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/video/list",
            method = "GET",
            appCheckToken = appCheckToken
        )
        val array = JSONArray(response)
        buildList {
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                add(
                    VideoSummary(
                        id = item.optString("videoId").ifBlank { "video-$index" },
                        creatorUid = item.optString("uid")
                            .ifBlank { item.optString("userId") }
                            .ifBlank { null },
                        title = item.optString("title").ifBlank { "Untitled performance" },
                        category = item.optString("category").ifBlank { "General" },
                        performerName = item.optString("displayName")
                            .ifBlank { item.optString("performerName") }
                            .ifBlank { item.optString("creatorName") }
                            .ifBlank { item.optString("username") }
                            .ifBlank { item.optString("userName") }
                            .ifBlank { item.optString("stageName") }
                            .ifBlank { item.optString("realName") }
                            .ifBlank { "Paragon Creator" },
                        description = item.optString("description")
                            .ifBlank { item.optString("about") }
                            .ifBlank { "Live performance from the Paragon Planet feed." },
                        supportCount = item.optInt("votes", 0),
                        commentCount = item.optInt("comments", item.optInt("commentCount", 0)),
                        viewCount = item.optInt("views", 0),
                        pourCount = item.optJSONObject("supportCounts")?.optInt("pour_me_water", 0) ?: 0,
                        sprayCount = item.optJSONObject("supportCounts")?.optInt("spray_money", 0) ?: 0,
                        bottleCount = item.optJSONObject("supportCounts")?.let { counts ->
                            bottleActionKeys.sumOf { key -> counts.optInt(key, 0) }
                        } ?: 0,
                        thumbnailUrl = item.optString("thumbnailUrl")
                            .ifBlank { item.optString("coverImage") }
                            .ifBlank { item.optString("posterUrl") }
                            .ifBlank { item.optString("poster") }
                            .ifBlank { item.optString("coverUrl") }
                            .ifBlank { item.optString("thumbnail") }
                            .ifBlank { null },
                        streamUrl = item.optString("streamUrl").ifBlank { null },
                        mobileUrl = item.optString("mobileUrl").ifBlank { null },
                        desktopUrl = item.optString("desktopUrl").ifBlank { null },
                        originalUrl = item.optString("originalUrl").ifBlank { null },
                        fileUrl = item.optString("fileUrl").ifBlank { null },
                        objectPath = item.optString("objectPath").ifBlank { null },
                        visibility = item.optString("visibility"),
                        uploadPurpose = item.optString("uploadPurpose"),
                        source = item.optString("source"),
                    )
                )
            }
        }
    }

    suspend fun requestVideoUpload(
        idToken: String,
        appCheckToken: String?,
        payload: UploadRequestPayload,
    ): UploadTicket = withContext(Dispatchers.IO) {
        val response = request(
            path = "/generate-upload-url",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("title", payload.title)
                .put("description", payload.description)
                .put("category", payload.category)
                .put("fileName", payload.fileName)
                .put("fileType", payload.fileType)
                .put("fileSize", payload.fileSize)
                .put("durationSeconds", payload.durationSeconds)
                .put("uploadPurpose", payload.uploadPurpose)
                .toString()
        )
        val json = JSONObject(response)
        val objectPath = json.optString("fileName")
        val fileUrl = json.optString("fileUrl")
        val videoId = json.optJSONObject("video")?.optString("videoId").orEmpty().ifBlank {
            objectPath.substringAfterLast("/").substringBefore("-")
        }
        UploadTicket(
            uploadUrl = json.optString("uploadUrl"),
            objectPath = objectPath,
            fileUrl = fileUrl,
            videoId = videoId,
        )
    }

    suspend fun triggerVideoCompression(
        idToken: String,
        appCheckToken: String?,
        objectPath: String,
        fileUrl: String,
        videoId: String,
        title: String,
        description: String,
        category: String,
        durationSeconds: Int,
    ) = withContext(Dispatchers.IO) {
        request(
            path = "/trigger-compression",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("fileName", objectPath)
                .put("originalUrl", fileUrl)
                .put("videoId", videoId)
                .put("title", title)
                .put("description", description)
                .put("category", category)
                .put("durationSeconds", durationSeconds)
                .toString()
        )
    }

    suspend fun triggerMerchantProductCompression(
        idToken: String,
        appCheckToken: String?,
        objectPath: String,
        fileUrl: String,
        productId: String,
    ) = withContext(Dispatchers.IO) {
        request(
            path = "/trigger-merchant-product-compression",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("fileName", objectPath)
                .put("originalUrl", fileUrl)
                .put("productId", productId)
                .toString()
        )
    }

    suspend fun ensureWallet(idToken: String): WalletBalance = withContext(Dispatchers.IO) {
        request(
            path = "/api/wallet/create",
            method = "POST",
            authorization = "Bearer $idToken"
        )
        fetchWalletBalance(idToken)
    }

    suspend fun fetchWalletBalance(idToken: String): WalletBalance = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/wallet/balance",
            method = "GET",
            authorization = "Bearer $idToken"
        )
        val json = JSONObject(response)
        val balance = json.optJSONObject("balance") ?: JSONObject()
        WalletBalance(
            parag = balance.optInt("PARAG", 0),
            gbazilo = balance.optInt("GBAZILO", 0)
        )
    }

    suspend fun verifyWalletPurchase(
        idToken: String,
        productId: String,
        purchaseToken: String,
    ): WalletVerifyResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/google-play-billing/wallet/verify",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject()
                .put("productId", productId)
                .put("purchaseToken", purchaseToken)
                .toString()
        )
        val json = JSONObject(response)
        WalletVerifyResult(
            ok = json.optBoolean("ok", false),
            alreadyProcessed = json.optBoolean("alreadyProcessed", false),
            creditedParag = json.optInt("creditedParag", 0),
            creditedGbazilo = json.optInt("creditedGbazilo", 0)
        )
    }

    suspend fun supportRoleProfile(
        idToken: String,
        rolePath: String,
        profileId: String,
        actionKey: String,
        amountParag: Int = 1,
    ) = withContext(Dispatchers.IO) {
        request(
            path = "/support/$rolePath/$profileId",
            method = "POST",
            authorization = "Bearer $idToken",
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("actionKey", actionKey)
                .put("amountParag", amountParag)
                .toString()
        )
    }


    suspend fun settleMarketplaceOrder(
        idToken: String,
        orderId: String,
    ): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/pay",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject().put("orderId", orderId).toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun sendMarketplaceFinalOffer(
        idToken: String,
        orderId: String,
        amount: Double,
        message: String,
    ): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/final-offer",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject()
                .put("orderId", orderId)
                .put("amount", amount)
                .put("message", message)
                .toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun submitMarketplaceDelivery(
        idToken: String,
        orderId: String,
        deliveryNote: String = "",
        links: List<String> = emptyList(),
        accessCodes: List<String> = emptyList(),
    ): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("orderId", orderId)
            put("deliveryNote", deliveryNote)
            val linksArr = JSONArray(); links.forEach { linksArr.put(it) }; put("links", linksArr)
            val codesArr = JSONArray(); accessCodes.forEach { codesArr.put(it) }; put("accessCodes", codesArr)
        }
        val response = request(
            path = "/api/marketplace/deliver",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = body.toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun confirmMarketplaceDelivery(
        idToken: String,
        orderId: String,
    ): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/confirm",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject().put("orderId", orderId).toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun cancelMarketplaceOrder(
        idToken: String,
        orderId: String,
        reason: String = "",
    ): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/cancel",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject().put("orderId", orderId).put("reason", reason).toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun openMarketplaceDispute(
        idToken: String,
        orderId: String,
        reason: String,
        description: String,
    ): Boolean = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/dispute",
            method = "POST",
            authorization = "Bearer $idToken",
            jsonBody = JSONObject()
                .put("orderId", orderId)
                .put("reason", reason)
                .put("description", description)
                .toString()
        )
        val json = JSONObject(response)
        json.optBoolean("success", false)
    }

    suspend fun getMarketplaceNotifications(idToken: String): List<MarketplaceNotification> = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/marketplace/notifications",
            method = "GET",
            authorization = "Bearer $idToken"
        )
        val array = JSONArray(response)
        buildList {
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                add(MarketplaceNotification(
                    id = obj.optString("id"),
                    type = obj.optString("type"),
                    title = obj.optString("title"),
                    body = obj.optString("body"),
                    orderId = obj.optString("orderId"),
                    read = obj.optBoolean("read", false),
                ))
            }
        }
    }

    suspend fun listBanks(
        idToken: String,
        appCheckToken: String?,
    ): List<WalletBankOption> = withContext(Dispatchers.IO) {
        val response = request(
            path = "/bank/list",
            method = "GET",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true
        )
        val array = JSONArray(response)
        buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(
                    WalletBankOption(
                        code = item.optString("code"),
                        name = item.optString("name")
                    )
                )
            }
        }
    }

    suspend fun resolveBankAccount(
        idToken: String,
        appCheckToken: String?,
        accountNumber: String,
        bankCode: String,
    ): WalletBankResolveResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/bank/resolve",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("accountNumber", accountNumber)
                .put("bankCode", bankCode)
                .toString()
        )
        val json = JSONObject(response)
        WalletBankResolveResult(
            accountName = json.optString("accountName")
        )
    }

    suspend fun convertParagToGbazilo(
        idToken: String,
        appCheckToken: String?,
    ) = withContext(Dispatchers.IO) {
        request(
            path = "/convert/parag-to-gbazilo",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true
        )
    }

    suspend fun convertGbaziloToParag(
        idToken: String,
        appCheckToken: String?,
    ) = withContext(Dispatchers.IO) {
        request(
            path = "/convert/gbazilo-to-parag",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true
        )
    }

    suspend fun initializeDeposit(
        idToken: String,
        appCheckToken: String?,
        amount: Int,
    ): WalletDepositInitResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/deposit/initialize",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("amount", amount)
                .toString()
        )
        val json = JSONObject(response)
        WalletDepositInitResult(
            authorizationUrl = json.optString("authorization_url")
        )
    }

    suspend fun verifyDeposit(
        idToken: String,
        appCheckToken: String?,
        reference: String,
    ): WalletDepositVerifyResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/deposit/verify?reference=${java.net.URLEncoder.encode(reference, "UTF-8")}",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true
        )
        val json = JSONObject(response)
        WalletDepositVerifyResult(
            alreadyProcessed = json.optBoolean("alreadyProcessed", false),
            creditedParag = json.optInt("creditedParag", 0)
        )
    }

    suspend fun requestWithdraw(
        idToken: String,
        appCheckToken: String?,
        amount: Int,
        bankCode: String,
        accountNumber: String,
    ): WalletWithdrawalResult = withContext(Dispatchers.IO) {
        val response = request(
            path = "/withdraw/request",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = JSONObject()
                .put("amount", amount)
                .put("bankCode", bankCode)
                .put("accountNumber", accountNumber)
                .toString()
        )
        val json = JSONObject(response)
        WalletWithdrawalResult(ok = json.optBoolean("ok", true))
    }
    suspend fun sendSupportAction(
        idToken: String,
        appCheckToken: String?,
        videoId: String,
        actionKey: String,
        customParagAmount: Int? = null,
        customGbaziloAmount: Int? = null,
    ) = withContext(Dispatchers.IO) {
        val payload = JSONObject().put("actionKey", actionKey)
        if (customParagAmount != null) {
            payload.put("customParagAmount", customParagAmount)
        }
        if (customGbaziloAmount != null) {
            payload.put("customGbaziloAmount", customGbaziloAmount)
        }
        request(
            path = "/support/$videoId",
            method = "POST",
            authorization = "Bearer $idToken",
            appCheckToken = appCheckToken,
            retryWithoutAppCheckOnFailure = true,
            jsonBody = payload.toString()
        )
    }

    private fun request(
        path: String,
        method: String,
        authorization: String? = null,
        appCheckToken: String? = null,
        retryWithoutAppCheckOnFailure: Boolean = false,
        jsonBody: String? = null,
    ): String {
        val firstAttempt = executeRequest(
            path = path,
            method = method,
            authorization = authorization,
            appCheckToken = appCheckToken,
            jsonBody = jsonBody
        )

        if (!retryWithoutAppCheckOnFailure || appCheckToken.isNullOrBlank()) {
            return firstAttempt.requireSuccess()
        }

        if (firstAttempt.statusCode !in 200..299 && firstAttempt.isAppCheckFailure()) {
            return executeRequest(
                path = path,
                method = method,
                authorization = authorization,
                appCheckToken = null,
                jsonBody = jsonBody
            ).requireSuccess()
        }

        return firstAttempt.requireSuccess()
    }

    private fun executeRequest(
        path: String,
        method: String,
        authorization: String? = null,
        appCheckToken: String? = null,
        jsonBody: String? = null,
    ): ApiResponse {
        val startedAt = SystemClock.elapsedRealtime()
        val requestId = "${perfRunId}_${UUID.randomUUID().toString().take(8)}"
        val connection = (URL(BuildConfig.BACKEND_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-Request-Id", requestId)
            authorization?.let { setRequestProperty("Authorization", it) }
            appCheckToken?.let { setRequestProperty("X-Firebase-AppCheck", it) }
            if (jsonBody != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

        if (jsonBody != null) {
            connection.outputStream.use { output ->
                output.write(jsonBody.toByteArray())
            }
        }

        return try {
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.use { input ->
                BufferedReader(InputStreamReader(input)).readText()
            }.orEmpty()

            Log.i(
                "ParagonPerf",
                "event=api.request platform=android method=$method route=${normalizeRoute(path)} statusCode=$statusCode statusClass=${classifyStatus(statusCode)} durationMs=${SystemClock.elapsedRealtime() - startedAt} requestId=$requestId"
            )
            ApiResponse(statusCode = statusCode, body = body)
        } catch (error: Exception) {
            Log.w(
                "ParagonPerf",
                "event=api.request platform=android method=$method route=${normalizeRoute(path)} status=failure errorClass=${classifyException(error)} durationMs=${SystemClock.elapsedRealtime() - startedAt} requestId=$requestId"
            )
            throw error
        }
    }
}

private fun normalizeRoute(path: String): String =
    path
        .replace(Regex("/[A-Za-z0-9_-]{16,}(?=/|$)"), "/:id")
        .replace(Regex("/[A-Za-z0-9_-]{8,}(?=/|$)"), "/:id")

private fun classifyStatus(statusCode: Int): String = when {
    statusCode == 429 -> "RATE_LIMIT"
    statusCode == 401 -> "AUTH"
    statusCode == 403 -> "PERMISSION"
    statusCode == 404 -> "NOT_FOUND"
    statusCode == 409 -> "CONFLICT"
    statusCode >= 500 -> "SERVER"
    statusCode >= 400 -> "VALIDATION"
    else -> "OK"
}

private fun classifyException(error: Exception): String {
    val message = error.message.orEmpty().lowercase()
    return when {
        message.contains("timed out") || message.contains("timeout") -> "TIMEOUT"
        message.contains("network") || message.contains("failed") -> "NETWORK"
        else -> "UNKNOWN"
    }
}

private fun JSONObject.toRealtimeProviderInfo(): RealtimeProviderInfo {
    return RealtimeProviderInfo(
        provider = optString("provider").ifBlank { "cloudflare-realtimekit" },
        configured = optBoolean("configured", false),
        recordingDefault = optString("recordingDefault").ifBlank { "OFF" },
    )
}

private fun JSONObject.toPrivateCallSession(): PrivateCallSession {
    return PrivateCallSession(
        id = optString("id").ifBlank { optString("callId") },
        status = optString("status"),
        requesterId = optString("requesterId"),
        requesterName = optString("requesterName"),
        recipientId = optString("recipientId"),
        recipientName = optString("recipientName"),
        planId = optString("planId"),
        planLabel = optString("planLabel"),
        durationMinutes = optInt("durationMinutes", 0),
        priceParag = optInt("priceParag", 0),
        roomId = optString("roomId").ifBlank { null },
        roomName = optString("roomName").ifBlank { null },
    )
}

private fun JSONObject.toRealtimeToken(): RealtimeToken {
    return RealtimeToken(
        authToken = optString("authToken"),
        roomId = optString("roomId"),
        participantId = optString("participantId"),
        provider = optString("provider").ifBlank { "cloudflare-realtimekit" },
    )
}

private fun JSONObject.toLiveProviderInfo(): LiveProviderInfo {
    val missingArray = optJSONArray("missing") ?: JSONArray()
    return LiveProviderInfo(
        provider = optString("provider").ifBlank { "cloudflare-stream-live" },
        configured = optBoolean("configured", false),
        recordingDefault = optString("recordingDefault").ifBlank { "automatic" },
        missing = buildList {
            for (index in 0 until missingArray.length()) {
                add(missingArray.optString(index))
            }
        },
    )
}

private fun JSONObject.toLiveSession(): LiveSession {
    return LiveSession(
        id = optString("id").ifBlank { optString("liveSessionId") },
        status = optString("status"),
        hostUid = optString("hostUid"),
        hostUsername = optString("hostUsername"),
        hostRole = optString("hostRole"),
        purpose = optString("purpose"),
        title = optString("title"),
        description = optString("description"),
        liveInputId = optString("liveInputId").ifBlank { null },
        playbackId = optString("playbackId").ifBlank { null },
        playbackUrl = optString("playbackUrl").ifBlank { null },
        playbackHlsUrl = optString("playbackHlsUrl").ifBlank { null },
        playbackDashUrl = optString("playbackDashUrl").ifBlank { null },
        webRtcPlaybackUrl = optString("webRtcPlaybackUrl").ifBlank { null },
        playbackWebRtcUrl = optString("playbackWebRtcUrl").ifBlank { null },
        publisherTransport = optString("publisherTransport").ifBlank { null },
        playbackTransport = optString("playbackTransport").ifBlank { null },
        primaryPlayback = optString("primaryPlayback").ifBlank {
            optJSONObject("playbackPolicy")?.optString("primaryPlayback").orEmpty().ifBlank { null }
        },
        fallbackPlayback = optString("fallbackPlayback").ifBlank {
            optJSONObject("playbackPolicy")?.optString("fallbackPlayback").orEmpty().ifBlank { null }
        },
        selectedPlaybackUrl = optString("selectedPlaybackUrl").ifBlank {
            optJSONObject("playbackPolicy")?.optString("selectedPlaybackUrl").orEmpty().ifBlank { null }
        },
        selectedPlaybackTransport = optString("selectedPlaybackTransport").ifBlank {
            optJSONObject("playbackPolicy")?.optString("selectedPlaybackTransport").orEmpty().ifBlank { null }
        },
        playbackPolicyReason = optJSONObject("playbackPolicy")?.optString("reason").orEmpty().ifBlank { null },
        providerLive = optBoolean("providerLive", false),
        viewerPlayable = optBoolean("viewerPlayable", false),
        providerStatus = optString("providerStatus").ifBlank { null },
        providerState = optString("providerState").ifBlank { null },
        lifecycleStatus = optString("lifecycleStatus").ifBlank { null },
        lifecycleLive = optBoolean("lifecycleLive", false),
        activeVideoUid = optString("activeVideoUid").ifBlank { null },
        mediaStatus = optString("mediaStatus").ifBlank { null },
        providerLiveReason = optString("providerLiveReason").ifBlank { null },
        scheduledAt = optString("scheduledAt").ifBlank { null },
        actualStartedAt = optString("actualStartedAt").ifBlank { null },
        wentLiveAt = optString("wentLiveAt").ifBlank { null },
        startedAt = optString("startedAt").ifBlank { null },
        createdAt = optString("createdAt").ifBlank { null },
        endedAt = optString("endedAt").ifBlank { null },
    )
}

private fun JSONObject.toLiveIngestInfo(): LiveIngestInfo {
    return LiveIngestInfo(
        rtmps = optString("rtmps"),
        rtmpsUrl = optString("rtmpsUrl"),
        rtmpsStreamKey = optString("rtmpsStreamKey"),
        srtUrl = optString("srtUrl"),
        srtStreamId = optString("srtStreamId"),
        webRtcPublishUrl = optString("webRtcPublishUrl").ifBlank { optString("webRtcUrl") },
        webRtcUrl = optString("webRtcUrl"),
        whepPlaybackUrl = optString("whepPlaybackUrl"),
        hlsPlaybackUrl = optString("hlsPlaybackUrl"),
    )
}

private fun JSONObject.toStartLiveResult(): StartLiveResult {
    return StartLiveResult(
        session = getJSONObject("session").toLiveSession(),
        ingest = optJSONObject("ingest")?.toLiveIngestInfo() ?: LiveIngestInfo("", "", "", "", "", "", "", "", ""),
        provider = optJSONObject("provider")?.toLiveProviderInfo() ?: LiveProviderInfo("cloudflare-stream-live", false, "automatic"),
    )
}

private fun JSONObject.toLiveSessionsResponse(): LiveSessionsResponse {
    val array = optJSONArray("sessions") ?: JSONArray()
    return LiveSessionsResponse(
        sessions = buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(item.toLiveSession())
            }
        },
        provider = optJSONObject("provider")?.toLiveProviderInfo() ?: LiveProviderInfo("cloudflare-stream-live", false, "automatic"),
    )
}

private fun JSONObject.toLiveRoomTokenResponse(): LiveRoomTokenResponse {
    return LiveRoomTokenResponse(
        provider = optString("provider").ifBlank { "cloudflare-durable-object" },
        configured = optBoolean("configured", false),
        transport = optString("transport").ifBlank { "websocket" },
        authority = optString("authority").ifBlank { "backend" },
        wsUrl = optString("wsUrl").ifBlank { null },
        expiresAt = optString("expiresAt").ifBlank { null },
    )
}

private fun JSONObject.toLiveChatMessage(): LiveChatMessage {
    return LiveChatMessage(
        id = optString("id"),
        userId = optString("userId"),
        userName = optString("userName").ifBlank { "Paragon Member" },
        displayName = optString("displayName").ifBlank { optString("userName").ifBlank { "Paragon Member" } },
        text = optString("text"),
        createdAt = optString("createdAt"),
    )
}

private data class ApiResponse(
    val statusCode: Int,
    val body: String,
) {
    fun requireSuccess(): String {
        if (statusCode !in 200..299) {
            throw IllegalStateException("Request failed ($statusCode): $body")
        }
        return body
    }

    fun isAppCheckFailure(): Boolean {
        if (statusCode != 401) return false
        val lowerBody = body.lowercase()
        return lowerBody.contains("app check") || lowerBody.contains("appcheck")
    }
}

