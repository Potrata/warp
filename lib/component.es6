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
    return (isFunction(this.init) ?
      this.init(app) :
      Promise.resolve()).then(() => Object.assign(app, this.mixins));
  }

  /**
   * @return {Promise}
   */
  onStart() {
    this._attachHandlers();
    if (isFunction(this.start)) {
      return this.start();
    }
    return Promise.resolve();
  }

  /**
   * @return {Promise}
   */
  onDestroy() {
    Object.keys(this.mixins || {}).forEach(k => delete this.app[k]);
    this._removeHandlers();

    if (isFunction(this.destroy)) {
      return this.destroy();
    }
    return Promise.resolve();
  }

  get handlers() {
    return {};
  };

  get mixins() {
    return {};
  }

  _attachHandlers() {
    this._handlers = Object.entries(this.handlers)
      .filter(([,fnName]) => this[fnName])
      .map(([evt,fnName]) => [evt, this[fnName].bind(this)]);

    this._handlers.forEach(([evt, fn]) => this.app.on(evt, fn));
  }

  _removeHandlers() {
    this._handlers.forEach(([evt, fn]) => this.app.off(evt, fn));
  }
}

export default Component;
