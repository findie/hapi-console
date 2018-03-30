const Hapi = require('hapi');

const server = new Hapi.Server({ port: 3000 });

const plugin = require('./index');

// server.connection({ port: 8080, labels: ['test', '1'] });
// server.connection({ port: 8081, labels: ['test', '2'] });
// server.connection({ port: 8081 });

server.route({
  path: '/',
  method: 'get',
  handler: (req) => {
    'use strict';
    req.log('error', 'err');
    req.log('error', new Error());
    req.log('log', 'log 1');
    setTimeout(() => req.log('later', 'log 2'), 60);
    server.log('log', 'this is a server log');
    server.log(['log', 'test']);
    req.log(['log', 'test']);
    throw new Error('up');

    return '';
  }
});
server.route({
  path: '/ignore/me',
  method: 'get',
  handler: (req, res) => {
    'use strict';
    return res('');
  }
});


server.route({
  path: '/test',
  method: 'get',
  handler: (req) => {
    'use strict';
    return '';
  }
});

(async () => {
  await server.register({
    plugin,
    options: {
      ignore: ['/ignore/me'],
      custom: {
        'auth.credentials.uid': true,
        'query': true,
        'headers': (x) => JSON.stringify(x).replace(/"/g, '')
      },
      customFullLengthKey: false,
      userFilter: {}
    }
  });

  await server.start();
})().catch(console.error);


