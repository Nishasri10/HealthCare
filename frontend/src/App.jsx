import { Navigate, Outlet, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import SiteHeader from './components/SiteHeader';
import { Loading } from './components/Feedback';
import { AdminPage, AppointmentDetailsPage, AppointmentsPage, AvailabilityPage, DashboardHome, ProfilePage, RecordsPage } from './pages/DashboardPages';
import { AuthPage, DoctorDetailPage, DoctorsPage, LandingPage, NotFoundPage } from './pages/PublicPages';

function PublicLayout() {
  return <><SiteHeader /><Outlet /></>;
}

function Protected({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <main className="public-content access-denied"><span className="eyebrow">ACCESS RESTRICTED</span><h1>This space isn’t available to your account.</h1><p>Your account role does not have permission to view this page.</p><Link to={`/${user.role}`} className="button">Go to your dashboard</Link></main>;
  }
  return <Outlet />;
}

export default function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route index element={<LandingPage />} />
      <Route path="doctors" element={<DoctorsPage />} />
      <Route path="doctors/:id" element={<DoctorDetailPage />} />
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    <Route path="/patient" element={<Protected roles={['patient']} />}>
      <Route element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="appointments/:id" element={<AppointmentDetailsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="/doctor" element={<Protected roles={['doctor']} />}>
      <Route element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="appointments/:id" element={<AppointmentDetailsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="/admin" element={<Protected roles={['admin']} />}>
      <Route element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="users" element={<AdminPage />} />
        <Route path="doctors" element={<AdminPage />} />
        <Route path="specialisations" element={<AdminPage />} />
        <Route path="appointments" element={<AdminPage />} />
        <Route path="reports" element={<AdminPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
  </Routes>;
}
