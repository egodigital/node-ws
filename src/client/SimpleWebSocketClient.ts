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

import * as WebSocketClient from 'ws';
import { EventEmitter } from 'events';
import { Nilable } from '../contracts';

/**
 * A simple web socket client instance.
 */
export class SimpleWebSocketClient extends EventEmitter {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {WebSocketClient} client The underlying basic web socket client instance.
     * @param {boolean} [autoInit] Directly call 'init()' method or not. Default: (false)
     */
    public constructor(public readonly client: WebSocketClient, autoInit?: Nilable<boolean>) {
        super();

        if (autoInit) {
            this.init();
        }
    }

    /**
     * Initializes that instance.
     */
    public init() {
    }
}
