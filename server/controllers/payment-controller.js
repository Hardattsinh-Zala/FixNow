const Razorpay=require("razorpay");
const crypto=require("crypto");
const prisma=require("../middlewares/prisma-filter");

const razorpay=process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET?new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;

async function createOrder(req,res,next){
 try{
  const booking=await prisma.booking.findUnique({where:{id:Number(req.body.bookingId)}});
  if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
  if(booking.pricingStatus!=="AGREED"||!booking.agreedPrice)return res.status(400).json({msg:"Final price has not been confirmed by the worker."});
  if(!razorpay)return res.status(503).json({msg:"Online payments are not configured on this server."});
  const amount=Math.round(Number(booking.agreedPrice)*100);
  const order=await razorpay.orders.create({amount,currency:"INR",receipt:`booking_${booking.id}`,notes:{bookingId:String(booking.id)}});
  res.json({orderId:order.id,amount:order.amount,currency:order.currency,keyId:process.env.RAZORPAY_KEY_ID});
 }catch(e){next(e);}
}

async function verifyPayment(req,res,next){
 try{
  const {bookingId,razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
  const booking=await prisma.booking.findUnique({where:{id:Number(bookingId)}});
  if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
  if(booking.pricingStatus!=="AGREED"||!booking.agreedPrice)return res.status(400).json({msg:"No agreed price exists."});
  const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if(expected!==razorpay_signature)return res.status(400).json({msg:"Payment verification failed."});
  const payment=await prisma.payment.upsert({
    where:{bookingId:booking.id},
    update:{amount:booking.agreedPrice,method:"ONLINE",status:"PAID",transactionId:razorpay_payment_id,paidAt:new Date()},
    create:{bookingId:booking.id,amount:booking.agreedPrice,method:"ONLINE",status:"PAID",transactionId:razorpay_payment_id,paidAt:new Date()}
  });
  await prisma.booking.update({where:{id:booking.id},data:{pricingStatus:"PAID",status:"COMPLETED"}});
  res.json({msg:"Payment successful.",paymentId:payment.id});
 }catch(e){next(e);}
}
async function recordCashPayment(req,res,next){
 try{
  const booking=await prisma.booking.findUnique({where:{id:Number(req.body.bookingId)}});
  if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
  if(booking.pricingStatus!=="AGREED"||!booking.agreedPrice)return res.status(400).json({msg:"Final price has not been confirmed."});
  const payment=await prisma.payment.upsert({
   where:{bookingId:booking.id},
   update:{amount:booking.agreedPrice,method:"CASH",status:"PENDING",paidAt:new Date()},
   create:{bookingId:booking.id,amount:booking.agreedPrice,method:"CASH",status:"PENDING",paidAt:new Date()}
  });
  res.json({msg:"Cash payment recorded.",paymentId:payment.id,amount:booking.agreedPrice});
 }catch(e){next(e);}
}
module.exports={createOrder,verifyPayment,recordCashPayment};
