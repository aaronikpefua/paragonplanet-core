// src/pages/Admin.jsx
import { auth } from "../config/firebase";

export default function Admin() {
  const user = auth.currentUser;

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Dashboard</h1>

      <p>
        <strong>Logged in as:</strong>{" "}
        {user?.email || user?.phoneNumber}
      </p>

      <hr />

      <section>
        <h3>Platform Controls</h3>
        <ul>
          <li>User management (coming soon)</li>
          <li>Video moderation (coming soon)</li>
          <li>Reports & analytics (coming soon)</li>
          <li>Wallet oversight (coming soon)</li>
        </ul>
      </section>
    </div>
  );
}
