import { CircleAlert, LoaderCircle } from 'lucide-react';

export function Loading({ label = 'Loading your information…' }) {
  return <div className="loading" role="status" aria-live="polite"><LoaderCircle className="spin" size={19} />{label}</div>;
}

export function ErrorMessage({ children }) {
  if (!children) return null;
  return <div className="notice error" role="alert"><CircleAlert size={17} />{children}</div>;
}

export function EmptyState({ title, children }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">•</span><strong>{title}</strong><div className="empty-copy">{children}</div></div>;
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
