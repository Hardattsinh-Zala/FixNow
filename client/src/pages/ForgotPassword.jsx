import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Mail, ArrowLeft } from 'lucide-react';
import api from '../api';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setErr('');
    try { await api.post('/auth/forgot-password', { email }); setSent(true); }
    catch (ex) { setErr(ex.response?.data?.msg || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">
          <Wrench size={24} className="accent" />
          <span>Sahakar<span className="accent">Connect</span></span>
        </div>

        {!sent ? (
          <>
            <h2 className="auth-title">Forgot password?</h2>
            <p className="auth-sub">Enter your email and we'll send a reset link.</p>

            <form onSubmit={submit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email address</label>
                <div className="input-wrap">
                  <input type="email" className="form-input" placeholder="you@example.com"
                    style={{ paddingLeft: 38 }}
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                </div>
              </div>
              {err && <p style={{ color: '#e53e3e', fontSize: '0.82rem', marginBottom: 8 }}>{err}</p>}
              <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
                {loading ? <><span className="spinner" /> Sending…</> : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Mail size={26} className="accent" />
            </div>
            <h2 className="auth-title">Check your inbox</h2>
            <p className="auth-sub" style={{ marginBottom: 24 }}>
              If <strong>{email}</strong> is registered, a reset link is on its way. It expires in 1 hour.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Didn't get it? Check spam or{' '}
              <button className="link-btn" onClick={() => setSent(false)}>try again</button>.
            </p>
          </div>
        )}

        <p className="auth-switch" style={{ marginTop: 22 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 600 }}>
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
