---
title: "Boosting Symbolic Music Processing with `symusic`"
date: 2025-04-21T00:00:00Z
draft: false
# cover:
#     image: "cover.jpg" # image path/url
#     alt: "this is a post image" # alt text
#     caption: "this is a caption" # display caption under cover
#     relative: true # when using page bundles set this to true
# tags: ["tag1", "tag2"]
# categories: ["category1", "category2"]
---

Hi there! If you work in Music Information Retrieval (MIR) or AI Music Generation, you probably often need to process symbolic music, especially MIDI files, using Python. Libraries like `mido` and `pretty_midi` are powerful and highly flexible. However, as project scales grow and you start dealing with thousands or even tens of thousands of MIDI files, pure Python MIDI libraries often become a bottleneck. Tasks like parsing files, sorting notes, adjusting timing, and preparing data for machine learning models can take far too long, significantly slowing down research and development progress.

This performance bottleneck is what motivated me to create **`symusic`**. My goal was to retain Python’s ease of use while delivering a significant boost in performance for these common tasks.

The core idea behind `symusic` is simple: delegate computationally intensive tasks to C++ while providing a clean, Pythonic interface. We implemented the core logic—parsing MIDI data, manipulating notes and timing structures, and handling data conversions—using modern C++ (C++20) to ensure speed and efficiency. Then, we used `nanobind` to create lightweight Python bindings, allowing users to interact with it as naturally as any other Python library.

The result is a library that feels familiar if you’ve used other Python music tools but runs much faster. Just how fast? According to our benchmarks ([see symusic-benchmark](https://github.com/Yikai-Liao/symusic-benchmark)), `symusic` outperforms pure Python libraries by **10x to over 100x** on tasks like MIDI file I/O and batch operations. This means tasks that used to take hours can now be completed in minutes.

`symusic`’s Python API is designed around intuitive objects like `Score`, `Track`, and `Note`, making it easy to browse and modify musical data. It also supports seamless conversion between **ticks**, **quarter notes**, and **seconds**, automatically handling tempo changes in the score. This is especially important for tasks requiring precise timing analysis or alignment.

In addition, `symusic` has many common operations built into its C++ backend and optimized for performance. You can efficiently adjust the pitch or velocity of entire tracks, modify timing globally, sort all musical events chronologically (essential after modifications), or clip scores to specific time ranges—all much faster than iterating through events in Python.

To better integrate with modern data science and machine learning workflows, `symusic` offers seamless integration with NumPy. With a simple `.numpy()` method, you can export note attributes (onset, duration, pitch, velocity) from a track directly into a NumPy structured array, greatly simplifying data preparation for frameworks like PyTorch or TensorFlow. Additionally, `symusic` supports fast `pickle` serialization, making it easy to cache processed data or use `symusic` objects in multiprocessing scenarios.

Installation is straightforward. We provide pre-compiled wheels for major platforms (Linux, macOS, Windows) and Python versions:

```bash
pip install symusic
```

Once installed, loading a MIDI file is as simple as:

```python
import symusic
# Load a MIDI file into a Score object
score = symusic.load("path/to/your/midi/file.mid")
# Now you can access score.tracks, score.ticks_per_quarter, etc.
# Check the documentation for more details.
```

From there, you can explore tracks, access notes and tempo events, perform various operations, and save your results. For detailed usage, examples, and the full API reference, visit the **[official documentation](https://yikai-liao.github.io/symusic/)**.

`symusic` is particularly well-suited for researchers and developers who need to process large MIDI datasets or require high-performance symbolic music processing in their Python applications. It has already been adopted as an optional backend in libraries like [MidiTok](https://miditok.readthedocs.io/), proving its utility in real-world scenarios.

This project is actively under development, and community contributions are highly encouraged!

*   **Explore the code & contribute:** [https://github.com/Yikai-Liao/symusic](https://github.com/Yikai-Liao/symusic)
*   **Read the docs:** [https://yikai-liao.github.io/symusic/](https://yikai-liao.github.io/symusic/)
*   **Report issues or ideas:** Use the GitHub Issues tracker.

I hope `symusic` helps you overcome performance bottlenecks and speeds up your symbolic music workflows. Give it a try!