"""Agentic loop — Plan → Retrieve (MCP) → Act → Verify."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_client import generate_text, llm_configured
from app.agents.memory_service import MemoryService
from app.agents.personality import assistant_system_prompt, uncertainty_prefix
from app.mcp.client import MCPClient
from app.policy import PolicyService
from app.services.module_findings import format_findings_for_context, list_findings
from app.services.pending_actions import create_pending_action

SIMILARITY_THRESHOLD = 0.6  # fallback when policy unavailable
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
    pending_suggestions: list[dict[str, Any]] = field(default_factory=list)
    api_configured: bool = True
    grounded: bool = True


TOOL_TO_ACTION = {
    "tasks_create": "create_task",
    "whatsapp_send_reminder": "whatsapp_send",
    "tasks_update_status": "update_task_status",
    "projects_create": "create_project",
}


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
            msg = (
                "Rappel TeamBrain: merci de soumettre votre rapport terrain cette semaine."
                if "rapport" in lower or "terrain" in lower
                else question
            )
            steps.append(
                {
                    "action": "act",
                    "tool": "whatsapp_send_reminder",
                    "args": {"recipient_name": name, "message": msg},
                }
            )
            return AgentPlan(steps=steps, intent="reminder")

    m2 = re.search(r"rappel(?:le|er)?\s+(?:à|a)\s+(.+?)\s+(?:son|sa|leur)", lower)
    if m2:
        name = m2.group(1).strip().title()
        msg = (
            "Rappel TeamBrain: merci de soumettre votre rapport terrain cette semaine."
            if "rapport" in lower or "terrain" in lower
            else question
        )
        steps.append(
            {
                "action": "act",
                "tool": "whatsapp_send_reminder",
                "args": {"recipient_name": name, "message": msg},
            }
        )
        return AgentPlan(steps=steps, intent="reminder")

    if any(re.search(p, lower) for p in CREATE_TASK_PATTERNS):
        steps.append({"action": "act", "tool": "tasks_create", "args": {"title": question[:200]}})
        return AgentPlan(steps=steps, intent="create_task")

    if "calendrier" in lower or "événement" in lower or "event" in lower or "échéance" in lower or "deadline" in lower:
        steps.append({"action": "retrieve", "tool": "calendar_list_events", "args": {}})

    if "document" in lower:
        steps.append({"action": "retrieve", "tool": "documents_search", "query": question})

    if any(kw in lower for kw in ("qui doit", "retard", "engagement", "responsable", "livrer")):
        steps.append({"action": "retrieve", "tool": "memory_accountability", "args": {}})
        steps.append({"action": "retrieve", "tool": "tasks_list_overdue", "args": {}})

    if any(kw in lower for kw in ("rapport terrain", "terrain", "field report")):
        steps.append({"action": "retrieve", "tool": "field_reports_list_recent", "args": {"limit": 5}})

    if any(kw in lower for kw in ("décision", "decisions", "décidé")):
        steps.append({"action": "retrieve", "tool": "meetings_recent_decisions", "args": {"limit": 10}})

    if "où en est" in lower or re.search(r"projet\s+.+", lower):
        proj_match = re.search(r"projet\s+(.+?)(?:\?|$)", question, re.I)
        pname = proj_match.group(1).strip() if proj_match else question
        steps.append({"action": "retrieve", "tool": "projects_status", "args": {"name": pname}})

    return AgentPlan(steps=steps, intent="answer")


def _suggestion_label(action_type: str, payload: dict[str, Any]) -> str:
    if action_type in ("create_task", "task_suggestion"):
        return f"Créer la tâche « {payload.get('title', 'Sans titre')} »"
    if action_type == "whatsapp_send":
        who = payload.get("recipient_name", "destinataire")
        return f"Envoyer un rappel WhatsApp à {who}"
    if action_type == "update_task_status":
        return f"Mettre à jour le statut de la tâche {payload.get('task_id', '')}"
    return f"Action suggérée: {action_type}"


async def _log_verification(session: AsyncSession, org_id: str, note: str) -> None:
    try:
        brain = MemoryService(session)
        await brain.write_memory(
            org_id=org_id,
            type="episodic",
            entity_type="message",
            entity_id=None,
            note=note,
            source_module="assistant",
            source_id=None,
        )
        await session.commit()
    except Exception:
        pass


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

    policy = await PolicyService(session).get_effective_policy(org_id)
    similarity_threshold = policy.assistant_confidence_min
    action_confidence_min = policy.auto_action_confidence_min

    mcp = MCPClient()
    plan = await _plan(question)
    context_parts: list[str] = []
    all_sources: list[str] = []
    actions_taken: list[str] = []
    pending_suggestions: list[dict[str, Any]] = []
    strong_hits = 0
    has_structured_data = False
    recent_findings = await list_findings(session, org_id, hours=24)
    findings_block = format_findings_for_context(recent_findings)
    if findings_block:
        context_parts.append(findings_block)
        has_structured_data = True

    for step in plan.steps:
        if step["action"] == "retrieve":
            tool = step["tool"]
            args = step.get("args", {})
            if tool == "memory_search":
                args = {"query": step.get("query", question), "limit": 12}
            elif tool == "documents_search":
                args = {"query": step.get("query", question)}
            result = await mcp.call_tool(tool, args, session=session, org_id=org_id, user_id=user_id)
            if result.success and result.content:
                if tool == "memory_search":
                    items = result.content.get("items", [])
                    for item in items:
                        score = float(item.get("similarity_score", 0))
                        if score >= similarity_threshold:
                            strong_hits += 1
                        context_parts.append(
                            f"[{item.get('source_module')}:{item.get('source_id')}] "
                            f"(score={score:.2f}) {item.get('note')}"
                        )
                elif tool == "memory_accountability":
                    people = result.content.get("people", [])
                    if people:
                        has_structured_data = True
                        strong_hits += 1
                    context_parts.append(json.dumps(result.content, default=str))
                elif tool == "documents_search":
                    for doc in result.content.get("items", []):
                        context_parts.append(f"[document:{doc['id']}] {doc.get('title')}: {doc.get('ai_summary', '')}")
                elif tool == "calendar_list_events":
                    items = result.content.get("items", [])
                    if items:
                        has_structured_data = True
                    context_parts.append(json.dumps(items, default=str))
                elif tool == "meetings_recent_decisions":
                    decisions = result.content.get("decisions", [])
                    if decisions:
                        has_structured_data = True
                        strong_hits += 1
                    context_parts.append(json.dumps(decisions, default=str))
                elif tool == "projects_status":
                    has_structured_data = True
                    strong_hits += 1
                    context_parts.append(json.dumps(result.content, default=str))
                elif tool == "projects_list":
                    if result.content.get("projects"):
                        has_structured_data = True
                    context_parts.append(json.dumps(result.content, default=str))
                elif tool in ("tasks_list_overdue", "tasks_list_by_assignee", "field_reports_list_recent"):
                    if result.content:
                        has_structured_data = True
                    context_parts.append(json.dumps(result.content, default=str))
                elif tool == "meetings_get_commitments":
                    if result.content.get("commitments"):
                        has_structured_data = True
                    context_parts.append(json.dumps(result.content, default=str))
                all_sources.extend(result.sources)

        elif step["action"] == "act":
            tool = step["tool"]
            args = step.get("args", {})
            action_type = TOOL_TO_ACTION.get(tool, tool)
            payload = dict(args)
            if tool == "whatsapp_send_reminder":
                payload = {
                    "recipient_name": args.get("recipient_name"),
                    "message": args.get("message"),
                }
            elif tool == "tasks_create":
                payload = {"title": args.get("title", question[:200]), "project_id": args.get("project_id")}
            action_id = await create_pending_action(
                session,
                org_id=org_id,
                action_type=action_type,
                payload=payload,
                suggested_by="assistant",
            )
            label = _suggestion_label(action_type, payload)
            pending_suggestions.append(
                {
                    "id": action_id,
                    "action_type": action_type,
                    "payload": payload,
                    "label": label,
                }
            )
            actions_taken.append(f"Suggestion en attente: {label}")
            await _log_verification(session, org_id, f"Suggestion créée ({action_type}): {action_id}")

    proj_result = await mcp.call_tool("projects_list", {}, session=session, org_id=org_id, user_id=user_id)
    project_rows = proj_result.content.get("projects", []) if proj_result.success else []
    if project_rows:
        context_parts.append("Projets (MCP): " + json.dumps(project_rows, default=str))
        all_sources.extend(proj_result.sources)

    context = "\n".join(context_parts) if context_parts else ""

    if strong_hits == 0 and not project_rows and not has_structured_data and plan.intent == "answer":
        weak = [s for s in all_sources if s][:3]
        prefix = uncertainty_prefix()
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

    system = assistant_system_prompt()
    prompt = f"Contexte:\n{context}\n\nQuestion: {question}"
    if actions_taken:
        prompt += f"\n\nSuggestions créées (en attente d'approbation admin): {actions_taken}"

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

    if actions_taken and confidence < action_confidence_min:
        confidence = action_confidence_min

    answer_with_sources = answer.rstrip() + _format_sources_section(sources)

    return AgentResult(
        answer=answer_with_sources,
        confidence=confidence,
        confidence_label=confidence_label(confidence),
        sources=sources,
        model=model,
        actions_taken=actions_taken,
        pending_suggestions=pending_suggestions,
        grounded=True,
    )
