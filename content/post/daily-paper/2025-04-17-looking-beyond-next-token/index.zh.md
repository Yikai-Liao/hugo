---
title: "每日论文：Trelawney - 超越下一个Token的预测"
description: "提出Trelawney训练方法，通过在训练序列中显式插入用特殊标记(<T>, </T>)界定的未来信息（lookahead tokens），使语言模型学习规划和利用未来目标，提升其在规划、算法推理和故事生成等任务上的表现。"
slug: "2025-04-looking-beyond-next-token"
date: "2025-04-17 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "LLM"
    - "规划"
    - "推理"
    - "语言模型训练"
    - "可控生成"
---
**论文:** [Looking beyond the next token](https://arxiv.org/abs/2504.11336)

**作者:** Abitha Thankaraj, Yiding Jiang, J. Zico Kolter, Yonatan Bisk (Carnegie Mellon University)

**发表日期:** 2025年4月15日 (arXiv)

---

## 问题背景

传统的自回归语言模型训练（Next-Token Prediction, NTP）假设每个token仅依赖于之前的上下文。这与人类写作或解决问题时通常先有目标再组织具体步骤/措辞的过程不符。这种错位以及teacher forcing带来的问题（如Clever Hans Cheat, Indecipherable Token Problem, Exposure Bias）限制了LLM在需要长程规划和复杂推理任务上的表现。

## 提出方法：Trelawney

* **核心思想:** 与其修改模型架构，不如通过重新组织训练数据序列，引入未来的信息，让模型更接近真实的、非线性的信息生成过程。
* **实现:**
    *   **数据增强:** 在原始训练序列 **y** 的某个位置 *d* 插入由特殊标记 `<T>` 和 `</T>` 包裹的未来信息 **z**。`**y** = (y1...yd <T> **z** </T> yd+1...yT)`
    *   **未来信息 z:** 可以是未来序列的直接复制 (`y_copy`)，也可以是包含位置信息的自然语言描述 (`y_copy+pos`, 如 "第k句话是[z]")。
    *   **训练:** 将原始序列和增强后的序列混合训练（通过概率 *p* 控制混合比例）。使用标准的交叉熵损失，但mask掉预测 `<T>` 标记时的损失（保留预测 `</T>` 的损失，使模型学会何时结束目标生成）。
* **推理:**
    *   **标准自回归:** 直接使用训练好的模型进行生成。
    *   **<T>-生成:** 在生成过程中的决策点，手动或让模型自动插入 `<T>`，然后模型可以：
        *   (a) 自主生成目标序列 **z** (直到 `</T>`)，展示其规划能力。
        *   (b) 使用用户指定的目标序列 **z**，实现可控生成。

## 实验结果

* **评估任务:** 在三个需要规划和推理的任务上进行评估：
    *   Star Graph (路径规划，来自Bachmann & Nagarajan, 2024)
    *   Strongly Connected Components (算法推理，来自CLRS-Text)
    *   Tiny Stories (故事生成，评估规划和可控性)
* **主要发现:**
    *   Trelawney训练的模型即使在标准自回归生成模式下，也优于NTP基线，表明模型隐式地提升了规划能力。
    *   通过 `<T>-生成`，模型能够生成合理的未来目标 **z**，并利用这些目标（无论是模型生成的还是用户指定的）显著提升在长程规划和推理任务上的性能。
    *   在故事生成任务中，Trelawney显著提升了目标达成能力和可控性（相比few-shot prompting），同时不损害无条件生成质量。
    *   模型规模越大，Trelawney带来的规划能力提升越明显。

## 评述

Trelawney提出了一种简单而有效的数据中心方法，通过在训练中引入未来信息，巧妙地缓解了传统NTP和teacher forcing带来的局限性，提升了语言模型的规划和推理能力，并增强了生成的可控性，而无需修改模型架构或训练流程。这种方法弥合了人类思考与机器生成过程的差异，为语言建模开辟了新的可能性，尤其是在需要前瞻性规划的任务上。代码和数据集将发布。 