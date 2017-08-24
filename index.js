'use strict';

const colors = require('./lib/colors');

const hapiConsole = {};
const requests = new Map();

const processTime = (time) => {
  return !time ?
    0 :
    ((((time[0] * 1000 + time[1] / 1e+6) * 100) | 0) / 100);
};

const displayTime = (time) => {
  return isNaN(time) ? '?' : ((time * 100) | 0) / 100;
};

const displayCustomData = (req, custom, fullLenKey) => {
  const keyVal = [];
  Object.keys(custom).forEach(key => {
    const keyParts = key.split('.');

    let pointer = req;
    keyParts.forEach(part => {
      if (!(pointer instanceof Object)) {
        return;
      }
      pointer = pointer[part];
    });
    if (pointer === undefined) {
      return;
    }

    const data = typeof custom[key] === 'function' ? custom[key](pointer) : JSON.stringify(pointer);

    keyVal.push(`${fullLenKey ? key : keyParts[keyParts.length - 1]}:${data}`);
  });

  return keyVal.join('|');
};

/**
 *
 * @param server
 * @param {Object} [options]
 * @param {Object=} [options.userFilter] DEPRECATED
 * @param {Object.<String, Boolean|function(*)>} [options.custom] Custom output in console
 * @param {Array.<String|RegExp>} [options.ignore] Paths fo ignore output from
 * @param {Boolean} [options.customFullLengthKey] Display the full length of the key or only the extension
 * @param {Boolean} [options.ignoreSyscall] Won't display syscall errors
 * @param next
 * @return {*}
 */
hapiConsole.register = function(server, options, next) {
  options = options || {};

  if (options.userFilter) {
    console.warn(hapiConsole.register.attributes.pkg.name, ':', '`userFilter` is deprecated! Please use `custom` instead')
  }
  options.custom = options.custom || {};

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
    let customDataText = displayCustomData(req, options.custom, options.customFullLengthKey);

    customDataText = colors.apply(`[${customDataText}]`, colors.lightBlue);

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
${customDataText} \
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
    const isError = data.tags && !!~data.tags.indexOf('error');

    if (isError && options.ignoreSyscall && data.data && data.data.syscall) {
      return;
    }

    const serverID = server.info ? server.info.id : server.connections[0].info.id;
    process.stdout.write(
      `\
${colors.apply(`${Date.now()}:${serverID} `, colors.cyan)} | \
${colors.apply(`[${data.tags.join('/')}]`, colors.green)} \
${(data.data instanceof Object ? JSON.stringify(data.data) : data.data) || ''}
`);
  });

  server.ext('onRequest', (req, res) => {
    requests.set(req.id, { time: process.hrtime(), start: Date.now() });
    res.continue();
  });

  server.ext('onPreAuth', (req, res) => {
    const o = requests.get(req.id);
    o.trafficIn = o.time ? processTime(process.hrtime(o.time)) : undefined;
    o.auth = process.hrtime();
    res.continue();
  });

  server.ext('onPostAuth', (req, res) => {
    const o = requests.get(req.id);
    o.auth = o.auth ? processTime(process.hrtime(o.auth)) : undefined;
    res.continue();
  });

  server.ext('onPreHandler', (req, res) => {
    requests.get(req.id).handler = process.hrtime();
    res.continue();
  });

  server.ext('onPostHandler', (req, res) => {
    const o = requests.get(req.id);
    o.handler = o.handler ? processTime(process.hrtime(o.handler)) : undefined;
    o.trafficOut = process.hrtime();
    res.continue();
  });
  server.on('response', (req, event) => {
    const timings = requests.get(req.id) || {};

    timings.time = timings.time ? processTime(process.hrtime(timings.time)) : undefined;
    timings.trafficOut = timings.trafficOut ? processTime(process.hrtime(timings.trafficOut)) : undefined;

    const statusCode = ( req.response && req.response.statusCode ) || 'CONNECTION-KILLED';

    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.info.remoteAddress;

    !ignored[req.path] && process.stdout.write(
      `\
${generatePrefix(req)}\
${colors.code(statusCode)} ${colors.method(req.method)}:${req.path}\
\
 ${colors.apply(displayTime(timings.time), colors.green)}\
[\
${colors.apply(displayTime(timings.trafficIn), colors.grey)}~\
${colors.apply(displayTime(timings.auth), colors.blue)}+\
${colors.apply(displayTime(timings.handler), colors.yellow)}~\
${colors.apply(displayTime(timings.trafficOut), colors.lightGrey)}\
]
`);
    requests.delete(req.id);
  });

  return next();
};

hapiConsole.register.attributes = {
  pkg: require('./package.json')
};

module.exports = hapiConsole;