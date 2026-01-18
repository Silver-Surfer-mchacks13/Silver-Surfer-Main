'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div style={{ padding: '40px', textAlign: 'center' }}>Loading API Documentation...</div>
});

export default function ApiDocs() {
  return (
    <div style={{ padding: '20px' }}>
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}
