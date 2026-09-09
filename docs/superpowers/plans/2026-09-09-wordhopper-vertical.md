# WordHopper 竖屏向上跑酷 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有横屏打字跑酷改为竖屏触控向上时机跑酷（一词一障、字母泡、隐藏窗起跳），对齐已确认 PRD v0.2。

**Architecture:** Phaser 3 + TypeScript；障碍用 progress∈[0,1] 由远及近缩放；点泡用 BubbleTapSystem；起跳分窗内越过/窗外空蹦；计分沿用 ScoreSystem。

**Tech Stack:** Phaser 3.90、Vite、Vitest、现有词库 JSON。

## Global Constraints

- 画布默认 450×800（Q-004 暂定）
- 隐藏窗 WIN_LO=0.82 / WIN_HI=0.96（Q-001 暂定，来自原型）
- 计分数值沿用现 constants（Q-003 暂定）
- 逼近速度用 INITIAL_APPROACH_RATE（Q-002 暂定）
- 正式不绘绿窗；无陀螺仪
- 禁止脑补 Out of Scope / 未确认项

---

### Task 1: 常量、显示、资源

- [ ] 竖屏常量 + 10 障碍类型 + 时机窗常量
- [ ] display / style / index 竖屏触控壳
- [ ] 扁平仓鼠 sheet（80）接入 Boot

### Task 2: 核心系统与实体

- [ ] BubbleTapSystem + 测试
- [ ] Obstacle（进度逼近 + 字母泡 UI）
- [ ] ObstacleSpawner（单道一词疏间距）
- [ ] Player（跑/空蹦/越过）
- [ ] SpeedManager 改为逼近速率
- [ ] AudioSystem（程序化短音 + 开关）

### Task 3: 场景

- [ ] 重写 GameScene
- [ ] 调整 Menu / Boot / Death / ShareCard / main

### Task 4: 收工

- [ ] 更新测试与 main 尺寸断言
- [ ] docs/prd/IMPLEMENTATION.md
- [ ] npm test / build 通过
