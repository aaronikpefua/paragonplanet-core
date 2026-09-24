import { auth } from "../config/firebase";
import { API_URL, appCheckFetch } from "./supportActions";

async function authenticatedTermsRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const token = await user.getIdToken();
  const response = await appCheckFetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Citizen Video Terms are temporarily unavailable.");
  return payload;
}

export async function loadCitizenVideoTerms() {
  const payload = await authenticatedTermsRequest("/api/video/terms");
  return payload.terms;
}

export async function acceptCitizenVideoTerms() {
  return authenticatedTermsRequest("/api/video/terms/accept", {
    method: "POST",
    body: JSON.stringify({ accepted: true }),
  });
}
