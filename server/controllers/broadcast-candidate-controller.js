const prisma=require("../middlewares/prisma-filter");
const {getIO}=require("../sockets");

async function readyForRequest(req,res,next){
  try{
    const requestId=Number(req.params.requestId),responseId=Number(req.params.responseId),providerId=req.userData.id;
    const {workerId,serviceId}=req.body;
    const response=await prisma.workerResponse.findUnique({where:{id:responseId}});
    if(!response||response.requestId!==requestId||response.providerId!==providerId)return res.status(404).json({msg:"Request response not found."});
    if(!["NOTIFIED","VIEWED"].includes(response.status))return res.status(409).json({msg:"This request is no longer available."});

    const worker=await prisma.worker.findFirst({where:{id:Number(workerId||response.workerId),providerId,isActive:true,isOnline:true}});
    if(!worker)return res.status(400).json({msg:"Worker is offline or unavailable."});
    const service=await prisma.workerService.findFirst({where:{id:Number(serviceId),providerId,isActive:true}});
    if(!service)return res.status(400).json({msg:"Choose a valid service offering."});

    const updated=await prisma.workerResponse.update({where:{id:responseId},data:{workerId:worker.id,serviceId:service.id,status:"READY",respondedAt:new Date()},include:{worker:true,provider:true,service:true}});
    const request=await prisma.serviceRequest.findUnique({where:{id:requestId}});
    getIO().to(`user:${request.customerId}`).emit("worker-ready",{requestId,responseId,worker:updated.worker,provider:updated.provider,service:updated.service,distanceKm:updated.distanceKm});
    res.json({msg:"Worker is ready for the customer.",response:updated});
  }catch(e){next(e);}
}

async function declineRequest(req,res,next){
  try{
    const updated=await prisma.workerResponse.updateMany({where:{id:Number(req.params.responseId),requestId:Number(req.params.requestId),providerId:req.userData.id},data:{status:"DECLINED",respondedAt:new Date()}});
    res.json({ok:!!updated.count});
  }catch(e){next(e);}
}

module.exports={readyForRequest,declineRequest};
