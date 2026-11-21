/** Any file made in the page (the sheet's PDF), saved under a name. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not at once: some browsers have not started the download yet.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
