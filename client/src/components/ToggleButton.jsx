// ToggleButton.jsx
import React from "react";
import "../styles/toggle-button.css";

export default function ToggleButton({ isOpen, onClick }) {
  return (
    <button 
      className={`toggle-btn ${isOpen ? 'active' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      <div className="hamburger-line"></div>
      <div className="hamburger-line"></div>
      <div className="hamburger-line"></div>
    </button>
  );
}