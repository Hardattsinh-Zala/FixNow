const prisma = require("../middlewares/prisma-filter");
const bcrypt = require("bcrypt");
const { setTokenCookies } = require("../utils/generateToken");

const register = async (req, res, next) => {
  try {
    const {
      name, email, phone, password,
      role = "CUSTOMER",
      providerName, address, city, pincode,
      openingTime = "08:00", closingTime = "20:00"
    } = req.body;

    const normalizedRole = role === "PROVIDER" || role === "SALON_OWNER" ? "PROVIDER" : "CUSTOMER";
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (exists) return res.status(409).json({ msg: "An account with this email or phone already exists." });

    const user = await prisma.user.create({
      data: {
        name, email, phone, password, role: normalizedRole,
        ...(normalizedRole === "PROVIDER"
          ? { provider: { create: {
              name: providerName || `${name}'s Services`,
              address: address || "",
              city: city || "",
              pincode: pincode || null,
              openingTime, closingTime
            }}}
          : { customer: { create: {} } })
      }
    });

    setTokenCookies(res, user);
    res.status(201).json({ msg: "Account created.", role: normalizedRole });
  } catch (error) { next(error); }
};

const login = async (req, res, next) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginId = identifier || email || phone;
    const user = await prisma.user.findFirst({ where: { OR: [{ email: loginId }, { phone: loginId }] } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ msg: "Wrong email or password." });
    }
    setTokenCookies(res, user);
    res.status(200).json({ msg: "Login successful", role: user.role });
  } catch (error) { next(error); }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies?.access_token;
    if (token) {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.decode(token);
      await prisma.blockedToken.upsert({
        where: { token },
        update: {},
        create: {
          token,
          expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 900000)
        }
      });
    }
  } catch {}
  res.clearCookie("access_token");
  res.clearCookie("refresh_token", { path: "/api/refresh" });
  res.status(200).json({ msg: "Logged out" });
};

module.exports = { register, login, logout };
