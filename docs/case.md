# HackApertus Liebefeld — case: Research & Expertise Navigator

Partner: Bern Economic Development Agency. Copied by Peter from the event platform (app.sprintd.org, event "hack-apertus-liebefeld", Cases) on 2026-10-18. Guide: https://app.notion.com/p/hackapertus/Bern-Economic-Development-Agency-fe5b4fec112a833daf9401a4771a7c12

## Context and background
Finding expertise often requires knowing where to search before knowing what to search for. Information sits on faculty websites, institute pages, research group profiles, centre websites, individual researcher pages or project descriptions, and the searcher's words often differ from the source's. Someone looking for "glucose sensors" may miss pages that say continuous glucose monitoring, biosensing, metabolic monitoring, wearable sensing or CGM. The challenge is to turn this fragmented web landscape into a unified, semantically searchable knowledge resource.

## Problem
Research institutions publish valuable information about people, expertise, research activities, technologies, infrastructures and services, spread across a large, heterogeneous landscape of websites and platforms.

## Main objective
An AI-powered Research & Expertise Navigator that aggregates these distributed public sources and makes them accessible through one natural-language and keyword search interface.

## Datasets (one distributed ecosystem, not separate databases)
1. University of Bern web ecosystem — from the provided inventory of public unibe.ch subdomains (faculties, institutes, departments, research centres, laboratories, services, platforms).
2. ARTORG Center for Biomedical Engineering Research — website and its research, team and project pages.
3. Diabetes Center Berne — website and its research, expertise, team, project and service pages.
The architecture must let more institutional websites be added easily later.
Supporting material: the supplied inventory of public unibe.ch subdomains (initial discovery map).

## Platform constraints
- Languages/frameworks: not specified.
- Development and deployment entirely outside the Canton of Bern's ICT infrastructure: local (e.g. Docker) or independent / Swiss cloud. Self-contained, able to run fully air-gapped or on independent cloud instances, no connection to cantonal networks.
- Models: Apertus 8B or 70B (v1.5) — huggingface.co/swiss-ai/Apertus-v1.5-8B, huggingface.co/swiss-ai/Apertus-v1.5-70B.

## Expected output
End-to-end prototype: public web sources → content extraction → semantic enrichment → structured knowledge → natural-language search → source-backed results. Each query returns structured, traceable results:
- relevant people and contact persons;
- their functions and affiliations;
- departments / institutes / research groups;
- fields of expertise;
- related projects or activities;
- relevant infrastructure or services;
- a short explanation of why each result matches;
- direct links to the original source pages.
Every result stays connected to its source and can be verified.

## Success criteria
1. Finds the right people: at least 80% of expected experts/units appear in the top 10 results.
2. Handles different wording: synonym and lay-term queries (e.g. "glucose sensors" vs "CGM", "biosensing") find the same experts as the site's own terminology.
3. Every result is traceable: 100% of results link to a public source page that supports the claim; no invented people, roles or projects.
4. Structured results: each result fills the required fields (person, role/affiliation, unit, expertise, projects, infrastructure/services, reason for match, source link) where the source provides them.
5. Covers all three sources: UniBE, ARTORG and Diabetes Center Berne.
6. Easy to extend: a new institutional website can be added via configuration or a short documented step, without rewriting the pipeline.

## Evaluation criteria (judges)
Purposeful use of AI · Technical rigour · Value, cost & scalability · Sovereign deployability · Implementation feasibility.

## Ethical guidelines
- Transparency & traceability: no unverified or hallucinated information; every result, summary and explanation back-linked to the verifiable public source URL.
- Fair & unbiased representation: fair, objective discoverability across all groups, institutes and researchers regardless of size or prominence.
- Accuracy & reliability: say clearly when no reliable, verifiable or sufficient source information exists.

## Legal & compliance
Swiss Federal Act on Data Protection (nDSG) and GDPR where applicable. Only public web content; copyright of source pages stays with the institutions. Outputs are published as Open Commons (event Terms & Conditions §6).
