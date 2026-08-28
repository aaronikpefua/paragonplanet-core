import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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
    redirectOnly: false,
    provider: () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return provider;
    },
  },
  {
    key: "facebook",
    label: "Continue with Facebook",
    redirectOnly: false,
    provider: () => {
      const provider = new FacebookAuthProvider();
      provider.setCustomParameters({ auth_type: "reauthenticate", prompt: "select_account" });
      return provider;
    },
  },
  {
    key: "twitter",
    label: "Continue with X",
    redirectOnly: true,
    provider: () => {
      const provider = new TwitterAuthProvider();
      provider.setCustomParameters({ force_login: "true" });
      return provider;
    },
  },
  {
    key: "apple",
    label: "Continue with Apple",
    redirectOnly: true,
    provider: () => {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      return provider;
    },
  },
];

export default function Signup() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState("");
  const [notice, setNotice] = useState("");
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          navigate("/roles", { replace: true });
        }
      })
      .catch((error) => {
        setNotice(error.message);
      });
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    const value = identifier.trim();

    if (isPhoneIdentifier(value)) {
      await sendPhoneOtp(value);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, value, password);
      navigate("/roles");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const sendPhoneOtp = async (phoneNumber) => {
    try {
      const verifier = getRecaptchaVerifier(recaptchaRef);
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      setNotice("OTP sent to your phone.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!confirmationResult) {
      setNotice("Request phone OTP first.");
      return;
    }

    try {
      await confirmationResult.confirm(otp.trim());
      navigate("/roles", { replace: true });
    } catch (error) {
      setNotice(error.message);
    }
  };

  const handleSocialSignup = async (providerFactory, providerKey, redirectOnly) => {
    const provider = providerFactory();

    try {
      setLoadingProvider(providerKey);
      if (redirectOnly) {
        await signInWithRedirect(auth, provider);
        return;
      }

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

      setNotice(error.message);
    } finally {
      setLoadingProvider("");
    }
  };

  const isPhoneMode = isPhoneIdentifier(identifier);

  return (
    <div style={pageStyle}>
      <h2>Signup</h2>

      {notice ? <p style={noticeStyle}>{notice}</p> : null}

      <div style={socialStackStyle}>
        {SOCIAL_PROVIDERS.map((social) => (
          <button
            key={social.key}
            type="button"
            onClick={() => handleSocialSignup(social.provider, social.key, social.redirectOnly)}
            disabled={Boolean(loadingProvider)}
            style={socialButtonStyle}
          >
            {loadingProvider === social.key ? "Connecting..." : social.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSignup} style={formStyle}>
        <input
          type="text"
          placeholder="Email / Phone number"
          value={identifier}
          required
          onChange={(e) => setIdentifier(e.target.value)}
          style={fieldStyle}
        />

        {!isPhoneMode && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            style={fieldStyle}
          />
        )}

        <button type="submit" style={primaryButtonStyle}>
          {isPhoneMode ? "Send Phone OTP" : "Create Account"}
        </button>
      </form>

      {confirmationResult && (
        <div style={formStyle}>
          <input
            type="text"
            placeholder="Enter phone OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={fieldStyle}
          />
          <button type="button" onClick={verifyPhoneOtp} style={primaryButtonStyle}>
            Verify OTP
          </button>
        </div>
      )}

      <div id="signup-recaptcha" ref={recaptchaRef} />

      <p style={{ marginTop: 20 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

function isPhoneIdentifier(value) {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("+") || /^[0-9][0-9\s\-()]{6,}$/.test(trimmed);
}

function getRecaptchaVerifier(recaptchaRef) {
  if (!window.paragonSignupRecaptchaVerifier) {
    window.paragonSignupRecaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
      size: "invisible",
    });
  }
  return window.paragonSignupRecaptchaVerifier;
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
  marginBottom: 12,
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

const noticeStyle = {
  padding: 10,
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 700,
};
