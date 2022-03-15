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
            console.log(socket.user, activeID)
            const result = await roomService.addPlayerToRoom(socket.user, activeID)
            console.log('user added to room: ', socket.user.id, activeID)
            socket.join(result.id)
            io.to(result.id).emit('message', "hello")
            callback(result)
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
            }
        }
    })
}

module.exports = handler;