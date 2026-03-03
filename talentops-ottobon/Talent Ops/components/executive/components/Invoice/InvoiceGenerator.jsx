import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, XCircle, Info, Download, Share, Folder, Link, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import emailjs from '@emailjs/browser';
import {
  getNextInvoiceNumber,
  createInvoice,
  getClients,
  uploadInvoicePDF,
  updateInvoice
} from '../../services/invoiceService';
import './InvoiceGenerator.css';

const InvoiceGenerator = ({ orgId }) => {
  // State for clients
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: ''
  });

  // State for form data
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    companyDetails: {
      name: '',
      address: '',
      email: '',
      phone: '',
      gstNo: '',
      logo: null
    },
    clientDetails: {
      id: null,
      name: '',
      address: '',
      email: '',
      phone: '',
      gstNo: '',
      companyName: ''
    },
    items: [
      {
        id: 1,
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        tax: 0
      }
    ],
    subtotal: 0,
    taxTotal: 0,
    taxPercent: 0,
    discountPercentage: 0,
    discountAmount: 0,
    total: 0,
    notes: '',
    terms: '',
    paymentMethod: '',
    currency: 'INR'
  });

  // Load initial data on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // Load next invoice number
    const { data: invoiceNumber } = await getNextInvoiceNumber(orgId);
    if (invoiceNumber) {
      setInvoiceData(prev => ({ ...prev, invoiceNumber }));
    }

    // Load clients
    const { data: clientsData } = await getClients(orgId);
    if (clientsData) {
      setClients(clientsData);
    }
  };

  // Show notification helper
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 4000); // Auto-dismiss after 4 seconds
  };

  // Handle company logo upload
  const handleLogoUpload = (e) => {
    console.log('Logo upload triggered');
    const file = e.target.files[0];
    console.log('Selected file:', file);

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('File loaded successfully');
        setInvoiceData({
          ...invoiceData,
          companyDetails: {
            ...invoiceData.companyDetails,
            logo: e.target.result
          }
        });
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        showNotification('Error uploading logo. Please try again.', 'error');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle input changes
  const handleInputChange = (e, section, field) => {
    const { value } = e.target;

    if (section) {
      setInvoiceData({
        ...invoiceData,
        [section]: {
          ...invoiceData[section],
          [field]: value
        }
      });
    } else {
      setInvoiceData({
        ...invoiceData,
        [field]: value
      });
    }
  };

  // Handle item input changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceData.items];
    newItems[index][field] = value;

    // Calculate amount for the item
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(newItems[index].quantity) || 0;
      const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : parseFloat(newItems[index].unitPrice) || 0;
      newItems[index].amount = quantity * unitPrice;
    }

    setInvoiceData({
      ...invoiceData,
      items: newItems
    });
  };

  // Add new item row
  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        {
          id: invoiceData.items.length + 1,
          description: '',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          tax: 0
        }
      ]
    });
  };

  // Remove item row
  const removeItem = (index) => {
    if (invoiceData.items.length > 1) {
      const newItems = invoiceData.items.filter((_, i) => i !== index);
      setInvoiceData({
        ...invoiceData,
        items: newItems
      });
    }
  };

  // Calculate invoice totals whenever items change
  useEffect(() => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxTotal = invoiceData.items.reduce((sum, item) => sum + ((item.amount || 0) * (item.tax || 0) / 100), 0);
    const discountAmount = (subtotal * (invoiceData.discountPercentage || 0)) / 100;
    const total = subtotal + taxTotal - discountAmount;

    setInvoiceData(prev => ({
      ...prev,
      subtotal,
      taxTotal,
      discountAmount,
      total
    }));
  }, [invoiceData.items, invoiceData.discountPercentage]);

  // Handle client selection
  const handleClientSelect = (e) => {
    const clientId = e.target.value;
    setSelectedClientId(clientId);

    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setInvoiceData({
          ...invoiceData,
          clientDetails: {
            id: client.id,
            name: client.name || '',
            address: client.address || '',
            email: client.email || '',
            phone: client.phone || '',
            gstNo: client.gst_no || '',
            companyName: client.company_name || ''
          }
        });
      }
    } else {
      // Clear client details
      setInvoiceData({
        ...invoiceData,
        clientDetails: {
          id: null,
          name: '',
          address: '',
          email: '',
          phone: '',
          gstNo: '',
          companyName: ''
        }
      });
    }
  };

  // Generate and save invoice to database
  const generateInvoice = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!invoiceData.clientDetails.name) {
        showNotification('Please enter client name', 'error');
        setLoading(false);
        return;
      }

      if (invoiceData.items.length === 0 || !invoiceData.items[0].description) {
        showNotification('Please add at least one item', 'error');
        setLoading(false);
        return;
      }

      // Calculate tax percent (average of all items)
      const avgTaxPercent = invoiceData.items.reduce((sum, item) => sum + (parseFloat(item.tax) || 0), 0) / invoiceData.items.length;

      // Prepare invoice data for database
      const dbInvoiceData = {
        org_id: orgId,
        invoice_number: invoiceData.invoiceNumber,
        client_id: invoiceData.clientDetails.id,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        currency: invoiceData.currency,
        subtotal: invoiceData.subtotal,
        tax_percent: avgTaxPercent,
        tax_amount: invoiceData.taxTotal,
        total_amount: invoiceData.total,
        status: 'draft',
        notes: invoiceData.notes || null,
        items: invoiceData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.unitPrice),
          amount: parseFloat(item.amount)
        }))
      };

      console.log('Saving invoice to database:', dbInvoiceData);

      // Create invoice in database
      const { data, error } = await createInvoice(dbInvoiceData);

      if (error) {
        throw error;
      }

      setShowPreview(true);
      showNotification(`✅ Invoice ${invoiceData.invoiceNumber} saved to database! Preview shown below.`, 'success');

    } catch (error) {
      console.error('Error generating invoice:', error);
      showNotification('Error generating invoice: ' + (error.message || 'Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };


  // Export PDF - Save to DB, Upload to Supabase, and Download
  const exportPDFAndSave = async () => {
    console.log('========== EXPORT PDF CLICKED ==========');
    console.log('Current invoiceData:', JSON.stringify(invoiceData, null, 2));

    try {
      setLoading(true);

      // Validate required fields
      if (!invoiceData.clientDetails.name) {
        console.log('Validation failed: No client name');
        showNotification('Please enter client name', 'error');
        setLoading(false);
        return;
      }

      if (invoiceData.items.length === 0 || !invoiceData.items[0].description) {
        console.log('Validation failed: No items');
        showNotification('Please add at least one item', 'error');
        setLoading(false);
        return;
      }

      // Calculate tax percent
      const avgTaxPercent = invoiceData.items.reduce((sum, item) => sum + (parseFloat(item.tax) || 0), 0) / invoiceData.items.length;

      // Prepare invoice data for database
      const dbInvoiceData = {
        org_id: orgId,
        invoice_number: invoiceData.invoiceNumber,
        client_id: invoiceData.clientDetails.id,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        currency: invoiceData.currency,
        subtotal: invoiceData.subtotal,
        tax_percent: avgTaxPercent,
        tax_amount: invoiceData.taxTotal,
        total_amount: invoiceData.total,
        status: 'draft',
        notes: invoiceData.notes || null,
        items: invoiceData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.unitPrice),
          amount: parseFloat(item.amount)
        }))
      };



      // Generate and upload PDF
      const pdfBlob = await generatePDFBlob();
      const { data: pdfUrl, error: uploadError } = await uploadInvoicePDF(invoiceData.invoiceNumber, pdfBlob);





      showNotification('✅ Success! PDF uploaded to Supabase', 'success');


    } catch (error) {
      console.error('Error exporting PDF:', error);
      showNotification('❌ Error: ' + (error.message || 'Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open share modal
  const openShareModal = () => {
    if (!invoiceData.invoiceNumber) {
      showNotification('Please generate an invoice first', 'error');
      return;
    }

    // Pre-fill email data
    setEmailData({
      to: invoiceData.clientDetails.email || '',
      subject: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.companyDetails.name || 'Your Company'}`,
      message: `Dear ${invoiceData.clientDetails.name || 'Customer'},\n\nPlease find your invoice ${invoiceData.invoiceNumber} for Rs. ${invoiceData.total.toFixed(2)}.\n\nDue Date: ${invoiceData.dueDate || 'N/A'}\n\nClick the link below to view and download your invoice PDF.\n\nThank you for your business!\n\nBest regards,\n${invoiceData.companyDetails.name || 'Your Company'}`
    });
    setShowShareModal(true);
  };

  // Copy invoice link
  const copyInvoiceLink = async () => {
    try {
      // Generate PDF and get URL from Supabase
      const pdfBlob = await generatePDFBlob();
      const { data: pdfUrl, error } = await uploadInvoicePDF(invoiceData.invoiceNumber, pdfBlob);

      if (error) throw error;

      await navigator.clipboard.writeText(pdfUrl);
      showNotification('✅ Invoice link copied to clipboard!', 'success');
      setShowShareModal(false);
    } catch (error) {
      console.error('Error copying link:', error);
      showNotification('❌ Error copying link', 'error');
    }
  };

  // Send email
  const sendEmail = async () => {
    if (!emailData.to) {
      showNotification('Please enter recipient email', 'error');
      return;
    }

    try {
      setLoading(true);

      // Check if EmailJS is configured - Use Vite environment variables
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      console.log('EmailJS Config Check:', {
        serviceId: serviceId || 'MISSING',
        templateId: templateId || 'MISSING',
        publicKey: publicKey ? 'EXISTS' : 'MISSING',
        allEnvVars: import.meta.env
      });

      if (!serviceId || !templateId || !publicKey) {
        const missingVars = [];
        if (!serviceId) missingVars.push('VITE_EMAILJS_SERVICE_ID');
        if (!templateId) missingVars.push('VITE_EMAILJS_TEMPLATE_ID');
        if (!publicKey) missingVars.push('VITE_EMAILJS_PUBLIC_KEY');

        showNotification(
          `❌ EmailJS not configured! Missing: ${missingVars.join(', ')}. Please add them to .env file and restart the dev server.`,
          'error'
        );
        setLoading(false);
        return;
      }

      // First upload PDF to Supabase to get the link
      const pdfBlob = await generatePDFBlob();
      const { data: pdfUrl, error: uploadError } = await uploadInvoicePDF(invoiceData.invoiceNumber, pdfBlob);

      if (uploadError) {
        throw new Error('Failed to upload PDF: ' + uploadError.message);
      }

      // Send email using EmailJS
      const templateParams = {
        to_email: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        pdf_link: pdfUrl,
        invoice_number: invoiceData.invoiceNumber,
        company_name: invoiceData.companyDetails.name || 'Your Company',
        client_name: invoiceData.clientDetails.name || 'Customer',
        total_amount: 'Rs. ' + invoiceData.total.toFixed(2)
      };

      console.log('Sending email via EmailJS...', {
        serviceId,
        templateId,
        to: emailData.to
      });

      const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);

      console.log('EmailJS Response:', response);

      showNotification('✅ Email sent successfully! Invoice delivered to: ' + emailData.to, 'success');
      setShowShareModal(false);

    } catch (error) {
      console.error('Error sending email:', error);
      showNotification('❌ Error sending email: ' + (error.text || error.message || 'Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setInvoiceData({
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      companyDetails: {
        name: '',
        address: '',
        email: '',
        phone: '',
        gstNo: '',
        logo: null
      },
      clientDetails: {
        id: null,
        name: '',
        address: '',
        email: '',
        phone: '',
        gstNo: '',
        companyName: ''
      },
      items: [
        {
          id: 1,
          description: '',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          tax: 0
        }
      ],
      subtotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      discountPercentage: 0,
      discountAmount: 0,
      total: 0,
      notes: '',
      terms: '',
      paymentMethod: '',
      currency: 'INR'
    });
    setSelectedClientId('');
    loadInitialData();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: invoiceData.currency
    }).format(amount);
  };

  // Get currency symbol for PDF
  const getCurrencySymbol = () => {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'INR': '₹',
      'CAD': '$',
      'AUD': '$'
    };
    return symbols[invoiceData.currency] || invoiceData.currency;
  };

  // Helper function to generate PDF as Blob (for upload)
  const generatePDFBlob = () => {
    return new Promise((resolve) => {
      const doc = createPDFDocument();
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    });
  };

  // Helper function to create PDF document
  const createPDFDocument = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPos = margin;

    // ========== HEADER SECTION ==========
    // Company Logo (left side) - fixed size
    if (invoiceData.companyDetails.logo) {
      try {
        doc.addImage(invoiceData.companyDetails.logo, 'JPEG', margin, yPos, 35, 35);
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
      }
    }

    // INVOICE Title (right side) - same line as logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(44, 62, 80);
    doc.text("INVOICE", pageWidth - margin, yPos + 20, { align: 'right' });

    yPos += 45;

    // ========== INVOICE DETAILS BOX (Right Side) ==========
    const boxX = pageWidth - margin - 70;
    const boxY = yPos;
    const boxWidth = 70;
    const boxHeight = 30;

    // Draw box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(boxX, boxY, boxWidth, boxHeight, 'FD');

    // Invoice details inside box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    let boxYPos = boxY + 8;
    doc.text("Invoice #:", boxX + 5, boxYPos);
    doc.setFont("helvetica", "normal");
    doc.text(invoiceData.invoiceNumber || 'N/A', boxX + 30, boxYPos);

    boxYPos += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Date:", boxX + 5, boxYPos);
    doc.setFont("helvetica", "normal");
    doc.text(invoiceData.invoiceDate || 'N/A', boxX + 30, boxYPos);

    boxYPos += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Due Date:", boxX + 5, boxYPos);
    doc.setFont("helvetica", "normal");
    doc.text(invoiceData.dueDate || 'N/A', boxX + 30, boxYPos);

    // ========== COMPANY & CLIENT DETAILS SECTION ==========
    yPos += 10;

    // FROM Section (Left Column)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("FROM:", margin, yPos);

    yPos += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    if (invoiceData.companyDetails.name) {
      doc.text(invoiceData.companyDetails.name, margin, yPos);
      yPos += 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (invoiceData.companyDetails.address) {
      const addressLines = doc.splitTextToSize(invoiceData.companyDetails.address, 80);
      addressLines.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 5;
      });
    }

    if (invoiceData.companyDetails.email) {
      doc.text(invoiceData.companyDetails.email, margin, yPos);
      yPos += 5;
    }

    if (invoiceData.companyDetails.phone) {
      doc.text(invoiceData.companyDetails.phone, margin, yPos);
      yPos += 5;
    }

    // BILL TO Section (Left Column, below FROM)
    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text("BILL TO:", margin, yPos);

    yPos += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    if (invoiceData.clientDetails.name) {
      doc.text(invoiceData.clientDetails.name, margin, yPos);
      yPos += 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (invoiceData.clientDetails.companyName) {
      doc.text(invoiceData.clientDetails.companyName, margin, yPos);
      yPos += 5;
    }

    if (invoiceData.clientDetails.address) {
      const clientAddressLines = doc.splitTextToSize(invoiceData.clientDetails.address, 80);
      clientAddressLines.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 5;
      });
    }

    if (invoiceData.clientDetails.email) {
      doc.text(invoiceData.clientDetails.email, margin, yPos);
      yPos += 5;
    }

    if (invoiceData.clientDetails.phone) {
      doc.text(invoiceData.clientDetails.phone, margin, yPos);
      yPos += 5;
    }

    // ========== ITEMS TABLE ==========
    yPos += 10;

    const currencySymbol = getCurrencySymbol();

    const tableData = invoiceData.items.map(item => [
      item.description || '',
      String(item.quantity || 0),
      'Rs. ' + parseFloat(item.unitPrice || 0).toFixed(2),
      String(item.tax || 0) + '%',
      'Rs. ' + parseFloat(item.amount || 0).toFixed(2)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        overflow: 'linebreak',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 70, halign: 'left', overflow: 'linebreak' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right', overflow: 'linebreak' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 35, halign: 'right', overflow: 'linebreak' }
      },
      margin: { left: margin, right: margin },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // ========== TOTALS SECTION ==========
    const totalsX = pageWidth - margin - 60;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Subtotal
    doc.text("Subtotal:", totalsX, yPos);
    doc.text('Rs. ' + invoiceData.subtotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;

    // Tax
    doc.text("Tax:", totalsX, yPos);
    doc.text('Rs. ' + invoiceData.taxTotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;

    // Discount (if any)
    if (invoiceData.discountPercentage > 0) {
      doc.text("Discount (" + invoiceData.discountPercentage + "%):", totalsX, yPos);
      doc.text('-Rs. ' + invoiceData.discountAmount.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      yPos += 7;
    }

    // Draw line above total
    doc.setDrawColor(52, 73, 94);
    doc.setLineWidth(0.5);
    doc.line(totalsX, yPos, pageWidth - margin, yPos);
    yPos += 7;

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94);
    doc.text("TOTAL:", totalsX, yPos);
    doc.text('Rs. ' + invoiceData.total.toFixed(2), pageWidth - margin, yPos, { align: 'right' });

    // ========== PAYMENT METHOD & NOTES ==========
    yPos += 15;

    if (invoiceData.paymentMethod) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Payment Method:", margin, yPos);

      doc.setFont("helvetica", "normal");
      let paymentText = invoiceData.paymentMethod;
      switch (invoiceData.paymentMethod) {
        case 'bank_transfer': paymentText = "Bank Transfer"; break;
        case 'credit_card': paymentText = "Credit Card"; break;
        case 'paypal': paymentText = "PayPal"; break;
        case 'cash': paymentText = "Cash"; break;
        case 'cheque': paymentText = "Cheque"; break;
      }
      doc.text(paymentText, margin + 40, yPos);
      yPos += 10;
    }

    // Notes
    if (invoiceData.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Notes:", margin, yPos);
      yPos += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const notesLines = doc.splitTextToSize(invoiceData.notes, pageWidth - (2 * margin));
      doc.text(notesLines, margin, yPos);
      yPos += (notesLines.length * 5) + 5;
    }

    // Terms & Conditions
    if (invoiceData.terms) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Terms & Conditions:", margin, yPos);
      yPos += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const termsLines = doc.splitTextToSize(invoiceData.terms, pageWidth - (2 * margin));
      doc.text(termsLines, margin, yPos);
    }

    // ========== FOOTER ==========
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 15, { align: 'center' });

    return doc;
  };

  // Function to generate PDF (for download)
  const generatePDF = () => {
    const doc = createPDFDocument();

    const fileName = invoiceData.invoiceNumber ?
      `Invoice-${invoiceData.invoiceNumber}.pdf` :
      `Invoice-${new Date().getTime()}.pdf`;

    doc.save(fileName);
  };

  return (
    <div className="invoice-generator">
      {/* Professional Notification */}
      {notification.show && (
        <div className="notification-overlay">
          <div className={`notification-box notification-${notification.type}`}>
            <div className="notification-content">
              <span className="notification-icon">
                {notification.type === 'success' && <CheckCircle size={20} />}
                {notification.type === 'error' && <XCircle size={20} />}
                {notification.type === 'info' && <Info size={20} />}
              </span>
              <p className="notification-message">{notification.message}</p>
            </div>
            <button
              className="notification-close"
              onClick={() => setNotification({ show: false, message: '', type: 'success' })}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <header className="invoice-header">
        <h1>Invoice Generator</h1>
        <div className="actions">
          <button className="btn secondary" onClick={generatePDF}>
            <Download size={16} style={{ marginRight: '8px' }} /> Download PDF
          </button>
          <button className="btn secondary" onClick={exportPDFAndSave} disabled={loading}>
            {loading ? 'Exporting...' : 'Export PDF'}
          </button>
          <button className="btn share" onClick={openShareModal}>
            <Share size={16} style={{ marginRight: '8px' }} /> Share
          </button>
        </div>
      </header>

      <div className="invoice-container">
        <div className="invoice-meta-section">
          <div className="invoice-branding">
            <div className="logo-upload">
              {invoiceData.companyDetails.logo ? (
                <div className="logo-preview">
                  <img src={invoiceData.companyDetails.logo} alt="Company Logo" />
                  <button className="btn small" onClick={() => setInvoiceData({
                    ...invoiceData,
                    companyDetails: {
                      ...invoiceData.companyDetails,
                      logo: null
                    }
                  })}>Remove</button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <label htmlFor="logo-upload">
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                        <Folder size={32} color="#a0aec0" />
                      </div>
                      <div>Click to Upload Logo</div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                        PNG, JPG, GIF (Max 5MB)
                      </div>
                    </div>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>
            <div className="company-fields">
              <input
                type="text"
                placeholder="Company Name"
                value={invoiceData.companyDetails.name}
                onChange={(e) => handleInputChange(e, 'companyDetails', 'name')}
              />
              <textarea
                placeholder="Company Address"
                value={invoiceData.companyDetails.address}
                onChange={(e) => handleInputChange(e, 'companyDetails', 'address')}
              />
              <input
                type="email"
                placeholder="Company Email"
                value={invoiceData.companyDetails.email}
                onChange={(e) => handleInputChange(e, 'companyDetails', 'email')}
              />
              <input
                type="tel"
                placeholder="Company Phone"
                value={invoiceData.companyDetails.phone}
                onChange={(e) => handleInputChange(e, 'companyDetails', 'phone')}
              />
            </div>
          </div>

          <div className="invoice-details">
            <div className="detail-group">
              <label>Invoice #</label>
              <input
                type="text"
                value={invoiceData.invoiceNumber}
                onChange={(e) => handleInputChange(e, null, 'invoiceNumber')}
              />
            </div>
            <div className="detail-group">
              <label>Invoice Date</label>
              <input
                type="date"
                value={invoiceData.invoiceDate}
                onChange={(e) => handleInputChange(e, null, 'invoiceDate')}
              />
            </div>
            <div className="detail-group">
              <label>Due Date</label>
              <input
                type="date"
                value={invoiceData.dueDate}
                onChange={(e) => handleInputChange(e, null, 'dueDate')}
              />
            </div>
            <div className="detail-group">
              <label>Currency</label>
              <select
                value={invoiceData.currency}
                onChange={(e) => handleInputChange(e, null, 'currency')}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>


        <div className="client-section">
          <h2>Bill To</h2>
          <div className="client-selector" style={{ marginBottom: '15px' }}>
            <select value={selectedClientId} onChange={handleClientSelect}>
              <option value="">-- Select Existing Client or Enter Manually --</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company_name ? `(${client.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="client-fields">
            <input
              type="text"
              placeholder="Client Name"
              value={invoiceData.clientDetails.name}
              onChange={(e) => handleInputChange(e, 'clientDetails', 'name')}
            />
            <textarea
              placeholder="Client Address"
              value={invoiceData.clientDetails.address}
              onChange={(e) => handleInputChange(e, 'clientDetails', 'address')}
            />
            <input
              type="email"
              placeholder="Client Email"
              value={invoiceData.clientDetails.email}
              onChange={(e) => handleInputChange(e, 'clientDetails', 'email')}
            />
            <input
              type="tel"
              placeholder="Client Phone"
              value={invoiceData.clientDetails.phone}
              onChange={(e) => handleInputChange(e, 'clientDetails', 'phone')}
            />
          </div>
        </div>


        <div className="items-section">
          <h2>Invoice Items</h2>
          <div className="items-table">
            <div className="item-header">
              <div className="item-cell description-cell">Description</div>
              <div className="item-cell quantity-cell">Quantity</div>
              <div className="item-cell price-cell">Unit Price</div>
              <div className="item-cell tax-cell">Tax (%)</div>
              <div className="item-cell amount-cell">Amount</div>
              <div className="item-cell action-cell"></div>
            </div>

            {invoiceData.items.map((item, index) => (
              <div className="item-row" key={item.id}>
                <div className="item-cell description-cell">
                  <input
                    type="text"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                </div>
                <div className="item-cell quantity-cell">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="item-cell price-cell">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                  />
                </div>
                <div className="item-cell tax-cell">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.tax}
                    onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                  />
                </div>
                <div className="item-cell amount-cell">
                  {formatCurrency(item.amount)}
                </div>
                <div className="item-cell action-cell">
                  <button className="btn small" onClick={() => removeItem(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="add-item-row">
              <button className="btn add-item" onClick={addItem}>+ Add Item</button>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-group">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoiceData.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Tax:</span>
              <span>{formatCurrency(invoiceData.taxTotal)}</span>
            </div>
            <div className="summary-row discount">
              <div className="discount-inputs">
                <span>Discount:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={invoiceData.discountPercentage}
                  onChange={(e) => handleInputChange(e, null, 'discountPercentage')}
                />
                <span>%</span>
              </div>
              <span>{formatCurrency(invoiceData.discountAmount)}</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>{formatCurrency(invoiceData.total)}</span>
            </div>
          </div>
        </div>

        <div className="additional-details">
          <div className="detail-column">
            <h3>Payment Method</h3>
            <select
              value={invoiceData.paymentMethod}
              onChange={(e) => handleInputChange(e, null, 'paymentMethod')}
            >
              <option value="">Select Payment Method</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="paypal">PayPal</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div className="detail-column">
            <h3>Notes</h3>
            <textarea
              placeholder="Additional notes for the client"
              value={invoiceData.notes}
              onChange={(e) => handleInputChange(e, null, 'notes')}
            />
          </div>

          <div className="detail-column">
            <h3>Terms & Conditions</h3>
            <textarea
              placeholder="Terms and conditions"
              value={invoiceData.terms}
              onChange={(e) => handleInputChange(e, null, 'terms')}
            />
          </div>
        </div>

        {/* Generate Invoice Button */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn primary"
            onClick={generateInvoice}
            disabled={loading}
            style={{
              fontSize: '16px',
              padding: '16px 48px',
              minWidth: '250px'
            }}
          >
            {loading ? 'Generating...' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Sparkles size={18} /> Generate Invoice
              </span>
            )}
          </button>
        </div>

        {/* Invoice Preview Section */}
        {showPreview && (
          <div className="invoice-preview-section">
            <div className="preview-header">
              <h2>Invoice Preview</h2>
              <button className="btn secondary" onClick={() => setShowPreview(false)}>Close Preview</button>
            </div>
            <div className="invoice-preview-content">
              <div className="preview-invoice">
                <div className="preview-header-section">
                  <div className="preview-company">
                    {invoiceData.companyDetails.logo && (
                      <img src={invoiceData.companyDetails.logo} alt="Company Logo" className="preview-logo" />
                    )}
                  </div>
                  <div className="preview-invoice-title">
                    <h1>INVOICE</h1>
                    <div className="preview-invoice-details">
                      <p><strong>Invoice #:</strong> {invoiceData.invoiceNumber}</p>
                      <p><strong>Date:</strong> {invoiceData.invoiceDate}</p>
                      <p><strong>Due Date:</strong> {invoiceData.dueDate || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="preview-parties">
                  <div className="preview-from">
                    <h3>FROM:</h3>
                    <p><strong>{invoiceData.companyDetails.name}</strong></p>
                    <p>{invoiceData.companyDetails.address}</p>
                    <p>{invoiceData.companyDetails.email}</p>
                    <p>{invoiceData.companyDetails.phone}</p>
                  </div>
                  <div className="preview-to">
                    <h3>BILL TO:</h3>
                    <p><strong>{invoiceData.clientDetails.name}</strong></p>
                    {invoiceData.clientDetails.companyName && <p>{invoiceData.clientDetails.companyName}</p>}
                    <p>{invoiceData.clientDetails.address}</p>
                    <p>{invoiceData.clientDetails.email}</p>
                    <p>{invoiceData.clientDetails.phone}</p>
                  </div>
                </div>

                <table className="preview-items-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Tax</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{getCurrencySymbol()}{parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td>{item.tax}%</td>
                        <td>{getCurrencySymbol()}{parseFloat(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="preview-totals">
                  <div className="preview-total-row">
                    <span>Subtotal:</span>
                    <span>{getCurrencySymbol()}{invoiceData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="preview-total-row">
                    <span>Tax:</span>
                    <span>{getCurrencySymbol()}{invoiceData.taxTotal.toFixed(2)}</span>
                  </div>
                  {invoiceData.discountPercentage > 0 && (
                    <div className="preview-total-row">
                      <span>Discount ({invoiceData.discountPercentage}%):</span>
                      <span>-{getCurrencySymbol()}{invoiceData.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="preview-total-row preview-grand-total">
                    <span><strong>TOTAL:</strong></span>
                    <span><strong>{getCurrencySymbol()}{invoiceData.total.toFixed(2)}</strong></span>
                  </div>
                </div>

                {invoiceData.paymentMethod && (
                  <div className="preview-payment">
                    <p><strong>Payment Method:</strong> {invoiceData.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                  </div>
                )}

                {invoiceData.notes && (
                  <div className="preview-notes">
                    <h4>Notes:</h4>
                    <p>{invoiceData.notes}</p>
                  </div>
                )}

                {invoiceData.terms && (
                  <div className="preview-terms">
                    <h4>Terms & Conditions:</h4>
                    <p>{invoiceData.terms}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Share size={20} style={{ marginRight: '10px' }} /> Share Invoice</h2>
              <button className="modal-close" onClick={() => setShowShareModal(false)}>×</button>
            </div>

            <div className="share-options">
              <button className="share-option" onClick={copyInvoiceLink}>
                <span className="share-icon"><Link size={20} /></span>
                <span>Copy Link</span>
              </button>
            </div>

            <div className="email-form">
              <h3><Mail size={20} style={{ marginRight: '10px' }} /> Send via Email</h3>

              <div className="form-group">
                <label>Recipient Email</label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  placeholder="client@email.com"
                />
              </div>

              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  placeholder="Invoice subject"
                />
              </div>

              <div className="form-group">
                <label>Message</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  placeholder="Email message..."
                  rows={6}
                />
              </div>

              <button className="btn primary send-email-btn" onClick={sendEmail}>
                <Mail size={16} style={{ marginRight: '8px' }} /> Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceGenerator;
