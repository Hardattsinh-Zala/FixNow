const prisma=require("../middlewares/prisma-filter");
async function verifyProvider(req,res,next){
 try{
  const id=Number(req.params.id);
  const status=["PENDING","VERIFIED","REJECTED"].includes(req.body.status)?req.body.status:null;
  if(!status)return res.status(400).json({msg:"status must be PENDING, VERIFIED or REJECTED."});
  const provider=await prisma.provider.update({where:{userId:id},data:{verificationStatus:status}});
  res.json({provider});
 }catch(e){next(e);}
}
module.exports={verifyProvider};
