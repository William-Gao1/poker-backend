const { disconnect } = require('../services/disconnectService')
const roomService = require('../services/roomService')
const {connections} = require('../middleware/authMiddleware')

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
            io.to(result.id).emit('player update', {players: result.players})
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
            io.to(alert.id).emit('player update', alert)
        }
    })

    socket.on('start game', async (activeId, callback) => {
        try {
            let result = await roomService.startGame(socket.user.id, activeId)
            console.log('started game: ', socket.user.id, activeId)
            result = await updateRoom(io, result, socket.user.id)
            callback(result)
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
                io.to(socket.id).emit('display alert', {message: e.message, type: 'error'})
            }
        }
    })

    socket.on('check or call', async (activeId, callback) => {
        try {
            let result = await roomService.checkOrCall(socket.user.id, activeId)
            console.log('user checks or calls: ', socket.user.id, activeId)
            
            io.to(result.id).emit('display alert', {message: result.message, type: result.messageType})
            if (result.roundOver) {
                setTimeout(async (io, room, id) => {    
                    console.log(room)           
                    const newRoom = await roomService.startRound(room);
                    console.log('here')
                    updateRoom(io, newRoom, id)
                    console.log('here again')
                }, process.env.ROUND_DELAY, io, result, socket.user.id)
                io.to(result.id).emit('room update', result)
                io.to(result.id).emit('display alert', {message: `Next round starts in ${process.env.ROUND_DELAY/1000} seconds`, type: 'success'})
            } else {
                result = updateRoom(io, result, socket.user.id)
                callback(result)
            }
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
                io.to(socket.id).emit('display alert', {message: e.message, type: 'error'})
            }
        }
    })

    socket.on('fold', async (activeId, callback) => {
        try {
            let result = await roomService.fold(socket.user.id, activeId)
            console.log('user folds: ', socket.user.id, activeId)
            io.to(result.id).emit('display alert', {message: result.message, type: result.messageType})
            if (result.roundOver) {
                io.to(result.id).emit('room update', result)
                setTimeout(async (io, room, id) => {    
                    console.log(room)           
                    const newRoom = await roomService.startRound(room);
                    console.log('here')
                    updateRoom(io, newRoom, id)
                    console.log('here again')
                }, process.env.ROUND_DELAY, io, result, socket.user.id)
                io.to(result.id).emit('display alert', {message: `Next round starts in ${process.env.ROUND_DELAY/1000} seconds`, type: 'success'})
            } else {
                result = updateRoom(io, result, socket.user.id)
                callback(result)
            }
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
                io.to(socket.id).emit('display alert', {message: e.message, type: 'error'})
            }
        }
    })

    socket.on('bet', async ({activeId, amount}, callback) => {
        try {
            let result = await roomService.bet(socket.user.id, activeId, amount)
            console.log('user bets: ', socket.user.id, activeId, amount)
            result = updateRoom(io, result, socket.user.id)
            callback(result)
            io.to(result.id).emit('display alert', {message: result.message, type: result.messageType})
            if (result.roundOver) {
                setTimeout(async (io, room, id) => {    
                    console.log(room)           
                    const newRoom = await roomService.startRound(room);
                    console.log('here')
                    updateRoom(io, newRoom, id)
                    console.log('here again')
                }, process.env.ROUND_DELAY, io, result, socket.user.id)
                io.to(result.id).emit('room update', result)
                io.to(result.id).emit('display alert', {message: `Next round starts in ${process.env.ROUND_DELAY/1000} seconds`, type: 'success'})
            }
        } catch (e) {
            console.log(e)
            if (callback) {
                callback(e)
                io.to(socket.id).emit('display alert', {message: e.message, type: 'error'})
            }
        }
    })
}

const updateRoom = (io, room, callbackId) => {
    const hands = new Map();
    Object.keys(room.players).forEach(playerIndex => {
        hands.set(room.players[playerIndex].id, room.players[playerIndex].hand);
        room.players[playerIndex].hand = ['?x', '?x'];
    });

    Object.keys(room.players).forEach(playerIndex => {
        room.players[playerIndex].hand = hands.get(room.players[playerIndex].id);
        io.to(connections.get(room.players[playerIndex].id)).emit('room update', room);
        room.players[playerIndex].hand = ['?x', '?x'];
    })
    Object.keys(room.players).forEach(playerIndex => {
        if (room.players[playerIndex].id == callbackId) {
            room.players[playerIndex].hand = hands.get(callbackId);
        }
    })
    return room;
}

module.exports = handler;