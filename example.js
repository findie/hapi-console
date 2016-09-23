const Hapi = require('hapi');

const server = new Hapi.Server({ debug: false });

const plugin = require('./index');

server.connection({ port: 8080, labels: ['test', '1'] });
server.connection({ port: 8081, labels: ['test', '2'] });
// server.connection({ port: 8081 });

server.route({
    path: '/',
    method: 'get',
    handler: (req, res) => {
        'use strict';
        req.log('error', 'err');
        req.log('error', new Error());
        req.log('log', 'ana are mere');
        setTimeout(() => req.log('later', 'ana are pere'), 60);
        setTimeout(() => res(''), 200);
        server.log('log', 'this is a server log');
        server.log(['log', 'test']);
        req.log(['log', 'test']);
        setTimeout(() => {throw new Error('up')}, 100);
    }
});
server.route({
    path: '/ignore/me',
    method: 'get',
    handler: (req, res)=> {
        'use strict';
        return res('');
    }
});


server.route({
    path: '/test',
    method: 'get',
    handler: (req, res)=> {
        'use strict';
        return res('');
    }
});

server.register({
    register: plugin,
    options: {
        ignore: ['/ignore/me']
    }
}, (err) => {

    if (err) {
        throw err;
    }
});

server.start();