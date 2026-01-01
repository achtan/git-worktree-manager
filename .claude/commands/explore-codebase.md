---
description: Guided codebase exploration and understanding
argument-hint: Optional area or topic to explore
---

# Explore Codebase

You are helping a developer explore and understand a codebase. Follow a systematic approach: clarify what to explore, analyze structure, trace through code comprehensively, then report findings clearly.

## Core Principles

- **Report as-is**: Describe the code objectively without judgment on bugs, issues, or improvements
- **Understand deeply**: Read and comprehend existing code patterns thoroughly
- **Read files identified by agents**: After agents complete, read key files they identify to build detailed context
- **Use TodoWrite**: Track exploration progress throughout
- **Ask clarifying questions**: Help user identify what they want to understand better

---

## Phase 1: Discovery

**Goal**: Understand what the user wants to explore

Initial request: $ARGUMENTS

**Actions**:
1. Create todo list with all phases
2. If scope unclear, ask user:
   - What area or topic interests them? (specific module, feature, or general overview)
   - What level of depth? (high-level architecture vs implementation details)
   - Any specific questions they have about the codebase?
3. Summarize exploration scope and confirm with user

---

## Phase 2: Structural Analysis

**Goal**: Map the high-level structure, architecture, and dependencies

**Actions**:
1. Launch `codebase-locator` agent to identify:
   - Package/module structure
   - Entry points and main components
   - Key directories and their purposes
   - Include list of 5-10 important structural files (READMEs, configs, indexes)

2. Read identified files to understand organization

3. Analyze dependency graph:
   - Internal package dependencies (which packages depend on which)
   - External dependencies (key third-party libraries)
   - Dependency direction and layering

4. Present structural overview as bullet summary:
   - Directory layout
   - Package dependency graph
   - Build/tooling setup

---

## Phase 3: Deep Exploration

**Goal**: Understand patterns, abstractions, and control flow in target area(s)

**Actions**:
1. Launch 2-3 agents in parallel based on exploration scope:

   **For architecture understanding** - use `codebase-analyzer`:
   - "Analyze the architecture of [area], trace abstractions and how components interact"

   **For finding patterns** - use `codebase-pattern-finder`:
   - "Find patterns for [topic] - how is this implemented across the codebase?"

   **For locating related code** - use `codebase-locator`:
   - "Locate all code related to [feature/concept] - entry points, handlers, utilities"

2. Read all key files identified by agents
3. Trace through code paths to understand flow of control

---

## Phase 4: Findings Report

**Goal**: Present clear, organized bullet summary of exploration

**Actions**:
1. Report findings as bullet summaries:

   **Structure**
   - How code is organized
   - Key directories and their roles

   **Key Components**
   - Main classes, functions, modules
   - Their responsibilities (one line each)

   **Patterns**
   - Common patterns and conventions
   - Naming conventions, file organization

   **Data Flow**
   - How data moves through the system
   - Key interfaces between components

   **Dependencies**
   - Internal dependency graph
   - External libraries and their purposes

2. Include specific file references (`file_path:line_number`) for key code

---

## Phase 5: Clarifying Questions

**Goal**: Help user explore further or clarify understanding

**Actions**:
1. Based on findings, identify areas that may need deeper exploration
2. Ask user:
   - Which areas do they want to explore deeper?
   - Any specific code paths to trace?
   - Questions about patterns or design decisions observed?
3. If user has follow-up questions, repeat Phase 3-4 for those areas