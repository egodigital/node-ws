/**
 * This file is part of the node-ws distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * node-ws is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * node-ws is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { createServer as createHttpServer } from 'http';
import { Server as WebSocketServer, ServerOptions as WebSocketServerOptions } from 'ws';
import { Express } from 'express';
import { HttpServer, HttpServerFactory, Nilable, WebSocketServerFactory, WebSocketServerKey } from './contracts';
import { SimpleWebSocketServer } from './server/SimpleWebSocketServer';

/**
 * Options for 'withExpress()' function.
 */
export interface WithExpressOptions<TApp extends Express = Express> {
    /**
     * The underlying app.
     */
    app: TApp;
    /**
     * Auto initialize web socket server or not. Default: (true)
     */
    autoInit?: Nilable<boolean>;
    /**
     * The server key for authentication.
     */
    key?: Nilable<WebSocketServerKey>;
    /**
     * HTTP (server) options.
     */
    http?: Nilable<{
        /**
         * A custom factory, that creates or returns a HTTP server instance.
         */
        factory?: Nilable<HttpServerFactory>;
    }>;
    /**
     * Web socket (server) options.
     */
    webSocket?: Nilable<{
        /**
         * A custom factory, that creates or returns a web socket server instance.
         */
        factory?: Nilable<WebSocketServerFactory>;
        /**
         * Custom options for the web socket server.
        */
        options?: WebSocketServerOptions | undefined;
    }>;
}

/**
 * Result of a 'withExpress()' function.
 */
export interface WithExpressResult<TApp extends Express = Express> {
    /**
     * The underlying Express instance.
     */
    app: Express;
    /**
     * The HTTP server instance.
     */
    http: HttpServer;
    /**
     * Starts listening on a port.
     * 
     * @param {number} port The custom port. Default: 80
     */
    listen: (port?: number) => Promise<void>;
    /**
     * The (simple) web socket server instance.
     */
    server: SimpleWebSocketServer;
}

/**
 * Sets up an Express instance with a web socket host, so they can listen on the same port(s).
 *
 * @param {WithExpressOptions<TApp>} opts Options.
 * 
 * @return {WithExpressResult<TApp>} The result of that function.
 */
export function withExpress<TApp extends Express = Express>(opts: WithExpressOptions<TApp>): WithExpressResult<TApp> {
    let httpServer: HttpServer;
    let wsServer: WebSocketServer;

    let httpServerFactory = opts.http?.factory;
    if (!httpServerFactory) {
        httpServerFactory = () => createHttpServer();
    }

    let webSocketServerFactory = opts.webSocket?.factory;
    if (!webSocketServerFactory) {
        webSocketServerFactory = (opts) => new WebSocketServer(Object.assign({
            server: httpServer,
        }, opts || {}));
    }

    httpServer = httpServerFactory();
    httpServer.on('request', opts.app);

    wsServer = webSocketServerFactory(opts.webSocket?.options);

    return {
        app: opts.app,
        http: httpServer,
        listen: function (port?: number) {
            if (arguments.length < 1) {
                port = 80;
            }

            return new Promise<void>((resolve, reject) => {
                try {
                    httpServer.listen(port, () => {
                        resolve();
                    });
                } catch (e) {
                    reject(e);
                }
            });
        },
        server: new SimpleWebSocketServer({
            autoInit: opts.autoInit,
            key: opts.key,
            server: wsServer,
        }),
    };
}

export * from './client/SimpleWebSocket';
export * from './server/SimpleWebSocketServer';
