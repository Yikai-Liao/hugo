---
title: "Daily Paper: Are We Done with Object-Centric Learning? (OCCAM)"
description: "Argues unsupervised object discovery is largely solved by pre-trained segmentation models (e.g., HQES, SAM). Proposes OCCAM probe framework to show OCL's focus should shift to downstream challenges like OOD generalization and compositionality using available object representations, highlighting robust foreground object selection as the new bottleneck."
slug: "2025-04-object-centric-learning"
date: "2025-04-17 00:00:00+0000"
categories:
    - "Daily Paper"
tags:
    - "AI"
    - "Object-Centric Learning"
    - "Representation Learning"
    - "OOD Generalization"
    - "Compositionality"
    - "Segmentation Models"
    - "OCCAM"
    - "Robustness"
    - "Computer Vision"
---
**Paper:** [Are We Done with Object-Centric Learning?](https://arxiv.org/abs/2504.07092)

**Project Page:** [https://alexanderrubinstein.github.io/are-we-done-with-ocl/](https://alexanderrubinstein.github.io/are-we-done-with-ocl/)

**Code (OCCAM):** [https://github.com/AlexanderRubinstein/OCCAM](https://github.com/AlexanderRubinstein/OCCAM)

**Authors:** Alexander Rubinstein, Ameya Prabhu, Matthias Bethge, Seong Joon Oh (Tübingen AI Center)

**Published:** April 9, 2025 (arXiv)

---

## Problem Background

Object-Centric Learning (OCL) aims to learn representations that encode each object in a scene independently, disentangled from the background or other objects. Such representations are hypothesized to be crucial for fundamental AI capabilities like **Out-of-Distribution (OOD) generalization, compositionality, sample efficiency, modeling structured environments (physics, causality), and understanding human cognition**. However, much OCL research has focused on developing unsupervised, slot-based methods primarily evaluated on the sub-task of unsupervised object discovery (effectively, segmentation).

The authors argue that with the recent advent of powerful, pre-trained, class-agnostic segmentation models like **High-Quality Entity Segmentation (HQES)** and the **Segment Anything Model (SAM)**, which excel at zero-shot object discovery far beyond current slot-based OCL methods, the core technical challenge of "decomposing a scene into objects" is largely addressed. Therefore, the OCL field should shift its focus to leveraging these discovered objects to tackle the more fundamental downstream goals.

## Proposed Analysis Framework: OCCAM

* **Core Idea:** Introduce a simple, training-free probe framework, **OCCAM (Object-Centric Classification with Applied Masks)**, primarily as a tool to analyze the utility of object representations (derived from *any* source, including segmentation models or OCL methods) for downstream tasks, specifically robust classification in the presence of spurious correlations.
* **Framework Pipeline:** OCCAM consists of three stages:
  1. **Object Mask Generation:** Use an off-the-shelf (class-agnostic) mask generator (e.g., HQES, SAM) to segment all potential object entities in an input image $x$, obtaining a set of masks \\(\{m_i\\}\) for each proposed object.
  2. **Object Representation Extraction:** Apply each mask $m_i$ to the original image $x$ (e.g., by graying out the background and cropping, or using the mask as an alpha channel) to get a masked image $a(x, m_i)$. Encode each masked object independently using a pre-trained encoder $\\psi$ (e.g., CLIP, DINO) to obtain object representations \\(\{\\psi(a(x, m_i))\\}\).
  3. **Foreground Object Selection & Classification:** Use a foreground (FG) object selector to **choose** the representation $\\psi(a(x, m^*))$ corresponding to the main foreground object $m^*$. Feed only this selected representation to a classifier to obtain the final prediction $p(\\psi(a(x, m^*)))$.
* **Key Insight:** The paper uses OCCAM to demonstrate that high-quality object representations derived from segmentation models like HQES are highly effective for robust downstream classification *when combined with an Oracle foreground selector*. The primary bottleneck preventing state-of-the-art robust performance is **not** the quality of the object representation itself, but rather the **challenge of robustly selecting the correct foreground object representation** from the potentially many object representations extracted in stage 2.

## Experimental Results & Analysis

* **Object Discovery:** Zero-shot HQES and SAM significantly outperform State-of-the-Art (SOTA) unsupervised OCL methods (like SlotDiffusion, FT-Dinosaur) on standard object discovery metrics (FG-ARI, mBO) across various benchmarks (e.g., MOVi-C/E), demonstrating that segmentation models effectively solve this sub-task.
* **Robust Classification (OCCAM Performance):** On datasets designed to test robustness against spurious background correlations (e.g., Waterbirds, UrbanCars, ImageNet-D, ImageNet-9), the OCCAM framework using HQES segmentation + a **Class-Aided Oracle selector** achieves classification accuracy and Worst-Group Accuracy (WGA) significantly better than baseline models and slot-based OCL approaches, often approaching perfect robustness.
* **Foreground Selection Bottleneck:** When the Oracle selector is replaced with practical, unsupervised foreground selection heuristics (e.g., based on mask size, centrality, or representation ensemble entropy $H$), performance drops dramatically. This highlights that **robust foreground object selection** is the critical remaining challenge, not object representation/segmentation quality.
* **Dataset Analysis (CounterAnimals):** Using OCCAM with an Oracle selector reveals that the performance drop on the Counter subset compared to the Common subset in the CounterAnimals dataset is **not solely attributable to spurious backgrounds**. A significant performance gap remains even after the background is masked out, suggesting the Counter subset might contain inherently harder foreground object instances, challenging the dataset's original interpretation.
* **OCCAM's Role:** Positioned primarily as an **analysis tool** for evaluating OCL representations and dataset biases, not proposed as a new SOTA classification model itself.

## Comments & Outlook: The Future of OCL

The paper delivers a strong message: with powerful segmentation tools readily available, the OCL community should pivot away from optimizing unsupervised object discovery/segmentation mechanisms. Instead, the focus should shift towards:

1. **Leveraging Existing Object Representations:** Utilize the high-quality object masks/representations provided by models like HQES/SAM to tackle the fundamental, challenging downstream tasks that originally motivated OCL (OOD generalization, compositionality, reasoning, causality, etc.).
2. **Solving Robust Object Selection:** Develop effective and robust mechanisms for selecting the relevant foreground object(s) from the output of segmentation models, as this is identified as the key bottleneck.
3. **Rethinking Benchmarks:** Design new benchmarks and evaluation protocols that directly measure progress on the core goals of OCL (e.g., compositional reasoning, causal understanding) rather than relying solely on segmentation metrics (like ARI). OCCAM can serve as a tool in this process.
4. **Bridging to Cognition:** Explore OCL's role in understanding biological intelligence (e.g., infant object perception), potentially incorporating more developmentally plausible learning signals like multimodal data or interaction.

The authors provide the OCCAM toolbox as a resource to facilitate this shift and encourage the community to collectively advance OCL towards solving these deeper, more impactful problems. 