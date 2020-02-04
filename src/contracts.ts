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

import { Server as PlainHttpServer } from 'http';
import { Server as SecureHttpServer } from 'https';
import { Server as WebSocketServer, ServerOptions as WebSocketServerOptions } from 'ws';

/**
 * A HTTP(s) server innstance.
 */
export type HttpServer = PlainHttpServer | SecureHttpServer;

/**
 * A function, that creates or returns a HTTP(s) server instance.
 * 
 * @return {HttpServer} The new instance.
 */
export type HttpServerFactory = () => HttpServer;

/**
 * A type, that can be (null) or (undefined).
 */
export type Nilable<T extends any = any> = T | null | undefined;

/**
 * A function, that creates or returns a web socket server instance.
 * 
 * @return {WebSocketServer} The new instance.
 */
export type WebSocketServerFactory = (opts?: WebSocketServerOptions | undefined) => WebSocketServer;
