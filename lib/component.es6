'use strict';

import co from 'co';
import {isArray, isFunction} from 'util';

function mixin(target, source) {
  target = target.prototype;
  source = source.prototype;

  Object.getOwnPropertyNames(source)
    .forEach(name => {
      if (name !== 'constructor') {
        Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name));
      }
    });
}

/**
 * @desc Represents pluggable application extension through mixins and event-hooks
 * @class
 */
class Component {
  static defaults() {
    return {};
  }

  static create(module, config) {
    let _moduleClass = class extends Component {
      constructor(config) {
        super(config);
        Object.assign(this, module);
      }
    };
   // let componentModule = mixin(_moduleClass, Component);
    return Reflect.construct(_moduleClass, config);
  }

  /**
   * @param {Object} config
   * @param {String|Number} [config.id];
   */
  constructor(config = {}) {
    Object.assign(this, this.constructor.defaults, config);
    this.id = this.id || this.constructor.id;
  }

  * init() {}

  * start() {}

  * destroy() {}

  /**
   * @param {Application} app
   * @return {Promise}
   */
  onInit(app) {
    this.app = app;
    return this.callMethod(this.init);
  }

  /**
   * @return {Promise}
   */
  onStart() {
    this._mapMixins();
    this._mapHandlers();
    return this.callMethod(this.start);
  }

  /**
   * @return {Promise}
   */
  onDestroy() {
    this._unmapHandlers();
    this._unmapMixins();
    return this.callMethod(this.destroy);
  }

  callMethod(fn) {
    return co.call(this, function *() {
      yield fn.call(this);
    });
  }

  get handlers() {
    return {};
  }

  get mixins() {
    return {};
  }

  _mapHandlers() {
    this._handlers = Object.assign({}, this.handlers);
    this._handlers = Object.keys(this._handlers)
      .map(msg => [msg, this._handlers[msg].bind(this)]);
    this._handlers.forEach(([msg, fn]) => this.app.on(msg, fn));
  }

  _unmapHandlers() {
    this._handlers.forEach(([msg, fn]) => this.app.off(msg, fn));
  }

  _mapMixins() {
    Object.keys(this.mixins)
      .forEach(name => {
        if (this.app[name]) {
          throw new Error(`Can't use mixin '${name}' - application already has method or field with same name`);
        }

        let mixin = this.mixins[name];
        if (isFunction(mixin)) {
          mixin = mixin.bind(this);
        }
        Object.assign(this.app, { [name]: mixin });
      });
  }

  _unmapMixins() {
    Object.keys(this.mixins)
      .forEach(fnName => delete this.app[fnName]);
  }
}

export default Component;
