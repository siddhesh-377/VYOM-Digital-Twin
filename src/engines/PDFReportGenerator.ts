import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { reportEngine } from './ReportEngine';

export class PDFReportGenerator {
  static async generateFromDOMElement(elementId: string, filename: string = 'VYOM_Mission_Report.pdf') {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('Report element not found');
      return;
    }

    try {
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#020409' });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    }
  }

  static generateRawDataReport() {
    const data = reportEngine.gatherMissionData();
    const pdf = new jsPDF();
    pdf.setFontSize(22);
    pdf.text('VYOM Mission Final Report', 20, 20);
    
    pdf.setFontSize(12);
    pdf.text(`Mission Name: ${data.config?.name || 'Unknown'}`, 20, 40);
    pdf.text(`Destination: ${data.config?.destination || 'Unknown'}`, 20, 50);
    pdf.text(`Final Status: ${data.finalStatus.toUpperCase()}`, 20, 60);
    pdf.text(`Total Duration: ${Math.round(data.totalMissionDays)} Days`, 20, 70);
    pdf.text(`AI Interventions: ${data.aiInterventions}`, 20, 80);
    
    pdf.save(`VYOM_Report_${data.config?.name}.pdf`);
  }
}
