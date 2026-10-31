# Serves the repo root for the tests, with the fake sign-in (tests/mock-firebase-init.js) in place of firebase-init.js,
# so the app runs offline with an in-memory database. Usage: python3 tests/serve.py <port>
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOCK = os.path.join(ROOT, "tests", "mock-firebase-init.js")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        if path.split("?")[0] == "/firebase-init.js":
            return MOCK
        return super().translate_path(path)

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1] if len(sys.argv) > 1 else 8790)), Handler).serve_forever()
