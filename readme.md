# Hapi Console

```
so colours
much lightweight
such better
wow
```
~ [Eek](https://github.com/eek) 2016

___

![console output](https://raw.githubusercontent.com/findie/hapi-console/master/images/logo.png)

# Install
[![npm](https://img.shields.io/npm/v/hapi-console.svg?maxAge=2592000)](https://www.npmjs.com/package/hapi-console)

`npm i --save hapi-console`

# Quick Example
```javascript
const Hapi = require('hapi');
const server = new Hapi.Server({ debug: false });
const hapiConsole = require('hapi-console');

server.register({
    register: hapiConsole,
    options: {
    
        // ignore /ignore/me route
        ignore: ['/ignore/me'],

        // show custom data about the request
        custom: {
            // shows custom data about auth.credentials.uid as 'uid: <>'
            'auth.credentials.uid': true,  
            
            // shows a JSON.stringify version of query
            'query': true, 
            
            // executes the function and uses the output where x is request.headers
            'headers': (x) => JSON.stringify(x).replace(/"/g, '') 
        },
        
        // if true it uses the full path of the key to display the data 
        // if false it uses just the last property key to display data
        customFullLengthKey: false
    }
}, () => {
    if (err) {
        console.error(err);
    }
    
    server.route({
        path: '/',
        method: 'get',
        handler: (req, res) => {
        
            // will show an error
            req.log('error', 'err');
             
            // will also show an error with stack
            req.log('error', new Error()); 
            
            // will log on request
            req.log('log', 'log 1');  

            // will log on server
            server.log('log', 'this is a server log'); // we
            
            // will show an unexpected error
            setTimeout(() => {throw new Error('up')}, 100);
        }
    });  
  
    server.start();
});
```

Note: `userFilter` has been deprecated in favour of `custom` since 0.6.0

## Options

### `options.ignore {Array.<String>}`
Will not write to console output from the route's context but ***will*** log errors

### `options.ignoreSyscall {Boolean}`
Will not write to console output any syscall errors

### `options.userFilter {Object.<String, Boolean>}`
Will filter what data from `request.auth.credentials` is shown in the output

## Interpreting the output

### Server start
Example:
```
SERVER test/2 STARTED
    ID:         Stefan:26747:itfodt15
    PORT:       8081
    HOST:       Stefan
    PROTOCOL:   http
    URI:        http://Stefan:8081
```
Explanation: 
```
SERVER {connection assigned labels split by /} STARTED
       ID:         {connection id}
       PORT:       {port}
       HOST:       {host}
       PROTOCOL:   {protocol}
       URI:        {full uri}
```

### Server Log
`server.log(['log', 'test'], 'this is a server log');`
```
Example: 
1474629596922:Stefan:26747:itfodt0w       | [log/test] this is a server log
Explanation: 
{ timestamp }:{host}:{pid}:{ts base64}    | [{tags}] {message}
```
### Request Log
`req.log(['log', 'test'], 'request log');`
```
Example: 
1474629596915:Stefan:26747:itfodt0w:10000:8080 [test|1] 127.0.0.1 [{uid: 12345}] [log/test] log 1
Explanation: 
{ timestamp }:{host}:{pid}:{ts base64}:{counter}:{port} [{connection labels}] {ip} [{user data}] [{tags}] {message}
```

### Request Error
`req.log('error', new Error('¯\\_(ツ)_/¯')`
```
Example:
1474629596915:Stefan:26747:itfodt0w:10000:8080 [test|1] 127.0.0.1 [null] [ERROR] Error ¯\_(ツ)_/¯ \n {stack}
Explanation: 
{ timestamp }:{host}:{pid}:{ts base64}:{counter}:{port} [{connection labels}] {ip} [{user data}] [ERROR] {error stack trace}
```

### Reply
`res({success: true}}`
```
Example:
1474629596915:Stefan:26747:itfodt0w:10000:8080 [test|1] 127.0.0.1 [{uid: 1234}] 200 GET:/ 0.74[0.02~0+0.28~0.42]
Explanation:
{ timestamp }:{host}:{pid}:{ts base64}:{counter}:{port} [{connection labels}] {ip} [{user data}] {status code} {method}:{path} {total time ms}[{traffic in time + hapi head}~{auth time ms}+{handler time ms}~{traffic out time + hapi tail}]
Info: if the times don't add up that's because there's also time spent inside the `HAPI` server code 
```

### Unexpected Error
`throw 'up'`
```
Example:
1474629596915:Stefan:26747:itfodt0w:10000:8080 [test|1] 127.0.0.1 [null] [ERROR] Error: Uncaught error: up
Explanation: 
{ timestamp }:{host}:{pid}:{ts base64}:{counter}:{port} [{connection labels}] {ip} [{user data}] [ERROR] {error stack trace}
```

## Colors:
Colors will enable automatically

### Force colors off
Use `--no-color` or `--color=false`

### Force colors on
Use `--color`, `--color=true` or `--color=always`

## License
Please see [`license.md`](https://github.com/findie/hapi-console/blob/master/license.md)