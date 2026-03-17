// 多層表頭欄位索引解析
// 適用於含 colspan / rowspan 的複雜表頭，不可直接硬編碼欄位索引

function detectColumnIndices(table, targetHeaders) {
  const result = {};
  const grid = [];
  const headerRows = Array.from(table.querySelectorAll('thead tr, tr:has(th)')).slice(0, 3);

  headerRows.forEach((tr, rowIdx) => {
    if (!grid[rowIdx]) grid[rowIdx] = [];
    let colIdx = 0;
    Array.from(tr.children).forEach(cell => {
      while (grid[rowIdx][colIdx]) colIdx++;
      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
      const text = cell.textContent.trim();
      for (let r = 0; r < rowspan; r++) {
        if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
        for (let c = 0; c < colspan; c++) grid[rowIdx + r][colIdx + c] = text;
      }
      if (targetHeaders.includes(text)) result[text] = colIdx;
      colIdx += colspan;
    });
  });
  return result;
}

// 使用範例（帶 fallback 索引，防止頁面結構改變）：
// const colIndices = detectColumnIndices(table, ['Name', 'Status', 'Image']);
// const nameCol = colIndices['Name'] ?? 0;
// const statusCol = colIndices['Status'] ?? 2;
