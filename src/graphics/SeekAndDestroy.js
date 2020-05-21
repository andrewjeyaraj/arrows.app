import {normaliseAngle} from "./utils/angles";
import {Vector} from "../model/Vector";
import {getDistanceToLine} from "./utils/geometryUtils";

export class SeekAndDestroy {
  constructor(start, startDirection, end, endDirection) {
    this.waypoints = []
    this.start = start
    this.position = start
    this.direction = startDirection
    this.end = end
    this.endDirection = endDirection
  }

  forwardToWaypoint(distance, turn, radius) {
    this.position = this.position.translate(new Vector(distance, 0).rotate(this.direction))
    this.direction = normaliseAngle(this.direction + turn)
    this.waypoints.push({point: this.position, distance, turn, radius })
  }

  get endRelative() {
    return this.end.translate(this.position.vectorFromOrigin().invert()).rotate(-this.direction)
  }

  get endDirectionRelative() {
    return normaliseAngle(this.endDirection - this.direction)
  }

  segment(i) {
    const from = i === 0 ? this.start : this.waypoints[i - 1].point
    const to = i < this.waypoints.length ? this.waypoints[i].point : this.end
    return { from, to }
  }

  nextPoint(i) {
    if (i + 1 < this.waypoints.length) {
      const waypoint = this.waypoints[i]
      const nextWaypoint = this.waypoints[i + 1].point
      const nextVector = nextWaypoint.vectorFrom(waypoint.point)
      return waypoint.point.translate(nextVector.scale(0.5))
    }
    return this.end
  }

  draw(ctx) {
    ctx.moveTo(...this.start.xy)
    let previous = this.start
    for (let i = 0; i < this.waypoints.length; i++) {
      const waypoint = this.waypoints[i]
      const next = this.nextPoint(i)
      let control = waypoint.point
      const vector1 = previous.vectorFrom(control)
      const vector2 = next.vectorFrom(control)
      if (vector1.distance() < waypoint.radius) {
        const overlap = waypoint.radius - vector1.distance()
        control = control.translate(vector2.scale(overlap / vector2.distance()))
      }
      if (vector2.distance() < waypoint.radius) {
        const overlap = waypoint.radius - vector2.distance()
        control = control.translate(vector1.scale(overlap / vector1.distance()))
      }

      ctx.arcTo(...control.xy, ...next.xy, waypoint.radius)
      previous = next
    }
    ctx.lineTo(...this.end.xy)
  }

  distanceFrom(point) {
    let minDistance = Infinity
    for (let i = 0; i < this.waypoints.length + 1; i++) {
      const segment = this.segment(i)
      const distance = getDistanceToLine(...segment.from.xy, ...segment.to.xy, ...point.xy)
      minDistance = Math.min(distance, minDistance)
    }
    return minDistance
  }
}

export const compareWaypoints = (a, b) => {
  if (a.length === 0 && b.length === 0) return 0

  if (a.length === 0) return Math.sign(b[0].angle)

  if (b.length === 0) return -Math.sign(a[0].angle)

  const aFirstWaypoint = a[0]
  const bFirstWaypoint = b[0]

  if (aFirstWaypoint.turn !== bFirstWaypoint.turn) {
    return Math.sign(aFirstWaypoint.turn - bFirstWaypoint.turn)
  }

  if (aFirstWaypoint.distance !== bFirstWaypoint.distance) {
    return Math.sign(bFirstWaypoint.distance - aFirstWaypoint.distance)
  }

  return compareWaypoints(a.slice(1), b.slice(1))
}