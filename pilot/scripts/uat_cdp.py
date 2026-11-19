"""PACK 最终收口 / T4：真实浏览器 UAT 的 CDP 驱动（Edge headless）。

只做浏览器自动化，不伪造任何业务数据。所有断言读真实 DOM / Network / 真实 PG。
用法：.venv\\Scripts\\python.exe scripts\\uat_cdp.py <场景名>
场景：layout / p5 / login / full
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket  # websocket-client

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CDP_PORT = 9222
BASE = "http://127.0.0.1:8000"


class Browser:
    def __init__(self, width=1366, height=768):
        self.profile = tempfile.mkdtemp(prefix="pilot_uat_")
        self.proc = subprocess.Popen([
            EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", "--hide-scrollbars",
            f"--remote-debugging-port={CDP_PORT}",
            f"--user-data-dir={self.profile}",
            f"--window-size={width},{height}",
            "about:blank",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.ws = None
        self._id = 0
        for _ in range(40):
            try:
                tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=2).read())
                page = next(t for t in tabs if t.get("type") == "page")
                self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30)
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("CDP 连接失败")
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call("Network.enable")

    def call(self, method, params=None):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method}: {msg['error']}")
                return msg.get("result", {})

    def goto(self, url):
        self.call("Page.navigate", {"url": url})
        time.sleep(1.5)

    def js(self, expr):
        r = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in r:
            raise RuntimeError(str(r["exceptionDetails"]))
        return r.get("result", {}).get("value")

    def set_viewport(self, width, height):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
        })
        time.sleep(0.5)

    def screenshot(self, path):
        import base64
        r = self.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        Path(path).write_bytes(base64.b64decode(r["data"]))

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


def check_layout(b):
    """返回每页 {page: {scrollW, clientW, overflow}}。"""
    out = {}
    for key in ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]:
        b.js(f"location.hash='#{key}'")
        time.sleep(0.6)
        m = b.js("({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, h:location.hash})")
        out[key] = {"scrollW": m["sw"], "clientW": m["cw"], "overflow": m["sw"] > m["cw"], "hash": m["h"]}
    return out
