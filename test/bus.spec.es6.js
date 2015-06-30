'use strict';

import {expect} from 'chai';
import Bus from './../lib/bus';

describe('bus', () => {
  let bus = new Bus();
  afterEach(() => {
    bus.removeAllListeners();
  });

  it('should emit an event to subscribers', () => {
    let value = 0;
    bus.on('test', (input) => {
      value = input;
    });
    return bus.emit('test', 42).then(() => {
      expect(value).to.be.equal(42);
    });
  });

  it('should emit an event only once', () => {
    let callCounter = 0;
    bus.once('test', () => callCounter += 1);

    let emitPromiseA = bus.emit('test');
    let emitPromiseB = bus.emit('test');

    return Promise.all([emitPromiseA, emitPromiseB])
      .then(() => expect(callCounter).to.be.equal(1));
  });

  it('should execute callback bound to some context', () => {
    let context = {};

    bus.on('test', function() {
      expect(this).to.be.equal(context);
    }, context);

    return bus.emit('test');
  });

  describe('wait', () => {
    it('should resolve on success', () => {
      bus.emit('test', 42);
      return bus.wait('test', 1000)
        .then(value => expect(value).to.be.equal(42));
    });

    it('should reject on timeout', () => {
      return bus.wait('test', 1)
        .catch(err => expect(err).to.be.equal('timed out'));
    });
  });

  describe('request', () => {
    it('should resolve on reply', () => {
      bus.onRequest('double', (data) => {
        return Promise.resolve(data * 2);
      });

      return bus.request('double', 42, 1000)
        .then(value => expect(value).to.be.equal(84));
    });

    it('should support generators', () => {
      bus.onRequest('test', function *(data) {
        return yield { x: data * 2 };
      });

       return bus.request('test', 42, 1000)
        .then(value => {
           expect(value).to.have.property('x');
           expect(value.x).to.be.equal(84);
         });
    });

    it('should reject when replied with error', () => {
      bus.onRequest('req', (data, header) => {
        return Promise.reject('error');
      });

      return bus.request('req', null, 1000)
        .catch(value => expect(value).to.be.an.instanceof(Error));
    });

    it('should reject when timed out', () => {
      return bus.request('req', null, 1)
        .catch(value => expect(value).to.be.equal('timed out'));
    });
  });
});
