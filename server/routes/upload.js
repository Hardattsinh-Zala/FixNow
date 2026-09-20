const express = require('express');
const router = express.Router();
const multer = require('multer');
const authFilter = require('../middlewares/auth-filter');
const { uploadImage } = require('../controllers/upload-controller');

// Use memory storage — no temp files, pipe buffer straight to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, and WebP images are allowed'));
        }
    },
});

// POST /api/upload  — protected, any logged-in role
router.post('/', authFilter, upload.single('image'), uploadImage);

module.exports = router;
