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

import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Disposable, Nilable, Predicate, WebSocketMessage, WebSocketServerKey } from '../contracts';
import { areBuffersEqual, asBuffer, isValidSocketData } from '../utils';
import { SimpleWebSocketClient } from '../client/SimpleWebSocketClient';

interface OnMessageHandlerItem {
    filter: Predicate<WebSocketMessage>;
    handler: SimpleWebSocketServerMessageHandler;
}

/**
 * A 'onMessage' handler context.
 */
export interface SimpleWebSocketServerMessageHandlerContext<TData extends any = any> {
    /**
     * The underlying client.
     */
    client: SimpleWebSocketClient;
    /**
     * The message.
     */
    message: WebSocketMessage<TData>;
}

/**
 * A handler for 'onMessage' method.
 * 
 * @param {SimpleWebSocketServerMessageHandlerContext<TData>} context The context.
 */
export type SimpleWebSocketServerMessageHandler<TData extends any = any>
    = (context: SimpleWebSocketServerMessageHandlerContext<TData>) => any;

/**
 * Options for SimpleWebSocketServer class.
 */
export interface SimpleWebSocketServerOptions {
    /**
     * Directly call 'init()' method or not. Default (false)
     */
    autoInit?: Nilable<boolean>;
    /**
     * The server key for authorization.
     */
    key?: Nilable<WebSocketServerKey>;
    /**
     * The underlying server instance.
     */
    server: WebSocket.Server;
}

/**
 * A simple web socket server instance.
 */
export class SimpleWebSocketServer extends EventEmitter {
    private _clients: SimpleWebSocketClient[] | undefined;
    private _onMessageHandlers: OnMessageHandlerItem[] | undefined;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {SimpleWebSocketServerOptions} options The options.
     */
    public constructor(public readonly options: SimpleWebSocketServerOptions) {
        super();

        if (options.autoInit) {
            this.init();
        }
    }

    /**
     * Closes the connection.
     */
    public close() {
        return new Promise((resolve, reject) => {
            try {
                this.options.server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Initializes that instance.
     */
    public init() {
        this._clients = [];
        this._onMessageHandlers = [];

        this.server.on('connection', (socket: WebSocket) => {
            let simpleClient: Nilable<SimpleWebSocketClient>;

            const REMOVE_FROM_LIST = () => {
                this._clients =
                    this._clients?.filter(c => c?.options.client !== socket);
            };

            const CLOSE = () => {
                REMOVE_FROM_LIST();

                socket.close();
            };

            const SEND_ERROR = async (err: any) => {
                let errData: any = err;
                if (errData instanceof Error) {
                    errData = {
                        name: errData.name,
                        message: errData.stack,
                        stack: errData.stack,
                    };
                }

                await (simpleClient as SimpleWebSocketClient).send('error', errData);
            };

            const SEND_OK = async (result?: Nilable) => {
                await (simpleClient as SimpleWebSocketClient).send('ok', result);
            };

            socket.once('close', () => {
                REMOVE_FROM_LIST();
            });

            socket.on('message', (data: WebSocket.Data) => {
                try {
                    if (simpleClient) {
                        if (!isValidSocketData(data)) {
                            CLOSE();
                            return;
                        }

                        const MSG: WebSocketMessage = JSON.parse((asBuffer(data) as Buffer).toString('utf8'));
                        if (!MSG) {
                            CLOSE();
                            return;
                        }

                        if ('string' !== typeof MSG.type) {
                            CLOSE();
                            return;
                        }

                        // handlers
                        for (const H of (this._onMessageHandlers as OnMessageHandlerItem[])) {
                            try {
                                if (!H.filter(MSG)) {
                                    continue;
                                }

                                const CTX: SimpleWebSocketServerMessageHandlerContext = {
                                    client: simpleClient as SimpleWebSocketClient,
                                    message: MSG,
                                };

                                // via handler
                                Promise.resolve(
                                    H.handler(CTX)
                                ).then(async (result?) => {
                                    try {
                                        await SEND_OK(result);
                                    } catch {
                                        CLOSE();
                                    }
                                }).catch(async (err) => {
                                    try {
                                        await SEND_ERROR(err);
                                    } catch {
                                        CLOSE();
                                    }
                                });
                            } catch (e) {
                                SEND_ERROR(e);
                                return;
                            }
                        }

                        // via event
                        (simpleClient as SimpleWebSocketClient).emit(
                            'message',
                            MSG, simpleClient, this,
                        );
                    } else {
                        // needs to be authorized

                        if (!isValidSocketData(data)) {
                            CLOSE();
                            return;
                        }

                        if (null !== this.key) {
                            // check for key

                            if (!areBuffersEqual(asBuffer(data) as Buffer, this.key)) {
                                CLOSE();  // key does not match
                                return;
                            }
                        }

                        simpleClient = new SimpleWebSocketClient({
                            autoInit: true,
                            client: socket,
                        });

                        (this._clients as SimpleWebSocketClient[])
                            .push(simpleClient);

                        // tell, we have a new connection here
                        this.emit('connection', simpleClient, this);
                    }
                } catch (e) {
                    CLOSE();
                }
            });
        });
    }

    /**
     * Gets the key as buffer.
     */
    public get key(): Buffer | null {
        if (this.options.key) {
            return Buffer.isBuffer(this.options.key) ?
                this.options.key : Buffer.from(this.options.key, 'utf8');
        }

        return null;
    }

    /**
     * Registers a message handler.
     *
     * @param {SimpleWebSocketServerMessageHandler<TData>} handler The handler to register.
     * @param {Nilable<Predicate<WebSocketMessage<TData>>>} [filter] The optional filter.
     * 
     * @return {Disposable} A context onbject, which can be used to unregister the handler.
     */
    public onMessage<TData extends any = any>(
        handler: SimpleWebSocketServerMessageHandler<TData>,
        filter?: Nilable<Predicate<WebSocketMessage<TData>>>
    ): Disposable {
        if (!filter) {
            filter = () => true;
        }

        const NEW_ITEM: OnMessageHandlerItem = {
            filter,
            handler,
        };

        (this._onMessageHandlers as OnMessageHandlerItem[])
            .push(NEW_ITEM);

        return {
            dispose: () => {
                this._onMessageHandlers =
                    (this._onMessageHandlers as OnMessageHandlerItem[]).filter(h => h !== NEW_ITEM);
            },
        };
    }

    /**
     * Gets the underlying server.
     */
    public get server(): WebSocket.Server {
        return this.options.server;
    }
}
