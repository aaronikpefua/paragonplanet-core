import { useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Profile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "citizen_profiles", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      }
    };

    loadProfile();
  }, []);

  if (!profile) return <p>Loading profile...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Profile</h1>

      <h3>Identity</h3>
      <p><b>Stage Name:</b> {profile.stageName}</p>
      <p><b>Real Name:</b> {profile.realName}</p>
      <p><b>Email:</b> {profile.email}</p>
      <p><b>Role:</b> {profile.role}</p>

      <h3>Personal Information</h3>
      <p><b>Age:</b> {profile.age}</p>
      <p><b>Gender:</b> {profile.gender}</p>
      <p><b>Marital Status:</b> {profile.maritalStatus}</p>
      <p><b>Profession:</b> {profile.profession}</p>
      <p><b>Phone:</b> {profile.phone}</p>
      <p><b>Country:</b> {profile.country}</p>
      <p><b>State:</b> {profile.state}</p>
      <p><b>Tribe:</b> {profile.tribe}</p>
      <p><b>Residence:</b> {profile.residence}</p>

      <h3>Talents</h3>
      <ul>
        {profile.talents.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <h3>Promoter</h3>
      <p>{profile.promoterName || "None"}</p>

      <h3>Wallet</h3>
      <p>Status: Coming soon</p>

      <h3 style={{ color: "red" }}>Danger Zone</h3>
      <button disabled>Delete Posts (coming soon)</button>
      <br />
      <button disabled style={{ color: "red" }}>
        Delete Account (coming soon)
      </button>
    </div>
  );
}
