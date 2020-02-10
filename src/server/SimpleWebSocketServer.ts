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
import { areBuffersEqual, asBuffer, isNil, isValidSocketData } from '../utils';
import { SimpleWebSocket } from '../client/SimpleWebSocket';

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
    client: SimpleWebSocket;
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
     * Directly call 'init()' method or not. Default (true)
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
    private _clients: SimpleWebSocket[] | undefined;
    private _onMessageHandlers: OnMessageHandlerItem[] | undefined;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {SimpleWebSocketServerOptions} options The options.
     */
    public constructor(public readonly options: SimpleWebSocketServerOptions) {
        super();

        if (isNil(options.autoInit) || options.autoInit) {
            this.init();
        }
    }

    /**
     * Gets the list of clients.
     */
    public get clients(): Nilable<SimpleWebSocket[]> {
        return this._clients;
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
            let simpleClient: Nilable<SimpleWebSocket>;

            const REMOVE_FROM_LIST = () => {
                this._clients =
                    this._clients?.filter(c => c?.options.socket !== socket);
            };

            const CLOSE = () => {
                REMOVE_FROM_LIST();

                try {
                    socket.close();
                } catch { }
            };

            socket.once('close', () => {
                REMOVE_FROM_LIST();

                this.emit(
                    'close',
                    simpleClient, this,
                );
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
                                    client: simpleClient as SimpleWebSocket,
                                    message: MSG,
                                };

                                // via handler
                                Promise.resolve(
                                    H.handler(CTX)
                                ).then(async (result?) => {
                                    try {
                                        await (simpleClient as SimpleWebSocket).ok(result, MSG.ref);
                                    } catch {
                                        CLOSE();
                                    }
                                }).catch(async (err) => {
                                    try {
                                        await (simpleClient as SimpleWebSocket).error(err, MSG.ref);
                                    } catch {
                                        CLOSE();
                                    }
                                });
                            } catch (e) {
                                (simpleClient as SimpleWebSocket).error(e, MSG.ref)
                                    .catch(() => CLOSE());

                                return;
                            }
                        }

                        // via event
                        (simpleClient as SimpleWebSocket).emit(
                            'message',
                            MSG, simpleClient, this,
                        );
                    } else {
                        // needs to be authorized

                        const NEW_CLIENT = new SimpleWebSocket({
                            socket: socket,
                        });

                        if (!isValidSocketData(data)) {
                            CLOSE();
                            return;
                        }

                        if (null !== this.key) {
                            // check for key

                            if (!areBuffersEqual(asBuffer(data) as Buffer, this.key)) {
                                // key from remote does not match
                                NEW_CLIENT.send('auth_failed')
                                    .catch(() => { })
                                    .finally(() => CLOSE());

                                return;
                            }
                        }

                        simpleClient = NEW_CLIENT;

                        (this._clients as SimpleWebSocket[])
                            .push(simpleClient);

                        // tell, all is fine and we have a new connection here
                        simpleClient.ok()
                            .then(() => this.emit('connection', simpleClient, this))
                            .catch(() => CLOSE());
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
     * Sends data to all remote clients.
     *
     * @param {string} type The type of the data.
     * @param {Nilable<TData>} [data] The optional data to send.
     * @param {Nilable<TRef>} [ref] Reference data.
     */
    public async send<TData extends any = any, TRef extends any = any>(type: string, data?: Nilable<TData>, ref?: Nilable<TRef>): Promise<void> {
        await Promise.all(
            this.clients?.map(c => {
                return c.send.apply(c, [type, data, ref]);
            }) || []
        );
    }

    /**
     * Gets the underlying server.
     */
    public get server(): WebSocket.Server {
        return this.options.server;
    }
}
