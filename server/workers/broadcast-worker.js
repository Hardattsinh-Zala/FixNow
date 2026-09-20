const prisma=require("../middlewares/prisma-filter");
const {getIO}=require("../sockets");
const {findNearbyWorkers,scoreWorkers}=require("../utils/broadcast-matching");
const {notifyWave,WAVE_SIZE,WAVE_MS}=require("../controllers/broadcast-controller");

async function processServiceRequests(){
  const now=new Date();
  const requests=await prisma.serviceRequest.findMany({where:{status:"BROADCASTING",OR:[{nextWaveAt:{lte:now}},{expiresAt:{lte:now}}]},take:50});
  for(const request of requests){
    if(request.expiresAt<=now){
      await prisma.serviceRequest.updateMany({where:{id:request.id,status:"BROADCASTING"},data:{status:"EXPIRED",nextWaveAt:null}});
      getIO().to(`user:${request.customerId}`).emit("broadcast-expired",{requestId:request.id});
      continue;
    }
    const existing=await prisma.workerResponse.findMany({where:{requestId:request.id},select:{workerId:true}});
    const workers=await scoreWorkers(await findNearbyWorkers({latitude:request.latitude,longitude:request.longitude,radiusKm:request.radiusKm,category:request.category}),request.radiusKm);
    const remaining=workers.filter(w=>!existing.some(e=>e.workerId===Number(w.workerId)));
    const count=await notifyWave(request,remaining,request.wave+1);
    if(count===0){
      await prisma.serviceRequest.update({where:{id:request.id},data:{status:"EXPIRED",nextWaveAt:null}});
      getIO().to(`user:${request.customerId}`).emit("broadcast-expired",{requestId:request.id});
    }else{
      await prisma.serviceRequest.update({where:{id:request.id},data:{wave:{increment:1},nextWaveAt:new Date(Date.now()+WAVE_MS)}});
    }
  }
}
const interval=setInterval(()=>processServiceRequests().catch(console.error),5000);
interval.unref?.();
module.exports={processServiceRequests};
