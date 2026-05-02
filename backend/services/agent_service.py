# -*- coding: utf-8 -*-
"""子 Agent 管理服务

从 HermesService 提取的子 Agent 管理方法，包括：
- 列出活跃 Agent
- 获取 Agent 状态
- 终止 Agent
"""

from datetime import datetime
from typing import Any, Dict, List, Optional


class AgentService:
    """子 Agent 管理服务

    管理 Hermes Agent 的子 Agent 实例。
    """

    def __init__(self):
        self._hermes_available: Optional[bool] = None

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用（本地模块或远程 API）"""
        if self._hermes_available is None:
            try:
                import hermes  # type: ignore
                self._hermes_available = True
            except ImportError:
                self._hermes_available = False
        return self._hermes_available

    def list_agents(self) -> List[Dict[str, Any]]:
        """列出活跃的子 Agent"""
        if not self.hermes_available:
            return [
                {
                    "id": "demo-agent-1",
                    "name": "示例 Agent",
                    "status": "idle",
                    "type": "general",
                    "created_at": datetime.now().isoformat(),
                }
            ]
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "AgentManager"):
                manager = hermes.AgentManager()
                agents = []
                for agent_id, agent in manager.get_active_agents().items():
                    agents.append({
                        "id": agent_id,
                        "name": getattr(agent, "name", agent_id),
                        "status": getattr(agent, "status", "unknown"),
                        "type": getattr(agent, "type", "general"),
                        "created_at": getattr(agent, "created_at", ""),
                    })
                return agents
        except Exception:
            pass
        return []

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """获取子 Agent 状态"""
        agents = self.list_agents()
        for agent in agents:
            if agent["id"] == agent_id:
                return agent
        return None

    def terminate_agent(self, agent_id: str) -> Dict[str, Any]:
        """终止子 Agent"""
        if not self.hermes_available:
            return {"success": False, "message": "Hermes Agent 未安装，无法终止 Agent"}
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "AgentManager"):
                manager = hermes.AgentManager()
                manager.terminate(agent_id)
                return {"success": True, "message": f"Agent {agent_id} 已终止"}
        except Exception as e:
            return {"success": False, "message": f"终止失败: {str(e)}"}
        return {"success": False, "message": f"Agent {agent_id} 不存在"}


# 全局单例
agent_service = AgentService()
