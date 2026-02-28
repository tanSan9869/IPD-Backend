// backend/controllers/summarizeController.js
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { downloadDecryptedFileFromCloudinary } from '../cloudinaryStorage.js';
import { downloadDecryptedFileFromMega } from '../mega.js';
import File from '../models/File.js';
import Request from '../models/Request.js';

const SUMMARY_URL = process.env.NLP_SUMMARY_URL || 'http://127.0.0.1:5080/summarize';

// Helper to call Flask summarizer with text
async function callSummarizerWithText({ text, useGollie = false, schematic = true }) {
  try {
    const form = new FormData();
    form.append('text', text);
    form.append('use_gollie', useGollie ? 'true' : 'false');
    form.append('schematic', schematic ? 'true' : 'false');
    const res = await fetch(SUMMARY_URL, { method: 'POST', body: form, headers: form.getHeaders() });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Summarizer error');
      throw new Error(`Summarizer HTTP ${res.status}: ${msg}`);
    }
    const data = await res.json();
    if (!data || typeof data.summary !== 'string') {
      throw new Error('Invalid summarizer response');
    }
    return data.summary;
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(String(err?.message))) {
      const e = new Error('Summarization service unavailable');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
}

// Helper to call Flask summarizer with a file path
async function callSummarizerWithFile({ filePath, useGollie = false, schematic = true }) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('use_gollie', useGollie ? 'true' : 'false');
    form.append('schematic', schematic ? 'true' : 'false');
    const res = await fetch(SUMMARY_URL, { method: 'POST', body: form, headers: form.getHeaders() });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Summarizer error');
      throw new Error(`Summarizer HTTP ${res.status}: ${msg}`);
    }
    const data = await res.json();
    if (!data || typeof data.summary !== 'string') {
      throw new Error('Invalid summarizer response');
    }
    return data.summary;
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(String(err?.message))) {
      const e = new Error('Summarization service unavailable');
      e.statusCode = 503;
      throw e;
    }
    throw err;
  }
}

// POST /api/summarize/text
export async function summarizeText(req, res) {
  try {
    const { text, useGollie = false, schematic = true } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text is required' });
    }
    const summary = await callSummarizerWithText({ text, useGollie, schematic });
    return res.json({ summary });
  } catch (err) {
    console.error('summarizeText error:', err);
    const status = err.statusCode || (/Summarizer HTTP/.test(err.message) ? 502 : 500);
    return res.status(status).json({ message: err.message });
  }
}

// POST /api/summarize/doctor/patient/:patientId/file/:fileId
// Requires doctor auth and approved access to patient's files
export async function summarizeDoctorFile(req, res) {
  const { patientId, fileId } = req.params;
  const { useGollie = false, schematic = true } = req.body || {};
  let tempDecPath = null;
  try {
    // Ensure an approved request exists (middleware can also enforce; this is a secondary guard)
    const doctorId = req.user?.id;
    const ok = await Request.exists({ doctorId, patientId, status: 'approved' });
    if (!ok) return res.status(403).json({ message: 'Access denied' });

    // Look up file metadata to decide which storage backend to use
    const fileDoc = await File.findById(fileId);
    if (!fileDoc || fileDoc.patientId.toString() !== patientId) {
      return res.status(404).json({ message: 'File not found' });
    }

    let result;
    if (fileDoc.storageUrl) {
      // New Cloudinary-based storage
      result = await downloadDecryptedFileFromCloudinary(fileId, patientId);
    } else if (fileDoc.megaLink) {
      // Legacy MEGA-based storage (still supported, mainly for local/dev)
      result = await downloadDecryptedFileFromMega(fileId, patientId);
    } else {
      return res.status(400).json({ message: 'File has no storage location configured.' });
    }

    if (!result.success) return res.status(400).json({ message: result.message });
    tempDecPath = result.filePath;

    // Call summarizer with file
    const summary = await callSummarizerWithFile({ filePath: tempDecPath, useGollie, schematic });
    return res.json({ summary });
  } catch (err) {
    console.error('summarizeDoctorFile error:', err);
    const status = err.statusCode || (/Summarizer HTTP/.test(err.message) ? 502 : 500);
    return res.status(status).json({ message: err.message });
  } finally {
    // Cleanup temp decrypted file
    if (tempDecPath) {
      try { fs.unlinkSync(tempDecPath); } catch {}
    }
  }
}
