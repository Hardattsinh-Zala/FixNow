const jwt = require("jsonwebtoken");
const prisma = require("./prisma-filter");

const authFunction = async (req, res, next) => {
    try {
        const token = req.cookies?.access_token;

        if (!token) {
            return res.status(401).json({ msg: "Unauthorized access" });
        }

        // 1. Check blocklist BEFORE verifying signature — fast DB lookup by unique index
        const blocked = await prisma.blockedToken.findUnique({ where: { token } });
        if (blocked) {
            return res.status(401).json({ msg: "Token has been revoked. Please login again." });
        }

        // 2. Verify signature and expiry
        const decodedToken = jwt.verify(token, process.env.JWT);

        // 3. Load user from DB
        const userData = await prisma.user.findUnique({
            where: { email: decodedToken.email },
            omit:  { password: true }
        });

        if (!userData) {
            return res.status(401).json({ msg: "Unauthorized access" });
        }

        req.userData = userData;
        next();
    } catch (error) {
        return res.status(401).json({ msg: "Unauthorized. Access denied." });
    }
};

module.exports = authFunction;
