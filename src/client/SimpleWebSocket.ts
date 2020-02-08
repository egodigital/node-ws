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
import { Disposable, Nilable, Predicate, Url, WebSocketMessage, WebSocketServerKey } from '../contracts';
import { asBuffer, isNil, isValidSocketData } from '../utils';

interface OnMessageHandlerItem {
    filter: Predicate<WebSocketMessage>;
    handler: SimpleWebSocketMessageHandler;
}

/**
 * A 'onMessage' handler context.
 */
export interface SimpleWebSocketMessageHandlerContext<TData extends any = any> {
    /**
     * The message.
     */
    message: WebSocketMessage<TData>;
    /**
     * The underlying socket.
     */
    socket: SimpleWebSocket;
}

/**
 * A handler for 'onMessage' method.
 * 
 * @param {SimpleWebSocketMessageHandlerContext<TData>} context The context.
 */
export type SimpleWebSocketMessageHandler<TData extends any = any>
    = (context: SimpleWebSocketMessageHandlerContext<TData>) => any;

/**
 * Options for SimpleWebSocket class.
 */
export interface SimpleWebSocketOptions {
    /**
     * Directly call 'init()' method or not. Default (true)
     */
    autoInit?: Nilable<boolean>;
    /**
     * The underlying basic socket instance.
     */
    socket: WebSocket;
}

/**
 * A simple web socket instance.
 */
export class SimpleWebSocket extends EventEmitter {
    private _onMessageHandlers: OnMessageHandlerItem[] | undefined;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {SimpleWebSocketOptions} options The options.
     */
    public constructor(public readonly options: SimpleWebSocketOptions) {
        super();

        if (isNil(options.autoInit) || options.autoInit) {
            this.init();
        }
    }

    /**
     * Closes the connection.
     */
    public close() {
        return new Promise((resolve, reject) => {
            try {
                this.options.socket.close();

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Starts the connection.
     */
    public connect(key?: Nilable<WebSocketServerKey>) {
        return new Promise<void>((resolve, reject) => {
            try {
                this.options.socket.once('error', (err) => {
                    reject(err);
                });

                this.options.socket.once('open', () => {
                    try {
                        this.options.socket.send(key, (err) => {
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
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Creates and opens a new connection to a remote web socket host.
     *
     * @param {Url} url 
     * @param {Nilable<WebSocketServerKey>} [key] The optional key for the authentification.
     * 
     * @return {Promise<SimpleWebSocket>} The promise with the successful connected socket.
     */
    public static async connectTo(url: Url, key?: Nilable<WebSocketServerKey>): Promise<SimpleWebSocket> {
        const NEW_SOCKET = new SimpleWebSocket({
            socket: new WebSocket(url),
        });
        await NEW_SOCKET.connect(key);

        return NEW_SOCKET;
    }

    /**
     * Sends an error message.
     *
     * @param {any} err The error information. 
     */
    public error<TRef extends any = any>(err: any, ref?: Nilable<TRef>) {
        let errData: any = err;
        if (errData instanceof Error) {
            errData = {
                name: errData.name,
                message: errData.stack,
                stack: errData.stack,
            };
        } else {
            errData = String(errData);
        }

        return this.send('error', errData, ref);
    }

    /**
     * Creates a new instance from an URL.
     * 
     * @param {Url} url The URL.
     */
    public static fromUrl(url: Url): SimpleWebSocket {
        return new SimpleWebSocket({
            socket: new WebSocket(url),
        });
    }

    /**
     * Initializes that instance.
     */
    public init() {
        this._onMessageHandlers = [];

        this.options.socket.once('close', () => {
            this.emit('close', this);
        });

        const CLOSE = () => {
            try {
                this.close();
            } catch { }
        };

        this.options.socket.on('message', (data: WebSocket.Data) => {
            try {
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

                        const CTX: SimpleWebSocketMessageHandlerContext = {
                            message: MSG,
                            socket: this,
                        };

                        // via handler
                        Promise.resolve(
                            H.handler(CTX)
                        ).then(async (result?) => {
                            try {
                                await this.ok(result, MSG.ref);
                            } catch {
                                CLOSE();
                            }
                        }).catch(async (err) => {
                            try {
                                await this.error(err, MSG.ref);
                            } catch {
                                CLOSE();
                            }
                        });
                    } catch (e) {
                        this.error(e, MSG.ref)
                            .catch(() => CLOSE());

                        return;
                    }
                }

                // via event
                this.emit('message',
                    MSG, this,
                );
            } catch (e) {
                CLOSE();
            }
        });
    }

    /**
     * Sends an OK message.
     *
     * @param {Nilable<TData>} [data] The optional data to send.
     * @param {Nilable<TRef>} [ref] Reference data.
     */
    public ok<TData extends any = any, TRef extends any = any>(data?: Nilable<TData>, ref?: Nilable<TRef>) {
        return this.send('ok', data, ref);
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
        handler: SimpleWebSocketMessageHandler<TData>,
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
     * Sends data to the remote server.
     *
     * @param {string} type The type of the data.
     * @param {Nilable<TData>} [data] The optional data to send. 
     */
    public send<TData extends any = any, TRef extends any = any>(type: string, data?: Nilable<TData>, ref?: Nilable<TRef>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                const MSG: WebSocketMessage<TData> = {
                    type: String(type),
                    data,
                    ref,
                };

                this.options.socket.send(JSON.stringify(MSG), (err) => {
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
}
