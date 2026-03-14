export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.0.1-test',
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response('Geekron CMS Server is running!', {
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}
