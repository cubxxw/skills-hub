import { Request, Response } from 'express'

export interface HealthResponse {
  status: string
  message: string
  timestamp: string
}

export function helloWorld(_req: Request, res: Response<HealthResponse>): void {
  res.json({
    status: 'ok',
    message: 'Hello, World! Welcome to AG-UI Skill Platform API',
    timestamp: new Date().toISOString(),
  })
}
