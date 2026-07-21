import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { savePublicProfile } from "../../lib/publicProfile";
import SuperbossAboutContent from "../../components/SuperbossAboutContent";
import BackerAboutContent from "../../components/BackerAboutContent";

const SERVICE_FIELDS = [
  {
    name: "Health",
    categories: [
      "Medicine",
      "Nursing",
      "Pharmacy",
      "Public Health",
      "Mental Health",
      "Fitness & Wellness",
      "Nutrition",
      "Laboratory Science",
      "Health Technology",
      "Traditional Medicine",
    ],
  },
  {
    name: "Environment",
    categories: [
      "Agriculture",
      "Climate Action",
      "Waste Management",
      "Renewable Energy",
      "Conservation",
      "Water & Sanitation",
      "Forestry",
      "Environmental Education",
      "Animal Welfare",
      "Green Technology",
    ],
  },
  {
    name: "Education",
    categories: [
      "Teaching",
      "Training & Coaching",
      "Research",
      "EdTech",
      "School Administration",
      "Vocational Training",
      "Special Education",
      "Language & Literacy",
      "Curriculum Development",
      "Student Mentorship",
    ],
  },
  {
    name: "Enterprise",
    categories: [
      "Trading",
      "Commerce",
      "Small Business",
      "Artisanship",
      "Manufacturing",
      "Logistics",
      "Real Estate",
      "Hospitality",
      "Fashion Business",
      "Food Business",
    ],
  },
  {
    name: "Entertainment",
    categories: [
      "Music",
      "Dance",
      "Comedy",
      "Acting",
      "Modelling",
      "Film & Drama",
      "Events & Hosting",
      "Instrumental Performance",
      "Talent Performance",
      "Gaming & Esports",
    ],
  },
  {
    name: "Finance",
    categories: [
      "Banking",
      "Accounting",
      "Investment",
      "Insurance",
      "FinTech",
      "Taxation",
      "Auditing",
      "Microfinance",
      "Wealth Management",
      "Financial Advisory",
    ],
  },
  {
    name: "Security",
    categories: [
      "Law Enforcement",
      "Private Security",
      "Cybersecurity",
      "Intelligence",
      "Investigation",
      "Emergency Response",
      "Fire Safety",
      "Community Safety",
      "Border Security",
      "Risk Management",
    ],
  },
  {
    name: "Media",
    categories: [
      "Journalism",
      "Broadcasting",
      "Social Media",
      "Photography",
      "Videography",
      "Digital Publishing",
      "Public Relations",
      "Advertising",
      "Podcasting",
      "Content Strategy",
    ],
  },
  {
    name: "Law",
    categories: [
      "Legal Practice",
      "Corporate Law",
      "Criminal Law",
      "Human Rights Law",
      "Family Law",
      "Property Law",
      "Contract Law",
      "Labour Law",
      "Legal Advisory",
      "Dispute Resolution",
    ],
  },
  {
    name: "Technology",
    categories: [
      "Software Development",
      "Web Development",
      "Mobile App Development",
      "Data & AI",
      "Cybersecurity",
      "UI/UX Design",
      "IT Support",
      "Networking",
      "Cloud Computing",
      "Robotics",
    ],
  },
  {
    name: "Governance",
    categories: [
      "Public Administration",
      "Politics",
      "Policy & Strategy",
      "Community Leadership",
      "Diplomacy",
      "Civic Engagement",
      "Development Planning",
      "Public Finance",
      "Local Government",
      "International Relations",
    ],
  },
  {
    name: "Religion",
    categories: [
      "Ministry",
      "Evangelism",
      "Theology",
      "Worship",
      "Religious Teaching",
      "Pastoral Care",
      "Faith-Based Charity",
      "Religious Media",
      "Prayer & Counseling",
      "Interfaith Relations",
    ],
  },
];

const DISCIPLINE_FIELDS = [
  {
    name: "Health",
    categories: [
      "Medicine",
      "Nursing",
      "Pharmacy",
      "Public Health",
      "Medical Laboratory Science",
      "Physiotherapy",
      "Nutrition & Dietetics",
      "Dentistry",
      "Optometry",
      "Community Health",
    ],
  },
  {
    name: "Environment",
    categories: [
      "Environmental Science",
      "Environmental Management",
      "Forestry",
      "Wildlife Conservation",
      "Climate Change Studies",
      "Waste Management",
      "Water Resources Management",
      "Ecology",
      "Urban Planning",
      "Sustainable Development",
    ],
  },
  {
    name: "Education",
    categories: [
      "Early Childhood Education",
      "Primary Education",
      "Secondary Education",
      "Educational Management",
      "Curriculum Studies",
      "Guidance & Counseling",
      "Special Education",
      "Adult Education",
      "Educational Technology",
      "Vocational Education",
    ],
  },
  {
    name: "Enterprise",
    categories: [
      "Entrepreneurship",
      "Business Administration",
      "Marketing",
      "Human Resource Management",
      "Project Management",
      "Supply Chain Management",
      "Sales Management",
      "Customer Relations",
      "Business Development",
      "Innovation Management",
    ],
  },
  {
    name: "Entertainment",
    categories: [
      "Music",
      "Film Production",
      "Acting & Drama",
      "Dance",
      "Comedy",
      "Event Management",
      "Broadcasting",
      "Content Creation",
      "Modeling",
      "Talent Management",
    ],
  },
  {
    name: "Finance",
    categories: [
      "Accounting",
      "Banking",
      "Investment Management",
      "Financial Planning",
      "Insurance",
      "Taxation",
      "Auditing",
      "FinTech",
      "Risk Management",
      "Microfinance",
    ],
  },
  {
    name: "Security",
    categories: [
      "Cybersecurity",
      "Physical Security",
      "Intelligence & Investigation",
      "Military Studies",
      "Criminology",
      "Emergency Management",
      "Border Security",
      "Information Security",
      "Security Operations",
      "Conflict Resolution",
    ],
  },
  {
    name: "Media",
    categories: [
      "Journalism",
      "Broadcasting",
      "Public Relations",
      "Advertising",
      "Digital Media",
      "Social Media Management",
      "Photography",
      "Videography",
      "Publishing",
      "Media Production",
    ],
  },
  {
    name: "Law",
    categories: [
      "Criminal Law",
      "Civil Law",
      "Corporate Law",
      "Constitutional Law",
      "International Law",
      "Human Rights Law",
      "Environmental Law",
      "Property Law",
      "Labour Law",
      "Family Law",
    ],
  },
  {
    name: "Technology",
    categories: [
      "Software Engineering",
      "Web Development",
      "Mobile App Development",
      "Artificial Intelligence",
      "Data Science",
      "Cloud Computing",
      "Network Engineering",
      "Robotics",
      "Computer Hardware",
      "Information Technology",
    ],
  },
  {
    name: "Governance",
    categories: [
      "Public Administration",
      "Political Science",
      "Diplomacy",
      "Policy Development",
      "Local Government Administration",
      "Legislative Studies",
      "Electoral Management",
      "Public Finance Management",
      "International Relations",
      "Leadership & Governance",
    ],
  },
  {
    name: "Religion",
    categories: [
      "Theology",
      "Christian Ministry",
      "Islamic Studies",
      "Comparative Religion",
      "Religious Education",
      "Mission Studies",
      "Pastoral Care",
      "Chaplaincy",
      "Ethics & Morality",
      "Spiritual Leadership",
    ],
  },
];

const GENDERS = ["Male", "Female"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

export default function RoleKnowledgeOnboarding({
  title,
  collectionName,
  roleValue,
}) {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [form, setForm] = useState({
    realName: "",
    age: "",
    gender: "",
    maritalStatus: "",
    profession: "",
    phone: "",
    country: "",
    state: "",
    tribe: "",
    employmentStatus: "",
    employmentType: "",
    businessName: "",
    serviceFields: [],
    serviceCategories: [],
  });
  const [showAboutBackerAspirants, setShowAboutBackerAspirants] = useState(false);
  const [showAboutSupernalCandidates, setShowAboutSupernalCandidates] = useState(false);
  const isBackerAspirant = roleValue === "BACKER";
  const isSupernalCandidate = roleValue === "SUPERNAL";
  const activeFieldGroups = isSupernalCandidate ? DISCIPLINE_FIELDS : SERVICE_FIELDS;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setEmploymentStatus = (value) => {
    setForm((prev) => ({
      ...prev,
      employmentStatus: value,
      employmentType: value === "EMPLOYED" ? prev.employmentType : "",
      businessName: value === "EMPLOYED" ? prev.businessName : "",
    }));
  };

  const setEmploymentType = (value) => {
    setForm((prev) => ({
      ...prev,
      employmentType: value,
      businessName: "",
    }));
  };

  const toggleServiceField = (field) => {
    setForm((prev) => ({
      ...prev,
      serviceFields: prev.serviceFields.includes(field)
        ? prev.serviceFields.filter((item) => item !== field)
        : [...prev.serviceFields, field],
      serviceCategories: prev.serviceFields.includes(field)
        ? prev.serviceCategories.filter((item) => item.field !== field)
        : prev.serviceCategories,
    }));
  };

  const toggleServiceCategory = (field, category) => {
    setForm((prev) => {
      const exists = prev.serviceCategories.some(
        (item) => item.field === field && item.category === category
      );

      return {
        ...prev,
        serviceCategories: exists
          ? prev.serviceCategories.filter(
              (item) => !(item.field === field && item.category === category)
            )
          : [...prev.serviceCategories, { field, category }],
      };
    });
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Login first");
      navigate("/login");
      return;
    }

    const ageNumber = Number(form.age);

    if (
      !form.realName ||
      !form.gender ||
      !form.maritalStatus ||
      !form.profession ||
      !form.phone ||
      !form.country ||
      !form.state ||
      !form.tribe ||
      !form.employmentStatus
    ) {
      alert("Please complete all required fields.");
      return;
    }

    if (!ageNumber || ageNumber < 18) {
      alert("Age must be 18 or above.");
      return;
    }

    if (form.employmentStatus === "EMPLOYED" && (!form.employmentType || !form.businessName)) {
      alert("Please complete your employment details.");
      return;
    }

    if (!form.serviceFields.length) {
      alert(`Select at least one field of ${isSupernalCandidate ? "discipline" : "service"}.`);
      return;
    }

    if (!form.serviceCategories.length) {
      alert(`Select at least one ${isSupernalCandidate ? "discipline branch" : "service category"}.`);
      return;
    }

    try {
      const profileRef = doc(db, collectionName, currentUser.uid);
      const existingSnap = await getDoc(profileRef);

      const payload = {
        ...form,
        placeOfEmployment: form.businessName,
        knowledgeFields: form.serviceFields,
        serviceCategoryLabels: form.serviceCategories.map(
          (item) => `${item.field}: ${item.category}`
        ),
        uid: currentUser.uid,
        email: currentUser.email || "",
        age: ageNumber,
        role: roleValue,
        status: "active",
        updatedAt: serverTimestamp(),
      };

      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(profileRef, payload, { merge: true });
      await savePublicProfile(
        currentUser.uid,
        roleValue === "BACKER" ? "Backer Contestant" : "Superboss Candidate",
        payload
      );

      alert(`${title} profile saved successfully`);
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error(`${title} save failed:`, err);
      alert(err.message);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, collectionName, user.uid));
    await deleteDoc(doc(db, "public_profiles", user.uid));
    await deleteUser(user);
    navigate("/");
  };

  return (
    <div style={container}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>
      <h2>{title}</h2>

      {isBackerAspirant && (
        <section style={aboutToggleSectionStyle}>
          <button
            type="button"
            onClick={() => setShowAboutBackerAspirants((value) => !value)}
            style={aboutToggleButtonStyle}
          >
            {showAboutBackerAspirants ? "Hide About Backer Contestants" : "About Backer Contestants"}
          </button>

          {showAboutBackerAspirants && (
            <div style={aboutCardStyle}>
              <BackerAboutContent />
            </div>
          )}
        </section>
      )}

      {isSupernalCandidate && (
        <section style={aboutToggleSectionStyle}>
          <button
            type="button"
            onClick={() => setShowAboutSupernalCandidates((value) => !value)}
            style={aboutToggleButtonStyle}
          >
            {showAboutSupernalCandidates ? "Hide About Superbosses" : "About Superbosses"}
          </button>

          {showAboutSupernalCandidates && (
            <div style={aboutCardStyle}>
              <SuperbossAboutContent />
            </div>
          )}
        </section>
      )}

      <input
        name="realName"
        placeholder="Real Full Name"
        value={form.realName}
        onChange={handleChange}
        style={input}
      />

      <input
        name="age"
        type="number"
        placeholder="Age (18+)"
        value={form.age}
        onChange={handleChange}
        style={input}
      />

      <label style={sectionLabel}>Select Gender</label>
      <div style={optionGrid}>
        {GENDERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, gender: option }))}
            style={toggleButton(form.gender === option)}
          >
            {option}
          </button>
        ))}
      </div>

      <select
        name="maritalStatus"
        value={form.maritalStatus}
        onChange={handleChange}
        style={input}
      >
        <option value="">Marital Status</option>
        {MARITAL_STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <input
        name="profession"
        placeholder="Profession"
        value={form.profession}
        onChange={handleChange}
        style={input}
      />

      <input
        name="phone"
        placeholder="Phone Number"
        value={form.phone}
        onChange={handleChange}
        style={input}
      />

      <input
        name="country"
        placeholder="Country"
        value={form.country}
        onChange={handleChange}
        style={input}
      />

      <input
        name="state"
        placeholder="State"
        value={form.state}
        onChange={handleChange}
        style={input}
      />

      <input
        name="tribe"
        placeholder="Tribe"
        value={form.tribe}
        onChange={handleChange}
        style={input}
      />

      <label style={sectionLabel}>Employment Status</label>
      <div style={optionGrid}>
        <button
          type="button"
          onClick={() => setEmploymentStatus("EMPLOYED")}
          style={toggleButton(form.employmentStatus === "EMPLOYED")}
        >
          Employed
        </button>

        <button
          type="button"
          onClick={() => setEmploymentStatus("UNEMPLOYED")}
          style={toggleButton(form.employmentStatus === "UNEMPLOYED")}
        >
          Unemployed
        </button>
      </div>

      {form.employmentStatus === "EMPLOYED" && (
        <>
          <div style={optionGrid}>
            <button
              type="button"
              onClick={() => setEmploymentType("SELF_EMPLOYED")}
              style={toggleButton(form.employmentType === "SELF_EMPLOYED")}
            >
              Self Employment
            </button>

            <button
              type="button"
              onClick={() => setEmploymentType("UNDER_EMPLOYER")}
              style={toggleButton(form.employmentType === "UNDER_EMPLOYER")}
            >
              Under Employer
            </button>
          </div>

          {form.employmentType && (
            <input
              name="businessName"
              placeholder="Business Name"
              value={form.businessName}
              onChange={handleChange}
              style={input}
            />
          )}
        </>
      )}

      <label style={sectionLabel}>
        {isSupernalCandidate ? "Fields of Discipline and Their Branches" : "Fields of Service"}
      </label>
      <div style={knowledgeGrid}>
        {activeFieldGroups.map((field) => (
          <button
            key={field.name}
            type="button"
            onClick={() => toggleServiceField(field.name)}
            style={toggleButton(form.serviceFields.includes(field.name))}
          >
            {field.name}
          </button>
        ))}
      </div>

      {form.serviceFields.map((fieldName) => {
        const fieldGroup = activeFieldGroups.find((field) => field.name === fieldName);
        if (!fieldGroup) return null;

        return (
          <div key={fieldName} style={serviceCategorySectionStyle}>
            <label style={serviceCategoryLabelStyle}>
              {fieldName} {isSupernalCandidate ? "Branches" : "Categories"}
            </label>
            <div style={knowledgeGrid}>
              {fieldGroup.categories.map((category) => {
                const isActive = form.serviceCategories.some(
                  (item) => item.field === fieldName && item.category === category
                );

                return (
                  <button
                    key={`${fieldName}-${category}`}
                    type="button"
                    onClick={() => toggleServiceCategory(fieldName, category)}
                    style={toggleButton(isActive)}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={buttonRow}>
        <button onClick={handleSubmit} style={btn}>
          Save Profile
        </button>

        <button onClick={() => navigate("/wallet")} style={btn}>
          Wallet
        </button>

        <button onClick={deleteAccount} style={dangerBtn}>
          Delete Account
        </button>
      </div>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  padding: "96px 40px 56px",
  maxWidth: 760,
  margin: "auto",
  boxSizing: "border-box",
};
const input = { display: "block", marginBottom: 12, padding: 10, width: "100%" };
const btn = {
  padding: 10,
  marginTop: 10,
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
const dangerBtn = { ...btn, background: "red" };
const sectionLabel = {
  display: "block",
  marginTop: 18,
  marginBottom: 10,
  fontWeight: 700,
};
const optionGrid = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14,
};
const knowledgeGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginBottom: 16,
};
const serviceCategorySectionStyle = {
  marginBottom: 18,
};
const serviceCategoryLabelStyle = {
  display: "block",
  marginBottom: 10,
  fontWeight: 700,
  color: "#344054",
};
const buttonRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const backButtonStyle = {
  padding: "10px 14px",
  marginBottom: 16,
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const aboutToggleSectionStyle = {
  marginBottom: 20,
};

const aboutToggleButtonStyle = {
  padding: "10px 14px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const aboutCardStyle = {
  marginTop: 12,
  padding: 18,
  borderRadius: 12,
  border: "1px solid #e2d8c8",
  background: "#fffdf8",
  color: "#1f2933",
  lineHeight: 1.6,
};

function toggleButton(active) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: active ? "1px solid #111" : "1px solid #ccc",
    background: active ? "#111" : "#f2f4f7",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
  };
}
