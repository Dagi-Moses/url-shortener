# AI Usage Log

This file documents my use of AI tools during this technical screening, as required.

| Tool used | What you asked / generated | What you changed / decided yourself |
|-----------|---------------------------|--------------------------------------|
| Claude | Asked Claude to scaffold the initial project structure: package.json dependencies, folder layout, and the Express entry point | Reviewed all generated code carefully. Removed `helmet` and `cors` packages that Claude included by default: they add complexity without being required by the brief, and I didn't want to ship code I hadn't reasoned through. Kept the dependency list minimal and intentional. |
| Claude | Asked Claude for the Dockerfile | Accepted the multi-stage build pattern and non-root user setup. Changed the base image from `node:20` to `node:20-alpine` to reduce image size. Added the `HEALTHCHECK` instruction manually since Claude omitted it, and it's directly testable by Docker Compose's `depends_on: condition: service_healthy`. |
| Claude | Asked Claude to draft the README curl examples section | Accepted the structure but rewrote the "Known Limitations" section entirely. Claude generated generic limitations (e.g. "consider adding authentication") that weren't specific to the architecture decisions I actually made. I replaced these with limitations that are honest about *my* implementation: in-memory rate limiting not being safe for multi-replica deployments, no analytics pruning strategy, etc. |



## Reflection

Using Claude as a pairing tool saved time on boilerplate (route scaffolding, Dockerfile structure) and let me focus my energy on the decisions that actually matter. The most important habit was reading every generated output critically before accepting it, Claude tends toward completeness over minimalism, so I cut anything I couldn't justify being there.
