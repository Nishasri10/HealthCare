import { ArrowRight, CalendarCheck2, ChevronRight, Clock3, Heart, HeartPulse, Plus, RotateCw, ShieldCheck, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import { clinicDateTime } from '../utils/date';

function dateTime(value) {
  return clinicDateTime(value);
}

export function LandingPage() {
  const [doctors, setDoctors] = useState([]);
  const [specialisations, setSpecialisations] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([api.get('/doctors'), api.get('/doctors/specialisations')])
      .then(([doctorResponse, specResponse]) => {
        if (current) {
          setDoctors(doctorResponse.data.slice(0, 3));
          setSpecialisations(specResponse.data);
        }
      })
      .catch((reason) => { if (current) setError(reason.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/doctors?search=${encodeURIComponent(search)}`);
  };
  return <div className="public-page">
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-kicker"><span className="pulse" />CARE THAT FITS YOUR LIFE</div>
        <h1>Good health starts with <em>the right care.</em></h1>
        <p>Find trusted doctors, book an appointment that works for you, and keep your health journey in one calm, secure place.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <Stethoscope size={20} /><input aria-label="Search doctors or speciality" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Doctor name or speciality" />
          <button type="submit" className="button">Find care <ArrowRight size={17} /></button>
        </form>
        <div className="hero-proof"><span><ShieldCheck size={16} /> Private & secure</span><span><Heart size={16} /> Care made personal</span></div>
      </div>
      <div className="hero-visual">
        <div className="hero-art" aria-hidden="true"><div className="art-circle circle-one" /><div className="art-circle circle-two" /><div className="art-plus">+</div><div className="art-wave" /></div>
        <div className="floating-card appointment-float"><span className="float-icon"><CalendarCheck2 size={20} /></span><div><strong>Care, on your time</strong><small>Simple online scheduling</small></div></div>
        <div className="floating-card doctor-float"><span className="doctor-face">SR</span><div><strong>Thoughtful specialists</strong><small>Here for your wellbeing</small></div><span className="float-check">✓</span></div>
      </div>
    </section>
    <section className="trust-strip"><span>YOUR HEALTH, SIMPLIFIED</span><strong>Find care. Feel cared for.</strong><span className="trust-note">A more thoughtful way to manage your appointments.</span></section>
    <section className="section-wrap" id="specialities">
      <div className="section-heading"><div><span className="eyebrow">CARE, YOUR WAY</span><h2>Find the right specialist</h2><p>Personalized care starts with a doctor who understands you.</p></div><Link to="/doctors" className="text-link">View all doctors <ArrowRight size={16} /></Link></div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {error && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry loading care options</button>}
      {!error && <div className="speciality-grid">{specialisations.slice(0, 4).map((item, index) => <Link to={`/doctors?specialisation=${item.id}`} className={`speciality-card specialty-${index}`} key={item.id}><span className="specialty-icon"><Stethoscope size={21} /></span><strong>{item.name}</strong><span>Explore care <ChevronRight size={15} /></span></Link>)}</div>}
    </section>
    <section className="section-wrap doctors-section">
      <div className="section-heading"><div><span className="eyebrow">MEET YOUR CARE TEAM</span><h2>Care you can count on</h2><p>Explore qualified professionals ready to listen.</p></div><Link to="/doctors" className="text-link">Browse doctors <ArrowRight size={16} /></Link></div>
      {loading ? <Loading label="Loading care options…" /> : error ? null : doctors.length ? <div className="doctor-card-grid">{doctors.map((doctor, index) => <Link to={`/doctors/${doctor.id}`} key={doctor.id} className="doctor-card"><div className={`doctor-avatar doctor-avatar-${index}`}>{doctor.name.split(' ').map((part) => part[0]).slice(-2).join('')}</div><span className="doctor-specialty">{doctor.specialisation}</span><h3>{doctor.name}</h3><p>{doctor.qualification} · {doctor.experience_years} years experience</p><div className="doctor-card-bottom"><span>₹{Number(doctor.fee).toFixed(0)} <small>/ visit</small></span><span className="round-arrow"><ArrowRight size={16} /></span></div></Link>)}</div> : <EmptyState title="No doctors available">Doctor profiles will appear here when they are available in the directory.</EmptyState>}
    </section>
    <section className="how-section" id="how-it-works"><div className="section-wrap"><div className="section-heading"><div><span className="eyebrow">HOW IT WORKS</span><h2>Better care, made simple</h2></div></div><div className="steps-grid"><article><span>01</span><h3>Find your doctor</h3><p>Explore specialists and find the right fit for you.</p></article><article><span>02</span><h3>Choose a time</h3><p>Book an available appointment in just a few clicks.</p></article><article><span>03</span><h3>Feel cared for</h3><p>Stay connected to your appointments and health records.</p></article></div></div></section>
    <section className="cta-band"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>Ready to put your health first?</h2></div><Link to="/doctors" className="button button-light">Book an appointment <ArrowRight size={17} /></Link></section>
    <footer className="site-footer"><Link to="/" className="brand" aria-label="CarePoint home"><span className="brand-mark"><HeartPulse size={19} /></span><span>CarePoint</span></Link><span>Thoughtful care for every step of your health journey.</span><span>© 2026 CarePoint</span></footer>
  </div>;
}

export function DoctorsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [specialisations, setSpecialisations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const search = params.get('search') || '';
  const specialisation = params.get('specialisation') || '';
  const availableOn = params.get('availableOn') || '';
  const mode = params.get('mode') || '';
  const availability = params.get('availability') || '';
  const minFee = params.get('minFee') || '';
  const maxFee = params.get('maxFee') || '';
  const sort = params.get('sort') || 'name';
  const page = Number(params.get('page') || 1);
  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      api.get('/doctors', { params: {
        search: search || undefined, specialisation: specialisation || undefined, availableOn: availableOn || undefined,
        mode: mode || undefined, availability: availability || undefined,
        minFee: minFee || undefined, maxFee: maxFee || undefined, sort, page, limit: 12
      } }),
      api.get('/doctors/specialisations')
    ]).then(([doctorResult, specResult]) => {
      if (!Array.isArray(doctorResult.data) || !doctorResult.pagination || !Array.isArray(specResult.data)) {
        throw new Error('The doctor service returned an unexpected response. Please retry.');
      }
      if (current) {
        setDoctors(doctorResult.data);
        setPagination(doctorResult.pagination);
        setSpecialisations(specResult.data);
        setError('');
      }
    }).catch((reason) => { if (current) setError(reason.message || 'Could not load doctors.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [search, specialisation, availableOn, mode, availability, minFee, maxFee, sort, page, retry]);
  const update = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    return next;
  });
  const clearFilters = () => setParams({});
  return <main className="public-content">
    <div className="page-title-row"><div><span className="eyebrow">YOUR CARE TEAM</span><h1>Find a doctor</h1><p>Browse fictional demo profiles and filter by speciality to explore care options.</p></div>{user?.role === 'admin' && <Link to="/admin/doctors" className="button" aria-label="Add a doctor (administrator)"><Plus size={17} /> Add a doctor</Link>}</div>
    <div className="filter-bar doctor-filter-bar">
      <label className="search-field"><Stethoscope size={18} /><input aria-label="Search by doctor name, speciality, or qualification" value={search} onChange={(event) => update('search', event.target.value)} placeholder="Search doctor or speciality" /></label>
      <select aria-label="Filter by speciality" value={specialisation} onChange={(event) => update('specialisation', event.target.value)}><option value="">All specialities</option>{specialisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="Filter by consultation mode" value={mode} onChange={(event) => update('mode', event.target.value)}><option value="">Any consultation mode</option><option value="In-person">In-person</option><option value="Online">Online</option><option value="Both">In-person or online</option></select>
      <select aria-label="Filter by availability" value={availability} onChange={(event) => update('availability', event.target.value)}><option value="">Any availability</option><option value="available">Has future appointments</option><option value="unavailable">No future appointments</option></select>
      <label className="available-filter">Available on<input aria-label="Available on date" type="date" value={availableOn} onChange={(event) => update('availableOn', event.target.value)} /></label>
      <label className="fee-filter">Min fee<input aria-label="Minimum consultation fee" type="number" min="0" value={minFee} onChange={(event) => update('minFee', event.target.value)} placeholder="Any" /></label>
      <label className="fee-filter">Max fee<input aria-label="Maximum consultation fee" type="number" min="0" value={maxFee} onChange={(event) => update('maxFee', event.target.value)} placeholder="Any" /></label>
      <label>Sort by<select aria-label="Sort doctors" value={sort} onChange={(event) => update('sort', event.target.value)}><option value="name">Name</option><option value="experience">Experience</option><option value="fee">Fee: low to high</option></select></label>
      <button type="button" className="button button-outline button-small" onClick={clearFilters}>Clear filters</button>
    </div>
    {error && <><ErrorMessage>{error}</ErrorMessage><button className="button button-outline" type="button" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry loading doctors</button></>}
    {loading ? <div className="doctor-card-grid listing-grid" aria-label="Loading doctors">{Array.from({ length: 6 }, (_, index) => <DoctorSkeleton key={index} />)}</div> : doctors.length ? <><div className="doctor-card-grid listing-grid">{doctors.map((doctor, index) => <DoctorCard key={doctor.id} doctor={doctor} index={index} />)}</div><PageControls page={pagination.page} hasMore={pagination.hasMore} onPage={(next) => update('page', String(next))} /></> : !error && <EmptyState title="No doctors found"><span>Try changing your search or filters.</span><button type="button" className="button-link" onClick={clearFilters}>Clear all filters</button></EmptyState>}
  </main>;
}

function DoctorCard({ doctor, index }) {
  const profileHref = `/doctors/${doctor.id}`;
  return <article className="doctor-card doctor-directory-card">
    <div className={`doctor-avatar doctor-avatar-${index % 3}`} aria-hidden="true">{doctor.name.split(' ').map((part) => part[0]).slice(-2).join('')}</div>
    <span className="demo-profile-tag">Fictional demo profile</span><span className="doctor-specialty">{doctor.specialisation}</span><h2>{doctor.name}</h2>
    <p>{doctor.qualification} · {doctor.experience_years} years experience</p>
    <dl className="doctor-card-details">
      <div><dt>Consultation</dt><dd>{doctor.consultation_mode || 'In-person'}</dd></div>
      <div><dt>Fee</dt><dd>₹{Number(doctor.fee).toFixed(0)}</dd></div>
      <div><dt>Availability</dt><dd>{doctor.available ? `Next: ${dateTime(doctor.next_available_at)}` : 'No future slots'}</dd></div>
      <div><dt>Languages</dt><dd>{doctor.languages?.length ? doctor.languages.join(', ') : 'Ask at booking'}</dd></div>
    </dl>
    <div className="doctor-card-actions"><Link to={profileHref} className="button button-small">{doctor.available ? 'View profile & book' : 'View profile'} <ArrowRight size={15} /></Link></div>
  </article>;
}

function DoctorSkeleton() {
  return <div className="doctor-card doctor-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /></div>;
}

function PageControls({ page, hasMore, onPage }) {
  if (page <= 1 && !hasMore) return null;
  return <div className="pagination-controls"><button className="button button-outline button-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page}</span><button className="button button-outline button-small" disabled={!hasMore} onClick={() => onPage(page + 1)}>Next</button></div>;
}

export function DoctorDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setDoctor(null);
    setSlots([]);
    setSelected('');
    Promise.all([api.get(`/doctors/${id}`), api.get(`/doctors/${id}/slots`)])
      .then(([profile, available]) => {
        if (current) {
          setDoctor(profile.data);
          setSlots(available.data);
        }
      })
      .catch((reasonError) => { if (current) setError(reasonError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, retry]);
  async function book(event) {
    event.preventDefault();
    if (!selected || reason.trim().length < 3 || busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const { data } = await api.post('/appointments', { doctorId: Number(id), slotId: Number(selected), reason });
      setMessage(`Your appointment request #${data.id} has been sent.`);
      setSelected(''); setReason('');
      try {
        const response = await api.get(`/doctors/${id}/slots`);
        setSlots(response.data);
      } catch (refreshError) {
        setError(`Your appointment request was confirmed, but available times could not be refreshed: ${refreshError.message}`);
      }
    } catch (reasonError) { setError(reasonError.message); } finally { setBusy(false); }
  }
  if (loading) return <main className="public-content"><Loading /></main>;
  if (!doctor) return <main className="public-content"><ErrorMessage>{error || 'Doctor not found.'}</ErrorMessage>{error && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button>}<Link to="/doctors" className="text-link">Back to doctors</Link></main>;
  return <main className="public-content doctor-detail">
    <Link to="/doctors" className="back-link">← All doctors</Link>
    <div className="detail-grid">
      <section className="panel doctor-profile-panel"><div className="profile-banner"><div className="doctor-avatar doctor-avatar-0 large-avatar" aria-hidden="true">{doctor.name.split(' ').map((part) => part[0]).slice(-2).join('')}</div><div><span className="demo-profile-tag">Fictional demo profile</span><span className="doctor-specialty">{doctor.specialisation}</span><h1>{doctor.name}</h1><p>{doctor.qualification}</p></div></div><div className="profile-stats"><div><strong>{doctor.experience_years}+</strong><span>Years experience</span></div><div><strong>₹{Number(doctor.fee).toFixed(0)}</strong><span>Consultation fee</span></div><div><strong>{doctor.consultation_minutes} min</strong><span>Appointment</span></div><div><strong>{doctor.consultation_mode || 'In-person'}</strong><span>Consultation mode</span></div></div><div className="profile-about"><h2>About</h2><p>{doctor.bio || 'A dedicated healthcare professional ready to support your wellbeing.'}</p><h2>Languages</h2><p>{doctor.languages?.length ? doctor.languages.join(', ') : 'Not specified'}</p><h2>Speciality</h2><p>{doctor.specialisation}</p></div></section>
      <section className="panel booking-panel"><div className="panel-heading"><div><span className="eyebrow">BOOK A VISIT</span><h2>Choose a time</h2></div><Clock3 size={20} /></div>
        {!user ? <div className="login-prompt"><p>Sign in as a patient to request an appointment.</p><Link to="/login" className="button">Log in to book <ArrowRight size={16} /></Link></div> : user.role !== 'patient' ? <div className="login-prompt"><p>Appointment booking is available to patient accounts.</p></div> :
          <form onSubmit={book} className="stack-form"><label>Available appointments<select required value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select a time</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{dateTime(slot.starts_at)}</option>)}</select></label><label>Reason for visit<textarea required minLength="3" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="A short note to help your doctor prepare" /></label><ErrorMessage>{error}</ErrorMessage>{error && <button type="button" className="button button-outline" onClick={async () => { setError(''); try { const response = await api.get(`/doctors/${id}/slots`); setSlots(response.data); } catch (refreshError) { setError(refreshError.message); } }}><RotateCw size={16} /> Refresh available times</button>}{message && <div className="notice success"><CalendarCheck2 size={17} />{message}</div>}<button className="button full-button" disabled={busy || !slots.length || !selected}>{busy ? 'Sending request…' : slots.length ? 'Request appointment' : 'No times available'} <ArrowRight size={17} /></button></form>}
      </section>
    </div>
  </main>;
}

export function AuthPage({ mode }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const isRegister = mode === 'register';
  useEffect(() => { if (user) navigate(`/${user.role}`, { replace: true }); }, [user, navigate]);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const signedIn = isRegister ? await register(form) : await login(form.email, form.password);
      navigate(`/${signedIn.role}`, { replace: true });
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Link to="/" className="brand" aria-label="CarePoint home"><span className="brand-mark"><HeartPulse size={19} /></span><span>CarePoint</span></Link><span className="eyebrow">{isRegister ? 'A HEALTHIER TOMORROW' : 'WELCOME BACK'}</span><h1>{isRegister ? 'Create your account' : 'Good to see you again'}</h1><p>{isRegister ? 'Create a patient account to find care and manage your appointments.' : 'Sign in to continue to your secure healthcare workspace.'}</p>
    <form className="stack-form" onSubmit={submit}>{isRegister && <label>Full name<input autoComplete="name" required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /> </label>}<label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label><label>Password<input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 10 : 1} maxLength="72" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} /></label><ErrorMessage>{error}</ErrorMessage><button className="button full-button" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create patient account' : 'Sign in'} <ArrowRight size={17} /></button></form>
    <div className="auth-switch">{isRegister ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New to CarePoint? <Link to="/register">Create a patient account</Link></>}</div><div className="auth-note"><ShieldCheck size={16} /> Your health information is protected by role-based access.</div>
  </section></main>;
}

export function NotFoundPage() {
  return <main className="public-content not-found"><span className="eyebrow">PAGE NOT FOUND</span><h1>We can’t find that page.</h1><p>It may have moved, or the address may be incorrect.</p><Link to="/" className="button">Back to home <ArrowRight size={17} /></Link></main>;
}
