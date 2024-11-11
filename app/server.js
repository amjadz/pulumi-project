'use strict';

const express = require('express');
require('dotenv').config()

// const {helloWorldMessage, serverPort, serverHost} = require('./config')

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();
app.get('/', (req, res) => {
  res.send(process.env.HELLO_WORLD_MESSAGE);
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);