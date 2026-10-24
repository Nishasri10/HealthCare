import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nextId, updateData } from './jsonStore.js';

export const directorySpecialities = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics',
  'Pediatrics', 'Obstetrics and Gynecology', 'Ophthalmology', 'ENT (Ear, Nose and Throat)',
  'Psychiatry', 'Psychology', 'Gastroenterology', 'Pulmonology', 'Nephrology', 'Urology',
  'Endocrinology', 'Oncology', 'Rheumatology', 'Hematology', 'Infectious Disease',
  'General Surgery', 'Cardiothoracic Surgery', 'Neurosurgery', 'Plastic Surgery', 'Dental Care',
  'Physiotherapy', 'Nutrition and Dietetics', 'Radiology', 'Anesthesiology', 'Emergency Medicine'
];

const specialityAliases = {
  'General Medicine': ['Family Medicine'],
  Orthopedics: ['Orthopaedics'],
  Pediatrics: ['Paediatrics'],
  'Obstetrics and Gynecology': ['Obstetrics & Gynaecology', 'Obstetrics and Gynaecology'],
  'ENT (Ear, Nose and Throat)': ['ENT']
};

const demoDoctors = [
  { name: 'Dr. Maya Patel', speciality: 'Cardiology', qualification: 'MBBS, MD (Cardiology)', years: 14, fee: 950, mode: 'In-person', languages: ['English', 'Hindi', 'Gujarati'], bio: 'Fictional demo cardiologist focused on preventive heart health and patient education.' },
  { name: 'Dr. Arjun Mehta', speciality: 'Dermatology', qualification: 'MBBS, MD (Dermatology)', years: 11, fee: 750, mode: 'Online', languages: ['English', 'Hindi'], bio: 'Fictional demo dermatologist focused on practical skin-health education.' },
  { name: 'Dr. Leena Rao', speciality: 'Pediatrics', qualification: 'MBBS, DCH', years: 9, fee: 650, mode: 'Both', languages: ['English', 'Kannada', 'Hindi'], bio: 'Fictional demo pediatrician supporting children and families through every stage.' },
  { name: 'Dr. Kabir Shah', speciality: 'Orthopedics', qualification: 'MBBS, MS (Orthopedics)', years: 16, fee: 1000, mode: 'In-person', languages: ['English', 'Hindi', 'Gujarati'], bio: 'Fictional demo orthopedics specialist focused on mobility and recovery.' },
  { name: 'Dr. Ananya Iyer', speciality: 'General Medicine', qualification: 'MBBS, MD (General Medicine)', years: 12, fee: 600, mode: 'Both', languages: ['English', 'Tamil', 'Hindi'], bio: 'Fictional demo general physician providing thoughtful preventive and primary care.' },
  { name: 'Dr. Rohan Desai', speciality: 'Neurology', qualification: 'MBBS, DM (Neurology)', years: 18, fee: 1200, mode: 'Online', languages: ['English', 'Hindi', 'Marathi'], bio: 'Fictional demo neurologist helping patients understand neurological health.' },
  { name: 'Dr. Sara Khan', speciality: 'Obstetrics and Gynecology', qualification: 'MBBS, MS (Obstetrics and Gynecology)', years: 13, fee: 900, mode: 'In-person', languages: ['English', 'Hindi', 'Urdu'], bio: 'Fictional demo women’s-health physician offering supportive, patient-centred care.' },
  { name: 'Dr. Vikram Nair', speciality: 'Ophthalmology', qualification: 'MBBS, MS (Ophthalmology)', years: 10, fee: 700, mode: 'Both', languages: ['English', 'Malayalam', 'Hindi'], bio: 'Fictional demo eye-care professional focused on vision health and routine care.' },
  { name: 'Dr. Nisha Verma', speciality: 'Psychiatry', qualification: 'MBBS, MD (Psychiatry)', years: 8, fee: 850, mode: 'Online', languages: ['English', 'Hindi'], bio: 'Fictional demo psychiatrist committed to respectful, patient-centred mental-health care.' },
  { name: 'Dr. Dev Malhotra', speciality: 'Endocrinology', qualification: 'MBBS, DM (Endocrinology)', years: 15, fee: 1100, mode: 'Both', languages: ['English', 'Hindi', 'Punjabi'], bio: 'Fictional demo endocrinologist supporting hormone and metabolic health.' },
  { name: 'Dr. Aisha Fernandes', speciality: 'ENT (Ear, Nose and Throat)', qualification: 'MBBS, MS (Otorhinolaryngology)', years: 7, fee: 680, mode: 'In-person', languages: ['English', 'Konkani', 'Hindi'], bio: 'Fictional demo ENT specialist providing careful evaluation and follow-up.' },
  { name: 'Dr. Neel Kapoor', speciality: 'General Medicine', qualification: 'MBBS, DNB (General Medicine)', years: 6, fee: 550, mode: 'Both', languages: ['English', 'Hindi'], bio: 'Fictional demo primary-care physician focused on accessible ongoing wellness support.' },
  { name: 'Dr. Priya Menon', speciality: 'Cardiology', qualification: 'MBBS, DNB, Fellowship in Cardiology', years: 10, fee: 1050, mode: 'Online', languages: ['English', 'Malayalam', 'Hindi'], bio: 'Fictional demo cardiologist with an interest in heart-health awareness.' },
  { name: 'Dr. Kiran Joshi', speciality: 'Dermatology', qualification: 'MBBS, DVD, MD (Dermatology)', years: 8, fee: 700, mode: 'Both', languages: ['English', 'Hindi', 'Marathi'], bio: 'Fictional demo dermatologist who emphasizes clear, practical skin-care guidance.' },
  { name: 'Dr. Meera Nambiar', speciality: 'Pediatrics', qualification: 'MBBS, MD (Pediatrics)', years: 12, fee: 800, mode: 'Both', languages: ['English', 'Malayalam', 'Tamil'], bio: 'Fictional demo pediatrician with a family-centred approach to child wellness.' },
  { name: 'Dr. Aditya Kulkarni', speciality: 'Orthopedics', qualification: 'MBBS, DNB (Orthopedics)', years: 9, fee: 850, mode: 'In-person', languages: ['English', 'Hindi', 'Marathi'], bio: 'Fictional demo orthopedist focused on mobility, injury prevention, and recovery.' },
  { name: 'Dr. Farah Siddiqui', speciality: 'Psychology', qualification: 'MA Clinical Psychology, MPhil', years: 9, fee: 800, mode: 'Online', languages: ['English', 'Hindi', 'Urdu'], bio: 'Fictional demo psychologist offering supportive, evidence-informed counselling.' },
  { name: 'Dr. Nitin Bhat', speciality: 'Gastroenterology', qualification: 'MBBS, MD, DM (Gastroenterology)', years: 13, fee: 1150, mode: 'Both', languages: ['English', 'Kannada', 'Hindi'], bio: 'Fictional demo gastroenterologist focused on digestive-health education.' },
  { name: 'Dr. Pooja Reddy', speciality: 'Pulmonology', qualification: 'MBBS, MD (Respiratory Medicine)', years: 10, fee: 900, mode: 'Online', languages: ['English', 'Telugu', 'Hindi'], bio: 'Fictional demo pulmonologist focused on respiratory wellness and patient education.' },
  { name: 'Dr. Sameer Chawla', speciality: 'Nephrology', qualification: 'MBBS, MD, DM (Nephrology)', years: 12, fee: 1100, mode: 'Both', languages: ['English', 'Hindi', 'Punjabi'], bio: 'Fictional demo nephrologist focused on kidney-health education and continuity of care.' },
  { name: 'Dr. Tara Bose', speciality: 'Urology', qualification: 'MBBS, MS, MCh (Urology)', years: 11, fee: 1000, mode: 'In-person', languages: ['English', 'Bengali', 'Hindi'], bio: 'Fictional demo urologist providing respectful, informative consultations.' },
  { name: 'Dr. Joseph Mathew', speciality: 'General Surgery', qualification: 'MBBS, MS (General Surgery)', years: 14, fee: 1050, mode: 'In-person', languages: ['English', 'Malayalam', 'Hindi'], bio: 'Fictional demo general surgeon focused on clear explanations and coordinated care.' },
  { name: 'Dr. Ritu Sethi', speciality: 'Dental Care', qualification: 'BDS, MDS (Prosthodontics)', years: 7, fee: 500, mode: 'Both', languages: ['English', 'Hindi', 'Punjabi'], bio: 'Fictional demo dental professional focused on preventive oral-health education.' },
  { name: 'Dr. Omar Khan', speciality: 'Physiotherapy', qualification: 'BPT, MPT (Musculoskeletal Physiotherapy)', years: 8, fee: 650, mode: 'Both', languages: ['English', 'Hindi', 'Urdu'], bio: 'Fictional demo physiotherapist focused on guided movement and functional recovery.' },
  { name: 'Dr. Isha Mallick', speciality: 'Oncology', qualification: 'MBBS, MD, DM (Medical Oncology)', years: 12, fee: 1250, mode: 'Both', languages: ['English', 'Bengali', 'Hindi'], bio: 'Fictional demo oncologist focused on clear information and coordinated supportive care.' },
  { name: 'Dr. Harish Rao', speciality: 'Rheumatology', qualification: 'MBBS, MD, DM (Rheumatology)', years: 10, fee: 1050, mode: 'Online', languages: ['English', 'Kannada', 'Hindi'], bio: 'Fictional demo rheumatologist supporting patients with joint and autoimmune health.' },
  { name: 'Dr. Kavita Das', speciality: 'Hematology', qualification: 'MBBS, MD (Pathology), DM (Hematology)', years: 11, fee: 1000, mode: 'Both', languages: ['English', 'Bengali', 'Hindi'], bio: 'Fictional demo hematologist providing approachable blood-health education.' },
  { name: 'Dr. Bilal Ansari', speciality: 'Infectious Disease', qualification: 'MBBS, MD (Internal Medicine), Fellowship in Infectious Disease', years: 9, fee: 900, mode: 'Online', languages: ['English', 'Hindi', 'Urdu'], bio: 'Fictional demo infectious-disease physician focused on prevention and clear guidance.' },
  { name: 'Dr. Rakesh Pillai', speciality: 'Cardiothoracic Surgery', qualification: 'MBBS, MS, MCh (Cardiothoracic Surgery)', years: 17, fee: 1400, mode: 'In-person', languages: ['English', 'Malayalam', 'Hindi'], bio: 'Fictional demo cardiothoracic surgeon focused on patient education and coordinated care.' },
  { name: 'Dr. Sanya Khurana', speciality: 'Neurosurgery', qualification: 'MBBS, MS, MCh (Neurosurgery)', years: 13, fee: 1350, mode: 'In-person', languages: ['English', 'Hindi', 'Punjabi'], bio: 'Fictional demo neurosurgeon committed to thoughtful explanations and follow-up.' },
  { name: 'Dr. Rhea D’Souza', speciality: 'Plastic Surgery', qualification: 'MBBS, MS, MCh (Plastic Surgery)', years: 8, fee: 1150, mode: 'In-person', languages: ['English', 'Konkani', 'Hindi'], bio: 'Fictional demo plastic surgeon focused on reconstructive-care education.' },
  { name: 'Dr. Manisha Shah', speciality: 'Nutrition and Dietetics', qualification: 'MSc Clinical Nutrition, RD', years: 7, fee: 550, mode: 'Online', languages: ['English', 'Hindi', 'Gujarati'], bio: 'Fictional demo nutrition professional sharing practical, balanced food guidance.' },
  { name: 'Dr. Eshan Roy', speciality: 'Radiology', qualification: 'MBBS, MD (Radiodiagnosis)', years: 10, fee: 800, mode: 'Both', languages: ['English', 'Bengali', 'Hindi'], bio: 'Fictional demo radiologist focused on explaining imaging and diagnostic workflows.' },
  { name: 'Dr. Devika Menon', speciality: 'Anesthesiology', qualification: 'MBBS, MD (Anesthesiology)', years: 12, fee: 850, mode: 'In-person', languages: ['English', 'Malayalam', 'Tamil'], bio: 'Fictional demo anesthesiologist focused on perioperative care information.' },
  { name: 'Dr. Aman Gill', speciality: 'Emergency Medicine', qualification: 'MBBS, MD (Emergency Medicine)', years: 9, fee: 700, mode: 'In-person', languages: ['English', 'Hindi', 'Punjabi'], bio: 'Fictional demo emergency-medicine physician focused on urgent-care education.' }
];

function nextMorning() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(4, 0, 0, 0);
  return date;
}

function ensureSpecialities(state) {
  const ids = new Map();
  for (const name of directorySpecialities) {
    const candidates = [name, ...(specialityAliases[name] || [])].map((candidate) => candidate.toLowerCase());
    const matches = state.specialisations.filter((item) => candidates.includes(item.name.trim().toLowerCase()));
    const canonical = matches.find((item) => item.name.trim().toLowerCase() === name.toLowerCase()) || matches[0];
    const target = canonical || { id: nextId(state.specialisations), name, description: 'Speciality in the fictional CarePoint demo directory' };
    target.name = name;
    if (!canonical) state.specialisations.push(target);
    for (const duplicate of matches) {
      if (Number(duplicate.id) === Number(target.id)) continue;
      state.doctors.forEach((doctor) => {
        if (Number(doctor.specialisation_id) === Number(duplicate.id)) doctor.specialisation_id = target.id;
      });
      state.specialisations.splice(state.specialisations.indexOf(duplicate), 1);
    }
    ids.set(name, target.id);
  }
  return ids;
}

export async function ensureDemoDirectory({ force = false } = {}) {
  if (process.env.NODE_ENV === 'production' || (!force && process.env.NODE_ENV !== 'development')) return;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  return updateData((state) => {
    const specialisationIds = ensureSpecialities(state);
    const firstMorning = nextMorning();
    let addedDoctors = 0;
    for (const [index, profile] of demoDoctors.entries()) {
      const sequence = String(index + 1).padStart(2, '0');
      const primaryEmail = index < 12 ? `demo.doctor.${sequence}@healthcare.local` : `demo.directory.${sequence}@healthcare.local`;
      const alternateEmail = index < 12 ? `demo.directory.${sequence}@healthcare.local` : `demo.doctor.${sequence}@healthcare.local`;
      const candidates = [primaryEmail, alternateEmail, `demo.directory.profile.${sequence}@healthcare.local`];
      let user = candidates
        .map((email) => state.users.find((entry) => entry.email === email))
        .find((entry) => entry?.role === 'doctor');
      if (!user) {
        const email = candidates.find((candidate) => !state.users.some((entry) => entry.email === candidate));
        if (!email) throw new Error(`Cannot safely create the fictional directory account for ${profile.name}: all reserved demo identities are in use.`);
        user = {
          id: nextId(state.users), name: profile.name, email, password_hash: passwordHash,
          role: 'doctor', is_active: true, created_at: new Date().toISOString()
        };
        state.users.push(user);
      }
      let doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(user.id));
      if (!doctor) {
        doctor = {
          id: nextId(state.doctors), user_id: user.id, specialisation_id: specialisationIds.get(profile.speciality),
          qualification: profile.qualification, experience_years: profile.years, fee: profile.fee,
          consultation_minutes: 30, consultation_mode: profile.mode, languages: profile.languages, bio: profile.bio
        };
        state.doctors.push(doctor);
        addedDoctors += 1;
      }
      if (!Array.isArray(doctor.languages) || !doctor.languages.length) doctor.languages = profile.languages;
      const hasFutureSlot = state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id) && new Date(slot.starts_at) > new Date());
      if (!hasFutureSlot) {
        for (let day = 0; day < 6; day += 1) {
          const start = new Date(firstMorning.getTime() + day * 86400000 + (index % 3) * 1800000);
          for (let timeIndex = 0; timeIndex < 3; timeIndex += 1) {
            const slotStart = new Date(start.getTime() + timeIndex * 3600000);
            const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
            const overlapping = state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id)
              && new Date(slot.starts_at) < slotEnd && new Date(slot.ends_at) > slotStart);
            if (!overlapping) {
              state.availability.push({
                id: nextId(state.availability), doctor_id: doctor.id,
                starts_at: slotStart.toISOString(), ends_at: slotEnd.toISOString()
              });
            }
          }
        }
      }
    }
    return { addedDoctors, specialities: state.specialisations.length };
  });
}
