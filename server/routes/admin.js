const express=require("express");
const router=express.Router();
const auth=require("../middlewares/auth-filter");
const role=require("../middlewares/role-filter");
const c=require("../controllers/admin-controller");
router.patch("/providers/:id/verification",auth,role("ADMIN"),c.verifyProvider);
module.exports=router;
