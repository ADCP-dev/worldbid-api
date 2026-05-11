import {
  Controller,
  Get,
  Param,
  UseGuards,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { StripeService } from '@ext/stripe/services/stripe.service';
import { PdfInvoiceService } from '@ext/stripe/services/pdf-invoice.service';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@ApiTags('Stripe')
@Controller({
  path: 'stripe/invoices',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly pdfInvoiceService: PdfInvoiceService,
  ) {}

  @Get()
  @ApiBearerAuth()
  async listInvoices(@UserId() userId: number) {
    try {
      return await this.stripeService.listInvoices(userId);
    } catch (error: any) {
      this.logger.error(`Error listing invoices: ${error.message}`);
      return [];
    }
  }

  @Get(':id/pdf')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  async downloadInvoice(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    try {
      const invoice = await this.stripeService.getInvoice(id);
      if (!invoice) {
        res.status(404).json({ message: 'Invoice not found' });
        return;
      }

      const currency = invoice.currency ?? 'eur';
      const total = invoice.total;
      const subtotal = invoice.subtotal;
      const tax = ((invoice as any).total_tax_amounts?.reduce((sum: number, t: any) => sum + t.amount, 0)) ?? 0;

      const items = (invoice.lines?.data ?? []).map((line: any) => ({
        description: line.description ?? line.price?.nickname ?? 'Servicio',
        quantity: line.quantity ?? 1,
        unitPrice: line.price?.unit_amount ?? line.amount,
        amount: line.amount,
      }));

      if (!items.length) {
        items.push({
          description: invoice.billing_reason ?? 'Suscripción',
          quantity: 1,
          unitPrice: total,
          amount: total,
        });
      }

      const pdf = await this.pdfInvoiceService.generateInvoice({
        invoiceNumber: invoice.number ?? id,
        invoiceDate: new Date(invoice.created * 1000).toLocaleDateString('es-ES'),
        dueDate: invoice.due_date
          ? new Date(invoice.due_date * 1000).toLocaleDateString('es-ES')
          : '—',
        customerName: invoice.customer_name ?? invoice.customer_email ?? 'Cliente',
        customerEmail: invoice.customer_email ?? '',
        items,
        subtotal,
        tax,
        total,
        currency,
        status: invoice.status ?? 'paid',
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${invoice.number ?? id}.pdf"`,
      });
      res.send(pdf);
    } catch (error: any) {
      this.logger.error(`Error generating invoice PDF: ${error.message}`);
      res.status(500).json({ message: 'Error generating invoice' });
    }
  }
}
