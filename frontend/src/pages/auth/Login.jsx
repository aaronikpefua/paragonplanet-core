// src/pages/auth/Login.jsx
import { useEffect, useState } from "react";
import {
  FacebookAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  TwitterAuthProvider,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import { useNavigate, Link } from "react-router-dom";

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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingProvider, setLoadingProvider] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          navigate("/", { replace: true });
        }
      })
      .catch((error) => {
        alert(error.message);
      });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/", { replace: true }); // ALWAYS go home
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential"
      ) {
        navigate("/signup", { replace: true });
      } else {
        alert(err.message);
      }
    }
  };

  const handleSocialLogin = async (providerFactory, providerKey) => {
    const provider = providerFactory();

    try {
      setLoadingProvider(providerKey);
      await signInWithPopup(auth, provider);
      navigate("/", { replace: true });
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
      <h2>Login</h2>

      <form onSubmit={handleLogin} style={formStyle}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={fieldStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={fieldStyle}
        />

        <button type="submit" style={primaryButtonStyle}>Login</button>
      </form>

      <div style={socialStackStyle}>
        {SOCIAL_PROVIDERS.map((social) => (
          <button
            key={social.key}
            type="button"
            onClick={() => handleSocialLogin(social.provider, social.key)}
            disabled={Boolean(loadingProvider)}
            style={socialButtonStyle}
          >
            {loadingProvider === social.key ? "Connecting..." : social.label}
          </button>
        ))}
      </div>

      <p style={{ marginTop: 20 }}>
        New here? <Link to="/signup">Create account</Link>
      </p>
    </div>
  );
}

const pageStyle = {
  padding: 40,
  maxWidth: 420,
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

const socialStackStyle = {
  display: "grid",
  gap: 10,
  marginTop: 12,
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
