// src/pages/Admin.jsx

import { useState } from "react";
import { auth } from "../config/firebase";
import PromoterApproval from "./admin/PromoterApproval";

export default function Admin() {
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ padding: 30, maxWidth: 1100 }}>
      <h1>Admin Dashboard</h1>

      <p style={{ marginBottom: 20 }}>
        <strong>Logged in as:</strong>{" "}
        {user?.email || user?.phoneNumber}
      </p>

      <hr />

      {/* ================= NAVIGATION ================= */}
      <div style={{ marginTop: 20, marginBottom: 30 }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={tabStyle(activeTab === "overview")}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab("promoters")}
          style={tabStyle(activeTab === "promoters")}
        >
          Promoter Approvals
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
      </div>

      {/* ================= CONTENT AREA ================= */}

      {activeTab === "overview" && (
        <section>
          <h3>Platform Controls</h3>
          <ul>
            <li>Promoter approvals</li>
            <li>User management (coming soon)</li>
            <li>Video moderation (coming soon)</li>
            <li>Reports & analytics (coming soon)</li>
            <li>Wallet oversight (coming soon)</li>
          </ul>
        </section>
      )}

      {activeTab === "promoters" && <PromoterApproval />}

      {activeTab === "users" && (
        <section>
          <h3>User Management</h3>
          <p>Coming soon...</p>
        </section>
      )}

      {activeTab === "videos" && (
        <section>
          <h3>Video Moderation</h3>
          <p>Coming soon...</p>
        </section>
      )}

      {activeTab === "wallets" && (
        <section>
          <h3>Wallet Oversight</h3>
          <p>Coming soon...</p>
        </section>
      )}
    </div>
  );
}

/* ================= HELPER STYLE ================= */

function tabStyle(active) {
  return {
    marginRight: 10,
    padding: "8px 14px",
    borderRadius: 4,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: active ? "#000" : "#f3f3f3",
    color: active ? "#fff" : "#000"
  };
}