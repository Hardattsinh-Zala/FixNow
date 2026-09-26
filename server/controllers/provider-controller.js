const prisma = require("../middlewares/prisma-filter");
const crypto = require("crypto");
const { getIO } = require("../sockets");

const toMinutes = (t) => { const [h,m] = String(t).split(":").map(Number); return h*60+m; };
const fmt = (mins) => `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
const dateOnly = (d) => { const raw=String(d||""); if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const [y,m,day]=raw.split("-").map(Number);return new Date(y,m-1,day);} const x=new Date(d); x.setHours(0,0,0,0); return x; };

const getProviderProfile = async (req,res,next) => {
  try {
    const provider = await prisma.provider.findUnique({
      where:{ userId:req.userData.id },
      include:{ workers:{ orderBy:{ name:"asc" }}, offerings:{ where:{isActive:true}, orderBy:{name:"asc"} } }
    });
    if(!provider) return res.status(404).json({msg:"Provider profile not found."});
    res.json(provider);
  } catch(e){next(e);}
};

const updateProviderProfile = async (req,res,next) => {
  try {
    const { name,bio,address,city,pincode,openingTime,closingTime,profileUrl }=req.body;
    const provider=await prisma.provider.update({where:{userId:req.userData.id},data:{name,bio,address,city,pincode,openingTime,closingTime,profileUrl}});
    res.json(provider);
  }catch(e){next(e);}
};

const listWorkers = async(req,res,next)=>{
  try{
    const workers=await prisma.worker.findMany({where:{providerId:req.userData.id},orderBy:{name:"asc"},include:{user:{select:{id:true,email:true,phone:true,role:true}}}});
    res.json({workers});
  }catch(e){next(e);}
};

const addWorker = async(req,res,next)=>{
  try{
    const {name,phone,email,title,skills,certifications,profileUrl,password,eShramUan,skillIndiaCertificate}=req.body;
    if(!name||!phone||!email)return res.status(400).json({msg:"Name, phone and email are required for a worker account."});
    const exists=await prisma.user.findFirst({where:{OR:[{email},{phone}]}});
    if(exists)return res.status(409).json({msg:"A user with that email or phone already exists."});
    const initialPassword=password||crypto.randomBytes(5).toString("base64url");
    const worker=await prisma.$transaction(async tx=>{
      const user=await tx.user.create({data:{name,email,phone,password:initialPassword,role:"WORKER"}});
      return tx.worker.create({data:{providerId:req.userData.id,userId:user.id,name,phone,title:title||"Service professional",skills:skills||null,certifications:certifications||null,profileUrl:profileUrl||null,eShramUan:eShramUan||null,skillIndiaCertificate:skillIndiaCertificate||null},include:{user:{select:{id:true,email:true,phone:true}}}});
    });
    res.status(201).json({worker,initialPassword});
  }catch(e){next(e);}
};
const updateWorker = async(req,res,next)=>{
  try{
    const id=Number(req.params.id);
    const worker=await prisma.worker.findFirst({where:{id,providerId:req.userData.id}});
    if(!worker)return res.status(404).json({msg:"Worker not found."});
    const {name,phone,title,skills,certifications,profileUrl,isActive,email,password,eShramUan,skillIndiaCertificate,governmentVerificationStatus}=req.body;
    const updated=await prisma.$transaction(async tx=>{
      let userId=worker.userId;
      if(!userId){
        if(!email||!password)throw Object.assign(new Error("Email and password are required to activate the worker account."),{statusCode:400});
        const exists=await tx.user.findFirst({where:{OR:[{email},{phone}]}}); 
        if(exists)throw Object.assign(new Error("That email or phone is already in use."),{statusCode:409});
        const user=await tx.user.create({data:{name:name||worker.name,email,phone:phone||worker.phone,password,role:"WORKER"}});
        userId=user.id;
      }else if(email||password){
        await tx.user.update({where:{id:userId},data:{...(email?{email}:{}),...(password?{password}:{})}});
      }
      return tx.worker.update({where:{id},data:{...(userId?{userId}:{}),...(name?{name}:{}),...(phone?{phone}:{}),...(title?{title}:{}),...(skills!==undefined?{skills}:{}),...(certifications!==undefined?{certifications}:{}),...(profileUrl!==undefined?{profileUrl}:{}),...(eShramUan!==undefined?{eShramUan,governmentVerificationStatus:"PENDING",verificationCheckedAt:null}:{}),...(skillIndiaCertificate!==undefined?{skillIndiaCertificate,governmentVerificationStatus:"PENDING",verificationCheckedAt:null}:{}),...(governmentVerificationStatus!==undefined?{governmentVerificationStatus,verificationCheckedAt:new Date()}:{}),...(isActive!==undefined?{isActive:Boolean(isActive)}:{})},include:{user:{select:{id:true,email:true,phone:true,role:true}}}});
    });
    res.json({worker:updated});
  }catch(e){if(e.statusCode)return res.status(e.statusCode).json({msg:e.message});next(e);}
};
const updateWorkerLocation = async(req,res,next)=>{
  try{
    const {isOnline,latitude,longitude}=req.body;
    const worker=await prisma.worker.findFirst({where:{id:Number(req.params.id),providerId:req.userData.id}});
    if(!worker) return res.status(404).json({msg:"Worker not found."});
    const updated=await prisma.worker.update({where:{id:worker.id},data:{
      isOnline:Boolean(isOnline),
      latitude: latitude ?? worker.latitude,
      longitude: longitude ?? worker.longitude,
      locationUpdatedAt: new Date()
    }});
    const activeResponses = await prisma.workerResponse.findMany({
      where:{workerId:worker.id,status:"READY"},
      select:{requestId:true,request:{select:{customerId:true,status:true}}}
    });
    const activeBookings = await prisma.booking.findMany({
      where:{workerId:worker.id,status:{in:["CONFIRMED","ARRIVED","IN_SERVICE","AWAITING_PAYMENT"]}},
      select:{id:true,customerId:true}
    });
    const io=getIO();
    for(const booking of activeBookings){
      io.to(`user:${booking.customerId}`).emit("worker-location",{
        bookingId:booking.id,workerId:worker.id,latitude:updated.latitude,longitude:updated.longitude,updatedAt:updated.locationUpdatedAt
      });
    }
    for(const item of activeResponses){
      if(item.request?.status==="BROADCASTING"){
        io.to(`user:${item.request.customerId}`).emit("worker-location",{
          requestId:item.requestId,workerId:worker.id,latitude:updated.latitude,longitude:updated.longitude,updatedAt:updated.locationUpdatedAt
        });
      }
    }
    res.json({worker:updated});
  }catch(e){next(e);}
};

const listOfferings = async(req,res,next)=>{
  try{
    const offerings=await prisma.workerService.findMany({where:{providerId:req.userData.id},orderBy:{name:"asc"}});
    res.json({offerings});
  }catch(e){next(e);}
};

const addOffering = async(req,res,next)=>{
  try{
    const {name,category,description,duration,referencePrice=0}=req.body;
    const offering=await prisma.workerService.create({data:{providerId:req.userData.id,name,category,description:description||null,duration:Number(duration)||30,referencePrice:Number(referencePrice)||0}});
    res.status(201).json({offering});
  }catch(e){next(e);}
};

const updateOffering = async(req,res,next)=>{
  try{
    const offering=await prisma.workerService.updateMany({where:{id:Number(req.params.id),providerId:req.userData.id},data:req.body});
    if(!offering.count)return res.status(404).json({msg:"Offering not found."});
    res.json({msg:"Offering updated."});
  }catch(e){next(e);}
};


const getProviderBookings=async(req,res,next)=>{
  try{
    const bookings=await prisma.booking.findMany({
      where:{providerId:req.userData.id},
      orderBy:[{date:"desc"},{startTime:"desc"}],
      include:{customer:{include:{user:{select:{name:true,phone:true,email:true}}}},worker:true,service:true,payment:true}
    });
    res.json({bookings});
  }catch(e){next(e);}
};

const markWorkerArrived = async(req,res,next)=>{
  try{
    const id=Number(req.params.id), agreedPrice=Number(req.body.agreedPrice);
    if(!Number.isFinite(agreedPrice)||agreedPrice<=0)return res.status(400).json({msg:"A final price greater than zero is required."});
    const booking=await prisma.booking.findFirst({where:{id,providerId:req.userData.id}});
    if(!booking)return res.status(404).json({msg:"Booking not found."});
    if(!["PENDING","CONFIRMED"].includes(booking.status))return res.status(400).json({msg:"Booking is not ready for arrival."});
    const updated=await prisma.booking.update({where:{id},data:{status:"AWAITING_PAYMENT",pricingStatus:"AGREED",agreedPrice,arrivedAt:new Date(),pricingConfirmedAt:new Date()},include:{worker:true,provider:true,service:true}});
    getIO().to(`user:${updated.customerId}`).emit("worker-arrived",{bookingId:id,agreedPrice});
    res.json({booking:updated});
  }catch(e){next(e);}
};

const completeBooking=async(req,res,next)=>{
  try{
    const b=await prisma.booking.updateMany({where:{id:Number(req.params.id),providerId:req.userData.id},data:{status:"COMPLETED"}});
    if(!b.count)return res.status(404).json({msg:"Booking not found."});
    res.json({msg:"Booking completed."});
  }catch(e){next(e);}
};

module.exports={getProviderProfile,updateProviderProfile,listWorkers,addWorker,updateWorker,updateWorkerLocation,listOfferings,addOffering,updateOffering,getProviderBookings,markWorkerArrived,completeBooking};
