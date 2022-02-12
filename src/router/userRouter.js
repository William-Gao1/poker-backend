const express = require('express');
const router = new express.Router();
const auth = require('../middleware/authMiddleware');
const { addUser, generateToken, loginUser } = require('../services/userService')
const responseCode = require('../enum/responseCode')

router.post('/', async (req, res) => {
    try {
        const {username, email, password} = req.body
        const {id} = await addUser(username, email, password)
        const token = generateToken(id)
        res.status(responseCode.CREATED).send({token})
    } catch (e) {
        console.log(e)
        res.status(responseCode.SERVER_ERROR).send(e)
    }
})

router.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body
        const response = await loginUser(email, password)
        res.status(responseCode.OK).send(response)
    } catch (e) {
        console.log(e)
        res.status(e.status || 500).json(e)
    }
})

router.get('/me', auth, async (req, res) => {
    res.status(responseCode.OK).send(req.user)
})

module.exports = router