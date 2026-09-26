import {useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {ArrowRight} from "lucide-react";
import { useToast } from '../context/ToastContext';
import api from "../api";
import {useAuth} from "../context/AuthContext";
import "./Auth.css";
export default function Login(){
 const toast = useToast();
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);const {login}=useAuth(),nav=useNavigate();
 const submit=async e=>{
    e.preventDefault();
    setLoading(true);
    setError("");
    try { 
        await api.post("/login",{identifier:email,password});
        const u=await login();
        toast('Welcome back!');
        nav(u?.role==="PROVIDER"?"/provider":u?.role==="WORKER"?"/worker":"/request")
    }catch(err) { 
        console.error(err)
        toast(
            err.response?.data?.msg ||
            err.message ||
            'Login failed',
            'error'
        );
    }finally { 
        setLoading(false)
    }
 };
 return <main className="auth-page"><div className="auth-card"><p className="eyebrow">Welcome back</p><h1>Sign in.</h1><form className="form" onSubmit={submit}><div className="field"><label>Email or phone</label><input value={email} onChange={e=>setEmail(e.target.value)} type="text" required/></div><div className="field"><label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></div>{error&&<p className="error">{error}</p>}<button className="btn" disabled={loading}>{loading?<span className="spinner"/>:<>Continue <ArrowRight size={14}/></>}</button></form><p className="auth-foot">New here? <Link to="/register">Create an account</Link></p></div></main>
}
