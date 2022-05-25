const db = require("../db/database")
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
        const playerIndicies = Object.keys(players)
        let newRoomStatus;
        let owner = room.owner
        if (playerIndicies.length == 0) {
            db.query(updateRoomStatusQuery, [roomStatus.DONE, room.id])
            newRoomStatus = roomStatus.DONE
        } else if (playerIndicies.length == 1) {
            console.log(players, room)
            players[playerIndicies[0]].moneyRemaining += room.pot;
            console.log(players)
            db.query(updateRoomStatusQuery, [roomStatus.WAITING, room.id])
            newRoomStatus = roomStatus.WAITING
            owner = players[playerIndicies[0]].id;
        }
        await db.query(updatePlayersInRoomQuery, [players, Object.keys(players).length, room.id, owner])
        console.log(`user removed from room: ${userId} ${room.active_id}`)
        return { id: room.id, players, roomStatus: newRoomStatus, owner }
    }


}

module.exports = {
    disconnect
}