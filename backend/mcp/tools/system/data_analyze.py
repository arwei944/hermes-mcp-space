# -*- coding: utf-8 -*-
"""数据统计分析工具 - 支持描述性统计、相关性分析、分组统计、趋势检测、唯一值计数"""

import csv
import json
import math
import os

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="data_analyze",
        description="对数据进行统计分析，支持描述性统计、相关性分析、分组统计、趋势检测和唯一值计数",
        schema={
            "type": "object",
            "properties": {
                "data_source": {
                    "type": "string",
                    "description": "数据源：文件路径（CSV/JSON）或 JSON 字符串",
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["describe", "correlation", "groupby", "trend", "count_unique"],
                    "description": "分析类型：describe(描述统计), correlation(相关性), groupby(分组统计), trend(趋势检测), count_unique(唯一值计数)",
                },
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "指定分析的列名（可选，默认分析所有列）",
                },
                "output_format": {
                    "type": "string",
                    "default": "json",
                    "description": "输出格式：json 或 text",
                },
            },
            "required": ["data_source", "analysis_type"],
        },
        handler=handle,
        tags=["system"],
    )


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _load_data(data_source: str) -> tuple:
    """从文件路径或 JSON 字符串加载数据，返回 (headers, rows)"""
    if os.path.isfile(data_source):
        file_ext = os.path.splitext(data_source)[1].lower()
        if file_ext == ".csv":
            return _load_csv_file(data_source)
        elif file_ext == ".json":
            return _load_json_file(data_source)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}，仅支持 .csv 和 .json")
    else:
        return _load_json_string(data_source)


def _load_csv_file(filepath: str) -> tuple:
    """读取 CSV 文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        rows = list(reader)
    return headers, rows


def _load_json_file(filepath: str) -> tuple:
    """读取 JSON 文件（支持数组或对象数组）"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list) and len(data) > 0:
        if isinstance(data[0], dict):
            headers = list(data[0].keys())
            rows = data
        else:
            headers = ["value"]
            rows = [{"value": v} for v in data]
    elif isinstance(data, dict):
        headers = list(data.keys())
        rows = [data]
    else:
        raise ValueError("JSON 数据格式不支持，需要数组或对象")
    return headers, rows


def _load_json_string(json_str: str) -> tuple:
    """解析 JSON 字符串"""
    data = json.loads(json_str)
    if isinstance(data, list) and len(data) > 0:
        if isinstance(data[0], dict):
            headers = list(data[0].keys())
            rows = data
        else:
            headers = ["value"]
            rows = [{"value": v} for v in data]
    elif isinstance(data, dict):
        headers = list(data.keys())
        rows = [data]
    else:
        raise ValueError("JSON 数据格式不支持，需要数组或对象")
    return headers, rows


def _try_float(value):
    """尝试将值转换为浮点数，失败返回 None"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip().replace(",", ""))
    except (ValueError, TypeError):
        return None


def _is_numeric_column(rows: list, col: str) -> bool:
    """检查列是否为数值列"""
    sample = rows[:min(20, len(rows))]
    numeric_count = sum(1 for r in sample if _try_float(r.get(col)) is not None)
    return numeric_count > len(sample) * 0.5


def _get_numeric_values(rows: list, col: str) -> list:
    """获取列的数值列表（过滤非数值）"""
    values = []
    for r in rows:
        v = _try_float(r.get(col))
        if v is not None:
            values.append(v)
    return values


def _compute_std(values: list) -> float:
    """计算标准差"""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def _compute_pearson(x_vals: list, y_vals: list) -> float:
    """计算 Pearson 相关系数"""
    n = min(len(x_vals), len(y_vals))
    if n < 3:
        return 0.0
    x_vals = x_vals[:n]
    y_vals = y_vals[:n]
    mean_x = sum(x_vals) / n
    mean_y = sum(y_vals) / n
    num = sum((x_vals[i] - mean_x) * (y_vals[i] - mean_y) for i in range(n))
    den_x = math.sqrt(sum((x_vals[i] - mean_x) ** 2 for i in range(n)))
    den_y = math.sqrt(sum((y_vals[i] - mean_y) ** 2 for i in range(n)))
    if den_x == 0 or den_y == 0:
        return 0.0
    return num / (den_x * den_y)


# ---------------------------------------------------------------------------
# 分析函数
# ---------------------------------------------------------------------------

def _analyze_describe(headers: list, rows: list, columns: list = None) -> dict:
    """描述性统计：count, mean, min, max, std"""
    target_cols = columns or headers
    result = {}
    for col in target_cols:
        if col not in headers:
            continue
        values = _get_numeric_values(rows, col)
        if not values:
            result[col] = {"error": "无有效数值数据"}
            continue
        result[col] = {
            "count": len(values),
            "mean": round(sum(values) / len(values), 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "std": round(_compute_std(values), 4),
        }
    return result


def _analyze_correlation(headers: list, rows: list, columns: list = None) -> dict:
    """相关性分析：计算数值列之间的 Pearson 相关系数"""
    numeric_cols = [c for c in (columns or headers) if c in headers and _is_numeric_column(rows, c)]
    if len(numeric_cols) < 2:
        return {"error": "至少需要两个数值列才能计算相关性"}
    result = {}
    for i, col_a in enumerate(numeric_cols):
        result[col_a] = {}
        vals_a = _get_numeric_values(rows, col_a)
        for col_b in numeric_cols[i:]:
            vals_b = _get_numeric_values(rows, col_b)
            corr = _compute_pearson(vals_a, vals_b)
            result[col_a][col_b] = round(corr, 4)
            if col_b not in result:
                result[col_b] = {}
            result[col_b][col_a] = round(corr, 4)
    return result


def _analyze_groupby(headers: list, rows: list, columns: list = None) -> dict:
    """分组统计：按第一列分组，统计行数"""
    group_col = columns[0] if columns else headers[0]
    if group_col not in headers:
        return {"error": f"分组列 '{group_col}' 不存在"}
    groups = {}
    for r in rows:
        key = str(r.get(group_col, ""))
        groups[key] = groups.get(key, 0) + 1
    sorted_groups = dict(sorted(groups.items(), key=lambda x: x[1], reverse=True))
    return {
        "group_by": group_col,
        "total_groups": len(sorted_groups),
        "total_rows": len(rows),
        "groups": sorted_groups,
    }


def _analyze_trend(headers: list, rows: list, columns: list = None) -> dict:
    """趋势检测：判断数值列的值是递增、递减还是平稳"""
    target_cols = columns or headers
    result = {}
    for col in target_cols:
        if col not in headers:
            continue
        values = _get_numeric_values(rows, col)
        if len(values) < 3:
            result[col] = {"trend": "insufficient_data", "detail": "数据点不足（至少需要3个）"}
            continue
        n = len(values)
        x_mean = (n - 1) / 2.0
        y_mean = sum(values) / n
        num = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
        den = sum((i - x_mean) ** 2 for i in range(n))
        slope = num / den if den != 0 else 0
        relative_slope = slope / abs(y_mean) if y_mean != 0 else slope
        if abs(relative_slope) < 0.01:
            trend = "stable"
        elif relative_slope > 0:
            trend = "increasing"
        else:
            trend = "decreasing"
        result[col] = {
            "trend": trend,
            "slope": round(slope, 6),
            "relative_slope": round(relative_slope, 6),
            "first_value": round(values[0], 4),
            "last_value": round(values[-1], 4),
            "data_points": n,
        }
    return result


def _analyze_count_unique(headers: list, rows: list, columns: list = None) -> dict:
    """唯一值计数：统计每列的唯一值数量"""
    target_cols = columns or headers
    result = {}
    for col in target_cols:
        if col not in headers:
            continue
        unique_vals = set()
        for r in rows:
            val = r.get(col)
            unique_vals.add(str(val) if val is not None else "__null__")
        result[col] = {
            "unique_count": len(unique_vals),
            "total_count": len(rows),
        }
    return result


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handle(args: dict) -> dict:
    """data_analyze handler"""
    data_source = args.get("data_source", "")
    analysis_type = args.get("analysis_type", "describe")
    columns = args.get("columns")
    output_format = args.get("output_format", "json")

    if not data_source:
        return error_response("请提供数据源（文件路径或 JSON 字符串）")

    valid_types = ["describe", "correlation", "groupby", "trend", "count_unique"]
    if analysis_type not in valid_types:
        return error_response(f"不支持的分析类型: {analysis_type}，可选: {valid_types}")

    try:
        headers, rows = _load_data(data_source)

        if not rows:
            return error_response("数据为空，未找到有效数据")

        analyzers = {
            "describe": _analyze_describe,
            "correlation": _analyze_correlation,
            "groupby": _analyze_groupby,
            "trend": _analyze_trend,
            "count_unique": _analyze_count_unique,
        }
        result = analyzers[analysis_type](headers, rows, columns)

        if output_format == "text":
            text_output = json.dumps(result, ensure_ascii=False, indent=2)
            return success_response(data=text_output, message=f"{analysis_type} 分析完成（文本格式）")
        else:
            return success_response(data=result, message=f"{analysis_type} 分析完成")

    except json.JSONDecodeError as e:
        return error_response(f"JSON 解析失败: {e}")
    except FileNotFoundError:
        return error_response(f"文件不存在: {data_source}")
    except Exception as e:
        return error_response(str(e))
