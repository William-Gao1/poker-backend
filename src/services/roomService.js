const numeral = require('numeral')
const Hand = require('pokersolver').Hand
const db = require("../db/database")
const responseCode = require('../enum/responseCode')
const shuffle = require('pandemonium/shuffle')
const userService = require('./userService')
const randomString = require('randomstring')
const roomStatus = require("../enum/roomStatus")
const action = require("../enum/action")
const { 
    findRoomByActiveIdQuery,
    createRoomQuery,
    findUserInRoomQuery,
    updatePlayersInRoomQuery,
    startRoundQuery,
    updateRoomStatusQuery,
    updateRoomQuery
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
    if(isNaN(bigBlind) || isNaN(smallBlind)) {
        throw {status: responseCode.BAD_REQUEST, message: 'Big blind and small blind are not valid integers'}
    } else if (+bigBlind < 0 || +smallBlind < 0) {
        throw {status: responseCode.BAD_REQUEST, message: 'Big blind and small blind are not positive integers'}
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
            playing: false,
            moneyBet: 0,
            allIn: false
        }
    }

    let activeId;
    let conflictRooms;
    do{
        activeId = randomString.generate({length: process.env.ACTIVE_ID_LENGTH, capitalization: "uppercase"})
        conflictRooms = await db.query(findRoomByActiveIdQuery, [activeId]);
    } while (conflictRooms.length > 0);
    console.log(4)
    const {status, big_blind, small_blind, max_players, action_max_time, id, active_id, pot, turn, community_cards, minimum_call} = await db.one(createRoomQuery, [shuffledDeck, roomStatus.WAITING, bigBlind, smallBlind, owner.id, players, activeId, actionMaxTime, maxPlayers, 1, buyIn])

    return {
        status: responseCode.CREATED, roomStatus: status, max_players, action_max_time, id, active_id, players, location: 0, pot, owner: owner.id, turn, communityCards: community_cards, big_blind, small_blind, actionMaxTime: action_max_time, minimumCall: minimum_call
    }
}

const addPlayerToRoom = async (user, activeId) => {
    if (!user || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: 'Please provide all required fields'}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room || (room.status != roomStatus.ACTIVE && room.status != roomStatus.WAITING)) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    const existingSeat = Object.keys(room.players).find((seat) => room.players[seat].id == user.id);
    if (existingSeat) {
        return {status: responseCode.OK, players: room.players, active_id: room.active_id, id: room.id, location: existingSeat, max_players: room.max_players, owner: room.owner, roomStatus: room.status, turn: room.turn, communityCards: room.community_cards, big_blind: room.big_blind, small_blind: room.small_blind, actionMaxTime: room.action_max_time, pot: room.pot, minimumCall: room.minimum_call};
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
        playing: false,
        moneyBet: 0,
        allIn: false
    }

    
    
    // find next spot in table
    let nextSpot = 0;
    while (takenSpots[nextSpot] == nextSpot) nextSpot++;

    existingPlayers[nextSpot] = newPlayer;

    await db.query(updatePlayersInRoomQuery, [existingPlayers, Object.keys(existingPlayers).length, room.id, room.owner])
    return {status: responseCode.OK, players: existingPlayers, active_id: room.active_id, id: room.id, location: nextSpot, max_players: room.max_players, pot: room.pot, owner: room.owner, roomStatus: room.status, turn: room.turn, communityCards: room.community_cards, big_blind: room.big_blind, small_blind: room.small_blind, actionMaxTime: room.action_max_time, minimumCall: room.minimum_call};
}

const startGame = async (ownerId, activeId) => {
    if (!ownerId || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: 'Please provide all required fields'}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if(!room.status === roomStatus.WAITING) {
        throw {status: responseCode.BAD_REQUEST, message: 'Game cannot be started'}
    }
    if (room.owner != ownerId) {
        throw {status: responseCode.UNAUTHORIZED, message: 'Only owner of room can start the game'}
    }

    const players = room.players;
    if (Object.keys(players).length < 2) {
        throw {status: responseCode.BAD_REQUEST, message: 'Must be at least two players to start the game'}
    }

    await startRound(room)
    const [updatedRoom] = await db.query(updateRoomStatusQuery, [roomStatus.ACTIVE, room.id])
    return {status: responseCode.OK, players: updatedRoom.players, active_id: updatedRoom.active_id, id: updatedRoom.id, max_players: updatedRoom.max_players, pot: updatedRoom.pot, owner: updatedRoom.owner, roomStatus: updatedRoom.status, turn: updatedRoom.turn, communityCards: updatedRoom.community_cards, big_blind: updatedRoom.big_blind, small_blind: updatedRoom.small_blind, actionMaxTime: updatedRoom.action_max_time, pot: updatedRoom.pot, minimumCall: updatedRoom.minimum_call, message: "Game started", messageType: "success"}
}

const startRound = async (room) => {
    const players = room.players;
    const shuffledDeck = shuffle(deck);
    let bigBlindIndex = -1, smallBlindIndex = -1
    Object.keys(players).forEach((position) => {
        players[position].hand = shuffledDeck.splice(0, 2)
        players[position].playing = true;
        players[position].moneyInPot = 0;
        players[position].action = null;
        players[position].actionAmount = 0;
        players[position].allIn = false;
        if(players[position].bigBlind) {
            bigBlindIndex = position;
        } else if (players[position.smallBlind]) {
            smallBlindIndex = position;
        }
    })

    // figure out the blinds
    if (bigBlindIndex == -1 || smallBlindIndex == -1) {
        // the first two players will be the blinds
        const tableOrder = Object.keys(players).map(x => +x).sort();
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
        room = await db.one(startRoundQuery, [players, room.small_blind + room.big_blind, nextPlayerIndex, room.big_blind, shuffledDeck, Date.now(), room.id])
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

        room = await db.one(startRoundQuery, [players, room.small_blind + room.big_blind, nextPlayer, room.big_blind, shuffledDeck, Date.now(), room.id])
    }
    return room
}

const findNextPlayerFrom = (players, index, isPlayingMatters = false, allInMatters = false) => {
    let positions = Object.keys(players).map(x => +x).sort()
    if (isPlayingMatters) {
        positions = positions.filter((position) => players[position].playing)
    }

    if (allInMatters) {
        positions = positions.filter((position) => !players[position].allIn)
    }
    const indexOfIndex = positions.findIndex(x => x===index);
    if (indexOfIndex == positions.length - 1) {
        return positions[0];
    } else {
        return positions[indexOfIndex + 1]
    }
}

const checkOrCall = async (id, activeId) => {
    if (!id || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: "Please provide requried fields"}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if(!(room.status == roomStatus.ACTIVE)) {
        throw {status: responseCode.BAD_REQUEST, message: 'Game has not started'}
    }

    const position = Object.keys(room.players).find(spot => room.players[spot].id === id)
    if (!position) {
        throw {status: responseCode.BAD_REQUEST, message: "Player is not in game"}
    }

    if(room.turn !== +position) {
        throw {status: responseCode.BAD_REQUEST, message: "It is not your turn"}
    }

    const newPlayers = room.players
    const player = room.players[position]
    const callAmount = room.minimum_call - player.moneyInPot
    if (callAmount > player.moneyRemaining) {
        newPlayers[position].allIn = true;
        newPlayers[position].moneyInPot += player.moneyRemaining;
        newPlayers[position].action = action.ALL_IN;
        newPlayers[position].actionAmount = player.moneyRemaining;
        room.pot += player.moneyRemaining;
    } else {
        newPlayers[position].moneyInPot += callAmount;
        newPlayers[position].action = action.CALL;
        newPlayers[position].actionAmount = callAmount;
        newPlayers[position].moneyRemaining -= callAmount;
        room.pot += callAmount;
    }

    const updatedRoom = await setNextTurn(room)
    await db.query(updateRoomQuery, [updatedRoom.deck, updatedRoom.pot, updatedRoom.players, updatedRoom.action_start_time, updatedRoom.turn, updatedRoom.community_cards, updatedRoom.minimum_call, updatedRoom.id]);
    return {status: responseCode.OK, players: updatedRoom.players, active_id: updatedRoom.active_id, id: updatedRoom.id, max_players: updatedRoom.max_players, pot: updatedRoom.pot, owner: updatedRoom.owner, roomStatus: updatedRoom.status, turn: updatedRoom.turn, communityCards: updatedRoom.community_cards, big_blind: updatedRoom.big_blind, small_blind: updatedRoom.small_blind, actionMaxTime: updatedRoom.action_max_time, pot: updatedRoom.pot, minimumCall: updatedRoom.minimum_call, message: updatedRoom.message || `${player.name} checks`, messageType: updatedRoom.messageType || "success", roundOver: updatedRoom.roundOver}
}

const setNextTurn  = async (room) => {
    const {players, turn: currentTurn, minimum_call: minimumCall, community_cards: communityCards} = room;
    const nextPlayer = findNextPlayerFrom(players, currentTurn, true, true);
    const playingPlayers = Object.keys(players).filter(playerIndex => players[playerIndex].playing).map(x => +x);
    if (playingPlayers.length == 1) {
        room.players[playingPlayers[0]].moneyRemaining += room.pot;
        room.roundOver = true;
        room.message = `${room.players[playingPlayers[0]].name} wins`
        room.messageType = 'success'
        return room;
    }
    const firstPlayer = Math.min(...playingPlayers);
    room.turn = nextPlayer;
    room.action_start_time = Date.now();

    if (nextPlayer == firstPlayer) {
        // check if everyone meets threshhold or is all in
        let shouldGoToNextTurn = true;
        Object.values(players).forEach(player => {
            if (player.playing && player.action !== action.ALL_IN && player.moneyInPot < minimumCall) {
                shouldGoToNextTurn = false;
            }
        })
        if (shouldGoToNextTurn === false) {
            return room;
        } else {
            if (!communityCards || communityCards.length === 0) {
                const flop = room.deck.splice(0, 3);
                room.community_cards = flop
                return room
            } else if (communityCards.length === 5) {
                // solve hand and distribute winnings
                const hands = Object.entries(players).filter(([seat, player]) => player.playing).map(([seat, player]) => [seat, Hand.solve(player.hand.concat(room.community_cards))])
                const winners = Hand.winners(hands.map(entry => entry[1]))
                const winningPlayers = hands.reduce((prev, current,index) => {
                    return winners.includes(hands[index][1]) ? prev.concat([index]): prev
                }, [])
                let winningMessage = "";
                winningPlayers.forEach(winnerIndex => {
                    room.players[hands[winnerIndex][0]].moneyRemaining += Math.floor(room.pot / winners.length);
                    winningMessage += `${room.players[hands[winnerIndex][0]].name} wins with ${hands[winnerIndex][1].name}. `
                })
                //room = await startRound(room)
                room.message = winningMessage;
                room.messageType = 'success';
                room.roundOver = true;
                room.turn = -1;
                return room
            } else {
                const nextCard = room.deck.splice(0, 1)
                room.community_cards = room.community_cards.concat(nextCard)
                return room
            }
        }
    }
    return room
}

const fold = async (id, activeId) => {
    if (!id || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: "Please provide requried fields"}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if(!(room.status == roomStatus.ACTIVE)) {
        throw {status: responseCode.BAD_REQUEST, message: 'Game has not started'}
    }

    const position = Object.keys(room.players).find(spot => room.players[spot].id === id)
    if (!position) {
        throw {status: responseCode.BAD_REQUEST, message: "Player is not in game"}
    }

    if(room.turn !== +position) {
        throw {status: responseCode.BAD_REQUEST, message: "It is not your turn"}
    }

    room.players[position].playing = false;
    room.players[position].hand = [];
    room.players[position].action = action.FOLD;
    const updatedRoom = await setNextTurn(room);
    await db.query(updateRoomQuery, [updatedRoom.deck, updatedRoom.pot, updatedRoom.players, updatedRoom.action_start_time, updatedRoom.turn, updatedRoom.community_cards, updatedRoom.minimum_call, updatedRoom.id]);
    return {status: responseCode.OK, players: updatedRoom.players, active_id: updatedRoom.active_id, id: updatedRoom.id, max_players: updatedRoom.max_players, pot: updatedRoom.pot, owner: updatedRoom.owner, roomStatus: updatedRoom.status, turn: updatedRoom.turn, communityCards: updatedRoom.community_cards, big_blind: updatedRoom.big_blind, small_blind: updatedRoom.small_blind, actionMaxTime: updatedRoom.action_max_time, pot: updatedRoom.pot, minimumCall: updatedRoom.minimum_call, message: updatedRoom.message || `${room.players[position].name} folds`, messageType: updatedRoom.messageType || "success", roundOver: updatedRoom.roundOver}
}

const bet = async (id, activeId, betAmount) => {
    if (!id || !activeId) {
        throw {status: responseCode.BAD_REQUEST, message: "Please provide requried fields"}
    }
    const [room] = await db.query(findRoomByActiveIdQuery, [activeId]);
    if (!room) {
        throw {status: responseCode.BAD_REQUEST, message: 'Room does not exist'}
    }
    if(!(room.status == roomStatus.ACTIVE)) {
        throw {status: responseCode.BAD_REQUEST, message: 'Game has not started'}
    }

    const position = Object.keys(room.players).find(spot => room.players[spot].id === id)
    if (!position) {
        throw {status: responseCode.BAD_REQUEST, message: "Player is not in game"}
    }

    if(room.turn !== +position) {
        throw {status: responseCode.BAD_REQUEST, message: "It is not your turn"}
    }

    if (betAmount >= room.players[position].moneyRemaining) {
        room.players[position].action = action.ALL_IN;
        room.players[position].allIn = true;
        room.players[position].moneyInPot += room.players[position].moneyRemaining;
        room.pot += room.players[position].moneyRemaining;
        room.minimum_call = Math.max(room.players[position].moneyInPot, room.minimum_call)
        room.players[position].moneyRemaining = 0;
    } else if (betAmount < room.minimumCall) {
        throw {status: responseCode.BAD_REQUEST, message: `You must bet at least $${room.minimum_call - betAmount}`}
    } else {
        room.players[position].action = action.RAISE;
        room.players[position].actionAmount = betAmount
        room.players[position].moneyInPot += betAmount;
        room.players[position].moneyRemaining -= betAmount;
        room.pot += betAmount;
        room.minimum_call = room.players[position].moneyInPot
    }

    const updatedRoom = await setNextTurn(room);
    await db.query(updateRoomQuery, [updatedRoom.deck, updatedRoom.pot, updatedRoom.players, updatedRoom.action_start_time, updatedRoom.turn, updatedRoom.community_cards, updatedRoom.minimum_call, updatedRoom.id]);
    return {status: responseCode.OK, players: updatedRoom.players, active_id: updatedRoom.active_id, id: updatedRoom.id, max_players: updatedRoom.max_players, pot: updatedRoom.pot, owner: updatedRoom.owner, roomStatus: updatedRoom.status, turn: updatedRoom.turn, communityCards: updatedRoom.community_cards, big_blind: updatedRoom.big_blind, small_blind: updatedRoom.small_blind, actionMaxTime: updatedRoom.action_max_time, pot: updatedRoom.pot, minimumCall: updatedRoom.minimum_call, message: updatedRoom.message || `${room.players[position].name} bets ${numeral(betAmount).format('($ 0[.]00 a)')}`, messageType: updatedRoom.messageType || "success", roundOver: updatedRoom.roundOver}
}

module.exports = {
    createRoom,
    addPlayerToRoom,
    startGame,
    checkOrCall,
    fold,
    bet,
    startRound
}