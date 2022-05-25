const express = require('express');
const router = new express.Router();
const { auth } = require('../middleware/authMiddleware');
const { addUser, generateToken, loginUser } = require('../services/userService')
const responseCode = require('../enum/responseCode')
const { createRoom } = require('../services/roomService')
router.post('/', async (req, res) => {
    try {
        const {username, email, password} = req.body
        const {id} = await addUser(username, email, password)
        const token = generateToken(id)
        res.status(responseCode.CREATED).send({token})
    } catch (e) {
        console.log(e)
        res.status(e.status || 500).json(e)
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
    delete req.user.id;
    res.status(responseCode.OK).send(req.user)
})

router.post('/room', auth, async (req, res) => {
    try {
        const { bigBlind, smallBlind } = req.body
        const response = await createRoom(req.user.id, bigBlind, smallBlind)
        res.status(responseCode.OK).send(response)
    } catch (e) {
        console.log(e)
        res.status(e.status || 500).json(e)
    }
})

module.exports = router