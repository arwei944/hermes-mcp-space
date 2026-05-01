// 知识图谱可视化工具（基于 SVG）
// 提供简单的力导向布局和节点/边渲染
var KnowledgeGraph = {
    render: function (containerId, nodes, edges) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var width = container.clientWidth || 800;
        var height = container.clientHeight || 400;

        // 创建 SVG
        var svg = container.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.style.cssText = 'width:100%;height:100%;border:1px solid #e5e7eb;border-radius:8px;';
            container.appendChild(svg);
        }

        svg.innerHTML = '';

        // 简单的力导向布局
        var positions = this._layout(nodes, width, height);

        // 绘制边
        edges.forEach(function (edge) {
            var source = positions[edge.source];
            var target = positions[edge.target];
            if (source && target) {
                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', source.x);
                line.setAttribute('y1', source.y);
                line.setAttribute('x2', target.x);
                line.setAttribute('y2', target.y);
                line.setAttribute('stroke', '#94a3b8');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('opacity', '0.6');
                svg.appendChild(line);
            }
        });

        // 绘制节点
        nodes.forEach(function (node, i) {
            var pos = positions[i];
            var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ')');

            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', node.size || 20);
            circle.setAttribute('fill', node.color || '#3b82f6');
            circle.setAttribute('opacity', '0.8');
            g.appendChild(circle);

            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dy', '4');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '10');
            text.textContent = (node.label || '').substring(0, 8);
            g.appendChild(text);

            svg.appendChild(g);
        });
    },

    _layout: function (nodes, width, height) {
        // 简单的圆形布局
        var cx = width / 2;
        var cy = height / 2;
        var radius = Math.min(width, height) * 0.35;

        return nodes.map(function (node, i) {
            var angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            };
        });
    }
};
