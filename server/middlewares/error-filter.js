const errorFunc = (err, req, res, next) => {
    if (err.name === "ConflictError") {
        return res.status(err.statusCode).json({ msg: err.message });
    }
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    console.error(err);
    res.status(status).json({msg: message});
}

module.exports = errorFunc;