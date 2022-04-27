const { disconnect } = require('../services/disconnectService')
const roomService = require('../services/roomService')

const handler = (socket, io) => {
    socket.on('create room', async ({bigBlind, smallBlind}, callback) => {
        try{
            const result = await roomService.createRoom(socket.user.id, bigBlind, smallBlind)
            console.log('room created: ', bigBlind, smallBlind, socket.user.id)
            socket.join(result.id)
            callback(result)
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
            }
        }
        
    })

    socket.on('join room', async (activeID, callback) => {
        try {
            const result = await roomService.addPlayerToRoom(socket.user, activeID)
            console.log('user added to room: ', socket.user.id, activeID)
            io.to(result.id).emit('player update', result.players)
            socket.join(result.id)
            callback(result)
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
            }
        }
    })

    socket.on('leave room', async () => {
        const alert = await disconnect(socket.user.id);
        if (alert) {
            socket.leave(alert.id)
            io.to(alert.id).emit('player update', alert.players)
        }
    })
}

module.exports = handler;