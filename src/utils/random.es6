import {isArray, isString} from 'util';
import assert from 'assert';

function* _sequence(len, split) {
  let pos = 0;

  while (pos < len) {
    const remains = len - pos;
    const _split = Math.max(0, Math.min(split, remains)) || remains;
    yield [...letters(_split)].join('');
    pos = pos + _split;
  }
}

const _letterTypes = ['aoeiu', 'wrtplsdfghjklmnbvcz'];
function* letters(len = 4) {
  let _typeIndex = int(0, 1);
  let pos = len;
  while (pos) {
    pos = pos - 1;
    _typeIndex = (1 - _typeIndex);
    yield pickElement(_letterTypes[_typeIndex]);
  }
}

function pickElement(list) {
  return list[Math.floor(Math.random() * (list.length))];
}


/**
 * Generates random string
 * @param {number} [length = 8]
 * @param {number} [split = 0]
 * @return {string}
 */
function string(length = 8, split = 0) {
  return [..._sequence(length, split)].join('-');
}

/**
 * Generates random integer
 * @param {number} [from = 0]
 * @param {number} [to = Number.MAX_SAFE_INTEGER]
 * @return {number}
 */
function int(from = 0, to = Number.MAX_SAFE_INTEGER) {
  return Math.round(from + Math.random() * (to - from));
}

/**
 * Returns randomly selected element/letter from given array/string
 * @param {String|Array} list
 * @return {*}
 */
function pick(list) {
  assert(isArray(list) || isString(list),
    'argument type mismatch: should be a string, or an array');
  return pickElement(list);
}

export default { string, int, pick };
