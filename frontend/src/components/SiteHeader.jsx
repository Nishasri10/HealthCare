import { ArrowRight, HeartPulse, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const home = user ? `/${user.role}` : '/';
  return <header className="site-header">
    <div className="site-header-inner">
      <Link to={home} className="brand" aria-label="CarePoint home"><span className="brand-mark"><HeartPulse size={20} /></span><span>CarePoint</span></Link>
      <button className="mobile-menu" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav id="public-navigation" aria-label="Main navigation" className={open ? 'nav-links nav-open' : 'nav-links'}>
        <Link to="/doctors" onClick={() => setOpen(false)}>Find a doctor</Link>
        <a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a>
        {user ? <>
          <Link to={home} className="nav-dashboard">My dashboard <ArrowRight size={15} /></Link>
          <button className="nav-logout" onClick={logout}>Sign out</button>
        </> : <>
          <Link to="/login" className="nav-login">Log in</Link>
          <Link to="/register" className="button button-small">Get started</Link>
        </>}
      </nav>
    </div>
  </header>;
}
