---
title: "使用 `symusic` 提升符号化音乐处理效率"
date: 2025-04-21T00:00:00Z
draft: true
# cover:
#     image: "cover.jpg" # image path/url
#     alt: "this is a post image" # alt text
#     caption: "this is a caption" # display caption under cover
#     relative: true # when using page bundles set this to true
# tags: ["tag1", "tag2"]
# categories: ["category1", "category2"]
---

大家好！如果从事音乐信息检索（MIR）或 AI 音乐生成工作，可能经常需要用 Python 处理符号音乐，尤其是 MIDI 文件。像 `mido` 和 `pretty_midi` 这样的库非常强大，灵活性也很高。然而，随着项目规模的扩大，当需要处理成千上万个 MIDI 文件时，纯python的MIDI库往往就成为了瓶颈。解析文件、排序音符、调整时间以及为机器学习模型准备数据，这些任务往往耗时过长，严重拖慢了研究和开发的进度。

正是这种性能瓶颈促使我开发了 **`symusic`**。我希望它既能保持 Python 的易用性，又能显著提升这些常见任务的处理速度。

`symusic` 的核心理念很简单：将计算密集型任务交给 C++，同时提供一个简洁、符合 Python 使用习惯的接口。我们使用现代 C++ (C++20) 实现了底层逻辑，包括解析 MIDI 数据、操作音符和时间结构、处理数据转换等，以确保速度和效率。然后，通过 `nanobind` 创建了轻量级的 Python 绑定，让用户可以像使用普通 Python 库一样轻松调用。

最终的结果是，如果你熟悉其他 Python 音乐工具，`symusic` 的使用体验会非常相似，但运行速度却快得多。究竟有多快？根据我们的基准测试（[参见 symusic-benchmark](https://github.com/Yikai-Liao/symusic-benchmark)），在 MIDI 文件 I/O 和批量操作等任务上，`symusic` 的性能通常比纯 Python 库高出 **10 到 100 倍**。这意味着以前需要数小时完成的任务，现在可能只需几分钟。

`symusic` 的 Python API 设计围绕直观的对象（如 `Score`、`Track` 和 `Note`），让用户可以轻松浏览和修改音乐数据。我们还支持在 **ticks**、**quarter notes** 和 **seconds** 之间无缝转换，并自动处理乐谱中的速度变化，这对需要精确时间分析或对齐的任务尤为重要。

此外，`symusic` 在 C++ 后端内置并优化了许多常见操作，比如批量调整音高或力度、全局修改时间、按时间顺序排序音乐事件（修改后尤为重要），以及裁剪乐谱到特定时间范围。这些操作的速度远超在 Python 中逐一迭代事件的方式。

为了更好地融入现代数据科学和机器学习工作流，`symusic` 与 NumPy 实现了无缝集成。通过简单的 `.numpy()` 方法，你可以将轨道中的音符属性（起始时间、持续时间、音高、力度）直接导出为 NumPy 结构化数组，大大简化了为 PyTorch 或 TensorFlow 等框架准备数据的过程。此外，`symusic` 还支持快速的 `pickle`，方便缓存处理后的数据或在多进程场景中使用。

安装也非常简单，我们为主流平台（Linux、macOS、Windows）和 Python 版本提供了预编译的 wheel 包：

```bash
pip install symusic
```

安装完成后，加载 MIDI 文件只需几行代码：

```python
import symusic
# 加载 MIDI 文件到 Score 对象
score = symusic.load("path/to/your/midi/file.mid")
# 现在可以访问 score.tracks、score.ticks_per_quarter 等属性
# 具体操作请参考文档
```

接下来，你可以浏览轨道、访问音符和速度事件、执行各种操作并保存结果。更多用法、示例和完整的 API 参考，请访问**[官方文档](https://yikai-liao.github.io/symusic/)**。

`symusic` 尤其适合需要处理大型 MIDI 数据集或在 Python 应用中追求高性能符号音乐处理的研究人员和开发者。它已经被 [MidiTok](https://miditok.readthedocs.io/) 等库用作可选后端，证明了其在实际场景中的实用性。

这个项目正在积极开发中，非常欢迎社区的参与！

*   **探索代码 & 贡献:** [https://github.com/Yikai-Liao/symusic](https://github.com/Yikai-Liao/symusic)
*   **阅读文档:** [https://yikai-liao.github.io/symusic/](https://yikai-liao.github.io/symusic/)
*   **报告问题或想法:** 请使用 GitHub Issues 跟踪器。

希望 `symusic` 能帮助你解决性能瓶颈，加速符号音乐处理工作。快来试试吧！