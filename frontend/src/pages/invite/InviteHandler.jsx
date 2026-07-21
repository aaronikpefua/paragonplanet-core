import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export default function InviteHandler() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const checkInvite = async () => {
      if (!code) return navigate("/");

      const inviteRef = doc(db, "invites", code);
      const snap = await getDoc(inviteRef);

      if (!snap.exists() || snap.data().active !== true) {
        alert("Invalid invite link.");
        return navigate("/");
      }

      const invite = snap.data();

      if (invite.purpose === "support_invite") {
        localStorage.setItem("inviteSupportTargetId", invite.supportTargetId || invite.inviterId || "");
        localStorage.setItem("inviteSupportTargetRole", invite.supportTargetRole || "");
        localStorage.setItem("inviteSupportTargetName", invite.supportTargetName || "");
      } else if (invite.promoterId) {
        localStorage.setItem("invitePromoterId", invite.promoterId);
      } else {
        localStorage.removeItem("invitePromoterId");
      }

      localStorage.setItem("inviteCode", code);

      navigate("/signup");
    };

    checkInvite();
  }, [code, navigate]);

  return <p style={{ padding: 20 }}>Validating invite...</p>;
}
