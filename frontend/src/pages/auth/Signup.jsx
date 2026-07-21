import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  TwitterAuthProvider,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../config/firebase";

const SOCIAL_PROVIDERS = [
  {
    key: "google",
    label: "Continue with Google",
    provider: () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return provider;
    },
  },
  {
    key: "facebook",
    label: "Continue with Facebook",
    provider: () => {
      const provider = new FacebookAuthProvider();
      provider.setCustomParameters({ auth_type: "reauthenticate", prompt: "select_account" });
      return provider;
    },
  },
  {
    key: "twitter",
    label: "Continue with X",
    provider: () => {
      const provider = new TwitterAuthProvider();
      provider.setCustomParameters({ force_login: "true" });
      return provider;
    },
  },
];

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingProvider, setLoadingProvider] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          navigate("/roles", { replace: true });
        }
      })
      .catch((error) => {
        alert(error.message);
      });
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      await createUserWithEmailAndPassword(auth, email, password);

      // ✅ New users MUST choose role
      navigate("/roles");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSocialSignup = async (providerFactory, providerKey) => {
    const provider = providerFactory();

    try {
      setLoadingProvider(providerKey);
      await signInWithPopup(auth, provider);
      navigate("/roles", { replace: true });
    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/popup-closed-by-user"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }

      alert(error.message);
    } finally {
      setLoadingProvider("");
    }
  };

  return (
    <div style={pageStyle}>
      <h2>Signup</h2>

      <div style={socialStackStyle}>
        {SOCIAL_PROVIDERS.map((social) => (
          <button
            key={social.key}
            type="button"
            onClick={() => handleSocialSignup(social.provider, social.key)}
            disabled={Boolean(loadingProvider)}
            style={socialButtonStyle}
          >
            {loadingProvider === social.key ? "Connecting..." : social.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSignup} style={formStyle}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          style={fieldStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          style={fieldStyle}
        />

        <button type="submit" style={primaryButtonStyle}>
          Create Account
        </button>
      </form>

      <p style={{ marginTop: 20 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

const pageStyle = {
  padding: 40,
  maxWidth: 420,
};

const socialStackStyle = {
  display: "grid",
  gap: 10,
  marginTop: 18,
  marginBottom: 12,
};

const socialButtonStyle = {
  width: "100%",
  minHeight: 44,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  background: "#fff",
  color: "#101828",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};

const formStyle = {
  display: "grid",
  gap: 12,
};

const fieldStyle = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  font: "inherit",
};

const primaryButtonStyle = {
  minHeight: 44,
  border: "none",
  borderRadius: 8,
  background: "#101828",
  color: "#fff",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};
