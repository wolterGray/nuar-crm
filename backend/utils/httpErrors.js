function getHttpErrorResponse(error) {
  if (error?.code === 'P2002') {
    return {
      message: 'Record with this unique value already exists',
      status: 409,
    };
  }

  if (error?.code === 'P2025') {
    return {
      message: 'Record not found',
      status: 404,
    };
  }

  if (
    error?.name === 'ZodError' ||
    error?.name === 'ValidationError' ||
    error?.status === 422
  ) {
    return {
      message: error?.message || 'Validation failed',
      status: 422,
    };
  }

  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
    return {
      message: error?.message || 'Request failed',
      status: error.status,
    };
  }

  return {
    message: error?.message || 'Internal Server Error',
    status: 500,
  };
}

module.exports = {
  getHttpErrorResponse,
};
