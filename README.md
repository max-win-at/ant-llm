# 🐜 Stigmergic Network Topology

> *An art project exploring collective intelligence through digital pheromones*

**[View the live installation →](https://max-w.in/ant-llm)**

## 🐜🐜🐜 The Colony

Watch as autonomous agents—powered by large language models—navigate the topology of the internet itself. This is not a simulation of ants walking on a canvas. This is a **network biology experiment** where:

- **🐜 Ants** are persistent async state machines
- **🌐 Space** is the network address space (URLs, not pixels)
- **🚶 Movement** is `fetch()` (each request is physical locomotion)
- **📏 Distance** is measured in milliseconds of latency
- **✨ Pheromones** are temporal data stored in memory, decaying exponentially
- **🍯 Food** is JSON—flat structures are *sugar*, nested objects are *protein*
- **⚠️ Predators** are HTTP errors (`429` Ant-Lions, `5xx` Storms, timeouts as Swamps)

## 🐜 The Art

This project asks: *What if the internet had a smell?*

Traditional ant colonies leave chemical trails on physical surfaces. These digital ants leave **stigmergic signals** on URL nodes—a collective memory that emerges from individual actions. The colony learns which APIs are highways and which are swamps, purely through trial, error, and temporal markers.

The twist? The ants don't follow hard-coded rules. Their foraging decisions come from **LLMs reasoning about pheromone trails in real-time**—a collective intelligence deciding where each 🐜 should venture next.

## 🐜 How It Works

### The Terrain
- Fast APIs = highways 🏎️
- Slow APIs = swamps 🐌
- CORS failures = impassable walls 🚧
- Successful endpoints = food sources 🍯
- Error codes = danger zones ⚠️

### The Foragers
- **Scout ants** (20%): Brave explorers seeking novel URLs
- **Worker ants** (80%): Pragmatic exploiters of proven trails

### The Intelligence
An LLM acts as the **colony's collective mind**, receiving:
- Current pheromone map (which trails are strong/weak/dangerous)
- Ant energy levels and roles
- Recent foraging history

...and deciding where each 🐜 should go next, balancing exploration vs. exploitation in real-time.

### The Memory
Pheromones decay via `e^(-λ·Δt)`, creating a **temporal graph** of the network's "scent landscape." Strong trails emerge organically from repeated successful foraging. Failed fetches leave negative pheromones—warnings to future ants.

## 🐜 Running the Colony

1. Open `index.html` in a modern browser
2. Click **⚙️ LLM Settings** to configure your AI provider (OpenAI, Anthropic, or Gemini)
3. Watch the ants explore the network topology
4. Observe emergent trails forming as pheromones accumulate

The colony never stops learning. Each fetch reshapes the pheromone landscape, influencing every future decision.

## 🐜 The Stack

- Pure JavaScript (no frameworks—just ants)
- HTML5 Canvas for visualization
- LocalStorage for persistent ant state
- Cookies for food storage (with natural expiry)
- LLM APIs for collective decision-making

## 🐜 Philosophy

This project sits at the intersection of:
- **Stigmergy** (indirect coordination through environmental modification)
- **Embodied cognition** (network latency as physical constraint)
- **Swarm intelligence** (emergent behavior from simple rules + LLM reasoning)
- **Net art** (the medium is the network itself)

The ants are **not** pathfinding through a grid. They're making HTTP requests. The "world" they inhabit is the actual internet. Their constraints are real: CORS policies, rate limits, server timeouts. The art emerges from watching an AI navigate these real-world obstacles using the logic of ant colonies.

## 🐜 Credits

A generative art experiment in collective intelligence and network topology.

---

<sub>**Aided by AI** — This project's development was assisted by Claude (Anthropic) and the ants are powered by LLM-based decision-making.</sub>
