import { useEffect, useRef, memo } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'

const CHARGE       = -180
const LINK_DIST    = 80
const COLLIDE_R    = 18
const NODE_R       = 6
const ORPHAN_R     = 5
const ALPHA_DECAY  = 0.03
const TICK_MAX     = 300
const LABEL_MAX    = 22

function GraphView({ data, onNodeClick }) {
  const svgRef = useRef(null)
  const onNodeClickRef = useRef(onNodeClick)

  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])

  useEffect(() => {
    const el = svgRef.current
    if (!el || !data || data.nodes.length === 0) return
    const width  = el.clientWidth  || 600
    const height = el.clientHeight || 360

    const svg = select(el)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const zoomBehavior = zoom()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoomBehavior)
    svg.on('dblclick.zoom', null)

    const nodes = data.nodes.map(n => ({ ...n }))
    const idToIdx = new Map(nodes.map((n, i) => [n.id, i]))
    const links = data.edges
      .filter(e => idToIdx.has(e.source) && idToIdx.has(e.target))
      .map(e => ({ source: idToIdx.get(e.source), target: idToIdx.get(e.target) }))

    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth || 0), 0)
    const xPad = 60
    const colWidth = maxDepth > 0 ? (width - xPad * 2) / maxDepth : 0

    const sim = forceSimulation(nodes)
      .force('link',    forceLink(links).id((_, i) => i).distance(LINK_DIST))
      .force('charge',  forceManyBody().strength(CHARGE))
      .force('x',       forceX(d => xPad + (d.depth || 0) * colWidth).strength(0.35))
      .force('y',       forceY(height / 2).strength(0.08))
      .force('collide', forceCollide(COLLIDE_R))
      .alphaDecay(ALPHA_DECAY)
      .stop()

    const tickCount = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()))
    const totalTicks = Math.min(tickCount, TICK_MAX)
    for (let i = 0; i < totalTicks; i++) sim.tick()

    g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6)

    const nodeG = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => { const cb = onNodeClickRef.current; if (cb) cb(d.id) })

    nodeG.append('circle')
      .attr('r', d => d.isOrphan ? ORPHAN_R : NODE_R)
      .attr('fill', d => d.isOrphan ? 'var(--muted)' : 'var(--accent)')
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'var(--surface)')
      .attr('stroke-width', 1.5)

    nodeG.append('title').text(d => d.label)

    nodeG.append('text')
      .text(d => d.label.length > LABEL_MAX ? d.label.slice(0, LABEL_MAX - 1) + '…' : d.label)
      .attr('x', d => (d.isOrphan ? ORPHAN_R : NODE_R) + 4)
      .attr('y', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', 'var(--muted)')
      .attr('pointer-events', 'none')

    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    const y0 = Math.min(...ys), y1 = Math.max(...ys)
    const pad = 40
    const dx = x1 - x0 || 1
    const dy = y1 - y0 || 1
    const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy, 1.5)
    const tx = (width  - (x0 + x1) * scale) / 2
    const ty = (height - (y0 + y1) * scale) / 2
    svg.call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale))

    return () => { sim.stop(); svg.on('.zoom', null) }
  }, [data])

  if (!data || data.nodes.length === 0) return null

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'transparent' }}
    />
  )
}

export default memo(GraphView)
