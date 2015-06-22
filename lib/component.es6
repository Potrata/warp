'use strict';

import {isArray, isFunction} from 'util';

/**
 * @desc Represents pluggable application extension through mixins and event-hooks
 * @class
 */
class Component {
  static defaults() {
    return {};
  }

  /**
   * @param {Object} config
   * @param {String|Number} [config.id];
   */
  constructor(config = {}) {
    Object.assign(this, this.constructor.defaults, config);
    this.id = this.id || this.constructor.id;
  }

  /**
   * @param {Application} app
   * @return {Promise}
   */
  onInit(app) {
    this.app = app;
    return Promise.resolve(isFunction(this.init) && this.init(app))
      .then(() => this._mapMixins());
  }

  /**
   * @return {Promise}
   */
  onStart() {
    this._mapHandlers();
    return Promise.resolve(isFunction(this.start) && this.start());
  }

  /**
   * @return {Promise}
   */
  onDestroy() {
    this._unmapHandlers();
    this._unmapMixins();
    return Promise.resolve(isFunction(this.destroy) && this.destroy());
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
