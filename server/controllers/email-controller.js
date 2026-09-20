const crypto = require('crypto');
const prisma  = require('../middlewares/prisma-filter');
const { sendPasswordResetEmail } = require('../utils/mailer');

/* ── POST /api/auth/forgot-password  body: { email } ───────────────────── */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const GENERIC = "If that email is registered, we've sent a reset link.";
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(200).json({ msg: GENERIC });

        const token  = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 h
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordResetToken: token, passwordResetExpiry: expiry },
        });
        await sendPasswordResetEmail(user.email, user.name, token);
        return res.status(200).json({ msg: GENERIC });
    } catch (err) { next(err); }
};

/* ── POST /api/auth/reset-password  body: { token, newPassword } ────────── */
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const user = await prisma.user.findFirst({
            where: { passwordResetToken: token, passwordResetExpiry: { gte: new Date() } },
        });
        if (!user) return res.status(400).json({ msg: 'Invalid or expired reset link.' });

        // Pass plain password — prisma-filter extension hashes it automatically on update
        await prisma.user.update({
            where: { id: user.id },
            data: { password: newPassword, passwordResetToken: null, passwordResetExpiry: null },
        });
        return res.status(200).json({ msg: 'Password reset successfully!' });
    } catch (err) { next(err); }
};

module.exports = { forgotPassword, resetPassword };
