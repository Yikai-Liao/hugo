---
title: "Daily Paper: Thought Manipulation"
description: "Proposes ThoughtMani, a training-free method to reduce redundant reasoning in large reasoning models by leveraging external chain-of-thought from smaller models, improving efficiency and safety."
slug: 2025-04-thought-manipulation
date: 2025-04-18 00:00:00+0000
categories:
    - Daily Paper
tags:
    - AI
    - LLM
    - Reasoning
    - Efficiency
---
**Paper:** [Thought Manipulation: External Thought Can Be Efficient for Large Reasoning Models](https://arxiv.org/abs/2504.13626)

**Authors:** Yule Liu, Jingyi Zheng, Zhen Sun, Zifan Peng, Wenhan Dong, Zeyang Sha, Shiwen Cui, Weiqiang Wang, Xinlei He (Hong Kong University of Science and Technology (Guangzhou), Ant Group)

**Published:** April 18, 2025 (arXiv)

---

## Problem Background

Large reasoning models (LRMs) excel in complex tasks by generating step-by-step chain-of-thought (CoT) reasoning. However, they often suffer from "overthinking," producing redundant reasoning steps that increase computational costs without significant performance gains. Existing solutions, like fine-tuning, require additional data, risk safety misalignment, and lack generalization.

## Proposed Method: ThoughtMani

* **Core Idea:** Use a smaller model to generate high-level CoT, which is inserted into the LRM's input to guide reasoning, reducing redundant steps without training.
* **Implementation:** 
  * A small model (e.g., Qwen-2.5-7B-Instruct) generates a concise CoT, framed within `<think>` and `</think>` tokens, focusing on key reasoning steps without calculations.
  * The CoT is appended to the LRM's inference template, allowing the LRM (e.g., QwQ-32B) to bypass unnecessary intermediate reasoning.
  * A `<STOP>` mechanism ensures the small model skips complex problems, letting the LRM handle them directly to avoid misleading CoTs.
* **Key Aspect:** ThoughtMani is training-free, leverages the LRM's ability to dynamically adjust reasoning based on external CoT, and enhances safety by using well-aligned small models.

## Experimental Results

* **Effectiveness:** On datasets like GSM8K and MATH-500, ThoughtMani reduces token counts by 1%-37% for RL-based LRMs (e.g., QwQ-32B) with minimal performance loss (0.8%-7.2%) and up to 86% for distillation-based LRMs with higher loss (4.5%-20.4%).
* **Superiority:** Compared to baselines like fine-tuning (TokenSkip, CoT-Valve) or prompt reduction, ThoughtMani achieves better efficiency and safety (10% safety improvement vs. 7% safety drop in fine-tuning methods).
* **Overhead:** Minimal, with the small model generating 7-209 tokens per CoT, far less than the thousands saved by the LRM.