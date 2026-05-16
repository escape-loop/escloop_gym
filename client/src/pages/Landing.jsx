// LandingPage.jsx
import React, { useState, useEffect } from "react"; // <--- CHANGED: Added useEffect
import "../styles/index.css";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AppContent } from "../context/context.jsx";
import axios from "axios";
import { toast } from "react-toastify";

// Eye icon SVG component (No changes here)
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


// change to your server URL

export default function LandingPage() {
  const { backendurl, setisloggedin, getuserdata, isauthenticated } = useContext(AppContent)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const navigate = useNavigate();

  // 1. READ: Load credentials when the page opens
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPass = localStorage.getItem('rememberedPass');

    if (savedEmail) setIdentifier(savedEmail);
    if (savedPass) setPassword(savedPass);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (!identifier || !password) {
      setMsg({ type: "error", text: "Please enter identifier and password." });
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(backendurl + '/login', {
        identifier,
        password
      }, { withCredentials: true });
      const data = response.data;

      if (data.success) {
        // 2. WRITE: Save credentials ONLY if login is successful  <--- CHANGED
        localStorage.setItem('rememberedEmail', identifier);
        localStorage.setItem('rememberedPass', password);
        // --------------------------------------------------------

        setisloggedin(true)
        getuserdata()
        navigate('/dashboard')
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      setMsg({ type: "error", text: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-root">
      <div className="hero">
        <div className="hero-content">
          <div className="brand-pill">ESCLOOP GYM SUITE</div>
          <h1 className="hero-title">
            Manage your <span className="accent">gym</span> in one place.
          </h1>
          <p className="hero-subtitle">
            Simple member tracking, payments, and attendance built for modern fitness businesses.
          </p>
          <ul className="hero-points">
            <li>Clean, distraction-free dashboard.</li>
            <li>Member and plan management in seconds.</li>
            <li>Secure, cookie-based login for staff.</li>
          </ul>
        </div>

        <div className="login-card">
          <h2 className="login-title" style={{ paddingBottom: "20px", paddingLeft: "130px" }}>Sign in</h2>


          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label">
              Email or User ID
              <input
                type="text"
                className="field-input"
                placeholder="you@example.com or GYM123"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </label>

            <label className="field-label">
              Password
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

            {msg.text ? (
              <div className="form-message">
                {msg.text}
              </div>
            ) : null}

            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>


            <button
              type="button"
              className="link-btn"
              onClick={() => navigate("/forgotpassword")}
            >
              Forgot password?
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}