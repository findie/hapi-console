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
    return time[0] * 1000 + time[1] / 1e+6;
};

const formatDate = (timestamp) => {
    const d = (new Date(timestamp));

    return `UTC \
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

    server.connections.forEach(connection => {
        console.log(connection.info);
    });


    server.on('request-internal', function(request, event) {
        if (~event.tags.indexOf("error") && ~event.tags.indexOf("internal") && event.data) {
            console.error(event.data);
        }
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

        let credentials = JSON.stringify(req.credentials || null);

        console.log(
            `\
${req.server.info.host}:${req.server.info.port}|\
${formatDate(metrics.start)} \
[${credentials}] \
${req.method.toUpperCase()}:${req.path} \
\
~ ${processTime(metrics.time)}ms [ ${processTime(metrics.auth)}ms + ${processTime(metrics.handler)}ms ]\
`);
        delete requests[req.id];

        credentials = null;
        metrics = null;

        res.continue();
    });

    // server.on

    return next();
};

hapiConsole.register.attributes = {
    pkg: require('./package.json')
};

module.exports = hapiConsole;
