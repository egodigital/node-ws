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

You are able to share the same port with and [express](http://expressjs.com/) and a web socket instance.

```typescript
import * as express from 'express';
import { SimpleWebSocket, withExpress } from '@egodigital/ws';

// Express instance
const app = express();

// http://localhost:8080/
app.get('/', (req, res) => {
    return res.status(200)
        .send('Hello, from Express!');
});

// setup websocket server with Express app
const SERVER = await withExpress({
    app: app,
    key: 'ego',  // a string or buffer
                 // for authentication
});

// handle messages of type 'HelloEGO'
SERVER.onMessage(async (ctx) => {
    console.log('SERVER.onMessage', ctx.message);

    // optional data, which should be
    // send with OK message
    return 23979;
}, (msg) => 'HelloEGO' === msg.type);

// start listening on port 8080
await SERVER.listen(8080);

setTimeout(() => {
    // connect to local server
    const CLIENT = SimpleWebSocket.fromUrl('ws://localhost:8080');

    // handle messages of any type from server
    CLIENT.onMessage((ctx) => {
        console.log('CLIENT.onMessage', ctx.message);
    });

    await CLIENT.connect('ego');  // same as submitted to 'withExpress()'
                                  // s.a.

    // send message of type 'HelloEGO'
    // and data 5979 to local server
    await CLIENT.send('HelloEGO', 5979);
}, 5000);
```

## Events

```typescript
// SimpleWebSocket
CLIENT.on('message', (msg) => {
    // handle message from remote server
});
CLIENT.on('close', () => {
    // connection with remote server has been closed
});

// SimpleWebSocketServer
SERVER.on('connection', (client, server) => {
    // handle message from remote client
});
SERVER.on('message', (msg, client, server) => {
    // handle message from remote client
});
SERVER.on('close', (client, server) => {
    // connection with remote client has been closed
});
```

## Documentation

The API documentation can be found [here](https://egodigital.github.io/ws/).
