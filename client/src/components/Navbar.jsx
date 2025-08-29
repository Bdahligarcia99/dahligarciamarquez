// client/src/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAdmin } from "../features/admin/AdminProvider";
import "../styles/nav.css";

export default function Navbar({ onRequestAdminModal }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const timerRef = useRef(null);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const onNav = () => setOpen(false);

  // Long-press handlers for admin modal
  function onDown() {
    timerRef.current = window.setTimeout(() => onRequestAdminModal?.(), 1500);
  }
  function onUp() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  return (
    <header className="nav-root" ref={menuRef}>
      <div className="nav-bar container">
        <Link 
          to="/" 
          className="brand"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        >
          My Stories
        </Link>

        <nav className="links-desktop" aria-label="Primary">
          <NavLink to="/" className="link">Home</NavLink>
          <NavLink to="/stories" className="link">Stories</NavLink>
          <NavLink to="/blog" className="link">Blog</NavLink>
          {isAdmin && <NavLink to="/dashboard" className="link">Dashboard</NavLink>}
        </nav>

        <button
          className="hamburger"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen(v => !v)}
        >
          <span className="hamburger-lines" />
        </button>
      </div>

      <nav
        id="mobile-menu"
        className={`panel ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Primary"
      >
        <NavLink to="/" className="panel-link" onClick={onNav}>Home</NavLink>
        <NavLink to="/stories" className="panel-link" onClick={onNav}>Stories</NavLink>
        <NavLink to="/blog" className="panel-link" onClick={onNav}>Blog</NavLink>
        {isAdmin && <NavLink to="/dashboard" className="panel-link" onClick={onNav}>Dashboard</NavLink>}
      </nav>
    </header>
  );
}