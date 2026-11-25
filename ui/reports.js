function makeDailyPdf(rows, title, scope, date) {
  const canvas = document.createElement('canvas');
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext('2d');
  const images = [];
  const margin = 90;
  let y;
  function startPage() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#122c49';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Daily CCTV inspection report', margin, 105);
    ctx.font = '24px sans-serif';
    ctx.fillText(date + '  |  Page ' + (images.length + 1), margin, 150);
    y = 205;
  }
  function finishPage() {
    images.push(Uint8Array.from(atob(canvas.toDataURL('image/jpeg', .86).split(',')[1]), c => c.charCodeAt(0)));
  }
  function line(text, bold = false) {
    if (y > canvas.height - margin) {
      finishPage();
      startPage();
    }
    ctx.font = (bold ? 'bold ' : '') + '26px sans-serif';
    ctx.fillText(text, margin, y);
    y += 37;
  }
  function paragraph(text, bold = false) {
    for (const sourceLine of String(text).split(/\r?\n/)) {
      let current = '';
      for (const word of sourceLine.split(/\s+/)) {
        ctx.font = (bold ? 'bold ' : '') + '26px sans-serif';
        const maxWidth = canvas.width - margin * 2;
        const candidate = current ? current + ' ' + word : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) line(current, bold);
        current = '';
        for (const char of word) {
          if (ctx.measureText(current + char).width > maxWidth) {
            line(current, bold);
            current = '';
          }
          current += char;
        }
      }
      if (current) line(current, bold);
    }
  }
  startPage();
  paragraph(title, true);
  paragraph(scope);
  y += 23;
  const records = rows.filter(r => r.kind !== 'register' && !['Unchecked', 'Empty port'].includes(r.channelStatus));
  if (!records.length) paragraph('No records for this selection.');
  for (const row of records) {
    paragraph([row.time, pages[row.kind], row.school, row.recorder, row.camera].filter(Boolean).join(' · '), true);
    const reportFields = ['location','officer','shift','live','playback','power','storage','earliest','monitor','fault','channelSummary','incidentTitle','description','endTime','recorderTime','observation','action','owner','due','state','remarks'];
    for (const field of reportFields) if (row[field]) paragraph(names[field] + ': ' + row[field]);
    y += 23;
  }
  finishPage();
  return new File(assembleReportPdf(images, canvas.width, canvas.height), 'CCTV-report-' + date + '.pdf', { type: 'application/pdf' });
}

function assembleReportPdf(images, width, height) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  function write(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes);
    length += bytes.length;
  }
  function object(content, stream) {
    offsets.push(length);
    write((offsets.length - 1) + ' 0 obj\n' + content);
    if (stream) {
      write('\nstream\n');
      write(stream);
      write('\nendstream');
    }
    write('\nendobj\n');
  }
  write('%PDF-1.4\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object('<< /Type /Pages /Count ' + images.length + ' /Kids [' + images.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] >>');
  for (const [index, image] of images.entries()) {
    const page = 3 + 3 * index;
    object('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im ' + (page + 1) + ' 0 R >> >> /Contents ' + (page + 2) + ' 0 R >>');
    object('<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.length + ' >>', image);
    const draw = 'q 595 0 0 842 0 0 cm /Im Do Q';
    object('<< /Length ' + draw.length + ' >>', draw);
  }
  const xref = length;
  write('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) write(String(offset).padStart(10, '0') + ' 00000 n \n');
  write('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return parts;
}

function showDailyReport(rows) {
  const date = filter.date || day();
  const scope = [filter.school || 'All properties', filter.recorder, filter.camera].filter(Boolean).join(' · ');
  const title = account.businesses.find(b => b.id === businessId).name;
  const file = makeDailyPdf(rows, title, scope, date);
  const subject = 'CCTV inspection report · ' + date;
  const dialog = settingsDialog('Share daily PDF', '<p>' + esc(date + ' · ' + scope) + '</p><div class="buttons"><button type="button" id="sharePdf" hidden>Share PDF via email or WhatsApp</button><a id="downloadPdf">Download PDF</a></div><p>On devices without file sharing, download the PDF and attach it to your email or WhatsApp message.</p><div class="buttons"><a id="reportEmail">Open email</a><a id="reportWhatsApp" target="_blank" rel="noopener noreferrer">Open WhatsApp</a></div>');
  const url = URL.createObjectURL(file);
  const download = dialog.querySelector('#downloadPdf');
  download.href = url;
  download.download = file.name;
  dialog.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  dialog.querySelector('#reportEmail').href = 'mailto:?subject=' + encodeURIComponent(subject);
  dialog.querySelector('#reportWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent(subject);
  const share = dialog.querySelector('#sharePdf');
  if (navigator.canShare?.({ files: [file] })) {
    share.hidden = false;
    share.onclick = async () => {
      try {
        await navigator.share({ files: [file], title: subject });
      } catch (err) {
        if (err.name !== 'AbortError') dialog.querySelector('.settingsError').textContent = 'File sharing is unavailable. Download and attach the PDF to your message.';
      }
    };
  }
}
