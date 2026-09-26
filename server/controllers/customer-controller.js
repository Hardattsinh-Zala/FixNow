const prisma = require("../middlewares/prisma-filter");

const toMinutes = (value) => {
  const [h, m] = String(value).split(":").map(Number);
  return h * 60 + m;
};
const dateKey = (d) => new Date(d).toISOString().slice(0, 10);

const getCustomer = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: req.userData.id },
      include: { user: { select: { name: true, email: true, phone: true } } }
    });
    if (!customer) return res.status(404).json({ msg: "Customer not found." });
    res.json(customer);
  } catch (e) { next(e); }
};

const editCustomer = async (req, res, next) => {
  try {
    const { name, phone, profileUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userData.id },
      data: { name, phone, customer: { update: { profileUrl } } },
      include: { customer: true }
    });
    res.json(user);
  } catch (e) { next(e); }
};

const addBooking = async (req, res, next) => {
  try {
    const customerId = req.userData.id;
    const { providerId, serviceId, workerId, date, notes } = req.body;
    if(!date)return res.status(400).json({msg:"Choose a service day."});
    const service = await prisma.workerService.findUnique({ where: { id: Number(serviceId) } });
    if (!service || !service.isActive) return res.status(404).json({ msg: "Service offering not found." });
    const [yy,mm,dd]=String(date).split("-").map(Number);
    const bookingDate = new Date(yy,mm-1,dd);
    if (Number.isNaN(bookingDate.getTime())) return res.status(400).json({ msg: "Invalid date." });

    if(workerId){
      const worker=await prisma.worker.findFirst({where:{id:Number(workerId),providerId:Number(providerId),isActive:true}});
      if(!worker)return res.status(404).json({msg:"Worker not found."});
      const conflict=await prisma.booking.findFirst({where:{providerId:Number(providerId),workerId:Number(workerId),date:bookingDate,status:{notIn:["CANCELLED","COMPLETED","NO_SHOW"]}}});
      if(conflict)return res.status(409).json({msg:"That worker is already booked for the selected day."});
    }
    const booking = await prisma.booking.create({
      data: { customerId, providerId:Number(providerId), serviceId:Number(serviceId), workerId:workerId?Number(workerId):null, date:bookingDate, status:workerId?"CONFIRMED":"PENDING", notes:notes||null },
      include:{provider:{select:{userId:true,name:true,city:true}},worker:{select:{id:true,name:true,title:true}},service:{select:{id:true,name:true,duration:true,category:true}}}
    });
    res.status(201).json({msg:"Booking created for the selected day.",booking});
  } catch (e) { next(e); }
};

const getBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.userData.id },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: {
        provider: { select: { userId: true, name: true, city: true, address: true, profileUrl: true } },
        worker: { select: { id: true, name: true, title: true, profileUrl: true, latitude: true, longitude: true } },
        service: { select: { name: true, category: true, duration: true } },
        payment: true,
        review: true
      }
    });
    res.json({ allBookings: bookings });
  } catch (e) { next(e); }
};

const cancelBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
    if (!booking || booking.customerId !== req.userData.id) return res.status(404).json({ msg: "Booking not found." });
    if (["CANCELLED", "COMPLETED"].includes(booking.status)) return res.status(400).json({ msg: "This booking cannot be cancelled." });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledBy: "CUSTOMER", cancelledAt: new Date() }
    });
    res.json({ msg: "Booking cancelled." });
  } catch (e) { next(e); }
};

const confirmPricePaymentReady = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
    if (!booking || booking.customerId !== req.userData.id) return res.status(404).json({ msg: "Booking not found." });
    if (booking.pricingStatus !== "AGREED" || !booking.agreedPrice) return res.status(400).json({ msg: "Worker has not confirmed the final price yet." });
    res.json({ bookingId: booking.id, amount: booking.agreedPrice });
  } catch (e) { next(e); }
};


const addReview = async (req,res,next)=>{
  try{
    const bookingId=Number(req.params.id), rating=Number(req.body.rating), comment=req.body.comment||null;
    if(rating<1||rating>5)return res.status(400).json({msg:"Rating must be between 1 and 5."});
    const booking=await prisma.booking.findUnique({where:{id:bookingId}});
    if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
    if(booking.status!=="COMPLETED")return res.status(400).json({msg:"A review can be left after the job is completed."});
    const review=await prisma.review.create({data:{bookingId,customerId:req.userData.id,providerId:booking.providerId,rating,comment}});
    res.status(201).json({review});
  }catch(e){next(e);}
};

const confirmPrice = async (req,res,next)=>{
  try{
    const id=Number(req.params.id);
    const booking=await prisma.booking.findUnique({where:{id}});
    if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
    if(booking.pricingStatus!=="PROPOSED"||!booking.agreedPrice)return res.status(400).json({msg:"No worker price proposal is waiting for confirmation."});
    const updated=await prisma.booking.update({where:{id},data:{pricingStatus:"AGREED",pricingConfirmedAt:new Date()}});
    res.json({booking:updated});
  }catch(e){next(e);}
};

const disputePrice = async (req,res,next)=>{
  try{
    const id=Number(req.params.id),note=String(req.body.note||"").trim();
    const booking=await prisma.booking.findUnique({where:{id}});
    if(!booking||booking.customerId!==req.userData.id)return res.status(404).json({msg:"Booking not found."});
    if(booking.pricingStatus!=="PROPOSED")return res.status(400).json({msg:"There is no price proposal to dispute."});
    const updated=await prisma.booking.update({where:{id},data:{pricingStatus:"DISPUTED",priceDisputedAt:new Date(),priceDisputeNote:note||"Customer requested price clarification.",status:"IN_SERVICE"}});
    res.json({booking:updated});
  }catch(e){next(e);}
};

module.exports = { getCustomer, editCustomer, addBooking, getBookings, cancelBooking, confirmPricePaymentReady, confirmPrice, disputePrice, addReview };
