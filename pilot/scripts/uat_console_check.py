"""T4：CDP 收集 P1-P7 控制台错误与 404（确认 favicon 清零、无业务错误）。"""
import sys
import time
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from uat_cdp import Browser

b = Browser(width=1366, height=768)
try:
    b.goto("http://127.0.0.1:8000/")
    time.sleep(1)
    b.js("window.__errs=[];window.onerror=function(m){window.__errs.push(String(m));return false;};"
         "window.addEventListener('unhandledrejection',function(e){window.__errs.push('reject:'+e.reason);});")
    for k in ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]:
        b.js("location.hash='#%s'" % k)
        time.sleep(0.6)
    errs = b.js("window.__errs")
    print("console errors:", json.dumps(errs, ensure_ascii=False))
    icon = b.js("document.querySelector('link[rel=icon]') ? document.querySelector('link[rel=icon]').href.slice(0,40) : '(none)'")
    print("favicon href:", icon)
    n404 = b.js("performance.getEntriesByType('resource').filter(function(r){return r.responseStatus>=400;}).length")
    print("resource >=400 count:", n404)
    b.screenshot("docs/uat-screenshots/1366-P7-final.png")
finally:
    b.close()
print("CONSOLE CHECK DONE")
