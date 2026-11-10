/**
 * Abre o dialogo de impressao (que tambem salva em PDF) com um titulo de arquivo
 * descritivo, restaurando o titulo da pagina depois.
 */
export function openPrintDialog(filename: string): void {
  const previous = document.title;
  const base = filename.replace(/\.[^.]+$/, "");
  document.title = `Relatorio-DataGuard-${base}`;

  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
