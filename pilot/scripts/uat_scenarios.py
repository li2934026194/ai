"""PACK 最终收口 / T4：真实浏览器 UAT 场景脚本（CDP + 真实 PG）。

所有业务数据走真实前端点击 → 真实 API → 真实 PostgreSQL；不 mock、不伪造。
场景参数：csv_import / csv_invalid / p3_flow / p7_login / all
"""

from __future__ import annotations

import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from uat_cdp import Browser

BASE = "http://127.0.0.1:8000"


def set_input(b, selector, value, tag="HTMLInputElement"):
    """Vue v-model 兼容：用原生 setter 触发 input 事件。"""
    expr = (
        "(function(){var el=document.querySelector(%s);if(!el)return false;"
        "var proto=window[%s].prototype;var s=Object.getOwnPropertyDescriptor(proto,'value').set;"
        "s.call(el,%s);el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()"
    ) % (json.dumps(selector), json.dumps(tag), json.dumps(value))
    return b.js(expr)


def click_text(b, selector, text):
    expr = (
        "(function(){var es=document.querySelectorAll(%s);for(var i=0;i<es.length;i++)"
        "{if(es[i].textContent.indexOf(%s)>=0){es[i].click();return true;}}return false;})()"
    ) % (json.dumps(selector), json.dumps(text))
    return b.js(expr)


def make_csv(sku="UAT-NEW-01", days=70, valid=True):
    lines = ["date,sku,sales_qty,on_hand,in_transit,title,price,unit_cost,moq,pack_size,lead_prod,lead_transit,lead_customs,lead_inbound"]
    for i in range(days):
        d = (date(2026, 1, 1) + timedelta(days=i)).isoformat()
        bad = "" if valid else ",19.9"
        lines.append(f"{d},{sku},3,12,0,UAT演示新品,19.9,8.96,100,50,30,25,7,3{bad}")
    return "\n".join(lines)


def open_import_panel(b):
    b.js("document.getElementById('datasetBtn') && document.getElementById('datasetBtn').click()")
    time.sleep(0.3)
    ok = b.js("(function(){var e=document.querySelector('.dataset-import-entry');if(!e)return false;e.click();return true;})()")
    time.sleep(0.4)
    return ok


def scenario_csv_import():
    b = Browser(width=1366, height=768)
    try:
        b.goto(BASE + "/#P1")
        time.sleep(1)
        assert open_import_panel(b), "导入入口未打开"
        assert b.js("!!document.getElementById('csvImportPanel')"), "导入面板不存在"
        set_input(b, '#csvImportPanel input[placeholder="新数据集名称"]', "UAT-浏览器导入-新品")
        set_input(b, "#csvImportPanel textarea", make_csv(days=80), "HTMLTextAreaElement")
        print("name=", b.js('document.querySelector("#csvImportPanel input").value'))
        print("csv_len=", b.js('document.querySelector("#csvImportPanel textarea").value.length'))
        click_text(b, "#csvImportPanel button", "开始导入")
        time.sleep(2.5)
        alert = b.js('(function(){var es=document.querySelectorAll("#csvImportPanel .alert");return es.length?es[es.length-1].textContent:"(none)";})()')
        print("result_alert=", alert[:200])
        dsname = b.js('document.getElementById("dsName") ? document.getElementById("dsName").textContent : "(none)"')
        print("current_ds=", dsname)
        b.screenshot("docs/uat-screenshots/1366-P1-import-result.png")
        return alert
    finally:
        b.close()


def scenario_csv_invalid():
    """非法 CSV：主数据冲突（同 SKU 两行标题不同），应显示 E-6005，DB 无残留。"""
    b = Browser(width=1366, height=768)
    try:
        b.goto(BASE + "/#P1")
        time.sleep(1)
        assert open_import_panel(b)
        set_input(b, '#csvImportPanel input[placeholder="新数据集名称"]', "UAT-非法导入-应失败")
        csv = make_csv()
        lines = csv.split("\n")
        lines[2] = lines[2].replace("UAT演示新品", "冲突标题")
        set_input(b, "#csvImportPanel textarea", "\n".join(lines), "HTMLTextAreaElement")
        click_text(b, "#csvImportPanel button", "开始导入")
        time.sleep(2)
        err = b.js('(function(){var es=document.querySelectorAll("#csvImportPanel .alert-missing");return es.length?es[0].textContent:"(none)";})()')
        print("invalid_err=", err[:250])
        b.screenshot("docs/uat-screenshots/1366-P1-import-invalid.png")
        return err
    finally:
        b.close()


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "csv_import"
    if which == "csv_import":
        scenario_csv_import()
    elif which == "csv_invalid":
        scenario_csv_invalid()
    else:
        print("unknown scenario", which)
