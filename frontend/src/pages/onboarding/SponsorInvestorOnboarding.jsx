import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { savePublicProfile } from "../../lib/publicProfile";

const TALENT_FIELDS = [
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
];

const SPONSOR_TYPES = [
  "Individual",
  "Business / Company",
  "NGO / Foundation",
  "Government / Institution",
];

const SPONSOR_INTERESTS = [
  {
    label: "Contest",
    description: "Sponsor a competition and gain full branding rights",
  },
  {
    label: "Creator / Talent",
    description: "Partner with individual creators to promote your brand",
  },
  {
    label: "Category",
    description: "Own visibility in a specific talent category",
  },
  {
    label: "Event",
    description: "Sponsor live or virtual events on the platform",
  },
  {
    label: "Advertisement",
    description: "Promote your brand through ads and sponsored posts",
  },
  {
    label: "Platform Partnership",
    description: "Long-term strategic collaboration with the platform",
  },
];

const SPONSOR_BUDGETS = [
  "₦50,000 – ₦200,000",
  "₦200,000 – ₦500,000",
  "₦500,000 – ₦1,000,000",
  "₦1,000,000+",
];

const SPONSOR_BENEFITS = [
  "Brand Visibility",
  "Product Promotion",
  "Audience Engagement",
  "Creator Partnership",
  "Contest Naming Rights",
  "Data / Analytics Report",
];

const INVESTOR_TYPES = [
  "Individual Investor",
  "Company Investor",
  "Angel Investor",
  "Investment Firm",
];

const INVESTMENT_INTERESTS = [
  {
    label: "Creator / Talent Funding",
    description: "Fund individual creators and earn from their performance",
  },
  {
    label: "Contest Funding",
    description: "Fund competitions and earn from contest engagement",
  },
  {
    label: "Platform Growth",
    description: "Invest in platform expansion and earn long-term returns",
  },
  {
    label: "Category Investment",
    description: "Invest in a full talent category and earn from all creators",
  },
  {
    label: "Revenue Share Partnership",
    description: "Enter a flexible agreement for shared platform revenue",
  },
];

const INVESTMENT_CAPACITIES = [
  "₦100,000 – ₦500,000",
  "₦500,000 – ₦2,000,000",
  "₦2,000,000 – ₦10,000,000",
  "₦10,000,000+",
];

const RISK_LEVELS = ["Low Risk", "Medium Risk", "High Risk"];

const RETURN_TYPES = [
  "Profit Share",
  "Revenue Share",
  "Equity / Stake",
  "Brand Partnership",
  "Long-Term Growth",
];

const SPONSOR_INVESTOR_PURPOSES = [
  "Talent Sponsorship",
  "Contest Sponsorship",
  "Brand Promotion",
  "Event Partnerships",
  "Product Advertising",
  "Marketplace Promotion",
  "Creator Development",
  "Platform Expansion",
  "Sector-Based Investments",
  "Revenue Sharing Partnerships",
  "Strategic Collaborations",
  "Audience Engagement Campaigns",
];

const SPONSOR_EXCHANGE_BENEFITS = [
  "Brand visibility",
  "Promotional opportunities",
  "Advertisement placements",
  "Audience engagement",
  "Product awareness",
  "Partnership recognition",
  "Event branding rights",
  "Campaign exposure within the Planet ecosystem",
];

const INVESTOR_FUNDING_AREAS = [
  "Talent growth and development",
  "Digital products and businesses",
  "Entertainment activities",
  "Technology systems",
  "Educational projects",
  "Media productions",
  "Marketplace systems",
  "Infrastructure expansion",
  "Ecosystem innovations",
  "Revenue-generating activities within the Platform",
];

const SPONSOR_INVESTOR_COLLABORATORS = [
  "Citizens",
  "Superbosses",
  "Ambassadors",
  "Backers",
  "Merchants",
  "Contest organizers",
  "Platform administrators",
  "Creative teams and project developers",
];

const SPONSOR_INVESTOR_EXPECTATIONS = [
  "Maintain ethical and professional relationships",
  "Respect the rules and standards of the Platform",
  "Support legitimate talents, projects, and opportunities",
  "Avoid fraudulent or exploitative activities",
  "Promote positive development within the ecosystem",
  "Encourage creativity, innovation, and healthy competition",
];

export default function SponsorInvestorOnboarding() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [accountType, setAccountType] = useState("SPONSOR");
  const [saving, setSaving] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [form, setForm] = useState({
    sponsorType: "",
    investorType: "",
    realName: "",
    email: auth.currentUser?.email || "",
    phone: "",
    country: "",
    stateCity: "",
    brandName: "",
    websiteLink: "",
    talentFields: [],
    sponsorInterests: [],
    sponsorBudgetRange: "",
    sponsorBenefits: [],
    investorInterests: [],
    investmentCapacity: "",
    riskLevel: "",
    returnTypes: [],
    sponsorDocuments: [],
    investorDocuments: [],
  });

  const currentTitle = useMemo(
    () => (accountType === "SPONSOR" ? "Sponsor Registration" : "Investor Registration"),
    [accountType]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleListValue = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  const handleFiles = (field, fileList) => {
    const names = Array.from(fileList || []).map((file) => file.name);
    setForm((prev) => ({ ...prev, [field]: names }));
  };

  const validate = () => {
    if (!form.realName || !form.email || !form.phone || !form.country || !form.stateCity) {
      alert("Please complete your basic information.");
      return false;
    }

    if (!form.talentFields.length) {
      alert("Please choose at least one talent field of interest.");
      return false;
    }

    if (accountType === "SPONSOR") {
      if (
        !form.sponsorType ||
        !form.brandName ||
        !form.sponsorInterests.length ||
        !form.sponsorBudgetRange ||
        !form.sponsorBenefits.length
      ) {
        alert("Please complete the sponsor profile details.");
        return false;
      }
    }

    if (accountType === "INVESTOR") {
      if (
        !form.investorType ||
        !form.investorInterests.length ||
        !form.investmentCapacity ||
        !form.riskLevel ||
        !form.returnTypes.length
      ) {
        alert("Please complete the investor profile details.");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Login first");
      navigate("/login");
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      const profileRef = doc(db, "sponsor_investor_profiles", currentUser.uid);
      const existingSnap = await getDoc(profileRef);

      const payload = {
        uid: currentUser.uid,
        role: "SPONSOR / INVESTOR",
        accountType,
        sponsorType: accountType === "SPONSOR" ? form.sponsorType : "",
        investorType: accountType === "INVESTOR" ? form.investorType : "",
        realName: form.realName,
        email: form.email || currentUser.email || "",
        phone: form.phone,
        country: form.country,
        stateCity: form.stateCity,
        brandName: accountType === "SPONSOR" ? form.brandName : "",
        websiteLink: accountType === "SPONSOR" ? form.websiteLink : "",
        talentFields: form.talentFields,
        sponsorInterests: accountType === "SPONSOR" ? form.sponsorInterests : [],
        sponsorBudgetRange: accountType === "SPONSOR" ? form.sponsorBudgetRange : "",
        sponsorBenefits: accountType === "SPONSOR" ? form.sponsorBenefits : [],
        investorInterests: accountType === "INVESTOR" ? form.investorInterests : [],
        investmentCapacity: accountType === "INVESTOR" ? form.investmentCapacity : "",
        riskLevel: accountType === "INVESTOR" ? form.riskLevel : "",
        returnTypes: accountType === "INVESTOR" ? form.returnTypes : [],
        sponsorDocuments: accountType === "SPONSOR" ? form.sponsorDocuments : [],
        investorDocuments: accountType === "INVESTOR" ? form.investorDocuments : [],
        status: "active",
        updatedAt: serverTimestamp(),
      };

      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(profileRef, payload, { merge: true });
      await savePublicProfile(
        currentUser.uid,
        accountType === "INVESTOR" ? "Investor" : "Sponsor",
        payload
      );
      alert(`${currentTitle} profile saved successfully`);
      navigate("/profile", { replace: true });
    } catch (error) {
      console.error("Sponsor / Investor save failed:", error);
      alert(error.message || "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "sponsor_investor_profiles", user.uid)).catch(() => {});
    await deleteDoc(doc(db, "sponsor_profiles", user.uid)).catch(() => {});
    await deleteDoc(doc(db, "public_profiles", user.uid)).catch(() => {});
    await deleteUser(user);
    navigate("/");
  };

  return (
    <div style={containerStyle}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>
      <div style={cardStyle}>
        <button
          type="button"
          onClick={() => setShowAbout((value) => !value)}
          style={secondaryButtonStyle}
        >
          {showAbout ? "Hide About Sponsors / Investors" : "About Sponsors / Investors"}
        </button>
        {showAbout && <SponsorInvestorAboutContent />}
      </div>

      <>
          <div style={cardStyle}>
            <p style={eyebrowStyle}>Join as Sponsor / Investor</p>
            <h2 style={titleStyle}>{currentTitle}</h2>
            <div style={twoColToggleStyle}>
              <button type="button" onClick={() => setAccountType("SPONSOR")} style={typeCardStyle(accountType === "SPONSOR")}>
                <strong>Sponsor</strong>
                <span style={typeCardMetaStyle}>
                  Promote your brand, sponsor contests, reach talents and voters.
                </span>
              </button>
              <button type="button" onClick={() => setAccountType("INVESTOR")} style={typeCardStyle(accountType === "INVESTOR")}>
                <strong>Investor</strong>
                <span style={typeCardMetaStyle}>
                  Fund creators, contests, or platform growth and earn returns.
                </span>
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle>Basic Information</SectionTitle>

            {accountType === "SPONSOR" ? (
              <>
                <FieldLabel>Sponsor Type</FieldLabel>
                <div style={chipGridStyle}>
                  {SPONSOR_TYPES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, sponsorType: option }))}
                      style={chipButtonStyle(form.sponsorType === option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <FieldLabel>Investor Type</FieldLabel>
                <div style={chipGridStyle}>
                  {INVESTOR_TYPES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, investorType: option }))}
                      style={chipButtonStyle(form.investorType === option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            <input
              name="realName"
              placeholder="Full Name / Company Name"
              value={form.realName}
              onChange={handleChange}
              style={inputStyle}
            />
            <input
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              style={inputStyle}
            />
            <input
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              style={inputStyle}
            />
            <input
              name="country"
              placeholder="Country"
              value={form.country}
              onChange={handleChange}
              style={inputStyle}
            />
            <input
              name="stateCity"
              placeholder="State / City"
              value={form.stateCity}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          {accountType === "SPONSOR" && (
            <div style={cardStyle}>
              <SectionTitle>Brand Information</SectionTitle>
              <input
                name="brandName"
                placeholder="Brand / Organization Name"
                value={form.brandName}
                onChange={handleChange}
                style={inputStyle}
              />
              <input
                name="websiteLink"
                placeholder="Website or Social Media Link"
                value={form.websiteLink}
                onChange={handleChange}
                style={inputStyle}
              />

              <FieldLabel>Talent Field of Interest</FieldLabel>
              <div style={chipGridStyle}>
                {TALENT_FIELDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleListValue("talentFields", option)}
                    style={chipButtonStyle(form.talentFields.includes(option))}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <FieldLabel>Sponsorship Interest</FieldLabel>
              <p style={helperTextStyle}>What do you want to sponsor? (Select all that apply)</p>
              <div style={choiceGridStyle}>
                {SPONSOR_INTERESTS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleListValue("sponsorInterests", option.label)}
                    style={choiceCardStyle(form.sponsorInterests.includes(option.label))}
                  >
                    <strong>{option.label}</strong>
                    <span style={choiceCardMetaStyle}>{option.description}</span>
                  </button>
                ))}
              </div>

              <FieldLabel>Budget Range</FieldLabel>
              <div style={chipGridStyle}>
                {SPONSOR_BUDGETS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, sponsorBudgetRange: option }))}
                    style={chipButtonStyle(form.sponsorBudgetRange === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <FieldLabel>Benefit Expected</FieldLabel>
              <div style={chipGridStyle}>
                {SPONSOR_BENEFITS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleListValue("sponsorBenefits", option)}
                    style={chipButtonStyle(form.sponsorBenefits.includes(option))}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <SectionTitle>Verification</SectionTitle>
              <FieldLabel>CAC / Business Document Upload (optional)</FieldLabel>
              <input type="file" multiple onChange={(e) => handleFiles("sponsorDocuments", e.target.files)} style={inputStyle} />
              <FieldLabel>ID Upload (optional)</FieldLabel>
              <input type="file" multiple onChange={(e) => handleFiles("sponsorDocuments", e.target.files)} style={inputStyle} />
              {form.sponsorDocuments.length > 0 && (
                <p style={fileListStyle}>Files: {form.sponsorDocuments.join(", ")}</p>
              )}
            </div>
          )}

          {accountType === "INVESTOR" && (
            <div style={cardStyle}>
              <SectionTitle>Investment Interest</SectionTitle>

              <FieldLabel>What do you want to invest in?</FieldLabel>
              <div style={choiceGridStyle}>
                {INVESTMENT_INTERESTS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleListValue("investorInterests", option.label)}
                    style={choiceCardStyle(form.investorInterests.includes(option.label))}
                  >
                    <strong>{option.label}</strong>
                    <span style={choiceCardMetaStyle}>{option.description}</span>
                  </button>
                ))}
              </div>

              <FieldLabel>Preferred Talents</FieldLabel>
              <div style={chipGridStyle}>
                {TALENT_FIELDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleListValue("talentFields", option)}
                    style={chipButtonStyle(form.talentFields.includes(option))}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <FieldLabel>Investment Capacity</FieldLabel>
              <div style={chipGridStyle}>
                {INVESTMENT_CAPACITIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, investmentCapacity: option }))}
                    style={chipButtonStyle(form.investmentCapacity === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <FieldLabel>Risk Level</FieldLabel>
              <div style={chipGridStyle}>
                {RISK_LEVELS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, riskLevel: option }))}
                    style={chipButtonStyle(form.riskLevel === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <FieldLabel>Expected Return Type</FieldLabel>
              <div style={chipGridStyle}>
                {RETURN_TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleListValue("returnTypes", option)}
                    style={chipButtonStyle(form.returnTypes.includes(option))}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <SectionTitle>Verification</SectionTitle>
              <FieldLabel>ID Upload</FieldLabel>
              <input type="file" multiple onChange={(e) => handleFiles("investorDocuments", e.target.files)} style={inputStyle} />
              <FieldLabel>Proof of Funds (optional)</FieldLabel>
              <input type="file" multiple onChange={(e) => handleFiles("investorDocuments", e.target.files)} style={inputStyle} />
              <FieldLabel>Company Document (optional)</FieldLabel>
              <input type="file" multiple onChange={(e) => handleFiles("investorDocuments", e.target.files)} style={inputStyle} />
              {form.investorDocuments.length > 0 && (
                <p style={fileListStyle}>Files: {form.investorDocuments.join(", ")}</p>
              )}
            </div>
          )}

          <div style={buttonRowStyle}>
            <button onClick={handleSubmit} style={primaryButtonStyle} disabled={saving}>
              {saving
                ? "Saving..."
                : accountType === "SPONSOR"
                  ? "Submit Sponsor Profile"
                  : "Submit Investor Profile"}
            </button>
            <button onClick={() => navigate("/wallet")} style={secondaryButtonStyle}>
              Wallet
            </button>
            <button onClick={handleDeleteAccount} style={dangerButtonStyle}>
              Delete Account
            </button>
          </div>
        </>
    </div>
  );
}

function SponsorInvestorAboutContent() {
  return (
    <div style={aboutBoxStyle}>
      <h2 style={{ marginTop: 0 }}>About Sponsors / Investors</h2>
      <p>
        Paragon Planet Sponsors and Investors are individuals, organizations, companies,
        institutions, brands, and strategic partners who support, finance, promote, invest in, or
        collaborate with activities, talents, contests, projects, and opportunities within the
        Paragon Planet ecosystem.
      </p>
      <p>
        Sponsors and Investors play a major role in the growth, visibility, development,
        empowerment, and expansion of the Planet by supporting Citizens, Superbosses, Ambassadors,
        Backers, Merchants, events, competitions, digital products, and ecosystem activities.
      </p>
      <p>Sponsors and Investors may operate within the Platform for purposes such as:</p>
      <ul>
        {SPONSOR_INVESTOR_PURPOSES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>Sponsors may support talents, contests, or ecosystem activities in exchange for:</p>
      <ul>
        {SPONSOR_EXCHANGE_BENEFITS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>Investors may participate in funding opportunities connected to:</p>
      <ul>
        {INVESTOR_FUNDING_AREAS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>Sponsors and Investors may collaborate directly with:</p>
      <ul>
        {SPONSOR_INVESTOR_COLLABORATORS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        The Sponsor and Investor system is designed to create opportunities for financial
        empowerment, strategic partnerships, business visibility, ecosystem expansion, and
        sustainable growth within Paragon Planet.
      </p>
      <p>Sponsors and Investors are expected to:</p>
      <ul>
        {SPONSOR_INVESTOR_EXPECTATIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        As Sponsors and Investors participate within the ecosystem, they gain access to broader
        visibility, strategic influence, partnership opportunities, audience reach, marketplace
        exposure, promotional advantages, and long-term collaborative benefits within Paragon
        Planet.
      </p>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 style={sectionTitleStyle}>{children}</h3>;
}

function FieldLabel({ children }) {
  return <label style={fieldLabelStyle}>{children}</label>;
}

function typeCardStyle(active) {
  return {
    ...typeCardBaseStyle,
    border: active ? "1px solid #111827" : "1px solid #d6d3d1",
    background: active ? "#111827" : "#fffdf8",
    color: active ? "#ffffff" : "#111827",
  };
}

function chipButtonStyle(active) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: active ? "1px solid #111827" : "1px solid #d6d3d1",
    background: active ? "#111827" : "#f8f5ee",
    color: active ? "#ffffff" : "#111827",
    cursor: "pointer",
    textAlign: "left",
  };
}

function choiceCardStyle(active) {
  return {
    display: "grid",
    gap: 8,
    padding: "14px 16px",
    borderRadius: 10,
    border: active ? "1px solid #111827" : "1px solid #d6d3d1",
    background: active ? "#111827" : "#fffdf8",
    color: active ? "#ffffff" : "#111827",
    cursor: "pointer",
    textAlign: "left",
    alignContent: "start",
    minHeight: 110,
  };
}

const containerStyle = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "96px 20px 72px",
  display: "grid",
  gap: 18,
  boxSizing: "border-box",
};

const cardStyle = {
  background: "#fffdf8",
  border: "1px solid #e6ddce",
  borderRadius: 10,
  padding: 24,
  boxShadow: "0 2px 10px rgba(17, 24, 39, 0.05)",
};

const aboutBoxStyle = {
  marginTop: 16,
  padding: 18,
  borderRadius: 10,
  border: "1px solid #e6ddce",
  background: "#ffffff",
  color: "#1f2933",
  lineHeight: 1.65,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
};

const titleStyle = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: 34,
};

const twoColToggleStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 20,
};

const typeCardBaseStyle = {
  display: "grid",
  gap: 8,
  padding: 18,
  borderRadius: 10,
  textAlign: "left",
  cursor: "pointer",
};

const typeCardMetaStyle = {
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.92,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #d6d3d1",
  background: "#ffffff",
  marginBottom: 12,
};

const chipGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  marginBottom: 16,
};

const choiceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 14,
  fontSize: 24,
};

const fieldLabelStyle = {
  display: "block",
  marginBottom: 10,
  fontWeight: 700,
  color: "#344054",
};

const helperTextStyle = {
  marginTop: -2,
  marginBottom: 12,
  color: "#52616b",
  fontSize: 14,
};

const choiceCardMetaStyle = {
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.9,
};

const fileListStyle = {
  color: "#52616b",
  marginTop: -2,
};

const buttonRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const backButtonStyle = {
  justifySelf: "start",
  padding: "10px 14px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "#1f2937",
};

const dangerButtonStyle = {
  ...primaryButtonStyle,
  background: "#b42318",
};
