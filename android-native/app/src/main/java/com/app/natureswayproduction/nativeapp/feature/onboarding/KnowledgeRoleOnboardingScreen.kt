package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import kotlinx.coroutines.launch

@Composable
fun KnowledgeRoleOnboardingScreen(
    repository: RoleOnboardingRepository,
    title: String,
    collectionName: String,
    roleValue: String,
    onBack: () -> Unit,
    onCompleted: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val fieldGroups = if (roleValue == "SUPERNAL") disciplineFields else serviceFields
    val isBacker = roleValue == "BACKER"
    val isSuperboss = roleValue == "SUPERNAL"
    var showAbout by remember { mutableStateOf(false) }
    var realName by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var maritalStatus by remember { mutableStateOf("") }
    var profession by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var tribe by remember { mutableStateOf("") }
    var employmentStatus by remember { mutableStateOf("") }
    var employmentType by remember { mutableStateOf("") }
    var businessName by remember { mutableStateOf("") }
    val selectedFields = remember { mutableStateListOf<String>() }
    val selectedCategories = remember { mutableStateListOf<SelectedKnowledgeCategory>() }
    var isSaving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun toggleField(field: String) {
        if (selectedFields.contains(field)) {
            selectedFields.remove(field)
            selectedCategories.removeAll { it.field == field }
        } else {
            selectedFields.add(field)
        }
    }

    fun toggleCategory(field: String, category: String) {
        val item = SelectedKnowledgeCategory(field, category)
        if (selectedCategories.contains(item)) selectedCategories.remove(item) else selectedCategories.add(item)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Button(
            onClick = onBack,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1F2933),
                contentColor = Color.White
            )
        ) { Text("Go Back", fontWeight = FontWeight.Bold) }
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))

        Button(
            onClick = { showAbout = !showAbout },
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1F2933),
                contentColor = Color.White
            )
        ) {
            Text(
                if (showAbout) {
                    if (isSuperboss) "Hide About Superbosses" else "Hide About Backer Contestants"
                } else {
                    if (isSuperboss) "About Superbosses" else "About Backer Contestants"
                },
                fontWeight = FontWeight.Bold
            )
        }

        if (showAbout) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFDF8), RoundedCornerShape(12.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (isBacker) {
                    Text(
                        "Contestants for Paragon Planet Backers are selected from individuals, professionals, and service providers operating within sectors such as Health, Environment, Education, Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and Religion.",
                        color = Color(0xFF26384D),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "These contestants compete to earn scores, rewards, and qualification marks through Questions & Answers, reasoning activities, analytical challenges, engagement tasks, and knowledge-based participation across the twelve service fields in order to become Official Backers of Paragon Planet.",
                        color = Color(0xFF26384D),
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else {
                    Text(
                        "Candidates for Paragon Planet Superbosses are selected from recommended Teachers, Tutors, Lecturers, Trainers, Mentors, and Instructors by their students, tutees, trainees, and followers across various fields of study and sectors of society.",
                        color = Color(0xFF26384D),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "Superbosses compete to earn scores, recognition, influence, authority, and rewards through verified Questions & Answers systems, strategic activities, reasoning exercises, and leadership evaluations.",
                        color = Color(0xFF26384D),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        OnboardingField(realName, { realName = it }, "Real Full Name")
        OnboardingField(age, { age = it }, "Age (18+)")
        Text("Select Gender", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            genders.forEach { option -> TogglePill(option, gender == option) { gender = option } }
        }
        Text("Marital Status", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            maritalStatuses.forEach { option -> TogglePill(option, maritalStatus == option) { maritalStatus = option } }
        }
        OnboardingField(profession, { profession = it }, "Profession")
        OnboardingField(phone, { phone = it }, "Phone Number")
        OnboardingField(country, { country = it }, "Country")
        OnboardingField(state, { state = it }, "State")
        OnboardingField(tribe, { tribe = it }, "Tribe")

        Text("Employment Status", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("EMPLOYED", "UNEMPLOYED").forEach { option ->
                TogglePill(option.replace("_", " "), employmentStatus == option) { employmentStatus = option }
            }
        }
        if (employmentStatus == "EMPLOYED") {
            Text("Employment Type", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("SELF_EMPLOYED", "UNDER_EMPLOYER").forEach { option ->
                    TogglePill(option.replace("_", " "), employmentType == option) { employmentType = option }
                }
            }
            OnboardingField(businessName, { businessName = it }, "Business Name")
        }

        Text(
            if (isSuperboss) "Fields of Discipline and Their Branches" else "Fields of Service",
            fontWeight = FontWeight.Bold,
            color = Color(0xFF111111)
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            fieldGroups.forEach { group ->
                TogglePill(group.name, selectedFields.contains(group.name)) { toggleField(group.name) }
            }
        }
        selectedFields.forEach { field ->
            val group = fieldGroups.firstOrNull { it.name == field } ?: return@forEach
            Text("$field ${if (isSuperboss) "Branches" else "Categories"}", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                group.categories.forEach { category ->
                    val active = selectedCategories.contains(SelectedKnowledgeCategory(field, category))
                    TogglePill(category, active) { toggleCategory(field, category) }
                }
            }
        }

        error?.let { Text(it, color = Color(0xFFB00020)) }
        Button(
            onClick = {
                isSaving = true
                error = null
                scope.launch {
                    runCatching {
                        repository.saveKnowledgeRoleProfile(
                            KnowledgeRoleRegistrationForm(
                                title = title,
                                collectionName = collectionName,
                                roleValue = roleValue,
                                realName = realName,
                                age = age,
                                gender = gender,
                                maritalStatus = maritalStatus,
                                profession = profession,
                                phone = phone,
                                country = country,
                                state = state,
                                tribe = tribe,
                                employmentStatus = employmentStatus,
                                employmentType = employmentType,
                                businessName = businessName,
                                knowledgeFields = selectedFields.toList(),
                                knowledgeCategories = selectedCategories.toList(),
                            )
                        )
                    }.onSuccess { onCompleted() }
                        .onFailure { error = it.message ?: "Profile could not be saved." }
                    isSaving = false
                }
            },
            enabled = !isSaving,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
        ) {
            if (isSaving) CircularProgressIndicator(color = ParagonGold) else Text("Save Profile", fontWeight = FontWeight.Bold)
        }
    }
}
