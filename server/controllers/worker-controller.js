const prisma=require("../middlewares/prisma-filter");
const {getIO}=require("../sockets");

async function getProfile(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({
      where:{userId:req.userData.id},
      include:{provider:{select:{userId:true,name:true,city:true,address:true,profileUrl:true}},user:{select:{name:true,email:true,phone:true}},bookings:{orderBy:{date:"desc"},take:10,include:{customer:{include:{user:{select:{name:true,phone:true}}}},service:true,payment:true}}}
    });
    if(!worker)return res.status(404).json({msg:"Worker profile not found."});
    res.json(worker);
  }catch(e){next(e);}
}

async function incoming(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    if(!worker)return res.status(404).json({msg:"Worker profile not found."});
    const responses=await prisma.workerResponse.findMany({
      where:{workerId:worker.id,status:{in:["NOTIFIED","VIEWED","READY"]},request:{status:"BROADCASTING"}},
      orderBy:{notifiedAt:"desc"},
      include:{request:{select:{id:true,category:true,latitude:true,longitude:true,requestedDate:true,expiresAt:true}},provider:{select:{name:true,city:true}},service:{select:{id:true,name:true,category:true,duration:true}}}
    });
    res.json({responses});
  }catch(e){next(e);}
}

async function setAvailability(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    if(!worker)return res.status(404).json({msg:"Worker profile not found."});
    const {isOnline,latitude,longitude}=req.body;
    const updated=await prisma.worker.update({where:{id:worker.id},data:{
      isOnline:Boolean(isOnline),latitude:latitude??worker.latitude,longitude:longitude??worker.longitude,locationUpdatedAt:new Date()
    }});
    const io=getIO();
    const active=await prisma.booking.findMany({where:{workerId:worker.id,status:{in:["CONFIRMED","ARRIVED","IN_SERVICE","AWAITING_PAYMENT"]}},select:{id:true,customerId:true}});
    active.forEach(b=>io.to(`user:${b.customerId}`).emit("worker-location",{bookingId:b.id,workerId:worker.id,latitude:updated.latitude,longitude:updated.longitude,updatedAt:updated.locationUpdatedAt}));
    res.json({worker:updated});
  }catch(e){next(e);}
}

async function acceptRequest(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    if(!worker||!worker.isActive)return res.status(404).json({msg:"Worker account is inactive."});
    if(!worker.isOnline)return res.status(400).json({msg:"Go online before accepting jobs."});
    const id=Number(req.params.responseId);
    const response=await prisma.workerResponse.findUnique({where:{id},include:{request:true}});
    if(!response||response.workerId!==worker.id||response.request.status!=="BROADCASTING")return res.status(404).json({msg:"Job request is no longer available."});
    if(!["NOTIFIED","VIEWED"].includes(response.status))return res.status(409).json({msg:"This request has already been handled."});
    const service=await prisma.workerService.findFirst({where:{providerId:worker.providerId,category:response.request.category,isActive:true},orderBy:{id:"asc"}});
    if(!service)return res.status(400).json({msg:"Your cooperative has no active service for this category."});
    const updated=await prisma.workerResponse.update({where:{id},data:{serviceId:service.id,status:"READY",respondedAt:new Date()},include:{worker:true,provider:true,service:true}});
    getIO().to(`user:${response.request.customerId}`).emit("worker-ready",{requestId:response.requestId,responseId:updated.id,worker:updated.worker,provider:updated.provider,service:updated.service,distanceKm:updated.distanceKm});
    getIO().to(`provider:${worker.providerId}`).emit("worker-accepted-request",{requestId:response.requestId,responseId:updated.id,workerId:worker.id});
    res.json({msg:"Job accepted. Customer can now select you.",response:updated});
  }catch(e){next(e);}
}

async function declineRequest(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    const updated=await prisma.workerResponse.updateMany({where:{id:Number(req.params.responseId),workerId:worker?.id,status:{in:["NOTIFIED","VIEWED"]}},data:{status:"DECLINED",respondedAt:new Date()}});
    res.json({ok:!!updated.count});
  }catch(e){next(e);}
}

async function myBookings(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    if(!worker)return res.status(404).json({msg:"Worker not found."});
    const bookings=await prisma.booking.findMany({where:{workerId:worker.id},orderBy:[{date:"desc"},{createdAt:"desc"}],include:{customer:{include:{user:{select:{name:true,phone:true,email:true}}}},service:true,provider:true,payment:true,review:true}});
    res.json({bookings});
  }catch(e){next(e);}
}

async function arrive(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    const id=Number(req.params.id), price=Number(req.body.agreedPrice);
    if(!worker)return res.status(404).json({msg:"Worker not found."});
    if(!Number.isFinite(price)||price<=0)return res.status(400).json({msg:"Enter a final price greater than zero."});
    const booking=await prisma.booking.findFirst({where:{id,workerId:worker.id}});
    if(!booking)return res.status(404).json({msg:"Booking not found."});
    if(!(booking.status==="CONFIRMED"||booking.status==="PENDING"||(booking.status==="IN_SERVICE"&&booking.pricingStatus==="DISPUTED")))return res.status(400).json({msg:"Booking is not ready for a price proposal."});
    const updated=await prisma.booking.update({where:{id},data:{status:"AWAITING_PAYMENT",pricingStatus:"PROPOSED",agreedPrice:price,arrivedAt:new Date(),priceProposedAt:new Date()},include:{worker:true,service:true,provider:true}});
    getIO().to(`user:${updated.customerId}`).emit("worker-arrived",{bookingId:id,agreedPrice:price,pricingStatus:"PROPOSED"});
    res.json({booking:updated});
  }catch(e){next(e);}
}

async function complete(req,res,next){
  try{
    const worker=await prisma.worker.findUnique({where:{userId:req.userData.id}});
    const b=await prisma.booking.findFirst({where:{id:Number(req.params.id),workerId:worker?.id}});
    if(!b)return res.status(404).json({msg:"Booking not found."});
    if(b.pricingStatus!=="PAID")return res.status(400).json({msg:"Payment must be completed before the job can be closed."});
    await prisma.booking.update({where:{id:b.id},data:{status:"COMPLETED"}});
    res.json({msg:"Job completed."});
  }catch(e){next(e);}
}

module.exports={getProfile,incoming,setAvailability,acceptRequest,declineRequest,myBookings,arrive,complete};
