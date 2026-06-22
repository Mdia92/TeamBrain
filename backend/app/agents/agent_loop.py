"""Agentic loop — Plan → Retrieve (MCP) → Act → Verify."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text, llm_configured
from app.mcp.client import MCPClient

SIMILARITY_THRESHOLD = 0.6
ACTION_CONFIDENCE_MIN = 0.6

REMINDER_PATTERNS = (
    r"rappel(?:le|er)?\s+(?:à|a)\s+(\w+)",
    r"remind\s+(\w+)",
)
CREATE_TASK_PATTERNS = (r"cr(?:ée|e)r?\s+(?:une\s+)?tâche", r"create\s+task")


@dataclass
class AgentPlan:
    steps: list[dict[str, Any]] = field(default_factory=list)
    intent: str = "answer"


@dataclass
class AgentResult:
    answer: str
    confidence: float
    confidence_label: str
    sources: list[str]
    model: str
    actions_taken: list[str] = field(default_factory=list)
    api_configured: bool = True
    grounded: bool = True


def confidence_label(score: float) -> str:
    if score >= 0.75:
        return "Haute"
    if score >= 0.6:
        return "Moyenne"
    return "Faible"


def _format_sources_section(sources: list[str]) -> str:
    if not sources:
        return ""
    lines = "\n".join(f"• {s}" for s in sources)
    return f"\n\n**Sources**\n{lines}"


async def _plan(question: str) -> AgentPlan:
    lower = question.lower()
    steps: list[dict[str, Any]] = [{"action": "retrieve", "tool": "memory_search", "query": question}]

    for pattern in REMINDER_PATTERNS:
        m = re.search(pattern, lower, re.I)
        if m:
            name = m.group(1).capitalize()
            msg = question
            if "rapport" in lower:
                msg = "Rappel TeamBrain: merci de soumettre votre rapport terrain cette semaine."
            steps.append(
                {
                    "action": "act",
                    "tool": "whatsapp_send_reminder",
                    "args": {"recipient_name": name, "message": msg},
                }
            )
            return AgentPlan(steps=steps, intent="reminder")

    if any(re.search(p, lower) for p in CREATE_TASK_PATTERNS):
        steps.append({"action": "act", "tool": "create_task", "args": {"title": question[:200]}})
        return AgentPlan(steps=steps, intent="create_task")

    if "calendrier" in lower or "événement" in lower or "event" in lower:
        steps.append({"action": "retrieve", "tool": "calendar_list_events", "args": {}})

    if "document" in lower:
        steps.append({"action": "retrieve", "tool": "documents_search", "query": question})

    if any(kw in lower for kw in ("qui doit", "retard", "engagement", "responsable")):
        steps.append({"action": "retrieve", "tool": "memory_accountability", "args": {}})

    return AgentPlan(steps=steps, intent="answer")


async def run_agent(
    session: AsyncSession,
    org_id: str,
    question: str,
    user_id: str | None = None,
) -> AgentResult:
    if not llm_configured():
        return AgentResult(
            answer="Configurez une clé API dans les paramètres (GEMINI, GROQ ou MISTRAL).",
            confidence=0.0,
            confidence_label="Faible",
            sources=[],
            model="none",
            api_configured=False,
            grounded=True,
        )

    mcp = MCPClient()
    plan = await _plan(question)
    context_parts: list[str] = []
    all_sources: list[str] = []
    actions_taken: list[str] = []
    strong_hits = 0

    for step in plan.steps:
        if step["action"] == "retrieve":
            tool = step["tool"]
            args = step.get("args", {})
            if tool == "memory_search":
                args = {"query": step.get("query", question), "limit": 12}
            result = await mcp.call_tool(tool, args, session=session, org_id=org_id, user_id=user_id)
            if result.success and result.content:
                if tool == "memory_search":
                    items = result.content.get("items", [])
                    for item in items:
                        score = float(item.get("similarity_score", 0))
                        if score >= SIMILARITY_THRESHOLD:
                            strong_hits += 1
                        context_parts.append(
                            f"[{item.get('source_module')}:{item.get('source_id')}] "
                            f"(score={score:.2f}) {item.get('note')}"
                        )
                elif tool == "memory_accountability":
                    context_parts.append(json.dumps(result.content, default=str))
                elif tool == "documents_search":
                    for doc in result.content.get("items", []):
                        context_parts.append(f"[document:{doc['id']}] {doc.get('title')}: {doc.get('ai_summary', '')}")
                elif tool == "calendar_list_events":
                    context_parts.append(json.dumps(result.content.get("items", []), default=str))
                all_sources.extend(result.sources)

        elif step["action"] == "act":
            tool = step["tool"]
            args = step.get("args", {})
            if tool == "create_task":
                if plan.intent == "create_task":
                    tid = await _create_task(session, org_id, user_id, args.get("title", "Nouvelle tâche"))
                    if tid:
                        actions_taken.append(f"Tâche créée: {tid}")
                        all_sources.append(f"task:{tid}")
                continue
            result = await mcp.call_tool(tool, args, session=session, org_id=org_id, user_id=user_id)
            if result.success:
                actions_taken.append(f"{tool}: {result.content}")
                all_sources.extend(result.sources)
            else:
                actions_taken.append(f"{tool} échoué: {result.error}")

    # Live project rows (grounding)
    project_rows = (
        await session.execute(
            text(
                "SELECT name, status FROM projects WHERE organization_id = CAST(:oid AS uuid)"
            ).bindparams(oid=org_id),
        )
    ).mappings().all()
    if project_rows:
        context_parts.append("Projets (DB): " + json.dumps([dict(r) for r in project_rows], default=str))

    context = "\n".join(context_parts) if context_parts else ""

    if strong_hits == 0 and not project_rows and plan.intent == "answer":
        weak = [s for s in all_sources if s][:3]
        prefix = (
            "Je n'ai pas assez d'informations pour répondre avec certitude. "
            "Voici ce que je sais :\n\n"
        )
        body = context or "Aucun contexte organisationnel trouvé au-dessus du seuil de similarité."
        return AgentResult(
            answer=prefix + body + _format_sources_section(weak),
            confidence=0.35,
            confidence_label="Faible",
            sources=weak,
            model="rules",
            actions_taken=actions_taken,
            grounded=False,
        )

    system = (
        "Tu es l'assistant agentique TeamBrain. Réponds UNIQUEMENT à partir du contexte fourni. "
        "Ne invente jamais de noms, projets ou dates. JSON: "
        '{"answer":"...","confidence":0.0-1.0,"sources":["module:id — note"]}'
    )
    prompt = f"Contexte:\n{context}\n\nQuestion: {question}"
    if actions_taken:
        prompt += f"\n\nActions déjà exécutées: {actions_taken}"

    raw, model = await generate_text(prompt, system)
    confidence = 0.5
    answer = raw
    sources = list(dict.fromkeys(all_sources))[:10]

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            answer = data.get("answer", raw)
            confidence = float(data.get("confidence", 0.5))
            for s in data.get("sources", []):
                if s not in sources:
                    sources.append(s)
        except (json.JSONDecodeError, ValueError):
            pass

    if actions_taken and confidence < ACTION_CONFIDENCE_MIN:
        confidence = ACTION_CONFIDENCE_MIN

    answer_with_sources = answer.rstrip() + _format_sources_section(sources)

    return AgentResult(
        answer=answer_with_sources,
        confidence=confidence,
        confidence_label=confidence_label(confidence),
        sources=sources,
        model=model,
        actions_taken=actions_taken,
        grounded=True,
    )


async def _create_task(
    session: AsyncSession,
    org_id: str,
    user_id: str | None,
    title: str,
) -> str | None:
    if not user_id:
        return None
    import uuid

    project = (
        await session.execute(
            text(
                "SELECT id FROM projects WHERE organization_id = CAST(:oid AS uuid) LIMIT 1"
            ).bindparams(oid=org_id),
        )
    ).first()
    if not project:
        return None
    tid = str(uuid.uuid4())
    await session.execute(
        text(
            "INSERT INTO tasks (id, organization_id, project_id, title, status, source, created_by)"
            " VALUES (CAST(:tid AS uuid), CAST(:oid AS uuid), CAST(:pid AS uuid), :title,"
            " 'todo', 'ai_suggestion', CAST(:uid AS uuid))"
        ).bindparams(
            tid=tid,
            oid=org_id,
            pid=str(project[0]),
            title=title[:500],
            uid=user_id,
        ),
    )
    await session.commit()
    return tid
