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
    io.to(`provider:${w.providerId}`).emit("service-request",{
      requestId:request.id,responseId:ids.get(Number(w.workerId)),workerId:Number(w.workerId),
      workerName:w.workerName,workerTitle:w.workerTitle,category:request.category,
      distanceKm:Number(w.distanceKm),expiresIn:WAVE_MS/1000
    });
  }
  return fresh.length;
}

async function createServiceRequest(req,res,next){
  try{
    const {category,latitude,longitude,radiusKm=10,requestedDate,requestedStartTime}=req.body;
    if(!CATEGORIES.includes(category))return res.status(400).json({msg:`category must be one of: ${CATEGORIES.join(", ")}`});
    if(latitude==null||longitude==null)return res.status(400).json({msg:"Location is required."});

    const request=await prisma.serviceRequest.create({data:{
      customerId:req.userData.id,category,latitude:Number(latitude),longitude:Number(longitude),radiusKm:Number(radiusKm),
      requestedDate:requestedDate?new Date(requestedDate):null,requestedStartTime:requestedStartTime||null,
      status:"BROADCASTING",wave:1,nextWaveAt:new Date(Date.now()+WAVE_MS),expiresAt:new Date(Date.now()+TTL_MS)
    }});
    const workers=await scoreWorkers(await findNearbyWorkers({latitude:Number(latitude),longitude:Number(longitude),radiusKm:Number(radiusKm),category}),Number(radiusKm));
    const notified=await notifyWave(request,workers,1);
    if(!notified){
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

      let startDate;
      let startTime=request.requestedStartTime;
      if(request.requestedDate&&startTime){
        startDate=new Date(request.requestedDate);
      }else{
        const delay=Math.min(60,Math.max(15,Math.ceil(((Number(response.distanceKm)||0)/20*60+10)/5)*5));
        startDate=new Date(Date.now()+delay*60000);
        startTime=`${String(startDate.getHours()).padStart(2,"0")}:${String(startDate.getMinutes()).padStart(2,"0")}`;
      }
      const service=response.service;
      if(!service)throw Object.assign(new Error("Selected worker did not choose a service."),{statusCode:409});

      const existing=await tx.booking.findMany({where:{providerId:response.providerId,date:startDate,workerId:response.workerId,status:{notIn:["CANCELLED","COMPLETED","NO_SHOW"]}},include:{service:{select:{duration:true}}}});
      const [h,m]=startTime.split(":").map(Number), begin=h*60+m,end=begin+service.duration;
      if(existing.some(b=>begin<(Number(b.startTime.split(":")[0])*60+Number(b.startTime.split(":")[1])+b.service.duration)&&end>(Number(b.startTime.split(":")[0])*60+Number(b.startTime.split(":")[1]))))throw Object.assign(new Error("Worker became unavailable for that time."),{statusCode:409});

      const booking=await tx.booking.create({data:{customerId:request.customerId,providerId:response.providerId,serviceId:response.serviceId,workerId:response.workerId,startTime,date:startDate,status:"CONFIRMED",notes:"Confirmed by customer from a live service broadcast."},include:{worker:true,provider:true,service:true}});
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
