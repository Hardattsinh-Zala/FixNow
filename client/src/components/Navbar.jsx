import {Link,useNavigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {LogOut,ArrowUpRight} from "lucide-react";
import "./Navbar.css";

export default function Navbar(){
 const {user,isLoggedIn,logout}=useAuth(); const nav=useNavigate();
 const provider=user?.role==="PROVIDER";
 const worker=user?.role==="WORKER";
 return <header className="site-nav"><div className="container nav-inner">
  <Link className="brand" to="/">WORK/LOCAL<small>LIVE</small></Link>
  <nav className="nav-links">
   {!provider && !worker && (<Link to="/providers">Find workers</Link>)}
   {isLoggedIn&& !provider && !worker && <><Link to="/request">Request a worker</Link><Link to="/bookings">My jobs</Link></>}
   {provider && <Link to="/provider">Provider desk</Link>}
   {worker && <Link to="/worker">Worker dashboard</Link>}
   <Link to="/about">About</Link>
  </nav>
  <div className="nav-actions">
   {isLoggedIn?<><button className="btn secondary" onClick={async()=>{await logout();nav("/")}}><LogOut size={14}/> Sign out</button></>:<><Link className="btn secondary" to="/login">Sign in</Link><Link className="btn" to="/register">Join <ArrowUpRight size={14}/></Link></>}
  </div>
 </div></header>
}
