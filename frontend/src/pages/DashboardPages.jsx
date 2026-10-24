import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, FileText, HeartPulse, Plus, RotateCw, Search, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorMessage, Loading, StatusBadge } from '../components/Feedback';
import { clinicDateKey, clinicDateTime, clinicLocalInputToIso, clinicTodayKey } from '../utils/date';

const ActivityChart = lazy(() => import('../components/ActivityChart'));

function prettyDate(value) {
  return clinicDateTime(value);
}
function useDialogFocus(dialogRef) {
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('select, input, textarea, button')?.focus();
    return () => previous?.focus?.();
  }, [dialogRef]);
}
function trapDialogKeyboard(event, onClose, busy) {
  if (event.key === 'Escape') {
    if (!busy) onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
  if (!focusable.length) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function Title({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function DashboardHome() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const request = user.role === 'admin' ? api.get('/admin/dashboard')
      : Promise.all([api.get('/appointments/my'), api.get('/records/my')])
        .then(([appointments, records]) => ({ data: { appointments: appointments.data, records: records.data } }));
    request.then((result) => { if (current) setData(result.data); })
      .catch((reason) => { if (current) setError(reason.message || 'Could not load dashboard data.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user.role, retry]);
  if (loading && !data) return <Loading />;
  if (error && !data) return <><ErrorMessage>{error}</ErrorMessage><button className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button></>;

  if (user.role === 'admin') {
    const totals = data.totals;
    return <>
      <Title eyebrow="ADMIN OVERVIEW" title="Good care starts here" description="A live view of your healthcare platform." action={<Link className="button" to="/admin/doctors"><Plus size={17} /> Add a doctor</Link>} />
      {error && <><ErrorMessage>{error}</ErrorMessage><button className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button></>}
      <div className="metric-grid"><Metric icon={Users} label="Total users" value={totals.users} tone="blue" /><Metric icon={Stethoscope} label="Doctors" value={totals.doctors} tone="mint" /><Metric icon={CalendarDays} label="Appointments" value={totals.appointments} tone="lavender" /><Metric icon={HeartPulse} label="Specialities" value={totals.specialisations} tone="peach" /></div>
      <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">PLATFORM ACTIVITY</span><h2>Appointments over time</h2></div><Activity size={18} /></div><Suspense fallback={<Loading label="Loading chart…" />}><ActivityChart data={data.monthlyAppointments} /></Suspense></section><section className="panel summary-panel"><div className="panel-heading"><div><span className="eyebrow">APPOINTMENT STATUS</span><h2>At a glance</h2></div></div><StatusCount label="Confirmed" count={totals.confirmed} color="teal" /><StatusCount label="Completed" count={totals.completed} color="blue" /><StatusCount label="Cancelled" count={totals.cancelled} color="gray" /><StatusCount label="Declined" count={totals.declined} color="rose" /><Link to="/admin/appointments" className="text-link">View appointments <ArrowUpRight size={15} /></Link></section></div>
      <section className="panel speciality-summary"><div className="panel-heading"><div><span className="eyebrow">CARE NETWORK</span><h2>Doctors by speciality</h2></div><Link to="/admin/specialisations" className="text-link">Manage specialities</Link></div><div className="specialty-count-list">{data.doctorsBySpecialisation.map((item) => <div key={item.specialisation}><span>{item.specialisation}</span><strong>{item.doctors}</strong><div className="tiny-track"><span style={{ width: `${Math.min(100, item.doctors * 16)}%` }} /></div></div>)}</div></section>
    </>;
  }

  const appointments = data.appointments || data;
  if (user.role === 'doctor') {
    const records = data.records || [];
    const recordedIds = new Set(records.map((record) => Number(record.appointment_id)));
    const eligibleAppointments = appointments.filter((appointment) => appointment.status === 'completed' && !recordedIds.has(Number(appointment.id)));
    const today = clinicTodayKey();
    const todays = appointments.filter((item) => clinicDateKey(item.starts_at) === today && ['booked', 'confirmed'].includes(item.status));
    const upcoming = appointments.filter((item) => new Date(item.starts_at) > new Date() && ['booked', 'confirmed'].includes(item.status))
      .sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
    const pending = appointments.filter((item) => item.status === 'booked');
    const completed = appointments.filter((item) => item.status === 'completed');
    return <>
      {notice && <div className="notice success" role="status"><Check size={16} />{notice}</div>}
      <Title eyebrow="YOUR PRACTICE" title="Your care, at a glance" description="Stay on top of requests and upcoming consultations." action={<Link className="button" to="/doctor/availability"><Plus size={17} /> Add availability</Link>} />
      {error && <><ErrorMessage>{error}</ErrorMessage><button className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button></>}
      <div className="metric-grid"><Metric icon={CalendarDays} label="Today’s visits" value={todays.length} tone="blue" /><Metric icon={Clock3} label="Requests to review" value={pending.length} tone="peach" /><Metric icon={Check} label="Completed visits" value={completed.length} tone="mint" /><Metric icon={Activity} label="Upcoming visits" value={upcoming.length} tone="lavender" /></div>
      <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>Next appointments</h2></div><Link to="/doctor/appointments" className="text-link">View all <ArrowUpRight size={15} /></Link></div><AppointmentTable rows={upcoming.slice(0, 5)} role="doctor" /></section>
      <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">COMPLETED CARE</span><h2>Recent completed appointments</h2></div><Link to="/doctor/appointments" className="text-link">Appointment history <ArrowUpRight size={15} /></Link></div><AppointmentTable rows={completed.slice(0, 5)} role="doctor" /></section>
      <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">CLINICAL DOCUMENTATION</span><h2>Recent medical records</h2></div><div className="action-buttons"><Link to="/doctor/records" className="text-link">View history <ArrowUpRight size={15} /></Link><button className="button button-small" type="button" aria-label="Create a record for a completed appointment" disabled={!eligibleAppointments.length} onClick={() => setRecordOpen(true)}><Plus size={16} /> Add record</button></div></div>{records.length ? records.slice(0, 3).map((record) => <div className="recent-record-row" key={record.id}><span className="metric-icon metric-mint"><ShieldCheck size={17} /></span><div><strong>{record.diagnosis}</strong><small>{record.patient_name} · {prettyDate(record.starts_at)}</small></div></div>) : <EmptyState title="No medical records yet">Records you create for your completed appointments will appear here.</EmptyState>}{!eligibleAppointments.length && !loading && <p className="form-hint">A record can be created only for an appointment you completed and have not documented yet.</p>}</section>
      {recordOpen && <MedicalRecordDialog appointments={eligibleAppointments} onClose={() => setRecordOpen(false)} onSaved={() => { setRecordOpen(false); setNotice('Medical record saved securely.'); setRetry((value) => value + 1); }} />}
    </>;
  }
  const active = appointments.filter((item) => ['booked', 'confirmed'].includes(item.status));
  const upcoming = active.filter((item) => new Date(item.starts_at) > new Date())
    .sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
  const completed = appointments.filter((item) => item.status === 'completed');
  const nextAppointment = upcoming[0];
  return <>
    <section className="welcome-banner patient-welcome"><div className="welcome-copy"><span className="eyebrow">YOUR HEALTH JOURNEY</span><h1>Welcome, {user.name?.split(' ')[0]}.</h1><p>Your care, appointments, and health history — thoughtfully organized in one place.</p><div className="welcome-actions"><Link className="button button-light" to="/doctors"><Search size={17} /> Find a doctor</Link><button className="button welcome-secondary" type="button" onClick={() => setBookingOpen(true)}><Plus size={16} /> Book an appointment</button></div></div><div className="welcome-profile"><div className="welcome-avatar">{user.name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><span>Patient account</span><strong>{user.name}</strong><small>{user.email}</small></div><div className="welcome-art" aria-hidden="true"><HeartPulse size={74} strokeWidth={1.1} /></div></section>
    {notice && <div className="notice success" role="status"><Check size={16} />{notice}</div>}
    {error && <><ErrorMessage>{error}</ErrorMessage><button className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button></>}
    <div className="metric-grid patient-metric-grid"><Metric icon={CalendarDays} label="Total appointments" value={appointments.length} tone="blue" /><Metric icon={Clock3} label="Upcoming visits" value={upcoming.length} tone="peach" /><Metric icon={Check} label="Completed visits" value={completed.length} tone="mint" /><Metric icon={ShieldCheck} label="Medical records" value={data.records.length} tone="lavender" /></div>
    <section className="patient-spotlight panel"><div className="patient-spotlight-heading"><span className="metric-icon metric-blue"><CalendarDays size={19} /></span><div><span className="eyebrow">UP NEXT</span><h2>Upcoming appointment</h2></div></div>{nextAppointment ? <div className="spotlight-appointment"><div className="spotlight-date"><strong>{clinicDateTime(nextAppointment.starts_at, { day: '2-digit' })}</strong><span>{clinicDateTime(nextAppointment.starts_at, { month: 'short' })}</span></div><div className="spotlight-details"><strong>{nextAppointment.doctor_name}</strong><span>{nextAppointment.specialisation}</span><small>{prettyDate(nextAppointment.starts_at)}</small></div><StatusBadge status={nextAppointment.status} /><Link className="text-link" to={`/patient/appointments/${nextAppointment.id}`}>View details <ArrowRight size={15} /></Link></div> : <EmptyState title="Nothing scheduled yet">Your next confirmed or requested visit will appear here.<Link className="text-link" to="/doctors">Find a doctor <ArrowRight size={15} /></Link></EmptyState>}</section>
    <section className="quick-actions" aria-label="Patient quick actions"><Link to="/doctors" className="quick-action"><span className="quick-action-icon quick-action-teal"><Search size={19} /></span><span><strong>Find a doctor</strong><small>Explore care by speciality</small></span><ArrowRight size={16} /></Link><button type="button" className="quick-action" onClick={() => setBookingOpen(true)}><span className="quick-action-icon quick-action-blue"><Plus size={19} /></span><span><strong>Book appointment</strong><small>Choose a doctor and time</small></span><ArrowRight size={16} /></button><Link to="/patient/appointments" className="quick-action"><span className="quick-action-icon quick-action-violet"><CalendarDays size={19} /></span><span><strong>My appointments</strong><small>Review or manage visits</small></span><ArrowRight size={16} /></Link><Link to="/patient/records" className="quick-action"><span className="quick-action-icon quick-action-amber"><FileText size={19} /></span><span><strong>Medical records</strong><small>View your private history</small></span><ArrowRight size={16} /></Link></section>
    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR CARE PLAN</span><h2>Recent appointments</h2></div><Link to="/patient/appointments" className="text-link">See all <ArrowUpRight size={15} /></Link></div><AppointmentTable rows={appointments.slice(0, 5)} role="patient" /></section>
    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">HEALTH HISTORY</span><h2>Recent medical records</h2></div><Link to="/patient/records" className="text-link">View history <ArrowUpRight size={15} /></Link></div>{data.records.length ? data.records.slice(0, 3).map((record) => <div className="recent-record-row" key={record.id}><span className="metric-icon metric-mint"><ShieldCheck size={17} /></span><div><strong>Consultation record</strong><small>{record.doctor_name} · {prettyDate(record.starts_at)}</small></div><Link className="text-link" to="/patient/records">View <ArrowRight size={14} /></Link></div>) : <EmptyState title="No medical records yet">Your completed consultation records will appear here.</EmptyState>}</section>
    {bookingOpen && <AppointmentBookingDialog onClose={() => setBookingOpen(false)} onBooked={() => { setBookingOpen(false); setNotice('Appointment request submitted.'); setRetry((value) => value + 1); }} />}
  </>;
}

function AppointmentBookingDialog({ onClose, onBooked }) {
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [doctorRetry, setDoctorRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const slotRequest = useRef(0);
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef);
  useEffect(() => {
    let current = true;
    setDoctorsLoading(true);
    setError('');
    api.get('/doctors', { params: { limit: 50, sort: 'name' } })
      .then(({ data }) => { if (current) setDoctors(data); })
      .catch((failure) => { if (current) setError(failure.message || 'Unable to load doctors.'); })
      .finally(() => { if (current) setDoctorsLoading(false); });
    return () => { current = false; };
  }, [doctorRetry]);
  async function selectDoctor(value) {
    const requestId = ++slotRequest.current;
    setDoctorId(value);
    setSlotId('');
    setSlots([]);
    setReview(false);
    setError('');
    if (!value) { setSlotsLoading(false); return; }
    setSlotsLoading(true);
    try {
      const { data } = await api.get(`/doctors/${value}/slots`);
      if (requestId === slotRequest.current) {
        setSlots(data);
        if (!data.length) setError('This doctor has no available future appointment times.');
      }
    } catch (failure) { if (requestId === slotRequest.current) setError(failure.message || 'Unable to load appointment times.'); }
    finally { if (requestId === slotRequest.current) setSlotsLoading(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!doctorId || !slotId || reason.trim().length < 3) {
      setError('Choose a doctor, an available time, and enter a reason of at least 3 characters.');
      setReview(false);
      return;
    }
    if (!review) {
      setError('');
      setReview(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/appointments', { doctorId: Number(doctorId), slotId: Number(slotId), reason: reason.trim() });
      onBooked();
    } catch (failure) { setError(failure.message || 'Appointment booking failed.'); setReview(false); }
    finally { setBusy(false); }
  }
  const doctor = doctors.find((entry) => Number(entry.id) === Number(doctorId));
  const slot = slots.find((entry) => Number(entry.id) === Number(slotId));
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex="-1" onKeyDown={(event) => trapDialogKeyboard(event, onClose, busy)} className="panel workflow-modal" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title">
      <div className="panel-heading"><div><span className="eyebrow">APPOINTMENT REQUEST</span><h2 id="booking-dialog-title">{review ? 'Confirm your request' : 'Book an appointment'}</h2></div><button type="button" className="button-link" aria-label="Close appointment booking" disabled={busy} onClick={onClose}>Close</button></div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {error && doctorId && !slotsLoading && <button type="button" className="button button-outline" onClick={() => selectDoctor(doctorId)}><RotateCw size={16} /> Retry loading appointment times</button>}
      {doctorsLoading && !doctors.length ? <Loading label="Loading doctors…" /> : <form className="stack-form" onSubmit={submit}>
        {!doctors.length && <button type="button" className="button button-outline" disabled={doctorsLoading} onClick={() => setDoctorRetry((value) => value + 1)}><RotateCw size={16} /> Retry loading doctors</button>}
        {!review ? <>
          <label>Doctor<select required value={doctorId} onChange={(event) => selectDoctor(event.target.value)}><option value="">Select a doctor</option>{doctors.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.specialisation}</option>)}</select></label>
          <label>Available date and time<select required disabled={!doctorId || slotsLoading || !slots.length} value={slotId} onChange={(event) => setSlotId(event.target.value)}><option value="">{slotsLoading ? 'Loading times…' : 'Select an available time'}</option>{slots.map((item) => <option key={item.id} value={item.id}>{prettyDate(item.starts_at)}</option>)}</select></label>
          <label>Reason for visit<textarea required minLength="3" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="button" disabled={!doctorId || !slotId || reason.trim().length < 3 || slotsLoading}>Review request <ArrowUpRight size={16} /></button>
        </> : <>
          <p><strong>{doctor?.name}</strong> · {doctor?.specialisation}</p><p>{slot && prettyDate(slot.starts_at)}</p><p>Reason: {reason.trim()}</p>
          <div className="action-buttons"><button className="button" disabled={busy}>{busy ? 'Submitting…' : 'Confirm booking'}</button><button type="button" className="button button-outline" disabled={busy} onClick={() => setReview(false)}>Edit request</button></div>
        </>}
      </form>}
    </section>
  </div>;
}

function MedicalRecordDialog({ appointments, onClose, onSaved }) {
  const [appointmentId, setAppointmentId] = useState('');
  const [record, setRecord] = useState({ diagnosis: '', prescription: '', notes: '', followUp: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef);
  async function submit(event) {
    event.preventDefault();
    if (!appointmentId || record.diagnosis.trim().length < 2) {
      setError('Choose a completed appointment and enter a diagnosis.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/records', { ...record, appointmentId: Number(appointmentId) });
      onSaved();
    } catch (failure) { setError(failure.message || 'Could not save medical record.'); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex="-1" onKeyDown={(event) => trapDialogKeyboard(event, onClose, busy)} className="panel workflow-modal" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
      <div className="panel-heading"><div><span className="eyebrow">PRIVATE CLINICAL RECORD</span><h2 id="record-dialog-title">Create medical record</h2></div><button type="button" className="button-link" aria-label="Close medical record form" disabled={busy} onClick={onClose}>Close</button></div>
      <p className="form-hint">Only completed appointments assigned to you can be selected. Administrators cannot view clinical record contents.</p>
      <ErrorMessage>{error}</ErrorMessage>
      <form className="stack-form" onSubmit={submit}>
        <label>Completed appointment<select required value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}><option value="">Select a completed appointment</option>{appointments.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.patient_name} · {prettyDate(item.starts_at)}</option>)}</select></label>
        <label>Diagnosis<input required minLength="2" maxLength="2000" value={record.diagnosis} onChange={(event) => setRecord({ ...record, diagnosis: event.target.value })} /></label>
        <label>Prescription<textarea maxLength="5000" value={record.prescription} onChange={(event) => setRecord({ ...record, prescription: event.target.value })} /></label>
        <label>Consultation notes<textarea maxLength="5000" value={record.notes} onChange={(event) => setRecord({ ...record, notes: event.target.value })} /></label>
        <label>Follow-up instructions<textarea maxLength="5000" value={record.followUp} onChange={(event) => setRecord({ ...record, followUp: event.target.value })} /></label>
        <div className="action-buttons"><button className="button" disabled={busy || !appointments.length}>{busy ? 'Saving record…' : 'Save medical record'}</button><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Cancel</button></div>
      </form>
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value, tone }) {
  return <article className="metric-card"><span className={`metric-icon metric-${tone}`}><Icon size={19} /></span><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-caption"><ArrowUpRight size={13} /> Updated just now</span></article>;
}

function StatusCount({ label, count, color }) {
  return <div className="status-count"><span className={`status-dot status-${color}`} />{label}<strong>{count || 0}</strong></div>;
}

function AppointmentTable({ rows, role }) {
  if (!rows.length) return <EmptyState title="No appointments just yet">Your appointments will show here when you book or receive a request.</EmptyState>;
  return <div className="table-scroll" role="region" aria-label="Appointment list" tabIndex="0"><table><thead><tr><th>{role === 'doctor' ? 'Patient' : 'Doctor'}</th><th>Date & time</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><strong>{role === 'doctor' ? item.patient_name : item.doctor_name}</strong><small>{item.specialisation}</small></td><td>{prettyDate(item.starts_at)}</td><td className="reason-cell">{item.reason}</td><td><StatusBadge status={item.status} /></td><td><Link className="table-link" to={`/${role}/appointments/${item.id}`}>Details</Link></td></tr>)}</tbody></table></div>;
}

export function AppointmentDetailsPage() {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get(`/appointments/${id}`)
      .then(({ data }) => { if (current) setAppointment(data); })
      .catch((reason) => { if (current) setError(reason.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, retry]);
  if (loading) return <Loading />;
  return <><Title eyebrow={`APPOINTMENT #${id}`} title="Appointment details" description="Review the information for this visit." action={<Link className="button button-outline" to="../appointments">Back to appointments</Link>} /><ErrorMessage>{error}</ErrorMessage>{error && !appointment && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry</button>}{appointment && <section className="panel appointment-detail-card"><div className="panel-heading"><div><span className="eyebrow">VISIT STATUS</span><h2><StatusBadge status={appointment.status} /></h2></div><CalendarDays size={20} /></div><div className="appointment-detail-grid"><div><span>Doctor</span><strong>{appointment.doctor_name}</strong><small>{appointment.specialisation}</small></div><div><span>Patient</span><strong>{appointment.patient_name}</strong></div><div><span>Date & time</span><strong>{prettyDate(appointment.starts_at)}</strong></div><div><span>Reason for visit</span><strong>{appointment.reason || 'Not shared with administrators.'}</strong></div></div></section>}</>;
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const isDoctor = user.role === 'doctor';
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [slotsFor, setSlotsFor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [recordFor, setRecordFor] = useState(null);
  const [recordedAppointmentIds, setRecordedAppointmentIds] = useState(new Set());
  const [record, setRecord] = useState({ diagnosis: '', prescription: '', notes: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  async function load() {
    setLoading(true);
    setError('');
    try {
      if (isDoctor) {
        const [appointments, records] = await Promise.all([api.get('/appointments/my'), api.get('/records/my')]);
        setRows(appointments.data);
        setRecordedAppointmentIds(new Set(records.data.map((record) => Number(record.appointment_id))));
      } else {
        const response = await api.get(isAdmin ? '/admin/appointments' : '/appointments/my');
        setRows(response.data);
      }
      setError('');
    } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [user.role, retry]);
  async function update(id, status) {
    setBusy(true); setError(''); setNotice('');
    try { await api.patch(`/appointments/${id}/status`, { status }); setNotice(`Appointment ${status}.`); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function openReschedule(appointment) {
    setSlotsFor(appointment);
    try { const response = await api.get(`/doctors/${appointment.doctor_id}/slots`); setSlots(response.data); }
    catch (reason) { setError(reason.message); }
  }
  async function reschedule(slotId) {
    try { await api.put(`/appointments/${slotsFor.id}/reschedule`, { slotId: Number(slotId) }); setSlotsFor(null); setNotice('Appointment time updated.'); await load(); }
    catch (reason) { setError(reason.message); }
  }
  async function createRecord(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/records', { ...record, appointmentId: recordFor.id });
      setRecordedAppointmentIds((current) => new Set(current).add(Number(recordFor.id)));
      setRecordFor(null); setRecord({ diagnosis: '', prescription: '', notes: '' }); setNotice('Medical record saved securely.');
    }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const title = isAdmin ? 'All appointments' : isDoctor ? 'Your appointments' : 'My appointments';
  if (loading) return <Loading />;
  return <>
    <Title eyebrow="APPOINTMENTS" title={title} description={isAdmin ? 'Review appointment activity across your care network.' : 'Manage upcoming visits and review your care history.'} />
    <ErrorMessage>{error}</ErrorMessage>{error && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry appointments</button>}{notice && <div className="notice success"><Check size={16} />{notice}</div>}
    {!(error && !rows.length) && <section className="panel table-panel"><AppointmentTable rows={rows} role={isDoctor ? 'doctor' : 'patient'} />
      {(isDoctor || !isAdmin) && rows.map((item) => <div className="appointment-actions" key={item.id}>
        <span><strong>#{item.id}</strong> · {isDoctor ? item.patient_name : item.doctor_name} · {prettyDate(item.starts_at)}</span>
        <div className="action-buttons">
          {isDoctor && item.status === 'booked' && <><button className="button button-success button-small" disabled={busy} onClick={() => update(item.id, 'confirmed')}>Confirm</button><button className="button button-danger button-small" disabled={busy} onClick={() => update(item.id, 'declined')}>Decline</button></>}
          {isDoctor && item.status === 'confirmed' && <button className="button button-small" disabled={busy} onClick={() => update(item.id, 'completed')}>Mark completed</button>}
          {isDoctor && item.status === 'completed' && !recordedAppointmentIds.has(Number(item.id)) && <button className="button button-outline button-small" disabled={busy} onClick={() => setRecordFor(item)}>Add medical record</button>}
          {isDoctor && item.status === 'completed' && recordedAppointmentIds.has(Number(item.id)) && <span className="record-saved-label">Medical record saved</span>}
          {!isDoctor && ['booked', 'confirmed'].includes(item.status) && <><button className="button button-outline button-small" onClick={() => openReschedule(item)}>Reschedule</button><button className="button button-danger button-small" disabled={busy} onClick={() => window.confirm('Cancel this appointment?') && update(item.id, 'cancelled')}>Cancel</button></>}
        </div>
        {slotsFor?.id === item.id && <div className="reschedule-row"><label>Choose another time<select defaultValue="" onChange={(event) => event.target.value && reschedule(event.target.value)}><option value="">Select a time</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{prettyDate(slot.starts_at)}</option>)}</select></label><button className="button-link" onClick={() => setSlotsFor(null)}>Close</button></div>}
        {recordFor?.id === item.id && <form className="record-form-inline" onSubmit={createRecord}><label>Diagnosis<input required minLength="2" maxLength="2000" value={record.diagnosis} onChange={(event) => setRecord({ ...record, diagnosis: event.target.value })} /></label><label>Prescription<textarea maxLength="5000" value={record.prescription} onChange={(event) => setRecord({ ...record, prescription: event.target.value })} /></label><label>Consultation notes<textarea maxLength="5000" value={record.notes} onChange={(event) => setRecord({ ...record, notes: event.target.value })} /></label><div className="action-buttons"><button className="button button-small" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button><button type="button" className="button-link" disabled={busy} onClick={() => setRecordFor(null)}>Cancel</button></div></form>}
      </div>)}
    </section>}
  </>;
}

export function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/records/my')
      .then(({ data }) => { if (current) setRecords(data); })
      .catch((reason) => { if (current) setError(reason.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  if (loading) return <Loading />;
  return <><Title eyebrow="PRIVATE HEALTH INFORMATION" title="Medical history" description="Your consultation records, available only to you and your treating doctors." /><ErrorMessage>{error}</ErrorMessage>{error && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry records</button>}{!error && (records.length ? <div className="record-grid">{records.map((item) => <article className="panel medical-record-card" key={item.id}><div className="record-date"><span className="eyebrow">CONSULTATION</span><strong>{prettyDate(item.starts_at)}</strong></div><h2>{item.diagnosis}</h2><p className="record-doctor">Dr. {item.doctor_name}</p><div className="record-section"><strong>Prescription</strong><p>{item.prescription || 'No prescription recorded.'}</p></div><div className="record-section"><strong>Consultation notes</strong><p>{item.notes || 'No additional notes.'}</p></div>{item.follow_up && <div className="record-section"><strong>Follow-up</strong><p>{item.follow_up}</p></div>}</article>)}</div> : <EmptyState title="No medical records yet">Completed consultation records will appear here.</EmptyState>)}</>;
}

export function AvailabilityPage() {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ startsAt: '', endsAt: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  async function load() {
    setLoading(true);
    setError('');
    try { const response = await api.get('/doctors/self/availability'); setSlots(response.data); }
    catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [retry]);
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      await api.post('/doctors/availability', { startsAt: clinicLocalInputToIso(form.startsAt), endsAt: clinicLocalInputToIso(form.endsAt) });
      setForm({ startsAt: '', endsAt: '' }); setNotice('Availability added.'); await load();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function removeSlot(id) {
    if (!window.confirm('Remove this available appointment time?')) return;
    setBusy(true);
    setError('');
    try { await api.delete(`/doctors/availability/${id}`); setNotice('Availability removed.'); await load(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  return <><Title eyebrow="SCHEDULING" title="Manage availability" description="Add future appointment slots that patients can book." /><ErrorMessage>{error}</ErrorMessage>{error && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry availability</button>}{notice && <div className="notice success" role="status"><Check size={16} />{notice}</div>}<div className="dashboard-grid availability-layout"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">NEW TIME</span><h2>Add a slot</h2></div><Plus size={18} aria-hidden="true" /></div><form className="stack-form" onSubmit={submit}><label>Starts at (clinic time)<input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Ends at (clinic time)<input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><p className="form-hint">Slots must match your consultation duration and be in the future.</p><button className="button full-button" disabled={busy}>{busy ? 'Adding availability…' : 'Add availability'} <Plus size={16} /></button></form></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">UPCOMING</span><h2>Your time slots</h2></div></div>{loading ? <Loading /> : error ? null : slots.length ? <div className="slot-list">{slots.map((slot) => <div key={slot.id} className="slot-item"><span className="slot-calendar"><CalendarDays size={18} /></span><div><strong>{prettyDate(slot.starts_at)}</strong><small>{clinicDateTime(slot.starts_at, { timeStyle: 'short' })} – {clinicDateTime(slot.ends_at, { timeStyle: 'short' })}</small></div><StatusBadge status={slot.is_booked ? 'booked' : 'available'} />{!slot.is_booked && !slot.has_history && <button type="button" className="button-link danger-link" disabled={busy} aria-label={`Remove availability at ${prettyDate(slot.starts_at)}`} onClick={() => removeSlot(slot.id)}>Remove</button>}</div>)}</div> : <EmptyState title="No upcoming slots">Add your availability to open appointment times.</EmptyState>}</section></div></>;
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get('/auth/me')
      .then(({ data }) => {
        if (current) {
          setProfile(data);
          setForm({ name: data.name, email: data.email, qualification: data.doctor?.qualification || '', experienceYears: data.doctor?.experience_years ?? '', fee: data.doctor?.fee ?? '', bio: data.doctor?.bio || '' });
        }
      })
      .catch((reason) => { if (current) setError(reason.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(true);
    try { await api.patch('/profile/me', form); await refresh(); setNotice('Profile updated.'); }
    catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }
  return <><Title eyebrow="ACCOUNT SETTINGS" title="Your profile" description="Keep your contact details and account information up to date." /><ErrorMessage>{error}</ErrorMessage>{error && !profile && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry profile</button>}{notice && <div className="notice success"><Check size={16} />{notice}</div>}{loading ? <Loading /> : profile ? <section className="panel profile-edit-panel"><form className="stack-form" onSubmit={submit}><label>Full name<input required minLength="2" value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input type="email" required value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>{user.role === 'doctor' && <><label>Qualification<input required value={form.qualification || ''} onChange={(event) => setForm({ ...form, qualification: event.target.value })} /></label><label>Years of experience<input type="number" min="0" max="80" value={form.experienceYears} onChange={(event) => setForm({ ...form, experienceYears: event.target.value })} /></label><label>Consultation fee<input type="number" min="0" step="0.01" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} /></label><label>Professional bio<textarea minLength="10" value={form.bio || ''} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label></>}<div className="account-role"><span>Account role</span><strong>{user.role}</strong></div><button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={16} /></button></form></section> : null}</>;
}

export function AdminPage() {
  const location = useLocation();
  const pathname = location.pathname;
  const [items, setItems] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [doctorForm, setDoctorForm] = useState({ name: '', email: '', password: '', specialisationId: '', qualification: '', experienceYears: 0, fee: 0, consultationMinutes: 30, consultationMode: 'In-person', bio: '' });
  const [specForm, setSpecForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specSaving, setSpecSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const pageType = pathname.endsWith('/users') ? 'users' : pathname.endsWith('/doctors') ? 'doctors' : pathname.endsWith('/specialisations') ? 'specialisations' : pathname.endsWith('/reports') ? 'reports' : 'appointments';
  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      if (pageType === 'users') { const response = await api.get('/admin/users', { params: { search: filter || undefined, page } }); setItems(response.data); setHasMore(response.pagination.hasMore); }
      else if (pageType === 'appointments') { const response = await api.get('/admin/appointments', { params: { status: filter || undefined, page } }); setItems(response.data); setHasMore(response.pagination.hasMore); }
      else if (pageType === 'specialisations') { const response = await api.get('/admin/specialisations'); setItems(response.data); }
      else if (pageType === 'reports') { const response = await api.get('/admin/reports'); setItems(response.data); }
      else if (pageType === 'doctors') { const response = await api.get('/admin/doctors', { params: { page } }); setItems(response.data); setHasMore(response.pagination.hasMore); }
      if (pageType === 'doctors') { const response = await api.get('/doctors/specialisations'); setSpecs(response.data); }
      setError('');
    } catch (reason) { setError(reason.message); setLoadError(reason.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [pageType, filter, page, retry]);
  async function changeStatus(id, isActive) {
    try { await api.patch(`/admin/users/${id}/status`, { isActive: !isActive }); setNotice('Account status updated.'); await load(); }
    catch (reason) { setError(reason.message); }
  }
  async function createDoctor(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try { await api.post('/admin/doctors', { ...doctorForm, specialisationId: Number(doctorForm.specialisationId), experienceYears: Number(doctorForm.experienceYears), fee: Number(doctorForm.fee), consultationMinutes: Number(doctorForm.consultationMinutes) }); setNotice('Doctor account provisioned. Share credentials securely.'); setDoctorForm({ ...doctorForm, name: '', email: '', password: '', bio: '' }); await load(); }
    catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }
  async function addSpecialisation(event) {
    event.preventDefault();
    setSpecSaving(true);
    try { await api.post('/admin/specialisations', specForm); setSpecForm({ name: '', description: '' }); setNotice('Specialisation added.'); await load(); }
    catch (reason) { setError(reason.message); } finally { setSpecSaving(false); }
  }
  const titles = { users: 'User management', doctors: 'Doctor management', specialisations: 'Specialisations', appointments: 'Appointment management', reports: 'Operational reports' };
  return <><Title eyebrow="ADMINISTRATION" title={titles[pageType]} description={{ users: 'Manage account access and status.', doctors: 'Provision verified doctor accounts and profiles.', specialisations: 'Maintain the care categories offered.', appointments: 'Review and filter appointments across the platform.', reports: 'Review live appointment activity and trends.' }[pageType]} />
    <ErrorMessage>{error}</ErrorMessage>{loadError && <button type="button" className="button button-outline" onClick={() => setRetry((value) => value + 1)}><RotateCw size={16} /> Retry loading data</button>}{notice && <div className="notice success"><Check size={16} />{notice}</div>}
    {(pageType === 'users' || pageType === 'appointments') && <div className="filter-bar admin-filter">{pageType === 'users' && <label className="search-field"><Search size={18} /><input aria-label="Search users by name or email" value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value); }} placeholder="Search name or email" /></label>}{pageType === 'appointments' && <select aria-label="Filter by status" value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value); }}><option value="">All statuses</option>{['booked', 'confirmed', 'completed', 'cancelled', 'declined'].map((status) => <option key={status}>{status}</option>)}</select>}</div>}
    {loading ? <Loading /> : loadError && !items.length ? null : <>
      {pageType === 'users' && <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td><span className="role-chip">{item.role}</span></td><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{item.is_active ? 'Active' : 'Disabled'}</td><td>{item.role === 'admin' ? <span className="table-link">Protected</span> : <button type="button" className="button-link" onClick={() => changeStatus(item.id, Boolean(item.is_active))}>{item.is_active ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody></table></div><AdminPageControls page={page} hasMore={hasMore} onPage={setPage} /></section>}
      {pageType === 'doctors' && <div className="dashboard-grid admin-doctor-layout"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">PROVISION ACCESS</span><h2>Create doctor account</h2></div><Stethoscope size={19} /></div><form className="stack-form" onSubmit={createDoctor}><label>Doctor name<input required minLength="2" value={doctorForm.name} onChange={(event) => setDoctorForm({ ...doctorForm, name: event.target.value })} /></label><label>Email<input type="email" required value={doctorForm.email} onChange={(event) => setDoctorForm({ ...doctorForm, email: event.target.value })} /></label><label>Temporary password<input type="password" required minLength="12" value={doctorForm.password} onChange={(event) => setDoctorForm({ ...doctorForm, password: event.target.value })} /></label><label>Specialisation<select required value={doctorForm.specialisationId} onChange={(event) => setDoctorForm({ ...doctorForm, specialisationId: event.target.value })}><option value="">Select a speciality</option>{specs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Qualification<input required value={doctorForm.qualification} onChange={(event) => setDoctorForm({ ...doctorForm, qualification: event.target.value })} /></label><label>Consultation mode<select value={doctorForm.consultationMode} onChange={(event) => setDoctorForm({ ...doctorForm, consultationMode: event.target.value })}><option>In-person</option><option>Online</option><option>Both</option></select></label><div className="field-row"><label>Years’ experience<input type="number" min="0" max="80" value={doctorForm.experienceYears} onChange={(event) => setDoctorForm({ ...doctorForm, experienceYears: event.target.value })} /></label><label>Fee<input type="number" min="0" step=".01" value={doctorForm.fee} onChange={(event) => setDoctorForm({ ...doctorForm, fee: event.target.value })} /></label></div><label>Consultation minutes<input type="number" min="10" max="240" value={doctorForm.consultationMinutes} onChange={(event) => setDoctorForm({ ...doctorForm, consultationMinutes: event.target.value })} /></label><label>Professional bio<textarea required minLength="10" value={doctorForm.bio} onChange={(event) => setDoctorForm({ ...doctorForm, bio: event.target.value })} /></label><button className="button" disabled={saving}>{saving ? 'Creating doctor…' : 'Create doctor'} <Plus size={16} /></button></form></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">PROVISIONING NOTE</span><h2>Secure account setup</h2></div><ShieldCheck size={19} /></div><p className="supporting-copy">Doctor access is provisioned by an administrator. Share the initial password through a trusted private channel and ask the doctor to change it after signing in.</p><Link to="/admin/users" className="text-link">Review all users <ArrowUpRight size={15} /></Link></section></div>}
      {pageType === 'doctors' && <section className="panel doctor-admin-list"><div className="panel-heading"><div><span className="eyebrow">DOCTOR DIRECTORY</span><h2>Manage doctor profiles</h2></div></div>{items.length ? items.map((doctor) => <DoctorProfileEditor key={doctor.id} doctor={doctor} specialisations={specs} onSave={load} />) : <EmptyState title="No doctors yet">Provision a doctor account to get started.</EmptyState>}<AdminPageControls page={page} hasMore={hasMore} onPage={setPage} /></section>}
      {pageType === 'specialisations' && <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CARE CATEGORIES</span><h2>Available specialisations</h2></div></div>{items.length ? items.map((item) => <SpecialisationEditor key={item.id} item={item} onSave={load} onError={setError} />) : <EmptyState title="No specialisations yet">Add the first category to configure doctor profiles.</EmptyState>}</section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">ADD CATEGORY</span><h2>New specialisation</h2></div><Plus size={18} aria-hidden="true" /></div><form className="stack-form" onSubmit={addSpecialisation}><label>Name<input required minLength="2" maxLength="100" value={specForm.name} onChange={(event) => setSpecForm({ ...specForm, name: event.target.value })} /></label><label>Description<textarea maxLength="500" value={specForm.description} onChange={(event) => setSpecForm({ ...specForm, description: event.target.value })} /></label><button className="button" disabled={specSaving}>{specSaving ? 'Adding…' : 'Add specialisation'} <Plus size={16} /></button></form></section></div>}
      {pageType === 'appointments' && <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Patient</th><th>Doctor</th><th>Date & time</th><th>Speciality</th><th>Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.patient_name}</td><td>{item.doctor_name}</td><td>{prettyDate(item.starts_at)}</td><td>{item.specialisation}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>{!items.length && <EmptyState title="No appointments found">Appointments will appear here when patients book.</EmptyState>}<AdminPageControls page={page} hasMore={hasMore} onPage={setPage} /></section>}
      {pageType === 'reports' && <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">ALL APPOINTMENT DATES</span><h2>Daily appointments</h2></div></div><Suspense fallback={<Loading label="Loading chart…" />}><ActivityChart data={items.dailyAppointments} /></Suspense></section><section className="panel summary-panel"><div className="panel-heading"><div><span className="eyebrow">BY STATUS</span><h2>Appointments</h2></div></div>{items.appointmentsByStatus.map((item) => <StatusCount key={item.status} label={item.status} count={item.total} color="teal" />)}</section></div>}
    </>}</>;
}

function AdminPageControls({ page, hasMore, onPage }) {
  if (page <= 1 && !hasMore) return null;
  return <div className="pagination-controls"><button className="button button-outline button-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page}</span><button className="button button-outline button-small" disabled={!hasMore} onClick={() => onPage(page + 1)}>Next</button></div>;
}

function DoctorProfileEditor({ doctor, specialisations, onSave }) {
  const [form, setForm] = useState({ specialisationId: String(doctor.specialisation_id), qualification: doctor.qualification, experienceYears: doctor.experience_years, fee: doctor.fee, consultationMinutes: doctor.consultation_minutes, consultationMode: doctor.consultation_mode || 'In-person', bio: doctor.bio });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await api.patch(`/admin/doctors/${doctor.id}`, { ...form, specialisationId: Number(form.specialisationId), experienceYears: Number(form.experienceYears), fee: Number(form.fee), consultationMinutes: Number(form.consultationMinutes) });
      await onSave();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }
  return <form className="doctor-edit-row" onSubmit={submit}><div className="doctor-edit-heading"><div className="doctor-avatar">{doctor.name.split(' ').map((part) => part[0]).slice(-2).join('')}</div><div><strong>{doctor.name}</strong><small>{doctor.specialisation} · {doctor.is_active ? 'Active' : 'Disabled'}</small></div></div><div className="doctor-edit-fields"><label>Specialisation<select value={form.specialisationId} onChange={(event) => setForm({ ...form, specialisationId: event.target.value })}>{specialisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Qualification<input required value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} /></label><label>Experience<input type="number" min="0" max="80" value={form.experienceYears} onChange={(event) => setForm({ ...form, experienceYears: event.target.value })} /></label><label>Fee<input type="number" min="0" step=".01" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} /></label><label>Duration (min)<input type="number" min="10" max="240" value={form.consultationMinutes} onChange={(event) => setForm({ ...form, consultationMinutes: event.target.value })} /></label><label>Consultation mode<select value={form.consultationMode} onChange={(event) => setForm({ ...form, consultationMode: event.target.value })}><option>In-person</option><option>Online</option><option>Both</option></select></label><label className="doctor-bio-field">Bio<textarea minLength="10" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label></div><ErrorMessage>{error}</ErrorMessage><button className="button button-small" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></form>;
}

function SpecialisationEditor({ item, onSave, onError }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: item.name, description: item.description });
  async function save(event) {
    event.preventDefault();
    try { await api.put(`/admin/specialisations/${item.id}`, form); setEditing(false); await onSave(); }
    catch (reason) { onError(reason.message); }
  }
  async function remove() {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    try { await api.delete(`/admin/specialisations/${item.id}`); await onSave(); }
    catch (reason) { onError(reason.message); }
  }
  return <div className="specialisation-editor">{editing ? <form className="spec-edit-form" onSubmit={save}><input required minLength="2" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><textarea maxLength="500" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="action-buttons"><button className="button button-small">Save</button><button className="button-link" type="button" onClick={() => setEditing(false)}>Cancel</button></div></form> : <><div className="spec-row"><span className="specialty-icon"><Stethoscope size={18} /></span><div><strong>{item.name}</strong><small>{item.description || 'Healthcare speciality'}</small></div></div><div className="action-buttons"><button className="button-link" onClick={() => setEditing(true)}>Edit</button><button className="button-link danger-link" onClick={remove}>Remove</button></div></>}</div>;
}
