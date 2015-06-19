# WARP
----

### Overview
WARP

### Installation
``` bash
$ npm install @hp/warp --save
```

### Usage
```js
import warp from '@hp/warp';

let app = warp({ name: 'pretty-fucking-awesome' });
  app.start()).then(() =>
  app.info(`app started`)).catch(console.error);
```
