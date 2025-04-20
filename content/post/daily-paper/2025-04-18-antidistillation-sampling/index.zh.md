---
title: "每日论文：反蒸馏采样"
description: "本文提出反蒸馏采样方法，通过在生成时毒化大语言模型的推理轨迹来干扰模型蒸馏，同时保持原始模型性能。"
slug: 2025-04-antidistillation-sampling # Updated slug with date (must match English version)
date: 2025-04-18 00:00:00+0000
categories:
    - Daily Paper
tags:
    - AI
    - LLM
    - 模型蒸馏
    - 采样
    - 安全
---

**论文:** [Antidistillation Sampling](https://arxiv.org/abs/2504.13146)

**作者:** Yash Savani, Asher Trockman, Zhili Feng, Avi Schwarzschild, Alexander Robey, Marc Finzi, J. Zico Kolter (CMU)

**发表日期:** 2025年4月17日 (arXiv)

---

## 问题背景

大型语言模型（LLMs）生成的详细推理过程（Reasoning Traces）虽然强大，但也成了一个"漏洞"。
竞争对手可以利用这些公开的推理过程，通过"模型蒸馏"（Model Distillation）廉价地复制出强大的模型，造成知识产权泄露和潜在的安全风险（如绕过安全限制）。

## 提出方法：反蒸馏采样 (Antidistillation Sampling)

*   **核心思想:** 在不牺牲原模型（教师模型）性能的前提下，让其生成的推理过程"带毒"，干扰蒸馏过程。
*   **如何实现:** 这是一种采样策略，在模型生成每个 token 时：
    *   除了考虑教师模型本身的概率外，还引入一个"反蒸馏"调整项。
    *   这个调整项通过一个代理模型 (Proxy Model) 和一个下游任务的损失梯度来估计哪些 token 对蒸馏"有害"（即选择后会降低蒸馏效果）。
    *   最终从这个调整后的概率分布中采样下一个 token。
*   **关键:** 不修改原始教师模型，只在推理时调整采样过程，并且控制毒化强度避免对自身影响。

## 实验结果

*   **有效性:** 在保持教师模型准确率（如 GSM8K, MATH 数据集）的同时，使用反蒸馏采样生成的文本，显著降低了学生模型的蒸馏效果（准确率大幅下降）。
*   **优越性:** 相比简单提高采样温度（会导致教师模型性能急剧下降），反蒸馏采样提供了更好的性能-抗蒸馏能力的权衡。
*   **开销:** 主要增加了每次 token 生成时两次代理模型（小模型）的前向计算。 