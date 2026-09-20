const express = require("express");
const router = express.Router();
const authController  = require("../controllers/auth-controller");
const emailController = require("../controllers/email-controller");

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/logout", authController.logout);

// Password reset
router.post("/auth/forgot-password", emailController.forgotPassword);
router.post("/auth/reset-password", emailController.resetPassword);

// Token refresh
router.post("/refresh", (req, res) => {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ msg: "No refresh token" });

    try {
        const jwt = require("jsonwebtoken");
        const { setTokenCookies } = require("../utils/generateToken");
        const decoded = jwt.verify(token, process.env.JWT_REFRESH);
        setTokenCookies(res, { email: decoded.email });
        res.status(200).json({ msg: "Token refreshed" });
    } catch {
        res.clearCookie("access_token");
        res.clearCookie("refresh_token", { path: "/api/refresh" });
        res.status(401).json({ msg: "Refresh token expired. Please login again." });
    }
});

module.exports = router;
