## TODO
---
### Architecture
-   **Нужен ли класс `Application`?**

    > Его интерфейс везде (кроме методов `use` и `useConfig`) повторяет интерфейс `Component`.  
    > Вместо этого доработать `Component`, реализовав паттерн [Composite](https://sourcemaking.com/design_patterns/composite).   
    > В качестве "приложения" использовать специальный "корневой" компонент.

### Code Design
-   **Описание модуля компонента**

    Изначально было примерно так:
    
        export default class ComponentA extends Component {
            static get prop() { return 10; } // `get`, потому что нативных статических полей -- пока нет
            static get complexProp() { 
                return {
                    fieldA: 'a',
                    fieldB: 20
                };
            }
            /** behaviour implemetation */
        }

    Но затем, в надежде разгрузить сам класс и повысить читаемость кода, решено было как-то разделить 
    декларативную и поведенческую части компонента. Стало так:

        export default class ComponentA extends Component {
            /** behaviour implemetation */
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

    _Проблемы:_
    
    -   Как известно, объявление `class` **не "всплывает"** (в отличие, например, от `function`).
        Поэтому всю "статику" приходится объявлять **после** класса (т.е. в самом низу модуля), --  
        выглядит противоестественно (сначала имплементация, потом декларация), и не очень удобно в целом.
        
    -   Дублирование `defaults.name`, `default.version`, `default.desc`. Эти три строчки идентичны в каждом конкретном компоненте.
    
    -   Поле `events` хранит названия сообщений в объектном формате (чтобы не хардкодить и снизить вероятность опечаток), 
        но доступно оно только в пределах локального модуля.  
        А поскольку о любом отдельно взятом сообщении "знают" как минимум два компонента (в реальности часто больше),  
        то строковое содержимое `events` **повторяется** внутри каждого из них:
    
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

-   **Определить формат событий**

    Без единого формата, и единой точки сериализации/десериализации сообщений, отладка вызывает лишние трудности.
    
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

-   **Контроль над событиями**
    

### Tools
-   **Написать CLI - утилиту для `warp`**  

    Цели:
    -   гибкость конфигурации;  
    -   более эффективная отладка компонентов

    Пример использования:
    
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

-   **Покрыть код тестами**

    > Сейчас тестируются только модули из состава `utils` и (частично) `Bus`
