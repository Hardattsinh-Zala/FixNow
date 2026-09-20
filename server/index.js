require("dotenv").config();
const express = require("express");
const {PrismaClient} = require("@prisma/client");
const cookieParser = require("cookie-parser");
const prisma = new PrismaClient();
const app = express();
const http = require("http");
const authRouter = require("./routes/auth");
const userRouter = require("./routes/user");
const customerRouter = require("./routes/customer");
const providerRouter = require("./routes/provider");
const adminRouter = require("./routes/admin");
const publicProviderRouter = require("./routes/provider.public");
const uploadRouter = require("./routes/upload");
const broadcastRouter = require("./routes/broadcast");
const errorFunc = require("./middlewares/error-filter");
const cors = require("cors");
const { initSocket } = require("./sockets");

const allowedOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map(s => s.trim()) : []),
  "http://localhost:5173",
  "http://localhost:3000"
];

const corsOption = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
  credentials: true,
};

app.use(cors(corsOption));
app.use(express.json());
app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api/user", userRouter);
app.use("/api/customer", customerRouter);
app.use("/api/provider", providerRouter);
app.use("/api/admin", adminRouter);
app.use("/api/broadcast", broadcastRouter);
app.use("/api/providers", publicProviderRouter);
app.use("/api/upload", uploadRouter);

app.use(errorFunc);

const server = http.createServer(app);
initSocket(server);

// DB-backed broadcast scheduler; no Redis is required.
require("./workers/broadcast-worker");

const PORT = process.env.PORT || 8080;

const main = async () => {
    await prisma.$connect();
};

main()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
