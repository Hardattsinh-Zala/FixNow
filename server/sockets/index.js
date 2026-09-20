const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("../middlewares/prisma-filter");

let io;

/**
 * Minimal cookie-header parser — socket.io handshake requests aren't run
 * through Express's cookie-parser middleware, so we parse manually here.
 */
function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    for (const pair of cookieHeader.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        const key = pair.slice(0, idx).trim();
        const val = decodeURIComponent(pair.slice(idx + 1).trim());
        out[key] = val;
    }
    return out;
}

function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL
                ? process.env.CLIENT_URL.split(",")
                : ["http://localhost:5173", "http://localhost:3000"],
            credentials: true,
        },
    });

    // Auth middleware — reuses the same access_token cookie + JWT secret as
    // the Express auth-filter, so a logged-in browser session "just works"
    // as long as the client connects with `withCredentials: true`.
    io.use(async (socket, next) => {
        try {
            const cookies = parseCookies(socket.handshake.headers.cookie);
            const token = cookies.access_token;
            if (!token) return next(new Error("Auth token missing"));

            const blocked = await prisma.blockedToken.findUnique({ where: { token } });
            if (blocked) return next(new Error("Token has been revoked"));

            const decoded = jwt.verify(token, process.env.JWT);

            const userData = await prisma.user.findUnique({
                where: { email: decoded.email },
                omit: { password: true },
            });
            if (!userData) return next(new Error("User not found"));

            socket.userData = userData;
            next();
        } catch (err) {
            next(new Error("Invalid or expired auth token"));
        }
    });

    io.on("connection", (socket) => {
        const { id, role } = socket.userData;

        // Every user gets a personal room, keyed by role so salon-only and
        // customer-only broadcast events never cross wires even though both
        // use the same underlying User.id.
        if (role === "PROVIDER") {
            socket.join(`provider:${id}`);
        } else if (role === "CUSTOMER") {
            socket.join(`user:${id}`);
        }

        socket.on("disconnect", () => {
            // no-op for now — rooms are cleaned up automatically by socket.io
        });
    });

    return io;
}

function getIO() {
    if (!io) throw new Error("Socket.io not initialized — call initSocket first");
    return io;
}

module.exports = { initSocket, getIO };
