package com.app.natureswayproduction.nativeapp.data.api

import com.app.natureswayproduction.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ParagonApiService {
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
                            .ifBlank { item.optString("userId") }
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
        val connection = (URL(BuildConfig.BACKEND_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("Accept", "application/json")
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

        val statusCode = connection.responseCode
        val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.use { input ->
            BufferedReader(InputStreamReader(input)).readText()
        }.orEmpty()

        return ApiResponse(statusCode = statusCode, body = body)
    }
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

