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
 * @return {*}
 */
hapiConsole.register = async (server, options) => {
  options = options || {};

  if (options.userFilter) {
    console.warn(hapiConsole.name, ':', '`userFilter` is deprecated! Please use `custom` instead')
  }
  options.custom = options.custom || {};

  const info = server.info;
  process.stdout.write(`\
SERVER STARTED
    ID:         ${info.id}
    PORT:       ${info.port}
    HOST:       ${info.host}
    PROTOCOL:   ${info.protocol}
    URI:        ${info.uri}
`);

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
${colors.apply(req.info.id, colors.lightCyan)}${colors.apply(`:${server.info.port}`, colors.lightGrey)} \
${ip} \
${customDataText} \
`);
  };


  const writeError = (req, event) => {
    const error = (event.data && event.data.data) || event.data || event.error;
    const stack = error && error.stack || error;

    setTimeout(() => process.stderr.write(
      `\
${generatePrefix(req)}\
${colors.apply('[ERROR]', colors.red)} \
${colors.apply(stack, colors.red)}
`), 10);
  };

  server.events.on('request', function (req, event) {
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

  server.events.on('log', function (data) {
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
    requests.set(req.info.id, { time: process.hrtime(), start: Date.now() });
    // res.continue();
    return res.continue;
  });

  server.ext('onPreAuth', (req, res) => {
    const o = requests.get(req.info.id);
    o.trafficIn = o.time ? processTime(process.hrtime(o.time)) : undefined;
    o.auth = process.hrtime();
    return res.continue;
  });

  server.ext('onPostAuth', (req, res) => {
    const o = requests.get(req.info.id);
    o.auth = o.auth ? processTime(process.hrtime(o.auth)) : undefined;
    return res.continue;
  });

  server.ext('onPreHandler', (req, res) => {
    requests.get(req.info.id).handler = process.hrtime();
    return res.continue;
  });

  server.ext('onPostHandler', (req, res) => {
    const o = requests.get(req.info.id);
    o.handler = o.handler ? processTime(process.hrtime(o.handler)) : undefined;
    o.trafficOut = process.hrtime();
    return res.continue;
  });
  server.events.on('response', (req, event) => {
    const timings = requests.get(req.info.id) || {};

    timings.time = timings.time ? processTime(process.hrtime(timings.time)) : undefined;
    timings.trafficOut = timings.trafficOut ? processTime(process.hrtime(timings.trafficOut)) : undefined;

    const statusCode = (req.response && req.response.statusCode) || 'CONNECTION-KILLED';

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
    requests.delete(req.info.id);
  });
};

hapiConsole.name = require('./package').name;
hapiConsole.version = require('./package').version;

module.exports = hapiConsole;