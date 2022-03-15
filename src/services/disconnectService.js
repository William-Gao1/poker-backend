const db = require("../db/database")
const createSQLFile = require("../db/queryFile")
const responseCode = require('../enum/responseCode')
const userService = require('./userService')
const { findUserInRoomQuery, updatePlayersInRoomQuery, updateRoomStatusQuery } = require('../db/sqlFiles')
const roomStatus = require("../enum/roomStatus")


const disconnect = async (userId) => {
    
    const [room] = await db.query(findUserInRoomQuery, [userId])
    if (!room) return;
    const players = room.players
    if (room) {
        const index = Object.keys(players).find((key) => players[key].id == userId)
        userService.addFunds(players[index].moneyRemaining, userId)
        delete players[index]
        if (Object.keys(players).length == 0) {
            db.query(updateRoomStatusQuery, [roomStatus.DONE, room.id])
        }
        db.query(updatePlayersInRoomQuery, [players, Object.keys(players).length, room.id])
        return {activeId: room.active_id, players}
    }

    
}

module.exports = {
    disconnect
}