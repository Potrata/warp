import debug from 'debug';
import co from 'co';

/**
 * @desc Represents pluggable application extension through mixins and event-hooks
 * @class
 */
class Component {
  static defaults = {};

  /**
   * @param {string} id
   * @param {Bus} bus
   */
  constructor(id, bus) {
    this.id = id;
    this.config = {};
    this.imports = {};
    this._bus = bus;
    this.debug = debug(this.id);
    this._setStatus(Component.Status.created);
  }

  *init() {}

  *start() {}

  *afterStart() {}

  *beforeDestroy() {}

  *destroy() {}

  /** Bus delegator proxy */

  emit(event, data) {
    return this._bus.emit(event, data, { from: this.id });
  }

  wait(event, timeout = 0) {
    return this._bus.wait(event, timeout);
  }

  request(event, data, timeout = 0) {
    return this._bus.request(event, data, timeout, this.id);
  }

  on(event, callback) {
    this.emit('listen', event);
    return this._bus.on(event, callback, this);
  }

  once(event, callback) {
    this.emit('listen', event);
    return this._bus.once(event, callback, this);
  }

  onRequest(event, callback) {
    this.emit('listen', event);
    return this._bus.onRequest(event, callback, this);
  }

  off(event, callback) {
    return this._bus.off(event, callback);
  }

  /** Bus delegator proxy end */

  /**
   * @param {Object} config
   * @param {Object<string, Component>} imports
   * @return {Promise}
   */
  onInit(config, imports) {
    this.config = Object.assign({}, this.constructor.defaults, config);
    this.imports = Object.assign({}, imports);

    return co.call(this, function* _init() {
      yield this._setStatus(Component.Status.initializing);
      yield this.init(config, imports);
      yield this._setStatus(Component.Status.initialized);
    });
  }

  /**
   * @return {Promise}
   */
  onStart() {
    return co.call(this, function* _start() {
      this._setStatus(Component.Status.starting);
      yield this.start();
      this._mapHandlers();
      this._setStatus(Component.Status.started);
    });
  }

  /**
   * @return {Promise}
   */
  onAfterStart() {
    return co.call(this, function* _afterStart() {
      yield this.afterStart();
    });
  }

  /**
   * @return {Promise}
   */
  onBeforeDestroy() {
    return co.call(this, function* _beforeDestroy() {
      yield this.beforeDestroy();
    });
  }

  /**
   * @return {Promise}
   */
  onDestroy() {
    return co.call(this, function* _destroy() {
      this._setStatus(Component.Status.destroying);
      yield this.destroy();
      this._unmapHandlers();
      this._setStatus(Component.Status.destroyed);
    });
  }

  _setStatus(status) {
    const _status = Component.Status[status];
    if (!_status) {
      throw new Error(`bad status: ${status}`);
    }
    this.status = _status;
    return this.emit(`component.${_status}`, {
      id: this.id,
    });
  }

  _mapHandlers() {
    Object.entries(this.handlers || {})
      .forEach(([msg, fn]) => this.on(msg, fn));

    Object.entries(this.requests || {})
      .forEach(([msg, fn]) => this.onRequest(msg, fn));
  }

  _unmapHandlers() {
    Object.entries(this.handlers || {}).concat(Object.entries(this.requests || {}))
      .forEach(([msg, fn]) => this.off(msg, fn));
  }
}

Component.Status = {
  created: 'created',
  initializing: 'initializing',
  initialized: 'initialized',
  starting: 'starting',
  started: 'started',
  destroying: 'destroying',
  destroyed: 'destroyed',
};

export default Component;
