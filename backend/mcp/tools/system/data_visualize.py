# -*- coding: utf-8 -*-
"""数据可视化工具 - 从数据生成图表（折线图、柱状图、饼图、散点图）"""

import csv
import json
import os
import uuid

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="data_visualize",
        description="从数据生成图表，支持折线图、柱状图、饼图和散点图，保存为 PNG 文件",
        schema={
            "type": "object",
            "properties": {
                "data_source": {
                    "type": "string",
                    "description": "数据源：CSV 文件路径或 JSON 字符串",
                },
                "chart_type": {
                    "type": "string",
                    "enum": ["line", "bar", "pie", "scatter"],
                    "description": "图表类型：line(折线图), bar(柱状图), pie(饼图), scatter(散点图)",
                },
                "x_column": {
                    "type": "string",
                    "description": "X 轴数据列名",
                },
                "y_column": {
                    "type": "string",
                    "description": "Y 轴数据列名",
                },
                "title": {
                    "type": "string",
                    "description": "图表标题（可选）",
                },
                "output_path": {
                    "type": "string",
                    "description": "输出文件路径（可选，默认自动生成）",
                },
            },
            "required": ["data_source", "chart_type", "x_column", "y_column"],
        },
        handler=handle,
        tags=["system"],
    )


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _load_csv_data(filepath: str) -> tuple:
    """读取 CSV 文件，返回 (headers, rows)"""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        rows = list(reader)
    return headers, rows


def _load_json_data(data_source: str) -> tuple:
    """读取 JSON 数据源"""
    if os.path.isfile(data_source):
        with open(data_source, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = json.loads(data_source)

    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        headers = list(data[0].keys())
        rows = data
    else:
        raise ValueError("JSON 数据格式不支持，需要对象数组")
    return headers, rows


def _load_data(data_source: str) -> tuple:
    """根据数据源类型加载数据"""
    if os.path.isfile(data_source):
        ext = os.path.splitext(data_source)[1].lower()
        if ext == ".csv":
            return _load_csv_data(data_source)
        elif ext == ".json":
            return _load_json_data(data_source)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
    else:
        return _load_json_data(data_source)


def _get_output_path(output_path: str = None) -> str:
    """获取输出文件路径"""
    if output_path:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        return output_path
    from backend.config import get_hermes_home
    charts_dir = get_hermes_home() / "data" / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)
    filename = f"chart_{uuid.uuid4().hex[:8]}.png"
    return str(charts_dir / filename)


def _try_float(value):
    """尝试转换为浮点数"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip().replace(",", ""))
    except (ValueError, TypeError):
        return None


def _generate_chart(data_source, chart_type, x_column, y_column, title, output_path):
    """使用 matplotlib 生成图表"""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # 设置中文字体支持
    try:
        plt.rcParams["font.sans-serif"] = [
            "SimHei", "DejaVu Sans", "Arial Unicode MS", "WenQuanYi Micro Hei",
        ]
        plt.rcParams["axes.unicode_minus"] = False
    except Exception:
        pass

    headers, rows = _load_data(data_source)

    if x_column not in headers:
        raise ValueError(f"X 轴列 '{x_column}' 不存在，可用列: {headers}")
    if y_column not in headers:
        raise ValueError(f"Y 轴列 '{y_column}' 不存在，可用列: {headers}")

    x_values = [r.get(x_column, "") for r in rows]
    y_values = [_try_float(r.get(y_column)) for r in rows]

    valid_pairs = [(x, y) for x, y in zip(x_values, y_values) if y is not None]
    if not valid_pairs:
        raise ValueError(f"列 '{y_column}' 中没有有效的数值数据")

    x_valid = [p[0] for p in valid_pairs]
    y_valid = [p[1] for p in valid_pairs]

    fig, ax = plt.subplots(figsize=(10, 6))
    chart_title = title or f"{y_column} vs {x_column}"

    if chart_type == "line":
        ax.plot(range(len(x_valid)), y_valid, marker="o", linewidth=2, markersize=4)
        ax.set_xticks(range(len(x_valid)))
        ax.set_xticklabels(x_valid, rotation=45, ha="right", fontsize=8)
        ax.set_xlabel(x_column)
        ax.set_ylabel(y_column)
        ax.set_title(chart_title)
        ax.grid(True, alpha=0.3)

    elif chart_type == "bar":
        ax.bar(range(len(x_valid)), y_valid, color="#4A90D9", edgecolor="#2C5F8A")
        ax.set_xticks(range(len(x_valid)))
        ax.set_xticklabels(x_valid, rotation=45, ha="right", fontsize=8)
        ax.set_xlabel(x_column)
        ax.set_ylabel(y_column)
        ax.set_title(chart_title)
        ax.grid(True, alpha=0.3, axis="y")

    elif chart_type == "pie":
        if len(x_valid) > 10:
            x_valid = x_valid[:10]
            y_valid = y_valid[:10]
        ax.pie(
            y_valid, labels=x_valid, autopct="%1.1f%%",
            startangle=90, textprops={"fontsize": 8},
        )
        ax.set_title(chart_title)

    elif chart_type == "scatter":
        ax.scatter(
            range(len(x_valid)), y_valid, alpha=0.6, s=50,
            c="#E74C3C", edgecolors="#C0392B",
        )
        ax.set_xticks(range(len(x_valid)))
        ax.set_xticklabels(x_valid, rotation=45, ha="right", fontsize=8)
        ax.set_xlabel(x_column)
        ax.set_ylabel(y_column)
        ax.set_title(chart_title)
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    save_path = _get_output_path(output_path)
    fig.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return save_path


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handle(args: dict) -> dict:
    """data_visualize handler"""
    data_source = args.get("data_source", "")
    chart_type = args.get("chart_type", "bar")
    x_column = args.get("x_column", "")
    y_column = args.get("y_column", "")
    title = args.get("title", "")
    output_path = args.get("output_path", "")

    if not data_source:
        return error_response("请提供数据源（CSV 文件路径或 JSON 字符串）")
    if not x_column or not y_column:
        return error_response("请提供 x_column 和 y_column")

    valid_types = ["line", "bar", "pie", "scatter"]
    if chart_type not in valid_types:
        return error_response(f"不支持的图表类型: {chart_type}，可选: {valid_types}")

    try:
        save_path = _generate_chart(
            data_source, chart_type, x_column, y_column, title, output_path or None,
        )
        return success_response(
            data={
                "file_path": save_path,
                "chart_type": chart_type,
                "x_column": x_column,
                "y_column": y_column,
                "title": title or f"{y_column} vs {x_column}",
            },
            message=f"图表已生成并保存到: {save_path}",
        )
    except ImportError:
        return error_response(
            "matplotlib 未安装，请运行: pip install matplotlib",
            code="MISSING_DEPENDENCY",
        )
    except FileNotFoundError:
        return error_response(f"文件不存在: {data_source}")
    except Exception as e:
        return error_response(str(e))
