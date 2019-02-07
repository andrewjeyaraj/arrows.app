import { isPointInPolygon } from "../graphics/utils/geometryUtils";
import { getStyleSelector } from "../selectors/style";
import {indexablePropertyText} from "./properties";
import {completeWithDefaults} from "./styling";

const ringLength =  10

export const emptyGraph = () => {
  return {
    nodes: [],
    relationships: [],
    style: completeWithDefaults({})
  }
}

export const getNodeIdMap = graph => graph.nodes.reduce((nodeIdMap, node) => {
  nodeIdMap[node.id] = node
  return nodeIdMap
}, {})

export const closestNode = (graph, point, nodeTest) => {
  let closestDistance = Number.POSITIVE_INFINITY
  let closestNode = null
  graph.nodes.filter(node => node.status !== 'combined').forEach((node) => {
    const distance = node.position.vectorFrom(point).distance()
    if (distance < closestDistance && nodeTest(node, distance)) {
      closestDistance = distance
      closestNode = node
    }
  })
  return closestNode
}

export const nodeAtPoint = (graph, point) => {
  return closestNode(graph, point, (node, distance) => distance < getStyleSelector(node, 'radius')(graph))
}

export const nodeRingAtPoint = (graph, point) => {
  return closestNode(graph, point, (node, distance) => {
    const nodeRadius = getStyleSelector(node, 'radius')(graph)
    return distance > nodeRadius && distance < nodeRadius + ringLength
  })
}

export const nodesInsidePolygon = (graph, path) => graph.nodes
  .filter(node => node.status !== 'combined' && isPointInPolygon(node.position, path))
  .map(node => node.id)

export const indexableText = (graph) => {
  const lines = []
  graph.nodes.forEach(node => {
    lines.push(node.caption)
    lines.push(...indexablePropertyText(node))
  })
  graph.relationships.forEach(relationship => {
    lines.push(relationship.type)
    lines.push(...indexablePropertyText(relationship))
  })

  const text = lines.join('\n')
  // size limit is 128K according to https://developers.google.com/drive/api/v3/file
  return text.substr(0, 128000)
}