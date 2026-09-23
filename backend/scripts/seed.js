import 'dotenv/config';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import Pharmacy from '../models/Pharmacy.js';
import Availability from '../models/Availability.js';
import Reservation from '../models/Reservation.js';

await connectDatabase();
await Promise.all([Availability.deleteMany({}), Reservation.deleteMany({}), Pharmacy.deleteMany({}), Medicine.deleteMany({}), User.deleteMany({})]);

const customer = await User.create({ name: 'Amanda Silva', email: 'amanda@email.com', password: 'password', phone: '+94 71 234 5678', role: 'customer' });
const owner = await User.create({ name: 'Nimal Pharmacy Owner', email: 'pharmacy@medifind.lk', password: 'password', phone: '+94 77 111 2233', role: 'pharmacyOwner' });
await User.create({ name: 'MediFind Admin', email: 'admin@medifind.lk', password: 'password', role: 'admin' });

const medicines = await Medicine.insertMany([
  { name: 'Paracetamol', genericName: 'Acetaminophen', category: 'Pain Relief', description: 'Used for temporary relief of mild to moderate pain and fever.', manufacturer: 'State Pharmaceuticals', dosage: '500 mg' },
  { name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic', description: 'Prescription antibiotic used for susceptible bacterial infections.', manufacturer: 'Ceylon Pharma', dosage: '250 mg' },
  { name: 'Cetirizine', genericName: 'Cetirizine Hydrochloride', category: 'Allergy', description: 'Antihistamine for common allergy symptoms.', manufacturer: 'HealthCare Labs', dosage: '10 mg' },
  { name: 'Ibuprofen', genericName: 'Ibuprofen', category: 'Pain Relief', description: 'Anti-inflammatory pain and fever relief medicine.', manufacturer: 'LifePlus', dosage: '400 mg' },
  { name: 'Vitamin C', genericName: 'Ascorbic Acid', category: 'Vitamins', description: 'Vitamin C dietary supplement.', manufacturer: 'Wellness Labs', dosage: '500 mg' }
]);

const pharmacyData = [
  ['ABC Pharmacy', '123 Main Street, Jaffna, Sri Lanka', 'Jaffna', 9.6658, 80.0216, '+94 21 234 5678', 'Mon–Sun: 6:00 AM–10:00 PM', 4.7, 128],
  ['HealthCare Pharmacy', '42 Hospital Road, Jaffna, Sri Lanka', 'Jaffna', 9.6726, 80.0288, '+94 21 222 1098', 'Mon–Sun: 7:00 AM–8:00 PM', 4.5, 96],
  ['City Pharmacy', '8 KKS Road, Jaffna, Sri Lanka', 'Jaffna', 9.6564, 80.0148, '+94 21 555 1033', 'Mon–Sat: 8:00 AM–7:00 PM', 4.2, 76],
  ['Green Pharmacy', '16 Palaly Road, Jaffna, Sri Lanka', 'Jaffna', 9.6782, 80.0112, '+94 21 700 9812', 'Mon–Sun: 6:00 AM–10:00 PM', 4.6, 54],
  ['LifePlus Pharmacy', '5 Stanley Road, Jaffna, Sri Lanka', 'Jaffna', 9.6488, 80.0329, '+94 21 320 2244', 'Mon–Sun: 7:00 AM–9:30 PM', 4.4, 88]
];
const pharmacies = await Pharmacy.create(pharmacyData.map(([pharmacyName, address, city, latitude, longitude, contactNumber, openingHours, rating, reviews]) => ({ ownerId: owner._id, pharmacyName, address, city, latitude, longitude, contactNumber, openingHours, rating, reviews, verified: true })));
const quantities = [[24, 6, 0, 18, 4], [15, 3, 9, 0, 21], [6, 14, 0, 12, 2], [19, 0, 4, 11, 7], [30, 8, 5, 20, 16]];
for (let m = 0; m < medicines.length; m += 1) for (let p = 0; p < pharmacies.length; p += 1) await Availability.create({ medicineId: medicines[m]._id, pharmacyId: pharmacies[p]._id, quantity: quantities[m][p] });
await Reservation.create({ userId: customer._id, pharmacyId: pharmacies[0]._id, medicineId: medicines[0]._id, quantity: 2, collectionTime: new Date(Date.now() + 6 * 60 * 60 * 1000), status: 'confirmed' });
console.log('Seed complete. Customer: amanda@email.com / password; Pharmacy: pharmacy@medifind.lk / password');
process.exit(0);
