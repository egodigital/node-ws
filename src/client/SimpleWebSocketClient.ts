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
import { asBuffer, isValidSocketData } from '../utils';

interface OnMessageHandlerItem {
    filter: Predicate<WebSocketMessage>;
    handler: SimpleWebSocketClientMessageHandler;
}

/**
 * A 'onMessage' handler context.
 */
export interface SimpleWebSocketClientMessageHandlerContext<TData extends any = any> {
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
 * @param {SimpleWebSocketClientMessageHandlerContext<TData>} context The context.
 */
export type SimpleWebSocketClientMessageHandler<TData extends any = any>
    = (context: SimpleWebSocketClientMessageHandlerContext<TData>) => any;

/**
 * Options for SimpleWebSocketClient class.
 */
export interface SimpleWebSocketClientOptions {
    /**
     * Directly call 'init()' method or not. Default (false)
     */
    autoInit?: Nilable<boolean>;
    /**
     * The underlying client instance.
     */
    client: WebSocket;
}

/**
 * A simple web socket client instance.
 */
export class SimpleWebSocketClient extends EventEmitter {
    private _onMessageHandlers: OnMessageHandlerItem[] | undefined;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {SimpleWebSocketClientOptions} options The options.
     */
    public constructor(public readonly options: SimpleWebSocketClientOptions) {
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
                this.options.client.close();

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
                this.options.client.once('error', (err) => {
                    reject(err);
                });

                this.options.client.once('open', () => {
                    try {
                        this.options.client.send(key, (err) => {
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
     * Creates a new instance from an URL.
     * 
     * @param {Url} url The URL.
     */
    public static fromUrl(url: Url): SimpleWebSocketClient {
        return new SimpleWebSocketClient({
            client: new WebSocket(url),
        });
    }

    /**
     * Initializes that instance.
     */
    public init() {
        this._onMessageHandlers = [];

        const CLOSE = () => {
            this.close();
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

            await this.send('error', errData);
        };

        const SEND_OK = async (result?: Nilable) => {
            await this.send('ok', result);
        };

        this.options.client.on('message', (data: WebSocket.Data) => {
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

                        const CTX: SimpleWebSocketClientMessageHandlerContext = {
                            client: this,
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
                this.emit('message',
                    MSG, this,
                );
            } catch (e) {
                CLOSE();
            }
        });
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
        handler: SimpleWebSocketClientMessageHandler<TData>,
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
     * Sends data to the client.
     *
     * @param {string} type The type of the data.
     * @param {Nilable} [data] The optional data to send. 
     */
    public send<TData extends any = any>(type: string, data?: Nilable): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                const MSG: WebSocketMessage<TData> = {
                    type: String(type),
                    data,
                };

                this.options.client.send(JSON.stringify(MSG), (err) => {
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
