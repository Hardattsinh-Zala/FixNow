import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wrench, CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../api';
import './Auth.css';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/auth/verify-email/${token}`)
      .then((r) => { setMsg(r.data.msg); setStatus('success'); })
      .catch((e) => { setMsg(e.response?.data?.msg || 'Verification failed.'); setStatus('error'); });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="auth-logo" style={{ justifyContent: 'center' }}>
          <Wrench size={24} className="accent" />
          <span>Sahakar<span className="accent">Connect</span></span>
        </div>

        {status === 'loading' && (
          <>
            <Loader size={44} className="accent" style={{ margin: '0 auto 16px', display: 'block', animation: 'spin 1s linear infinite' }} />
            <h2 className="auth-title">Verifying your email…</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={52} color="#22a86e" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 className="auth-title">Email Verified!</h2>
            <p className="auth-sub" style={{ marginBottom: 28 }}>{msg}</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
              Sign In
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={52} color="#e53e3e" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 className="auth-title">Link Invalid</h2>
            <p className="auth-sub" style={{ marginBottom: 20 }}>{msg}</p>
            <ResendForm />
          </>
        )}

        <p className="auth-switch" style={{ marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setErr('');
    try { await api.post('/auth/resend-verification', { email }); setSent(true); }
    catch (ex) { setErr(ex.response?.data?.msg || 'Failed to resend.'); }
    finally { setLoading(false); }
  };

  if (sent) return <p style={{ color: '#22a86e', fontSize: '0.88rem' }}>✓ New link sent — check your inbox.</p>;

  return (
    <form onSubmit={submit}>
      <div className="form-group">
        <label className="form-label">Resend verification to</label>
        <input type="email" className="form-input" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {err && <p style={{ color: '#e53e3e', fontSize: '0.82rem', marginBottom: 8 }}>{err}</p>}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
        {loading ? <><span className="spinner" /> Sending…</> : 'Resend Verification Email'}
      </button>
    </form>
  );
}
