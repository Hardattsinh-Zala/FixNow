import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Wrench, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import './Auth.css';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const toast     = useToast();
  const [form, setForm]     = useState({ newPassword: '', confirm: '' });
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setErr('Passwords do not match.'); return; }
    if (form.newPassword.length < 6)       { setErr('Password must be at least 6 characters.'); return; }
    setLoading(true); setErr('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: form.newPassword });
      setDone(true);
      toast('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (ex) {
      setErr(ex.response?.data?.msg || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">
          <Wrench size={24} className="accent" />
          <span>Sahakar<span className="accent">Connect</span></span>
        </div>

        {!done ? (
          <>
            <h2 className="auth-title">Set new password</h2>
            <p className="auth-sub">Choose a strong password for your account.</p>
            <form onSubmit={submit} className="auth-form">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="input-wrap">
                  <input type={show ? 'text' : 'password'} className="form-input" placeholder="••••••••"
                    value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
                  <button type="button" className="input-eye" onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrap">
                  <input type={show ? 'text' : 'password'} className="form-input" placeholder="••••••••"
                    value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
                </div>
              </div>
              {err && <p style={{ color: '#e53e3e', fontSize: '0.82rem', marginBottom: 8 }}>{err}</p>}
              <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
                {loading ? <><span className="spinner" /> Resetting…</> : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <CheckCircle size={52} color="#22a86e" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 className="auth-title">Password Updated!</h2>
            <p className="auth-sub">Redirecting you to sign in…</p>
          </div>
        )}

        <p className="auth-switch" style={{ marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
