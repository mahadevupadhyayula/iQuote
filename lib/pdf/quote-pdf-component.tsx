import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/pdf/quote-document";
import { styles } from "@/lib/pdf/quote-pdf-styles";
import type { QuotePdfDocument } from "@/lib/pdf/quote-pdf-types";

const value = (text: string | null | undefined) => text && text.length > 0 ? text : "Not specified";
const address = (lines: string[]) => lines.length > 0 ? lines.map((line) => <Text key={line}>{line}</Text>) : <Text>Not specified</Text>;

const Footer = ({ document }: { document: QuotePdfDocument }) => (
  <View style={styles.footer} fixed>
    <Text>{document.company.legalName} | {document.company.email} | {document.company.phone}</Text>
    <Text render={({ pageNumber, totalPages }) => `Quote ${document.quote.quoteNumber} | ${document.quote.revisionNumber} | Page ${pageNumber} of ${totalPages}`} />
    <Text>{document.confidentialityNotice}</Text>
  </View>
);

const Header = ({ document }: { document: QuotePdfDocument }) => (
  <View style={styles.header} fixed>
    <View style={styles.brandRow}>
      <Text style={styles.logo}>iQ</Text>
      <View>
        <Text style={styles.brandName}>{document.company.tradingName} Industrial Solutions</Text>
        <Text style={styles.legal}>{document.company.legalName}</Text>
        <Text style={styles.small}>{document.company.addressLines.join(" | ")}</Text>
      </View>
    </View>
    <View>
      <Text style={styles.quoteTitle}>QUOTE</Text>
      <Text style={[styles.meta, styles.strong]}>{document.quote.quoteNumber}</Text>
      <Text style={styles.meta}>{document.quote.revisionNumber}</Text>
      <Text style={styles.meta}>Issued: {formatDate(document.issuedOn)}</Text>
      <Text style={styles.meta}>Valid until: {formatDate(document.validUntil)}</Text>
      {document.quote.partialQuote ? <Text style={styles.badge}>PARTIAL QUOTE</Text> : null}
    </View>
  </View>
);

const ProductHeader = () => (
  <View style={styles.tableHeader} fixed>
    <Text style={styles.productCol}>Product</Text>
    <Text style={styles.qtyCol}>Qty</Text>
    <Text style={styles.moneyCol}>Unit price</Text>
    <Text style={styles.discountCol}>Discount</Text>
    <Text style={styles.moneyCol}>Net amount</Text>
  </View>
);

export function QuoteDocument({ document }: { document: QuotePdfDocument }) {
  const differentShipping = document.customer.shippingAddressLines.join("|") !== document.customer.billingAddressLines.join("|");
  return (
    <Document title={`${document.title} ${document.quote.revisionNumber}`} author={document.company.legalName} subject="Customer quote">
      <Page size="LETTER" style={styles.page} wrap>
        <Header document={document} />
        <Footer document={document} />

        {document.quote.partialQuote ? (
          <View style={styles.card} wrap={false}>
            <Text style={styles.strong}>{document.unavailableLines.length} of {document.quotedLines.length + document.unavailableLines.length} requested products {document.unavailableLines.length === 1 ? "is" : "are"} not included in this quote.</Text>
          </View>
        ) : null}

        <View style={styles.columns}>
          <View style={styles.card}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={styles.strong}>{value(document.customer.legalName ?? document.customer.name)}</Text>
            {address(document.customer.billingAddressLines)}
            <Text>{value(document.customer.email)}</Text>
            <Text>{value(document.customer.phone)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Prepared by</Text>
            <Text style={styles.strong}>{document.preparedBy.name}</Text>
            <Text>{document.preparedBy.title}</Text>
            <Text>{document.preparedBy.email}</Text>
            <Text>{document.preparedBy.phone}</Text>
          </View>
        </View>
        {differentShipping ? <View style={styles.card}><Text style={styles.label}>Delivery address</Text>{address(document.customer.shippingAddressLines)}</View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quoted products</Text>
          <ProductHeader />
          {document.quotedLines.map((line) => (
            <View key={line.lineNumber} style={styles.row} wrap={false}>
              <View style={styles.productCol}>
                <Text style={styles.strong}>{line.productName}</Text>
                <Text style={styles.small}>SKU: {line.sku}</Text>
                {line.description ? <Text style={styles.text}>{line.description}</Text> : null}
              </View>
              <Text style={styles.qtyCol}>{line.quantity}</Text>
              <Text style={styles.moneyCol}>{formatCurrency(line.unitPrice, document.quote.currencyCode)}</Text>
              <Text style={styles.discountCol}>{line.discountPercent}% ({formatCurrency(line.discountAmount, document.quote.currencyCode)})</Text>
              <Text style={[styles.moneyCol, styles.strong]}>{formatCurrency(line.netAmount, document.quote.currencyCode)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}><Text>Gross quoted amount</Text><Text>{formatCurrency(document.totals.grossAmount, document.quote.currencyCode)}</Text></View>
          <View style={styles.totalRow}><Text>Discount</Text><Text>{formatCurrency(document.totals.discountAmount, document.quote.currencyCode)}</Text></View>
          <View style={styles.totalRow}><Text>Tax</Text><Text>{formatCurrency(document.totals.taxAmount, document.quote.currencyCode)}</Text></View>
          <View style={[styles.totalRow, styles.payable]}><Text>Total payable</Text><Text>{formatCurrency(document.totals.totalAmount, document.quote.currencyCode)}</Text></View>
        </View>

        {document.unavailableLines.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requested items not included</Text>
            {document.unavailableLines.map((line) => (
              <View key={line.lineNumber} style={styles.row} wrap={false}>
                <Text style={styles.productCol}>{line.requestedDescription}</Text>
                <Text style={styles.moneyCol}>{value(line.requestedSku)}</Text>
                <Text style={styles.qtyCol}>{line.quantity}</Text>
                <Text style={[styles.productCol, styles.text]}>{line.reason}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commercial terms</Text>
          <View style={styles.termGrid}>
            {[
              ["Delivery and fulfilment", document.commercialTerms.deliveryAndFulfilment],
              ["Installation and startup support", document.commercialTerms.installationAndStartup],
              ["Payment terms", document.commercialTerms.paymentTerms],
              ["Quote validity", document.commercialTerms.quoteValidity],
            ].map(([title, body]) => <View key={title} style={styles.termCard}><Text style={styles.label}>{title}</Text><Text>{body}</Text></View>)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes and assumptions</Text>
          {document.notesAndAssumptions.map((note, index) => <Text key={note}>{index + 1}. {note}</Text>)}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Terms reference</Text>
          <Text>{document.termsReference}</Text>
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Acceptance</Text>
          <Text>{document.acceptanceInstructions}</Text>
          <View style={styles.signatureRow}>
            <Text style={styles.signatureLine}>Authorized customer representative</Text>
            <Text style={styles.signatureLine}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
