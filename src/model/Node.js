export const moveTo = (node, newPosition) => {
  return {
    id: node.id,
    position: newPosition,
    radius: node.radius,
    caption: node.caption,
    color: node.color,
    properties: node.properties
  }
}

export const updateProperties = (node, properties) => {
  return {
    id: node.id,
    position: node.position,
    radius: node.radius,
    caption: node.caption,
    color: node.color,
    properties: properties
  }
}
