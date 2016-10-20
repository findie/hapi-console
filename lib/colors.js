const support = require('./support');
const c = module.exports = {
    reset: [0, 0],

    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    grey: [90, 39],

    lightBlack: [90, 99],
    lightRed: [91, 99],
    lightGreen: [92, 99],
    lightYellow: [93, 99],
    lightBlue: [94, 99],
    lightMagenta: [95, 99],
    lightCyan: [96, 99],
    lightWhite: [97, 99],
    lightGrey: [90, 99],

    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
};

const apply = module.exports.apply = (text, color) => {
    return support ? `\u001b[${color[0]}m${text}\u001b[${color[1]}m` : text;
};

const methods =
    [/*offset*/
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'head',
        'options'];
const methodColors =
    [c.white,
        c.green,
        c.yellow,
        c.magenta,
        c.blue,
        c.red,
        c.cyan,
        c.grey
    ];
module.exports.method = (type) => {
    return apply(
        type.toUpperCase(),
        methodColors[methods.indexOf(type.toLowerCase()) + 1]
    )
};
module.exports.code = (code)=> {
    if (code < 200) {
        return apply(code, c.white);
    }

    if (code < 300) {
        return apply(code, c.green);
    }

    if (code < 400) {
        return apply(code, c.cyan);
    }

    if (code < 500) {
        return apply(code, c.yellow);
    }

    return apply(code, c.red);
};

module.exports.resetStr = apply('', c.reset);
