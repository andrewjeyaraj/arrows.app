import {snapTolerance, snapToNeighbourDistancesAndAngles} from "./geometricSnapping";
import {Guides} from "../graphics/Guides";
import {idsMatch, nextAvailableId, nextId} from "../model/Id";
import {Point} from "../model/Point";
import {Vector} from "../model/Vector";
import {calculateBoundingBox} from "../graphics/utils/geometryUtils";
import {getPresentGraph, getVisualGraph} from "../selectors";
import {
  nodeSelected,
  selectedNodeIdMap, selectedNodeIds, selectedNodes,
  selectedRelationshipIdMap, selectedRelationshipIds
} from "../model/selection";
import {defaultNodeRadius, defaultRelationshipLength} from "../graphics/constants";
import BoundingBox from "../graphics/utils/BoundingBox";
import {translate} from "../model/Node";

export const createNode = () => (dispatch, getState) => {
  let newNodePosition = new Point(0, 0)
  const graph = getPresentGraph(getState())
  if (graph.nodes.length > 0) {
    const ranges = ['x', 'y'].map(dimension => {
      const coordinates = graph.nodes.map(node => node.position[dimension])
      const min = Math.min(...coordinates)
      const max = Math.max(...coordinates)
      const spread = max - min
      return {
        dimension,
        min,
        max,
        spread
      }
    }).sort((a, b) => b.spread - a.spread)
    newNodePosition[ranges[0].dimension] = ranges[0].min
    newNodePosition[ranges[1].dimension] = ranges[1].max + defaultRelationshipLength + defaultNodeRadius * 2
  }

  dispatch({
    category: 'GRAPH',
    type: 'CREATE_NODE',
    newNodeId: nextAvailableId(getPresentGraph(getState()).nodes),
    newNodePosition,
    caption: '',
    style: {}
  })
}

export const createNodeAndRelationship = (sourceNodeId, targetNodePosition) => (dispatch, getState) => {
  dispatch({
    category: 'GRAPH',
    type: 'CREATE_NODE_AND_RELATIONSHIP',
    sourceNodeId,
    newRelationshipId: nextAvailableId(getPresentGraph(getState()).relationships),
    targetNodeId: nextAvailableId(getPresentGraph(getState()).nodes),
    targetNodePosition,
    caption: '',
    style: {}
  })
}

export const connectNodes = (sourceNodeId, targetNodeId) => (dispatch, getState) => {
  dispatch({
    category: 'GRAPH',
    type: 'CONNECT_NODES',
    sourceNodeId,
    newRelationshipId: nextAvailableId(getPresentGraph(getState()).relationships),
    targetNodeId
  })
}

export const tryMoveHandle = ({corner, initialNodePositions, initialMousePosition, newMousePosition}) => {
  return function (dispatch, getState) {
    const { viewTransformation, mouse } = getState()

    const vector = newMousePosition.vectorFrom(initialMousePosition).scale(1 / viewTransformation.scale)
    const maxDiameter = Math.max(...initialNodePositions.map(entry => entry.radius)) * 2

    const dimensions = ['x', 'y']
    const ranges = {}

    const choose = (mode, min, max, other) => {
      switch (mode) {
        case 'min':
          return min
        case 'max':
          return max
        default:
          return other
      }
    }

    dimensions.forEach(dimension => {
      const coordinates = initialNodePositions.map(entry => entry.position[dimension])
      const min = Math.min(...coordinates)
      const max = Math.max(...coordinates)
      const oldSpread = max - min
      let newSpread = choose(
        corner[dimension],
        oldSpread - vector['d' + dimension],
        oldSpread + vector['d' + dimension],
        oldSpread
      )
      if (newSpread < 0) {
        if (newSpread < -maxDiameter) {
          newSpread += maxDiameter
        } else {
          newSpread = 0
        }
      }
      ranges[dimension] = {
        min,
        max,
        oldSpread,
        newSpread
      }
    })
    const snapRatios = [-1, 1]
    if (corner.x !== 'mid' && corner.y !== 'mid') {
      let ratio = Math.max(...dimensions.map(dimension => {
        const range = ranges[dimension]
        return range.newSpread / range.oldSpread;
      }))
      let smallestSpread = Math.min(...dimensions.map(dimension => ranges[dimension].oldSpread))
      snapRatios.forEach(snapRatio => {
        if (Math.abs(ratio - snapRatio) * smallestSpread < snapTolerance) {
          ratio = snapRatio
        }
      })
      dimensions.forEach(dimension => {
        const range = ranges[dimension]
        range.newSpread = range.oldSpread * ratio;
      })
    } else {
      dimensions.forEach(dimension => {
        const range = ranges[dimension]
        let ratio = range.newSpread / range.oldSpread
        snapRatios.forEach(snapRatio => {
          if (Math.abs(ratio - snapRatio) * range.oldSpread < snapTolerance) {
            ratio = snapRatio
          }
        })
        range.newSpread = range.oldSpread * ratio;
      })
    }

    const coordinate = (position, dimension) => {
      const original = position[dimension]
      const range = ranges[dimension]
      switch (corner[dimension]) {
        case 'min':
          return range.max - (range.max - original) * range.newSpread / range.oldSpread
        case 'max':
          return range.min + (original - range.min) * range.newSpread / range.oldSpread
        default:
          return original
      }
    }

    const nodePositions = initialNodePositions.map(entry => {
      return {
        nodeId: entry.nodeId,
        position: new Point(
          coordinate(entry.position, 'x'),
          coordinate(entry.position, 'y')
        )
      }
    })

    dispatch(moveNodes(initialMousePosition, newMousePosition || mouse.mousePosition, nodePositions, new Guides()))
  }
}

export const tryMoveNode = ({ nodeId, oldMousePosition, newMousePosition, forcedNodePosition }) => {
  return function (dispatch, getState) {
    const state = getState()
    const { viewTransformation, mouse } = state
    const visualGraph = getVisualGraph(state)
    const graph = visualGraph.graph
    const visualNode = visualGraph.nodes[nodeId]
    let naturalPosition
    const otherSelectedNodes = selectedNodeIds(state.selection).filter((selectedNodeId) => selectedNodeId !== nodeId)
    const activelyMovedNode = graph.nodes.find((node) => idsMatch(node.id, nodeId))

    if (forcedNodePosition) {
      naturalPosition = forcedNodePosition
    } else {
      const vector = newMousePosition.vectorFrom(oldMousePosition).scale(1 / viewTransformation.scale)
      let currentPosition = getState().guides.naturalPosition || activelyMovedNode.position

      naturalPosition = currentPosition.translate(vector)
    }

    let snaps = snapToNeighbourDistancesAndAngles(graph, nodeId, naturalPosition, otherSelectedNodes)
    let guides = new Guides()
    let newPosition = naturalPosition
    if (snaps.snapped) {
      guides = new Guides(snaps.guidelines, naturalPosition, visualNode.radius)
      newPosition = snaps.snappedPosition
    }
    const delta = newPosition.vectorFrom(activelyMovedNode.position)
    const nodePositions = [{
      nodeId,
      position: newPosition
    }]
    otherSelectedNodes.forEach((otherNodeId) => {
      nodePositions.push({
        nodeId: otherNodeId,
        position: graph.nodes.find((node) => idsMatch(node.id, otherNodeId)).position.translate(delta)
      })
    })

    dispatch(moveNodes(oldMousePosition, newMousePosition || mouse.mousePosition, nodePositions, guides))
  }
}

export const moveNodes = (oldMousePosition, newMousePosition, nodePositions, guides, autoGenerated) => {
  return {
    category: 'GRAPH',
    type: 'MOVE_NODES',
    oldMousePosition,
    newMousePosition,
    nodePositions,
    guides,
    autoGenerated
  }
}

export const moveNodesEndDrag = (nodePositions) => {
  return {
    category: 'GRAPH',
    type: 'MOVE_NODES_END_DRAG',
    nodePositions
  }
}

export const setNodeCaption = (selection, caption) => ({
  category: 'GRAPH',
  type: 'SET_NODE_CAPTION',
  selection,
  caption
})

export const addLabel = (selection, label) => ({
  category: 'GRAPH',
  type: 'ADD_LABEL',
  selection,
  label
})

export const addLabels = (nodeLabels) => ({
  category: 'GRAPH',
  type: 'ADD_LABELS',
  nodeLabels
})

export const renameLabel = (selection, oldLabel, newLabel) => ({
  category: 'GRAPH',
  type: 'RENAME_LABEL',
  selection,
  oldLabel,
  newLabel
})

export const removeLabel = (selection, label) => ({
  category: 'GRAPH',
  type: 'REMOVE_LABEL',
  selection,
  label
})

export const renameProperty = (selection, oldPropertyKey, newPropertyKey) => ({
  category: 'GRAPH',
  type: 'RENAME_PROPERTY',
  selection,
  oldPropertyKey,
  newPropertyKey
})

export const setProperty = (selection, key, value) => ({
  category: 'GRAPH',
  type: 'SET_PROPERTY',
  selection,
  key,
  value
})

export const setPropertyValues = (key, nodePropertyValues) => ({
  category: 'GRAPH',
  type: 'SET_PROPERTY_VALUES',
  key,
  nodePropertyValues
})

export const setArrowsProperty = (selection, key, value) => ({
  category: 'GRAPH',
  type: 'SET_ARROWS_PROPERTY',
  selection,
  key,
  value
})

export const removeProperty = (selection, key) => ({
  category: 'GRAPH',
  type: 'REMOVE_PROPERTY',
  selection,
  key
})

export const removeArrowsProperty = (selection, key) => ({
  category: 'GRAPH',
  type: 'REMOVE_ARROWS_PROPERTY',
  selection,
  key
})

export const setGraphStyle = (key, value) => ({
  category: 'GRAPH',
  type: 'SET_GRAPH_STYLE',
  key,
  value
})

export const setGraphStyles = (style) => ({
  category: 'GRAPH',
  type: 'SET_GRAPH_STYLES',
  style
})

export const setRelationshipType = (selection, relationshipType) => ({
  category: 'GRAPH',
  type: 'SET_RELATIONSHIP_TYPE',
  selection,
  relationshipType
})

export const duplicateNodesAndRelationships = (nodeIdMap, relationshipIdMap) => ({
  category: 'GRAPH',
  type: 'DUPLICATE_NODES_AND_RELATIONSHIPS',
  nodeIdMap,
  relationshipIdMap
})

export const deleteNodesAndRelationships = (nodeIdMap, relationshipIdMap) => ({
  category: 'GRAPH',
  type: 'DELETE_NODES_AND_RELATIONSHIPS',
  nodeIdMap,
  relationshipIdMap
})

export const deleteSelection = () => {
  return function (dispatch, getState) {
    const selection = getState().selection
    const relationships = getPresentGraph(getState()).relationships

    const nodeIdMap = selectedNodeIdMap(selection)
    const relationshipIdMap = selectedRelationshipIdMap(selection)

    relationships.forEach(relationship => {
      if (!relationshipIdMap[relationship.id] && (nodeIdMap[relationship.fromId] || nodeIdMap[relationship.toId])) {
        relationshipIdMap[relationship.id] = true
      }
    })

    dispatch(deleteNodesAndRelationships(nodeIdMap, relationshipIdMap))
  }
}

const duplicateNodeOffset = (graph, selectedNodes, actionMemos) => {
  const box = calculateBoundingBox(selectedNodes, graph, 1)
  const offset = new Vector(box.right - box.left, box.bottom - box.top)
  if (actionMemos.lastDuplicateAction) {
    const action = actionMemos.lastDuplicateAction
    const newNodeId = Object.keys(action.nodeIdMap)[0]
    if (newNodeId) {
      const oldNodeId = action.nodeIdMap[newNodeId].oldNodeId
      const oldNode = graph.nodes.find(n => idsMatch(n.id, oldNodeId))
      const newNode = graph.nodes.find(n => idsMatch(n.id, newNodeId))
      if (oldNode && newNode) {
        const translation = newNode.position.vectorFrom(oldNode.position)
        if (translation.dx > offset.dx || translation.dy > offset.dy) {
          return translation
        }
      }
    }
  }
  return offset
}

const inverseNodeMap = (actionMemos) => {
  if (actionMemos.lastDuplicateAction) {
    const action = actionMemos.lastDuplicateAction
    const map = {}
    for (const [newNodeId, nodeSpec] of Object.entries(action.nodeIdMap)) {
      map[nodeSpec.oldNodeId] = newNodeId
    }
    return map
  }
  return {}
}

export const duplicateSelection = () => {
  return function (dispatch, getState) {
    const state = getState()
    const selection = state.selection
    const graph = getPresentGraph(state)
    const actionMemos = state.actionMemos

    const nodesToDuplicate = selectedNodes(graph, selection)
    const nodeIdMap = {}
    const oldNodeToNewNodeMap = {}
    const relationshipsToBeDuplicated = {}

    if (nodesToDuplicate.length > 0) {
      const offset = duplicateNodeOffset(graph, nodesToDuplicate, actionMemos)

      let newNodeId = nextAvailableId(graph.nodes)
      nodesToDuplicate.forEach((oldNode) => {
        nodeIdMap[newNodeId] = {
          oldNodeId: oldNode.id,
          position: oldNode.position.translate(offset)
        }
        oldNodeToNewNodeMap[oldNode.id] = newNodeId
        newNodeId = nextId(newNodeId)
      })

      graph.relationships.forEach(relationship => {
        if (nodeSelected(selection, relationship.fromId) || nodeSelected(selection, relationship.toId)) {
          relationshipsToBeDuplicated[relationship.id] = true
        }
      })
    }

    selectedRelationshipIds(selection).forEach((relationshipId) => {
      relationshipsToBeDuplicated[relationshipId] = true
    })

    const previousNodeMap = inverseNodeMap(actionMemos)

    const relationshipIdMap = {}
    let newRelationshipId = nextAvailableId(graph.relationships)
    Object.keys(relationshipsToBeDuplicated).forEach((relationshipId) => {
      const oldRelationship = graph.relationships.find(r => idsMatch(relationshipId, r.id))
      relationshipIdMap[newRelationshipId] = {
        oldRelationshipId: relationshipId,
        relationshipType: oldRelationship.type,
        fromId: oldNodeToNewNodeMap[oldRelationship.fromId] || previousNodeMap[oldRelationship.fromId] || oldRelationship.fromId,
        toId: oldNodeToNewNodeMap[oldRelationship.toId] || previousNodeMap[oldRelationship.toId] || oldRelationship.toId
      }
      newRelationshipId = nextId(newRelationshipId)
    })

    dispatch(duplicateNodesAndRelationships(nodeIdMap, relationshipIdMap))
  }
}

export const reverseRelationships = selection => ({
  category: 'GRAPH',
  type: 'REVERSE_RELATIONSHIPS',
  selection
})

export const importNodesAndRelationships = (importedGraph) => {
  return function (dispatch, getState) {
    const state = getState()
    const graph = getPresentGraph(state)
    const visualGraph = getVisualGraph(state)
    const boundingBox = visualGraph.boundingBox() || new BoundingBox(0,0,0,0)
    const vector = new Vector(
      boundingBox.right + graph.style.radius * 1.5,
      boundingBox.top + graph.style.radius
    )

    const newNodes = []
    const newRelationships = []
    const nodeIdMap = {}

    let newNodeId = nextAvailableId(graph.nodes)
    importedGraph.nodes.forEach(oldNode => {
      nodeIdMap[oldNode.id] = newNodeId
      const newNode = {
        ...oldNode,
        id: newNodeId
      }
      newNodes.push(translate(newNode, vector))
      newNodeId = nextId(newNodeId)
    })

    let newRelationshipId = nextAvailableId(graph.relationships)
    importedGraph.relationships.forEach(oldRelationship => {
      const newRelationship = {
        ...oldRelationship,
        id: newRelationshipId,
        fromId: nodeIdMap[oldRelationship.fromId],
        toId: nodeIdMap[oldRelationship.toId]
      }
      newRelationships.push(newRelationship)
      newRelationshipId = nextId(newRelationshipId)
    })

    dispatch({
      category: 'GRAPH',
      type: 'IMPORT_NODES_AND_RELATIONSHIPS',
      nodes: newNodes,
      relationships: newRelationships,
    })
  }
}

export const convertCaptionsToLabels = () => {
  return function (dispatch, getState) {
    const state = getState()
    const selection = state.selection
    const graph = getPresentGraph(state)
    const nodesToConvert = selectedNodes(graph, selection)
    const nodeLabels = Object.fromEntries(nodesToConvert.map(node => {
      return [node.id, node.caption]
    }))
    dispatch(addLabels(nodeLabels))
    dispatch(setNodeCaption(selection, ''))
  }
}

export const convertCaptionsToPropertyValues = () => {
  return function (dispatch, getState) {
    const state = getState()
    const selection = state.selection
    const graph = getPresentGraph(state)
    const nodesToConvert = selectedNodes(graph, selection)
    const nodePropertyValues = Object.fromEntries(nodesToConvert.map(node => {
      return [node.id, node.caption]
    }))
    dispatch(setPropertyValues('', nodePropertyValues))
    dispatch(setNodeCaption(selection, ''))
  }
}