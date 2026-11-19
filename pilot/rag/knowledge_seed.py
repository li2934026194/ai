"""跨境电商客服 FAQ 种子知识（rag/knowledge_seed.py）。

全部为合成演示数据：每条 source_type 恒为 "SYNTHETIC"，
不得冒充真实客服记录或真实经营数据（PACK 8 硬约束 6）。

字段说明：
  id          - 稳定主键， Milvus 里作 INT64 主键
  category    - 主题分类（物流/退换货/关税/支付/订单/清关）
  question    - 用户常问问法
  answer      - 标准答复
  chunk_text  - 真正向量化的文本（question + answer 拼在一起，语义检索用）
  source_type - 恒为 "SYNTHETIC"
"""

from __future__ import annotations

# 每条都是演示用合成问答，不来自任何真实客户会话。
_SEED: list[dict] = [
    {"id": 1, "category": "物流时效", "question": "标准配送一般多久能到？",
     "answer": "标准配送通常 7-12 个工作日送达，具体以目的地清关和当地派送为准。"},
    {"id": 2, "category": "物流时效", "question": "有没有更快的配送方式？",
     "answer": "有Express加速配送，通常 3-5 个工作日送达，运费在结算页按重量计算。"},
    {"id": 3, "category": "物流时效", "question": "为什么我的包裹物流很久没更新？",
     "answer": "国际段运输期间物流可能有 2-3 天不更新，超过 7 天无更新可凭订单号联系客服核查。"},
    {"id": 4, "category": "物流时效", "question": "包裹显示已签收但我没收到怎么办？",
     "answer": "请先核对收货地址与代收点，确认后 48 小时内凭订单号联系我们发起物流调查。"},
    {"id": 5, "category": "退换货", "question": "支持多少天无理由退换？",
     "answer": "签收后 30 天内，商品保持完好可申请无理由退货，定制类商品除外。"},
    {"id": 6, "category": "退换货", "question": "退货运费谁承担？",
     "answer": "质量问题由我们承担退货运费；个人原因无理由退货由买家承担寄回运费。"},
    {"id": 7, "category": "退换货", "question": "收到商品有破损怎么办？",
     "answer": "请在签收后 48 小时内提供开箱照片和破损照片，核实后免费补发或全额退款。"},
    {"id": 8, "category": "退换货", "question": "可以申请换货吗？多久处理？",
     "answer": "支持同款换货，仓库收到退回商品后 3-5 个工作日内寄出换货商品。"},
    {"id": 9, "category": "关税税费", "question": "价格是否包含关税？",
     "answer": "商品标价不含进口关税，关税由目的地海关按当地政策收取，买家自行承担。"},
    {"id": 10, "category": "关税税费", "question": "会被收多少关税？",
     "answer": "关税税率因国家和品类而异，请在下单前咨询当地海关，我们无法代为预估具体金额。"},
    {"id": 11, "category": "关税税费", "question": "关税是谁代缴的？",
     "answer": "部分线路提供DDP包税服务，结算页会明确标注；未标注的线路关税由买家到付。"},
    {"id": 12, "category": "支付", "question": "支持哪些支付方式？",
     "answer": "支持信用卡、借记卡、PayPal 及部分地区的本地钱包，结算页会显示可用方式。"},
    {"id": 13, "category": "支付", "question": "支付失败但钱被扣了怎么办？",
     "answer": "支付扣款未生成订单通常会在 1-3 个工作日原路退回，如未退回请提供支付流水号核查。"},
    {"id": 14, "category": "支付", "question": "可以使用优惠券吗？",
     "answer": "可在结算页输入优惠码，优惠券不可叠加使用，具体有效期以活动页面为准。"},
    {"id": 15, "category": "支付", "question": "支持分期付款吗？",
     "answer": "部分地区的信用卡支持分期，是否在结算页可见取决于发卡行和支付渠道。"},
    {"id": 16, "category": "订单", "question": "可以修改收货地址吗？",
     "answer": "订单发货前可联系客服修改收货地址，发货后无法更改，请谨慎填写。"},
    {"id": 17, "category": "订单", "question": "如何取消订单？",
     "answer": "未发货订单可在订单页自助取消，已发货订单需走退货流程。"},
    {"id": 18, "category": "订单", "question": "下单后多久发货？",
     "answer": "现货商品通常 1-2 个工作日内发出，预售商品以商品页标注的发货时间为准。"},
    {"id": 19, "category": "订单", "question": "如何查询订单状态？",
     "answer": "在订单页输入订单号即可查询状态，也可凭订单号联系客服获取人工核查。"},
    {"id": 20, "category": "清关", "question": "清关需要我提供什么材料？",
     "answer": "部分国家清关需要收件人身份证号或税号，我们会通过邮件提前通知您提交。"},
    {"id": 21, "category": "清关", "question": "包裹被海关扣留怎么办？",
     "answer": "请按海关通知补齐材料或缴纳税费，如需协助可提供订单号由我们配合提供商业发票。"},
    {"id": 22, "category": "清关", "question": "可以指定清关代理吗？",
     "answer": "标准线路使用我们合作的清关代理，暂不支持买家自指定代理。"},
    {"id": 23, "category": "商品", "question": "商品是正品吗？有保修吗？",
     "answer": "所有商品均为正规渠道采购，提供 12 个月有限保修，人为损坏不在保修范围。"},
    {"id": 24, "category": "商品", "question": "可以开发票吗？",
     "answer": "可提供电子发票，下单时在备注中填写开票信息，发货后 7 个工作日内发送到邮箱。"},
    {"id": 25, "category": "商品", "question": "页面显示缺货什么时候补货？",
     "answer": "缺货商品通常 2-4 周补货，可联系客服登记到货通知，补货后会第一时间提醒。"},
]


def seed_chunks() -> list[dict]:
    """返回可直接灌库的种子列表，每条都带 source_type='SYNTHETIC'。

    返回字段：id / category / question / answer / chunk_text / source_type。
    chunk_text = question + answer，是真正做 embedding 的文本。
    """
    rows: list[dict] = []
    for item in _SEED:
        rows.append(
            {
                "id": item["id"],
                "category": item["category"],
                "question": item["question"],
                "answer": item["answer"],
                "chunk_text": f"{item['question']} {item['answer']}",
                "source_type": "SYNTHETIC",
            }
        )
    return rows


__all__ = ["seed_chunks", "_SEED"]
