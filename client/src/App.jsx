import {BrowserRouter,Routes,Route,Navigate} from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import {SocketProvider} from "./context/SocketContext";
import {ToastProvider} from "./context/ToastContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Providers from "./pages/Providers";
import ProviderDetail from "./pages/ProviderDetail";
import RequestWorker from "./pages/RequestWorker";
import CustomerBookings from "./pages/CustomerBookings";
import ProviderDesk from "./pages/ProviderDesk";
import ProviderBroadcast from "./pages/ProviderBroadcast";
import About from "./pages/About";
import WorkerDashboard from "./pages/WorkerDashboard";
import "./App.css";

export default function App(){
 return <BrowserRouter><AuthProvider><SocketProvider><ToastProvider>
  <Navbar/>
  <Routes>
   <Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
   <Route path="/providers" element={<Providers/>}/><Route path="/providers/:id" element={<ProviderDetail/>}/><Route path="/about" element={<About/>}/>
   <Route path="/request" element={<ProtectedRoute role="CUSTOMER"><RequestWorker/></ProtectedRoute>}/>
   <Route path="/bookings" element={<ProtectedRoute role="CUSTOMER"><CustomerBookings/></ProtectedRoute>}/>
   <Route path="/provider" element={<ProtectedRoute role="PROVIDER"><ProviderDesk/></ProtectedRoute>}/>
   <Route path="/provider/requests" element={<ProtectedRoute role="PROVIDER"><ProviderBroadcast/></ProtectedRoute>}/>
   <Route path="/worker" element={<ProtectedRoute role="WORKER"><WorkerDashboard/></ProtectedRoute>}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
 </ToastProvider></SocketProvider></AuthProvider></BrowserRouter>
}
