const express = require("express");
const router = express.Router();
const authFunction = require("../middlewares/auth-filter");
const userController = require("../controllers/user-controller");

router.route("/").get(authFunction, userController.getUser);

module.exports = router;