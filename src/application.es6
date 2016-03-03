import debug from 'debug';
import {resolve} from 'path';
import assert from 'assert';
import {isString} from 'util';

import {default as Bus} from './bus';

const Functors = {
  reduce: (prev, cur) => Object.assign(prev, cur),
  priorityAscending: (a, b) => a.config.priority - b.config.priority,
  priorityDescending: (a, b) => b.config.priority - a.config.priority,
};

/**
 * @desc Represents generic application skeleton,
 * providing api for simple state and component management
 */
class Application {
  /**
   * Returns application instance
   * @param {Object} config
   * @param {String} config.name
   * @return {Application}
   */
  static create(config) {
    return new Application(config);
  }

  static defaults = {
    name: 'app',
    componentsRoot: '.',
  };

  /**
   * @param {Object} config
   * @param {String} config.name
   * @constructor
   */
  constructor(config) {
    assert(config.name, 'application name should be a string');

    this.bus = new Bus();
    this._components = new Map();
    this.name = config.name;
    this.config = Object.assign({}, Application.defaults, config);
    this.data = Object.assign({ name: this.name }, config.data);
    this.debug = debug(this.name);

    this.bus.onRequest('app.destroy', function* _destroy(data) {
      this.debug(`destroying application. reason: ${data.reason}`);
      return yield this.destroy();
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
      .then(() => this._forEachComponent('onStart', Functors.priorityAscending))
      .then(() => this._setStatus('started', this.data))
      .then(() => this._forEachComponent('onAfterStart', Functors.priorityAscending));
  }

  /**
   * @desc Destroys an application:
   * calls 'destroy' method on each registered component, then fires 'app.destroyed' event
   * @return {Promise}
   */
  destroy() {
    this.debug(`destroying ${this.name}`);
    return this._forEachComponent('onBeforeDestroy', Functors.priorityDescending)
      .then(() => this._setStatus('destroying'))
      .then(() => this._forEachComponent('onDestroy', Functors.priorityDescending))
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
      return this.useModule(component, componentConfig);
    }
    return this._addComponent(component, componentConfig);
  }

  useModule(path, config = {}) {
    this.debug(`loading component module: ${path}`);
    const component = require(path);
    return this._addComponent(component, config);
  }

  /**
   * @desc Loads whole bunch of components using configuration object.
   * @param {object<string,object>} componentsConfig
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
  useConfig(componentsConfig = {}) {
    Object.entries(componentsConfig)
      .forEach(([key, entry]) => {
        const _path = entry.path || resolve(this.config.componentsRoot, key);
        const _component = this.useModule(_path, entry.config);
        _component.imports = entry.imports || _component.ComponentClass.imports || [];
      });
  }

  _addComponent(ComponentClass, config) {
    const id = config.id || ComponentClass.id || ComponentClass.name;
    assert(!this._components.has(id), `component with id '${id}' already registered`);

    const _entry = Object.assign({}, { id, ComponentClass, config });
    this._components.set(id, _entry);

    this.debug(`component added: ${JSON.stringify({
      id, name: ComponentClass.name,
    })}`);
    return _entry;
  }

  _instantiateComponents() {
    const _entries = [...this._components.keys()]
      .map((id) => [id, this._createComponentInstance(id)]);
    this._components = new Map(_entries);
  }

  _createComponentInstance(id) {
    this.debug(`creating instance of [${id}]`);
    const entry = this._components.get(id);
    const instance = new entry.ComponentClass(id, this.bus);

    return Object.assign({}, entry, { instance });
  }

  _getImportsFor({id, ComponentClass, imports = ComponentClass.imports || []}) {
    this.debug(`getting imports of ${id}: [${imports.join(', ')}]`);

    return imports
      .map((importedID) => {
        const importEntry = this._components.get(importedID);
        assert(importEntry, `Component '${importedID}' required by '${id}' is not registered`);
        return importEntry;
      });
  }

  _initializeComponents() {
    [...this._components.values()]
      .forEach((entry) => {
        entry.imports = this._getImportsFor(entry);
      });

    const _promises = [...this._components.values()]
      .map(({instance, config, imports}) => {
        const normalizedImports = this._normalizeImports(imports);
        return instance.onInit.call(instance, config, normalizedImports);
      });
    return Promise.all(_promises);
  }

  _normalizeImports(imports) {
    return imports
      .map((importEntry) => {
        return {
          [importEntry.id]: this._getExportsFor(importEntry),
        };
      }).reduce(Functors.reduce, {});
  }

  _getExportsFor({ComponentClass, instance}) {
    this.debug(`getting imports for [${instance.id}]`);
    const exports = ComponentClass.exports || [];

    return exports.map((fnName) => {
      return {
        [fnName]: instance[fnName].bind(instance),
      };
    }).reduce(Functors.reduce, {});
  }

  _forEachComponent(fnName, comparator, ...args) {
    const components = [...this._components.values()];
    return components
      .sort(comparator)
      .map(({instance}) => instance)
      .reduce((prev, cur) =>
	prev.then(() => cur[fnName].call(cur, ...args)),
	Promise.resolve());
  }

  _setStatus(status, data) {
    return this.bus.emit(`app.${status}`, data);
  }
}

export default Application.create;
