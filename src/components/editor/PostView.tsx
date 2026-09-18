import './PostView.scss'

import { Fragment } from 'react'
import type { Block, TableData } from '../../types'
import { numberedIndex } from '../../lib/blocks'
import { normalizeTable } from '../../lib/table'
import { RichText } from '../RichText'

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
  const { columns, rows, headerRow, headerColumn } = normalizeTable(table)
  const head = headerRow ? rows[0] : null
  const body = headerRow ? rows.slice(1) : rows

  return (
    <div className="post-view__table-wrap">
      <table className="post-view__table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        {head && (
          <thead>
            <tr>
              {head.cells.map((cell, c) => (
                <th key={columns[c].id} scope="col">
                  <CellText text={cell} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, c) =>
                headerColumn && c === 0 ? (
                  <th key={columns[c].id} scope="row">
                    <CellText text={cell} />
                  </th>
                ) : (
                  <td key={columns[c].id}>
                    <CellText text={cell} />
                  </td>
                ),
              )}
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
