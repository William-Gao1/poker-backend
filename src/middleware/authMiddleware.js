const jwt = require('jsonwebtoken');
const responseCode = require('../enum/responseCode')
const {findUser} = require('../services/userService')

const auth = async (req, res, next) => {
    try{
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await findUser(decoded._id);
        if(!user[0]){
            throw new Error();
        }
        delete user[0].id;
        delete user[0].password;
        console.log(user)
        req.token = token;
        req.user = user[0];
        next();
    } catch (e) {
        res.status(responseCode.UNAUTHENTICATED).send({ error: "Please Authenticate" });
    }
}

module.exports = auth;