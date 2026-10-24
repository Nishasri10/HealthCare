import { Activity, CalendarDays, ClipboardList, HeartPulse, LayoutDashboard, LogOut, Menu, Search, Settings, Stethoscope, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = {
  patient: [
    ['Overview', '/patient', LayoutDashboard],
    ['Find doctors', '/doctors', Search],
    ['My appointments', '/patient/appointments', CalendarDays],
    ['Medical history', '/patient/records', ClipboardList],
    ['Profile & settings', '/patient/profile', Settings]
  ],
  doctor: [
    ['Overview', '/doctor', LayoutDashboard],
    ['Appointments', '/doctor/appointments', CalendarDays],
    ['Availability', '/doctor/availability', Activity],
    ['Patient records', '/doctor/records', ClipboardList],
    ['Professional profile', '/doctor/profile', Settings]
  ],
  admin: [
    ['Overview', '/admin', LayoutDashboard],
    ['User management', '/admin/users', Users],
    ['Doctor management', '/admin/doctors', Stethoscope],
    ['Specialisations', '/admin/specialisations', HeartPulse],
    ['Appointments', '/admin/appointments', CalendarDays],
    ['Reports', '/admin/reports', Activity],
    ['Profile & settings', '/admin/profile', Settings]
  ]
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar${mobileNavOpen ? ' mobile-nav-expanded' : ''}`}>
      <Link to={`/${user.role}`} className="brand" aria-label="CarePoint home"><span className="brand-mark"><HeartPulse size={20} /></span><span>CarePoint</span></Link>
      <button className="mobile-dashboard-menu" type="button" aria-label={mobileNavOpen ? 'Close dashboard navigation' : 'Open dashboard navigation'} aria-expanded={mobileNavOpen} aria-controls="dashboard-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <div className="sidebar-label">{user.role} workspace</div>
      <nav id="dashboard-navigation" className="side-nav" aria-label={`${user.role} navigation`}>
        {(links[user.role] || []).map(([label, to, Icon]) => <NavLink key={to} to={to} end={to === `/${user.role}`} onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <Link to={`/${user.role}/profile`} className="user-mini"><div className="avatar">{user.name?.slice(0, 1)}</div><div className="user-mini-copy"><strong>{user.name}</strong><span>{user.role}</span></div></Link>
        <button onClick={logout} className="side-link side-signout"><LogOut size={18} /><span>Sign out</span></button>
      </div>
    </aside>
    <main className="main-area">
      <header className="dash-topbar">
        <div><span className="eyebrow">CAREPOINT / {user.role.toUpperCase()}</span><p>Good day, {user.name?.split(' ')[0]}</p></div>
        <div className="topbar-right"><span className="secure-label"><span className="secure-dot" />Secure workspace</span><Link to={`/${user.role}/profile`} className="avatar topbar-profile" aria-label="Open profile">{user.name?.slice(0, 1)}</Link><button onClick={logout} className="mobile-signout" aria-label="Sign out"><LogOut size={18} /></button></div>
      </header>
      <div className="page-content"><Outlet /></div>
    </main>
  </div>;
}
