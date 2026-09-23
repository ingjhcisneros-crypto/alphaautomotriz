/* Solo para el artefacto publicado: el visor de claude.ai no permite imprimir, así que los PDF se dibujan con
   html2canvas y se arman con jsPDF. Se empaqueta aparte e incluye únicamente en la variante artefacto. */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
globalThis.__PDFVISOR__ = { html2canvas, jsPDF };
