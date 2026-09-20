import {useEffect,useMemo,useState} from "react";
import {Link,useNavigate,useParams} from "react-router-dom";
import {ArrowLeft,ArrowRight,CheckCircle2,Clock,MapPin,ShieldCheck} from "lucide-react";
import api from "../api";
import {useAuth} from "../context/AuthContext";
import {useToast} from "../context/ToastContext";
import "./ProviderDetail.css";
const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};
export default function ProviderDetail(){
 const {id}=useParams();const {isLoggedIn,user}=useAuth();const nav=useNavigate();const toast=useToast();
 const [p,setP]=useState(null),[workerId,setWorkerId]=useState(""),[serviceId,setServiceId]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[slots,setSlots]=useState([]),[loading,setLoading]=useState(true);
 useEffect(()=>{api.get(`/providers/${id}`).then(r=>{setP(r.data);setWorkerId(String(r.data.workers?.[0]?.id||""));setServiceId(String(r.data.offerings?.[0]?.id||""))}).catch(()=>setP(null)).finally(()=>setLoading(false))},[id]);
 useEffect(()=>{if(!workerId)return;api.get(`/providers/${id}/time-slots`,{params:{date,workerId}}).then(r=>{setSlots(r.data.slots||[]); console.log(r)}).catch(()=>setSlots([]))},[id,date,workerId]);
 const service=p?.offerings?.find(s=>String(s.id)===serviceId);
 const today=new Date().toISOString().slice(0,10);
 const book=async(slot)=>{
  if(!isLoggedIn){nav("/login");return}
  if(user?.role!=="CUSTOMER"){toast("Only customers can create bookings.","error");return}
  try{await api.post("/customer/bookings",{providerId:Number(id),serviceId:Number(serviceId),workerId:Number(workerId),date,startTime:slot.startTime});toast("Booking request sent.");nav("/bookings")}catch(e){toast(e.response?.data?.msg||"That slot is no longer available.","error");setSlots(s=>s.map(x=>x.startTime===slot.startTime?{...x,available:false}:x))}
 };
 if(loading)return <main className="page"><div className="empty"><span className="spinner"/></div></main>;
 if(!p)return <main className="page"><div className="container empty">Provider not found.</div></main>;
 return <main className="page"><div className="container">
  <Link to="/providers" className="back"><ArrowLeft size={14}/> All providers</Link>
  <div className="provider-hero"><div><p className="eyebrow">Service provider / {p.city}</p><h1 className="page-title">{p.name}</h1><p className="lead">{p.bio||"A local team of independent service professionals."}</p><span className="verified"><ShieldCheck size={14}/> Verification {p.verificationStatus==="VERIFIED"?"verified":"in review"}</span></div><div className="provider-address"><MapPin size={15}/><span>{p.address}<br/>{p.city} {p.pincode}</span></div></div>
  <div className="booking-layout"><section><p className="eyebrow">01 / Choose the work</p><div className="offering-grid">{p.offerings.map(s=><button key={s.id} className={`offering ${String(s.id)===serviceId?"active":""}`} onClick={()=>setServiceId(String(s.id))}><strong>{s.name}</strong><span>{labels[s.category]||s.category}</span><small>{s.duration} min · price agreed on arrival</small></button>)}</div></section>
  <section><p className="eyebrow">02 / Choose your professional</p><div className="worker-select">{p.workers.map(w=><button key={w.id} className={`worker-option ${String(w.id)===workerId?"active":""}`} onClick={()=>setWorkerId(String(w.id))}><span className={`online-dot ${w.isOnline?"on":""}`}/><span><strong>{w.name}</strong><small>{w.title}</small></span><ArrowRight size={14}/></button>)}</div></section>
  <section className="slots-section"><div className="slot-head"><div><p className="eyebrow">03 / Time</p><h2>Choose a slot</h2></div><input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)}/></div><div className="slots">{slots.map(s=><button key={s.startTime} disabled={!s.available} className={`slot ${!s.available?"taken":""}`} onClick={()=>book(s)}>{s.startTime}{!s.available&&<small>Booked</small>}</button>)}</div><p className="slot-note"><Clock size={13}/> Slots are persisted in the platform and unavailable once a conflicting booking exists.</p></section></div>
 </div></main>
}
