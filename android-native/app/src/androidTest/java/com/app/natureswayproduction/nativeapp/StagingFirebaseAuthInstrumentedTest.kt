package com.app.natureswayproduction.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.app.natureswayproduction.BuildConfig
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StagingFirebaseAuthInstrumentedTest {
    @Test
    fun m1ButtonCustomTokenPathAuthenticatesAgainstIsolatedStaging() = runBlocking {
        val firebase = FirebaseApp.getInstance().options
        assertTrue(BuildConfig.M1_TEST_LOGIN_ENABLED)
        assertTrue(BuildConfig.M1_TEST_LOGIN_SECRET.isNotBlank())
        assertEquals("paragonplanet-live-stg", firebase.projectId)
        assertEquals(
            "https://backend-live-staging-172974692065.us-central1.run.app",
            BuildConfig.BACKEND_URL,
        )

        val customToken = ParagonApiService().fetchM1StagingCustomToken(BuildConfig.M1_TEST_LOGIN_SECRET)
        val result = FirebaseAuth.getInstance().signInWithCustomToken(customToken).await()

        assertEquals("m1.android.device@paragonplanet.test", result.user?.email)
        assertTrue(result.user?.getIdToken(false)?.await()?.token?.isNotBlank() == true)
        FirebaseAuth.getInstance().signOut()
    }

    @Test
    fun emailPasswordAuthenticatesAgainstIsolatedStaging() = runBlocking {
        val arguments = InstrumentationRegistry.getArguments()
        val email = requireNotNull(arguments.getString("testEmail"))
        val password = requireNotNull(arguments.getString("testPassword"))
        val firebase = FirebaseApp.getInstance().options

        assertEquals("paragonplanet-live-stg", firebase.projectId)
        assertEquals("1:172974692065:android:f66038d68d498ce9bd49a0", firebase.applicationId)
        assertEquals(
            "https://backend-live-staging-172974692065.us-central1.run.app",
            BuildConfig.BACKEND_URL,
        )

        val result = FirebaseAuth.getInstance()
            .signInWithEmailAndPassword(email, password)
            .await()

        assertEquals(email, result.user?.email)
        assertTrue(result.user?.getIdToken(false)?.await()?.token?.isNotBlank() == true)
        FirebaseAuth.getInstance().signOut()
    }
}
