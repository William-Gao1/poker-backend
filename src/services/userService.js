const db = require("../db/database")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const createSQLFile = require("../db/queryFile")
const responseCode = require('../enum/responseCode')

const addUserQuery = createSQLFile('addUser')
const findUserByIdQuery = createSQLFile('findUserById')
const findUserByEmail = createSQLFile('findUserByEmail')

const findUser = (id) => {
    return db.query(findUserByIdQuery, [id])
}

const addUser = async (username, email, plainTextPassword) => {
    const user = db.query(findUserByEmail)
    if (user.length > 0) {
        throw {status: responseCode.BAD_REQUEST, message: "Email already in use"}
    }
    const hashedPassword = await bcrypt.hash(plainTextPassword, parseInt(process.env.SALT_ROUNDS))
    return db.one(addUserQuery, [username, email, hashedPassword])
}

const generateToken = (id) => {
    const expDate = new Date();
    expDate.setHours(expDate.getHours() + 6)
    return {token: jwt.sign({_id: id}, process.env.JWT_SECRET, {expiresIn: '6h'}), expiresAt: expDate.toUTCString()}
}

const loginUser = async (email, plainTextPassword) => {
    const user = await db.query(findUserByEmail, [email])
    if (user.length == 0) {
        throw {status: responseCode.BAD_REQUEST, message: "Wrong email or password"}
    }
    const match = await bcrypt.compare(plainTextPassword, user[0].password)
    if (match) {
        const returnUser = user[0]
        const id = returnUser.id;
        delete returnUser.password
        delete returnUser.id
        return {token: generateToken(id), user: returnUser}
    } else {
        throw {status: responseCode.BAD_REQUEST, message: "Wrong email or password"}
    }
}

module.exports = {
    findUser,
    addUser,
    generateToken,
    loginUser
}