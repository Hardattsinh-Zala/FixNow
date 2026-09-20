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
    const { providerId, serviceId, workerId, startTime, date, notes } = req.body;
    const service = await prisma.workerService.findUnique({ where: { id: Number(serviceId) } });
    if (!service || !service.isActive) return res.status(404).json({ msg: "Service offering not found." });

    const [yy,mm,dd]=String(date).split("-").map(Number); const bookingDate = new Date(yy,mm-1,dd);
    if (Number.isNaN(bookingDate.getTime())) return res.status(400).json({ msg: "Invalid date." });

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: Number(providerId),
        date: bookingDate,
        status: { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] },
        ...(workerId ? { workerId: Number(workerId) } : {})
      },
      include: { service: { select: { duration: true } } }
    });

    const requestedStart = toMinutes(startTime);
    const requestedEnd = requestedStart + service.duration;
    const conflict = bookings.some(b => {
      const s = toMinutes(b.startTime);
      return requestedStart < s + b.service.duration && requestedEnd > s;
    });
    if (conflict) return res.status(409).json({ msg: "That time is already booked." });

    const booking = await prisma.booking.create({
      data: {
        customerId,
        providerId: Number(providerId),
        serviceId: Number(serviceId),
        workerId: workerId ? Number(workerId) : null,
        startTime,
        date: bookingDate,
        notes: notes || null,
      },
      include: {
        provider: { select: { userId: true, name: true, city: true } },
        worker: { select: { id: true, name: true, title: true } },
        service: { select: { id: true, name: true, duration: true, category: true } }
      }
    });
    res.status(201).json({ msg: "Booking created.", booking });
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

module.exports = { getCustomer, editCustomer, addBooking, getBookings, cancelBooking, confirmPricePaymentReady, addReview };
