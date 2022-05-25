const db = require("../db/database")
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const responseCode = require('../enum/responseCode')
const { addUserQuery, findUserByIdQuery, findUserByEmailQuery, updateFundsQuery } = require('../db/sqlFiles')


const findUser = (id) => {
    return db.one(findUserByIdQuery, [id])
}

const addUser = async (username, email, plainTextPassword) => {
    if (!username || !email || !plainTextPassword) {
        throw {status: responseCode.BAD_REQUEST, message: "Please provide all required fields"}
    }
    const user = await db.query(findUserByEmailQuery, [email])
    if (user.length > 0) {
        throw {status: responseCode.BAD_REQUEST, message: "Email already in use"}
    }
    const hashedPassword = await bcrypt.hash(plainTextPassword, parseInt(process.env.SALT_ROUNDS))
    const newUser = await db.one(addUserQuery, [username, email, hashedPassword, process.env.STARTING_AMOUNT])
    const id = newUser.id;
    delete newUser.password
    delete newUser.id
    return {token: generateToken(id), user: newUser}
}

const generateToken = (id) => {
    const expDate = new Date();
    expDate.setHours(expDate.getHours() + 6)
    return {token: jwt.sign({_id: id}, process.env.JWT_SECRET, {expiresIn: '6h'}), expiresAt: expDate.toUTCString()}
}

const loginUser = async (email, plainTextPassword) => {
    const user = await db.query(findUserByEmailQuery, [email])
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

const withdrawFunds = async (amountToWithdraw, userId) => {
    const { money } = await findUser(userId);
    if (money < amountToWithdraw) {
        throw {status: responseCode.BAD_REQUEST, message: "Insufficient funds"}
    }

    const newAmount = money - +amountToWithdraw;
    await db.query(updateFundsQuery, [newAmount, userId]);

    return newAmount;
}

const addFunds = async (amountToAdd, userId) => {
    const { money } = await findUser(userId);
    const newAmount = money + +amountToAdd;
    await db.query(updateFundsQuery, [newAmount, userId]);
    return newAmount;
}

module.exports = {
    findUser,
    addUser,
    generateToken,
    loginUser,
    withdrawFunds,
    addFunds
}