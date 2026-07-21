package com.app.natureswayproduction.nativeapp.feature.onboarding

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class RoleOnboardingRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    private suspend fun saveWalletAccount(uid: String, role: String) {
        firestore.collection("wallet_accounts").document(uid).set(
            mapOf(
                "role" to role,
                "balances" to mapOf("parag" to 0, "gbazilo" to 0),
                "lockedBalances" to mapOf("parag" to 0, "gbazilo" to 0),
                "createdAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
    }

    suspend fun saveBasicUserProfile(): String {
        val user = auth.currentUser ?: error("User not authenticated")
        val uid = user.uid
        val existing = firestore.collection("user_profiles").document(uid).get().await()

        val fallbackName = user.displayName?.takeIf { it.isNotBlank() }
            ?: user.email?.substringBefore("@")?.replaceFirstChar { it.uppercase() }
            ?: "Paragon User"

        val profileData = hashMapOf(
            "uid" to uid,
            "email" to (user.email ?: ""),
            "role" to "USER",
            "status" to "active",
            "realName" to fallbackName,
            "gender" to "",
            "phone" to "",
            "country" to "Nigeria",
            "state" to "",
            "updatedAt" to FieldValue.serverTimestamp(),
        )

        if (!existing.exists()) {
            profileData["createdAt"] = FieldValue.serverTimestamp()
        }

        firestore.collection("user_profiles").document(uid).set(profileData, com.google.firebase.firestore.SetOptions.merge()).await()
        firestore.collection("public_profiles").document(uid).set(
            mapOf(
                "uid" to uid,
                "role" to "User",
                "displayName" to fallbackName,
                "realName" to fallbackName,
                "status" to "active",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(uid, "user")

        return "User profile created successfully."
    }

    suspend fun saveUserProfile(form: UserRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        val uid = user.uid
        val existing = firestore.collection("user_profiles").document(uid).get().await()

        require(form.realName.isNotBlank()) { "Real name is required" }
        require(form.gender.isNotBlank()) { "Gender is required" }
        require(form.email.isNotBlank()) { "Email is required" }
        require(form.country.isNotBlank()) { "Country is required" }
        require(form.state.isNotBlank()) { "State is required" }

        val profileData = hashMapOf(
            "uid" to uid,
            "email" to form.email.trim(),
            "role" to "USER",
            "status" to "active",
            "realName" to form.realName.trim(),
            "gender" to form.gender.trim(),
            "phone" to form.phone.trim(),
            "country" to form.country.trim(),
            "state" to form.state.trim(),
            "updatedAt" to FieldValue.serverTimestamp(),
        )

        if (!existing.exists()) {
            profileData["createdAt"] = FieldValue.serverTimestamp()
        }

        firestore.collection("user_profiles").document(uid).set(profileData, com.google.firebase.firestore.SetOptions.merge()).await()
        firestore.collection("public_profiles").document(uid).set(
            mapOf(
                "uid" to uid,
                "role" to "User",
                "displayName" to form.realName.trim(),
                "realName" to form.realName.trim(),
                "gender" to form.gender.trim(),
                "country" to form.country.trim(),
                "state" to form.state.trim(),
                "status" to "active",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(uid, "user")

        return "User profile saved successfully."
    }

    suspend fun saveCitizenProfile(form: CitizenRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        val uid = user.uid

        require(form.age.toIntOrNull()?.let { it >= 18 } == true) { "Citizen must be 18 years or older" }
        require(form.talents.isNotEmpty()) { "Select at least one talent" }

        val citizenData = hashMapOf(
            "uid" to uid,
            "email" to (user.email ?: ""),
            "role" to "CITIZEN",
            "status" to "active",
            "warnings" to 0,
            "isBanned" to false,
            "stageName" to form.stageName.trim(),
            "realName" to form.realName.trim(),
            "age" to form.age.trim(),
            "gender" to form.gender.trim(),
            "maritalStatus" to form.maritalStatus.trim(),
            "profession" to form.profession.trim(),
            "phone" to form.phone.trim(),
            "country" to form.country.trim(),
            "state" to form.state.trim(),
            "tribe" to form.tribe.trim(),
            "residence" to form.residence.trim(),
            "talents" to form.talents,
            "registrationType" to "SELF",
            "baseCitizenShare" to 50,
            "primaryPromoterId" to null,
            "primaryPromoterName" to "",
            "inviteCode" to null,
            "invitedByPromoterId" to null,
            "invitedByPromoterName" to "",
            "invitedAt" to null,
            "createdAt" to FieldValue.serverTimestamp(),
        )

        firestore.collection("citizen_profiles").document(uid).set(citizenData).await()
        firestore.collection("public_profiles").document(uid).set(
            mapOf(
                "uid" to uid,
                "role" to "Citizen",
                "displayName" to form.stageName.trim(),
                "realName" to form.realName.trim(),
                "stageName" to form.stageName.trim(),
                "profession" to form.profession.trim(),
                "country" to form.country.trim(),
                "state" to form.state.trim(),
                "tribe" to form.tribe.trim(),
                "status" to "active",
                "talents" to form.talents,
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(uid, "citizen")

        return "Citizen profile saved successfully."
    }

    suspend fun savePromoterProfile(form: PromoterRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        require(form.brandName.isNotBlank()) { "Stage / Brand Name is required" }
        require(form.phone.isNotBlank()) { "Phone Number is required" }
        require(form.capacity.toIntOrNull()?.let { it >= 5 } == true) { "Minimum capacity is 5." }
        require(form.promoterTypes.isNotEmpty()) { "Select at least one talent category." }
        require(form.promotionMediums.isNotEmpty()) { "Select at least one promotion medium." }

        val payload = hashMapOf(
            "uid" to user.uid,
            "role" to "PROMOTER",
            "email" to (user.email ?: ""),
            "brandName" to form.brandName.trim(),
            "realName" to form.realName.trim(),
            "phone" to form.phone.trim(),
            "country" to form.country.trim(),
            "state" to form.state.trim(),
            "declaredCapacity" to (form.capacity.toIntOrNull() ?: 0),
            "citizenStarsForCapacity" to (form.citizenStars.toIntOrNull() ?: 0),
            "promoterTypes" to form.promoterTypes,
            "subFields" to form.promotionMediums,
            "talentCategories" to form.promoterTypes,
            "promotionMediums" to form.promotionMediums,
            "citizensCount" to 0,
            "status" to "PENDING_REVIEW",
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        firestore.collection("promoter_profiles").document(user.uid).set(payload).await()
        firestore.collection("public_profiles").document(user.uid).set(
            mapOf(
                "uid" to user.uid,
                "role" to "Ambassador",
                "displayName" to form.brandName.trim(),
                "realName" to form.realName.trim(),
                "country" to form.country.trim(),
                "state" to form.state.trim(),
                "status" to "PENDING_REVIEW",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(user.uid, "promoter")
        return "Ambassador registration submitted."
    }

    suspend fun saveMerchantProfile(form: MerchantRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        require(form.storeName.isNotBlank()) { "Store / Brand name is required" }
        require(form.realName.isNotBlank()) { "Real name is required" }
        require(form.phone.isNotBlank()) { "Phone is required" }
        require(form.country.isNotBlank()) { "Country is required" }
        require(form.productTypes.isNotEmpty()) { "Select at least one digital product type" }
        require(form.paymentMethods.isNotEmpty()) { "Select at least one payment method" }

        val profileRef = firestore.collection("merchant_profiles").document(user.uid)
        val existing = profileRef.get().await()
        val payload = hashMapOf(
            "uid" to user.uid,
            "role" to "MERCHANT",
            "status" to "active",
            "storeName" to form.storeName.trim(),
            "realName" to form.realName.trim(),
            "gender" to form.gender.trim(),
            "phone" to form.phone.trim(),
            "email" to form.email.trim(),
            "country" to form.country.trim(),
            "state" to form.state.trim(),
            "productTypes" to form.productTypes,
            "paymentMethods" to form.paymentMethods,
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        if (!existing.exists()) payload["createdAt"] = FieldValue.serverTimestamp()
        profileRef.set(payload, com.google.firebase.firestore.SetOptions.merge()).await()
        firestore.collection("public_profiles").document(user.uid).set(
            mapOf(
                "uid" to user.uid,
                "role" to "Merchant",
                "displayName" to form.storeName.trim(),
                "realName" to form.realName.trim(),
                "country" to form.country.trim(),
                "state" to form.state.trim(),
                "status" to "active",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(user.uid, "merchant")
        return "Merchant profile saved successfully."
    }

    suspend fun saveKnowledgeRoleProfile(form: KnowledgeRoleRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        require(form.realName.isNotBlank()) { "Real full name is required" }
        require(form.age.toIntOrNull()?.let { it >= 18 } == true) { "Age must be 18 or above." }
        require(form.gender.isNotBlank()) { "Gender is required" }
        require(form.maritalStatus.isNotBlank()) { "Marital status is required" }
        require(form.profession.isNotBlank()) { "Profession is required" }
        require(form.phone.isNotBlank()) { "Phone number is required" }
        require(form.country.isNotBlank()) { "Country is required" }
        require(form.state.isNotBlank()) { "State is required" }
        require(form.tribe.isNotBlank()) { "Tribe is required" }
        require(form.employmentStatus.isNotBlank()) { "Employment status is required" }
        require(form.knowledgeFields.isNotEmpty()) { "Select at least one field." }
        require(form.knowledgeCategories.isNotEmpty()) { "Select at least one category." }
        if (form.employmentStatus == "EMPLOYED") {
            require(form.employmentType.isNotBlank()) { "Employment type is required." }
            require(form.businessName.isNotBlank()) { "Business name is required." }
        }

        val profileRef = firestore.collection(form.collectionName).document(user.uid)
        val existing = profileRef.get().await()
        val payload = hashMapOf(
            "uid" to user.uid,
            "email" to (user.email ?: ""),
            "age" to (form.age.toIntOrNull() ?: 0),
            "role" to form.roleValue,
            "realName" to form.realName.trim(),
            "gender" to form.gender.trim(),
            "maritalStatus" to form.maritalStatus.trim(),
            "profession" to form.profession.trim(),
            "phone" to form.phone.trim(),
            "country" to form.country.trim(),
            "state" to form.state.trim(),
            "tribe" to form.tribe.trim(),
            "employmentStatus" to form.employmentStatus,
            "employmentType" to form.employmentType,
            "businessName" to form.businessName.trim(),
            "placeOfEmployment" to form.businessName.trim(),
            "serviceFields" to form.knowledgeFields,
            "knowledgeFields" to form.knowledgeFields,
            "serviceCategories" to form.knowledgeCategories.map { mapOf("field" to it.field, "category" to it.category) },
            "serviceCategoryLabels" to form.knowledgeCategories.map { "${it.field}: ${it.category}" },
            "status" to "active",
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        if (!existing.exists()) payload["createdAt"] = FieldValue.serverTimestamp()
        profileRef.set(payload, com.google.firebase.firestore.SetOptions.merge()).await()
        firestore.collection("public_profiles").document(user.uid).set(
            mapOf(
                "uid" to user.uid,
                "role" to if (form.roleValue == "BACKER") "Backer Contestant" else "Superboss Candidate",
                "displayName" to form.realName.trim(),
                "realName" to form.realName.trim(),
                "country" to form.country.trim(),
                "state" to form.state.trim(),
                "status" to "active",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(user.uid, if (form.roleValue == "BACKER") "backer" else "supernal")
        return "${form.title} profile saved successfully"
    }

    suspend fun saveSponsorInvestorProfile(form: SponsorInvestorRegistrationForm): String {
        val user = auth.currentUser ?: error("User not authenticated")
        require(form.realName.isNotBlank()) { "Full Name / Company Name is required." }
        require(form.email.isNotBlank()) { "Email is required." }
        require(form.phone.isNotBlank()) { "Phone Number is required." }
        require(form.country.isNotBlank()) { "Country is required." }
        require(form.stateCity.isNotBlank()) { "State / City is required." }
        require(form.talentFields.isNotEmpty()) { "Choose at least one talent field of interest." }
        if (form.accountType == "SPONSOR") {
            require(form.sponsorType.isNotBlank()) { "Sponsor Type is required." }
            require(form.brandName.isNotBlank()) { "Brand / Organization Name is required." }
            require(form.sponsorInterests.isNotEmpty()) { "Choose at least one sponsorship interest." }
            require(form.sponsorBudgetRange.isNotBlank()) { "Budget Range is required." }
            require(form.sponsorBenefits.isNotEmpty()) { "Choose at least one benefit." }
        } else {
            require(form.investorType.isNotBlank()) { "Investor Type is required." }
            require(form.investorInterests.isNotEmpty()) { "Choose at least one investment interest." }
            require(form.investmentCapacity.isNotBlank()) { "Investment Capacity is required." }
            require(form.riskLevel.isNotBlank()) { "Risk Level is required." }
            require(form.returnTypes.isNotEmpty()) { "Choose at least one expected return type." }
        }

        val profileRef = firestore.collection("sponsor_investor_profiles").document(user.uid)
        val existing = profileRef.get().await()
        val payload = hashMapOf(
            "uid" to user.uid,
            "role" to "SPONSOR / INVESTOR",
            "accountType" to form.accountType,
            "sponsorType" to if (form.accountType == "SPONSOR") form.sponsorType else "",
            "investorType" to if (form.accountType == "INVESTOR") form.investorType else "",
            "realName" to form.realName.trim(),
            "email" to form.email.trim(),
            "phone" to form.phone.trim(),
            "country" to form.country.trim(),
            "stateCity" to form.stateCity.trim(),
            "brandName" to if (form.accountType == "SPONSOR") form.brandName.trim() else "",
            "websiteLink" to if (form.accountType == "SPONSOR") form.websiteLink.trim() else "",
            "talentFields" to form.talentFields,
            "sponsorInterests" to if (form.accountType == "SPONSOR") form.sponsorInterests else emptyList<String>(),
            "sponsorBudgetRange" to if (form.accountType == "SPONSOR") form.sponsorBudgetRange else "",
            "sponsorBenefits" to if (form.accountType == "SPONSOR") form.sponsorBenefits else emptyList<String>(),
            "investorInterests" to if (form.accountType == "INVESTOR") form.investorInterests else emptyList<String>(),
            "investmentCapacity" to if (form.accountType == "INVESTOR") form.investmentCapacity else "",
            "riskLevel" to if (form.accountType == "INVESTOR") form.riskLevel else "",
            "returnTypes" to if (form.accountType == "INVESTOR") form.returnTypes else emptyList<String>(),
            "sponsorDocuments" to if (form.accountType == "SPONSOR") form.sponsorDocuments else emptyList<String>(),
            "investorDocuments" to if (form.accountType == "INVESTOR") form.investorDocuments else emptyList<String>(),
            "status" to "active",
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        if (!existing.exists()) payload["createdAt"] = FieldValue.serverTimestamp()
        profileRef.set(payload, com.google.firebase.firestore.SetOptions.merge()).await()
        firestore.collection("public_profiles").document(user.uid).set(
            mapOf(
                "uid" to user.uid,
                "role" to if (form.accountType == "INVESTOR") "Investor" else "Sponsor",
                "displayName" to (form.brandName.takeIf { it.isNotBlank() } ?: form.realName).trim(),
                "realName" to form.realName.trim(),
                "country" to form.country.trim(),
                "stateCity" to form.stateCity.trim(),
                "status" to "active",
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
        saveWalletAccount(user.uid, if (form.accountType == "INVESTOR") "investor" else "sponsor")
        return if (form.accountType == "SPONSOR") "Sponsor profile saved successfully" else "Investor profile saved successfully"
    }
}

data class CitizenRegistrationForm(
    val stageName: String,
    val realName: String,
    val age: String,
    val gender: String,
    val maritalStatus: String,
    val profession: String,
    val phone: String,
    val country: String,
    val state: String,
    val tribe: String,
    val residence: String,
    val talents: List<String>,
)

data class UserRegistrationForm(
    val realName: String,
    val gender: String,
    val phone: String,
    val email: String,
    val country: String,
    val state: String,
)

data class PromoterRegistrationForm(
    val brandName: String,
    val realName: String,
    val phone: String,
    val country: String,
    val state: String,
    val capacity: String,
    val citizenStars: String,
    val promoterTypes: List<String>,
    val promotionMediums: List<String>,
)

data class MerchantRegistrationForm(
    val storeName: String,
    val realName: String,
    val gender: String,
    val phone: String,
    val email: String,
    val country: String,
    val state: String,
    val productTypes: List<String>,
    val paymentMethods: List<String>,
)

data class SelectedKnowledgeCategory(
    val field: String,
    val category: String,
)

data class KnowledgeRoleRegistrationForm(
    val title: String,
    val collectionName: String,
    val roleValue: String,
    val realName: String,
    val age: String,
    val gender: String,
    val maritalStatus: String,
    val profession: String,
    val phone: String,
    val country: String,
    val state: String,
    val tribe: String,
    val employmentStatus: String,
    val employmentType: String,
    val businessName: String,
    val knowledgeFields: List<String>,
    val knowledgeCategories: List<SelectedKnowledgeCategory>,
)

data class SponsorInvestorRegistrationForm(
    val accountType: String,
    val sponsorType: String,
    val investorType: String,
    val realName: String,
    val email: String,
    val phone: String,
    val country: String,
    val stateCity: String,
    val brandName: String,
    val websiteLink: String,
    val talentFields: List<String>,
    val sponsorInterests: List<String>,
    val sponsorBudgetRange: String,
    val sponsorBenefits: List<String>,
    val investorInterests: List<String>,
    val investmentCapacity: String,
    val riskLevel: String,
    val returnTypes: List<String>,
    val sponsorDocuments: List<String>,
    val investorDocuments: List<String>,
)
