# -*- coding: utf-8 -*-
"""知识利用率统计 — 查看智能体对知识库的使用情况"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_utilization_stats",
        description="查看知识库利用率统计 — 规则遵守率、知识命中率、经验避坑率、沉淀活跃度",
        schema={
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "default": "today",
                    "description": "统计周期: today/week/all",
                }
            },
        },
        handler=handle,
        tags=["knowledge", "system"],
    )


def handle(args: dict) -> dict:
    from backend.db import get_knowledge_db
    import json
    from datetime import datetime, timedelta

    try:
        conn = get_knowledge_db()
        period = args.get("period", "today")

        # 时间过滤
        if period == "today":
            time_filter = "date(created_at) = date('now')"
        elif period == "week":
            time_filter = "created_at >= datetime('now', '-7 days')"
        else:
            time_filter = "1=1"

        stats = {}

        # 1. 知识库总量
        for table, label in [("rules", "规则"), ("knowledge", "知识"), ("experiences", "经验"), ("memories", "记忆")]:
            row = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE is_active=1").fetchone()
            stats[f"total_{label}"] = row[0] if row else 0

        # 2. 今日新增
        for table, label in [("rules", "规则"), ("knowledge", "知识"), ("experiences", "经验"), ("memories", "记忆")]:
            row = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE is_active=1 AND date(created_at)=date('now')").fetchone()
            stats[f"today_new_{label}"] = row[0] if row else 0

        # 3. 自动沉淀统计（created_by='auto_engine'）
        for table, label in [("knowledge", "知识"), ("experiences", "经验"), ("memories", "记忆")]:
            row = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE is_active=1 AND created_by='auto_engine'").fetchone()
            stats[f"auto_{label}"] = row[0] if row else 0

        # 4. 工具调用追踪统计
        try:
            traces = conn.execute(
                f"SELECT COUNT(*), SUM(CASE WHEN result_success=1 THEN 1 ELSE 0 END), "
                f"AVG(duration_ms) FROM tool_call_traces WHERE {time_filter}"
            ).fetchone()
            stats["total_tool_calls"] = traces[0] or 0
            stats["successful_calls"] = traces[1] or 0
            stats["avg_duration_ms"] = round(traces[2], 1) if traces[2] else 0
            stats["success_rate"] = round(stats["successful_calls"] / stats["total_tool_calls"] * 100, 1) if stats["total_tool_calls"] > 0 else 0

            # 有上下文提示的调用
            hinted = conn.execute(
                f"SELECT COUNT(*) FROM tool_call_traces WHERE {time_filter} AND injected_hints != '[]'"
            ).fetchone()
            stats["calls_with_hints"] = hinted[0] or 0

            # 有自动沉淀的调用
            learned = conn.execute(
                f"SELECT COUNT(*) FROM tool_call_traces WHERE {time_filter} AND auto_learned != '[]'"
            ).fetchone()
            stats["calls_with_learning"] = learned[0] or 0

            # 规则匹配统计
            rules_matched = conn.execute(
                f"SELECT COUNT(*) FROM tool_call_traces WHERE {time_filter} AND matched_rules != '[]'"
            ).fetchone()
            stats["calls_with_rules_matched"] = rules_matched[0] or 0

        except Exception:
            stats["total_tool_calls"] = 0
            stats["calls_with_hints"] = 0
            stats["calls_with_learning"] = 0

        # 5. 经验解决率
        try:
            exp_stats = conn.execute(
                "SELECT COUNT(*), SUM(CASE WHEN is_resolved=1 THEN 1 ELSE 0 END) FROM experiences WHERE is_active=1"
            ).fetchone()
            total_exp = exp_stats[0] or 0
            resolved_exp = exp_stats[1] or 0
            stats["experience_resolve_rate"] = round(resolved_exp / total_exp * 100, 1) if total_exp > 0 else 0
        except Exception:
            stats["experience_resolve_rate"] = 0

        # 6. 闭环健康度评分
        total_knowledge = stats.get("total_知识", 0) + stats.get("total_经验", 0) + stats.get("total_记忆", 0)
        auto_total = stats.get("auto_知识", 0) + stats.get("auto_经验", 0) + stats.get("auto_记忆", 0)
        hint_rate = round(stats["calls_with_hints"] / stats["total_tool_calls"] * 100, 1) if stats["total_tool_calls"] > 0 else 0
        learn_rate = round(stats["calls_with_learning"] / stats["total_tool_calls"] * 100, 1) if stats["total_tool_calls"] > 0 else 0
        auto_ratio = round(auto_total / total_knowledge * 100, 1) if total_knowledge > 0 else 0

        stats["闭环指标"] = {
            "知识自动沉淀率": f"{auto_ratio}%",
            "上下文提示覆盖率": f"{hint_rate}%",
            "调用后学习率": f"{learn_rate}%",
            "经验解决率": f"{stats['experience_resolve_rate']}%",
        }

        # 生成文本报告
        report_lines = [
            f"📊 知识利用率统计 ({period})",
            f"",
            f"📋 知识库总量: 规则 {stats['total_规则']} | 知识 {stats['total_知识']} | 经验 {stats['total_经验']} | 记忆 {stats['total_记忆']}",
            f"📈 今日新增: 规则 {stats['today_new_规则']} | 知识 {stats['today_new_知识']} | 经验 {stats['today_new_经验']} | 记忆 {stats['today_new_记忆']}",
            f"🤖 自动沉淀: 知识 {stats['auto_知识']} | 经验 {stats['auto_经验']} | 记忆 {stats['auto_记忆']}",
            f"",
            f"🔧 工具调用: 总计 {stats['total_tool_calls']} | 成功 {stats['successful_calls']} ({stats['success_rate']}%)",
            f"💡 有上下文提示: {stats['calls_with_hints']} ({hint_rate}%)",
            f"📚 有自动沉淀: {stats['calls_with_learning']} ({learn_rate}%)",
            f"🛡️ 规则被匹配: {stats['calls_with_rules_matched']}",
            f"",
            f"🔄 闭环健康度:",
        ]
        for k, v in stats["闭环指标"].items():
            report_lines.append(f"  {k}: {v}")

        return success_response(
            data=stats,
            message="\n".join(report_lines),
        )
    except Exception as e:
        return error_response(str(e))
