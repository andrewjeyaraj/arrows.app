import React, {Component} from 'react'
import { Form, Table } from 'semantic-ui-react'
import {StyleRow} from "./StyleRow";

export default class StyleTable extends Component {
  constructor (props) {
    super(props)
    this.focusHandlers = []
  }

  render() {
    const { title, style, graphStyle, possibleStyleAttributes, onSaveStyle, onDeleteStyle } = this.props

    const existingStyleAttributes = Object.keys(style)

    const rows = []

    const onNextProperty = (nextIndex) => {
      if (nextIndex < existingStyleAttributes.length) {
        this.focusHandlers[nextIndex]()
      }
    }

    possibleStyleAttributes.sort().forEach((styleKey, index) => {
      const specialised = style.hasOwnProperty(styleKey)
      const styleValue = (specialised && style[styleKey].status === 'CONSISTENT') ?  style[styleKey].value : graphStyle[styleKey]
      rows.push((
          <StyleRow
            key={styleKey}
            styleKey={styleKey}
            specialised={specialised}
            styleValue={styleValue}
            onValueChange={value => onSaveStyle(styleKey, value)}
            onDeleteStyle={() => onDeleteStyle(styleKey)}
            setFocusHandler={action => this.focusHandlers[index] = action}
            onNext={() => onNextProperty(index + 1)}
          />
        )
      )
    })

    return (
      <Form.Field key='styleTable'>
        <label>{title}</label>
        <Table compact collapsing style={{marginTop: 0}}>
          <Table.Body>
            {rows}
          </Table.Body>
        </Table>
      </Form.Field>
    )
  }
}