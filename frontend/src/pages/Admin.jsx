import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";

import PromoterApproval from "./admin/PromoterApproval";
import WithdrawalsAdmin from "./admin/WithdrawalsAdmin";
import AdminManagementPanel from "./admin/AdminManagementPanel";
import SharedInbox from "./SharedInbox";

export default function Admin() {

  const user = auth.currentUser;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [managementTab, setManagementTab] = useState("promoters");

  return (

    <div style={{ padding: 30, maxWidth: 1100 }}>

      <h1>Admin Dashboard</h1>

      <p style={{ marginBottom: 20 }}>
        <strong>Logged in as:</strong>{" "}
        {user?.email || user?.phoneNumber}
      </p>

      <hr />

      {/* ================= MAIN NAV ================= */}

      <div style={{ marginTop: 20, marginBottom: 30 }}>

        <button
          onClick={() => setActiveTab("overview")}
          style={tabStyle(activeTab === "overview")}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab("management")}
          style={tabStyle(activeTab === "management")}
        >
          Management
        </button>

        <button
          onClick={() => setActiveTab("users")}
          style={tabStyle(activeTab === "users")}
        >
          User Management
        </button>

        <button
          onClick={() => setActiveTab("videos")}
          style={tabStyle(activeTab === "videos")}
        >
          Video Moderation
        </button>

        <button
          onClick={() => setActiveTab("wallets")}
          style={tabStyle(activeTab === "wallets")}
        >
          Wallet Oversight
        </button>

        <button
          onClick={() => setActiveTab("inbox")}
          style={tabStyle(activeTab === "inbox")}
        >
          Admin Inbox
        </button>

      </div>

      {/* ================= OVERVIEW ================= */}

      {activeTab === "overview" && (
        <section>

          <h3>Platform Controls</h3>

          <ul>
            <li>Citizen management</li>
            <li>Ambassador management</li>
            <li>Merchant management</li>
            <li>User management</li>
            <li>Backer management</li>
            <li>Superboss management</li>
            <li>Sponsor / Investor management</li>
            <li>Wallet oversight</li>
            <li>Admin inbox</li>
          </ul>

        </section>
      )}

      {/* ================= MANAGEMENT ================= */}

      {activeTab === "management" && (

        <section>

          <h3>Management</h3>

          <div style={{ marginBottom: 20 }}>

            <button
              onClick={() => setManagementTab("citizens")}
              style={tabStyle(managementTab === "citizens")}
            >
              Citizen Management
            </button>

            <button
              onClick={() => setManagementTab("promoters")}
              style={tabStyle(managementTab === "promoters")}
            >
              Ambassador Management
            </button>

            <button
              onClick={() => setManagementTab("merchants")}
              style={tabStyle(managementTab === "merchants")}
            >
              Merchant Management
            </button>

            <button
              onClick={() => setManagementTab("users")}
              style={tabStyle(managementTab === "users")}
            >
              User Management
            </button>

            <button
              onClick={() => setManagementTab("backers")}
              style={tabStyle(managementTab === "backers")}
            >
              Backer Management
            </button>

            <button
              onClick={() => setManagementTab("supernals")}
              style={tabStyle(managementTab === "supernals")}
            >
              Superboss Management
            </button>

            <button
              onClick={() => setManagementTab("sponsors")}
              style={tabStyle(managementTab === "sponsors")}
            >
              Sponsor / Investor Management
            </button>

          </div>

          {/* ================= MANAGEMENT CONTENT ================= */}

          {managementTab === "citizens" && (
            <AdminManagementPanel
              title="Citizen Management"
              profileCollection="citizen_profiles"
              contentCollection="videos"
              contentOwnerField="uid"
              profileTitleField="stageName"
              profileFields={[
                ["stageName", "Stage Name"],
                ["realName", "Real Name"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
                ["talents", "Talents"],
              ]}
              emptyLabel="No citizen accounts found."
            />
          )}

          {managementTab === "promoters" && <PromoterApproval />}

          {managementTab === "merchants" && (
            <AdminManagementPanel
              title="Merchant Management"
              profileCollection="merchant_profiles"
              contentCollection="merchant_products"
              contentOwnerField="merchantId"
              profileTitleField="realName"
              profileFields={[
                ["realName", "Real Name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
                ["status", "Status"],
              ]}
              emptyLabel="No merchant accounts found."
            />
          )}

          {managementTab === "users" && (
            <AdminManagementPanel
              title="User Management"
              profileCollection="user_profiles"
              profileTitleField="realName"
              profileFields={[
                ["realName", "Real Name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
              ]}
              emptyLabel="No user accounts found."
            />
          )}

          {managementTab === "backers" && (
            <AdminManagementPanel
              title="Backer Management"
              profileCollection="backer_profiles"
              profileTitleField="realName"
              profileFields={[
                ["realName", "Real Name"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
                ["profession", "Profession"],
                ["knowledgeFields", "Fields of Knowledge"],
              ]}
              emptyLabel="No backer accounts found."
            />
          )}

          {managementTab === "supernals" && (
            <AdminManagementPanel
              title="Superboss Management"
              profileCollection="supernal_profiles"
              profileTitleField="realName"
              profileFields={[
                ["realName", "Real Name"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
                ["profession", "Profession"],
                ["knowledgeFields", "Fields of Knowledge"],
              ]}
              emptyLabel="No superboss accounts found."
            />
          )}

          {managementTab === "sponsors" && (
            <AdminManagementPanel
              title="Sponsor / Investor Management"
              profileCollection="sponsor_investor_profiles"
              profileTitleField="realName"
              profileFields={[
                ["realName", "Real Name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["country", "Country"],
                ["state", "State"],
                ["profession", "Profession"],
                ["employmentStatus", "Employment Status"],
                ["knowledgeFields", "Fields of Knowledge"],
              ]}
              emptyLabel="No sponsor / investor accounts found."
            />
          )}

        </section>

      )}

      {/* ================= USERS ================= */}

      {activeTab === "users" && (
        <section>
          <h3>User Management</h3>
          <p>Coming soon...</p>
        </section>
      )}

      {/* ================= VIDEOS ================= */}

      {activeTab === "videos" && (
        <section>
          <h3>Admin Video Uploads</h3>
          <p style={{ color: "#52616b", lineHeight: 1.6 }}>
            Upload the videos that users will choose from on the Request a Meet-up page.
          </p>
          <button
            type="button"
            onClick={() => navigate("/upload?purpose=meetup")}
            style={primaryButtonStyle}
          >
            Upload Video
          </button>
        </section>
      )}

      {/* ================= WALLET ================= */}

      {activeTab === "wallets" && (
        <section>

          <h3>Wallet Oversight</h3>

          <WithdrawalsAdmin />

        </section>
      )}

      {activeTab === "inbox" && (
        <section>
          <SharedInbox
            returnTo="/admin"
            returnLabel="Admin Dashboard"
            inboxEyebrow="Admin inbox"
            inboxTitle="Admin Messages"
            inboxDescription="Communicate directly with citizens, ambassadors, merchants, users, backers, superbosses, and sponsors from one place."
            isAdminMode
          />
        </section>
      )}

    </div>
  );
}

/* ================= STYLE ================= */

function tabStyle(active) {
  return {
    marginRight: 10,
    marginBottom: 10,
    padding: "8px 14px",
    borderRadius: 4,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: active ? "#000" : "#f3f3f3",
    color: active ? "#fff" : "#000"
  };
}

const primaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  background: "#000",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
