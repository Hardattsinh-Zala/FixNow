const express=require("express");
const router=express.Router();
const auth=require("../middlewares/auth-filter");
const role=require("../middlewares/role-filter");
const c=require("../controllers/broadcast-controller");

router.post("/",auth,role("CUSTOMER"),c.createServiceRequest);
router.get("/:requestId",auth,role("CUSTOMER"),c.getServiceRequest);
router.post("/:requestId/choose/:responseId",auth,role("CUSTOMER"),c.chooseWorker);

module.exports=router;
