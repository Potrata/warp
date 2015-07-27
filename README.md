# WARP

Web-agnostic Rapid Prototyping tools


## Overview
![Classes](./classes.png)


## Installation
```bash
$ npm install node-warp --save
```

## Usage
```javascript
import warp from 'node-warp';

let app = warp({ name: 'pretty-fucking-awesome' });
app.start())
  .then(() => app.bus.emit(`log`, `app started`))
  .catch(console.error);
```

## Linting
Using [ESLint](http://eslint.org/) with [babel-eslint plugin](https://github.com/babel/babel-eslint) 
```sh
npm run lint
```
