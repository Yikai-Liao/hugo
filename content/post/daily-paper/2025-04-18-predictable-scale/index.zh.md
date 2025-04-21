---
title: "每日论文：Predictable Scale: Part I — 大模型预训练超参数缩放定律"
description: "提出经验性超参数缩放定律 (Step Law)，可根据模型和数据规模精确估算最优Batch Size和Learning Rate，并在不同模型结构、稀疏度、数据分布下表现稳健。"
slug: "2025-04-predictable-scale"
date: "2025-04-18 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "LLM"
    - "缩放定律"
    - "超参数"
    - "预训练"
    - "MoE"
---
**论文:** [Predictable Scale: Part I — Optimal Hyperparameter Scaling Law in Large Language Model Pretraining](https://step-law.github.io/)

**作者:** Houyi Li, Wenzhen Zheng, Jingcheng Hu, Qiufeng Wang, Hanshan Zhang, Zili Wang, Shijie Xuyang, Yuantao Fan, Shuigeng Zhou, Xiangyu Zhang, Daxin Jiang

**发表日期:** 2025年3月 ([arXiv:2503.04715](https://arxiv.org/abs/2503.04715))

---

## 问题背景

训练SOTA级LLM需巨量算力，超参数（特别是学习率LR和Batch Size BS）搜索成本极高。现有研究很少系统性探讨超参数缩放定律在不同数据分布、模型形状、模型稀疏度（如MoE）以及数据/模型规模下的通用性。

## 核心贡献：Step Law

* **发现损失凸性:** 首次发现并证明在固定模型参数和数据规模下，损失函数关于LR和BS的超参数空间呈现凸性，且最优区域是一个平台 (plateau)，为超参数优化提供了理论基础。
* **提出经验缩放定律 (Step Law):** 通过大规模实验（训练约3700个LLM，耗费近百万H800 GPU小时，处理约100万亿tokens），经验性拟合了最优学习率和Batch Size关于模型参数量 (N) 和数据量 (D) 的幂律关系。
  * 最优学习率: η(N,D) = 1.79 * N^(-0.713) * D^(0.307)
  * 最优Batch Size: B(D) = 0.58 * D^(0.571)  (主要依赖数据量D)
* **通用性与稳健性:** 首次系统研究并验证了Step Law在不同设置下的不变性：
    * **模型形状 (Topology Invariance):** 对于不同层数、头数、FFN维度的模型结构，最优超参数区域保持一致。
    * **模型稀疏度 (Sparsity-Independent):** 对稀疏的MoE模型同样适用，且与稀疏度（激活参数比例）无关。
    * **数据分布 (Data-Distribution Robustness):** 在多种不同数据配比（如中英混合、代码增强、代码主导）下依然保持高预测精度。
* **优越性:** 在测试集上，Step Law预测的超参数带来的损失相比网格搜索找到的全局最优值仅相差0.94‰，显著优于之前的其他缩放定律（如OpenAI Law, Microsoft Law, DeepSeek Law等）。
* **实用工具:** 贡献了一个即插即用的最优超参数估算工具。

## 实验结果

* 通过训练约3700个LLM（参数量从60M到1B不等）进行网格搜索，总计算量消耗近100万NVIDIA H800 GPU小时，处理了约100万亿 (1e14) tokens。
* 证实了在固定N和D下，LR/BS的损失地形图呈凸性，最优超参数存在一个较宽泛的稳定区域 (plateau)。
* 验证了Step Law在不同模型形状、MoE稀疏度、数据分布下的稳健性和优越性，相对误差远低于其他方法。
* 实验还表明，采用固定的最终学习率（如1e-5）而非按比例衰减（如peak_lr/10）的策略，有助于避免最优学习率估计的偏差。

## 评述

Step Law为大规模LLM预训练提供了一个强大且通用的超参数估算工具，大大降低了超参数搜索的成本。其关键优势在于考虑了数据量D的影响，并证明了其在不同模型结构、稀疏度和数据分布下的稳健性。虽然该定律是经验性的，缺乏严格的理论推导，但其广泛的实验验证和优越的预测精度使其具有很高的实用价值。未来的工作可以探索其理论基础。 