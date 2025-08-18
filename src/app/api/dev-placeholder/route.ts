import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const path = searchParams.get('path');

  console.log(`[DEV] Intercepted request for ${type}: ${path}`);

  // Return appropriate responses for different development file types
  switch (type) {
    case 'vite':
      if (path?.includes('client')) {
        // Return empty client script
        return new NextResponse('console.log("Vite client not needed in Next.js");', {
          headers: { 'Content-Type': 'application/javascript' }
        });
      }
      break;
      
    case 'react-refresh':
      return new NextResponse('console.log("React refresh handled by Next.js");', {
        headers: { 'Content-Type': 'application/javascript' }
      });
      
    case 'dev-sw':
      return new NextResponse('console.log("Development service worker not needed");', {
        headers: { 'Content-Type': 'application/javascript' }
      });
      
    case 'src':
      if (path?.includes('main.jsx')) {
        return new NextResponse('console.log("main.jsx not needed in Next.js");', {
          headers: { 'Content-Type': 'application/javascript' }
        });
      }
      break;
      
    default:
      break;
  }

  // Return helpful JSON response for unhandled requests
  return NextResponse.json({
    message: 'Development file request intercepted',
    type,
    path,
    note: 'This is a Next.js app, not Vite. These files are not needed.',
    suggestion: 'Clear your browser cache if you see this message.'
  }, { status: 200 });
}