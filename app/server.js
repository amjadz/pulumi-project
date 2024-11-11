'use strict';

const express = require('express');
require('dotenv').config()

// const {helloWorldMessage, serverPort, serverHost} = require('./config')

// Constants
const PORT = serverPort;
const HOST = serverHost;

// App
const app = express();
app.get('/', (req, res) => {
  res.send(process.env.HELLO_WORLD_MESSAGE);
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);