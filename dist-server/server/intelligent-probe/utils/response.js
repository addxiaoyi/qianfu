export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    const response = {
        success: true,
        message,
        data,
    };
    res.status(statusCode).json(response);
};
export const errorResponse = (res, message = 'An error occurred', statusCode = 500, errorDetails) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const displayMessage = isProduction && statusCode >= 500
        ? 'An unexpected error occurred'
        : message;
    const response = {
        success: false,
        message: displayMessage,
        error: isProduction
            ? (statusCode >= 500 ? undefined : (errorDetails ? JSON.stringify(errorDetails) : message))
            : (errorDetails ? JSON.stringify(errorDetails) : message),
    };
    res.status(statusCode).json(response);
};
//# sourceMappingURL=response.js.map