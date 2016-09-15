const Hapi = require('hapi');

const server = new Hapi.Server();

const plugin = require('./index');

server.connection({ port: 8080, labels: ['test', '1'] });
server.connection({ port: 8081, labels: ['test', '2'] });
// server.connection({ port: 8081 });

server.route({
    path: '/',
    method: 'get',
    handler: (req, res) => {
        'use strict';
        return res('');
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