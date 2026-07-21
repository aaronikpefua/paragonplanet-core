package com.app.natureswayproduction.nativeapp.feature.onboarding

data class KnowledgeFieldGroup(
    val name: String,
    val categories: List<String>,
)

val promoterTypes = listOf(
    "Cultural Performer",
    "Special Talent",
    "Dancer",
    "Instrumentalist",
    "Model",
    "Foodier",
    "Stunt Performer",
    "Singer",
    "Debater",
    "Comedian",
    "Artist & Designer",
    "Actor",
)

val promotionMediums = listOf(
    "Social Media Promotion",
    "Live Events & Concerts",
    "Radio Promotion",
    "Television Promotion",
    "Campus Tours",
    "Street Campaigns",
    "Digital Advertising",
    "Livestream & Virtual Shows",
    "Influencer Collaborations",
    "Press, Media & Streaming Coverage",
    "Fanbase & Community Promotion",
    "Brand Partnership Campaigns",
)

val merchantProductTypes = listOf(
    "E-books",
    "Notion Templates",
    "Canva Templates",
    "Printables",
    "Mini Courses",
    "Presets & Filters",
    "Swipe Files",
    "Toolkits & Bundles",
    "Digital Wallpapers",
    "Video Products",
    "Audio Products",
)

val paymentOptions = listOf("Parag coins", "Google Billing", "Paystack")

val genders = listOf("Male", "Female")
val maritalStatuses = listOf("Single", "Married", "Divorced", "Widowed")

val serviceFields = listOf(
    KnowledgeFieldGroup("Health", listOf("Medicine", "Nursing", "Pharmacy", "Public Health", "Mental Health", "Fitness & Wellness", "Nutrition", "Laboratory Science", "Health Technology", "Traditional Medicine")),
    KnowledgeFieldGroup("Environment", listOf("Agriculture", "Climate Action", "Waste Management", "Renewable Energy", "Conservation", "Water & Sanitation", "Forestry", "Environmental Education", "Animal Welfare", "Green Technology")),
    KnowledgeFieldGroup("Education", listOf("Teaching", "Training & Coaching", "Research", "EdTech", "School Administration", "Vocational Training", "Special Education", "Language & Literacy", "Curriculum Development", "Student Mentorship")),
    KnowledgeFieldGroup("Enterprise", listOf("Trading", "Commerce", "Small Business", "Artisanship", "Manufacturing", "Logistics", "Real Estate", "Hospitality", "Fashion Business", "Food Business")),
    KnowledgeFieldGroup("Entertainment", listOf("Music", "Dance", "Comedy", "Acting", "Modelling", "Film & Drama", "Events & Hosting", "Instrumental Performance", "Talent Performance", "Gaming & Esports")),
    KnowledgeFieldGroup("Finance", listOf("Banking", "Accounting", "Investment", "Insurance", "FinTech", "Taxation", "Auditing", "Microfinance", "Wealth Management", "Financial Advisory")),
    KnowledgeFieldGroup("Security", listOf("Law Enforcement", "Private Security", "Cybersecurity", "Intelligence", "Investigation", "Emergency Response", "Fire Safety", "Community Safety", "Border Security", "Risk Management")),
    KnowledgeFieldGroup("Media", listOf("Journalism", "Broadcasting", "Social Media", "Photography", "Videography", "Digital Publishing", "Public Relations", "Advertising", "Podcasting", "Content Strategy")),
    KnowledgeFieldGroup("Law", listOf("Legal Practice", "Corporate Law", "Criminal Law", "Human Rights Law", "Family Law", "Property Law", "Contract Law", "Labour Law", "Legal Advisory", "Dispute Resolution")),
    KnowledgeFieldGroup("Technology", listOf("Software Development", "Web Development", "Mobile App Development", "Data & AI", "Cybersecurity", "UI/UX Design", "IT Support", "Networking", "Cloud Computing", "Robotics")),
    KnowledgeFieldGroup("Governance", listOf("Public Administration", "Politics", "Policy & Strategy", "Community Leadership", "Diplomacy", "Civic Engagement", "Development Planning", "Public Finance", "Local Government", "International Relations")),
    KnowledgeFieldGroup("Religion", listOf("Ministry", "Evangelism", "Theology", "Worship", "Religious Teaching", "Pastoral Care", "Faith-Based Charity", "Religious Media", "Prayer & Counseling", "Interfaith Relations")),
)

val disciplineFields = listOf(
    KnowledgeFieldGroup("Health", listOf("Medicine", "Nursing", "Pharmacy", "Public Health", "Medical Laboratory Science", "Physiotherapy", "Nutrition & Dietetics", "Dentistry", "Optometry", "Community Health")),
    KnowledgeFieldGroup("Environment", listOf("Environmental Science", "Environmental Management", "Forestry", "Wildlife Conservation", "Climate Change Studies", "Waste Management", "Water Resources Management", "Ecology", "Urban Planning", "Sustainable Development")),
    KnowledgeFieldGroup("Education", listOf("Early Childhood Education", "Primary Education", "Secondary Education", "Educational Management", "Curriculum Studies", "Guidance & Counseling", "Special Education", "Adult Education", "Educational Technology", "Vocational Education")),
    KnowledgeFieldGroup("Enterprise", listOf("Entrepreneurship", "Business Administration", "Marketing", "Human Resource Management", "Project Management", "Supply Chain Management", "Sales Management", "Customer Relations", "Business Development", "Innovation Management")),
    KnowledgeFieldGroup("Entertainment", listOf("Music", "Film Production", "Acting & Drama", "Dance", "Comedy", "Event Management", "Broadcasting", "Content Creation", "Modeling", "Talent Management")),
    KnowledgeFieldGroup("Finance", listOf("Accounting", "Banking", "Investment Management", "Financial Planning", "Insurance", "Taxation", "Auditing", "FinTech", "Risk Management", "Microfinance")),
    KnowledgeFieldGroup("Security", listOf("Cybersecurity", "Physical Security", "Intelligence & Investigation", "Military Studies", "Criminology", "Emergency Management", "Border Security", "Information Security", "Security Operations", "Conflict Resolution")),
    KnowledgeFieldGroup("Media", listOf("Journalism", "Broadcasting", "Public Relations", "Advertising", "Digital Media", "Social Media Management", "Photography", "Videography", "Publishing", "Media Production")),
    KnowledgeFieldGroup("Law", listOf("Criminal Law", "Civil Law", "Corporate Law", "Constitutional Law", "International Law", "Human Rights Law", "Environmental Law", "Property Law", "Labour Law", "Family Law")),
    KnowledgeFieldGroup("Technology", listOf("Software Engineering", "Web Development", "Mobile App Development", "Artificial Intelligence", "Data Science", "Cloud Computing", "Network Engineering", "Robotics", "Computer Hardware", "Information Technology")),
    KnowledgeFieldGroup("Governance", listOf("Public Administration", "Political Science", "Diplomacy", "Policy Development", "Local Government Administration", "Legislative Studies", "Electoral Management", "Public Finance Management", "International Relations", "Leadership & Governance")),
    KnowledgeFieldGroup("Religion", listOf("Theology", "Christian Ministry", "Islamic Studies", "Comparative Religion", "Religious Education", "Mission Studies", "Pastoral Care", "Chaplaincy", "Ethics & Morality", "Spiritual Leadership")),
)

val sponsorTypes = listOf(
    "Individual",
    "Business / Company",
    "NGO / Foundation",
    "Government / Institution",
)

val sponsorInterests = listOf(
    "Contest",
    "Creator / Talent",
    "Category",
    "Event",
    "Advertisement",
    "Platform Partnership",
)

val sponsorBudgets = listOf(
    "₦50,000 – ₦200,000",
    "₦200,000 – ₦500,000",
    "₦500,000 – ₦1,000,000",
    "₦1,000,000+",
)

val sponsorBenefits = listOf(
    "Brand Visibility",
    "Product Promotion",
    "Audience Engagement",
    "Creator Partnership",
    "Contest Naming Rights",
    "Data / Analytics Report",
)

val investorTypes = listOf(
    "Individual Investor",
    "Company Investor",
    "Angel Investor",
    "Investment Firm",
)

val investorInterests = listOf(
    "Creator / Talent Funding",
    "Contest Funding",
    "Platform Growth",
    "Category Investment",
    "Revenue Share Partnership",
)

val investmentCapacities = listOf(
    "₦100,000 – ₦500,000",
    "₦500,000 – ₦2,000,000",
    "₦2,000,000 – ₦10,000,000",
    "₦10,000,000+",
)

val riskLevels = listOf("Low Risk", "Medium Risk", "High Risk")
val returnTypes = listOf("Profit Share", "Revenue Share", "Equity / Stake", "Brand Partnership", "Long-Term Growth")
