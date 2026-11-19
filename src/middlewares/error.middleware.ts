import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Unhandled Server Error:', err);

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request payload.',
    });
  }

  const message =
    err instanceof Error ? err.message : 'Internal server error.';

  return res.status(500).json({
    success: false,
    message,
  });
};