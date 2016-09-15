const Hapi = require('hapi');

const server = new Hapi.Server();

const plugin = require('./index');

server.connection({ port: 8080 });
// server.connection({ port: 8081 });

server.route({
    path: '/',
    method: 'get',
    handler: (req, res) => {
        'use strict';
        return res('');
    }
});

server.register({
    register: plugin,
    options: {
        message: 'hello'
    }
}, (err) => {

    if (err) {
        throw err;
    }
});

server.start();