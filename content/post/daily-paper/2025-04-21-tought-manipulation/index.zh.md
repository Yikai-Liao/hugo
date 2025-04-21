---
title: "每日论文：思维操纵"
description: "本文提出 ThoughtMani，一种无需训练的方法，通过利用小模型生成的链式思维（CoT）减少大型推理模型的冗余推理，提升效率和安全性。"
slug: 2025-04-thought-manipulation
date: 2025-04-18 00:00:00+0000
categories:
    - Daily Paper
tags:
    - AI
    - LLM
    - 推理
    - 效率
---

**论文:** [Thought Manipulation: External Thought Can Be Efficient for Large Reasoning Models](https://arxiv.org/abs/2504.13626)

**作者:** Yule Liu, Jingyi Zheng, Zhen Sun, Zifan Peng, Wenhan Dong, Zeyang Sha, Shiwen Cui, Weiqiang Wang, Xinlei He (香港科技大学（广州校区），蚂蚁集团)

**发表日期:** 2025年4月18日 (arXiv)

---

## 问题背景

大型推理模型（LRMs）通过生成逐步的链式思维（CoT）在复杂任务中表现出色。然而，它们常因“过度思考”生成冗余推理步骤，导致计算成本增加而性能提升有限。现有的解决方案，如微调，需要额外数据，可能导致安全对齐问题，且泛化能力差。

## 提出方法：ThoughtMani

* **核心思想:** 利用小模型生成高层次 CoT，插入到 LRM 输入中引导推理，减少冗余步骤，无需训练。
* **如何实现:** 
  * 小模型（如 Qwen-2.5-7B-Instruct）生成简洁的 CoT，置于 `<think>` 和 `</think>` 标记之间，仅包含关键推理步骤，不含计算细节。
  * 将 CoT 附加到 LRM 的推理模板中，使 LRM（如 QwQ-32B）跳过不必要的中间推理。
  * `<STOP>` 机制确保小模型在复杂问题上放弃生成 CoT，让 LRM 直接处理，避免误导。
* **关键:** ThoughtMani 无需训练，利用 LRM 基于外部 CoT 动态调整推理的能力，并通过安全对齐的小模型提升安全性。

## 实验结果

* **有效性:** 在 GSM8K 和 MATH-500 等数据集上，ThoughtMani 对 RL-based LRM（如 QwQ-32B）减少 1%-37% 的 token 量，性能损失仅 0.8%-7.2%；对蒸馏模型减少高达 86%，但损失较大（4.5%-20.4%）。
* **优越性:** 相比微调（TokenSkip、CoT-Valve）或提示压缩等基线，ThoughtMani 效率更高，安全性提升 10%，而微调方法安全性下降 7%。
* **开销:** 极低，小模型每次 CoT 生成仅需 7-209 个 token，远少于 LRM 节省的数千 token。