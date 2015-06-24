'use strict';

export function generateStringId(len = 8, splitInterval = 4) {
  return [...randomString(len, splitInterval)].join('-').toUpperCase();
}

function * randomString(len = 8, split = 0) {
  let _groups = ['aoeiu', 'wrtplsdfghjklmnbvcz'];
  _groups = pickElement([_groups, _groups.reverse()]);

  let pos = 0;
  while (pos < len) {
    if (split) {
      if(split > len - pos) {
        split = len - pos;
      }
      yield [...randomString(split)].join('');
      pos += split;
    } else {
      yield pickElement(_groups[pos % 2]);
      pos += 1;
    }
  }
}

function pickElement(list) {
  return list[Math.floor(Math.random() * (list.length))];
}
