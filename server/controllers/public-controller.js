const prisma = require("../middlewares/prisma-filter");

const listProviders = async(req,res,next)=>{
  try{
    const {city,search,category}=req.query;
    const providers=await prisma.provider.findMany({
      where:{
        isActive:true,
        verificationStatus:{not:"REJECTED"},
        ...(city?{city:{contains:city}}:{}),
        ...(search?{name:{contains:search}}:{}),
        ...(category?{offerings:{some:{category,isActive:true}}}:{})
      },
      include:{offerings:{where:{isActive:true},select:{id:true,name:true,category:true,duration:true,description:true}},workers:{where:{isActive:true},select:{id:true,name:true,title:true,profileUrl:true}},reviews:{select:{rating:true}}}
    });
    const shaped=providers.map(p=>({...p,rating:p.reviews.length?p.reviews.reduce((a,r)=>a+r.rating,0)/p.reviews.length:0,reviews:undefined}));
    res.json({providers:shaped});
  }catch(e){next(e);}
};

const getProvider = async(req,res,next)=>{
  try{
    const provider=await prisma.provider.findUnique({
      where:{userId:Number(req.params.id)},
      include:{
        offerings:{where:{isActive:true}},
        workers:{where:{isActive:true},select:{id:true,name:true,title:true,profileUrl:true,skills:true,certifications:true,isOnline:true}}
      }
    });
    if(!provider)return res.status(404).json({msg:"Provider not found."});
    res.json(provider);
  }catch(e){next(e);}
};


const getPublicSlots=async(req,res,next)=>{
 try{
  const providerId=Number(req.params.id),workerId=req.query.workerId?Number(req.query.workerId):null;
  const rawDate=req.query.date; const date = rawDate
  ? (() => { const [y,m,d] = String(rawDate).split("-").map(Number); return new Date(Date.UTC(y, m-1, d)) })()
  : new Date(new Date().setUTCHours(0,0,0,0));
  const provider=await prisma.provider.findUnique({where:{userId:providerId}});
  if(!provider)return res.status(404).json({msg:"Provider not found."});
  let slots=await prisma.timeSlot.findMany({where:{providerId,workerId,date},orderBy:{startTime:"asc"}});
  if(!slots.length){
   const toM=t=>{const [h,m]=t.split(":").map(Number);return h*60+m},fmt=m=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
   const start=toM(provider.openingTime),end=toM(provider.closingTime),data=[];
   for(let m=start;m<end;m+=provider.slotInterval)data.push({providerId,workerId,date,startTime:fmt(m),endTime:fmt(Math.min(m+provider.slotInterval,end))});
   for(const row of data){
  try {
    await prisma.timeSlot.create({data:row});
  } catch(err) {
    console.error("slot create failed:", row, err.message);
  }
}
   slots=await prisma.timeSlot.findMany({where:{providerId,workerId,date},orderBy:{startTime:"asc"}});
  }
  const bookings=await prisma.booking.findMany({where:{providerId,date,status:{notIn:["CANCELLED","COMPLETED","NO_SHOW"]},...(workerId?{workerId}:{})},include:{service:{select:{duration:true}}}});
  const toM=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
  res.json({slots:slots.map(slot=>{const a=toM(slot.startTime),b=toM(slot.endTime);const unavailable=slot.isBlocked||bookings.some(x=>{const s=toM(x.startTime),e=s+x.service.duration;return a<e&&b>s});return {...slot,available:!unavailable}})});
 }catch(e){next(e);}
};

module.exports={listProviders,getProvider,getPublicSlots};
