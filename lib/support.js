module.exports = (function() {
    const argv = process.argv;

    if (
        ~argv.indexOf('--no-color') ||
        ~argv.indexOf('--color=false') ||
        //(process.stdout && !process.stdout.isTTY) ||
        process.env.TERM === 'dumb'
    ) {
        return false;
    }

    if (
        ~argv.indexOf('--color') ||
        ~argv.indexOf('--color=true') ||
        ~argv.indexOf('--color=always') ||
        process.platform === 'win32' ||
        process.env['COLORTERM'] ||
        /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)
    ) {
        return true;
    }

    return false;
})();