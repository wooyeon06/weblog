import './PostView.scss'

import { Fragment } from 'react'
import type { Block, TableData } from '../../types'
import { numberedIndex } from '../../lib/blocks'
import { isCoveredCell, normalizeTable, spanOf } from '../../lib/table'
import { RichText } from '../editor/rich/RichText'

/** 셀 안의 줄바꿈을 <br> 로 렌더링한다. */
function CellText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          <RichText text={line} />
        </Fragment>
      ))}
    </>
  )
}

function TableView({ table }: { table?: TableData }) {
  const data = normalizeTable(table)
  const { columns, rows, headerRow, headerColumn } = data

  // 병합 셀이 머리글 행과 본문에 걸칠 수 있으므로 thead/tbody 로 나누지 않고 한 tbody 에 그린다.
  return (
    <div className="post-view__table-wrap">
      <table className="post-view__table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id}>
              {row.cells.map((cell, c) => {
                if (isCoveredCell(data, r, c)) return null
                const { rowSpan, colSpan } = spanOf(data, r, c)
                const span = { rowSpan: rowSpan > 1 ? rowSpan : undefined, colSpan: colSpan > 1 ? colSpan : undefined }
                if (headerRow && r === 0) {
                  return (
                    <th key={columns[c].id} scope="col" {...span}>
                      <CellText text={cell} />
                    </th>
                  )
                }
                if (headerColumn && c === 0) {
                  return (
                    <th key={columns[c].id} scope="row" {...span}>
                      <CellText text={cell} />
                    </th>
                  )
                }
                return (
                  <td key={columns[c].id} {...span}>
                    <CellText text={cell} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 읽기 모드 렌더러. 에디터의 블록 배열을 그대로 화면에 표시한다. */
export function PostView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="post-view">
      {blocks.map((block, index) => {
        const style = { marginLeft: block.indent * 24 }
        switch (block.type) {
          case 'h1':
            return (
              <h1 key={block.id} style={style}>
                <RichText text={block.text} />
              </h1>
            )
          case 'h2':
            return (
              <h2 key={block.id} style={style}>
                <RichText text={block.text} />
              </h2>
            )
          case 'h3':
            return (
              <h3 key={block.id} style={style}>
                <RichText text={block.text} />
              </h3>
            )
          case 'quote':
            return (
              <blockquote key={block.id} style={style}>
                <RichText text={block.text} />
              </blockquote>
            )
          case 'code':
            return (
              <pre key={block.id} style={style}>
                <code>{block.text}</code>
              </pre>
            )
          case 'divider':
            return <hr key={block.id} />
          case 'table':
            return (
              <div key={block.id} style={style}>
                <TableView table={block.table} />
              </div>
            )
          case 'image':
            return (
              <div className="post-view__image-wrap" key={block.id} style={style}>
                <img className="post-view__image" src={block.text} alt="" />
              </div>
            )
          case 'bulleted':
            return (
              <div className="post-view__li" key={block.id} style={style}>
                <span className="post-view__marker">•</span>
                <span>
                  <RichText text={block.text} />
                </span>
              </div>
            )
          case 'numbered':
            return (
              <div className="post-view__li" key={block.id} style={style}>
                <span className="post-view__marker">{numberedIndex(blocks, index)}.</span>
                <span>
                  <RichText text={block.text} />
                </span>
              </div>
            )
          case 'todo':
            return (
              <div className="post-view__li" key={block.id} style={style}>
                <span className="post-view__marker">{block.checked ? '☑' : '☐'}</span>
                <span className={block.checked ? 'post-view__done' : undefined}>
                  <RichText text={block.text} />
                </span>
              </div>
            )
          default:
            return block.text ? (
              <p key={block.id} style={style}>
                <RichText text={block.text} />
              </p>
            ) : (
              <p key={block.id} className="post-view__spacer" />
            )
        }
      })}
    </div>
  )
}
