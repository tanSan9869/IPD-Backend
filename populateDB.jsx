// backend/populateDB.jsx
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Doctor from './models/Doctor.js';
import Patient from './models/Patient.js';
import Request from './models/Request.js';
import File from './models/File.js';
import { connectDB } from './db.jsx';

const doctorsData = [
  {
    name: "Dr. Jain Surgeon",
    email: "dr.jain@smartcare.com",
    username: "drjain",
    password: "password123",
    uniqueId: "DOC001",
    specialization: "General Surgeon"
  },
  {
    name: "Dr. Sarah Johnson",
    email: "dr.sarah@smartcare.com",
    username: "drsarah",
    password: "password123",
    uniqueId: "DOC002",
    specialization: "Cardiologist"
  },
  {
    name: "Dr. Michael Rodriguez",
    email: "dr.michael@smartcare.com",
    username: "drmichael",
    password: "password123",
    uniqueId: "DOC003",
    specialization: "Orthopedic Surgeon"
  },
  {
    name: "Dr. Emily Watson",
    email: "dr.emily@smartcare.com",
    username: "dremily",
    password: "password123",
    uniqueId: "DOC004",
    specialization: "Neurologist"
  },
  {
    name: "Dr. Chen Li",
    email: "dr.chen@smartcare.com",
    username: "drchen",
    password: "password123",
    uniqueId: "DOC005",
    specialization: "Dentist"
  }
];

const patientsData = [
  {
    name: "Tanish Kumar",
    email: "tanish@example.com",
    username: "tanish",
    password: "password123",
    publicKey: "dummy-public-key-tanish",
    privateKeyEncrypted: "dummy-encrypted-private-key-tanish"
  },
  {
    name: "Priya Sharma",
    email: "priya@example.com",
    username: "priya",
    password: "password123",
    publicKey: "dummy-public-key-priya",
    privateKeyEncrypted: "dummy-encrypted-private-key-priya"
  },
  {
    name: "Raj Patel",
    email: "raj@example.com",
    username: "raj",
    password: "password123",
    publicKey: "dummy-public-key-raj",
    privateKeyEncrypted: "dummy-encrypted-private-key-raj"
  }
];

const populateDatabase = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await Request.deleteMany({});
    await File.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Hash passwords and create doctors
    const hashedDoctors = await Promise.all(
      doctorsData.map(async (doctor) => {
        const hashedPassword = await bcrypt.hash(doctor.password, 10);
        return { ...doctor, password: hashedPassword };
      })
    );

    const createdDoctors = await Doctor.insertMany(hashedDoctors);
    console.log(`✅ Created ${createdDoctors.length} doctors`);

    // Hash passwords and create patients
    const hashedPatients = await Promise.all(
      patientsData.map(async (patient) => {
        const hashedPassword = await bcrypt.hash(patient.password, 10);
        return { ...patient, password: hashedPassword };
      })
    );

    const createdPatients = await Patient.insertMany(hashedPatients);
    console.log(`✅ Created ${createdPatients.length} patients`);

    // Create sample requests
    const sampleRequests = [
      {
        patientId: createdPatients[0]._id, // Tanish
        doctorId: createdDoctors[0]._id,   // Dr. Jain
        status: "pending"
      },
      {
        patientId: createdPatients[1]._id, // Priya
        doctorId: createdDoctors[1]._id,   // Dr. Sarah
        status: "approved"
      }
    ];

    const createdRequests = await Request.insertMany(sampleRequests);
    console.log(`✅ Created ${createdRequests.length} sample requests`);

    // Create sample files
    const sampleFiles = [
      {
        patientId: createdPatients[0]._id, // Tanish
        originalName: "Blood_Test_Report.pdf",
        size: 1024000,
        path: "/uploads/sample1.pdf"
      },
      {
        patientId: createdPatients[0]._id, // Tanish
        originalName: "X-Ray_Results.jpg",
        size: 2048000,
        path: "/uploads/sample2.jpg"
      }
    ];

    const createdFiles = await File.insertMany(sampleFiles);
    console.log(`✅ Created ${createdFiles.length} sample files`);

    console.log('\n🎉 Database populated successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('Patient Login:');
    console.log('  Username: tanish, Password: password123');
    console.log('  Username: priya, Password: password123');
    console.log('\nDoctor Login:');
    console.log('  Username: drjain, Password: password123');
    console.log('  Username: drsarah, Password: password123');
    console.log('\n🔗 Test Flow:');
    console.log('1. Login as Tanish (patient)');
    console.log('2. Go to "Find Doctors" → Apply to Dr. Jain');
    console.log('3. Login as Dr. Jain (doctor)');
    console.log('4. Check dashboard for Tanish\'s request');
    console.log('5. Accept/reject the request');
    console.log('6. Login as Tanish to see updated status');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating database:', error);
    process.exit(1);
  }
};

populateDatabase();
