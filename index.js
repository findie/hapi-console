'use strict';

const colors = require('./lib/colors');

const hapiConsole = {};
const requests = {};

const processTime = (time) => {
    return !time ?
        0 :
        ((((time[0] * 1000 + time[1] / 1e+6) * 100) | 0) / 100);
};

const displayTime = (time) => {
    return isNaN(time) ? '?' : ((time * 100) | 0) / 100;
};

hapiConsole.register = function(server, options, next) {
    options = options || {};

    options.userFilter = options.userFilter || { uid: 1 };

    server.connections.forEach(connection => {
        const info = connection.info;
        process.stdout.write(`\
SERVER ${connection.settings.labels.join('/')} STARTED
    ID:         ${info.id}
    PORT:       ${info.port}
    HOST:       ${info.host}
    PROTOCOL:   ${info.protocol}
    URI:        ${info.uri}
`);
    });

    const ignored = (options && options.ignore || [])
        .reduce((obj, path) => {
            obj[path] = 1;
            return obj
        }, {});


    const generatePrefix = (req) => {
        let credentials = (req.auth && req.auth.credentials) || {};
        Object.keys(credentials).forEach(key => {
            if (!options.userFilter[key]) delete credentials[key];
        });

        if (!Object.keys(credentials).length) credentials = null;

        credentials = colors.apply(`[${JSON.stringify(credentials)}]`, colors.lightBlue);

        const ip = colors.apply(
            req.headers['cf-connecting-ip'] ||
            req.headers['x-forwarded-for'] ||
            req.info.remoteAddress,
            colors.lightYellow
        );

        return (
            `\
${colors.apply(req.id, colors.lightCyan)}${colors.apply(`:${req.connection.info.port}`, colors.lightGrey)} \
${colors.apply(`[${req.connection.settings.labels.join('/')}]`, colors.lightGreen)} \
${ip} \
${credentials} \
`);
    };


    const writeError = (req, event) => {
        const error = (event.data && event.data.data) || event.data;
        const stack = error.stack || error;

        setTimeout(() => process.stderr.write(
            `\
${generatePrefix(req)}\
${colors.apply('[ERROR]', colors.red)} \
${colors.apply(stack, colors.red)}
`), 10);
    };

    server.on('request-internal', function(req, event) {
        if (~event.tags.indexOf("error") && event.data && event.data.isDeveloperError) {
            writeError(req, event);
        }
    });

    server.on('request', function(req, event) {
        if (~event.tags.indexOf('err') || ~event.tags.indexOf('error')) {
            return writeError(req, event);
        }

        !ignored[req.path] && process.stdout.write(
            `\
${generatePrefix(req)}\
${colors.apply(`[${event.tags.join('/')}]`, colors.green)} \
${(event.data instanceof Object ? JSON.stringify(event.data) : event.data) || ''}
`);
    });

    server.on('log', function(data) {
        const serverID = server.info ? server.info.id : server.connections[0].info.id;
        process.stdout.write(
            `\
${colors.apply(`${Date.now()}:${serverID} `, colors.cyan)} | \
${colors.apply(`[${data.tags.join('/')}]`, colors.green)} \
${(data.data instanceof Object ? JSON.stringify(data.data) : data.data) || ''}
`);
    });

    server.ext('onRequest', (req, res) => {
        requests[req.id] = { time: process.hrtime(), start: Date.now() };
        res.continue();
    });
    server.ext('onPreAuth', (req, res) => {
        requests[req.id].trafficIn = requests[req.id].time ? processTime(process.hrtime(requests[req.id].time)) : undefined;
        requests[req.id].auth = process.hrtime();
        res.continue();
    });
    server.ext('onPostAuth', (req, res) => {
        requests[req.id].auth = requests[req.id].auth ? processTime(process.hrtime(requests[req.id].auth)) : undefined;
        res.continue();
    });
    server.ext('onPreHandler', (req, res) => {
        requests[req.id].handler = process.hrtime();
        res.continue();
    });
    server.ext('onPostHandler', (req, res) => {
        requests[req.id].handler = requests[req.id].handler ? processTime(process.hrtime(requests[req.id].handler)) : undefined;
        requests[req.id].trafficOut = process.hrtime();
        res.continue();
    });
    server.on('response', (req, event) => {
        requests[req.id].time = processTime(process.hrtime(requests[req.id].time));
        requests[req.id].trafficOut = requests[req.id].trafficOut ? processTime(process.hrtime(requests[req.id].trafficOut)) : undefined;

        let metrics = requests[req.id];

        let credentials = (req.auth && req.auth.credentials) || {};
        Object.keys(credentials).forEach(key => {
            if (!options.userFilter[key]) delete credentials[key];
        });

        if (!Object.keys(credentials).length) credentials = null;

        credentials = JSON.stringify(credentials);

        const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.info.remoteAddress;

        !ignored[req.path] && process.stdout.write(
            `\
${generatePrefix(req)}\
${colors.code(req.response.statusCode)} ${colors.method(req.method)}:${req.path}\
\
 ${colors.apply(displayTime(metrics.time), colors.green)}\
[\
${colors.apply(displayTime(metrics.trafficIn), colors.grey)}~\
${colors.apply(displayTime(metrics.auth), colors.blue)}+\
${colors.apply(displayTime(metrics.handler), colors.yellow)}~\
${colors.apply(displayTime(metrics.trafficOut), colors.lightGrey)}\
]
`);
        delete requests[req.id];

        credentials = null;
        metrics = null;
    });

    return next();
};

hapiConsole.register.attributes = {
    pkg: require('./package.json')
};

module.exports = hapiConsole;