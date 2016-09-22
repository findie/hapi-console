'use strict';

const hapiConsole = {};

const requests = {};

const pad = (width, text, char) => {
    const leftToPad = width - text.toString().length;
    if (width <= 0) {
        return text;
    }

    const charToPad = char || '0';

    return charToPad.repeat(leftToPad) + text;
};

const processTime = (time) => {
    if (!time) {
        return 0;
    }

    return time[0] * 1000 + time[1] / 1e+6;
};

const formatDate = (timestamp) => {
    const d = (new Date(timestamp));

    return `\
${d.getUTCFullYear()}-\
${pad(2, d.getUTCMonth())}-\
${pad(2, d.getUTCDate())} \
${pad(2, d.getUTCHours())}:\
${pad(2, d.getUTCMinutes())}:\
${pad(2, d.getUTCSeconds())}.\
${pad(3, d.getUTCMilliseconds())}`;

};

hapiConsole.register = function(server, options, next) {
    console.log('Starting server(s):');

    options = options || {};

    options.userFilter = options.userFilter || { uid: 1 };

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

        credentials = JSON.stringify(credentials);

        const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.info.remoteAddress;

        return (
            `\
${req.id} :${req.connection.info.port} \
[${req.connection.settings.labels.join('|')}] | \
${ip} \
[${credentials}] | \
`);
    };

    server.connections.forEach(connection => {
        console.log(Object.assign({ labels: connection.settings.labels }, connection.info));
    });


    server.on('request-internal', function(request, event) {
        if (~event.tags.indexOf("error") && ~event.tags.indexOf("internal") && event.data) {
            console.error(event.data);
        }
    });


    server.on('request', function(req, event) {
        !ignored[req.path] && console.log(
            `\
${generatePrefix(req)}\
[${event.tags.join('/')}] \
${event.data instanceof Object ? JSON.stringify(event.data) : event.data}\
`);
    });

    server.ext('onRequest', (req, res) => {
        requests[req.id] = { time: process.hrtime(), start: Date.now() };
        res.continue();
    });
    server.ext('onPreAuth', (req, res) => {
        requests[req.id].auth = process.hrtime();
        res.continue();
    });
    server.ext('onPostAuth', (req, res) => {
        requests[req.id].auth = process.hrtime(requests[req.id].auth);
        res.continue();
    });
    server.ext('onPreHandler', (req, res) => {
        requests[req.id].handler = process.hrtime();
        res.continue();
    });
    server.ext('onPostHandler', (req, res) => {
        requests[req.id].handler = process.hrtime(requests[req.id].handler);
        res.continue();
    });
    server.ext('onPreResponse', (req, res) => {
        requests[req.id].time = process.hrtime(requests[req.id].time);

        let metrics = requests[req.id];

        let credentials = (req.auth && req.auth.credentials) || {};
        Object.keys(credentials).forEach(key => {
            if (!options.userFilter[key]) delete credentials[key];
        });

        if (!Object.keys(credentials).length) credentials = null;

        credentials = JSON.stringify(credentials);

        const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.info.remoteAddress;

        !ignored[req.path] && console.log(
            `\
${generatePrefix(req)}\
${req.response.statusCode} ${req.method.toUpperCase()}:${req.path} \
\
~ ${processTime(metrics.time)}ms [ ${processTime(metrics.auth)}ms + ${processTime(metrics.handler)}ms ]\
`);
        delete requests[req.id];

        credentials = null;
        metrics = null;

        res.continue();
    });

    return next();
};

hapiConsole.register.attributes = {
    pkg: require('./package.json')
};

module.exports = hapiConsole;