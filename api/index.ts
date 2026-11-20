import type { Request, Response } from 'express';
import handler from '../src/index';

export default async function vercelHandler(req: Request, res: Response) {
  return handler(req, res);
}