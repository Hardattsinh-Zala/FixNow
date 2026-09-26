const prisma = require("../middlewares/prisma-filter");
const {getIO}=require("../sockets");
const {findNearbyWorkers,scoreWorkers}=require("../utils/broadcast-matching");

const WAVE_SIZE=6;
const WAVE_MS=25000;
const TTL_MS=10*60*1000;
const CATEGORIES=["PLUMBING","ELECTRICAL","CARPENTRY","PAINTING","CLEANING","GARDENING","APPLIANCE_REPAIR","DOMESTIC_HELP","CAREGIVING","DRIVING","HOME_MAINTENANCE","OTHER"];

async function notifyWave(request, workers, wave){
  const existing=await prisma.workerResponse.findMany({where:{requestId:request.id},select:{workerId:true}});
  const used=new Set(existing.map(x=>x.workerId));
  const fresh=workers.filter(w=>!used.has(Number(w.workerId))).slice(0,WAVE_SIZE);
  if(!fresh.length)return 0;

  await prisma.workerResponse.createMany({data:fresh.map(w=>({
    requestId:request.id,providerId:Number(w.providerId),workerId:Number(w.workerId),
    status:"NOTIFIED",distanceKm:Number(w.distanceKm),score:Number(w.score)
  }))});
  const rows=await prisma.workerResponse.findMany({where:{requestId:request.id,workerId:{in:fresh.map(w=>Number(w.workerId))}}});
  const ids=new Map(rows.map(r=>[r.workerId,r.id]));
  const io=getIO();
  for(const w of fresh){
    const sockets=await io.in(`worker:${Number(w.workerId)}`).fetchSockets();
  console.log(`[broadcast] worker:${w.workerId} sockets:`,sockets.length);
  
    const payload={
      requestId:request.id,responseId:ids.get(Number(w.workerId)),workerId:Number(w.workerId),
      workerName:w.workerName,workerTitle:w.workerTitle,category:request.category,
      distanceKm:Number(w.distanceKm),score:Number(w.score),requestedDate:request.requestedDate,expiresIn:WAVE_MS/1000
    };
    io.to(`worker:${Number(w.workerId)}`).emit("service-request",payload);
    // Cooperative receives the same event for oversight/analytics; it no longer accepts jobs.
    io.to(`provider:${w.providerId}`).emit("service-request",payload);
  }
  return fresh.length;
}

async function createServiceRequest(req,res,next){
  try{
    const {category,latitude,longitude,radiusKm=10,requestedDate}=req.body;
    if(!CATEGORIES.includes(category))return res.status(400).json({msg:`category must be one of: ${CATEGORIES.join(", ")}`});
    if(latitude==null||longitude==null)return res.status(400).json({msg:"Location is required."});

    const request=await prisma.serviceRequest.create({data:{
      customerId: req.userData.id,
      category,
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusKm: Number(radiusKm),
      requestedDate: requestedDate?new Date(requestedDate):null,
      status: "BROADCASTING",wave:1,nextWaveAt:new Date(Date.now()+WAVE_MS),expiresAt:new Date(Date.now()+TTL_MS)
    }});

    const nearby=await findNearbyWorkers({latitude:Number(latitude),longitude:Number(longitude),radiusKm:Number(radiusKm),category});
    console.log("[broadcast] nearby:",nearby.length);
    const workers=await scoreWorkers(nearby,Number(radiusKm));
    const notified=await notifyWave(request,workers,1);
    if(!notified) {
      await prisma.serviceRequest.update({where:{id:request.id},data:{status:"EXPIRED",nextWaveAt:null}});
      return res.status(201).json({requestId:request.id,status:"EXPIRED",candidates:0});
    }
    res.status(201).json({requestId:request.id,status:"BROADCASTING",candidates:notified});
  }catch(e){next(e);}
}

async function getServiceRequest(req,res,next){
  try{
    const id=Number(req.params.requestId);
    const request=await prisma.serviceRequest.findUnique({
      where:{id},
      include:{responses:{where:{status:"READY"},include:{worker:{select:{id:true,name:true,title:true,profileUrl:true,latitude:true,longitude:true,locationUpdatedAt:true}},provider:{select:{userId:true,name:true,city:true,address:true,profileUrl:true}},service:{select:{id:true,name:true,duration:true,category:true}}}}}
    });
    if(!request||request.customerId!==req.userData.id)return res.status(404).json({msg:"Request not found."});
    res.json(request);
  }catch(e){next(e);}
}

async function chooseWorker(req,res,next){
  try{
    const requestId=Number(req.params.requestId),responseId=Number(req.params.responseId);
    const result=await prisma.$transaction(async tx=>{
      const request=await tx.serviceRequest.findUnique({where:{id:requestId}});
      if(!request||request.customerId!==req.userData.id||request.status!=="BROADCASTING")throw Object.assign(new Error("Request is no longer open."),{statusCode:409});
      const response=await tx.workerResponse.findUnique({where:{id:responseId},include:{service:true,worker:true}});
      if(!response||response.requestId!==requestId||response.status!=="READY")throw Object.assign(new Error("That worker is no longer available."),{statusCode:409});

      if(!request.requestedDate)throw Object.assign(new Error("A service day is required."),{statusCode:400});
      const startDate=new Date(request.requestedDate);
      const service=response.service;
      if(!service)throw Object.assign(new Error("Selected worker did not choose a service."),{statusCode:409});

      // Day-based scheduling: one worker can hold at most one active job per day.
      const existing=await tx.booking.findFirst({
        where:{providerId:response.providerId,date:startDate,workerId:response.workerId,status:{notIn:["CANCELLED","COMPLETED","NO_SHOW"]}}
      });
      if(existing)throw Object.assign(new Error("That worker is already booked for the selected day."),{statusCode:409});

      const booking=await tx.booking.create({data:{customerId:request.customerId,providerId:response.providerId,serviceId:response.serviceId,workerId:response.workerId,date:startDate,status:"CONFIRMED",notes:"Confirmed by customer from a live service broadcast."},include:{worker:true,provider:true,service:true}});
      await tx.serviceRequest.update({where:{id:requestId},data:{status:"MATCHED",selectedProviderId:response.providerId,selectedResponseId:response.id,matchedBookingId:booking.id,nextWaveAt:null}});
      await tx.workerResponse.update({where:{id:response.id},data:{status:"SELECTED",respondedAt:new Date()}});
      await tx.workerResponse.updateMany({where:{requestId, id:{not:response.id},status:{in:["NOTIFIED","VIEWED","READY"]}},data:{status:"RELEASED",respondedAt:new Date()}});
      return {request,booking,response};
    });
    const io=getIO();
    io.to(`provider:${result.response.providerId}`).emit("request-selected",{requestId,bookingId:result.booking.id,workerId:result.response.workerId});
    io.to(`user:${result.request.customerId}`).emit("booking-confirmed",{requestId,bookingId:result.booking.id,booking:result.booking});
    res.json({msg:"Worker selected.",booking:result.booking});
  }catch(e){res.status(e.statusCode||500).json({msg:e.statusCode?e.message:"Could not select worker."});}
}

module.exports={createServiceRequest,getServiceRequest,chooseWorker,CATEGORIES,WAVE_SIZE,WAVE_MS,TTL_MS,notifyWave};
