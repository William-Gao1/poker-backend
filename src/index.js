const app = require('./app.js');
const db = require('./db/database');
const port = process.env.PORT

app.listen(port, () => {
    console.log("Server connected on port " + port)
})