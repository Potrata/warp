'use strict';

import EventEmitter from 'events';
import assert from 'assert';
import {isObject, isFunction} from 'util';

/**
 * @desc Represents generic application skeleton,
 * providing api for simple state and component management
 */
class Application {
  /**
   * Returns application instance singleton
   * @param {Object} config
   * @param {String} config.name
   * @return {Application}
   */
  static create(config) {
    if (!Application._instance) {
      Application._instance = new Application(config);
    }
    return Application._instance;
  }

  /**
   * @param {Object} config
   * @param {String} config.name
   * @constructor
   */
  constructor(config) {
    assert(config.name, 'application name should be a string');
    assert(!Application._instance, 'application can instantiated only once');
    Object.assign(this, config);

    this._hub = new EventEmitter();
    this._components = new Map();
    this._state = {
      name: this.name
    };
  }

  /**
   * @desc Returns object, filled with state data, keyed by field names,
   * or the whole state object, when no names given)
   * @param {Array<String>} fieldNames
   * @return {Object<String,*>}
   */
  get(...fieldNames) {
    if (fieldNames.length < 1) {
      return Object.assign({}, this._state);
    }

    return fieldNames
      .map(name => ({ [name]: this._state[name] }))
      .filter(({k, v})=>typeof(v) !== 'undefined')
      .reduce((p, c) => Object.assign(p, c), {});
  }

  /**
   * @desc Sets state data to value by given field name
   * @param {String|Object} fieldName
   * @param {*} [value]
   * @return {Promise}
   */
  set(fieldName, value) {
    assert(fieldName, 'fieldName should be defined');

    let _changedData;
    if (isObject(fieldName)) {
      Object.assign(this._state, fieldName);
      _changedData = fieldName;
    } else {
      this._state[fieldName] = value;
      _changedData = { [fieldName]: value };
    }
    this.emit('changed', _changedData);
    return Promise.resolve(_changedData);
  }

  /**
   * @desc Starts an application:
   * calls 'init' method on each registered component, then fires 'started' event/
   * @return {Promise}
   */
  start() {
    return this._forEachComponent('onStart')
      .then(() => this.emit('started'));
  }

  /**
   * @desc Destroys an application:
   * calls 'destroy' method on each registered component, then fires 'destroyed' event/
   * @return {Promise}
   */
  destroy() {
    return this._forEachComponent('onDestroy')
      .then(() => this.emit('destroyed'));
  }

  /**
   * @desc Checking if component with given id is registered
   * @param {String|Number} id
   * @return {boolean}
   */
  hasComponent(id) {
    return this._components.has(id);
  }

  /**
   * @desc Returns component instance by given id, if registered
   * @param {String|Number} id
   * @return {Component}
   */
  getComponent(id) {
    return this._components.get(id);
  }

  /**
   * @desc Registers component, represented by given class
   * @param {Component.prototype} ComponentClass
   * @param {Object} [config]
   * @return {Promise}
   */
  use(ComponentClass, config) {
    return this._addComponent(ComponentClass, config);
  }

  /**
   * @desc Registers many components, represented by given classes
   * @param {args<Component.prototype>} components
   * @return {Promise}
   */
  addComponents(...components) {
    return Promise.all(components.map(component => this._addComponent(component)));
  }

  /**
   * @desc Emits an event
   * @param {String} msg
   * @param {args<*>} [args]
   * @return {Number}
   */
  emit(msg, ...args) {
    return this._hub.emit(msg, ...args);
  }

  /**
   * @desc Subscribes to event with given callback
   * @param {String} msg
   * @param {function} cb
   * @return {Number}
   */
  on(msg, cb) {
    return this._hub.on(msg, cb);
  }

  /**
   * @desc Unsubscribes of event with given callback
   * @param {String} msg
   * @param {function} cb
   * @return {Number}
   */
  off(msg, cb) {
    return this._hub.removeListener(msg, cb);
  }

  /**
   * @desc Returns promise, resolved later by event with message given, or rejected by timeout.
   * @param {String} msg
   * @param {Number} [timeout = 0]
   * @return {Promise}
   */
  wait(msg, timeout = 0) {
    return new Promise((resolve, reject) => {
      let _timer = (timeout > 0) ? setTimeout(() => {
        this.off(msg, _handleFn);
        reject(`timed out`);
      }, timeout) : null;
      this._hub.once(msg, _handleFn);

      function _handleFn(data) {
        if (_timer) {
          clearTimeout(_timer)
        }
        return resolve(data);
      }
    });
  }

  /**
   * @desc Returns promise, resolved only when all events are triggered, or rejected by timeout.
   * @param {Array<String>} msgs
   * @param {Number} [timeout = 0]
   * @return {Promise}
   */
  waitAll(msgs, timeout = 0) {
    let deferred = Promise.defer();
    let _timer = (timeout > 0) ? setTimeout(() => {
      this.off(msg, _handleFn);
      deferred.reject(`timed out`);
    }, timeout) : null;

    let promises = msgs.map(msg => new Promise((resolve) => {
      this._hub.once(msg, resolve);
    }));

    Promise.all(promises).then((data) => {
      if (timeout > 0) {
        clearTimeout(_timer);
      }
      return deferred.resolve(data);
    });

    return deferred.promise;
  }

  _addComponent(ComponentClass, config) {
    let component = new ComponentClass(config);
    let {id} = component;
    assert(!this.hasComponent(id), `component ${id} already exists`);

    return component
      .onInit(this)
      .then(() => {
        this._components.set(id, component);
        return component;
      });
  }

  _forEachComponent(fnName, ...args) {
    let resultPromises = [...this._components]
      .filter(([,c]) => isFunction(c[fnName]))
      .map(([,c]) => c[fnName].call(c, ...args));
    return Promise.all(resultPromises);
  }
}

export default Application.create;
