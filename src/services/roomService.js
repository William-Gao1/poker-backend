const db = require("../db/database")
const createSQLFile = require("../db/queryFile")
const responseCode = require('../enum/responseCode')
const shuffle = require('pandemonium/shuffle')
const userService = require('./userService')
const randomString = require('randomstring')
const roomStatus = require("../enum/roomStatus")
const { 
    findRoomByActiveIdQuery,
    createRoomQuery,
    findUserInRoomQuery,
    updatePlayersInRoomQuery,
    startRoundQuery
} = require('../db/sqlFiles')

const deck = [
    'As', 'Ah', 'Ac', 'Ad',
    '2s', '2h', '2c', '2d',
    '3s', '3h', '3c', '3d',
    '4s', '4h', '4c', '4d',
    '5s', '5h', '5c', '5d',
    '6s', '6h', '6c', '6d',
    '7s', '7h', '7c', '7d',
    '8s', '8h', '8c', '8d',
    '9s', '9h', '9c', '9d',
    'Ts', 'Th', 'Tc', 'Td',
    'Js', 'Jh', 'Jc', 'Jd',
    'Qs', 'Qh', 'Qc', 'Qd',
    'Ks', 'Kh', 'Kc', 'Kd',
]


const isUserInGame = async (id) => {
    const ids = await db.query(findUserInRoomQuery, [id])
    return ids.length > 0
}

const createRoom = async (ownerId, bigBlind, smallBlind, buyIn = process.env.DEFAULT_BUY_IN, maxPlayers = process.env.DEFAULT_MAX_PLAYERS, actionMaxTime = process.env.DEFAULT_ACTION_MAX_TIME) => {
    if (!ownerId || !bigBlind || !smallBlind) {
        throw {status: responseCode.BAD_REQUEST, message: 'Please provide all required fields'}
    }
    if (await isUserInGame(ownerId)) {
        throw {status: responseCode.BAD_REQUEST, message: 'User is already in a game'}
    }
    const owner = await userService.findUser(ownerId);
    if (!owner) {
        throw {status: responseCode.BAD_REQUEST, message: 'Owner not found'}
    }
    userService.withdrawFunds(buyIn, ownerId)
    const shuffledDeck = shuffle(deck);
    const players = {
        0: {
            id: owner.id,
            name: owner.username,
            action: null,
            actionAmount: null,
            moneyRemaining: buyIn,
            hand: [],
            moneyInPot: 0,
            bigBlind: false,
            smallBlind: false,
            playing: false
        }
    }

    let activeId;
    let conflictRooms;
    do{
        activeId = randomString.generate({length: process.env.ACTIVE_ID_LENGTH, capitalization: "uppercase"})
        conflictRooms = await db.query(findRoomByActiveIdQuery, [activeId]);
    } while (conflictRooms.length > 0);
    
    const {status, big_blind, small_blind, max_players, action_max_time, id, active_id} = await db.one(createRoomQuery, [shuffledDeck, roomStatus.WAITING, bigBlind, smallBlind, owner.id, players, activeId, actionMaxTime, maxPlayers, 1, buyIn])

    return {
        status: responseCode.CREATED, roomStatus: status, big_blind, small_blind, max_players, action_max_time, id, active_id
    }
}

const addPlayerToRoom = async (user, activeId) => {
    if (!user || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: 'Please provide all required fields'}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room || room.status != roomStatus.ACTIVE || room.status != roomStatus.WAITING) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if (Object.values(room.players).find(({id}) => id == user.id)) {
        return {status: responseCode.OK, players: room.players, active_id: room.active_id, id: room.id};
    }
    if (await isUserInGame(user.id)) {
        throw {status: responseCode.BAD_REQUEST, message: 'User is already in a game'}
    }

    
    const existingPlayers = room.players;
    const takenSpots = Object.keys(existingPlayers).map(x => +x);
    if (takenSpots.length == room.max_players) throw {status: responseCode.BAD_REQUEST, message: "Room is full"}

    userService.withdrawFunds(room.buy_in, user.id)

    const newPlayer = {
        id: user.id,
        name: user.username,
        action: null,
        actionAmount: null,
        moneyRemaining: room.buy_in,
        hand: [],
        moneyInPot: 0,
        bigBlind: false,
        smallBlind: false,
        playing: false
    }

    
    
    // find next spot in table
    let nextSpot = 0;
    while (takenSpots[nextSpot] == nextSpot) nextSpot++;

    existingPlayers[nextSpot] = newPlayer;

    await db.query(updatePlayersInRoomQuery, [existingPlayers, Object.keys(existingPlayers).length, room.id])
    
    return {status: responseCode.OK, players: existingPlayers, active_id: room.active_id, id: room.id};
}

const startGame = async (ownerId, activeId) => {
    if (!user || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: 'Please provide all required fields'}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if (room.owner != ownerId) {
        throw {status: responseCode.UNAUTHORIZED, message: 'Only owner of room can start the game'}
    }

    const players = room.players;
    if (Object.keys(players).length < 2) {
        throw {status: responseCode.BAD_REQUEST, message: 'Must be at least two players to start the game'}
    }

    startRound(room)

}

const startRound = async (room) => {
    const players = room.players;
    const deck = room.deck;
    const bigBlindIndex = -1, smallBlindIndex = -1
    Object.keys(players).forEach((position) => {
        players[position].hand = [deck.pop(), deck.pop()]
        players[position].playing = true;
        if(players[position].bigBlind) {
            bigBlindIndex = position;
        } else if (players[position.smallBlind]) {
            smallBlindIndex = position;
        }
    })

    // figure out the blinds
    if (bigBlindIndex == -1 || smallBlindIndex == -1) {
        // the first two players will be the blinds
        const tableOrder = Object.keys(bigBlindIndex).map(x => +x).sort();
        players[tableOrder[0]].smallBlind = true;
        players[tableOrder[1]].bigBlind = true;
        players[tableOrder[0]].moneyInPot = room.small_blind;
        players[tableOrder[1]].moneyInPot = room.big_blind;
        players[tableOrder[0]].moneyRemaining -= room.small_blind;
        players[tableOrder[1]].moneyRemaining -= room.big_blind;
        let nextPlayerIndex = -1;
        if (tableOrder.length == 2) {
            nextPlayerIndex = tableOrder[0]
        } else {
            nextPlayerIndex = tableOrder[2]
        }
        await db.query(startRoundQuery, [players, room.small_blind + room.big_blind, nextPlayerIndex, room.id])
    } else {
        const nextBigBlind = findNextPlayerFrom(players, bigBlindIndex);
        const nextSmallBlind = findNextPlayerFrom(players, smallBlindIndex);
        players[bigBlindIndex].bigBlind = false;
        players[smallBlindIndex].smallBlind = false;
        players[nextSmallBlind].smallBlind = true;
        players[nextBigBlind].bigBlind = true;
        players[nextSmallBlind].moneyInPot = room.small_blind;
        players[nextBigBlind].moneyInPot = room.big_blind;
        players[nextSmallBlind].moneyRemaining -= room.small_blind;
        players[nextBigBlind].moneyRemaining -= room.big_blind;
        const nextPlayer = findNextPlayerFrom(players, nextBigBlind);

        await db.query(startRoundQuery, [players, room.small_blind + room.big_blind, nextPlayer, room.id])
    }
}

const findNextPlayerFrom = (players, index, isPlayingMatters = false) => {
    const positions = Object.keys(players).map(x => +x).sort()
    if (isPlayingMatters) {
        positions.filter((position) => players[position].isPlaying)
    }

    const indexOfIndex = positions.find(x => x==index);
    if (indexOfIndex == positions.length) {
        return positions[0];
    } else {
        return positions[indexOfIndex]
    }
}

module.exports = {
    createRoom,
    addPlayerToRoom,
    startGame
}