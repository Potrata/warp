'use strict';

import {isArray, isString, isObject} from 'util';
import assert from 'assert';

/**
 * Generates random string
 * @param {number} [length = 8]
 * @param {number} [split = 0]
 * @return {string}
 */
export function string(length = 8, split = 0) {
  return [..._sequence(length, split)].join('-');
}

/**
 * Generates random integer
 * @param {number} [from = 0]
 * @param {number} [to = Number.MAX_SAFE_INTEGER]
 * @return {number}
 */
export function int(from = 0, to = Number.MAX_SAFE_INTEGER) {
  return Math.round(from + Math.random() * (to - from));
}

/**
 * Returns randomly selected element/letter from given array/string
 * @param {String|Array} list
 * @return {*}
 */
export function pick(list) {
  assert(isArray(list) || isString(list),
    'argument type mismatch: should be a string, or an array');
  return pickElement(list)
}

function * _sequence(len, split) {
  let pos = 0;

  while (pos < len) {
    let remains = len - pos;
    split = Math.max(0, Math.min(split, remains)) || remains;
    yield [...letters(split)].join('');
    pos += split;
  }
}

let _letterTypes = ['aoeiu', 'wrtplsdfghjklmnbvcz'];
function * letters(len = 4) {
  let _typeIndex =  int(0, 1);
  while (len--) {
    _typeIndex = (1 - _typeIndex);
    yield pickElement(_letterTypes[_typeIndex]);
  }
}

function pickElement(list) {
  return list[Math.floor(Math.random() * (list.length))];
}
