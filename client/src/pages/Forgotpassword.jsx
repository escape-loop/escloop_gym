// ForgotPassword.jsx
import React, { useState, useContext } from "react";
import "../styles/index.css"; // same as landing page
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/context.jsx";

// Eye icon SVG component (same as Landing page)
const EyeIcon = ({ isOpen, onClick }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="password-toggle-icon"
    onClick={onClick}
    style={{ cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s' }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
  >
    {isOpen ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </>
    )}
  </svg>
);



export default function ForgotPassword() {
  const navigate = useNavigate();

  // step control
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // form data
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Default to backend running on port 5000
  const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const sendOtp = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (!email) {
      setMsg({ type: "error", text: "Please enter your email." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/resetotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data?.success) {
        setMsg({ type: "success", text: data.message || "OTP sent to your email." });
        setStep(2);
      } else {
        setMsg({ type: "error", text: data?.message || "Failed to send OTP." });
      }
    } catch {
      setMsg({ type: "error", text: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (!email || !otp || !password) {
      setMsg({ type: "error", text: "All fields are required." });
      return;
    }
    if (password !== confirm) {
      setMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/resetpassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (data?.success) {
        setMsg({ type: "success", text: data.message || "Password reset successful." });
        setTimeout(() => (window.location.href = "/"), 800);
      } else {
        setMsg({ type: "error", text: data?.message || "Password reset failed." });
      }
    } catch {
      setMsg({ type: "error", text: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-root">
      <div className="hero">
        <div className="hero-content">
          <div className="brand-pill">ESCLOOP GYM SUITE</div>
          <h1 className="hero-title">
            Reset your <span className="accent">password</span>.
          </h1>
          <p className="hero-subtitle">
            We'll send a secure OTP to your registered email to help you reset.
          </p>
        </div>

        <div className="reset-card">
          <h2 className="login-title">{step === 1 ? "Enter your email" : "Enter OTP & new password"}</h2>

          <form className="login-form" onSubmit={step === 1 ? sendOtp : resetPassword}>
            {step === 1 ? (
              <>
                <label className="field-label">
                  Email
                  <input
                    type="email"
                    className="field-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>

                <button className="primary-btn" type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <label className="field-label">
                  OTP
                  <input
                    type="text"
                    className="field-input"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </label>

                <label className="field-label">
                  New Password
                  <div className="password-input-container">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="field-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <EyeIcon
                      isOpen={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>
                </label>

                <label className="field-label">
                  Confirm Password
                  <div className="password-input-container">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="field-input"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <EyeIcon
                      isOpen={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>
                </label>

                <button className="primary-btn" type="submit" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </>
            )}

            {msg.text && <div className={`form-message ${msg.type}`}>{msg.text}</div>}

            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                if (step === 1) {
                  navigate("/");
                } else {
                  setStep(1);
                  setOtp("");
                  setPassword("");
                  setConfirm("");
                  setMsg({ type: "", text: "" });
                }
              }}
            >
              {step === 1 ? "Back to login" : "← Back to email"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
