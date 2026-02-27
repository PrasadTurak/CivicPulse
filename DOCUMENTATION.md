# CivicPulse – Smart Urban Grievance & Service Response System

## 1. User Flow & Screen List
- **Landing Screen**: Overview of the platform with two primary entry points: "Report an Issue" and "Track Progress".
- **Citizen Report Form**: 
  - Category selection (Garbage, Water, etc.)
  - Description input
  - Photo upload (simulated)
  - Location capture (auto-coordinates)
- **My Reports (Citizen Tracking)**:
  - List of submitted complaints
  - Real-time status timeline (Submitted -> In Progress -> Resolved)
- **Admin Dashboard**:
  - Global list of all complaints
  - Filtering by status
  - Detail view for assignment and status updates

## 2. Data Model (SQLite Schema)
```sql
CREATE TABLE complaints (
  id TEXT PRIMARY KEY,          -- Format: CMP-XXXX
  category TEXT,                -- Garbage, Water, Road, Streetlight, Sanitation
  description TEXT,             -- User input
  photoUrl TEXT,                -- URL to evidence
  latitude REAL,                -- Geolocation
  longitude REAL,               -- Geolocation
  priority TEXT,                -- Auto-assigned: Low, Medium, High
  status TEXT,                  -- Submitted, In Progress, Resolved
  workerName TEXT,              -- Assigned personnel
  createdAt DATETIME            -- Timestamp
);
```

## 3. API Endpoints
- `POST /api/complaints`: Creates a new grievance. Triggers the auto-priority logic.
- `GET /api/complaints`: Returns all complaints sorted by date.
- `PATCH /api/complaints/:id`: Updates status or assigns a worker.

## 4. Auto-Priority Logic (Rule-Based)
- **High Priority**:
  - Water + ("leak", "burst", "overflow")
  - Road + ("accident", "pothole", "big")
  - Garbage + ("overflow", "too much")
- **Low Priority**:
  - Description contains ("minor", "small", "request", "info")
- **Default**: Medium

## 5. Sample JSON Objects
**Complaint Creation Request:**
```json
{
  "category": "Water",
  "description": "Major pipe burst on Main St, water flooding the road.",
  "photoUrl": "https://example.com/photo.jpg",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Complaint Update Request:**
```json
{
  "status": "In Progress",
  "workerName": "John Doe"
}
```

## 6. Demo Script (90 Seconds)
1. **Introduction (0-15s)**: "Hi, we are CivicConnect. We've built a smart bridge between citizens and city administration to solve urban issues faster."
2. **Citizen Reporting (15-45s)**: "Imagine I see a major water leak. I open CivicConnect, select 'Water', describe the 'burst pipe', and submit. Notice how the system automatically flagged this as 'High Priority' because of the keywords, ensuring it doesn't get buried."
3. **Tracking (45-60s)**: "As a citizen, I can track my report's timeline. No more calling helpdesks; I see exactly when a worker is assigned."
4. **Admin Management (60-80s)**: "On the admin side, the department sees the high-priority alert immediately. They assign a worker, update the status to 'In Progress', and eventually 'Resolved'."
5. **Conclusion (80-90s)**: "CivicConnect brings transparency and data-driven prioritization to urban governance. Thank you."

## 7. Authorized Access
- **Admin Login**:
  - Email: `admin@civicpulse.org`
  - Password: `admin123`
- **Citizen Access**:
  - Citizens can sign up with their own email and password.
  - Only registered citizens can report issues.
