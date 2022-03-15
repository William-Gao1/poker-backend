const handler = (socket) => {
    socket.on('test', () => {
        console.log('test')
        socket.emit('message', "testing")
    })
}

module.exports = handler;