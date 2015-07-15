## Architecture

#### Решить, нужен ли вообще класс `Application`

Его интерфейс везде (кроме методов `use` и `useConfig`) повторяет интерфейс `Component`.
Вместо этого доработать `Component`, реализовав паттерн [Composite](https://sourcemaking.com/design_patterns/composite).   
В качестве "приложения" использовать специальный "корневой" компонент (ex.: `RunnerComponent`).

## Code Design

### Упростить разработку компонентов

Изначально было так:

```javascript
export default class ComponentA extends Component {
  /** 'get', потому что нативных статических полей пока нет */
  static get prop() { return 10; }
  static get complexProp() { 
    return {
      fieldA: 'a',
      fieldB: 20
    };
  }
   
  // ... behaviour implementation ...
}  
```

Но затем, в надежде разгрузить сам класс и повысить читаемость кода, решено было как-то разделить 
декларативную и поведенческую части компонента.  
Стало так:

```javascript
export default class ComponentA extends Component {
  // ... behaviour implementation ...
}
ComponentA.id = 'component-a';
ComponentA.imports = ['imported-component'];
ComponentA.exports = ['createClient', 'getClient'];
ComponentA.events = { in: { 'event.a' }, out: { 'event.b' } };
ComponentA.defaults = {
  name: pkg.name,         // duplicated in every module
  version: pkg.version    // duplicated in every module
  desc: pkg.description   // duplicated in every module
};
```

**Проблемы:**

- Как известно, объявление `class` **не "всплывает"** (в отличие, например, от `function`).
  Поэтому всю "статику" приходится объявлять **после** класса (т.е. в самом низу модуля), --  
  выглядит противоестественно (сначала имплементация, потом декларация), и не очень удобно в целом.
  
- Дублирование `defaults.name`, `default.version`, `default.desc`. Эти три строчки идентичны в каждом конкретном компоненте.

- Поле `events` хранит названия сообщений в объектном формате (чтобы не хардкодить и снизить вероятность опечаток), 
  но доступно оно только в пределах локального модуля.  
  А поскольку о любом отдельно взятом сообщении "знают" как минимум два компонента (в реальности часто больше),  
  то строковое содержимое `events` **повторяется** внутри каждого из них:

```javascript
//component-a.es6
export default class ComponentA extends Component { /** ... */ }
ComponentA.events = {
  in:   { 'need.some.shit' }        // <-- oops
  out:  { 'some.shit.happened' }    // duplicated on every subscriber
};

//component-b.es6 (one of subscribers)
export default class ComponentB extends Component { /** ... */ }
ComponentB.events = {
  in:   { 'some.shit.happened' }    // <-- oops
  out:  { 'need.some.shit' }        // duplicated on every subscriber
};
```

**Решения:**

- _Убрать поле `id` из статических членов класса._  
  Использовать имя класса в [Lisp-нотации](https://en.wikipedia.org/wiki/Naming_convention_(programming)#Lisp), если 'id' не задан явно при создании.

- _Убрать поле `events`._  
  Для объявления констант событий временно использовать общий модуль `messages`

- _Убрать из `defaults` поля `name`, `version` и `desc`_  
  Сделать их подгрузку автоматической из `package.json` при регистрации компонента как модуля.

### Ввести универсальный формат сообщений

#### Цели:

-  быстрая отладка;
-  более информативный мониторинг;

#### Пример:

```javascript
let _lastMessageID = 0;
function CreateMessage(from, topic, data = {}, type = 'Event') {
  return {
    header: {
      id: _lastMessageID++,
      type: type,
      topic: topic,
      from: from,
      created: Date.now()
    },
    payload: data
  };
};

function CreateReply(from, requestMessage, data = {}) {
  return {
    header: {
      id: _lastMessageID++,
      correlationID: requestMessage.id
      type: 'Reply',
      topic: `reply::${requestMessage.topic}::${requestMessage.id}`,
      from: from,
      created: Date.now()
    },
    payload: data
  };
};
```

## Tools

### Написать CLI - утилиту для `warp`

#### Цели:

- более гибкая конфигурация;
- более эффективная отладка компонентов;

#### Пример использования:

```bash
$ warp-cli --config=config.js --add=['component1', 'component2']
initializing @hp/warp v1.0.0
-------------------------------------
loading     [config.js]         done.
loading     [component1]        fail.
loading     [component2]        done.
installing  [@hp/warp-ticker]   done.
wiring up                       done.
-------------------------------------
ready. type 'help' to show available commands
warp > help
'help'                                      - show available commands
'state'                                     - show warp current configuration and state
'components'                                - show registered components
'start'                                     - start warp with current configuration loaded
'destroy'                                   - destroy warp and exit
'set <component-id> <key> <value>'          - set config option to component
'get <component-id> [key]'                  - print components config option(-s)
'use <path>'                                - register component by module path
'unuse <id|all>'                            - destroy and remove component(-s) from warp
'emit <event> [data]'                       - emit event on warp message bus
'request <msg> [data] [timeout=0]'          - send request to warp message bus, and print result    
```

## Other

### Выделить универсальные компоненты
Вынести компоненты из ptz-common в отдельные репозитории.  
Объединить/разъединить/переименовать компоненты, проведя рефакторинг.
- объединить `http-server` и `http-route-adapter` в **`warp-adapter-http`**
- перенести `graceful-killer` в **`warp-process-guard`**
- объединить `redis-relay` и `redis-client-pool` в **`warp-bridge-redis`**
- из `application-storage` выделить **`warp-storage-redis`**

### Покрыть код тестами
Сейчас тестируются только модули из состава `utils` и частично `Bus`
