"""
Simple HTTP server with no-cache headers so browser always gets fresh files.
Run: python server.py
Then open: http://localhost:8080
"""
import http.server
import socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # suppress request logs

PORT = 8080
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving at http://localhost:{PORT}  (no-cache mode)')
    httpd.serve_forever()
