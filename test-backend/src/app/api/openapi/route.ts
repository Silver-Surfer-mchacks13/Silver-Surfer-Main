import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/openapi';

export async function GET() {
  return NextResponse.json(swaggerSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
