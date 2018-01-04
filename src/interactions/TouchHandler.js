import DragStateMachine, {StateDragging} from './DragStateMachine'
import {Point} from "../model/Point";

export default class TouchHandler {
  constructor(canvas, nodeFinder) {
    this.canvas = canvas
    this.nodeFinder = nodeFinder;

    this._registerTouchEvents()

    this._dragMachine = new DragStateMachine()
    this._hasDragged = false
    this._mouseDownItem = null
    this._mouseDownOnCanvas = false
    this.itemBeingDragged = {
      id: 0,
      pinned: true
    }
  }

  _registerTouchEvents () {
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this))
  }

  handleClick (evt) {
    const item = this.nodeFinder.getNodeAtPoint(this.eventPosition(evt))
    if (!this._hasDragged) {
      if (item) {
        this.callbacks.nodeClicked(item)
      } else {
        this.callbacks.canvasClicked()
      }
    }
    evt.preventDefault()
  }

  handleDoubleClick (evt) {
    const item = this.nodeFinder.getNodeAtPoint(this.eventPosition(evt))
    if (item) {
      this.callbacks.nodeDoubleClicked()
    }
    evt.preventDefault()
  }

  _toLayoutCoord (value) {
    let devicePixelRatio = window.devicePixelRatio || 1
    return value * devicePixelRatio / this.viewTransformation.scale
  }

  handleMouseMove (evt) {
    if (evt.button !== 0) {
      return
    }

    if (this._mouseDownItem) {
      let prevState = this._dragMachine.state
      this._dragMachine.update(evt)
      if (this._dragMachine.state === StateDragging) {
        const newPosition = this.itemBeingDragged.position.translate(this._dragMachine.delta)
        this.callbacks.nodeDragged(this.itemBeingDragged, newPosition)
      }
    } else if (this._mouseDownOnCanvas) {
      this._dragMachine.update(evt)
      if (this._dragMachine.state === StateDragging) {
        this.callbacks.pan(this.viewTransformation.offset.plus(this._dragMachine.delta))
      }
    }

    this._hasDragged = this._dragMachine.state === StateDragging

    evt.preventDefault()
  }

  handleMouseDown (evt) {
    if (evt.button !== 0) {
      return
    }

    const item = this.nodeFinder.getNodeAtPoint(this.eventPosition(evt))
    if (item) {
      // Do not drag or select until figure out users' intention
      this._mouseDownItem = item
      this.itemBeingDragged = item
    } else {
      this._mouseDownOnCanvas = true
    }
    this._hasDragged = false

    this._dragMachine.update(evt)

    evt.preventDefault()
  }

  handleMouseUp (evt) {
    if (evt.button !== 0) {
      return
    }
    this.endMouseEvents()
    evt.preventDefault()
  }

  handleMouseLeave (evt) {
    this.endMouseEvents()
    evt.preventDefault()
  }

  endMouseEvents () {
    this._mouseDownItem = null
    this._mouseDownOnCanvas = false
    this._dragMachine.reset()
  }

  eventPosition(event) {
    let rect = this.canvas.getBoundingClientRect()
    let canvasPosition = new Point(
      event.clientX - rect.left,
      event.clientY - rect.top
    )

    return this.viewTransformation.inverse(canvasPosition)
  }
}

