---
title: "Daily Paper: Predictable Scale: Part I — Optimal Hyperparameter Scaling Law in Large Language Model Pretraining"
description: "Proposes empirical scaling laws (Step Law) that accurately estimate optimal Batch Size and Learning Rate based on model and data size, robust across different model structures, sparsity, and data distributions."
slug: "2025-04-predictable-scale"
date: "2025-04-18 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "LLM"
    - "Scaling Laws"
    - "Hyperparameters"
    - "Pretraining"
    - "MoE"
---
**Paper:** [Predictable Scale: Part I — Optimal Hyperparameter Scaling Law in Large Language Model Pretraining](https://step-law.github.io/)

**Authors:** Houyi Li, Wenzhen Zheng, Jingcheng Hu, Qiufeng Wang, Hanshan Zhang, Zili Wang, Shijie Xuyang, Yuantao Fan, Shuigeng Zhou, Xiangyu Zhang, Daxin Jiang

**Published:** March 2025 ([arXiv:2503.04715](https://arxiv.org/abs/2503.04715))

---

## Problem Background

Training state-of-the-art (SOTA) LLMs requires massive compute resources, making hyperparameter search (especially for Learning Rate (LR) and Batch Size (BS)) extremely costly. Existing research rarely systematically investigates the universality of hyperparameter scaling laws across different data distributions, model shapes, model sparsity (e.g., Mixture-of-Experts, MoE), and data/model scales.

## Core Contribution: Step Law

*   **Discovery of Loss Convexity:** First to discover and demonstrate the convexity of the loss landscape with respect to LR and BS under fixed model parameters and data size conditions. The optimal region forms a plateau, providing a theoretical basis for hyperparameter optimization.
*   **Proposed Empirical Scaling Law (Step Law):** Based on extensive experiments (training ~3700 LLMs, consuming nearly 1 million H800 GPU hours, processing ~100 trillion tokens), empirically derived power-law relationships for optimal LR and BS based on model parameter count (N) and dataset size (D).
    *   Optimal Learning Rate: η(N,D) = 1.79 * N^(-0.713) * D^(0.307)
    *   Optimal Batch Size: B(D) = 0.58 * D^(0.571) (primarily depends on data size D)
*   **Universality and Robustness:** First systematic study and validation of Step Law's invariance across different settings:
    *   **Model Shape (Topology Invariance):** Optimal hyperparameter region remains consistent across models with varying layers, heads, and FFN dimensions.
    *   **Model Sparsity (Sparsity-Independent):** Applicable to sparse MoE models, regardless of the sparsity ratio (activated parameters).
    *   **Data Distribution (Data-Distribution Robustness):** Maintains high prediction accuracy across diverse data recipes (e.g., English-Chinese mix, code-enhanced, code-dominant).
*   **Superiority:** On the test set, Step Law's predicted hyperparameters result in a loss only 0.94‰ higher than the global optimum found via grid search, significantly outperforming previous scaling laws (e.g., OpenAI Law, Microsoft Law, DeepSeek Law).
*   **Practical Tool:** Contributes a plug-and-play tool for optimal hyperparameter estimation.

## Experimental Results

*   Conducted grid search by training ~3700 LLMs (parameters ranging from 60M to 1B), consuming nearly 1 million NVIDIA H800 GPU hours and processing ~100 trillion (1e14) tokens.
*   Confirmed the convex loss landscape for LR/BS under fixed N and D, with a broad stable region (plateau) around the optimum.
*   Validated the robustness and superiority of Step Law across different model shapes, MoE sparsity levels, and data distributions, showing significantly lower relative error than other methods.
*   Experiments also indicated that using a fixed final learning rate (e.g., 1e-5) strategy, rather than decaying proportionally (e.g., peak_lr/10), helps avoid bias in optimal learning rate estimation.

## Comments

Step Law provides a powerful and general tool for estimating hyperparameters in large-scale LLM pretraining, greatly reducing the cost of hyperparameter search. Its key advantages lie in considering the impact of data size D and demonstrating robustness across diverse model structures, sparsity, and data distributions. While the law is empirical and lacks rigorous theoretical derivation, its extensive experimental validation and superior predictive accuracy make it highly practical. Future work could explore its theoretical foundations. 