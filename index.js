'use strict';

const colors = require('./colors');

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

        credentials = colors.apply(`[${JSON.stringify(credentials)}]`, colors.lightBlue);

        const ip = colors.apply(
            req.headers['cf-connecting-ip'] ||
            req.headers['x-forwarded-for'] ||
            req.info.remoteAddress,
            colors.lightYellow
        );

        return (
            `\
${colors.apply(req.id, colors.lightCyan)} :${colors.apply(req.connection.info.port, colors.lightGrey)} \
${colors.apply(`[${req.connection.settings.labels.join('|')}]`, colors.lightGreen)} | \
${ip} \
${credentials} | \
`);
    };

    server.connections.forEach(connection => {
        console.log(Object.assign({ labels: connection.settings.labels }, connection.info));
    });


    server.on('request-internal', function(req, event) {
        if (~event.tags.indexOf("error") && event.data && event.data.isDeveloperError) {

            const error = event.data.data || event.data;
            const stack = error.stack || error;

            process.stderr.write(
                `\
${generatePrefix(req)}\
${colors.apply('[ERROR]', colors.red)} \
${colors.apply(stack, colors.red)}
`);
        }
    });

    server.on('request', function(req, event) {
        !ignored[req.path] && console.log(
            `\
${generatePrefix(req)}\
${colors.apply(`[${event.tags.join('/')}]`, colors.green)} \
${event.data instanceof Object ? JSON.stringify(event.data) : event.data}\
`);
    });

    server.on('log', function(data) {
        const serverID = server.info ? server.info.id : server.connections[0].info.id;
        console.log(
            `\
${colors.apply(`${Date.now()}:${serverID}      `, colors.cyan)} \
${colors.apply(`[${data.tags.join('/')}]`, colors.green)} | \
${data.data instanceof Object ? JSON.stringify(data.data) : data.data}\
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
    server.on('response', (req, res) => {
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
${colors.code(req.response.statusCode)} ${colors.method(req.method)}:${req.path} \
\
~ ${colors.apply(processTime(metrics.time) + 'ms', colors.green)} \
[ ${colors.apply(processTime(metrics.auth) + 'ms', colors.blue)} \
+ ${colors.apply(processTime(metrics.handler) + 'ms', colors.yellow)} ]\
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