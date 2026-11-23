import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", 8080), handler)
    print("CrossPilot Prototype Web listening on http://0.0.0.0:8080")
    server.serve_forever()
