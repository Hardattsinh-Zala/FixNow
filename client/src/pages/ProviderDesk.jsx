import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Radio, Users, Briefcase, Clock, Plus } from "lucide-react";
import api from "../api";
import "./ProviderDesk.css";

const categories = ["PLUMBING", "ELECTRICAL", "CARPENTRY", "PAINTING", "CLEANING", "GARDENING", "APPLIANCE_REPAIR", "DOMESTIC_HELP", "CAREGIVING", "DRIVING", "HOME_MAINTENANCE", "OTHER"];

export default function ProviderDesk() {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  const loadProfile = () =>
    api
      .get("/provider/profile")
      .then((r) => setProfile(r.data))
      .catch(() => setError("Could not load your profile. Check your connection and sign in again if this continues."));

  useEffect(() => {
    loadProfile();
    api
      .get("/provider/bookings")
      .then((r) => setBookings(r.data.bookings || []))
      .catch(() => {});
  }, []);

  if (error) return <main className="page"><div className="empty">{error}</div></main>;
  if (!profile) return <main className="page"><div className="empty"><span className="spinner" /></div></main>;

  const active = bookings.filter((b) => ["PENDING", "CONFIRMED", "ARRIVED", "AWAITING_PAYMENT"].includes(b.status));

  return (
    <main className="page">
      <div className="container">
        <div className="desk-head">
          <div>
            <p className="eyebrow">Provider desk</p>
            <h1 className="page-title">{profile.name}</h1>
            <p className="lead">{profile.city} · {profile.workers?.length || 0} workers · {profile.offerings?.length || 0} services</p>
          </div>
          <Link className="btn terracotta" to="/provider/requests"><Radio size={15} /> Open live requests</Link>
        </div>

        <div className="desk-grid">
          <div className="desk-panel card">
            <div className="panel-head">
              <span><Users size={15} /> Workers</span>
              <Link to="/provider/requests">Live requests <ArrowRight size={13} /></Link>
            </div>
            {profile.workers?.map((w) => <Worker key={w.id} worker={w} />)}
            <AddWorker onAdded={loadProfile} />
          </div>

          <div className="desk-panel card">
            <div className="panel-head">
              <span><Briefcase size={15} /> Active jobs</span>
              <span>{active.length}</span>
            </div>
            {active.length ? (
              active.slice(0, 8).map((b) => (
                <div className="job-row" key={b.id}>
                  <div>
                    <b>{b.customer?.user?.name || "Customer"}</b>
                    <span>{b.service?.name} · {new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {b.worker?.name || "Unassigned"}</span>
                  </div>
                  <small>{b.status}</small>
                </div>
              ))
            ) : (
              <div className="panel-empty">No active jobs.</div>
            )}
            <AddOffering categories={categories} onAdded={loadProfile} />
          </div>
        </div>

        <div className="desk-note">
          <Clock size={15} />
          <span>Workers now accept jobs themselves. This dashboard monitors availability, dispatch activity, bookings and worker outcomes; it does not assign or accept jobs on a worker’s behalf.</span>
        </div>
      </div>
    </main>
  );
}

function AddWorker({ onAdded }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button className="add-inline" onClick={() => setOpen(true)}><Plus size={13} /> Add worker</button>;
  }
  // The form is its own component, so all its fields reset every time it closes.
  return <AddWorkerForm onDone={() => { setOpen(false); onAdded(); }} />;
}

function AddWorkerForm({ onDone }) {
  const [credentials, setCredentials] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [certifications, setCertifications] = useState("");
  const [eShramUan, setEShramUan] = useState("");
  const [skillIndiaCertificate, setSkillIndiaCertificate] = useState("");

  if (credentials) {
    return (
      <div className="mini-form">
        <b>Worker account created</b>
        <p className="muted">Share these credentials securely with the worker.</p>
        <div className="credential-box">
          <div>Login: <strong>{credentials.email}</strong></div>
          {credentials.password && <div>Temporary password: <strong>{credentials.password}</strong></div>}
        </div>
        <button className="btn" type="button" onClick={onDone}>Done</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post("/provider/workers", {
        name, phone, email,
        password: password || undefined,
        title, skills, certifications, eShramUan, skillIndiaCertificate,
      });
      setCredentials({
        email: r.data.worker.user?.email || email,
        password: r.data.initialPassword || password,
      });
    } catch (err) {
      alert(err.response?.data?.msg || "Could not create worker.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mini-form" onSubmit={submit}>
      <div className="mini-two">
        <input placeholder="Worker name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input type="email" placeholder="Login email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <input placeholder="Role / trade" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Skills (comma separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
      <input placeholder="Certifications" value={certifications} onChange={(e) => setCertifications(e.target.value)} />
      <div className="mini-two">
        <input placeholder="e-Shram UAN (optional)" value={eShramUan} onChange={(e) => setEShramUan(e.target.value)} />
        <input placeholder="Skill India certificate (optional)" value={skillIndiaCertificate} onChange={(e) => setSkillIndiaCertificate(e.target.value)} />
      </div>
      <input type="password" placeholder="Initial password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save worker"}</button>
    </form>
  );
}

function AddOffering({ categories, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return <button className="add-inline" onClick={() => setOpen(true)}><Plus size={13} /> Add service offering</button>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/provider/offerings", { name, category, duration: Number(duration) });
      setName("");
      setCategory(categories[0]);
      setDuration(60);
      setOpen(false);
      onAdded();
    } catch (err) {
      alert(err.response?.data?.msg || "Could not save the service offering.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mini-form" onSubmit={submit}>
      <input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mini-two">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>
      <button className="btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save offering"}</button>
    </form>
  );
}

function Worker({ worker }) {
  return (
    <div className="worker-row">
      <span className={`worker-status ${worker.isOnline ? "on" : ""}`} />
      <div>
        <b>{worker.name}</b>
        <span>{worker.title} · {worker.user?.email || "account not activated"}</span>
      </div>
      <small>{worker.isOnline ? "Receiving jobs" : "Offline"}</small>
    </div>
  );
}