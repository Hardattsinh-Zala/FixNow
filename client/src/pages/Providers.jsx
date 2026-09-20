import {useEffect,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {ArrowRight,MapPin,CheckCircle2} from "lucide-react";
import api from "../api";
import "./Providers.css";
const labels={PLUMBING:"Plumbing",ELECTRICAL:"Electrical",CARPENTRY:"Carpentry",PAINTING:"Painting",CLEANING:"Cleaning",GARDENING:"Gardening",APPLIANCE_REPAIR:"Appliance repair",DOMESTIC_HELP:"Domestic help",CAREGIVING:"Caregiving",DRIVING:"Driving",HOME_MAINTENANCE:"Home maintenance",OTHER:"Other"};
export default function Providers(){
 const [params]=useSearchParams();const [providers,setProviders]=useState([]);const [loading,setLoading]=useState(true);const category=params.get("category")||"";
 useEffect(()=>{api.get("/providers",{params:{category}}).then(r=>setProviders(r.data.providers||[])).catch(()=>setProviders([])).finally(()=>setLoading(false))},[category]);
 return <main className="page"><div className="container">
  <p className="eyebrow">The network</p><h1 className="page-title">People who do<br/><i>good work.</i></h1>
  <p className="lead">Browse verified service providers and the professionals behind them. No map clutter — just people, skills and availability.</p>
  {loading?<div className="empty"><span className="spinner"/></div>:!providers.length?<div className="empty"><p>No providers match this service yet.</p></div>:
  <div className="provider-list">{providers.map(p=><Link to={`/providers/${p.userId}`} className="provider-card" key={p.userId}>
   <div className="provider-number">/{String(p.userId).padStart(2,"0")}</div><div><div className="provider-name">{p.name}<CheckCircle2 size={16}/></div><p>{p.bio||"Independent local service provider"}</p><div className="provider-meta"><span><MapPin size={13}/>{p.city}</span>{p.offerings?.slice(0,3).map(s=><span key={s.id}>{labels[s.category]||s.category}</span>)}</div></div><ArrowRight/>
  </Link>)}</div>}
 </div></main>
}
