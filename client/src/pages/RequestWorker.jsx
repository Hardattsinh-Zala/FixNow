import { useEffect, useRef, useState } from "react";
import { Radio, Navigation, CheckCircle2, Clock, ArrowRight, RefreshCw } from "lucide-react";
import api from "../api";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import "./RequestWorker.css";

const cats = [
  ["PLUMBING", "Plumbing"],
  ["ELECTRICAL", "Electrical"],
  ["CARPENTRY", "Carpentry"],
  ["PAINTING", "Painting"],
  ["CLEANING", "Cleaning"],
  ["GARDENING", "Gardening"],
  ["APPLIANCE_REPAIR", "Appliance repair"],
  ["DOMESTIC_HELP", "Domestic help"],
  ["HOME_MAINTENANCE", "Home maintenance"],
  ["CAREGIVING", "Caregiving"],
  ["DRIVING", "Driving"],
  ["OTHER", "Other"],
];

const rid = (w) => w.responseId || w.id;
const sameRequest = (a, b) => b != null && String(a) === String(b);

export default function RequestWorker() {
  const socket = useSocket();
  const toast = useToast();
  const nav = useNavigate();

  const [category, setCategory] = useState("PLUMBING");
  const [radius, setRadius] = useState(8);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().slice(0, 10));
  const [stage, setStage] = useState("form"); // form | searching | matched | expired
  const [requestId, setRequestId] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const reqRef = useRef(null);

  const locate = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => reject(new Error("Location permission is required.")),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    );

  const expire = () => {
    setWorkers([]);
    setStage("expired");
  };

  // Realtime events
  useEffect(() => {
    if (!socket) return;

    const ready = (p) => {
      if (!sameRequest(p.requestId, reqRef.current)) return;
      setWorkers((prev) => (prev.some((x) => rid(x) === p.responseId) ? prev : [...prev, p]));
    };
    const loc = (p) => {
      if (!sameRequest(p.requestId, reqRef.current)) return;
      setWorkers((prev) =>
        prev.map((x) =>
          x.worker?.id === p.workerId
            ? { ...x, worker: { ...x.worker, latitude: p.latitude, longitude: p.longitude } }
            : x
        )
      );
    };
    const selected = (p) => {
      if (sameRequest(p.requestId, reqRef.current)) {
        setStage("matched");
        nav("/bookings");
      }
    };
    const expired = (p) => {
      if (sameRequest(p.requestId, reqRef.current)) expire();
    };

    socket.on("worker-ready", ready);
    socket.on("worker-location", loc);
    socket.on("booking-confirmed", selected);
    socket.on("broadcast-expired", expired);
    return () => {
      socket.off("worker-ready", ready);
      socket.off("worker-location", loc);
      socket.off("booking-confirmed", selected);
      socket.off("broadcast-expired", expired);
    };
  }, [socket, nav]);

  // Clock that ticks only while searching
  useEffect(() => {
    if (stage !== "searching") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Expire locally when the server's expiry time passes
  useEffect(() => {
    if (stage === "searching" && expiresAt && now >= expiresAt) expire();
  }, [now, expiresAt, stage]);

  // Poll the server as a fallback to sockets, only while searching
  useEffect(() => {
    if (!requestId || stage !== "searching") return;
    const timer = setInterval(() => {
      api
        .get(`/broadcast/${requestId}`)
        .then((r) => {
          if (r.data.expiresAt) setExpiresAt(new Date(r.data.expiresAt).getTime());
          if (r.data.status === "MATCHED") {
            setStage("matched");
            return;
          }
          if (["EXPIRED", "CANCELLED"].includes(r.data.status)) {
            expire();
            return;
          }
          const incoming = r.data.responses || [];
          setWorkers((prev) => {
            const seen = new Set(incoming.map(rid));
            return [...incoming, ...prev.filter((x) => !seen.has(rid(x)))];
          });
        })
        .catch((e) => console.error("poll failed", e.response?.data || e.message));
    }, 4000);
    return () => clearInterval(timer);
  }, [requestId, stage]);

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      const loc = await locate();
      const r = await api.post("/broadcast", {
        category,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusKm: Number(radius),
        requestedDate,
      });
      reqRef.current = r.data.requestId;
      setRequestId(r.data.requestId);
      setWorkers([]);
      if (r.data.expiresAt) setExpiresAt(new Date(r.data.expiresAt).getTime());
      setNow(Date.now());
      if (r.data.status === "EXPIRED") setStage("expired");
      else setStage("searching");
    } catch (e) {
      setError(e.response?.data?.msg || e.message || "Could not start request.");
    } finally {
      setLoading(false);
    }
  };

  const choose = async (w) => {
    if (stage !== "searching") return;
    try {
      setLoading(true);
      await api.post(`/broadcast/${requestId}/choose/${rid(w)}`);
      setStage("matched");
    } catch (e) {
      toast(e.response?.data?.msg || "That worker is no longer available.", "error");
      setWorkers((prev) => prev.filter((x) => rid(x) !== rid(w)));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setWorkers([]);
    setRequestId(null);
    reqRef.current = null;
    setExpiresAt(null);
    setError("");
    setStage("form");
  };

  if (stage === "form") {
    return (
      <main className="page">
        <div className="container request-wrap">
          <p className="eyebrow">Live request</p>
          <h1 className="page-title">Tell us what<br /><i>needs doing.</i></h1>
          <p className="lead">We'll quietly notify available professionals around you. You will see who is ready and decide who gets the job.</p>
          <section className="request-card card">
            <label className="eyebrow">01 / Work</label>
            <div className="request-cats">
              {cats.map(([v, n]) => (
                <button key={v} className={category === v ? "active" : ""} onClick={() => setCategory(v)}>{n}</button>
              ))}
            </div>
            <label className="eyebrow">02 / Service day</label>
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
            <label className="eyebrow">03 / Search radius</label>
            <div className="radius-row">
              <input type="range" min="2" max="20" value={radius} onChange={(e) => setRadius(e.target.value)} />
              <strong>{radius} km</strong>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn terracotta request-start" onClick={start} disabled={loading}>
              {loading ? <span className="spinner" /> : <><Navigation size={15} /> Start live request</>}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container request-wrap">
        <div className="request-top">
          <div>
            <p className="eyebrow">Request #{requestId}</p>
            <h1 className="page-title">
              {stage === "searching" ? "Who is ready?" : stage === "matched" ? "You're matched." : "No one nearby yet."}
            </h1>
          </div>
          {stage === "searching" && <div className="live-indicator"><span />LIVE</div>}
        </div>

        {stage === "searching" && (
          <div className="search-banner">
            <Radio />
            <div>
              <b>Broadcast is active</b>
              <span>Workers nearby can respond for the next few minutes. You choose the worker — nobody is booked automatically.</span>
            </div>
            <RefreshCw className="spin-slow" />
          </div>
        )}

        {stage === "searching" && workers.length > 0 && (
          <div className="candidate-list">
            {workers.map((w, i) => (
              <article className="candidate card" key={rid(w) || i}>
                <div className="candidate-avatar">{w.worker?.name?.charAt(0) || "W"}</div>
                <div className="candidate-main">
                  <div className="candidate-name">
                    <strong>{w.worker?.name}</strong>
                    <CheckCircle2 size={14} />
                  </div>
                  <span>{w.worker?.title || "Service professional"} · {w.service?.name}</span>
                  <small>{w.provider?.name} · {Number(w.distanceKm || 0).toFixed(1)} km away</small>
                  <div className="candidate-live">
                    {w.worker?.latitude && <><Navigation size={11} /> location updated live</>}
                  </div>
                </div>
                <button className="btn" disabled={loading || stage !== "searching"} onClick={() => choose(w)}>
                  Choose <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
        )}

        {stage === "searching" && !workers.length && (
          <div className="empty">
            <Radio size={30} />
            <h3>Waiting for workers</h3>
            <p>As soon as a professional is ready, they'll appear here.</p>
          </div>
        )}

        {stage === "matched" && (
          <div className="empty">
            <CheckCircle2 size={42} />
            <h3>Booking confirmed</h3>
            <p>Your chosen worker has the job. You can follow the booking and final price from My jobs.</p>
            <button className="btn" onClick={() => nav("/bookings")}>Open my jobs</button>
          </div>
        )}

        {stage === "expired" && (
          <div className="empty">
            <Clock size={32} />
            <h3>No worker became available</h3>
            <p>This request has ended. Try again with a larger radius or a different service.</p>
            <button className="btn" onClick={reset}>Try again</button>
          </div>
        )}
      </div>
    </main>
  );
}