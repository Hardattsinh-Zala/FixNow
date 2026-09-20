function checkRole(allowedRole) {
    return (req, res, next) => {
        if(allowedRole !== req.userData.role) {
            return res.status(403).json({msg: "Forbidden. Access denied."});
        }
        next();
    };
}

module.exports = checkRole;