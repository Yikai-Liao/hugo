---
title: "Daily Paper: EditAR - Unified Conditional Generation with Autoregressive Models"
description: "Proposes EditAR, a unified autoregressive framework based on LlamaGen, handling tokenized image and text inputs with DINOv2 feature distillation for diverse conditional generation tasks like editing, depth-to-image, edge-to-image, and segmentation-to-image."
slug: "2025-04-edit-ar"
date: "2025-04-18 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "Autoregressive Models"
    - "Conditional Generation"
    - "Image Editing"
    - "Image Translation"
    - "Computer Vision"
    - "Feature Distillation"
    - "LlamaGen"
    - "DINOv2"
---
**Paper:** [EditAR: Unified Conditional Generation with Autoregressive Models](https://arxiv.org/abs/2501.04699)

**Project Page:** [https://jitengmu.github.io/EditAR/](https://jitengmu.github.io/EditAR/)

**Authors:** Jiteng Mu (UCSD), Nuno Vasconcelos (UCSD), Xiaolong Wang (UCSD, NVIDIA)

**Published:** January 2025 (arXiv)

---

## Problem Background

Current conditional image generation and editing methods (e.g., diffusion-based) often require specialized designs for specific tasks (like image editing, depth-to-image, edge-to-image, segmentation-to-image). A single model capable of handling diverse input conditions and tasks in a unified manner is lacking.

## Proposed Method: EditAR

*   **Core Idea:** Extend an autoregressive model (based on LlamaGen) to uniformly handle both image and text conditions and generate corresponding image token sequences.
*   **Unified Framework:**
    *   **Input:** Encodes condition images (e.g., original image, depth map, edge map, segmentation map) into discrete token sequences (`c_Ic`) using a VQ Encoder. These are fed into the autoregressive Transformer model (`F`) along with text instruction embeddings (`c_T`).
    *   **Condition Distinction:** Task types are distinguished via text prompt phrasing (e.g., direct instruction for editing, "Given <MODE>, <INSTRUCTION>" for translation).
    *   **Output:** The model autoregressively generates the target image's token sequence (`s`) using the standard next-token prediction paradigm.
*   **DINOv2 Feature Distillation:** Introduces a distillation loss to enhance semantic and visual consistency. This loss aligns intermediate features from the autoregressive model (via a learnable adapter - a single conv layer) with target image features extracted by a pre-trained DINOv2 model, calculated using MSE. This helps inject general visual knowledge.
*   **Training Data:** Jointly trained on multiple datasets, including SEED-Data-Edit-Unsplash (1.5M), PIPE (1.8M, for object addition/removal), COCOStuff (segmentation-to-image), and MultiGen-20M (Canny edge and depth-to-image).
*   **Inference:** Uses Classifier-Free Guidance (CFG, η=3.0) to balance reconstruction quality and text-image alignment.

## Experimental Results

*   **Task Scope:** Evaluated on various conditional generation tasks, including image editing (texture modification, object replacement/removal, local editing, etc.) and image translation (canny-to-image, depth-to-image, segmentation-to-image).
*   **Quantitative Comparison:** Compared against various SOTA methods (including task-specific diffusion models like InstructPix2Pix, MGIE, PnPInversion, ControlNet, ControlNet++, and unified models like UniControl, UniControlNet) on standard benchmarks (PIE-Bench, COCOStuff val, MultiGen-20M val).
    *   **Image Editing:** EditAR outperforms other feed-forward methods overall on PIE-Bench, achieving a good balance between background preservation and editing quality, narrowing the gap with optimization-based inversion methods.
    *   **Image Translation:** EditAR achieves the best FID scores across all three translation tasks, demonstrating its ability to generate high-quality and diverse samples.
*   **Ablation Studies:** Showed that DINOv2 distillation loss improves text-image alignment and generation quality (improves FID); validated the importance of the CFG coefficient for generation quality.

## Comments

EditAR is the first work demonstrating that a single, next-token prediction-based autoregressive model can effectively unify multiple conditional image generation and editing tasks, showing competitive performance against SOTA task-specific methods (especially diffusion models) on several benchmarks. Its core strength lies in leveraging the unified token representation of autoregressive models, distinguishing tasks via text prompts, and enhancing results with DINOv2 feature distillation. While it might underperform the best specialized models on specific metrics (like mIOU for segmentation-to-image) due to being a unified model, its excellent FID scores indicate strong generative capabilities. This work offers a promising new direction for unified conditional generative models. The authors state the code and models will be released. 