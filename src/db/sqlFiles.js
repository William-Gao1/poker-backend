const createSQLFile = require("./queryFile")

const findUserInRoomQuery = createSQLFile('findUserInRoom')
const updatePlayersInRoomQuery = createSQLFile('updatePlayersInRoom')
const findRoomByActiveIdQuery = createSQLFile('findRoomByActiveId')
const createRoomQuery = createSQLFile('createRoom')
const startRoundQuery = createSQLFile('startRound')
const addUserQuery = createSQLFile('addUser')
const findUserByIdQuery = createSQLFile('findUserById')
const findUserByEmailQuery = createSQLFile('findUserByEmail')
const updateFundsQuery = createSQLFile('updateFunds')
const updateRoomStatusQuery = createSQLFile('updateRoomStatus')
const updateRoomQuery = createSQLFile('updateRoom')

module.exports = {
    findUserInRoomQuery,
    updatePlayersInRoomQuery,
    findRoomByActiveIdQuery,
    createRoomQuery,
    startRoundQuery,
    addUserQuery,
    findUserByIdQuery,
    findUserByEmailQuery,
    updateFundsQuery,
    updateRoomStatusQuery,
    updateRoomQuery
}