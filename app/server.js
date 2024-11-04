'use strict';

const express = require('express');

const {helloWorldMessage, serverPort, serverHost} = require('./config')

// Constants
const PORT = serverPort;
const HOST = serverHost;

// App
const app = express();
app.get('/', (req, res) => {
  res.send(helloWorldMessage);
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);