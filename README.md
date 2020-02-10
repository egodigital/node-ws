[![npm](https://img.shields.io/npm/v/@egodigital/ws.svg)](https://www.npmjs.com/package/@egodigital/ws)

# node-ws

A simplfied library for [Node.js 10+](https://nodejs.org/docs/latest-v10.x/api/) for handling [WebSocket](https://en.wikipedia.org/wiki/WebSocket) connections, written in [TypeScript](https://www.typescriptlang.org/).

## Install

Execute the following command from your project folder, where your `package.json` file is stored:

```bash
npm install --save @egodigital/ws
```

## Usage

### With Express

You are able to share the same port with an [express](http://expressjs.com/) and web socket instance.

```typescript
import * as express from 'express';
import { SimpleWebSocket, withExpress } from '@egodigital/ws';

// ##### SERVER #####

// Express instance
const app = express();

// http://localhost:8080/
app.get('/', (req, res) => {
    return res.status(200)
        .send('Hello, from Express!');
});

// setup websocket server with Express app
const { server, listen } = await withExpress({
    app: app,
    key: 'ego',  // a string or buffer
                 // for authentication
});

// handle messages of type 'HelloEGO'
server.onMessage(async (ctx) => {
    console.log('server.onMessage', ctx.message);

    // optional data, which should be
    // send with OK message
    return 23979;
}, (msg) => 'HelloEGO' === msg.type);

// start listening on port 8080
await listen(8080);


// ##### CLIENT #####

// connect to local server
const client = SimpleWebSocket.fromUrl('ws://localhost:8080');

// handle messages of any type from server
client.onMessage((ctx) => {
    console.log('client.onMessage', ctx.message);
});

await client.connect('ego');  // same key as submitted to 'withExpress()'
                              // s.a.

// send message of type 'HelloEGO'
// and data 5979 to local server
await client.send('HelloEGO', 5979);
```

## Events

```typescript
// SimpleWebSocket
client.on('message', (msg, client) => {
    // handle message from remote server
});
client.on('close', () => {
    // connection with remote server has been closed
});

// SimpleWebSocketServer
server.on('connection', (client, server) => {
    // new connection with 'client'
});
server.on('message', (msg, client, server) => {
    // handle message from remote client
});
server.on('close', (client, server) => {
    // connection with remote client has been closed
});
```

## Documentation

The API documentation can be found [here](https://egodigital.github.io/ws/).
