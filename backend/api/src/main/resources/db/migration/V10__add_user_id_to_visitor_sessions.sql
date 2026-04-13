-- Add optional user_id to visitor_sessions to track logged-in vs anonymous visitors
ALTER TABLE visitor_sessions ADD COLUMN user_id UUID REFERENCES users(id);
