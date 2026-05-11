import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfInvoiceService {
  private readonly logger = new Logger(PdfInvoiceService.name);

  async generateInvoice(data: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    customerName: string;
    customerEmail: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    const resultPromise = new Promise<Buffer>((resolve) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const currencySymbol = this.currencySymbol(data.currency);
    const fmt = (cents: number) => `${(cents / 100).toFixed(2)} ${currencySymbol}`;

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('FACTURA', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280');
    doc.text(`Nº ${data.invoiceNumber}`, 50);
    doc.text(`Fecha: ${data.invoiceDate}`, 50);
    doc.text(`Vencimiento: ${data.dueDate}`, 50);

    // Company info
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1f2937');
    doc.text('Ikiraisolutions', 300, 50, { width: 245, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#374151');
    doc.text('CIF: ES-00000000X', { width: 245, align: 'right' });
    doc.text('Calle Ejemplo 123', { width: 245, align: 'right' });
    doc.text('08001 Barcelona, España', { width: 245, align: 'right' });

    // Line
    const lineY = doc.y + 15;
    doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor('#e5e7eb').stroke();

    // Customer
    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#9ca3af').text('FACTURAR A:', 50);
    doc.fontSize(11).font('Helvetica').fillColor('#1f2937').text(data.customerName, 50);
    doc.fontSize(9).fillColor('#6b7280').text(data.customerEmail, 50);

    // Table header
    const tableTop = doc.y + 20;
    const colX = { desc: 50, qty: 330, price: 390, amount: 470 };
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151');
    doc.text('Concepto', colX.desc, tableTop);
    doc.text('Cant.', colX.qty, tableTop, { width: 40, align: 'center' });
    doc.text('Precio', colX.price, tableTop, { width: 70, align: 'right' });
    doc.text('Importe', colX.amount, tableTop, { width: 80, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#e5e7eb').stroke();

    // Table rows
    let rowY = tableTop + 22;
    doc.fontSize(9).font('Helvetica').fillColor('#4b5563');
    for (const item of data.items) {
      doc.text(item.description, colX.desc, rowY, { width: 260 });
      doc.text(item.quantity.toString(), colX.qty, rowY, { width: 40, align: 'center' });
      doc.text(fmt(item.unitPrice), colX.price, rowY, { width: 70, align: 'right' });
      doc.text(fmt(item.amount), colX.amount, rowY, { width: 80, align: 'right' });
      rowY += 18;
    }

    // Bottom line
    doc.moveTo(50, rowY + 5).lineTo(545, rowY + 5).strokeColor('#e5e7eb').stroke();

    // Totals
    rowY += 20;
    doc.fontSize(9).fillColor('#374151');
    doc.text('Subtotal:', 400, rowY, { width: 60, align: 'right' });
    doc.text(fmt(data.subtotal), 470, rowY, { width: 80, align: 'right' });
    rowY += 16;
    doc.text('IVA (0%):', 400, rowY, { width: 60, align: 'right' });
    doc.text(fmt(data.tax), 470, rowY, { width: 80, align: 'right' });
    rowY += 20;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1f2937');
    doc.text('TOTAL:', 400, rowY, { width: 60, align: 'right' });
    doc.text(fmt(data.total), 470, rowY, { width: 80, align: 'right' });

    // Footer
    doc.fontSize(9).font('Helvetica').fillColor('#9ca3af');
    doc.text('Gracias por tu confianza.', 50, doc.page.height - 70, {
      align: 'center',
      width: 495,
    });

    doc.end();
    return await resultPromise;
  }

  private currencySymbol(currency: string): string {
    const map: Record<string, string> = { eur: '€', usd: '$', gbp: '£' };
    return map[currency?.toLowerCase()] ?? currency?.toUpperCase();
  }
}
