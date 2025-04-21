---
title: "Daily Paper: Trelawney - Looking beyond the next token"
description: "Introduces Trelawney, a training method that improves language model planning, reasoning, and story generation by explicitly inserting future information (lookahead tokens delimited by <T>, </T>) into training sequences, enabling models to learn and utilize future goals."
slug: "2025-04-looking-beyond-next-token"
date: "2025-04-17 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "LLM"
    - "Planning"
    - "Reasoning"
    - "Language Model Training"
    - "Controllable Generation"
---
**Paper:** [Looking beyond the next token](https://arxiv.org/abs/2504.11336)

**Authors:** Abitha Thankaraj, Yiding Jiang, J. Zico Kolter, Yonatan Bisk (Carnegie Mellon University)

**Published:** April 15, 2025 (arXiv)

---

## Problem Background

Traditional autoregressive language model training (Next-Token Prediction, NTP) assumes each token depends only on the previous context ($p(y_i | y_{<i})$). This contrasts with human writing or problem-solving, where high-level goals often precede the formulation of specific steps or phrasing. This mismatch, along with issues stemming from teacher forcing (like the Clever Hans Cheat, Indecipherable Token Problem, Exposure Bias), limits LLM performance on tasks requiring long-range planning, complex reasoning, and adherence to future constraints.

## Proposed Method: Trelawney

*   **Core Idea:** Instead of altering model architecture or the training objective, reorganize the training data sequences to explicitly incorporate future information, thereby better mimicking the true, non-linear process of human information generation and planning.
*   **Implementation:**
    *   **Data Augmentation:** For an original training sequence $\mathbf{y} = (y_1, ..., y_T)$, select a random position $d$ (from $1$ to $T-1$) and extract a future subsequence $\mathbf{z} = (y_k, ..., y_L)$ where $d < k \le L \le T$. Insert this future information $\mathbf{z}$ at position $d$, delimited by special tokens `<T>` and `</T>`. The resulting augmented sequence is: $(y_1, ..., y_d, <T>, z_1, ..., z_{|\mathbf{z}|}, </T>, y_{d+1}, ..., y_T)$.
    *   **Future Information $\mathbf{z}$:** Can be a direct copy of the future subsequence (`y_copy`) or a natural language description including positional information (`y_copy+pos`, e.g., "The k-th sentence is [z]"). `y_copy` generally performs better.
    *   **Training:** During training, sample original sequences with probability $1-p$ and augmented sequences with probability $p$ (e.g., $p=0.5$). Use the standard cross-entropy loss, but apply a **masked loss**: the loss for predicting the opening delimiter `<T>` is masked (set to zero), while the loss for predicting the closing delimiter `</T>` is kept. This teaches the model *when* to start inserting a goal (conditioned on prior context) and *when* to finish generating the goal sequence, but not *what* token triggers the goal insertion (avoiding spurious correlations).
*   **Inference Modes:**
    *   **Standard Autoregressive:** Generate text token by token as usual ($p(y_i | y_{<i})$). Trelawney-trained models show improved performance even in this mode.
    *   **<T>-Generation (`<T>-gen`):** At specific decision points during generation (e.g., start of a paragraph or sentence), insert the `<T>` token. The model can then:
        *   **(a) Autonomous Goal Generation:** The model generates a plausible future goal sequence $\mathbf{z}$ until it predicts `</T>`, demonstrating its learned planning capabilities. It then continues generating the main sequence $y_{d+1}...$ conditioned on both the past $y_{<d}$ and the generated goal $\mathbf{z}$.
        *   **(b) Controllable Generation:** A user provides a specific goal sequence $\mathbf{z}$. The model generates the main sequence $y_{d+1}...$ conditioned on the past $y_{<d}$ and the *user-provided* goal $\mathbf{z}$, allowing for explicit control over future content.

## Experimental Results

*   **Models:** Primarily evaluated using Pythia models (160M, 410M, 1B).
*   **Evaluation Tasks:** Assessed on three diverse tasks requiring planning and reasoning:
    *   **Star Graph:** A path planning task involving navigating a graph structure described in text (from Bachmann & Nagarajan, 2024).
    *   **Strongly Connected Components (SCC):** An algorithmic reasoning task requiring identifying SCCs in a graph described textually (from CLRS-Text benchmark).
    *   **Tiny Stories:** A story generation task evaluating long-range coherence, planning (achieving a stated goal), and controllability.
*   **Key Findings:**
    *   Models trained with Trelawney consistently **outperform NTP baselines** even in standard autoregressive mode, suggesting improved implicit planning capabilities learned from the augmented data.
    *   Using `<T>-gen` inference, Trelawney models can generate plausible future goals $\mathbf{z}$ and leverage these goals (whether model-generated or user-specified) to **significantly boost performance** on long-range planning (Star Graph, Tiny Stories) and algorithmic reasoning (SCC) tasks compared to NTP baselines and few-shot prompting techniques.
    *   In story generation (Tiny Stories), Trelawney markedly improves goal attainment and controllability (achieving user-specified story endings) compared to few-shot prompting, without degrading the quality of standard, unconditional generation.
    *   The benefits of Trelawney (especially the planning improvement) generally **increase with model scale**.

## Comments

Trelawney presents a simple yet powerful data-centric modification to standard language model training. By explicitly inserting future context via special tokens during training, it effectively mitigates some inherent limitations of next-token prediction and teacher forcing. This allows models to develop better planning and reasoning abilities and enhances controllability, all without requiring changes to the model architecture or the fundamental training objective. Trelawney helps bridge the gap between the sequential nature of autoregressive generation and the often non-sequential nature of human thought and planning, opening promising avenues for building more capable and goal-oriented LLMs. The planned release of code and datasets will facilitate further research. 