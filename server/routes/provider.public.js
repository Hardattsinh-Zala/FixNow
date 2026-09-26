const express=require("express");
const router=express.Router();
const c=require("../controllers/public-controller");
router.get("/",c.listProviders);
router.get("/:id",c.getProvider);
module.exports=router;
