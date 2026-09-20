import {Link} from "react-router-dom";
import {ArrowRight,Radio,ShieldCheck,Navigation,Clock3} from "lucide-react";
import "./Home.css";

const categories=[["PLUMBING","Plumbing"],["ELECTRICAL","Electrical"],["CARPENTRY","Carpentry"],["PAINTING","Painting"],["CLEANING","Cleaning"],["GARDENING","Gardening"],["APPLIANCE_REPAIR","Appliance repair"],["HOME_MAINTENANCE","Home maintenance"]];

export default function Home(){
 return <main className="home">
  <section className="home-hero"><div className="container">
   <p className="eyebrow">A live network for local work</p>
   <h1 className="display">Good work.<br/><em>Right when you need it.</em></h1>
   <p className="hero-copy">Find independent service professionals, send one request to several nearby workers, and choose who you want to work with. The price is agreed when the work begins.</p>
   <div className="hero-actions"><Link className="btn terracotta" to="/request">Request a worker <ArrowRight size={15}/></Link><Link className="btn secondary" to="/providers">Browse professionals</Link></div>
   <div className="hero-rule"><span>01</span><span>LIVE MATCHING</span><span>02</span><span>CUSTOMER CHOICE</span><span>03</span><span>PAY AFTER ARRIVAL</span></div>
  </div></section>
  <section className="section"><div className="container">
   <div className="section-head"><div><p className="eyebrow">What people need</p><h2>Everyday work, without the runaround.</h2></div><Link to="/providers">See all <ArrowRight size={14}/></Link></div>
   <div className="category-list">{categories.map(([v,n],i)=><Link key={v} to={`/providers?category=${v}`} className="category-row"><span>{String(i+1).padStart(2,"0")}</span><strong>{n}</strong><ArrowRight size={16}/></Link>)}</div>
  </div></section>
  <section className="manifesto"><div className="container manifesto-grid"><div><p className="eyebrow">The model</p><h2>Not a marketplace of price tags. A network of people.</h2></div><div className="manifesto-copy"><p>Workers show up live when they are available. Customers see who is ready, where they are, and what they can do — then make the final choice.</p><div className="feature-grid"><div><Radio/><b>Broadcast</b><span>One request reaches available workers nearby.</span></div><div><Navigation/><b>Live location</b><span>Active workers keep their position current.</span></div><div><ShieldCheck/><b>Customer choice</b><span>No automatic first-come booking.</span></div><div><Clock3/><b>Fair pricing</b><span>Price is agreed after the worker arrives.</span></div></div></div></div></section>
 </main>
}
