import {default as Component} from './component';
import {default as createApp} from './application';
import {default as Bus} from './bus';
import {default as utils} from './utils';

Object.assign(createApp, { Component, Bus, utils });
export default createApp;
