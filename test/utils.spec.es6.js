'use strict';

import * as random from './../src/utils/random.es6';
import {expect} from 'chai';

describe('random', () => {
  describe('int', () => {
    it('should return a valid number', () => {
      let result = random.int();
      expect(result).to.be.a('number');
    });

    it('shoud scale result to given bounds', () => {
      let scaledResult = random.int(1, 2);
      expect(scaledResult).to.be.within(1, 2);
    });

    it('should accept reversed argument order', () => {
      let scaledResult = random.int(2, 1);
      expect(scaledResult).to.be.within(1, 2);
    });
  });

  describe('string', () => {
    it('should return a valid string', () => {
      let result = random.string();
      expect(result).to.be.a('string');
    });

    it('should generate the string of given length', () => {
      let result = random.string(32);
      expect(result).to.have.length(32);
    });

    it('should evenly split result with hyphens', () => {
      let result = random.string(8, 2);
      expect(result).to.match(/^([a-z]{2}-){3}[a-z]{2}$/g);
    });

    it('should not split when parameter equal to the string length', () => {
      let result = random.string(8, 8);
      expect(result).to.match(/^([a-z]{8})$/g);
    });

    it('should not end result with hyphen', () => {
      let result = random.string(9, 4);
      expect(result).to.match(/^.*[a-z]$/);
    });
  });

  describe('pick', () => {
  });
});
