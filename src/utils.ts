import { Nilable, WebSocketData } from './contracts';


/**
 * Checks if the contents of two buffers are equal.
 *
 * @param {Nilable<Buffer>} x The first buffer.
 * @param {Nilable<Buffer>} y The sencond buffer.
 * 
 * @return {boolean} Are equal or not.
 */
export function areBuffersEqual(x: Nilable<Buffer>, y: Nilable<Buffer>): boolean {
    if (x === y) {
        return true;
    }

    if (x && y) {
        const LEN_X = x.length;

        if (LEN_X !== y.length) {
            return false;  // unique sizes
        }

        for (let i = 0; i < LEN_X; i++) {
            if (x.readUInt8(i) !== y.readUInt8(i)) {
                return false;  // different data
            }
        }

        return true;
    }

    return false;
}


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
