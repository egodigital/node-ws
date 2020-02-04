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
import { Nilable, Url, WebSocketMessage } from '../contracts';

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
    public connect() {
        return new Promise<void>((resolve, reject) => {
            try {
                this.options.client.once('error', (err) => {
                    reject(err);
                });

                this.options.client.once('open', () => {
                    resolve();
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
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}
