const cloudinary = require('../utils/cloudinary');

const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file provided' });
        }

        // Upload buffer directly to Cloudinary using upload_stream
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'worker-platform',
                    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        return res.status(200).json({ url: result.secure_url });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        next(error);
    }
};

module.exports = { uploadImage };
