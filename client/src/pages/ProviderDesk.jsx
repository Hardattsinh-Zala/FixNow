import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowRight,Radio,Users,Briefcase,Clock,Plus} from "lucide-react";
import api from "../api";
import "./ProviderDesk.css";
const categories=["PLUMBING","ELECTRICAL","CARPENTRY","PAINTING","CLEANING","GARDENING","APPLIANCE_REPAIR","DOMESTIC_HELP","CAREGIVING","DRIVING","HOME_MAINTENANCE","OTHER"];
export default function ProviderDesk(){
 const [profile,setProfile]=useState(null),[bookings,setBookings]=useState([]);
 useEffect(()=>{api.get("/provider/profile").then(r=>setProfile(r.data));api.get("/provider/bookings").then(r=>setBookings(r.data.bookings||[]))},[]);
 if(!profile)return <main className="page"><div className="empty"><span className="spinner"/></div></main>;
 const active=bookings.filter(b=>["PENDING","CONFIRMED","ARRIVED","AWAITING_PAYMENT"].includes(b.status));
 return <main className="page"><div className="container">
  <div className="desk-head"><div><p className="eyebrow">Provider desk</p><h1 className="page-title">{profile.name}</h1><p className="lead">{profile.city} · {profile.workers?.length||0} workers · {profile.offerings?.length||0} services</p></div><Link className="btn terracotta" to="/provider/requests"><Radio size={15}/> Open live requests</Link></div>
  <div className="desk-grid"><div className="desk-panel card"><div className="panel-head"><span><Users size={15}/> Workers</span><Link to="/provider/requests">Live requests <ArrowRight size={13}/></Link></div>{profile.workers?.map(w=><Worker key={w.id} worker={w} onUpdate={()=>api.get("/provider/profile").then(r=>setProfile(r.data))}/>)}<AddWorker onAdded={()=>api.get("/provider/profile").then(r=>setProfile(r.data))}/></div>
  <div className="desk-panel card"><div className="panel-head"><span><Briefcase size={15}/> Active jobs</span><span>{active.length}</span></div>{active.length?active.slice(0,5).map(b=><div className="job-row" key={b.id}><div><b>{b.customer?.user?.name||"Customer"}</b><span>{b.service?.name} · {b.startTime}</span></div><small>{b.status}</small>{["CONFIRMED","PENDING"].includes(b.status)&&<button onClick={async()=>{const price=prompt("Final price agreed with customer (₹):");if(price)await api.patch(`/provider/bookings/${b.id}/arrive`,{agreedPrice:Number(price)}).then(()=>api.get("/provider/bookings").then(r=>setBookings(r.data.bookings||[])))}}>Set price</button>}{b.status==="AWAITING_PAYMENT"&&<button onClick={()=>api.patch(`/provider/bookings/${b.id}/complete`).then(()=>api.get("/provider/bookings").then(r=>setBookings(r.data.bookings||[])))}>Complete</button>}</div>):<div className="panel-empty">No active jobs.</div>}<AddOffering categories={categories} onAdded={()=>api.get("/provider/profile").then(r=>setProfile(r.data))}/></div></div>
  <div className="desk-note"><Clock size={15}/><span>Final pricing is intentionally absent from service listings. When the worker arrives, your team confirms the actual job price and the customer pays in-app.</span></div>
 </div></main>
}
function AddWorker({onAdded}){
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[phone,setPhone]=useState(""),[title,setTitle]=useState(""),[skills,setSkills]=useState(""),[certifications,setCertifications]=useState("");
 if(!open)return <button className="add-inline" onClick={()=>setOpen(true)}><Plus size={13}/> Add worker</button>;
 return <form className="mini-form" onSubmit={async e=>{e.preventDefault();await api.post("/provider/workers",{name,phone,title,skills,certifications});setOpen(false);onAdded()}}><div className="mini-two"><input placeholder="Worker name" value={name} onChange={e=>setName(e.target.value)} required/><input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} required/></div><input placeholder="Role / trade" value={title} onChange={e=>setTitle(e.target.value)}/><input placeholder="Skills (comma separated)" value={skills} onChange={e=>setSkills(e.target.value)}/><input placeholder="Certifications" value={certifications} onChange={e=>setCertifications(e.target.value)}/><button className="btn" type="submit">Save worker</button></form>
}
function AddOffering({categories,onAdded}){
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[category,setCategory]=useState(categories[0]),[duration,setDuration]=useState(60);
 if(!open)return <button className="add-inline" onClick={()=>setOpen(true)}><Plus size={13}/> Add service offering</button>;
 return <form className="mini-form" onSubmit={async e=>{e.preventDefault();await api.post("/provider/offerings",{name,category,duration});setOpen(false);onAdded()}}><input placeholder="Service name" value={name} onChange={e=>setName(e.target.value)} required/><div className="mini-two"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><input type="number" min="15" step="15" value={duration} onChange={e=>setDuration(e.target.value)}/></div><button className="btn" type="submit">Save offering</button></form>
}

function Worker({worker,onUpdate}){
 useEffect(()=>{
  if(!worker.isOnline||!navigator.geolocation)return;
  const id=navigator.geolocation.watchPosition(pos=>{
   api.patch(`/provider/workers/${worker.id}/location`,{isOnline:true,latitude:pos.coords.latitude,longitude:pos.coords.longitude}).catch(()=>{});
  },()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:10000});
  return ()=>navigator.geolocation.clearWatch(id);
 },[worker.id,worker.isOnline]);
 const toggle=async()=>{
  try{
   if(worker.isOnline) await api.patch(`/provider/workers/${worker.id}/location`,{isOnline:false});
   else{
    if(!navigator.geolocation)return;
    const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000}));
    await api.patch(`/provider/workers/${worker.id}/location`,{isOnline:true,latitude:pos.coords.latitude,longitude:pos.coords.longitude});
   }
   onUpdate();
  }catch{}
 };
 return <div className="worker-row"><span className={`worker-status ${worker.isOnline?"on":""}`}/><div><b>{worker.name}</b><span>{worker.title}</span></div><button onClick={toggle}>{worker.isOnline?"Go offline":"Go online"}</button></div>
}
