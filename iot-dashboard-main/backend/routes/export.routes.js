const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const DEVICE_ID = 1;

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getValidatedHours(value) {
  const parsedHours = Number(value);

  if (!Number.isFinite(parsedHours)) {
    return 24;
  }

  return Math.min(Math.max(parsedHours, 1), 168);
}

async function fetchLogs(hours) {
  const [rows] = await pool.query(
    `SELECT
       tank_level_ml,
       flow_rate_lpm,
       ward1_ml,
       ward2_ml,
       ward3_ml,
       street_light,
       leak_detected,
       dry_tank,
       recorded_at
     FROM sensor_logs
     WHERE device_id = ?
       AND recorded_at >=
           CURRENT_TIMESTAMP - (? * INTERVAL '1 hour')
     ORDER BY recorded_at ASC`,
    [DEVICE_ID, hours]
  );

  return rows;
}

// GET /api/export/pdf?hours=24
router.get(
  '/pdf',
  authenticate,
  requireRole('user', 'operator'),
  asyncHandler(async (req, res) => {
    const hours = getValidatedHours(req.query.hours);
    const rows = await fetchLogs(hours);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="water_report_${Date.now()}.pdf"`
    );

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    doc.on('error', (err) => {
      console.error('[Export] PDF generation error:', err);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate PDF report.',
        });
      } else {
        res.end();
      }
    });

    doc.pipe(res);

    doc
      .fontSize(18)
      .text(
        'Water Distribution & Street Lighting Report',
        { align: 'center' }
      );

    doc.moveDown(0.3);

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(
        `Generated: ${new Date().toLocaleString()} | ` +
          `Range: last ${hours} hour(s) | ` +
          `Requested by: ${req.user.name} (${req.user.role})`,
        { align: 'center' }
      );

    doc.moveDown(1);
    doc.fillColor('#000');

    const columns = [
      { title: 'Time', x: 40, width: 105 },
      { title: 'Tank', x: 150, width: 75 },
      { title: 'Flow', x: 230, width: 55 },
      { title: 'W1', x: 290, width: 55 },
      { title: 'W2', x: 350, width: 55 },
      { title: 'W3', x: 410, width: 55 },
      { title: 'Light', x: 470, width: 45 },
    ];

    function drawHeader() {
      const headerY = doc.y;

      doc.fontSize(9).font('Helvetica-Bold');

      columns.forEach((column) => {
        doc.text(column.title, column.x, headerY, {
          width: column.width,
        });
      });

      doc.moveDown(1);
      doc.font('Helvetica');
    }

    drawHeader();

    rows.slice(0, 500).forEach((row) => {
      if (doc.y > 750) {
        doc.addPage();
        drawHeader();
      }

      const rowY = doc.y;

      doc.fontSize(8);

      doc.text(
        new Date(row.recorded_at).toLocaleString(),
        columns[0].x,
        rowY,
        { width: columns[0].width }
      );

      doc.text(
        String(row.tank_level_ml ?? 0),
        columns[1].x,
        rowY,
        { width: columns[1].width }
      );

      doc.text(
        String(row.flow_rate_lpm ?? 0),
        columns[2].x,
        rowY,
        { width: columns[2].width }
      );

      doc.text(
        String(row.ward1_ml ?? 0),
        columns[3].x,
        rowY,
        { width: columns[3].width }
      );

      doc.text(
        String(row.ward2_ml ?? 0),
        columns[4].x,
        rowY,
        { width: columns[4].width }
      );

      doc.text(
        String(row.ward3_ml ?? 0),
        columns[5].x,
        rowY,
        { width: columns[5].width }
      );

      doc.text(
        row.street_light ? 'ON' : 'OFF',
        columns[6].x,
        rowY,
        { width: columns[6].width }
      );

      doc.y = rowY + 20;
    });

    if (rows.length === 0) {
      doc.moveDown(1);
      doc
        .fontSize(10)
        .fillColor('#555')
        .text(
          'No sensor records were found for the selected period.',
          { align: 'center' }
        );
    }

    doc.end();
  })
);

// GET /api/export/excel?hours=24
router.get(
  '/excel',
  authenticate,
  requireRole('user', 'operator'),
  asyncHandler(async (req, res) => {
    const hours = getValidatedHours(req.query.hours);
    const rows = await fetchLogs(hours);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Water IoT Dashboard';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Sensor Log');

    sheet.columns = [
      {
        header: 'Recorded At',
        key: 'recorded_at',
        width: 22,
      },
      {
        header: 'Tank Level (mL)',
        key: 'tank_level_ml',
        width: 16,
      },
      {
        header: 'Flow Rate (L/min)',
        key: 'flow_rate_lpm',
        width: 18,
      },
      {
        header: 'Ward 1 (mL)',
        key: 'ward1_ml',
        width: 14,
      },
      {
        header: 'Ward 2 (mL)',
        key: 'ward2_ml',
        width: 14,
      },
      {
        header: 'Ward 3 (mL)',
        key: 'ward3_ml',
        width: 14,
      },
      {
        header: 'Street Light',
        key: 'street_light',
        width: 14,
      },
      {
        header: 'Leak Detected',
        key: 'leak_detected',
        width: 15,
      },
      {
        header: 'Dry Tank',
        key: 'dry_tank',
        width: 12,
      },
    ];

    sheet.getRow(1).font = {
      bold: true,
    };

    sheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    rows.forEach((row) => {
      sheet.addRow({
        recorded_at: row.recorded_at
          ? new Date(row.recorded_at)
          : null,
        tank_level_ml: row.tank_level_ml ?? 0,
        flow_rate_lpm: row.flow_rate_lpm ?? 0,
        ward1_ml: row.ward1_ml ?? 0,
        ward2_ml: row.ward2_ml ?? 0,
        ward3_ml: row.ward3_ml ?? 0,
        street_light: row.street_light ? 'ON' : 'OFF',
        leak_detected: row.leak_detected ? 'YES' : 'NO',
        dry_tank: row.dry_tank ? 'YES' : 'NO',
      });
    });

    sheet.getColumn('recorded_at').numFmt =
      'dd-mm-yyyy hh:mm:ss';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="water_report_${Date.now()}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  })
);

module.exports = router;