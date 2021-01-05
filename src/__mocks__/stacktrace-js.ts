export function get(): Promise<unknown> {
  return Promise.resolve([
    {
      fileName: '',
      lineNumber: -1,
      columnNumber: -1,
    },
    {
      fileName: '',
      lineNumber: -1,
      columnNumber: -1,
    },
  ]);
}
