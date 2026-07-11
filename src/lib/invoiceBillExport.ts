import { Alert, Platform } from 'react-native';
import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type { InvoiceLineItem, ResidentInvoice } from '../api/billing';
import {
  buildInvoiceBillHtml,
  buildInvoiceShareMessage,
  invoicePdfFileName,
} from './invoiceBillDocument';

function shareFileUrl(filePath: string) {
  if (filePath.startsWith('file://')) return filePath;
  return `file://${filePath}`;
}

export async function generateInvoicePdf(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): Promise<string> {
  const html = buildInvoiceBillHtml(invoice, items);
  const fileName = invoicePdfFileName(invoice).replace(/\.pdf$/i, '');

  const result = await generatePDF({
    html,
    fileName,
    directory: Platform.OS === 'ios' ? 'Documents' : 'Downloads',
    base64: false,
    shouldPrintBackgrounds: true,
  });

  if (!result?.filePath) {
    throw new Error('PDF generation failed');
  }

  return result.filePath;
}

export async function shareInvoiceBill(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): Promise<void> {
  try {
    const pdfPath = await generateInvoicePdf(invoice, items);
    const fileName = invoicePdfFileName(invoice);

    await Share.open({
      title: 'Share bill',
      message: buildInvoiceShareMessage(invoice, items),
      url: shareFileUrl(pdfPath),
      type: 'application/pdf',
      filename: fileName,
      failOnCancel: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/user did not share|cancel/i.test(message)) return;

    await Share.open({
      title: 'Share bill',
      message: buildInvoiceShareMessage(invoice, items),
      failOnCancel: false,
    });
  }
}

export async function downloadInvoiceBill(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): Promise<string> {
  const pdfPath = await generateInvoicePdf(invoice, items);
  const fileName = invoicePdfFileName(invoice);
  const sourcePath = pdfPath.replace(/^file:\/\//, '');

  if (Platform.OS === 'android') {
    const destPath = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${fileName}`;
    await ReactNativeBlobUtil.fs.cp(sourcePath, destPath);

    try {
      await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
        {
          name: fileName,
          parentFolder: 'ApnaSmartGate',
          mimeType: 'application/pdf',
        },
        'Download',
        sourcePath,
      );
    } catch {
      // File may still be available under DownloadDir
    }

    return destPath;
  }

  const destPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${fileName}`;
  const exists = await ReactNativeBlobUtil.fs.exists(destPath);
  if (exists) await ReactNativeBlobUtil.fs.unlink(destPath);
  await ReactNativeBlobUtil.fs.cp(sourcePath, destPath);
  return destPath;
}

export async function downloadInvoiceBillWithAlert(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): Promise<void> {
  await downloadInvoiceBill(invoice, items);
  const fileName = invoicePdfFileName(invoice);
  const folderHint =
    Platform.OS === 'android' ? 'Downloads (ApnaSmartGate)' : 'Documents';

  Alert.alert('Bill saved', `${fileName} saved to ${folderHint}.`, [{ text: 'OK' }]);
}
