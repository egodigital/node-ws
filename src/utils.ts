import { Nilable, WebSocketData } from './contracts';

/**
 * Returns web socket data as buffer.
 *
 * @param {Nilable<WebSocketData>} data The input data.
 * 
 * @return {Nilable<Buffer>} The output data.
 */
export function asBuffer(data: Nilable<WebSocketData>): Nilable<Buffer> {
    if (isNil(data)) {
        return data as any;
    }

    return Buffer.isBuffer(data) ?
        data : Buffer.from(data as string, 'utf8');
}

/**
 * Checks, if a value is (null) or (undefined).
 *
 * @param {Nilable} val The value to check.
 * 
 * @return {boolean} Is (null) or (undefined).
 */
export function isNil(val: Nilable): boolean {
    return 'undefined' == typeof val ||
        null === val;
}

/**
 * Checks if a value is valid socket data.
 *
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is valid socket data or not.
 */
export function isValidSocketData(val: Nilable): val is WebSocketData {
    return Buffer.isBuffer(val) ||
        'string' === typeof val;
}
