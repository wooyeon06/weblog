import { TableBlock } from './TableBlock';
import './TableBlock.scss';
import { TableProvider, type TableBlockProps } from './TableContextProvider';


export function TableBlockWrapper(props: TableBlockProps) {
  return (
    <TableProvider {...props}>
      <TableBlock/>
    </TableProvider>
  )
}

