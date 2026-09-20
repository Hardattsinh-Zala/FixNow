const getUser = (req, res, next) => {
    try {
        const userData = req.userData;
        res.status(200).json(userData);
    } catch (error) {
        next(error);
    }
}

module.exports = {getUser};