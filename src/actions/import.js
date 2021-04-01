import {importNodesAndRelationships} from "./graph";
import {Point} from "../model/Point";
import {getPresentGraph} from "../selectors";
import {constructGraphFromFile} from "../storage/googleDriveStorage";
import {translate} from "../model/Node";
import {Vector} from "../model/Vector";

export const handlePaste = (pasteEvent) => {
  return function (dispatch, getState) {
    const state = getState()
    const graph = getPresentGraph(state)

    const clipboardData = pasteEvent.clipboardData
    const textPlainMimeType = 'text/plain'
    if (clipboardData.types.includes(textPlainMimeType)) {
      const text = clipboardData.getData(textPlainMimeType)
      const format = formats.find(format => format.recognise(text))
      if (format) {
        try {
          const importedGraph = format.parse(text, graph)
          dispatch(importNodesAndRelationships(importedGraph))
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
}

const formats = [
  {
    // JSON
    recognise: (plainText) => new RegExp('^{.*\}$', 's').test(plainText.trim()),
    parse: (plainText) => {
      const object = JSON.parse(plainText)
      const graphData = constructGraphFromFile(object)
      const { nodes, relationships } = graphData.graph
      const left = Math.min(...nodes.map(node => node.position.x))
      const top = Math.min(...nodes.map(node => node.position.y))
      const vector = new Vector(-left, -top)
      const originNodes = nodes.map(node => translate(node, vector))
      return {
        nodes: originNodes, relationships
      }
    }
  },
  {
    // plain text
    recognise: () => true,
    parse: (plainText, graph) => {
      const lines = plainText.split('\n').filter(line => line && line.trim().length > 0)

      const nodes = lines.map((line, i) => {
        return {
          id: 'n' + i,
          position: new Point(0, 2.5 * graph.style.radius * i),
          caption: line,
          style: {},
          labels: [],
          properties: {}
        }
      })
      return {
        nodes,
        relationships: []
      }
    }
  }
]