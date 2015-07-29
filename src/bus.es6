import debug from 'debug';
import EventEmitter from 'events';
import co from 'co';
import {random} from './utils';

class Bus extends EventEmitter {
  static formatReplyEvent(correlationId) {
    return `reply::${correlationId}`;
  }

  constructor() {
    super();
    this.debug = debug('bus');
    this._managedHandlers = new Map();
  }

  /**
   * @desc Emits an event (asynchronously)
   * @param {String} event
   * @param {*} [args]
   * @return {Promise}
   */
  emit(event, ...args) {
    return new Promise((resolve) => process.nextTick(() => {
      if (event !== 'event') {
        super.emit('event', event, ...args);
      }
      resolve(super.emit(event, ...args));
    }));
  }

  /**
   * @desc Subscribes to event with given callback
   * @param {String} event
   * @param {function|GeneratorFunction} callback
   * @param {Object} [context]
   * @return {EventEmitter}
   */
  on(event, callback, context) {
    let _callback = co.wrap(callback);

    if (context) {
      _callback = _callback.bind(context);
    }

    const handler = (...args) => _callback(...args);

    this._pushManagedHandler(event, callback, handler);
    return super.on(event, handler);
  }

  /**
   * @desc Subscribes to event with given callback, and unsubscribes once it fired
   * @param {String} event
   * @param {function|GeneratorFunction} callback
   * @param {Object} [context]

   * @return {EventEmitter}
   */
  once(event, callback, context) {
    let _callback = co.wrap(callback);

    if (context) {
      _callback = _callback.bind(context);
    }

    const handler = (...args) => {
      this.off(event, callback);

      return _callback(...args)
        .catch(err => {
          throw new Error(err);
        });
    };

    this._pushManagedHandler(event, callback, handler);
    return super.on(event, handler);
  }

  onRequest(event, callback, context) {
    const handler = (requestData, header) => {
      let _callback = co.wrap(callback);
      if (context) {
        _callback = _callback.bind(context);
      }

      return _callback(requestData, header)
        .catch(err => {
          header.error = true;
          return err;
        })
        .then((replyData) => {
          const replyEvent = Bus.formatReplyEvent(header.correlationId);
          header.replied = Date.now();
          return this.emit(replyEvent, replyData, header);
        });
    };

    this._pushManagedHandler(event, callback, handler);
    super.on(event, handler);
  }

  /**
   * @desc Unsubscribes of event with given callback
   * @param {String} event
   * @param {function} callback
   * @return {Number}
   */
  off(event, callback) {
    const managedCallback = this._popManagedHandler(event, callback);
    return super.removeListener(event, managedCallback);
  }

  removeListener(event, callback) {
    return this.off(event, callback);
  }

  removeAllListeners() {
    this._resetManagedHandlers();
    return super.removeAllListeners();
  }

  /**
   * @desc Returns promise, resolved later by event with message given, or rejected by timeout.
   * @param {String} event
   * @param {Number} [timeout = 0]
   * @param {String} [from = 'global']
   * @return {Promise}
   */
  wait(event, timeout = 0) {
    const _timeout = parseInt(timeout, 10);

    return new Promise((resolve, reject) => {
      let _timer = null;

      function _handleFn(...args) {
        if (_timer > 0) {
          clearTimeout(_timer);
        }

        if (args.length < 2) {
          [args] = args;
        }

        return resolve(args);
      }

      if (_timeout > 0) {
        _timer = setTimeout(() => {
          this.off(event, _handleFn);
          reject(`timed out`);
        }, _timeout);
      }
      this.once(event, _handleFn);
    });
  }

  /**
   * Returns promise resolved by replyFn (wrapped within request handler last argument) on subscriber's side,
   * or rejected by timeout
   * @param {String|Number} event
   * @param {*} [data]
   * @param {Number} [timeout = 0]
   * @param {String} [from = 'global']
   * @return {Promise}
   */
  request(event, data, timeout = 0, from = 'global') {
    const _correlationId = random.string(8, 4);
    const _replyEvent = Bus.formatReplyEvent(_correlationId);

    const _header = {
      correlationId: _correlationId,
      from: from,
      created: Date.now(),
    };

    this.emit(event, data, _header);

    this.debug(`request: ${event} (${_correlationId})`);
    if (timeout) {
      this.debug(`request: timeout => ${timeout} ms`);
    }
    return this.wait(_replyEvent, timeout)
      .then(([replyData, replyHeader]) => {
        if (!replyHeader) {
          throw new Error('reply header missing');
        }

        if (replyHeader.error) {
          throw replyData;
        }

        return replyData;
      });
  }

  _pushManagedHandler(event, originalHandler, managedHandler) {
    let handlerList = this._managedHandlers.get(event);

    this.debug(`managed handlers: adding ${event} => ${originalHandler.name}`);

    if (!handlerList) {
      handlerList = new Map();
      this._managedHandlers.set(event, handlerList);
    }

    handlerList.set(originalHandler, managedHandler);
  }

  _popManagedHandler(event, originalHandler) {
    const handlerList = this._managedHandlers.get(event);
    if (!handlerList) {
      return originalHandler;
    }

    const managedHandler = handlerList.get(originalHandler);

    if (!managedHandler) {
      return originalHandler;
    }

    this.debug(`managed handlers: checking ${event} => ${originalHandler.name}`);

    handlerList.delete(originalHandler);
    if (handlerList.size === 0) {
      this._managedHandlers.delete(event);
    }

    this.debug(`managed handlers: found and deleted`);
    return managedHandler;
  }

  _resetManagedHandlers() {
    this._managedHandlers = new Map();
  }
}

export default Bus;
