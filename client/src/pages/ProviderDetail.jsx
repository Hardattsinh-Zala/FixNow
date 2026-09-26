import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,MapPin,ShieldCheck} from "lucide-react";
import {Link,useNavigate,useParams} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {useToast} from "../context/ToastContext";
import api from "../api";
import "./ProviderDetail.css";
const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};

export default function ProviderDetail(){
 const {id}=useParams(),nav=useNavigate(),{isLoggedIn,user}=useAuth(),toast=useToast();
 const [p,setP]=useState(null),[workerId,setWorkerId]=useState(""),[serviceId,setServiceId]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[loading,setLoading]=useState(true);
 useEffect(()=>{api.get(`/providers/${id}`).then(r=>{setP(r.data);setWorkerId(String(r.data.workers?.find(w=>w.isOnline)?.id||r.data.workers?.[0]?.id||""));setServiceId(String(r.data.offerings?.[0]?.id||""))}).catch(()=>setP(null)).finally(()=>setLoading(false))},[id]);
 const service=p?.offerings?.find(s=>String(s.id)===serviceId);
 const today=new Date().toISOString().slice(0,10);
 const book=async()=>{if(!isLoggedIn){nav("/login");return}if(user?.role!=="CUSTOMER"){toast("Only customers can create bookings.","error");return}try{await api.post("/customer/bookings",{providerId:Number(id),serviceId:Number(serviceId),workerId:workerId?Number(workerId):undefined,date});toast("Day booking request sent.");nav("/bookings")}catch(e){toast(e.response?.data?.msg||"That worker is no longer available for the selected day.","error")}};
 if(loading)return <main className="page"><div className="empty"><span className="spinner"/></div></main>;
 if(!p)return <main className="page"><div className="container empty">Provider not found.</div></main>;
 return <main className="page"><div className="container">
  <Link to="/providers" className="back"><ArrowLeft size={14}/> All providers</Link>
  <div className="provider-hero"><div><p className="eyebrow">Service cooperative / {p.city}</p><h1 className="page-title">{p.name}</h1><p className="lead">{p.bio||"A local cooperative network of verified service professionals."}</p><span className="verified"><ShieldCheck size={14}/> Verification {p.verificationStatus==="VERIFIED"?"verified":"in review"}</span></div><div className="provider-address"><MapPin size={15}/><span>{p.address}<br/>{p.city} {p.pincode}</span></div></div>
  <div className="booking-layout"><section><p className="eyebrow">01 / Choose the work</p><div className="offering-grid">{p.offerings.map(s=><button key={s.id} className={`offering ${String(s.id)===serviceId?"active":""}`} onClick={()=>setServiceId(String(s.id))}><strong>{s.name}</strong><span>{labels[s.category]||s.category}</span><small>{s.duration} min typical · price agreed on arrival</small></button>)}</div></section>
  <section><p className="eyebrow">02 / Choose a professional</p><div className="worker-select">{p.workers.filter(w=>w.isActive!==false).map(w=><button key={w.id} className={`worker-option ${String(w.id)===workerId?"active":""}`} onClick={()=>setWorkerId(String(w.id))}><span className={`online-dot ${w.isOnline?"on":""}`}/><span><strong>{w.name}</strong><small>{w.title}</small></span><ArrowRight size={14}/></button>)}</div></section>
  <section className="slots-section"><div className="slot-head"><div><p className="eyebrow">03 / Service day</p><h2>Pick a day</h2></div><input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)}/></div><div className="day-booking"><CalendarDays size={22}/><div><strong>{new Date(date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</strong><p>No time slots. Your worker coordinates the arrival window with you after the booking is confirmed.</p></div></div><button className="btn terracotta book-day" disabled={!serviceId||!date} onClick={book}><CheckCircle2 size={15}/> Request this day</button><p className="slot-note">Pricing is not fixed at booking. The worker confirms scope and proposes the final amount after arrival; you approve it before payment.</p></section></div>
 </div></main>
}