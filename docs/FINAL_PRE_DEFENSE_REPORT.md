# Astana IT University

## Educational Program: Software Engineering

# DIPLOMA THESIS

## Design and Development of an AI-Native, Trilingual Academic Management Platform as a Replacement for Traditional Learning Management Systems

**Prepared by:**
Olzhas Karabekov
Askat Narinbetov
Nurislam Baltabekov

**Supervisor:** Zhaksylyk Kozhakhmet

**Astana, 2026**

---

## TABLE OF CONTENTS

- [Annotation](#annotation)
- [Definitions](#definitions)
- [Introduction](#introduction)
- [1. Theoretical Part](#1-theoretical-part)
  - [1.1 Literature Review](#11-literature-review)
  - [1.2 Secondary Research and Analysis](#12-secondary-research-and-analysis)
  - [1.3 Alternatives Comparison](#13-alternatives-comparison)
  - [1.4 Technology Stack](#14-technology-stack)
- [2. Practical Part](#2-practical-part)
  - [2.1 Research Methodology](#21-research-methodology)
  - [2.2 Client-Server Interaction](#22-client-server-interaction)
  - [2.3 Software Architecture](#23-software-architecture)
  - [2.4 Services Description](#24-services-description)
  - [2.5 Design System & Visual Language](#25-design-system--visual-language)
  - [2.6 Internationalization (Trilingual EN/RU/KZ)](#26-internationalization-trilingual-enrukz)
- [3. Implementation](#3-implementation)
  - [3.1 User Interface Mockups & Screens](#31-user-interface-mockups--screens)
  - [3.2 AI-Powered Features in Action](#32-ai-powered-features-in-action)
- [4. Testing](#4-testing)
- [5. Deployment](#5-deployment)
- [Conclusion](#conclusion)
- [Further Research](#further-research)
- [Bibliography](#bibliography)
- [Appendices](#appendices)

---

## Annotation

This diploma thesis presents the design, development, and deployment of **UniLMS** — a comprehensive, AI-native, trilingual web-based academic management platform engineered as a modern replacement for traditional Learning Management Systems. The project addresses long-standing limitations of conventional LMS platforms through deep integration of artificial intelligence, deliberate emphasis on user experience grounded in a custom OKLCH-based design system, and first-class support for English, Russian, and Kazakh languages across both interface and AI-generated content — a combination rarely encountered in the global educational technology market and previously absent in solutions targeting Kazakhstan.

The research methodology combined quantitative survey work, comparative analysis, and iterative software development. A structured survey of 326 educational stakeholders (209 students, 117 teachers) revealed that 72.7% of respondents miss critical academic deadlines under existing systems, 28.3% identify lack of functionality as the primary pain point, and 59.2% explicitly prefer a unified platform that consolidates grades, assignments, attendance, scheduling, and materials. Furthermore, 69.9% of respondents indicated willingness to adopt a new university-specific LMS solution.

The platform architecture follows a modular monolith pattern utilizing **Next.js 14** with the App Router for the frontend, **NestJS 10** for the backend REST API, **PostgreSQL 15** with **Prisma 5.22** ORM for type-safe data persistence, and the **Anthropic Claude API** (`claude-opus-4-x` family) for the artificial intelligence layer. The frontend implements a comprehensive design system built atop CSS custom properties with OKLCH color spaces, **Geist Sans / Geist Mono / Instrument Serif** typography, density-aware control sizing, and full dark/light theme support.

Key features delivered include: JWT-based authentication with refresh-token rotation; role-based access control across Administrator, Teacher, and Student roles; full course lifecycle management; multi-file assignment submission with drafts; manual and AI-assisted grading; PRESENT/LATE/ABSENT attendance tracking; weekly schedules and monthly calendars; **real-time notifications via Server-Sent Events**; global multi-entity full-text search; activity audit logging; and a robust admin analytics dashboard. The AI module exposes five production endpoints: assignment feedback generation, quiz generation with configurable difficulty and trilingual output, course summarization with workload assessment, student performance analysis with risk-level classification, and a streaming AI chat assistant.

The system has been validated through 11 automated end-to-end tests (Jest + Supertest), a full Docker Compose deployment configuration, and visual verification across 27 distinct application routes. The platform supports compact / normal / comfortable density modes for accessibility and information-density preferences. All artificial intelligence endpoints gracefully fall back to localized demonstration responses when no API key is configured, ensuring reliable operation in development, demonstration, and evaluation environments.

**Keywords:** Learning Management System, Academic Management Platform, Artificial Intelligence in Education, Trilingual Education, Design Systems, OKLCH, Next.js, NestJS, PostgreSQL, Prisma, Anthropic Claude, Web Application, Educational Technology, Kazakhstan, Server-Sent Events.

---

## Definitions

For the purposes of this diploma thesis, the following definitions apply:

**LMS (Learning Management System)** — A software application for the administration, documentation, tracking, reporting, automation, and delivery of educational courses, training programs, or learning and development programs.

**API (Application Programming Interface)** — A set of protocols, routines, and tools that allows different software applications to communicate with each other through clearly defined methods of interaction.

**JWT (JSON Web Token)** — An open standard (RFC 7519) for securely transmitting information between parties as a compact, URL-safe JSON object, commonly used for authentication and information exchange.

**ORM (Object-Relational Mapping)** — A programming technique that converts data between incompatible type systems using object-oriented programming languages, allowing developers to interact with relational databases through object abstractions.

**RBAC (Role-Based Access Control)** — A method of restricting system access to authorized users based on their roles within an organization, with permissions assigned to roles rather than to individual users.

**SSE (Server-Sent Events)** — A server push technology enabling a client to receive automatic updates from a server via a long-lived HTTP connection, used in UniLMS for real-time notification delivery.

**LLM (Large Language Model)** — A type of artificial intelligence model trained on vast amounts of text data to understand and generate human-like text, capable of performing a wide range of natural language tasks.

**Prisma** — An open-source database toolkit that provides a type-safe ORM, query engine, schema management, and migration system for Node.js and TypeScript applications.

**OKLCH** — A perceptually uniform color space defined by Lightness, Chroma, and Hue components, providing predictable lightness scaling and ergonomic palette construction superior to legacy HSL.

**Design Token** — A platform-agnostic, single-source-of-truth value (color, spacing, typography size, motion duration, etc.) used to maintain visual consistency across an interface.

**i18n (Internationalization)** — The process of designing software so it can be adapted to various languages and regions without engineering changes; UniLMS supports English, Russian, and Kazakh.

**Modular Monolith** — A software architecture pattern in which a single deployable application is internally organized into well-defined, loosely coupled modules with clear boundaries.

**HMR (Hot Module Replacement)** — A development feature that updates modules in a running application without a full page reload, preserving application state.

**SSR / CSR / ISR** — Server-Side Rendering / Client-Side Rendering / Incremental Static Regeneration — three rendering strategies supported by Next.js.

**WCAG (Web Content Accessibility Guidelines)** — A set of recommendations published by the W3C for making web content more accessible to people with disabilities.

**MVP (Minimum Viable Product)** — A product version with just enough features to be usable by early customers, providing feedback for future development.

---

## Introduction

### Overview of the Project

The accelerating digitalization of education globally — and within Kazakhstan in particular — has profoundly transformed how teaching, learning, and academic administration are conducted. Learning Management Systems lie at the centre of this transformation, providing the digital infrastructure through which curricula are delivered, assignments are collected, grades are issued, and academic communication takes place. Yet the dominant LMS platforms in use today — Moodle, Canvas, Blackboard — were architected over a decade ago, before the maturation of artificial intelligence as a practical tool, before the modern web tooling era of React, TypeScript, and edge runtimes, and well before the proliferation of design-system-driven user-interface engineering.

This diploma thesis introduces **UniLMS**, a next-generation web-based academic management platform engineered from first principles to meet the contemporary needs of Kazakhstani higher education institutions. UniLMS is distinguished by three pillars that, taken together, are not jointly addressed by any commercially available competitor:

1. **Native artificial intelligence integration.** Five production-grade AI endpoints — assignment feedback, quiz generation, course summarization, student performance analysis, and streaming chat assistance — are embedded directly into the daily workflows of teachers and students, not bolted on as an external chatbot or premium plug-in.
2. **First-class trilingual support.** Every interface string, every system notification, every AI prompt, and every AI-generated response is available in English, Russian, and Kazakh. This is non-trivial: Khan Academy's Khanmigo, Gradescope, Synthesis, and Century Tech do not support Kazakh in any form, and only one of them has any Russian support beyond browser auto-translate.
3. **A purpose-built design system.** UniLMS implements a custom OKLCH-based visual language with Instrument Serif editorial typography, dark and light themes, density-aware control sizing, and an academic forest-green / violet accent palette — replacing the dated, undifferentiated visual identities of legacy LMS platforms with something deliberately designed to feel modern, calm, and academic.

### Significance and Practical Impact

The educational technology sector has experienced unprecedented growth: Statista (2023) projects the global e-learning market to reach **USD 457.8 billion by 2026**, a doubling from 2020 figures. Within the post-Soviet space and Central Asia specifically, this growth coincides with national digitalization strategies (Digital Kazakhstan 2018–2022, Bolashak digital reforms) that explicitly identify higher-education digitalization as a strategic priority.

Despite this market growth, our independent user research (described in detail in §1.2) shows that satisfaction with existing systems remains low. The most-cited deficiencies — weak notifications, complex interfaces, missed deadlines, poor integration between subsystems — are not theoretical concerns but documented daily frustrations of students and instructors. By delivering a platform that addresses these deficiencies while offering AI-powered productivity tools that have no equivalent in current Kazakhstani LMS deployments, UniLMS has tangible potential to:

- Reduce missed-deadline incidents (currently 72.7% in surveyed cohort) through real-time SSE notifications and AI-assisted dashboards.
- Reduce instructor grading load through AI-generated draft feedback, which the instructor can accept, edit, or dismiss.
- Improve student outcomes through personalized AI-generated study summaries and adaptive quiz generation that targets identified gaps.
- Make high-quality educational technology accessible in Kazakh and Russian for the first time at this depth, removing a significant accessibility barrier for students whose English is not strong enough to use Khanmigo or similar tools effectively.
- Provide a self-hostable, open architecture that universities can deploy without vendor lock-in or per-seat licensing fees, in contrast to Canvas, Blackboard, and proprietary alternatives.

### Objectives and Goals

The primary aim of this diploma project is to design, implement, and deliver a production-ready academic management platform that addresses the identified limitations of existing LMS solutions through the synthesis of modern web technologies, native AI integration, and rigorous attention to user experience. This aim decomposes into the following specific objectives:

1. **Conduct empirical user research** through a quantitative survey of at least 200 educational stakeholders to identify pain points and feature priorities.
2. **Perform comparative analysis** of leading existing platforms — both traditional LMS (Moodle, Canvas, Blackboard) and AI-native education tools (Khanmigo, Synthesis, Gradescope, Century Tech) — to position UniLMS distinctively.
3. **Design and document the system architecture** using established UML notations (use case, sequence, component, and entity-relationship diagrams).
4. **Implement the platform end-to-end** including authentication and RBAC, course management, assignment workflow, grading, attendance, scheduling, notifications, search, AI integration, and admin analytics.
5. **Develop a custom design system** with OKLCH color spaces, design tokens, dark/light theming, density modes, and component primitives.
6. **Deliver full trilingual coverage** (English / Russian / Kazakh) across the entire user interface and AI-generated content.
7. **Integrate five AI endpoints** with the Anthropic Claude API and provide a graceful demo-mode fallback for environments without an API key.
8. **Validate the system** through automated end-to-end tests covering authentication, courses, and assignments domains.
9. **Package the system for deployment** with Docker Compose, including automated database migrations and idempotent seed data.

### Research Questions

The work is structured around the following research questions:

- **RQ1:** What are the dominant deficiencies of existing LMS platforms as experienced by students and teachers in Kazakhstan?
- **RQ2:** How does the inclusion of native AI features change the value proposition of an LMS, and which AI capabilities are most valued by educational stakeholders?
- **RQ3:** What architectural patterns and technology choices best support an AI-native, trilingual academic management platform?
- **RQ4:** How can a modern visual design system materially improve user experience over the dated interfaces of incumbent LMS platforms?

### Thesis Structure

This thesis is organized into two principal parts plus implementation, testing, and deployment chapters:

- **Theoretical Part (Chapter 1)** presents the literature review, secondary user research, comparative analysis of alternatives, and technology-stack justification.
- **Practical Part (Chapter 2)** documents the research methodology, client-server interaction patterns, software architecture, detailed service descriptions, design system, and trilingual implementation.
- **Implementation (Chapter 3)** presents the realized user interface across all major views, with annotated screenshots showcasing both light and dark themes and trilingual rendering.
- **Testing (Chapter 4)** documents the automated test suite, manual testing protocol, and user acceptance evidence.
- **Deployment (Chapter 5)** describes the Docker Compose orchestration, environment configuration, and operational considerations.
- **Conclusion** synthesizes findings and identifies directions for further research, followed by a comprehensive bibliography of 25+ scholarly and industry sources.

---

# 1 Theoretical Part

## 1.1 Literature Review

This section presents a structured review of the academic and industry literature relevant to the design and construction of an AI-native, trilingual academic management platform. The review is organized into five thematic strands: the evolution of Learning Management Systems; the application of artificial intelligence in education; modern web development paradigms; multilingual educational software with attention to Central Asian contexts; and design systems as a contemporary engineering practice.

### 1.1.1 The Evolution of Learning Management Systems

The concept of the Learning Management System emerged in the late 1990s as universities and corporate training departments began transitioning from paper-based course materials and proprietary mainframe applications to networked, web-accessible course delivery. **Watson and Watson (2007)** offer the seminal definition that continues to anchor academic discussion: an LMS is "a software application for the administration, documentation, tracking, reporting, and delivery of educational courses or training programs." This definition is deliberately broad, encompassing the full spectrum of academic-management functionality rather than merely course-content delivery.

**Coates, James, and Baldwin (2005)** offered one of the first critical examinations of LMS effects on university teaching, identifying both the productivity benefits and the homogenizing influence on pedagogical practice. Their concerns — that adoption of LMS platforms could constrain pedagogical creativity by enforcing rigid templates — remain pertinent two decades later.

**Picciano (2017)** characterizes the second-generation transition as the shift from on-premises Moodle-style installations to cloud-native platforms such as Canvas, identifying scalability, multi-tenant architecture, and continuous deployment as key transformative properties of the cloud transition. The paper argues that traditional LMS platforms have evolved into "the operating system of higher education," a framing that has shaped subsequent discussion.

**Brown (2019)** introduces the influential metaphor of the LMS as a "walled garden" — a critique that resonates with modern user research. Brown argues that traditional LMS platforms succeed at administrative tasks but actively impede pedagogical innovation by tightly coupling content authoring, assessment, and delivery into a single proprietary container. Brown's argument informs our decision to design UniLMS with explicit support for external content references, standards-based APIs, and a modular service architecture.

**Kerres and Bedenlier (2020)** provide a comparative survey across major LMS platforms during the COVID-19 pivot to remote learning, documenting both rapid feature adoption and substantial usability gaps. Their findings, drawing on data from European and North American universities, parallel the survey data we collect from Kazakhstani stakeholders in §1.2.

### 1.1.2 Artificial Intelligence in Education

The integration of artificial intelligence into educational technology is one of the most significant developments of the past five years. **Holmes, Bialik, and Fadel (2019)** provide a comprehensive framework for AI in education organized into three primary application domains: intelligent tutoring systems, automated assessment, and learning analytics. Their analysis identifies the underlying capabilities — natural language understanding, knowledge representation, and adaptive response — that underpin practical applications.

**VanLehn (2011)** offers a landmark meta-analysis of the relative effectiveness of human tutoring, intelligent tutoring systems, and other forms of tutoring. The principal finding — that high-quality intelligent tutoring systems achieve effect sizes of d ≈ 0.76, approaching but not equalling human one-on-one tutoring (d ≈ 0.79) — provides empirical grounding for our investment in AI features. The gap between systems and human tutors has narrowed further in the era of large language models, as demonstrated by **Kasneci et al. (2023)** in their wide-ranging treatment of ChatGPT in educational contexts.

**Zawacki-Richter, Marín, Bond, and Gouverneur (2019)** offer a systematic review of AI in higher education covering 146 studies. They identify four dominant categories of application: profiling and prediction, intelligent tutoring systems, assessment and evaluation, and adaptive systems. Their finding that 76% of reviewed studies originated in computer-science departments rather than education departments highlights both the opportunity and the risk of building AI-powered educational tools — pedagogical theory must be deliberately integrated.

**Luckin (2017)** argues that the most impactful AI educational tools will be those that augment teacher capacity rather than replace it. This argument is consciously reflected in UniLMS's design philosophy: every AI-generated artifact — feedback, summary, quiz question — is marked as AI-generated, presented as a *suggestion*, and offered with explicit accept / edit / dismiss controls. The teacher retains final authority.

**Attali and Burstein (2006)** offer the canonical treatment of automated essay scoring, the technological precursor to modern AI-generated assignment feedback. Their work established both the feasibility and the limitations of automated assessment, particularly around assessing creativity, argumentation, and domain-specific reasoning. **Ramesh and Sanampudi (2022)** survey the field two decades later, documenting the substantial accuracy improvements enabled by transformer-based language models.

**Siemens and Long (2011)** introduce the concept of learning analytics — the measurement, collection, analysis, and reporting of data about learners to understand and optimize learning. This concept directly informs UniLMS's AI Student Analysis feature, which synthesizes grade, attendance, and submission data into structured assessments of student standing and risk level.

Survey results from our own research (§1.2) confirm strong stakeholder interest in AI features. The most-valued capabilities are AI chat assistant (23.6%), content summarization (20.8%), automated feedback (18.8%), quiz generation (18.8%), and performance analytics (18.0%). UniLMS implements all five.

### 1.1.3 Modern Web Development Paradigms

The architectural and technological foundations of contemporary web applications have evolved dramatically over the past decade. The rise of JavaScript and TypeScript as full-stack languages, of component-based UI frameworks, and of edge-rendered hybrid applications has changed both what is possible and what is expected of educational software.

**Abramov (2018)**, on behalf of the React core team, articulated the principles that have come to define modern frontend engineering: declarative composition, unidirectional data flow, and component encapsulation. React, introduced by Facebook in 2013, popularized the virtual DOM, unidirectional state updates, and the broader practice of treating user interfaces as composable functions of state.

**Next.js**, introduced by Vercel in 2016 and built atop React, established itself as the dominant production-grade React framework by integrating routing, server-side rendering, static generation, image optimization, and a unified build pipeline. The Next.js App Router (Next.js 13+), released in 2022, introduced React Server Components, nested layouts, and streaming rendering — features that UniLMS leverages extensively.

**Kamil (2019)** documents the rise of **NestJS**, a backend Node.js framework structured around modules, decorators, and dependency injection. NestJS draws explicitly from the architectural patterns of Angular (frontend) and Spring Boot (backend Java), bringing enterprise-friendly conventions to the Node.js ecosystem.

**Brieuc (2021)** describes Prisma, the database access layer that has replaced traditional ORMs such as Sequelize and TypeORM in many new Node.js projects. Prisma's combination of schema-first declarative modeling, generated type-safe client, and automatic migration generation removes entire categories of common database errors at compile time.

**Dabit (2020)** and **Newman (2021)** offer differing perspectives on architectural granularity: Dabit advocates serverless full-stack designs, while Newman makes the case for cautious microservice adoption with explicit recognition of the operational complexity microservices introduce. UniLMS adopts a *modular monolith* — a deliberate intermediate posture that preserves microservice-style internal modularity (clear service boundaries, dependency injection, independently testable modules) while retaining the operational simplicity of single-deployable-artifact monolithic systems.

**Dahl, Belder, and Iwańczuk (2020)** introduce Deno as a modernized runtime — a development that, while not adopted by UniLMS, signals the continued evolution of the JavaScript runtime ecosystem.

### 1.1.4 Multilingual Educational Software and Localization

The body of literature specifically addressing multilingual educational software in Central Asia is thinner than in other domains, but several relevant strands inform our work.

**UNESCO (2021)** identifies multilingual education access as a strategic priority for Sustainable Development Goal 4 (Quality Education), arguing that learners receive instruction in their mother tongue and that digital learning tools should support major languages of instruction. For Kazakhstan, this implies meaningful Kazakh-language support — not merely browser-level auto-translation.

**Bond, Marín, Dolch, Bedenlier, and Zawacki-Richter (2020)** map the educational-technology literature globally and identify a strong English-language bias in both research and product development. They argue that meaningful internationalization requires native-speaker review of translations and that machine translation is insufficient for educational settings, where precision of terminology matters.

In practical engineering terms, the i18n (internationalization) and l10n (localization) literature distinguishes between *string externalization* (separating user-facing text from code), *locale-aware formatting* (numbers, dates, currencies), and *pluralization rules* (which differ substantially across languages — Russian's three-form plural is notably more complex than English's binary form). UniLMS implements all three, with locale-specific date and number formatting via `Intl.DateTimeFormat` and `Intl.NumberFormat`.

A particularly relevant consideration for Cyrillic and Kazakh scripts is *line-height ergonomics*: tall Kazakh diacritics (ң, ғ, қ, ү, ұ, һ, ә, і, ө) interact with line-height settings differently from Latin text. UniLMS's design-system line-height tokens account for this with explicit headroom on the Cyrillic family.

### 1.1.5 Design Systems in Modern Web Applications

The discipline of design systems — codifying reusable visual and interaction patterns across a product surface — has matured rapidly. Pioneering work at Google (Material Design), IBM (Carbon), Salesforce (Lightning), and more recently at Vercel (Geist) has established the design-system pattern as the default approach for serious product engineering. **Brad Frost's Atomic Design (2013)** offers the dominant conceptual model: atoms (primitive components) compose into molecules (small composite components), organisms (page sections), templates (layouts), and pages (concrete instances).

A modern design system rests on **design tokens** — platform-agnostic, single-source-of-truth values for colors, spacing, typography, motion, and elevation. UniLMS implements design tokens via CSS custom properties, with the **OKLCH** color space replacing the legacy HSL representation. OKLCH provides perceptually uniform lightness, predictable chroma scaling, and was selected explicitly so that color palette construction across light and dark themes yields visually consistent results without manual tweaking of individual stops.

The choice of typography is also informed by recent industry practice. **Geist Sans** and **Geist Mono**, released by Vercel in 2023, represent a new generation of UI-first variable fonts optimized for screen rendering at dense interface scales. **Instrument Serif** (Instrument, 2022) is a contemporary editorial serif used by UniLMS for hero headings and emphasized phrases, evoking academic gravitas without the dated feel of traditional serif fonts.

### 1.1.6 Section Summary

The literature establishes that (a) the LMS market has matured into a category dominated by aging platforms with structural limitations, (b) AI in education has graduated from research curiosity to practical productivity tool, (c) the modern web stack provides materially better engineering primitives than were available a decade ago, (d) meaningful trilingual support remains rare and is a genuine market gap in Central Asia, and (e) design systems are now table-stakes for serious product engineering. UniLMS combines all five strands into a single deliverable, an integration that — to the authors' knowledge — has no exact precedent in published educational technology.

## 1.2 Secondary Research and Analysis

This section presents the methodology and results of user research conducted to validate the project hypothesis and inform feature prioritization. The research instrument was a structured survey distributed to students and teachers in Kazakhstan, yielding 326 complete responses.

### 1.2.1 Survey Methodology

The survey instrument was designed across five thematic domains:

1. **Current LMS usage patterns** — which platforms respondents currently use, frequency of use, primary tasks.
2. **Satisfaction with existing features** — five-point Likert ratings of satisfaction across grade visibility, assignment workflow, notification reliability, mobile experience, and interface complexity.
3. **Desired functionality** — open-ended and ranked questions about which features respondents wished existed in a single platform.
4. **Mobile usage preferences** — frequency of mobile vs. desktop access, mobile pain points.
5. **Attitudes toward AI-powered tools** — willingness to use AI features, perceived value of specific AI capabilities.

The survey was distributed via Google Forms through academic channels (student WhatsApp/Telegram groups, faculty mailing lists, on-campus QR codes). The instrument was offered in Russian, with English and Kazakh translations available on request. Responses were collected over a four-week period, yielding 326 complete and valid responses after removal of incomplete and obvious-spam submissions.

**Table 1.1 — Survey Respondent Demographics**

| Role    | Count | Percentage |
|---------|-------|------------|
| Student | 209   | 64.1%      |
| Teacher | 117   | 35.9%      |
| Total   | 326   | 100%       |

The 64.1% student / 35.9% teacher distribution provides a balanced view from both primary user constituencies, while reflecting the natural higher density of students in any educational population.

### 1.2.2 Main Problems in Existing LMS Platforms

The first analytical question asked respondents to identify the principal problems they experience with current LMS platforms. Respondents could select multiple options; the percentages below represent share of respondents endorsing each pain point.

| Pain Point                  | Share of Respondents |
|-----------------------------|----------------------|
| Lack of functionality       | 28.3%                |
| Complex interface           | 26.1%                |
| Weak notification system    | 23.4%                |
| Poor integration            | 22.3%                |
| Outdated visual design      | 19.6%                |
| Limited mobile experience   | 18.1%                |
| Missing AI features         | 14.7%                |

The top four pain points are remarkably evenly distributed (22–28%), suggesting these are not idiosyncratic complaints but a coherent quartet of structural problems with incumbent solutions. UniLMS directly addresses each: a unified feature surface for **lack of functionality**, a deliberately designed visual language for **interface complexity**, real-time SSE notifications for the **notification system**, and a single integrated platform replacing multiple loosely-coupled tools for **integration**.

### 1.2.3 Frequency of Missed Deadlines or Updates

A critical follow-up question asked how frequently respondents miss deadlines or updates in their current systems:

| Frequency  | Count | Percentage |
|------------|-------|------------|
| Often      | 112   | 34.4%      |
| Sometimes  | 125   | 38.3%      |
| Rarely     | 60    | 18.4%      |
| Never      | 29    | 8.9%       |

A combined **72.7% (237 of 326) report missing deadlines or updates "Often" or "Sometimes."** This is a striking finding with direct pedagogical consequences — missed deadlines damage grades, while missed announcements degrade course participation. UniLMS's real-time SSE notification stream, role-aware dashboards highlighting urgent deadlines, and AI-assisted "next deadline" widgets are direct responses to this finding.

### 1.2.4 Features Expected in a Single System

When asked which academic workflows respondents wanted unified into a single platform, the distribution clustered tightly around the five core academic primitives:

| Feature       | Share |
|---------------|-------|
| Grades        | 20.8% |
| Assignments   | 20.7% |
| Attendance    | 20.4% |
| Schedule      | 19.1% |
| Materials     | 18.9% |

This near-uniform distribution validates the unified-platform hypothesis: there is no single feature that dominates demand; rather, respondents want all five integrated. UniLMS delivers all five as first-class modules.

### 1.2.5 Most Valuable AI Features

Survey respondents were asked to rank the AI features they would find most valuable:

| AI Feature             | Share |
|------------------------|-------|
| AI chat assistant      | 23.6% |
| Content summarization  | 20.8% |
| Automated feedback     | 18.8% |
| Quiz generation        | 18.8% |
| Performance analytics  | 18.0% |

UniLMS implements all five as production endpoints, described in detail in §2.4.5 and demonstrated visually in §3.2.

### 1.2.6 Preference for a Unified LMS

A direct question — "Would you prefer a single system that combines all academic activities?" — yielded:

| Response | Count | Percentage |
|----------|-------|------------|
| Yes      | 193   | 59.2%      |
| Maybe    | 86    | 26.4%      |
| No       | 47    | 14.4%      |

The **59.2% "Yes" combined with 26.4% "Maybe" gives 85.6% non-opposed**, providing strong market validation. Only 14.4% prefer the status quo of fragmented tools.

### 1.2.7 Willingness to Adopt UniLMS Specifically

Respondents were also asked whether they would be willing to adopt a new university-specific LMS:

| Response | Count | Percentage |
|----------|-------|------------|
| Yes      | 111   | 34.0%      |
| Maybe    | 117   | 35.9%      |
| No       | 98    | 30.1%      |

A **combined 69.9% positive** disposition indicates substantial adoption potential.

### 1.2.8 Summary of Survey Findings

The survey provides robust empirical grounding for the principal design choices of UniLMS:

- **Unified platform thesis is validated** — 85.6% non-opposed to consolidation.
- **Notification reliability is critical** — 72.7% currently experience missed-deadline incidents.
- **AI features are wanted, not merely tolerated** — all five surveyed AI capabilities polled between 18% and 24%, with no dominant outlier suggesting respondents want a portfolio rather than a single AI feature.
- **Pain points are evenly distributed** across functionality, interface, notifications, and integration — implying that addressing only one will not yield a competitive product.

These findings directly informed feature prioritization, architectural decisions, and design-system choices documented throughout the remainder of this thesis.

## 1.3 Alternatives Comparison

This section presents a structured comparative analysis of platforms in the adjacent and competitive space. The analysis is organized into two groups: **traditional LMS platforms** (Moodle, Canvas, Blackboard Learn) and **AI-native educational platforms** (Khan Academy Khanmigo, Synthesis Tutor, Gradescope, Century Tech). The two-group structure reflects a strategic decision based on feedback from the second pre-defense panel: a comparison only against traditional LMS understates UniLMS's distinctive AI-native positioning.

### 1.3.1 Moodle

**Moodle** (Modular Object-Oriented Dynamic Learning Environment), released in 2002 by Martin Dougiamas, is the most widely deployed LMS globally, serving over 300 million users at more than 150,000 registered installations. Moodle's open-source PHP/MySQL architecture has proven durable across two decades.

**Strengths:** Open-source licensing (zero per-seat cost); extensive plugin ecosystem; very mature feature set; broad institutional familiarity in Russian-speaking academia.

**Weaknesses:** Visual design and interaction patterns reflect mid-2000s web conventions; mobile experience is functional but not optimized; AI integration requires third-party plugins that are inconsistently maintained; performance degrades at scale on the LAMP stack; the administrative interface is famously dense and intimidating for non-technical users.

**Opportunities for UniLMS:** Modern UX; native AI; opinionated default behaviors rather than the vast Moodle option-surface; first-class trilingual support.

**Threats:** Moodle's ubiquity and zero-cost positioning create switching-cost barriers; the LAMP-stack familiarity in many IT departments means lower operational risk for institutions choosing Moodle.

### 1.3.2 Canvas LMS

**Canvas LMS**, developed by Instructure since 2011, represents a more modern approach to LMS design. Built on Ruby on Rails atop PostgreSQL, Canvas was designed from inception as a cloud-native platform. Canvas dominates the US higher-education market and has expanded internationally.

**Strengths:** Excellent user experience; strong mobile applications; mature gradebook and rubric features; reliable cloud infrastructure; growing AI feature set (Canvas Smart Insights, Canvas AI tutor — beta).

**Weaknesses:** Proprietary; substantial per-seat licensing cost; English-first interface with Russian and Kazakh available only via community-contributed translations of variable quality; limited customization compared to Moodle; AI features are primarily English-only.

### 1.3.3 Blackboard Learn

**Blackboard Learn**, originally released in 1997, is one of the oldest and most widely deployed commercial LMS platforms. The "Ultra" experience represents a comprehensive 2015 modernization. Blackboard is dominant in the US and present internationally.

**Strengths:** Mature enterprise-grade infrastructure; deep integrations with student information systems; extensive analytics; growing AI assistant (Blackboard AI Design Assistant).

**Weaknesses:** Notoriously aging interface, even in the "Ultra" experience; per-seat licensing; English-first; limited Kazakh/Russian support beyond machine translation.

### 1.3.4 Khan Academy — Khanmigo

**Khanmigo** is Khan Academy's AI tutoring assistant, launched in 2023 atop GPT-4. Khanmigo represents the leading example of an AI-native education product, but is positioned as a personal tutoring agent rather than a complete LMS.

**Strengths:** Industry-leading AI tutoring; Socratic dialogue patterns rather than direct answer-giving; effective scaffolding of student learning; backed by Khan Academy's pedagogical authority.

**Weaknesses:** **Not a full LMS** — has no grade book, no admin tools, no enrolment management, no scheduling, no notifications system; English-only interface and AI; subscription-based ($4/month at time of writing); not self-hostable; depends entirely on OpenAI infrastructure.

**Differentiation from UniLMS:** UniLMS subsumes Khanmigo's AI tutoring use case (via the AI chat assistant) within a full LMS surface, and does so trilingually.

### 1.3.5 Synthesis Tutor

**Synthesis Tutor** is an AI-driven math tutoring product targeting K–12 students, launched in 2024. Synthesis pioneers conversational adaptive instruction.

**Strengths:** Excellent adaptive math instruction; strong product design; effective student engagement.

**Weaknesses:** Narrow scope (mathematics only); K–12 target audience does not align with higher education; not a multi-role platform; English-only; not self-hostable.

### 1.3.6 Gradescope

**Gradescope** is a Turnitin-owned grading tool widely adopted in STEM education. It is specifically focused on assignment grading workflows.

**Strengths:** Excellent rubric-driven grading; OCR-based handwriting recognition; AI-assisted grade suggestions; statistical analytics on assignment performance.

**Weaknesses:** **Not an LMS** — only the grading step; integrates *with* Canvas / Blackboard rather than replacing them; per-seat licensing; English-only AI; not self-hostable.

**Differentiation from UniLMS:** UniLMS subsumes Gradescope's AI-assisted grading workflow into its AI Feedback feature while providing the surrounding LMS surface that Gradescope lacks.

### 1.3.7 Century Tech

**Century Tech** is an AI-powered adaptive learning platform targeting schools and tertiary institutions, primarily in the UK and Middle East.

**Strengths:** Strong adaptive content paths; learning analytics; teacher-facing dashboards; targets institutional sales.

**Weaknesses:** Closed proprietary content model; license cost; English-only AI; limited integration story for external content; primary K–12 audience.

### 1.3.8 Comparative Matrices

The following matrices summarize the comparative analysis across the eight platforms surveyed, on dimensions selected to highlight where UniLMS is distinctively positioned.

**Table 1.2 — Comparison Against Traditional LMS**

| Criterion              | Moodle      | Canvas         | Blackboard      | **UniLMS**        |
|------------------------|-------------|----------------|-----------------|-------------------|
| Licensing              | Open Source | Proprietary    | Proprietary     | Self-hostable     |
| Per-seat cost          | Free        | Paid           | Paid            | Free              |
| User experience        | Moderate    | Excellent      | Good (Ultra)    | Excellent         |
| Mobile experience      | Good        | Excellent      | Good            | Excellent         |
| AI integration         | Plug-in     | Beta features  | Beta features   | **Native (5 endpoints)** |
| Russian UI             | Yes         | Partial        | Partial         | **Native**        |
| Kazakh UI              | Partial     | No             | No              | **Native**        |
| Trilingual AI output   | No          | No             | No              | **Yes**           |
| Customization          | Excellent   | Limited        | Moderate        | High (open code)  |
| Scalability            | Moderate    | Excellent      | Excellent       | High (Docker)     |

**Table 1.3 — Comparison Against AI-Native Education Tools**

| Criterion              | Khanmigo    | Synthesis    | Gradescope     | Century Tech   | **UniLMS**        |
|------------------------|-------------|--------------|----------------|----------------|-------------------|
| Full LMS surface       | No          | No           | No             | Partial        | **Yes**           |
| AI tutoring chat       | Excellent   | Excellent    | No             | Limited        | Yes (streaming)   |
| AI grading             | No          | No           | Excellent      | No             | Yes               |
| AI quiz generation     | No          | Limited      | No             | Limited        | Yes               |
| AI summarization       | No          | No           | No             | Limited        | Yes               |
| Multi-role             | No          | No           | Partial        | Yes            | **Yes (3 roles)** |
| Trilingual             | No          | No           | No             | No             | **Yes**           |
| Self-hostable          | No          | No           | No             | No             | **Yes**           |
| Pricing model          | Subscription| Subscription | Per-seat       | Institutional  | Free (self-host)  |

The matrices make clear that no surveyed alternative is jointly competitive on the dimensions UniLMS prioritizes. Khanmigo competes on AI tutoring quality but lacks LMS surface; Gradescope competes on AI grading but lacks the surrounding workflow; Canvas competes on UX and feature breadth but lacks native trilingual AI; Moodle is free but is dated and AI-poor. UniLMS occupies a deliberately distinctive intersection.

### 1.3.9 Data Collection Methods and Limitations

The comparative analysis was conducted through:

- **Direct product evaluation**: Free-tier accounts created on Canvas (cloud trial), Khanmigo (free demo), and Synthesis (demo lessons). Moodle was evaluated through a local Docker installation. Blackboard and Century Tech were evaluated through publicly available demonstration videos and documentation.
- **Documentation review**: Official feature documentation, pricing pages, and integration guides.
- **User community review**: Reddit communities (r/Professors, r/edtech), Slack groups (Higher Ed Edtech), and industry blog posts.
- **Academic literature**: Per the literature review in §1.1.

**Limitations:** Several platforms (Blackboard Ultra, Century Tech) required institutional access for hands-on evaluation that was not available, so analysis is based on documentation and third-party review. Pricing comparisons reflect public information at the time of writing; institutional discounts may apply. AI feature comparisons reflect features available at the time of writing; this is a rapidly evolving area.

## 1.4 Technology Stack

This section justifies the technology choices made for UniLMS, with explicit comparisons to alternatives. Technology selection was guided by four evaluation criteria: **performance characteristics**, **developer experience**, **community and ecosystem support**, and **alignment with project requirements** (especially native TypeScript, AI integration, and trilingual support).

### 1.4.1 Frontend: Next.js with TypeScript

**Next.js 14** with the App Router was selected as the frontend framework. The decision was informed by:

- **Production-ready full-stack**: Next.js provides server-side rendering, static generation, client-side hydration, and API routes in a single coherent stack. For an academic platform with a mix of authentication-gated dashboards (SSR-favored) and static content (SSG-favored), this hybrid capability is ideal.
- **App Router & React Server Components**: The App Router enables nested layouts, streaming, parallel routing, and React Server Components — all of which reduce client-side JavaScript and improve initial-load performance.
- **TypeScript-native**: Type safety is enforced end-to-end. Errors that would manifest as production crashes elsewhere are caught at compile time.
- **Mature ecosystem**: First-class integrations with `tailwindcss`, `@tanstack/react-query`, `framer-motion`, and `next/font` — all of which UniLMS uses.

**Table 1.4 — Frontend Framework Comparison**

| Framework      | Learning Curve | Ecosystem | Performance | SSR Support | Verdict             |
|----------------|----------------|-----------|-------------|-------------|---------------------|
| Next.js (React)| Moderate       | Excellent | Excellent   | Native      | **Selected**        |
| Nuxt (Vue)     | Moderate       | Good      | Excellent   | Native      | Strong alternative  |
| SvelteKit      | Easy           | Growing   | Excellent   | Native      | Smaller community   |
| Angular        | Steep          | Excellent | Good        | Universal   | Heavier             |

### 1.4.2 Backend: NestJS

**NestJS 10** was selected as the backend framework. Justification:

- **Modular architecture**: NestJS's module system enables clean separation of concerns. UniLMS organizes business logic into 19 distinct modules (auth, courses, assignments, AI, notifications, etc.), each independently testable.
- **TypeScript-first**: Same type-safety benefits as the frontend.
- **Dependency injection**: Clean handling of cross-cutting concerns (database client, logger, configuration).
- **Built-in OpenAPI/Swagger support**: UniLMS exposes 96 documented API endpoints via Swagger at `/api/docs`.
- **Familiar conventions** for developers coming from Angular (frontend) or Spring Boot (Java).

**Table 1.5 — Backend Framework Comparison**

| Framework  | Architecture | TypeScript | Documentation | Enterprise Ready | Verdict             |
|------------|--------------|------------|---------------|------------------|---------------------|
| NestJS     | Modular      | Native     | Excellent     | Yes              | **Selected**        |
| Express.js | Minimalist   | Via @types | Good          | Partial          | Too unstructured    |
| Fastify    | Plugin-based | Native     | Good          | Partial          | Less convention     |
| Django     | MVC (Python) | No (Python)| Excellent     | Yes              | Different ecosystem |
| Spring Boot| MVC (Java)   | No (Java)  | Excellent     | Yes              | Different ecosystem |

### 1.4.3 Database: PostgreSQL with Prisma

**PostgreSQL 15** was selected as the relational database, with **Prisma 5.22** as the ORM. Justification:

- **PostgreSQL standards compliance**: Full ACID semantics, comprehensive SQL support, mature replication and backup tooling.
- **Native JSONB**: Allows UniLMS to store semi-structured data (AI response metadata, design configurations) without a separate NoSQL store.
- **Full-text search**: Native to PostgreSQL, used for UniLMS's global search functionality.
- **Prisma type-safe queries**: Database queries are type-checked at compile time. The schema is single-source-of-truth across the database and TypeScript types.
- **Prisma migrations**: Declarative schema-driven migration generation reduces operational risk.

**Table 1.6 — Database Comparison**

| Database  | Type       | ACID | JSON Support | Full-Text Search | Verdict      |
|-----------|------------|------|--------------|------------------|--------------|
| PostgreSQL| Relational | Yes  | Native       | Excellent        | **Selected** |
| MySQL     | Relational | Yes  | Limited      | Good             | Less feature-rich |
| MongoDB   | Document   | Partial | Native    | Moderate         | Wrong shape for academic data |
| SQLite    | Embedded   | Yes  | Limited      | Limited          | Not scalable |

### 1.4.4 AI Provider: Anthropic Claude

**Anthropic Claude API** was selected (model family `claude-opus-4-x`) for the AI layer. Justification:

- **Strong long-context performance**: Claude's effective handling of 100k+ token contexts is valuable for course-summary tasks over large material sets.
- **Reliable structured outputs**: Claude is reliable at JSON schema adherence, critical for the quiz-generation endpoint where outputs must be parseable.
- **Safety positioning**: Anthropic's emphasis on Constitutional AI reduces risk of inappropriate AI content in an educational context with potentially minor users.
- **Cost-effective for the intended usage pattern**: Per-token economics work well for educational use where prompt lengths are moderate.

**Table 1.7 — AI Provider Comparison**

| Provider          | Model Quality | Cost     | Long Context | Structured Output | Verdict      |
|-------------------|---------------|----------|--------------|-------------------|--------------|
| Anthropic Claude  | Excellent     | Moderate | Excellent    | Excellent         | **Selected** |
| OpenAI GPT-4      | Excellent     | High     | Moderate     | Excellent         | Strong alt   |
| Google Gemini     | Good          | Low      | Excellent    | Good              | Cheaper alt  |
| Local LLM (Llama) | Variable      | Free     | Limited      | Variable          | Not production-ready for this use |

### 1.4.5 Design System and Typography

UniLMS implements a custom design system rather than adopting an off-the-shelf component library. This decision was made deliberately to (a) achieve a distinctive academic visual identity rather than a generic "shadcn default" look, (b) support the OKLCH color space natively rather than wrapping HSL legacy values, and (c) deliver Instrument Serif editorial typography that no off-the-shelf library bundles.

Typography selection:

- **Geist Sans** (Vercel, 2023) for UI body and label text.
- **Geist Mono** for eyebrows, code, and numeric tables.
- **Instrument Serif** (Instrument, 2022) for hero headings with italic em-emphasis.

### 1.4.6 Supporting Libraries

- **Tailwind CSS 3.4** — utility-first styling integrated with design tokens.
- **TanStack Query 5** — client-side server-state management.
- **Framer Motion 12** — page transitions and micro-interactions.
- **Zod 3** — runtime validation of AI structured outputs.
- **bcryptjs** — password hashing.
- **jsonwebtoken** — JWT signing and verification.
- **multer** — file upload handling.
- **nodemailer** — optional email notifications.
- **Helmet** — HTTP security headers.
- **@nestjs/throttler** — rate limiting.

---

# 2 Practical Part

## 2.1 Research Methodology

The UniLMS development followed an Agile methodology adapted from Scrum, selected for its iterative cadence and emphasis on incremental feature delivery. The exploratory nature of integrating AI features into an academic platform — where requirements emerge through experimentation rather than being fully specifiable up front — made a heavyweight waterfall approach unsuitable.

### 2.1.1 Sprint Structure

The project was organized into **five two-week sprints**, each delivering a coherent slice of platform functionality:

| Sprint | Focus                                  | Outcome                                       |
|--------|----------------------------------------|-----------------------------------------------|
| 1      | Authentication, RBAC, user management  | Login, register, JWT, role guards             |
| 2      | Courses, enrollments, materials        | Course CRUD, enrollment, content delivery     |
| 3      | Assignments, submissions, grading      | Assignment workflow including file uploads    |
| 4      | AI module, notifications, search       | All 5 AI endpoints, SSE, global search        |
| 5      | Design system, trilingual i18n, polish | Visual redesign, EN/RU/KZ, density, testing   |

Each sprint began with a planning session (1 hour) and ended with a retrospective (45 minutes). Daily stand-ups (15 minutes) facilitated issue identification and division of labor.

### 2.1.2 Continuous Integration and Continuous Deployment

CI/CD practices were partial during development and full at the end:

- **TypeScript strict-mode checks** on every commit catch type errors before merge.
- **Jest test suite** (11 tests across 3 spec files) runs against an isolated `unilms_test` database, invoked via `pnpm test`.
- **Docker Compose** orchestration provides reproducible local and demo environments — `docker compose up --build` brings the full system online.

### 2.1.3 Design Methodology

The design process followed a deliberate, design-system-first approach:

1. **Token-first design**: Color palettes (OKLCH light + dark), spacing scale (4px base, 4–96px steps), typography scale (xs through 6xl), motion durations (fast/base/slow), and elevation shadow ramp were established before component design.
2. **Component primitives**: Eight primitive components (Button, Card, Badge, Input, Textarea, Select, Dialog, Toaster) were constructed from tokens.
3. **Design-system components**: Twelve composite DS components (Eyebrow, HDisplay, Stat, Spark, Segment, DataTable, Tabs, Alert, DsAvatar, Kbd, DsProgress, DensityToggle).
4. **AI-specific patterns**: Eight AI-domain components (AIBubble, AIComposer, StreamingText, ThinkingDots, GenerationPanel, SuggestionStrip, AIFeedbackPanel, QuizQuestionPreview).
5. **Page composition**: Pages were built by composing primitives, DS components, and AI components — no page contains substantial bespoke styling.

This pattern is documented further in §2.5 below.

### 2.1.4 Testing Methodology

UniLMS testing follows a pragmatic, multi-layer approach:

- **End-to-end automated tests** (Jest + Supertest): 11 tests covering authentication, course access control, and assignments management. All tests run against a dedicated `unilms_test` PostgreSQL database with full migration history.
- **Type-level testing**: TypeScript strict mode acts as an always-on first line of defense. `tsc --noEmit` returns zero errors on both backend and frontend.
- **Manual exploratory testing**: All 27 frontend routes manually exercised across both themes (dark, light) and all three locales (en, ru, kz).
- **Build verification**: `pnpm build` succeeds on both frontend (27 routes prerendered or dynamically rendered) and backend (NestJS production build).

## 2.2 Client-Server Interaction

This section describes the principal interaction patterns between client and server, with emphasis on three flagship workflows: authentication, AI quiz generation, and real-time notification delivery.

### 2.2.1 Authentication Flow

```
┌─────────┐         ┌─────────────┐        ┌───────────────┐       ┌──────────────┐
│ Browser │         │ Next.js     │        │ NestJS Backend │       │ PostgreSQL   │
└────┬────┘         │ Frontend    │        │ (port 4000)    │       │ (port 5432)  │
     │              └──────┬──────┘        └────────┬───────┘       └──────┬───────┘
     │ POST /api/auth/login                         │                      │
     ├──── { email, password } ───────────────────►│                      │
     │                                              │ SELECT user WHERE email
     │                                              ├─────────────────────►│
     │                                              │ ◄─────────────────── user row
     │                                              │ bcrypt.compare()     │
     │                                              │ jwt.sign(access 15m) │
     │                                              │ jwt.sign(refresh 7d) │
     │ ◄── 200 { accessToken, refreshToken, user }──┤                      │
     │ Set-Cookie: access_token, refresh_token       │                      │
     │              (httpOnly, sameSite=lax)         │                      │
     ▼                                              │                      │
```

The httpOnly attribute on the cookies prevents JavaScript access (mitigating XSS-token-exfiltration risk), and the sameSite=lax attribute mitigates CSRF.

### 2.2.2 AI Quiz Generation Flow

```
┌─────────┐    ┌─────────┐    ┌───────────────┐    ┌────────────────┐    ┌────────────┐
│ Teacher │    │ Frontend│    │ NestJS Backend │    │ Anthropic API  │    │ PostgreSQL │
└────┬────┘    └────┬────┘    └────────┬───────┘    └────────┬───────┘    └──────┬─────┘
     │ Type "SQL Joins" + click Generate                       │                  │
     ├──────────►│                                              │                  │
     │           │ POST /api/ai/generate-quiz                  │                  │
     │           │ { courseId, topic, questionCount: 5,        │                  │
     │           │   difficulty: 'medium', lang: 'ru' }        │                  │
     │           ├─────────────────────────────────────────────►│                  │
     │           │                                              │ JWT verify       │
     │           │                                              │ Role check       │
     │           │                                              │ Build prompt     │
     │           │                                              │ (RU instructions)│
     │           │                                              ├─────────────────►│
     │           │                                              │  messages.create │
     │           │                                              │ ◄──── tokens ────┤
     │           │                                              │ JSON regex parse │
     │           │                                              │ Zod validate     │
     │           │                                              │                  │
     │           │                                              ├─ INSERT AiRequestLog ►│
     │           │ ◄────── 200 { questions: [5 questions] } ────┤                  │
     │ ◄───── Render in QuizQuestionPreview components ────────┤                  │
```

Note the **Zod validation step**: Claude's response is parsed as JSON, then strictly validated against a Zod schema that requires exactly 4 options per question, a `correctIndex` in 0–3, and presence of an explanation. This prevents malformed AI output from breaking the UI.

### 2.2.3 Server-Sent Events for Notifications

UniLMS uses **Server-Sent Events (SSE)** to deliver real-time notifications. SSE was chosen over WebSockets because (a) UniLMS notifications are one-way server-to-client; (b) SSE uses standard HTTP and works through corporate proxies; (c) the browser EventSource API handles reconnection automatically.

```
┌─────────┐        ┌────────────────┐        ┌────────────────────────┐
│ Student │        │ Next.js client │        │ NestJS Backend         │
└────┬────┘        └────────┬───────┘        └────────────┬───────────┘
     │ Visit /dashboard      │                              │
     │ (sets up SSE)         │                              │
     │                       ├─ GET /api/me/notifications/stream ────►│
     │                       │ ◄─── event: ready,                     │
     │                       │      data: { unread: 3 }               │
     │                       │                                        │
     │                       │ ... 25 s heartbeat (event: ping) ◄────┤
     │                       │                                        │
     │ (Teacher grades work) │                                        │
     │                       │                                        │
     │                       │ ◄─── event: notification,              │
     │                       │      data: { id, type:                 │
     │                       │      GRADE_PUBLISHED, title, body }    │
     │                       │ Toast appears                          │
     │                       │ Bell badge increments                  │
```

The backend maintains an in-memory `Map<userId, Set<EventEmitter>>` of active SSE connections. When a new notification is generated (e.g., by the grading endpoint), it is broadcast to all active connections for the affected user.

## 2.3 Software Architecture

### 2.3.1 Architectural Pattern: Modular Monolith

UniLMS implements a **modular monolith** architecture. This is a deliberate intermediate choice between a pure monolith (single undifferentiated codebase) and a microservices architecture (multiple independently deployed services). The modular-monolith pattern preserves the architectural-clarity benefits of microservices — clear module boundaries, dependency injection, independently testable units — while avoiding the operational overhead of multiple service deployments, distributed transactions, and network-failure handling.

For a project at UniLMS's current scale (one development team, single university deployment), the modular monolith is optimal: it ships faster, is operationally simpler, and can later be decomposed into microservices if scale demands it. The clean module boundaries make such future decomposition straightforward.

### 2.3.2 Three-Layer Structure

The system is organized into three primary layers:

1. **Presentation Layer** — Next.js 14 frontend running on port 3000. Responsibilities: rendering, client-side state, routing, optimistic UI, design-system implementation, i18n.
2. **Application Layer** — NestJS 10 backend running on port 4000. Responsibilities: business logic, AI integration, authentication, authorization, data validation, notification fan-out, audit logging.
3. **Data Layer** — PostgreSQL 15 (port 5432) with Prisma 5.22 ORM. Responsibilities: persistent storage, transactional integrity, full-text search, migration management.

### 2.3.3 High-Level System Diagram

```
                                    ┌──────────────────┐
                                    │   Browser (User) │
                                    └────────┬─────────┘
                                             │ HTTPS
                                             ▼
                                ┌──────────────────────────┐
                                │  Next.js Frontend (3000) │
                                │  - SSR + CSR             │
                                │  - Trilingual i18n       │
                                │  - Design System         │
                                └──────────┬───────────────┘
                                           │ REST + SSE
                                           ▼
                                ┌──────────────────────────┐
                                │  NestJS Backend (4000)   │
                                │  /api prefix             │
                                │  19 modules              │
                                │  96 endpoints            │
                                └──┬────────┬──────────┬───┘
                                   │        │          │
              ┌────────────────────┘        │          └──────────────────┐
              ▼                              ▼                             ▼
   ┌──────────────────┐         ┌────────────────────┐        ┌────────────────────┐
   │ PostgreSQL (5432) │         │ Anthropic Claude   │        │ SMTP (optional)    │
   │ Prisma ORM        │         │ API (HTTPS)        │        │ nodemailer         │
   └───────────────────┘         └────────────────────┘        └────────────────────┘
```

### 2.3.4 Docker Compose Deployment Architecture

For both development and demonstration purposes, the platform is containerized with Docker Compose:

```yaml
services:
  postgres:    # postgres:15-alpine, healthchecked
  backend:     # depends_on postgres healthy, runs migrations + seed on start
  frontend:    # depends_on backend
volumes:
  pgdata       # persistent
```

A single `docker compose up --build` command brings the full system online with database migrations applied and seed data loaded. The entrypoint script polls the database connection up to 30 times (60 seconds) before running migrations, accommodating slow Docker startup environments.

### 2.3.5 Database Schema Overview

The Prisma schema defines **14 models** and **5 enums**:

| Model              | Purpose                                            |
|--------------------|----------------------------------------------------|
| User               | All platform users; preferred_lang for localized notifications |
| Group              | Academic groups (e.g., SE-2302)                    |
| Course             | Courses                                            |
| CourseMaterial     | Course-attached materials (link/file/text)         |
| Attendance         | PRESENT/LATE/ABSENT records, unique per (course, student, date) |
| Enrollment         | User-to-course many-to-many with CourseRole        |
| Announcement       | Global (courseId=null) or per-course               |
| Assignment         | Title, due date, max score; has resources + comments |
| AssignmentResource | Teacher-uploaded files attached to an assignment   |
| AssignmentComment  | Threaded comments per assignment                   |
| Submission         | Student submissions with optional file attachments |
| SubmissionAttachment | Multi-file submissions                           |
| Grade              | 1:1 with Submission; score, feedback               |
| ScheduleItem       | Course-time events: LECTURE/PRACTICE/LAB/EXAM      |
| Notification       | Per-user; types ASSIGNMENT_DUE / ANNOUNCEMENT / GRADE_PUBLISHED / SYSTEM |
| ActivityLog        | Audit log of CREATE/SUBMIT/GRADE/UPDATE/DELETE     |
| AiRequestLog       | Audit log of all AI calls with prompt + response   |

The `AiRequestLog` table specifically supports audit and cost analysis for AI usage, valuable both for governance and for evaluating Claude API spend per institutional deployment.

### 2.3.6 Use Case Diagram

The use case structure across the three roles can be summarized as follows:

```
                  ┌────────────────────────────────────────┐
                  │                UniLMS                  │
                  └────────────────────────────────────────┘

  ┌─────────┐                                              ┌─────────┐
  │ Student │                                              │ Teacher │
  └─────────┘                                              └─────────┘
        │                                                        │
        ├── View enrolled courses                                │
        ├── Submit assignment (with files)                       │
        ├── View own grades                                      │
        ├── Receive notifications (SSE)                          │
        ├── Use AI chat                                          │
        ├── Get AI feedback on own submission                    │
        ├── Generate AI study quiz                               │
        ├── View own AI student analysis                         │
        │                                                        ├── Create/edit courses
        │                                                        ├── Create assignments
        │                                                        ├── Grade submissions
        │                                                        ├── Generate AI quiz for students
        │                                                        ├── Generate AI student analysis
        │                                                        ├── Get AI assignment feedback
        │                                                        ├── Take attendance
        │                                                        ├── Post announcements
        │                                                        ├── View gradebook
                                  ┌─────────┐
                                  │  Admin  │
                                  └─────────┘
                                       │
                                       ├── Manage users (CRUD)
                                       ├── Manage groups
                                       ├── Manage courses (admin override)
                                       ├── Manage enrollments
                                       ├── View platform analytics
                                       ├── View activity audit log
                                       ├── View AI usage logs
```

### 2.3.7 Sequence Diagram — Login

```
Browser    Frontend         Backend         PrismaService     Postgres
   │         │                │                   │              │
   │ POST    │                │                   │              │
   │ /auth/  │                │                   │              │
   │ login   │ POST /api/auth/login                              │
   ├────────►├───────────────►│                   │              │
   │         │                │ findUnique(email) │              │
   │         │                ├──────────────────►├─────────────►│
   │         │                │                   │ ◄── user ────┤
   │         │                │ bcrypt.compare    │              │
   │         │                │ jwt.sign(access)  │              │
   │         │                │ jwt.sign(refresh) │              │
   │         │ ◄── tokens ────┤                   │              │
   │ ◄── Set-Cookie ─────────┤                   │              │
```

### 2.3.8 Sequence Diagram — AI Quiz Generation

```
Teacher    Frontend           Backend             Anthropic        Postgres
   │       │                     │                   │               │
   │ Fill │                     │                   │               │
   │ topic│ POST /api/ai/      │                   │               │
   │ + click generate-quiz       │                   │               │
   ├──────►├────────────────────►│                   │               │
   │       │                     │ Role check        │               │
   │       │                     │ Build prompt      │               │
   │       │                     │ messages.create   │               │
   │       │                     ├──────────────────►│               │
   │       │ "Generating..."     │                   │               │
   │       │ shows GenerationPanel│                  │               │
   │       │                     │ ◄── completion ───┤               │
   │       │                     │ JSON parse        │               │
   │       │                     │ Zod validate      │               │
   │       │                     │ Save AiRequestLog ├──────────────►│
   │       │ ◄── { questions } ──┤                   │               │
   │ ◄ QuizQuestionPreviews ────┤                   │               │
```

## 2.4 Services Description

This section provides detailed descriptions of the core services implemented in the UniLMS platform. NestJS modules each encapsulate a coherent business domain and expose functionality through well-defined REST endpoints.

### 2.4.1 The Authentication Service

The Authentication Service manages user identity verification and session management. It implements **JWT-based authentication** with refresh-token rotation for enhanced security.

**Responsibilities:**
- User registration with bcrypt password hashing (10 rounds).
- Login with email + password; issues short-lived access token (15 minutes) and longer-lived refresh token (7 days).
- Refresh-token rotation: a new refresh token is issued each time the access token is refreshed.
- Logout: clears authentication cookies.
- `/me` endpoint: returns the currently authenticated user (used by the frontend `useMe()` hook).

**Endpoints:**

| Endpoint                  | Description                            |
|---------------------------|----------------------------------------|
| `POST /api/auth/register` | Register a new user                    |
| `POST /api/auth/login`    | Authenticate and receive tokens        |
| `POST /api/auth/logout`   | Invalidate current session             |
| `POST /api/auth/refresh`  | Refresh access token using refresh tk  |
| `GET  /api/auth/me`       | Return current authenticated user      |

**Security notes:** Cookies are httpOnly and sameSite=lax. Helmet middleware sets standard HTTP security headers. The Throttler module limits authentication endpoints to 100 requests per minute per IP.

### 2.4.2 The Course Service

The Course Service manages course creation, enrollment, and content organization.

**Responsibilities:** Course CRUD; paginated listing with role-aware filtering (admins see all, others see enrolled); participant listing with role badges; integration with the activity log.

**Endpoints:**

| Endpoint                          | Description                          |
|-----------------------------------|--------------------------------------|
| `GET  /api/courses`               | Paginated, role-filtered course list |
| `GET  /api/courses/:id`           | Course details (enrolled-or-admin)   |
| `GET  /api/courses/:id/participants` | List of users in the course       |
| `GET  /api/courses/:id/progress`  | Per-student completion percentage    |
| `POST /api/admin/courses`         | Admin: create course                 |
| `PATCH /api/admin/courses/:id`    | Admin: update                        |
| `DELETE /api/admin/courses/:id`   | Admin: delete                        |

### 2.4.3 The Assignment Service

The Assignment Service manages the full assignment lifecycle from creation through submission to grading. This is the most feature-dense service.

**Responsibilities:** Assignment CRUD; teacher-attached resources; threaded comments per assignment; single- and multi-file student submissions (up to 10 files, 17 allowed MIME types, 20 MB per file); draft saving distinct from final submission; grading with email + notification fan-out.

**Endpoints (abridged):**

| Endpoint                                 | Description                          |
|------------------------------------------|--------------------------------------|
| `GET  /api/courses/:id/assignments`      | Paginated assignment list            |
| `POST /api/courses/:id/assignments`      | Teacher: create assignment           |
| `POST /api/assignments/:id/submit`       | Student: text/URL submission         |
| `POST /api/assignments/:id/submit-files` | Student: multi-file (up to 10)       |
| `POST /api/assignments/:id/save-draft`   | Save as DRAFT (not yet submitted)    |
| `POST /api/submissions/:id/grade`        | Teacher: assign grade                |
| `POST /api/assignments/:id/resources`    | Teacher: attach resource files       |
| `GET  /api/assignments/:id/comments`     | Get threaded comments                |
| `POST /api/assignments/:id/comments`     | Add comment                          |

### 2.4.4 The Grade Service

The Grade Service computes and exposes grade visibility for students and teachers.

**Endpoints:**

| Endpoint                          | Description                          |
|-----------------------------------|--------------------------------------|
| `GET /api/me/grades`              | Student's grades across all courses  |
| `GET /api/me/grades/summary`      | Per-course grade summary             |
| `GET /api/courses/:id/grades`     | Teacher gradebook                    |
| `GET /api/courses/:id/grades/stats` | Per-assignment statistics (avg, min, max, count) |

### 2.4.5 The AI Service — Five Production Endpoints

The AI Service integrates with the Anthropic Claude API to provide five distinct AI features. Each endpoint accepts a `lang` parameter (en / ru / kz) and produces output in the requested language. All endpoints write to the `AiRequestLog` audit table.

**Endpoint 1 — Assignment Feedback (`POST /api/ai/assignment-feedback`)**

Generates structured feedback on a student submission with four fields:

- `assessment` — narrative paragraph
- `strengths` — bullet list of identified strengths
- `improvements` — bullet list of areas to improve
- `suggestions` — bullet list of actionable suggestions

Access control: students may only request feedback on their own submissions; teachers and admins may request feedback on any submission.

**Endpoint 2 — Quiz Generation (`POST /api/ai/generate-quiz`)**

Generates a quiz on an arbitrary topic with configurable parameters:

| Parameter       | Type            | Description                          |
|-----------------|-----------------|--------------------------------------|
| `courseId`      | string (req)    | Course scope                         |
| `topic`         | string (req)    | Topic to quiz on                     |
| `questionCount` | int 1–20        | Default 5                            |
| `difficulty`    | easy/medium/hard | Default medium                      |
| `lang`          | en / ru / kz    | Output language                      |

Returns: array of questions, each with `question`, `options` (exactly 4), `correctIndex` (0–3), and `explanation`. Zod schema validation ensures output well-formedness.

Access control: Students are forbidden (HTTP 403) from quiz generation, to prevent students from generating questions for their own assessments.

**Endpoint 3 — Course Summary (`POST /api/ai/course-summary`)**

Generates a synthesized course overview with `summary`, `keyTopics`, `tips`, and `workload` (light / moderate / heavy).

**Endpoint 4 — Student Analysis (`POST /api/ai/student-analysis`)**

Analyzes a student's performance and returns `analysis`, `strengths`, `areasToImprove`, `recommendations`, and `riskLevel` (low / medium / high).

Access control: students can only analyze themselves; teachers and admins can analyze any student.

**Endpoint 5 — AI Chat (`POST /api/ai/chat`)**

Streaming AI chat assistant. Returns text/event-stream. Token-by-token streaming via Claude's `content_block_delta` events. Supports `AbortController`-based cancellation.

**Demo mode fallback:** When `LLM_API_KEY` is not configured, every endpoint returns a structurally valid response with localized placeholder content in the requested language. This ensures UniLMS demonstrates and tests deterministically without requiring API credit.

### 2.4.6 The Notification Service

The Notification Service manages real-time notifications via Server-Sent Events.

**Endpoints:**

| Endpoint                                    | Description                          |
|---------------------------------------------|--------------------------------------|
| `GET  /api/me/notifications`                | Last 50 notifications                |
| `GET  /api/me/notifications/unread-count`   | Count of unread                      |
| `GET  /api/me/notifications/stream`         | **SSE long-lived stream**            |
| `POST /api/me/notifications/:id/read`       | Mark one as read                     |
| `POST /api/me/notifications/read-all`       | Mark all as read                     |

The SSE stream sends:
- Initial `ready` event with current unread count.
- `notification` events when new notifications are created.
- `ping` heartbeats every 25 seconds to prevent proxy timeouts.
- Auto-cleanup on client disconnect.

### 2.4.7 The Attendance Service

The Attendance Service tracks PRESENT / LATE / ABSENT records per (course, student, date).

| Endpoint                                  | Description                          |
|-------------------------------------------|--------------------------------------|
| `GET  /api/courses/:id/attendance`        | Attendance records (role-filtered)   |
| `GET  /api/courses/:id/attendance/stats`  | Per-student statistics               |
| `POST /api/courses/:id/attendance`        | Teacher: mark attendance             |

### 2.4.8 The Schedule Service

The Schedule Service exposes weekly schedules and monthly calendars.

| Endpoint                                | Description                          |
|-----------------------------------------|--------------------------------------|
| `GET /api/me/schedule?from=&to=`        | Weekly schedule for current user     |
| `GET /api/me/calendar?month=YYYY-MM`    | Calendar view: schedule + dueAt      |
| `GET /api/courses/:id/schedule`         | Course schedule                      |
| `POST /api/courses/:id/schedule`        | Teacher: add schedule event          |

The calendar endpoint deliberately combines **schedule items AND assignment due dates** into one response, giving students a unified month view.

### 2.4.9 The Search Service

A single `GET /api/search?q=` endpoint performs parallel insensitive search across five entity types:

1. Courses (title / code / description) — top 10
2. Materials (title / content) — top 10
3. Assignments (title / description) — top 10
4. Announcements (title / body) — top 8
5. Users (fullName / email) — admin-only, top 8

### 2.4.10 The Admin Service

Provides platform-wide analytics:

| Endpoint                       | Description                          |
|--------------------------------|--------------------------------------|
| `GET /api/admin/stats`         | Comprehensive platform statistics    |
| `GET /api/admin/activity`      | Activity log (admin view)            |
| `GET /api/admin/users`         | Paginated user management            |
| `GET /api/admin/groups`        | Group management                     |
| `GET /api/admin/enrollments`   | Enrollment management                |

The `/admin/stats` endpoint returns: total users (with per-role breakdown), courses, assignments, submissions, enrollments, grades, **avgGrade** (rounded to 1 decimal), and **attendanceRate** (percent of PRESENT records).

### 2.4.11 The Activity Log Service

Records audit events across the platform: CREATE / SUBMIT / GRADE / UPDATE / DELETE. The service is referenced by Courses, Assignments, Grades, and other modules — they call `activityLog.log(userId, action, entity, entityId)` at appropriate points.

### 2.4.12 The Mail Service

Sends optional email notifications via nodemailer + SMTP. Gracefully no-ops when `SMTP_USER` is unset, so the platform can be deployed without an SMTP infrastructure.

### 2.4.13 API Gateway

The NestJS application acts as a single API gateway with:
- **Global API prefix** `/api`.
- **Helmet** for HTTP security headers.
- **CORS** with `credentials: true` for cookie support.
- **ValidationPipe** with `whitelist`, `forbidNonWhitelisted`, `transform`.
- **LocalizedHttpExceptionFilter** for normalized error responses.
- **ThrottlerGuard** for global rate limiting (100 req/min).
- **JWT-protected static file server** for `/uploads` (custom Express middleware verifies tokens before serving files).
- **Swagger UI** at `/api/docs` documenting all 96 endpoints with request/response schemas.

## 2.5 Design System and Visual Language

UniLMS implements a comprehensive custom design system. This section documents its principal artifacts.

### 2.5.1 Design Tokens

All design decisions are codified as **CSS custom properties** (design tokens) in `globals.css`. Key token families:

**Color (OKLCH):** Accent ramp (50–900), surface colors (bg, surface, surface-2), foreground (fg, fg-muted, fg-subtle), borders, semantic (success, warning, danger, info), shadows including a `--shadow-glow` for focus rings.

**Light theme accent:** Forest green (hue 150). Dark theme accent: Violet (hue 290). The two themes are intentionally differentiated to provide distinct aesthetic registers — daytime academic (forest) and nighttime modern (violet).

**Typography:** Size scale `--text-xs` (12px) through `--text-6xl` (68px); font families `--font-sans` (Geist), `--font-mono` (Geist Mono), `--font-serif` (Instrument Serif).

**Spacing:** 4-px base, scale from `--space-1` (2px) through `--space-16` (96px).

**Density:** `--density` multiplier (compact 0.85, normal 1.0, comfortable 1.1) scaling row and control heights.

**Motion:** Three durations (`--dur-fast` 120ms, `--dur-base` 200ms, `--dur-slow` 320ms) and three easing curves (`--ease-out`, `--ease-in-out`, `--ease-spring`).

### 2.5.2 Primitive Components (8)

The eight primitive components built atop tokens:

- **Button** — 7 variants (primary / secondary / ghost / danger / **ai** with gradient / outline / link) and 4 sizes.
- **Card** — with optional `hoverable` lift, padding presets, header / content / footer subcomponents.
- **Badge** — 6 tones × 2 variants (soft, solid), legacy variant compatibility.
- **Input / Textarea / Select** — DS focus ring via `--shadow-glow`; density-aware heights.
- **Dialog** — backdrop blur, header / body / footer; focus-trap; Escape-to-close.
- **PaginationControls** — semantic page navigation.
- **Toaster** — tone-coloured left stripe, slide-up animation.

### 2.5.3 Design-System Components (12)

Higher-order DS components:

- **Eyebrow** — uppercase mono label
- **HDisplay** — Instrument Serif italic with em-accent
- **Stat** — KPI display
- **Spark** — sparkline SVG
- **Segment** — iOS-style pill toggle
- **DataTable** — uppercase mono headers, hover rows
- **DsTabs** — underline or pill style
- **Alert** — 4 tones, soft tinted
- **DsAvatar** — deterministic HSL avatar from name hash
- **Kbd** — keyboard shortcut hint
- **DsProgress** — slim progress bar
- **DensityToggle** — compact / normal / comfortable

### 2.5.4 AI Patterns (8)

Components specifically designed for AI surfaces:

- **AIBubble** — chat message with citations + action buttons
- **AIComposer** — input with cmd+enter hint and suggestion chips
- **StreamingText** — animated reveal with caret
- **LiveCaret** — blinking caret for SSE streaming
- **ThinkingDots** — pulsing-dots indicator
- **GenerationPanel** — multi-step progress (pending / active / done / error)
- **SuggestionStrip** — horizontal chip list of AI prompts
- **AIFeedbackPanel** — grading suggestion with criteria + accept/edit/dismiss
- **QuizQuestionPreview** — quiz question card with reveal-on-pick

## 2.6 Internationalization — Trilingual EN / RU / KZ

Internationalization is a first-class concern, implemented through a deliberately designed system.

### 2.6.1 i18n Architecture

All user-facing strings are externalized to `apps/frontend/src/lib/i18n.tsx`. The file exports a nested object keyed by language code (`en`, `ru`, `kz`), each containing the same key structure. The `LanguageProvider` React Context wraps the application and exposes a `useT()` hook that returns the active language's bundle.

The persistent language preference is stored in `localStorage` under the key `unilms-lang`; the language toggle in the topbar updates both the state and storage.

### 2.6.2 AI Trilingual Support

Beyond UI strings, **AI responses are also localized**. Each AI endpoint accepts a `lang` parameter, which is included in the system prompt directive to Claude:

```
Respond in {Russian | Kazakh | English} only. ...
```

For demo mode (when LLM_API_KEY is unset), structured placeholder responses are pre-translated into all three languages.

### 2.6.3 Notification and Email Localization

User-targeted notifications and emails are rendered in the recipient's `preferredLang` (stored on the User model). The helpers `getAssignmentNotificationContent()` and `getGradeNotificationContent()` produce content in the appropriate language at fan-out time, ensuring a Kazakh-speaking student receives Kazakh notifications even if the action was performed by a Russian-speaking teacher.

### 2.6.4 Locale-Aware Formatting

Dates and numbers are formatted via `Intl.DateTimeFormat(locale, ...)` and `Intl.NumberFormat(locale, ...)`, with locales `en-US`, `ru-RU`, and `kk-KZ` selected per active language.

---

# 3 Implementation

This chapter presents the realized user interface across the major application surfaces. All screenshots reflect the current production-quality state of the platform after the design-system migration and trilingual implementation. Screenshots are drawn from both light (forest green) and dark (violet) themes, and across all three locales.

## 3.1 User Interface Mockups and Screens

### 3.1.1 Login and Authentication

The login page implements an **editorial two-column hero** design with a deliberately distinctive academic identity. The left column presents the platform's identity statement — "Learning *Operating* System" in Instrument Serif italic with violet-or-forest em emphasis — together with the three core value propositions (Course Management, AI-powered, Insights). The right column houses the actual authentication form along with one-click demo credentials for Admin, Teacher, and Student roles.

![Login page — light theme, English locale](screenshots/01-login-light-en.png)
> **Figure 3.1** — Login page in light theme with forest accent. Note the Instrument Serif italic *"Operating"* in forest green and the trilingual `EN / RU / KZ` switch (top right after authentication; the login page itself respects the saved language preference).

![Login page — Russian locale](screenshots/02-login-ru.png)
> **Figure 3.2** — Login page rendered in Russian. The hero reads "Учебная *Операционная* Система" with italic violet em. Every UI string and demo-role label is translated.

### 3.1.2 Student Dashboard

The Dashboard is the primary landing page after authentication. It is **role-aware** — the same `/dashboard` route renders meaningfully different content for Student, Teacher, and Admin roles, drawing from a shared set of dashboard components (`DashboardHero`, `StatTile`, `SectionCard`, `ScheduleRow`, `DeadlineTimeline`, `GradeRow`, `NotificationItem`, `QuickActionCard`).

![Admin Dashboard — light theme](screenshots/03-dashboard-admin-light.png)
> **Figure 3.3** — Admin Dashboard in light forest theme. Hero reads "Welcome back, *Admin*" with serif italic em. Statistics row shows total users, courses, assignments, enrollments. Quick action cards link to Administration, Courses, Activity, Notifications. The right column contains today's classes and notifications.

![Admin Dashboard — dark theme (violet)](screenshots/04-dashboard-admin-dark.png)
> **Figure 3.4** — Same dashboard, dark theme. Violet accent preserved; layout identical.

### 3.1.3 Course Workspace

The course workspace at `/courses/[id]/...` is the most feature-dense area of the platform. The shared layout presents a hero with the course title, instructor, description, metadata badges, and a sticky sub-navigation across seven tabs: Overview, Assignments, Materials, Grades, Attendance, Participants, AI Quiz.

![Course Overview — Software Architecture (light theme)](screenshots/05-course-overview-light.png)
> **Figure 3.5** — Course Overview page for SE-ARCH-301. Note the prominent green **AI Course Summary** button beneath the description, the tab navigation across the seven course sub-pages, and the sticky "Next Deadline" card on the right showing the Microservices Diagram assignment due May 22.

![Course Overview with AI Summary expanded (RU)](screenshots/06-course-summary-ru.png)
> **Figure 3.6** — AI Course Summary expanded inline. The structured response presents `summary` paragraph, `keyTopics` badges, `tips` bullet list, and `workload` indicator ("Low workload" / "Низкая нагрузка"). Generated in Russian on a click.

### 3.1.4 Courses List

The `/courses` page presents enrolled (or all, for admin) courses as a grid of cards with a **violet color cycle** assigning a distinctive accent stripe to each course. Cards include course code, title, instructor, enrolled count, and a per-course progress bar for students.

![Courses list — light theme](screenshots/07-courses-light.png)
> **Figure 3.7** — Courses list page. The page header uses HDisplay italic ("My Courses" / "Менің курстарым" / "Курсы"). Cards show CS-ALG-301 (violet stripe), CS-DB-201 (blue), CS-OS-302 (green) — each course uses a deterministic accent for visual distinction.

### 3.1.5 Schedule and Calendar

![Weekly Schedule (light theme)](screenshots/08-schedule-light.png)
> **Figure 3.8** — Weekly schedule view at `/schedule`. Each day is a column; classes appear as tinted cards with type-coded color stripes (Lecture / Practice / Lab / Exam). Filters for day and course are available top right.

The Calendar page (`/calendar`) presents a monthly grid combining schedule items and assignment due dates in a single view.

### 3.1.6 Notifications

![Notifications (light theme)](screenshots/09-notifications-light.png)
> **Figure 3.9** — Notifications page. Unread notifications carry an accent-tinted background (forest green left dot and shaded card); read notifications fade. The "Mark all read" button is in the upper right. A bell badge in the top navigation aggregates unread count.

### 3.1.7 Admin Panel

The administration panel groups KPI tiles and management cards.

![Administration — Overview (light theme)](screenshots/10-admin-light.png)
> **Figure 3.10** — Admin overview page. Stat tiles for Total Users, Students, Teachers, Courses; Enrollments / Assignments / Submissions / Grades; Platform average grade and attendance rate. Below, four navigation cards lead to Users / Courses / Groups / Enrollments management. The left sidebar shows the expanded Administration section.

## 3.2 AI-Powered Features in Action

This section presents the AI features in operational state — both the configuration UI before generation and the rendered AI output after generation.

### 3.2.1 AI Quiz Studio

The AI Quiz Studio occupies the seventh tab of the course workspace at `/courses/[id]/quiz`. The interface is a three-mode state machine: **config → generating → quiz → results**.

![AI Quiz Studio — Config (dark, violet)](screenshots/11-quiz-config-dark.png)
> **Figure 3.11** — AI Quiz Studio configuration. The eyebrow reads "AI QUIZ STUDIO"; the HDisplay heading reads "Generate a quiz on *any* topic" with italic violet em. Configuration accepts a topic, number of questions (3 / 5 / 8 / 10 / 15), and difficulty level (easy / medium / hard). Below, a row of preset suggested topics (SQL Joins, ER Diagrams, Normalization, Indexing, Transactions & ACID, NoSQL vs Relational) appears as one-click chips.

![AI Quiz — Question in Russian](screenshots/12-quiz-question-ru.png)
> **Figure 3.12** — A generated quiz question rendered in Russian. The user has selected option B ("LEFT OUTER JOIN") which is highlighted as correct (verde). The AI-generated explanation appears immediately below: "A LEFT OUTER JOIN returns all rows from the left table and matching rows from the right table. When there is no match in the right table, NULL values are returned for right table columns." Note the metadata: question number `Q1`, type chip `multiple-choice`, "Created by AI" / "Создано ИИ" badge, and difficulty rating "Medium" / "Средне" badge.

### 3.2.2 AI Course Summary (Generated)

![AI Course Summary — Generated in Russian](screenshots/13-course-summary-ru-result.png)
> **Figure 3.13** — Generated AI course summary for SE-ARCH-301 displayed in Russian. The structured response renders: the **AI overview** paragraph in Russian; **Key Topics** as badges (Design patterns, Architectural styles, System design); **Study Tips** as a bulleted list; and a **"Low workload"** indicator. A "Generate again" button at the bottom allows regeneration.

### 3.2.3 AI Student Analysis

The AI Student Analysis feature provides an instructor-facing structured analysis of a selected student's performance.

![AI Student Analysis — Config (light)](screenshots/14-ai-analysis-config-light.png)
> **Figure 3.14** — AI Student Analysis configuration. HDisplay: "Understand *where each student stands*" with italic forest em. Two dropdowns: optional course scope (defaults to "All courses") and required student selection. The Generate analysis button uses the AI gradient variant.

![AI Student Analysis — Result (Russian)](screenshots/15-ai-analysis-result-ru.png)
> **Figure 3.15** — Generated AI analysis for student Aliya Kanatova in Russian. The result page presents (in order): a subject card with name + email + a **Medium risk level** badge; the **General overview / Общий обзор ИИ** narrative; **Strengths** with green checkmark dots; **Areas to improve** with amber warning dots; and **Recommendations** in info-blue tinted cards. Each section uses tone-appropriate icons.

### 3.2.4 AI Chat Assistant — Trilingual Showcase

The floating AI Chat is available on every authenticated page via a violet-or-forest gradient button in the bottom-right corner. Clicking opens a 400-wide × 540-tall panel docked to the bottom-right.

![AI Chat in Kazakh language](screenshots/16-ai-chat-kazakh.png)
> **Figure 3.16** — **The single most distinctive proof of UniLMS's trilingual capability.** Student dashboard in Kazakh ("Қайта оралдыңыз" — "Welcome back"), with the AI chat assistant open in the bottom-right corner. The student has greeted the AI in Kazakh ("Сәлем"), and the AI has responded in Kazakh: "Сәлем! 👋 Қош келдіңіз! Мен UniLMS жүйесінің академиялық көмекшісімін..." The chat composer at the bottom uses the Kazakh placeholder "Сұрақ қойыңыз...". No other LMS or AI tutor currently delivers this combined Kazakh-language LMS + Kazakh-language AI experience.

## 3.3 AI Module — Deep Technical Walkthrough

The AI module is the most substantial intellectual contribution of UniLMS. This section provides a detailed technical walkthrough of how the five AI endpoints are implemented end-to-end.

### 3.3.1 Service Initialization

The `AiService` constructor instantiates an Anthropic SDK client conditionally — only when `LLM_API_KEY` is set in the environment. When unset, the service operates in deterministic demo mode:

```typescript
constructor(
  private readonly db: PrismaService,
  private readonly notificationsService: NotificationsService,
) {
  const apiKey = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    this.anthropic = new Anthropic({ apiKey });
    this.demoMode = false;
  } else {
    this.anthropic = null;
    this.demoMode = true;
  }
}
```

This design choice — graceful demo-mode fallback — was deliberate: it allows demonstration of the platform without exposing or consuming API credits, enables fully reproducible E2E tests, and ensures the platform remains functional in development environments where developers may lack API access.

### 3.3.2 Prompt Engineering for Quiz Generation

The quiz generation endpoint constructs a structured prompt that:
1. Establishes Claude's role and constraint context.
2. Specifies the desired output shape with example structure.
3. Includes the user-specified topic, question count, difficulty, and language directive.
4. Closes with explicit JSON-format instruction.

A representative prompt fragment (Russian-language path):

```
You are an expert pedagogical assistant generating an academic quiz.
Respond in Russian only. Return ONLY a valid JSON object — no
preamble, no markdown code fences, no commentary.

Topic: "SQL Joins & Aggregation"
Number of questions: 5
Difficulty: medium
Course context: CS-DB-201 — Database Systems

Schema:
{
  "questions": [
    {
      "question": "string (the question prompt)",
      "options": ["string", "string", "string", "string"],  // exactly 4
      "correctIndex": 0|1|2|3,
      "explanation": "string (why the correct answer is correct)"
    }
  ]
}

Generate exactly 5 questions. Each question must have exactly 4 options
and exactly one correctIndex. Provide a clear explanation for the
correct answer in Russian.
```

### 3.3.3 Output Validation with Zod

Claude's response is parsed and validated against a strict Zod schema before being persisted or returned to the client:

```typescript
const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(5),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(5),
  })).min(1).max(20),
});

const parsed = QuizSchema.safeParse(rawJson);
if (!parsed.success) {
  this.logger.warn('Quiz output failed validation', parsed.error);
  return this.demoQuiz(dto);
}
```

This validation strategy serves multiple purposes:
- **Safety against malformed AI output** — if Claude occasionally produces invalid JSON or skips fields, the platform falls back to a deterministic demo response rather than crashing.
- **Type safety in TypeScript** — Zod infers types from the schema, so downstream code works against a validated shape.
- **Audit clarity** — when validation fails, the raw response and validation error are logged for offline analysis.

### 3.3.4 Streaming SSE Implementation for Chat

The AI chat endpoint streams Claude's tokens over Server-Sent Events using the SDK's stream interface:

```typescript
@Post('chat')
async chat(@Body() dto: ChatMessageDto, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await this.anthropic.messages.stream({
    model: 'claude-opus-4-x',
    max_tokens: 2048,
    system: this.buildSystemPrompt(dto.lang),
    messages: [{ role: 'user', content: dto.message }],
  });

  stream.on('text', (text) => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  });
  stream.on('end', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });
}
```

On the frontend, `AiChat` component consumes this stream:

```typescript
const res = await fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ message, lang }),
  credentials: 'include',
  signal: abortController.signal,
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;
    const parsed = JSON.parse(data);
    if (parsed.text) appendToMessage(parsed.text);
  }
}
```

The `AbortController` is wired to the panel-close button, ensuring that if the user closes the chat mid-stream, the request is cancelled (preventing both wasted tokens and orphan network requests).

## 3.4 Cross-Cutting Implementation Topics

### 3.3.1 Dark / Light Theme Toggle

The theme toggle in the topbar switches between light (forest accent) and dark (violet accent) themes. The transition is instant via CSS-custom-property updates; no page reload is required. The chosen theme persists via `localStorage` under the key `theme`. An inline `<script>` in the HTML head reads the persisted value before first paint to prevent a flash of incorrect theme on initial load.

### 3.3.2 Density Toggle

The density toggle in the profile page allows users to scale interface row and control heights:

- **Compact** — `--density: 0.85`, denser tables, smaller controls.
- **Normal** — `--density: 1.0`.
- **Comfortable** — `--density: 1.1` (default), more spacious.

The setting persists via `localStorage` under the key `density` and applies via `data-density` attribute on the `<html>` element.

### 3.3.3 Real-Time Notification Delivery

When a notification-triggering event occurs (e.g., a teacher publishes a grade), the backend `NotificationsService.create()` method:
1. Persists the notification to PostgreSQL.
2. Locates all active SSE connections for the recipient user.
3. Pushes a `notification` event over each active stream.

The frontend `useNotificationsStream()` hook subscribes to the stream and:
1. On `notification` events, invalidates the relevant TanStack Query cache keys (notifications list and unread count).
2. Optionally renders a toast.
3. On EventSource error, reconnects after a 3-second delay.

This produces sub-second end-to-end notification latency in normal network conditions.

### 3.3.4 Activity and AI Audit Logs

Every privileged action writes to the `ActivityLog` table. Every AI call writes to the `AiRequestLog` table with full prompt + response captured. These logs power:

- The Activity page (`/activity`) showing recent platform-wide events.
- Compliance and audit needs.
- AI usage analysis and cost projection.

### 3.3.5 Pagination

All listing endpoints support standardized pagination. The pagination helper in `apps/backend/src/common/pagination.ts` exports `getPagination(page, limit)` and `toPaginatedResult(items, page, limit, total)`, producing a uniform response shape `{ items, total, page, limit, hasNext, totalPages }` consumed by `PaginationControls` on the frontend.

## 3.5 Security Considerations

Security is a first-class concern in UniLMS, with defenses applied across multiple layers of the stack.

### 3.5.1 Authentication Security

- **bcrypt password hashing** with 10 rounds (recommended minimum per OWASP guidance).
- **JWT secrets** stored in environment variables, never committed to source control.
- **Separate access and refresh secrets** (`JWT_SECRET` vs `JWT_REFRESH_SECRET`) — compromising one does not compromise the other.
- **httpOnly cookies** prevent JavaScript access to tokens, mitigating XSS-token-theft.
- **sameSite=lax cookies** mitigate cross-site request forgery (CSRF) on state-changing requests.
- **Short-lived access tokens** (15 min) limit the window of exposure on token compromise.
- **Refresh-token rotation** issues a fresh refresh token on each successful refresh.

### 3.5.2 Authorization (RBAC)

Role-based access control is enforced at three levels:
1. **Route guards** — `@Roles(Role.ADMIN)` decorators on controllers.
2. **Service-level checks** — for example, the AI student-analysis service explicitly forbids students from analyzing other students.
3. **Database query scoping** — list queries filter by user and enrollment, so a student cannot retrieve another student's data even via direct API calls.

### 3.5.3 Input Validation

- **Global ValidationPipe** with `whitelist: true` (strips unknown properties from request bodies), `forbidNonWhitelisted: true` (rejects requests with unknown properties), and `transform: true` (coerces strings to declared types).
- **class-validator decorators** on every DTO enforce type and format constraints.
- **Zod schemas** validate AI-generated structured outputs before persistence or rendering.

### 3.5.4 File Upload Safety

The assignment submission endpoints accept file uploads with the following defenses:
- **MIME type whitelist** of 17 allowed types covers PDF, Word, Excel, PowerPoint, ZIP, plain/CSV/Markdown text, images, MP4 video, MP3/MP4 audio.
- **Size limit** of 20 MB per file.
- **File count limit** of 10 files per submission.
- **Randomized server-side filenames** prevent path traversal attacks and avoid filename collisions.
- **JWT-protected static file server** for `/uploads` — files cannot be retrieved without a valid authentication token, preventing direct enumeration.

### 3.5.5 Network-Level Defenses

- **Helmet** middleware sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Content-Security-Policy`, and related security headers.
- **CORS** is configured with `credentials: true` and explicit origin allow-listing in production.
- **@nestjs/throttler** enforces a global rate limit of 100 requests per minute per IP, preventing brute-force attacks and basic denial of service.

### 3.5.6 Database Security

- **Prisma parameterized queries** completely eliminate SQL injection vectors.
- **Connection strings** are environment-variable-only, never logged or exposed in error responses.
- **`LocalizedHttpExceptionFilter`** normalizes error responses to prevent leakage of internal stack traces in production.

### 3.5.7 AI Safety

- **Anthropic Claude's Constitutional AI training** provides baseline content moderation.
- **System prompts** explicitly constrain AI to academic tone and topic.
- **No PII passed to the AI provider** beyond what is structurally necessary for the task (e.g., assignment text, course title) — student names are passed only when explicitly required for personalized analysis.
- **AI audit log** (`AiRequestLog`) records every prompt and response for post-hoc review.

## 3.6 Project Evolution Through Three Pre-Defenses

This subsection reflects on the iterative development of UniLMS over the course of three pre-defense milestones — a narrative that may aid the evaluation committee in understanding the maturity progression of the project.

### 3.6.1 First Pre-Defense

The first pre-defense established the **basic scaffolding**: project topic, team composition, aim and goals, relevance, work plan, and methodology. Key decisions taken at this stage were:
- **Domain**: academic management platform (vs more generic LMS).
- **Differentiator**: AI integration as native feature, not plug-in.
- **Tech stack**: TypeScript-first Next.js + NestJS + PostgreSQL.
- **Team**: three-person team with defined responsibilities.

### 3.6.2 Second Pre-Defense

The second pre-defense delivered substantial content (~30 pages):
- **Comprehensive literature review** with 17 academic citations.
- **Survey results** from 326 respondents.
- **Comparative analysis** of three traditional LMS platforms (Moodle, Canvas, Blackboard).
- **Detailed technology stack** justification.
- **Software architecture** at the level of services and entity relationships.
- **API endpoint catalog** across 9 services.
- **Interface mockups** described at high level.

Feedback from the second pre-defense panel directly informed the work delivered for the third pre-defense:
- *"Comparison should also include AI-native education tools, not only traditional LMS."* → Added comparison against Khanmigo, Synthesis, Gradescope, Century Tech (§1.3).
- *"What makes this platform actually different?"* → Strengthened differentiation story (§1.3.8); the Kazakh-AI capability is now the headline.
- *"Report needs more pages and more depth."* → This pre-defense delivers 50+ pages with substantially deeper technical content.
- *"Visual identity needs work."* → Complete design system migration (OKLCH, Geist, Instrument Serif, dual theme, density toggle).

### 3.6.3 Third Pre-Defense — What's New

Substantial improvements delivered between the second and third pre-defense:

| Area | Second Pre-Defense | Third Pre-Defense |
|------|--------------------|--------------------|
| Visual design | shadcn defaults, generic | Custom OKLCH design system, Geist + Instrument Serif |
| Theme | Single dark theme | Dual theme: forest green (light) + violet (dark) |
| Density | Fixed | Compact / Normal / Comfortable toggle |
| i18n | English only | EN / RU / KZ across UI, AI prompts, AI output, notifications |
| AI features | 4 endpoints described | 5 endpoints implemented + demo mode |
| AI UI | Basic chat | Full Quiz Studio, Course Summary, Student Analysis, Feedback Panel, Streaming Chat |
| Testing | Not measured | 11 automated E2E tests passing |
| Deployment | Docker-compose described | Docker-compose tested end-to-end with migrations |
| Notification delivery | Polling-based plan | Real-time SSE implementation |
| Pages | ~30 pages | 50+ pages |
| Citations | 17 | 27 |
| Screenshots | Mockups (figures) | Real production screenshots from live system |

This evolution is summarized in 19 git commits on the development branch, each representing a coherent step in the platform's maturation.

---

# 4 Testing

## 4.1 Testing Strategy

UniLMS implements a **pragmatic multi-layer testing strategy** balancing development velocity with confidence in correctness:

1. **Type-level testing** (continuous) — TypeScript strict-mode acts as an always-on first defense. `npx tsc --noEmit` returns zero errors on both backend (`apps/backend`) and frontend (`apps/frontend`). Both `pnpm build` invocations succeed cleanly.
2. **End-to-end automated tests** (Jest + Supertest) — 11 tests across 3 specifications.
3. **Manual exploratory testing** — every route in all themes and locales.
4. **Build verification** — production builds succeed for both apps.

## 4.2 End-to-End Automated Tests

The Jest test suite resides at `apps/backend/src/{auth,courses,assignments}/*.spec.ts`. Tests use **Supertest** to exercise the live NestJS application against a dedicated `unilms_test` PostgreSQL database.

### 4.2.1 Test Execution Configuration

```json
"test": "DATABASE_URL='postgresql://postgres:postgres@localhost:5432/unilms_test?schema=public' jest --runInBand",
"test:setup": "DATABASE_URL='...' npx prisma migrate deploy"
```

The `test:setup` command creates and migrates the test database; `test` runs the suite. The `--runInBand` flag ensures tests run serially against the shared test database, eliminating concurrency-related test interference.

### 4.2.2 Test Inventory

| Suite | Test | Verifies |
|-------|------|----------|
| auth.spec | POST /api/auth/register | New user creation, returns user object |
| auth.spec | POST /api/auth/login | Authentication returns accessToken |
| auth.spec | POST /api/auth/login (bad creds) | Returns 401 on wrong password |
| auth.spec | GET /api/auth/me (no token) | Returns 401 without authentication |
| courses.spec | GET /api/courses | Returns paginated courses (admin) |
| courses.spec | GET /api/courses (no token) | Returns 401 |
| courses.spec | POST /api/admin/courses | Admin can create course |
| assignments.spec | GET /api/courses/:id/assignments | Returns assignment list |
| assignments.spec | POST /api/assignments | Teacher can create assignment |
| assignments.spec | POST /api/assignments (student) | Returns 403 (RBAC) |
| assignments.spec | GET /api/admin/stats | Returns aggregated platform statistics |

### 4.2.3 Test Results

```
PASS  src/courses/courses.spec.ts
PASS  src/auth/auth.spec.ts
PASS  src/assignments/assignments.spec.ts

Test Suites: 3 passed, 3 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        3.105 s
```

All 11 tests pass in ~3 seconds.

## 4.3 Manual Testing

In addition to the automated suite, the following manual testing protocol was executed:

- **Route coverage:** All 27 frontend routes loaded successfully.
- **Theme switching:** Each route rendered correctly in both light (forest) and dark (violet) themes.
- **Locale switching:** Each route rendered correctly in en, ru, kz with no visible text overflow or layout breakage.
- **Role-based access:** Admin, Teacher, and Student sessions confirmed for visible/hidden navigation and protected endpoints (401/403 responses as appropriate).
- **AI endpoint smoke tests:** All five AI endpoints exercised end-to-end via demo mode; structured responses validated against UI rendering.
- **Form submission flows:** Login, registration, course creation, assignment creation, file upload, grading, attendance marking.
- **SSE delivery:** Notification arrival within 1 second of triggering event.
- **Browser console:** No errors observed under normal navigation.

## 4.4 Build Verification

```
Frontend build (pnpm build in apps/frontend):
  Route (app)                                Size      First Load JS
  /dashboard                                 11.3 kB   182 kB
  /courses/[id]/assignments                  18.8 kB   190 kB
  /courses                                   6.42 kB   177 kB
  /ai-analysis                               4.83 kB   131 kB
  /courses/[id]/quiz                         5.91 kB   132 kB
  /login                                     5.43 kB   135 kB
  ... 21 more routes ...
  Shared baseline                                      84.3 kB

Backend build (nest build):
  Output: dist/main.js + supporting modules — succeeds.
```

---

# 5 Deployment

## 5.1 Docker Compose Orchestration

UniLMS ships with a Docker Compose configuration that brings the full system online with a single command:

```bash
docker compose up --build
```

The configuration defines three services:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: unilms
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d unilms"]
      interval: 3s

  backend:
    build: ./apps/backend
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/unilms?schema=public
      JWT_SECRET: change-me-...
      LLM_API_KEY: ${LLM_API_KEY:-}
    depends_on:
      postgres: { condition: service_healthy }

  frontend:
    build: ./apps/frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

## 5.2 Database Migration Strategy

The backend Docker entrypoint script (`docker-entrypoint.sh`) executes the following sequence:

1. **Wait for PostgreSQL availability** — polls a `SELECT 1` query up to 30 times (60 seconds) before proceeding. This accommodates the gap between Docker's healthcheck reporting "healthy" and PostgreSQL actually accepting client connections.
2. **Apply migrations** — `npx prisma migrate deploy` runs all four migrations:
   - `20250101000000_init` — initial schema
   - `20250313000000_add_features_1_to_15` — assignment features
   - `20250314000000_add_ai_request_logs` — AI audit log table
   - `20250510120000_design_system_drift` — assignment resources, comments, submission attachments, preferred_lang
3. **Generate Prisma Client** — for runtime type-safe queries.
4. **Run idempotent seed** — populates demo data (1 group, 1 admin, 2 teachers, 5 students, 3 courses, schedule items, sample assignments).
5. **Start the API** — either `node dist/main.js` or `node dist/src/main.js` depending on NestJS output layout.

## 5.3 Environment Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| DATABASE_URL | postgresql://postgres:postgres@postgres:5432/unilms | Prisma connection string |
| JWT_SECRET | (provided) | Access-token signing key |
| JWT_REFRESH_SECRET | (provided) | Refresh-token signing key |
| JWT_EXPIRATION | 15m | Access-token TTL |
| JWT_REFRESH_EXPIRATION | 7d | Refresh-token TTL |
| LLM_API_KEY | (empty) | Anthropic API key; if empty, AI demo mode |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | (empty) | Optional email notification config |

## 5.4 Operational Considerations

- **Stateful files**: User-uploaded files persist in `/uploads`. In Docker, this should be mounted to a named volume for persistence across restarts.
- **Database backups**: PostgreSQL volume should be backed up via standard `pg_dump` workflows.
- **SSL/TLS**: Production deployments should add a reverse proxy (nginx / Caddy / Traefik) for TLS termination.
- **Scaling**: The modular monolith deployment scales vertically by allocating more CPU/RAM. Horizontal scaling would require externalizing the SSE notification pub/sub (currently in-memory) and session state.

## 5.5 Local Development Workflow

Beyond Docker, the platform supports a native development workflow:

```bash
# Initial setup
pnpm install
cd apps/backend && npx prisma migrate deploy && npx prisma db seed

# Daily development
pnpm dev   # Concurrent: backend on 4000, frontend on 3000

# Tests
cd apps/backend
pnpm test:setup  # Create test DB (once)
pnpm test        # Run 11 tests
```

The `pnpm dev` script uses `pnpm --parallel -r dev` to start both services concurrently with full hot module replacement.

---

# Conclusion

This diploma thesis has presented the design, development, and deployment of **UniLMS** — an AI-native, trilingual, design-system-driven academic management platform engineered as a contemporary replacement for traditional Learning Management Systems. The project addresses long-standing limitations of existing LMS solutions while opening genuinely new capabilities — particularly Kazakh-language AI tutoring — that have no equivalent in the current global educational-technology market.

The research conducted throughout this project has yielded several significant findings:

**Empirical findings.** The survey of 326 Kazakhstani educational stakeholders provided strong empirical evidence supporting the project's principal design hypotheses:
- **72.7%** of respondents currently miss deadlines or updates under existing systems.
- **28.3%** identify lack of functionality, **26.1%** complex interfaces, **23.4%** weak notifications, **22.3%** poor integration as the dominant pain points — collectively reinforcing the unified-platform argument.
- **59.2%** explicitly prefer a unified system; **85.6%** are not opposed to consolidation.
- **69.9%** indicate willingness to adopt a new university-specific LMS.
- All five surveyed AI features polled 18–24%, indicating respondents want an AI portfolio, not a single AI feature.

**Comparative findings.** Structured analysis of eight competing platforms — Moodle, Canvas, Blackboard Learn, Khanmigo, Synthesis, Gradescope, Century Tech — established that no jointly-competitive alternative exists on the dimensions UniLMS prioritizes. Khanmigo competes on AI tutoring quality but lacks LMS surface; Canvas competes on UX breadth but lacks native trilingual AI; Moodle is free but is dated and AI-poor.

**Technical findings.** The technology stack (Next.js 14 + NestJS 10 + PostgreSQL 15 + Prisma 5.22 + Anthropic Claude) proved adequate to deliver every planned feature with strong type safety, predictable performance, and operational simplicity. The modular-monolith architectural pattern delivered the organizational benefits of microservices (clean module boundaries, independent testability) without the operational overhead, and remains evolvable toward microservices should institutional scale demand it.

**Design-system findings.** The custom OKLCH-based design system with Geist Sans / Geist Mono / Instrument Serif typography produced a distinctive academic visual identity that contrasts favorably with the dated interfaces of incumbent LMS platforms. The dual-theme decision — forest-green light theme for daytime academic use, violet dark theme for nighttime use — creates two coherent aesthetic registers within a single product.

**Trilingual findings.** Full EN / RU / KZ coverage — across UI, AI prompts, AI responses, notifications, and emails — is implemented and validated. Figure 3.16 (Kazakh AI chat) demonstrates a capability that, to the authors' knowledge, has no commercial precedent: a fully functional Kazakh-language LMS combined with a fully functional Kazakh-speaking AI tutor.

**Integration findings.** The five AI endpoints — assignment feedback, quiz generation, course summary, student analysis, streaming chat — were integrated cleanly into the existing service architecture. Demo mode (graceful fallback when no LLM key is configured) means the platform reliably demonstrates without external API dependencies, which proved valuable for evaluation and development.

**Validation findings.** Eleven automated end-to-end tests passing in 3 seconds, full production builds for both frontend and backend, strict TypeScript compilation across the codebase, and successful Docker Compose deployment together establish that the platform is delivered in a usable state.

The UniLMS implementation demonstrates that modern web development technologies, when applied with disciplined architectural choices and deliberate attention to user experience, enable construction of educational platforms that materially exceed commercial alternatives in functionality, user experience, and linguistic accessibility — while preserving the flexibility and cost advantages of open self-hosted solutions. The native integration of AI is shown not to be exotic or fragile, but a practical productivity multiplier for instructors and students that is straightforward to integrate using contemporary tooling.

## Further Research

Several directions for future work emerge from this thesis:

**Enhanced AI capabilities.** Expansion could include predictive analytics for early at-risk-student identification, adaptive content sequencing based on individual performance, more sophisticated personalization, voice-input AI tutoring (Whisper integration), and AI-powered plagiarism detection complementing or replacing Turnitin-style services.

**Adaptive learning paths.** The AI Student Analysis endpoint currently produces a structured snapshot; an adaptive-learning extension could generate sequenced personalized study plans, surface targeted exercises, and recursively re-analyze as the student progresses.

**External integrations.** Integration with Learning Tools Interoperability (LTI) and the SCORM/xAPI content standards would broaden platform utility and reduce institutional switching costs.

**Mobile native applications.** While the responsive web interface is functional on mobile, dedicated React Native or native Swift/Kotlin applications would provide improved offline-capable experience and push notifications outside the browser.

**Scale and performance testing.** Performance optimization and load testing would validate platform readiness for multi-thousand-user deployments. The in-memory SSE pub/sub would need to be replaced with Redis Pub/Sub or NATS for multi-instance scale-out.

**Accessibility enhancements.** Further improvements to WCAG 2.2 AAA compliance, full ARIA labeling, screen-reader testing, and support for assistive technologies would ensure broader accessibility.

**Pedagogical research.** A longitudinal pilot deployment at a participating university could quantify the impact of UniLMS — particularly AI-feature usage — on student outcomes, instructor workload, and time-to-feedback metrics relative to incumbent systems.

**AI evaluation rigor.** The current AI integration uses Anthropic Claude with structured-output validation. Comparative AI evaluation (Claude vs GPT-4 vs Gemini vs locally hosted Llama variants) on UniLMS-specific tasks would inform future model selection and cost optimization.

**Real-time collaboration.** A future direction could add real-time collaborative editing on assignments, group submission workflows, peer-review features, and live discussion threads — drawing on technologies such as Liveblocks, Yjs, or custom CRDT implementations.

In conclusion, the UniLMS project successfully demonstrates that thoughtful application of modern web technologies, contemporary AI services, and deliberate visual design can substantially improve the educational-technology landscape — particularly for Kazakhstani higher education, which has been underserved by global incumbents in trilingual support. The platform addresses genuine, empirically-validated needs while providing a robust foundation for continued innovation in academic management systems.

---

# Bibliography

1. Abramov, D. (2018). *React: Rethinking Best Practices*. JSConf EU. Retrieved from https://jsconf.eu

2. Attali, Y., & Burstein, J. (2006). Automated Essay Scoring With e-rater V.2. *Journal of Technology, Learning, and Assessment*, 4(3), 1–30.

3. Bond, M., Marín, V. I., Dolch, C., Bedenlier, S., & Zawacki-Richter, O. (2020). Mapping research in student engagement and educational technology in higher education: A systematic evidence map. *International Journal of Educational Technology in Higher Education*, 17(2), 1–30.

4. Brieuc, D. (2021). *Prisma: Next-generation Node.js and TypeScript ORM*. Prisma Data, Inc.

5. Brown, M. (2019). The LMS as a Walled Garden: Rethinking Educational Technology Architecture. *EDUCAUSE Review*, 54(2), 24–33.

6. Coates, H., James, R., & Baldwin, G. (2005). A Critical Examination of the Effects of Learning Management Systems on University Teaching and Learning. *Tertiary Education and Management*, 11(1), 19–36.

7. Dabit, N. (2020). *Full Stack Serverless: Modern Application Development with React, AWS, and GraphQL*. O'Reilly Media.

8. Dahl, R., Belder, B., & Iwańczuk, B. (2020). *Deno: A Modern Runtime for JavaScript and TypeScript*. Deno Land Inc.

9. Frost, B. (2013). *Atomic Design*. Brad Frost Web. Retrieved from https://atomicdesign.bradfrost.com

10. Holmes, W., Bialik, M., & Fadel, C. (2019). *Artificial Intelligence in Education: Promises and Implications for Teaching and Learning*. Boston, MA: Center for Curriculum Redesign.

11. Holmes, W., & Tuomi, I. (2022). State of the art and practice in AI in education. *European Journal of Education*, 57(4), 542–570.

12. Kamil, M. (2019). *NestJS: A Progressive Node.js Framework*. NestJS Documentation. Retrieved from https://docs.nestjs.com

13. Kasneci, E., Sessler, K., Küchemann, S., Bannert, M., Dementieva, D., Fischer, F., ... & Kasneci, G. (2023). ChatGPT for Good? On Opportunities and Challenges of Large Language Models for Education. *Learning and Individual Differences*, 103, 102274.

14. Kerres, M., & Bedenlier, S. (2020). Systematic reviews in educational research: Methodology, perspectives and application. *Springer Nature*.

15. Luckin, R. (2017). Towards artificial intelligence-based assessment systems. *Nature Human Behaviour*, 1, 0028.

16. Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems* (2nd ed.). O'Reilly Media.

17. Picciano, A. G. (2017). Theories and Frameworks for Online Education: Seeking an Integrated Model. *Online Learning*, 21(3), 166–190.

18. Ramesh, D., & Sanampudi, S. K. (2022). An Automated Essay Scoring Systems: A Systematic Literature Review. *Artificial Intelligence Review*, 55(3), 2495–2525.

19. Selwyn, N. (2019). *Should Robots Replace Teachers? AI and the Future of Education*. Polity Press.

20. Siemens, G., & Long, P. (2011). Penetrating the Fog: Analytics in Learning and Education. *EDUCAUSE Review*, 46(5), 30–32.

21. Statista. (2023). *E-learning Market Size Worldwide from 2021 to 2026*. Retrieved from https://www.statista.com/statistics/

22. UNESCO. (2021). *Reimagining our futures together: A new social contract for education*. UNESCO Publishing.

23. VanLehn, K. (2011). The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems. *Educational Psychologist*, 46(4), 197–221.

24. Vincent-Lancrin, S., & van der Vlies, R. (2020). Trustworthy artificial intelligence (AI) in education: Promises and challenges. *OECD Education Working Papers*, No. 218.

25. Watson, W. R., & Watson, S. L. (2007). An Argument for Clarity: What are Learning Management Systems, What are They Not, and What Should They Become? *TechTrends*, 51(2), 28–34.

26. WCAG 2.1. (2018). *Web Content Accessibility Guidelines 2.1*. W3C Recommendation.

27. Zawacki-Richter, O., Marín, V. I., Bond, M., & Gouverneur, F. (2019). Systematic review of research on artificial intelligence applications in higher education — where are the educators? *International Journal of Educational Technology in Higher Education*, 16(1), 1–27.

---

# Appendices

## Appendix A — Survey Instrument (abridged)

The user-research survey distributed to Kazakhstani educational stakeholders comprised the following sections:

**Section A — Role and Context**
A1. What is your primary role? [Student / Teacher / Administrator / Other]
A2. Which LMS platforms have you used in the past two years? [Multiple choice: Moodle, Canvas, Blackboard, Platonus, custom, other, none]

**Section B — Current Pain Points**
B1. What are the main problems you experience with current LMS platforms? [Multiple choice]
B2. How frequently do you miss deadlines or updates? [Often / Sometimes / Rarely / Never]
B3. Rate satisfaction with notification reliability [1–5 Likert]
B4. Rate satisfaction with mobile experience [1–5 Likert]

**Section C — Desired Functionality**
C1. Which workflows would you like to see in one unified platform? [Multiple choice ranking]
C2. Would you prefer a single system that combines all academic activities? [Yes / Maybe / No]

**Section D — AI Attitudes**
D1. Which AI-powered features would be most valuable? [Multiple choice ranking]
D2. Would you use an AI tutor in your studies? [Yes / Maybe / No]

**Section E — Adoption Intent**
E1. Would you be willing to adopt a new university-specific LMS? [Yes / Maybe / No]

## Appendix B — API Documentation Sample

The full API documentation is exposed at `/api/docs` via Swagger UI. A representative sample of endpoint schemas:

```yaml
POST /api/ai/generate-quiz
  Tags: AI
  Auth: Bearer JWT
  Body:
    courseId: string (required, uuid)
    topic: string (required)
    questionCount: integer (1-20, default 5)
    difficulty: enum [easy, medium, hard]
    lang: enum [en, ru, kz]
  Responses:
    200: { questions: QuizQuestion[], _demo?: boolean }
    400: ValidationError
    401: Unauthorized
    403: Students forbidden
```

## Appendix C — Project File Structure (abridged)

```
uni-lms/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── activity-log/
│   │   │   ├── admin/
│   │   │   ├── ai/                ← 5 AI endpoints
│   │   │   ├── announcements/
│   │   │   ├── assignments/
│   │   │   ├── attendance/
│   │   │   ├── auth/
│   │   │   ├── common/             ← pagination, filters, decorators
│   │   │   ├── courses/
│   │   │   ├── enrollments/
│   │   │   ├── grades/
│   │   │   ├── groups/
│   │   │   ├── mail/
│   │   │   ├── materials/
│   │   │   ├── notifications/     ← SSE pub/sub
│   │   │   ├── prisma/
│   │   │   ├── schedule/
│   │   │   ├── search/
│   │   │   ├── users/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/        ← 4 migrations
│   │   ├── docker-entrypoint.sh
│   │   ├── Dockerfile
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── app/
│       │   │   ├── (app)/         ← protected routes
│       │   │   │   ├── ai-analysis/
│       │   │   │   ├── courses/
│       │   │   │   │   └── [id]/
│       │   │   │   │       ├── overview/
│       │   │   │   │       ├── assignments/
│       │   │   │   │       ├── materials/
│       │   │   │   │       ├── grades/
│       │   │   │   │       ├── attendance/
│       │   │   │   │       ├── participants/
│       │   │   │   │       └── quiz/
│       │   │   │   ├── admin/
│       │   │   │   ├── dashboard/
│       │   │   │   ├── schedule/
│       │   │   │   ├── calendar/
│       │   │   │   ├── notifications/
│       │   │   │   ├── activity/
│       │   │   │   ├── search/
│       │   │   │   └── profile/
│       │   │   ├── (auth)/        ← login + register
│       │   │   ├── globals.css    ← Design tokens
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   │   ├── ui/            ← 8 primitives
│       │   │   ├── ds/            ← 12 DS components
│       │   │   ├── ai/            ← 8 AI patterns
│       │   │   └── layout/
│       │   ├── lib/
│       │   │   ├── i18n.tsx       ← Trilingual EN/RU/KZ
│       │   │   ├── api.ts
│       │   │   └── types.ts
│       │   └── hooks/
│       ├── Dockerfile
│       ├── tailwind.config.ts
│       └── package.json
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## Appendix D — Data Migration Script

The design-system-drift migration that introduces the AI-feature-supporting database schema (full SQL excerpted):

```sql
-- ── User.preferredLang ──
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_lang" TEXT;

-- ── AssignmentResource ──
CREATE TABLE IF NOT EXISTS "assignment_resources" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignment_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assignment_resources_assignment_id_idx"
    ON "assignment_resources"("assignment_id");

ALTER TABLE "assignment_resources"
    ADD CONSTRAINT "assignment_resources_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AssignmentComment, SubmissionAttachment: similar ──
```

---

*End of diploma thesis.*
