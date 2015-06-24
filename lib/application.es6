'use strict';

import Component from './component';
import assert from 'assert';
import {isObject, isFunction, isString} from 'util';
import getHub from './hub';

let hub = getHub('global');

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
    assert(!Application._instance, 'application can be instantiated only once');
    Object.assign(this, config);
    this._components = new Map();
    this._state = {
      name: this.name
    };
  }

  get publish() {
    return {
      changed: (data) => hub.createMessage(this.name, 'changed', data),//.publish(),
      started: () => hub.createMessage(this.name, 'started'),//.publish(),
      destroyed: () => hub.createMessage(this.name, 'destroyed')//.publish()
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

    else if (fieldNames.length === 1) {
      return this._state[fieldNames[0]];
    }

    return fieldNames
      .filter(fieldName => this._state.hasOwnProperty(fieldName))
      .map(fieldName => ({ [fieldName]: this._state[fieldName] }))
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
    this.publish.changed(_changedData);
    return Promise.resolve(_changedData);
  }

  /**
   * @desc Starts an application:
   * calls 'init' method on each registered component, then fires 'started' event/
   * @return {Promise}
   */
  start() {
    return this._forEachComponent('onStart')
      .then(() => this.publish.started());
  }

  /**
   * @desc Destroys an application:
   * calls 'destroy' method on each registered component, then fires 'destroyed' event/
   * @return {Promise}
   */
  destroy() {
    return this._forEachComponent('onDestroy')
      .then(() => this.publish.destroyed())
      .then(() => Application._instance = null);
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

  useModule(module, config) {
    let component = Component.create(module, config);
    return component
      .onInit(this)
      .then(() => this._components.set(component.id, component));

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
