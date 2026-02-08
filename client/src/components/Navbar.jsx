// client/src/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SITE_NAME } from "../config/branding";
import { useNavbarSettings } from "../context/NavbarContext";
import BrandImage from "./BrandImage";
import ProfileDropdown from "./ProfileDropdown";
import "../styles/nav.css";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { isHidden, getNavItem } = useNavbarSettings();
  
  // Get dynamic labels from navbar settings
  const getLabel = (id, fallback) => getNavItem(id)?.label || fallback;
  
  // Get Supabase auth state if available
  let user = null;
  let profile = null;
  let isAdmin = false;
  
  try {
    const auth = useAuth();
    user = auth.user;
    profile = auth.profile;
    isAdmin = profile?.role === 'admin';
  } catch {
    // useAuth not available (Supabase not configured)
  }

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

  return (
    <header className="nav-root" ref={menuRef}>
      <div className="nav-bar container">
        <Link to="/" className="brand">
          <BrandImage 
            slot="header-logo" 
            maxHeight={40}
            maxWidth={200}
            fallback={<span>{SITE_NAME}</span>}
            showPlaceholder={true}
          />
        </Link>

        <nav className="links-desktop" aria-label="Primary">
          {!isHidden('home') && <NavLink to="/" className="link">{getLabel('home', 'Home')}</NavLink>}
          {!isHidden('journals') && <NavLink to="/blog" className="link">{getLabel('journals', 'Journals')}</NavLink>}
          {!isHidden('about') && <NavLink to="/about" className="link">{getLabel('about', 'About')}</NavLink>}
          {!isHidden('contact') && <NavLink to="/contact" className="link">{getLabel('contact', 'Contact')}</NavLink>}
          {isAdmin && <NavLink to="/dashboard" className="link">Dashboard</NavLink>}
        </nav>

        {/* Profile Dropdown */}
        <ProfileDropdown />

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
        {!isHidden('home') && <NavLink to="/" className="panel-link" onClick={onNav}>{getLabel('home', 'Home')}</NavLink>}
        {!isHidden('journals') && <NavLink to="/blog" className="panel-link" onClick={onNav}>{getLabel('journals', 'Journals')}</NavLink>}
        {!isHidden('about') && <NavLink to="/about" className="panel-link" onClick={onNav}>{getLabel('about', 'About')}</NavLink>}
        {!isHidden('contact') && <NavLink to="/contact" className="panel-link" onClick={onNav}>{getLabel('contact', 'Contact')}</NavLink>}
        {isAdmin && <NavLink to="/dashboard" className="panel-link" onClick={onNav}>Dashboard</NavLink>}
        {user ? (
          <span className="panel-link" style={{ cursor: 'default', color: '#6b7280' }}>
            Signed in as {user.email?.split('@')[0]}
          </span>
        ) : (
          <NavLink to="/auth/signin" className="panel-link" onClick={onNav}>Sign In</NavLink>
        )}
      </nav>
    </header>
  );
}