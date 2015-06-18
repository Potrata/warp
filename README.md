# WARP
----

### Overview
WARP

### Installation
``` bash
$ npm install git+https://stash.head-point.ru:443/scm/warp/warp.git --save
```

### Usage
```js
import warp from 'warp';

let app = warp({ name: 'pretty-fucking-awesome' });
  app.start()).then(() =>
  app.info(`app started`)).catch(console.error);
```
