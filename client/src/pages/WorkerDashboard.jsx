import {useEffect,useState} from "react";
import {CalendarDays,CheckCircle2,MapPin,Navigation,Power,ShieldCheck,X,IndianRupee} from "lucide-react";
import api from "../api";
import {useSocket} from "../context/SocketContext";
import {useToast} from "../context/ToastContext";
import "./WorkerDashboard.css";

const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};

export default function WorkerDashboard(){
 const [profile,setProfile]=useState(null),[requests,setRequests]=useState([]),[bookings,setBookings]=useState([]),[online,setOnline]=useState(false),[busy,setBusy]=useState(null);
 const socket=useSocket(),toast=useToast();
 const load=async()=>{try{const [p,r,b]=await Promise.all([api.get("/worker/profile"),api.get("/worker/requests"),api.get("/worker/bookings")]);setProfile(p.data);setOnline(p.data.isOnline);setRequests(r.data.responses||[]);setBookings(b.data.bookings||[])}catch{}};
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!socket)return;const incoming=p=>setRequests(xs=>xs.some(x=>x.id===p.responseId)?xs:[{id:p.responseId,request:{id:p.requestId,category:p.category,requestedDate:p.requestedDate,expiresAt:null},worker:{name:p.workerName,title:p.workerTitle},distanceKm:p.distanceKm},...xs]);const released=p=>setRequests(xs=>xs.filter(x=>x.id!==p.responseId));socket.on("service-request",incoming);socket.on("request-selected",released);return()=>{socket.off("service-request",incoming);socket.off("request-selected",released)}},[socket]);
 const locate=()=>new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:5000,timeout:10000}));
 const toggle=async()=>{try{if(online){await api.patch("/worker/availability",{isOnline:false});setOnline(false);return}const pos=await locate();await api.patch("/worker/availability",{isOnline:true,latitude:pos.coords.latitude,longitude:pos.coords.longitude});setOnline(true);toast("You are online and can receive nearby jobs.")}catch(e){toast(e.response?.data?.msg||"Location permission is required.","error")}};
 useEffect(()=>{if(!online)return;const id=navigator.geolocation.watchPosition(pos=>api.patch("/worker/availability",{isOnline:true,latitude:pos.coords.latitude,longitude:pos.coords.longitude}).catch(()=>{}),()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:10000});return()=>navigator.geolocation.clearWatch(id)},[online]);
 const act=async(id,kind)=>{setBusy(id);try{await api.post(`/worker/requests/${id}/${kind}`);setRequests(xs=>xs.filter(x=>x.id!==id));toast(kind==="accept"?"Job accepted. Customer can now select you.":"Request declined.")}catch(e){toast(e.response?.data?.msg||"Request is no longer available.","error")}finally{setBusy(null)}};
 const arrive=async b=>{const price=window.prompt("Final amount agreed for the completed scope (₹):");if(!price)return;try{await api.patch(`/worker/bookings/${b.id}/arrive`,{agreedPrice:Number(price)});toast("Price proposal sent to customer.");load()}catch(e){toast(e.response?.data?.msg||"Could not record arrival.","error")}};
 if(!profile)return <main className="page"><div className="empty"><span className="spinner"/></div></main>;
 const active=bookings.filter(b=>!["COMPLETED","CANCELLED","NO_SHOW"].includes(b.status));
 return <main className="page"><div className="container worker-wrap">
  <div className="worker-hero"><div><p className="eyebrow">Worker profile</p><h1 className="page-title">{profile.name}</h1><p className="lead">{profile.title} · {profile.provider?.name}</p><div className="trust"><ShieldCheck size={14}/> Cooperative verified profile</div></div><button className={`availability ${online?"online":""}`} onClick={toggle}><Power size={16}/><span>{online?"Online — receiving jobs":"Offline — not receiving jobs"}</span></button></div>
  <section className="worker-grid">
   <div className="worker-main"><div className="section-head"><div><p className="eyebrow">Incoming jobs</p><h2>Choose the work you want.</h2></div><span className="count">{requests.length}</span></div>
   {!requests.length?<div className="empty card"><MapPin size={28}/><h3>No incoming requests</h3><p>Go online and keep location permission enabled. Nearby customer requests will appear here in real time.</p></div>:
   <div className="request-stack">{requests.map(r=><article className="worker-request card" key={r.id}><div className="request-line"><span className="category">{labels[r.request?.category]||r.request?.category}</span><span><Navigation size={12}/> {Number(r.distanceKm||0).toFixed(1)} km</span></div><h3>{labels[r.request?.category]||"Service"} job</h3><p><CalendarDays size={14}/> {r.request?.requestedDate?new Date(r.request.requestedDate).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}):"Customer needs the earliest practical day."}</p><div className="request-actions"><button className="btn secondary" disabled={busy===r.id} onClick={()=>act(r.id,"decline")}><X size={14}/> Pass</button><button className="btn terracotta" disabled={busy===r.id} onClick={()=>act(r.id,"accept")}>{busy===r.id?<span className="spinner"/>:<><CheckCircle2 size={14}/> Accept job</>}</button></div></article>)}</div>}
   </div>
   <aside className="worker-side"><div className="card worker-card"><p className="eyebrow">My day</p><div className="stat"><strong>{active.length}</strong><span>active bookings</span></div><div className="stat"><strong>{online?"LIVE":"OFF"}</strong><span>location sharing</span></div><p className="muted">Your live location is used only for dispatch and active-job tracking. The cooperative can see your availability and work activity.</p></div>
   <div className="card worker-card"><p className="eyebrow">Government records</p><div className="gov-links"><a href="https://www.eshram.gov.in/" target="_blank" rel="noreferrer">e-Shram profile ↗</a><a href="https://www.digilocker.gov.in/" target="_blank" rel="noreferrer">DigiLocker documents ↗</a></div><small className="muted">Cooperative verification is recorded in your worker profile; government APIs are used only after authorised partner onboarding.</small></div>
   <div className="card worker-card"><p className="eyebrow">Upcoming</p>{active.length?active.slice(0,4).map(b=><div className="mini-booking" key={b.id}><b>{b.service?.name}</b><span>{new Date(b.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · {b.customer?.user?.name}</span>{["CONFIRMED","PENDING"].includes(b.status)&&<button onClick={()=>arrive(b)}>Arrived & propose price</button>}{b.pricingStatus==="PROPOSED"&&<small>Waiting for customer price confirmation</small>}</div>):<p className="muted">No upcoming jobs.</p>}</div></aside>
  </section>
 </div></main>
}
