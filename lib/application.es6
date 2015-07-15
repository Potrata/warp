'use strict';

import debug from 'debug';
import {resolve} from 'path';
import EventEmitter from 'events';
import assert from 'assert';
import {isObject, isFunction, isString} from 'util';

import Component from './component';
import Bus from './bus';

const Functors = {
  reduce: (prev, cur) => Object.assign(prev, cur)
};

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
    return new Application(config);
  }

  static get defaults() {
    return {
      name: 'app',
      componentsRoot: '.'
    }
  }

  /**
   * @param {Object} config
   * @param {String} config.name
   * @constructor
   */
  constructor(config) {
    assert(config.name, 'application name should be a string');

    this.name = config.name;
    this.config = Object.assign({}, Application.defaults, config);

    this.data = Object.assign({ name: this.name }, config.data);

    this.bus = new Bus();
    this._components = new Map();

    this.debug = debug(this.name);

    this.bus.onRequest('app.destroy', function *(data) {
      this.debug(`destroying application. reason: ${data.reason}`);
      yield this.destroy();
    }, this);

    this.bus.on('app.data', (data) => {
      this.data = Object.assign({}, this.data, data);
    });

    this.bus.onRequest('app.query.data', () => {
      return Object.assign({}, this.data);
    });

    this._setStatus('created');
  }

  /**
   * @desc Starts an application:
   * calls 'init' method on each registered component, then fires 'app.started' event
   * @return {Promise}
   */
  start() {
    this.debug(`starting`);
    this._instantiateComponents();

    return this._initializeComponents()
      .then(() => this._setStatus('starting'))
      .then(() => this._forEachComponent('onStart'))
      .then(() => this._setStatus('started', this.data))
      .then(() => this._forEachComponent('onAfterStart'));
  }

  /**
   * @desc Destroys an application:
   * calls 'destroy' method on each registered component, then fires 'app.destroyed' event
   * @return {Promise}
   */
  destroy() {
    this.debug(`destroying ${this.name}`);
    return this._forEachComponent('onBeforeDestroy')
      .then(() => this._setStatus('destroying'))
      .then(() => this._forEachComponent('onDestroy'))
      .then(() => this._setStatus('destroyed'));
  }

  /**
   * @desc Registers component, represented by given class or module path
   * @param {Component|string} component
   * @param {object} [componentConfig]
   * @return {Promise}
   */
  use(component, componentConfig = {}) {
    if (isString(component)) {
      let path = resolve(this.config.componentsRoot, component);
      this.debug(`loading component module: ${path}`);
      component = require(path);
    }
    return this._addComponent(component, componentConfig);
  }

  /**
   * @desc Loads whole bunch of components using configuration object.
   * @param {object<string,object>} config
   *
   * @example configuration object:
   * let components = [{
   *    'component-one': {
   *      imports: [],
   *      config: { someOption: 'someValue' }
   *    },
   *
   *    'component-two': {
   *      imports: ['component-one'], // dependency declaration (it overrides the defaults)
   *      config: { anotherOption: 'anotherValue' }
   *    },
   *
   *    'one-more-component': {
   *      path: './path/to/my-components', // explicit path declaration (overrides 'config.app.componentsRoot')
   *      imports: ['component-one', 'component-two'],
   *      config: {}
   *    },
   *    ... etc ...
   * }];
   *
   * let warp = require('@hp/warp');
   * let app = warp({ name: 'this-is-warp' });
   *
   * // loads stuff synchronously
   * app.useConfig(components);
   *
   * // app is ready to start
   * app.start().then( ... ).catch( ... );
   */
  useConfig(config = {}) {
    Object.entries(config).forEach(([key, configEntry]) => {
      let component = key;
      if (configEntry.path) {
        component = require(configEntry.path);
      }

      let _instance = this.use(component, configEntry.config);
      _instance.imports = configEntry.imports;
    });
  }

  _addComponent(ComponentClass, config) {
    let id = config.id || ComponentClass.id || ComponentClass.name;
    assert(!this._components.has(id), `component with id '${id}' already registered`);

    this.debug(`adding component: ${ComponentClass.name}`);

    let _entry = { id, ComponentClass, config };
    this._components.set(id, _entry);
    return _entry;
  }

  _instantiateComponents() {
    [...this._components.values()]
      .forEach(entry => {
        entry.imports = this._getImportsFor(entry);
        entry.instance = new entry.ComponentClass(entry.id, this.bus);
      });
  }

  _initializeComponents() {
    let _promises = [...this._components.values()]
      .map(entry => {
        let {instance, config} = entry;
        let imports = this._normalizeImports(entry);
        return instance.onInit.call(instance, config, imports);
      });
    return Promise.all(_promises);
  }

  _normalizeImports(entry) {
    return entry.imports
      .map(importEntry => {
        let _exports = this._getExportsFor(importEntry);
        return { [importEntry.id]: _exports };
      }).reduce(Functors.reduce, {});
  }

  _getExportsFor(entry) {
    let exports = entry.ComponentClass.exports || [];

    return exports.map((fnName) => {
      return {
        [fnName]: entry.instance[fnName].bind(entry.instance)
      };
    }).reduce(Functors.reduce, {});
  }

  _getImportsFor(entry) {
    let {id} = entry;
    let imports = entry.imports || entry.ComponentClass.imports || [];

    this.debug(`getting imports of ${id}: [${imports.join(', ')}]`);

    return imports.map(importId => {
      let importEntry = this._components.get(importId);
      if (!importEntry) {
        throw new Error(`Component '${importId}' required by '${id}' is not registered`);
      }
      return importEntry;
    });
  }

  _forEachComponent(fnName, ...args) {
    let _promises = [];
    for (let entry of this._components.values()) {
      _promises.push(entry.instance[fnName].call(entry.instance, ...args));
    }

    return Promise.all(_promises);
  }

  _setStatus(status, data) {
    return this.bus.emit(`app.${status}`, data);
  }
}

export default Application.create;
