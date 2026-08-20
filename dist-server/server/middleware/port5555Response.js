export function successResponse(res, data, message, statusCode = 200) {
    res.status(statusCode).json({
        success: true,
        data,
        message,
    });
}
export function errorResponse(res, error, statusCode = 400) {
    res.status(statusCode).json({
        success: false,
        error,
    });
}
//# sourceMappingURL=port5555Response.js.map