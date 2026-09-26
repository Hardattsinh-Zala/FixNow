const express=require("express");
const router=express.Router();
const auth=require("../middlewares/auth-filter");
const role=require("../middlewares/role-filter");
const c=require("../controllers/provider-controller");
const bc=require("../controllers/broadcast-candidate-controller");

router.use(auth,role("PROVIDER"));
router.get("/profile",c.getProviderProfile);
router.patch("/profile",c.updateProviderProfile);
router.get("/workers",c.listWorkers);
router.post("/workers",c.addWorker);
router.patch("/workers/:id",c.updateWorker);
router.patch("/workers/:id/location",c.updateWorkerLocation);
router.get("/offerings",c.listOfferings);
router.post("/offerings",c.addOffering);
router.patch("/offerings/:id",c.updateOffering);
router.get("/bookings",c.getProviderBookings);

router.post("/requests/:requestId/responses/:responseId/ready",bc.readyForRequest);
router.post("/requests/:requestId/responses/:responseId/decline",bc.declineRequest);

module.exports=router;
