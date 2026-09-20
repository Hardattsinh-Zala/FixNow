import {useEffect,useState} from "react";
import {Clock,Radio,Navigation,CheckCircle2,X,Send} from "lucide-react";
import api from "../api";
import {useSocket} from "../context/SocketContext";
import {useToast} from "../context/ToastContext";
import "./ProviderBroadcast.css";
const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};
export default function ProviderBroadcast(){
 const socket=useSocket(),toast=useToast();const [requests,setRequests]=useState([]),[workers,setWorkers]=useState([]),[services,setServices]=useState([]),[busy,setBusy]=useState(null);
 const load=()=>Promise.all([api.get("/provider/workers"),api.get("/provider/offerings")]).then(([w,s])=>{setWorkers(w.data.workers||[]);setServices(s.data.offerings||[])});
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!socket)return;const incoming=p=>setRequests(prev=>prev.some(x=>x.responseId===p.responseId)?prev:[{...p},...prev]);const selected=p=>setRequests(prev=>prev.filter(x=>x.responseId!==p.responseId));socket.on("service-request",incoming);socket.on("request-selected",selected);return()=>{socket.off("service-request",incoming);socket.off("request-selected",selected)}},[socket]);
 const ready=async(r)=>{
  const worker=workers.find(w=>w.id===r.workerId&&w.isOnline);const service=services.find(s=>s.category===r.category&&s.isActive!==false);
  if(!worker)return toast("That worker is offline.","error");if(!service)return toast("Create an active service offering for this category first.","error");
  setBusy(r.responseId);try{await api.post(`/provider/requests/${r.requestId}/responses/${r.responseId}/ready`,{workerId:worker.id,serviceId:service.id});setRequests(prev=>prev.filter(x=>x.responseId!==r.responseId));toast("Worker is now ready. The customer will choose.");}catch(e){toast(e.response?.data?.msg||"Could not respond.","error")}finally{setBusy(null)}
 };
 const decline=async r=>{try{await api.post(`/provider/requests/${r.requestId}/responses/${r.responseId}/decline`);setRequests(p=>p.filter(x=>x.responseId!==r.responseId))}catch{}};
 return <main className="page"><div className="container"><div className="desk-head"><div><p className="eyebrow">Live exchange</p><h1 className="page-title">Requests,<br/><i>in real time.</i></h1><p className="lead">Customers broadcast a need. Your nearby worker can signal readiness. The customer — not the first click — decides who gets the work.</p></div><div className="broadcast-live"><Radio/> Listening</div></div>
 <div className="broadcast-info"><div><b>{requests.length}</b><span>open requests</span></div><div><b>{workers.filter(w=>w.isOnline).length}</b><span>workers online</span></div><div><b>{services.length}</b><span>offerings</span></div></div>
 {!requests.length?<div className="empty"><Radio size={32}/><h3>Nothing coming through</h3><p>Keep this screen open. New requests will arrive without refreshing.</p></div>:<div className="incoming-list">{requests.map(r=><article className="incoming card" key={r.responseId}><div className="incoming-top"><span className="category-pill">{labels[r.category]||r.category}</span><span><Navigation size={12}/> {Number(r.distanceKm).toFixed(1)} km</span><span><Clock size={12}/> {r.expiresIn||25}s</span></div><h2>{r.workerName}</h2><p>Request for a {labels[r.category]?.toLowerCase()||"service"} professional. This customer will compare every worker who responds.</p><div className="incoming-actions"><button className="btn secondary" onClick={()=>decline(r)}><X size={14}/> Pass</button><button className="btn terracotta" disabled={busy===r.responseId} onClick={()=>ready(r)}>{busy===r.responseId?<span className="spinner"/>:<><Send size={14}/> Mark worker ready</>}</button></div></article>)}</div>}
 <div className="broadcast-note"><CheckCircle2 size={15}/><span>Ready is not a booking. It is an offer of availability. The customer sees the worker, service and live location, then chooses.</span></div>
 </div></main>
}
