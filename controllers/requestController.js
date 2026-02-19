// backend/controllers/requestController.js
import Request from '../models/Request.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

// POST /api/requests (patient)
export const apply = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });

    // If a request exists:
    const existing = await Request.findOne({ patientId, doctorId });
    if (existing) {
      // Active request cannot be duplicated
      if (['pending', 'approved'].includes(existing.status)) {
        return res.status(400).json({ message: 'Request already exists' });
      }
      // For cancelled or rejected, allow re-consult by reactivating to pending
      existing.status = 'pending';
      existing.approvedAt = null;
      await existing.save();
      return res.status(200).json(existing);
    }

    // No existing request: create a new one
    const created = new Request({ patientId, doctorId, status: 'pending' });
    await created.save();
    return res.status(201).json(created);
  } catch (err) {
    console.error('Apply error:', err);
    next(err);
  }
};

// GET /api/requests/doctor (doctor)
export const forDoctor = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    console.log('Fetching requests for doctor:', doctorId);
    
    const requests = await Request.find({ doctorId })
      .populate('patientId', 'name email username')
      .populate('doctorId', 'name specialization');
    
    console.log('Found requests:', requests);
    return res.json(requests);
  } catch (err) {
    console.error('ForDoctor error:', err);
    next(err);
  }
};

// GET /api/requests/patient (patient)
export const forPatient = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const requests = await Request.find({ patientId })
      .populate('doctorId', 'name specialization');
    return res.json(requests);
  } catch (err) {
    console.error('ForPatient error:', err);
    next(err);
  }
};

// PATCH /api/requests/:id (doctor)
export const update = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const { status } = req.body; // 'approved' | 'rejected' | 'cancelled'
    
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const request = await Request.findOneAndUpdate(
      { _id: req.params.id, doctorId },
      { 
        $set: { 
          status, 
          approvedAt: status === 'approved' ? new Date() : null 
        } 
      },
      { new: true }
    );
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    return res.json(request);
  } catch (err) {
    console.error('Update error:', err);
    next(err);
  }
};

// PATCH /api/requests/:id/revoke (patient)
export const revoke = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const requestId = req.params.id;

    // Only allow revoking pending or approved requests owned by the patient
    const request = await Request.findOneAndUpdate(
      { _id: requestId, patientId, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'cancelled', approvedAt: null } },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: 'Active request not found or not revocable' });
    }

    return res.json(request);
  } catch (err) {
    console.error('Revoke error:', err);
    next(err);
  }
};

// GET /api/requests/:id/patient-files (doctor - approved requests only)
export const getPatientFiles = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const requestId = req.params.id;
    
    // Check if request exists and is approved
    const request = await Request.findOne({ 
      _id: requestId, 
      doctorId, 
      status: 'approved' 
    });
    
    if (!request) {
      return res.status(404).json({ message: 'Approved request not found' });
    }
    
    // Get patient files (you'll need to implement this based on your File model)
    // For now, return patient info
    const patient = await Patient.findById(request.patientId).select('name email username');
    
    res.json({
      patient,
      request,
      message: 'Access granted to patient files'
    });
  } catch (err) {
    console.error('GetPatientFiles error:', err);
    next(err);
  }
};
