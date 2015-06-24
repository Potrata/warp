'use strict';

import {generateStringId} from './util';
import EventEmitter from 'events';

let _hubs = new Map();
/**
 * @desc Extended version of classic EventEmitter
 * @class
 */
class Hub extends EventEmitter {
  constructor(key, config) {
    super();
    Object.assign(this, config);
    this.key = key;
  }

  createMessage(source, msg, data = {}) {
    let _message = {
      header: {
        correlationId: generateStringId(8, 4),
        source,
        msg,
        created: Date.now()
      },
      body: {
        data
      }
    };
    return this.emit(msg, _message);
  }

  createRequest(source, msg, data) {
    let _message = this.createMessage(source, msg, data);
    return {
      send: (timeout = 0) => {
        return this.request(msg, _message, timeout)
      }
    };
  }

  /**
   * @desc Emits an event (asynchronously)
   * @param {String} msg
   * @param {*} [args]
   * @return {Promise}
   */
  emit(msg, ...args) {
    return new Promise(resolve => process.nextTick(() => {
      resolve(super.emit(msg, ...args));
    }));
  }

  /**
   * @desc Subscribes to event with given callback
   * @param {String} msg
   * @param {function} cb
   * @return {EventEmitter}
   */
  on(msg, cb) {
    return super.on(msg, cb);
  }

  /**
   * @desc Subscribes to event with given callback, and unsubscribes once it fired
   * @param {String} msg
   * @param {function} cb
   * @return {EventEmitter}
   */
  once(msg, cb) {
    return super.once(msg, cb);
  }

  /**
   * @desc Unsubscribes of event with given callback
   * @param {String} msg
   * @param {function} cb
   * @return {Number}
   */
  off(msg, cb) {
    return super.removeListener(msg, cb);
  }

  /**
   * @desc Returns promise, resolved later by event with message given, or rejected by timeout.
   * @param {String} msg
   * @param {Number} [timeout = 0]
   * @return {Promise}
   */
  wait(msg, timeout = 0) {
    timeout = parseInt(timeout);

    return new Promise((resolve, reject) => {
      let _timer;

      function _handleFn(...args) {
        if (_timer > 0) {
          clearTimeout(_timer)
        }
        return resolve(...args);
      }

      _timer = (timeout > 0) ? setTimeout(() => {
        this.off(msg, _handleFn);
        reject(`timed out`);
      }, timeout) : null;
      this.once(msg, _handleFn);
    });
  }

  /**
   * @desc Returns promise, resolved only when all events are triggered, or rejected by timeout.
   * @param {Array<String>} messages
   * @param {Number} [timeout = 0]
   * @return {Promise}
   */
  waitAll(messages, timeout = 0) {
    if (isString(messages)) {
      messages = [messages]
    }

    timeout = parseInt(timeout);

    let removeListeners = _handlers =>
      _handlers.forEach(handler =>
        this.off.apply(this, handler));

    let executor = (resolve, reject) => {
      let _handlers = [];
      let _timer = (timeout > 0) ? setTimeout(() => {
        removeListeners(_handlers);
        reject(`timed out`);
      }, timeout) : null;

      let promises = messages.map(msg =>
        new Promise(resolveOne => {
            _handlers.push([msg, resolveOne]);
            this.once(msg, resolveOne);
          }
        ));

      Promise.all(promises)
        .then((data) => {
          if (_timer) {
            clearTimeout(_timer);
          }
          return data;
        }).then(resolve);
    };

    return new Promise(executor);
  }

  /**
   * Returns promise resolved by replyFn (wrapped within request handler last argument) on subscriber's side,
   * or rejected by timeout
   * @param {String|Number} msg
   * @param {*} [data]
   * @param {Number} [timeout = 0]
   * @return {Promise}
   */
  request(msg, data, timeout) {
    this.emit(msg, data).then(numListeners => {
      if (numListeners === 0) {
        return Promise.reject(`nobody listening to ${msg}, aborting request`);
      }
      return numListeners;
    }).then(() => this.wait(`reply::${msg.header.correlationId}`, timeout))
      .then((err, data) => {
        if (err) {
          return Promise.reject(err);
        }
        return data;
      });
  }
}

export default function(key = generateStringId(), config = {}) {
  if (!_hubs.has(key)) {
    _hubs.set(key, new Hub(key, config));
  }
  return _hubs.get(key);
}
