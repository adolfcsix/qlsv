export function currentPort(argv = process.argv, env = process.env) {
    const index = argv.indexOf('--port');
    const value = Number(env.PORT || (index >= 0 ? argv[index + 1] : 5173));
    if (!Number.isSafeInteger(value) || value < 0 || value > 65535)
        throw new Error('PORT không hợp lệ.');
    return value;
}
