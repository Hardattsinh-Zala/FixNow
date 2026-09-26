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



module.exports={listProviders,getProvider};
