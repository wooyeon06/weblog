import './TableBlock.scss';
import { TableBlockImpl } from './TableBlockImpl';
import { TableProvider, type TableBlockProps } from './TableContextProvider';


export function TableBlock(props: TableBlockProps) {
  return (
    <TableProvider {...props}>
      <TableBlockImpl/>
    </TableProvider>
  )
}

