export class AppError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function ensure(ok, message = 'Dữ liệu không hợp lệ.', status = 422, code = 'VALIDATION_ERROR') { if (!ok)
    throw new AppError(status, code, message); }
