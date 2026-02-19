import Doctor from "../models/Doctor.js";

export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({}, {
      name: 1,
      username: 1,
      email: 1,
      uniqueId: 1,
      specialization: 1,
      _id: 1
    });
    
    console.log(`✅ Found ${doctors.length} doctors`);
    res.json(doctors);
  } catch (error) {
    console.error("❌ Error fetching doctors:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate("patients");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json({
      id: doctor._id,
      username: doctor.username,
      email: doctor.email,
      uniqueId: doctor.uniqueId,
      patients: doctor.patients || [],
    });
  } catch (error) {
    console.error("❌ Error fetching doctor:", error);
    res.status(500).json({ message: "Server error" });
  }
};
