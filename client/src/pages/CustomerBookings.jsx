import {useEffect,useState} from "react";
import {CalendarDays,MapPin,IndianRupee,Clock,Navigation,ShieldCheck} from "lucide-react";
import api from "../api";
import {useSocket} from "../context/SocketContext";
import {useToast} from "../context/ToastContext";
import "./CustomerBookings.css";

export default function CustomerBookings(){
 const [bookings,setBookings]=useState([]),[loading,setLoading]=useState(true);const socket=useSocket(),toast=useToast();
 const load=()=>api.get("/customer/bookings").then(r=>setBookings(r.data.allBookings||[])).catch(()=>{}).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);useEffect(()=>{if(!socket)return;const arrived=p=>setBookings(bs=>bs.map(b=>b.id===p.bookingId?{...b,status:"AWAITING_PAYMENT",agreedPrice:p.agreedPrice,pricingStatus:"AGREED"}:b));const loc=p=>setBookings(bs=>bs.map(b=>b.id===p.bookingId?{...b,worker:{...b.worker,latitude:p.latitude,longitude:p.longitude,locationUpdatedAt:p.updatedAt}}:b));socket.on("worker-arrived",arrived);socket.on("worker-location",loc);return()=>{socket.off("worker-arrived",arrived);socket.off("worker-location",loc)}},[socket]);
 const cancel=async id=>{try{await api.patch(`/customer/bookings/${id}/cancel`);load()}catch(e){toast(e.response?.data?.msg||"Could not cancel.","error")}};
 if(loading)return <main className="page"><div className="empty"><span className="spinner"/></div></main>;
 const upcoming=bookings.filter(b=>!["COMPLETED","CANCELLED","NO_SHOW"].includes(b.status)),past=bookings.filter(b=>["COMPLETED","CANCELLED","NO_SHOW"].includes(b.status));
 return <main className="page"><div className="container"><p className="eyebrow">Customer space</p><h1 className="page-title">Your<br/><i>jobs.</i></h1><div className="booking-groups"><Group title="Upcoming" items={upcoming} onCancel={cancel} onPaid={load}/><Group title="History" items={past} /></div></div></main>
}
function Group({title,items,onCancel,onPaid}){return <section className="booking-group"><div className="group-title"><span>{title}</span><b>{items.length}</b></div>{items.length?<div className="booking-list">{items.map(b=><Booking key={b.id} b={b} onCancel={onCancel} onPaid={onPaid}/>)}</div>:<div className="empty small">Nothing here.</div>}</section>}
function Booking({b,onCancel,onPaid}){
 const toast=useToast();const [paying,setPaying]=useState(false);
 const pay=async()=>{
  setPaying(true);try{
   const r=await api.post("/customer/payment/order",{bookingId:b.id});
   await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
   const rz=new window.Razorpay({key:r.data.keyId,amount:r.data.amount,currency:r.data.currency,name:"WORK/LOCAL",description:b.service?.name||"Service",order_id:r.data.orderId,handler:async response=>{await api.post("/customer/payment/verify",{bookingId:b.id,...response});toast("Payment complete.");onPaid?.()},theme:{color:"#151515"}});
   rz.open();
  }catch(e){toast(e.response?.data?.msg||"Payment could not be started.","error")}finally{setPaying(false)}
 };
 return <article className="booking-item"><div className="booking-index">#{String(b.id).padStart(3,"0")}</div><div className="booking-main"><div className="booking-title"><h2>{b.service?.name||"Service"}</h2><span className={`status ${b.status.toLowerCase()}`}>{b.status.replaceAll("_"," ")}</span></div><div className="booking-meta"><span><CalendarDays size={13}/>{new Date(b.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span><span><Clock size={13}/>{b.startTime}</span><span><MapPin size={13}/>{b.provider?.city}</span></div><div className="worker-line"><div className="avatar">{b.worker?.name?.charAt(0)||"W"}</div><div><b>{b.worker?.name||"Worker being assigned"}</b><span>{b.worker?.title||b.provider?.name}</span></div>{b.worker?.locationUpdatedAt&&<small><Navigation size={11}/> live location active</small>}</div>{b.agreedPrice&&<div className="price-line"><span><IndianRupee size={15}/> Final price agreed on arrival</span><strong>₹{Number(b.agreedPrice).toFixed(2)}</strong></div>}{b.status==="AWAITING_PAYMENT"&&<div className="pay-box"><ShieldCheck size={15}/><span>Worker has arrived and confirmed the price.</span><button className="btn terracotta" onClick={pay} disabled={paying}>{paying?<span className="spinner"/>:"Pay securely"}</button></div>}{onCancel&&["PENDING","CONFIRMED"].includes(b.status)&&<button className="cancel" onClick={()=>onCancel(b.id)}>Cancel booking</button>}{b.status==="COMPLETED"&&!b.review&&<button className="cancel" onClick={async()=>{const rating=prompt("Rating (1–5):","5");if(rating){await api.post(`/customer/bookings/${b.id}/review`,{rating:Number(rating)});onPaid?.()}}}>Leave a review</button>}</div></article>
}
