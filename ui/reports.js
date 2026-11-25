function makeDailyPdf(rows, title, scope, date, inventory, actions) {
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
  function line(text, bold = false, color = '#122c49') {
    if (y > canvas.height - margin) {
      finishPage();
      startPage();
    }
    ctx.font = (bold ? 'bold ' : '') + '26px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(text, margin, y);
    y += 37;
  }
  function paragraph(text, bold = false, color) {
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
        if (current) line(current, bold, color);
        current = '';
        for (const char of word) {
          if (ctx.measureText(current + char).width > maxWidth) {
            line(current, bold, color);
            current = '';
          }
          current += char;
        }
      }
      if (current) line(current, bold, color);
    }
  }
  startPage();
  paragraph(title, true);
  paragraph(scope);
  y += 23;
  const cameras = summarizeCameras(rows, inventory);
  paragraph('Camera summary', true);
  if (cameras.total) {
    paragraph(cameras.total + ' cameras in scope · ' + cameras.working + ' working · ' + cameras.faults.length + ' with faults · ' + cameras.unchecked + ' with live view unverified');
    paragraph('Not live or intermittent: ' + cameras.notLive + ' of ' + cameras.total + ' (' + reportPercent(cameras.offlineRate) + ')', true);
    paragraph('Camera risk exposure: ' + cameras.faults.length + ' of ' + cameras.total + ' (' + reportPercent(cameras.exposure) + ')', true);
    if (cameras.unchecked) paragraph('These percentages show confirmed issues. Check the remaining cameras to confirm coverage.');
    if (!cameras.faults.length && !cameras.unchecked) paragraph('Good news! All ' + cameras.total + ' cameras in this report are working.');
  } else {
    paragraph('No registered or checked cameras were found for this selection.');
  }
  if (cameras.recommendation) paragraph(cameras.recommendation, true);
  if (cameras.faults.length) {
    y += 18;
    paragraph('Cameras needing attention', true, '#a32034');
    for (const camera of cameras.faults) {
      paragraph([camera.school,camera.recorder,camera.camera,camera.location].filter(Boolean).join(' · '), true);
      paragraph(camera.issues.join(' · '), false, '#a32034');
    }
  }
  y += 23;
  paragraph('Action points', true);
  if (!actions.length) paragraph('No action points for this selection.');
  for (const action of actions) {
    paragraph(action.action, true);
    paragraph([action.school,action.recorder,action.camera,action.state,action.due&&'Due '+action.due].filter(Boolean).join(' · '));
    if (action.owner) paragraph('Assigned to: ' + action.owner);
    if (action.remarks) paragraph(action.remarks);
  }
  const recorders = new Map(rows.filter(row => row.kind === 'recorder').map(row=>[key(row.school,row.recorder),row]));
  const devices = latestSummaryDevices(rows, inventory);
  y += 23;
  paragraph('Latest DVR/NVR updates', true);
  if (!devices.length) paragraph('No DVR/NVRs found for this selection.');
  for (const device of devices) {
    paragraph([device.school, device.recorder, device.date ? [device.date,device.time].filter(Boolean).join(' ') : 'No inspection recorded'].join(' · '), true);
    const row = recorders.get(key(device.school,device.recorder));
    if (!row) continue;
    if (systemFields.some(field=>row[field])) {
      const details = systemFields.filter(field=>row[field]).map(field=>names[field]+': '+row[field]).join(' · ');
      paragraph((row.date!==device.date||row.time!==device.time?'Recorder check '+row.date+' '+row.time+' · ':'')+details);
    }
    if (row.remarks) paragraph(row.remarks);
  }
  const other = rows.filter(row => ['incident','note'].includes(row.kind));
  if (other.length) {
    y += 23;
    paragraph('Incidents and observations', true);
    for (const row of other) {
      paragraph([row.time,row.school,row.incidentTitle||pages[row.kind],row.recorder,row.camera].filter(Boolean).join(' · '), true);
      for (const field of ['description','observation','recorderTime','remarks']) if (row[field]) paragraph(row[field]);
    }
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
  const inventory = data.filter(row => row.kind === 'register' && matches(row, false));
  const file = makeDailyPdf([...latestDeviceChecks(data,{...filter,date}),...rows.filter(row=>['incident','note'].includes(row.kind))], title, scope, date, inventory, actionPointsForDay(data, {...filter, date}));
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
