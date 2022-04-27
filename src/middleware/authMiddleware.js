const jwt = require('jsonwebtoken');
const responseCode = require('../enum/responseCode')
const {findUser} = require('../services/userService')

const connections = new Map()

const auth = async (req, res, next) => {
    try{
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await findUser(decoded._id);
        if(!user){
            res.status(responseCode.UNAUTHENTICATED).send({ error: "Please Authenticate" });
        }
        delete user.password;
        req.token = token;
        req.user = user;
        next();
    } catch (e) {
        res.status(responseCode.UNAUTHENTICATED).send({ error: "Please Authenticate" });
    }
}

const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.headers.auth || socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await findUser(decoded._id);
        if (!user) {
            const err = new Error("Auth Failed")
            next(err);
        }
        if (connections.get(user.id)) {
            const err = new Error("You are already connected at another location")
            next(err);
        }
        delete user.password;
        socket.user = user;
        connections.set(user.id, socket.id)
        console.log(`${user.username} Connected. Active connections: ${connections.size}`)
        next();
    } catch (e) {
        const err = new Error("Auth Failed")
        next(err);
    }
}

module.exports = {
    auth,
    socketAuth,
    connections
}