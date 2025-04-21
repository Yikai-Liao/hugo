---
title: "每日论文：EditAR - 基于自回归模型的统一条件图像生成"
description: "提出EditAR，一个基于LlamaGen的统一自回归框架，通过处理token化的图像和文本输入，结合DINOv2特征蒸馏，能够处理图像编辑、depth-to-image、edge-to-image、segmentation-to-image等多种条件生成任务。"
slug: "2025-04-edit-ar"
date: "2025-04-18 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "自回归模型"
    - "条件生成"
    - "图像编辑"
    - "图像翻译"
    - "计算机视觉"
    - "特征蒸馏"
    - "LlamaGen"
    - "DINOv2"
---
**论文:** [EditAR: Unified Conditional Generation with Autoregressive Models](https://arxiv.org/abs/2501.04699)

**项目主页:** [https://jitengmu.github.io/EditAR/](https://jitengmu.github.io/EditAR/)

**作者:** Jiteng Mu (UCSD), Nuno Vasconcelos (UCSD), Xiaolong Wang (UCSD, NVIDIA)

**发表日期:** 2025年1月 (arXiv)

---

## 问题背景

当前的条件图像生成和编辑方法（如基于扩散模型的方法）通常需要为特定任务（如图像编辑、depth-to-image, edge-to-image, segmentation-to-image等）进行专门设计，缺乏一个能够统一处理多种输入条件和任务的单一模型。

## 提出方法：EditAR

* **核心思想:** 扩展自回归模型（基于LlamaGen），使其能够统一处理图像和文本条件，并生成相应的图像token序列。
* **统一框架:**
    * **输入:** 将条件图像（如原始图像、深度图、边缘图、分割图）通过VQ Encoder编码为离散token序列 (`c_Ic`)，与文本指令的embedding (`c_T`) 一起输入到自回归Transformer模型 (`F`)。
    * **条件区分:** 通过不同的文本提示语来区分任务类型（例如，图像编辑直接用指令，图像翻译用 "Given <MODE>, <INSTRUCTION>"）。
    * **输出:** 模型通过标准的next-token prediction范式，自回归地生成目标图像的token序列 (`s`)。
* **DINOv2特征蒸馏:** 为了增强生成图像的语义和视觉一致性，引入了一个蒸馏损失。该损失通过一个可学习的适配器 (Adapter, 单层卷积) 对齐自回归模型中间层特征与预训练的DINOv2模型提取的目标图像特征，使用MSE计算损失。这有助于将通用视觉知识注入模型。
* **训练数据:** 在多个数据集上联合训练，包括 SEED-Data-Edit-Unsplash (1.5M), PIPE (1.8M, 用于添加/移除物体), COCOStuff (分割图转图像), MultiGen-20M (Canny边缘和深度图转图像)。
* **推理:** 使用Classifier-Free Guidance (CFG, η=3.0) 来平衡重建质量和文本-图像对齐度。

## 实验结果

* **任务范围:** 在多种条件生成任务上进行了评估，包括图像编辑（纹理修改、物体替换/移除、局部编辑等）和图像翻译（canny-to-image, depth-to-image, segmentation-to-image）。
* **定量比较:** 在标准基准（PIE-Bench, COCOStuff val, MultiGen-20M val）上与多种SOTA方法（包括任务特定的扩散模型如InstructPix2Pix, MGIE, PnPInversion, ControlNet, ControlNet++, 以及统一模型如UniControl, UniControlNet）进行了比较。
    * **图像编辑:** EditAR在PIE-Bench上的整体表现优于其他前馈方法(feed-forward methods)，并在背景保持和编辑效果之间取得了良好平衡，缩小了与基于优化的反演方法(inversion-based methods)的差距。
    * **图像翻译:** EditAR在所有三项翻译任务中取得了最佳的FID分数，显示了其生成高质量和多样化样本的能力。
* **消融研究:** 证明了DINOv2蒸馏损失能够提升文本-图像对齐度和生成质量（改善FID）；验证了CFG指导系数对生成效果的重要性。

## 评述

EditAR首次证明了单一的、基于next-token prediction的自回归模型可以有效统一处理多种条件图像生成和编辑任务，并在多个基准上展现了与SOTA任务特定方法（尤其是扩散模型）相竞争的性能。其核心优势在于利用自回归模型的统一token表示，并通过文本提示区分任务，结合DINOv2特征蒸馏提升效果。尽管是统一模型，在部分任务的特定指标上（如分割转图像的mIOU）可能不如最优的专用模型，但其FID表现优异，显示了强大的生成能力。该工作为统一条件生成模型提供了一个有前景的新方向。作者表示将发布代码和模型。 