'use strict';

import Component from           './lib/component';
import createApp from           './lib/application';
import utils from               './lib/utils';

Object.assign(createApp, { Component, utils });
export default createApp;
