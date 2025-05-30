import { default as bettersqlite3 } from 'better-sqlite3';
import { get } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Για να υπολογίσουμε __dirname σε ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Using better-sqlite3 module');

// Δημιουργία σύνδεσης με SQLite βάση δεδομένων
const db = new bettersqlite3(path.join(__dirname, '../data/sqlite-database.db'), { fileMustExist: true });

const postNewJob = (newJob) => {
   try {
      const postDate = new Date(Date.now()).toISOString().split('T')[0];
      const addNewJobStm = db.prepare(`
  INSERT INTO JOB 
  (title, description, location, type_id, user_id, status, work_style, company_id, postDate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
      const result = addNewJobStm.run(
         newJob.title,
         newJob.description,
         newJob.location,
         newJob.type_id,
         newJob.user_id,
         'open',
         newJob.work_style,
         newJob.company_id,
         postDate
      );

      return result;
   } catch (err) {
      throw err;
   }
};

const getUserByUsername = (username) => {
   try {
      const stmt = db.prepare('SELECT * FROM USER WHERE username = ?');
      return stmt.get(username);
   } catch (err) {
      throw err;
   }
}

export function getEmployerByUserId(user_id) {
   return db.prepare('SELECT * FROM EMPLOYER WHERE user_id = ?').get(user_id);
}

const createUser = (user) => {
   try {
      const addNewUserStm = db.prepare('INSERT INTO USER (firstName, lastName, username, email, password, location, phone) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const result = addNewUserStm.run(user.firstName, user.lastName, user.username, user.email, user.password, user.location, user.phone);
      return result;
   } catch (err) {
      throw err;
   }
};

function getPostedJobs(employerId, filters) {
   let sql = `
SELECT J.job_id, J.title, J.work_style, J.location, J.description, T.type_name, J.status, C.company_name, J.postDate
FROM JOB J
LEFT JOIN TYPE T ON T.type_id=J.type_id
JOIN COMPANY C ON C.company_id=J.company_id
WHERE J.user_id = ?
`;
   const params = [employerId];
   if (filters.title) {
      sql += ' AND J.title LIKE ?';
      params.push(`%${filters.title}%`);
   }

   if (filters.location) {
      sql += ' AND J.location LIKE ?';
      params.push(`%${filters.location}%`);
   }

   if (filters.type_id) {
      sql += ' AND J.type_id = ?';
      params.push(filters.type_id);
   }

   const stmt = db.prepare(sql);
   return stmt.all(...params);
}

function getJobTypes() {
   const stmt = db.prepare('SELECT type_id, type_name FROM TYPE');
   return stmt.all();
}

function getJobById(id) {
   const stmt = db.prepare('SELECT * FROM JOB WHERE job_id = ?');
   return stmt.get(id);
}

const updateJob = (jobId, updatedJob) => {
   try {
      const updateJobStm = db.prepare('UPDATE JOB SET title = ?, description = ?, location = ?, type_id = ?, work_style=?, status=? WHERE job_id = ?');
      const result = updateJobStm.run(updatedJob.title, updatedJob.description, updatedJob.location, updatedJob.type_id, updatedJob.work_style, updatedJob.status, jobId);
      return result;
   } catch (err) {
      throw err;
   }
};

const deleteJob = (jobId) => {
   try {
      const deleteJobStm = db.prepare('DELETE FROM JOB WHERE job_id = ?');
      const result = deleteJobStm.run(jobId);
      return result;
   } catch (err) {
      throw err;
   }
}

function getCompanyByName(name) {
   const stmt = db.prepare('SELECT * FROM COMPANY WHERE company_name = ?');
   return stmt.get(name);
}

function createCompany({ name, location, description }) {
   const stmt = db.prepare('INSERT INTO COMPANY (company_name, location, description) VALUES (?, ?, ?)');
   return stmt.run(name, location, description);
}

function createEmployer({ user_id, company_id }) {
   const stmt = db.prepare('INSERT INTO EMPLOYER (company_id, user_id) VALUES (?, ?)');
   return stmt.run(company_id, user_id);
}

function createJobSeeker({ user_id, cv }) {
   const stmt = db.prepare('INSERT INTO JOB_SEEKER (user_id, CV) VALUES (?, ?)');
   return stmt.run(user_id, cv);
}

function getUserRole(user_id) {
   const jobSeeker = db.prepare("SELECT * FROM JOB_SEEKER WHERE user_id = ?").get(user_id);
   if (jobSeeker) return 'job_seeker';

   const employer = db.prepare("SELECT * FROM EMPLOYER WHERE user_id = ?").get(user_id);
   if (employer) return 'employer';

   return null;
}

export function getJobLevels() {
   return db.prepare("SELECT DISTINCT level FROM TYPE").all().map(r => r.level);
}

export function getWorkStyles() {
   return db.prepare("SELECT DISTINCT work_style FROM JOB").all().map(r => r.work_style);
}

export function searchJobs({ title, location, type, level, workStyle }) {
   let query = `
    SELECT JOB.job_id, JOB.title, JOB.location, TYPE.type_name, TYPE.level, JOB.work_style, JOB.description, C.company_name
    FROM JOB
    LEFT JOIN TYPE ON JOB.type_id = TYPE.type_id
    JOIN COMPANY C ON C.company_id = JOB.company_id
    WHERE JOB.status = 'open'
  `;
   const params = [];

   if (title) {
      query += " AND JOB.title LIKE ?";
      params.push(`%${title}%`);
   }
   if (location) {
      query += " AND JOB.location LIKE ?";
      params.push(`%${location}%`);
   }
   if (type) {
      query += " AND TYPE.type_name = ?";
      params.push(type);
   }
   if (level) {
      query += " AND TYPE.level = ?";
      params.push(level);
   }
   if (workStyle) {
      query += " AND JOB.work_style = ?";
      params.push(workStyle);
   }

   return db.prepare(query).all(...params);
}

export function saveJob({ user_id, job_id }) {
   try {
      const requestDate = new Date(Date.now()).toISOString().split('T')[0];
      return db.prepare(
         `INSERT INTO saves (user_id, job_id, requestDate, status)
     VALUES (?, ?, ?, 'saved')`
      ).run(user_id, job_id, requestDate);
   }
   catch (err) {
      throw err;
   }

}


export function getSavedJobs(user_id) {
   return db.prepare(`
    SELECT 
      JOB.job_id, 
      JOB.title, 
      JOB.location, 
      TYPE.type_name, 
      TYPE.level, 
      JOB.work_style,
      saves.requestDate,
      JOB.description,
      C.company_name
    FROM saves
    JOIN JOB ON saves.job_id = JOB.job_id
    LEFT JOIN TYPE ON JOB.type_id = TYPE.type_id
    JOIN COMPANY C ON C.company_id = JOB.company_id
    WHERE saves.user_id = ?
  `).all(user_id);
}


export function removeSavedJob({ user_id, job_id }) {
   return db.prepare("DELETE FROM saves WHERE user_id = ? AND job_id = ?").run(user_id, job_id);
}


// Συνάρτηση: κλείσιμο της βάσης
function shutdown() {
   try {
      db.close();
      console.log('Έκλεισε η σύνδεση με την SQLite.');
   } catch (err) {
      throw err;
   }
}

export {
   postNewJob, getUserByUsername, createUser, getPostedJobs,
   getJobTypes, getJobById, updateJob, deleteJob, getCompanyByName, createCompany, createEmployer,
   createJobSeeker, getUserRole, shutdown
};
