-- Anonymous funnel counts per day, step and campaign label. No visitor identifiers, IPs or contact data.
CREATE TABLE funnel (day TEXT NOT NULL, step TEXT NOT NULL, source TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, step, source));
