const express = require('express');
const userRouter = require('./router/userRouter');
const cors = require('cors')
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { socketAuth, connections } = require('./middleware/authMiddleware');
const { disconnect } = require('./services/disconnectService');
const io = new Server(server, {
    cors: {
        origin: process.env.FRONT_END_URL,
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: process.env.FRONT_END_URL
}))
app.use(express.json());
app.use('/user', userRouter);

io.use(socketAuth)

io.on('connection', (socket) => {

    socket.on('disconnect', () => {
        const alert = disconnect(socket.user.id);
        if (alert) {
            socket.to(alert.activeId).emit('player update', alert.players)
        }
        connections.delete(socket.user.id);
        console.log(`Disconnected. Active connections: ${connections.size}`);
    })

    require('./socket/test')(socket)
    require('./socket/rooms.js')(socket, io)
})

module.exports = server;