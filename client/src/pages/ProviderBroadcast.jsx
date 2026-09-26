import {useEffect,useState} from "react";
import {CalendarDays,Navigation,Radio,Users,Activity} from "lucide-react";
import api from "../api";
import {useSocket} from "../context/SocketContext";
import "./ProviderBroadcast.css";
const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};
export default function ProviderBroadcast(){
 const socket=useSocket();const [events,setEvents]=useState([]),[workers,setWorkers]=useState([]);
 const load=()=>api.get("/provider/workers").then(r=>setWorkers(r.data.workers||[]));
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!socket)return;const incoming=p=>setEvents(xs=>[{...p,at:new Date()},...xs].slice(0,20));const accepted=p=>setEvents(xs=>xs.map(x=>x.responseId===p.responseId?{...x,accepted:true}:x));socket.on("service-request",incoming);socket.on("worker-accepted-request",accepted);return()=>{socket.off("service-request",incoming);socket.off("worker-accepted-request",accepted)}},[socket]);
 return <main className="page"><div className="container"><div className="desk-head"><div><p className="eyebrow">Cooperative control room</p><h1 className="page-title">Dispatch,<br/><i>without micromanagement.</i></h1><p className="lead">Workers receive nearby requests and choose what they can take. This screen is for oversight, not manual assignment.</p></div><div className="broadcast-live"><Radio/> Live monitor</div></div>
 <div className="broadcast-info"><div><b>{workers.filter(w=>w.isOnline).length}</b><span>workers online</span></div><div><b>{events.length}</b><span>recent dispatch events</span></div><div><b>{workers.length}</b><span>registered workers</span></div></div>
 <div className="control-grid"><section><div className="panel-head"><span><Activity size={15}/> Dispatch activity</span></div>{events.length?<div className="incoming-list">{events.map((r,i)=><article className="incoming card" key={(r.responseId||"e")+i}><div className="incoming-top"><span className="category-pill">{labels[r.category]||r.category}</span><span><Navigation size={12}/> {Number(r.distanceKm||0).toFixed(1)} km</span></div><h2>{r.workerName}</h2><p>{r.accepted?"Worker accepted this request; customer can select them.":"Request delivered to this worker. Waiting for their response."}</p><small>{r.at?.toLocaleTimeString?.("en-IN")}</small></article>)}</div>:<div className="empty"><Radio size={30}/><h3>No dispatch events yet</h3><p>Keep this screen open for real-time cooperative oversight.</p></div>}</section>
 <aside className="worker-monitor card"><div className="panel-head"><span><Users size={15}/> Workforce</span></div>{workers.map(w=><div className="worker-row" key={w.id}><span className={`worker-status ${w.isOnline?"on":""}`}/><div><b>{w.name}</b><span>{w.title}</span></div><small>{w.isOnline?"Receiving":"Offline"}</small></div>)}</aside></div>
 <div className="broadcast-note"><CalendarDays size={15}/><span>Booking is day-based. No time-slot inventory is created; the worker and customer coordinate the practical arrival window after the day is confirmed.</span></div>
 </div></main>
}