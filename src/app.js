const express = require('express');
const userRouter = require('./router/userRouter');
const cors = require('cors')

const app = express();

app.use(cors({
    origin: process.env.FRONT_END_URL
}))
app.use(express.json());
app.use('/user', userRouter);

module.exports = app;