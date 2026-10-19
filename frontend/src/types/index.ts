// Centralized Type Definitions matching Backend API Contracts

export type UserRole = 'admin' | 'student';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  identifier: string; // NIM atau Nomor Peserta
  full_name: string;
  institution?: string;
  phone?: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    must_change_password: boolean;
    student_profile?: StudentProfile | null;
  };
  expires_at: string;
}

export interface ExamCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export type ExamStatus = 'draft' | 'active' | 'archived';

export interface ExamQuestionRule {
  id: string;
  exam_id: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  question_count: number;
}

export interface Exam {
  id: string;
  title: string;
  code: string;
  description?: string;
  passing_score: number;
  duration_minutes: number;
  status: ExamStatus;
  created_at: string;
  rules?: ExamQuestionRule[];
  total_questions?: number;
}

export type SessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface ExamSession {
  id: string;
  exam_id: string;
  code: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
  exam_title?: string;
  passing_score?: number;
  duration_minutes?: number;
  capacity?: number | null;
  question_year?: number | null;
  enrolled_count?: number;
  completed_count?: number;
  created_at: string;
}

export interface CandidateStudent {
  identifier: string;
  full_name: string;
  institution: string | null;
  email: string;
  status:
    | 'available'
    | 'already_enrolled'
    | 'enrolled_other_session'
    | 'schedule_overlap'
    | 'already_passed'
    | 'quota_exceeded'
    | 'suspended';
  status_reason: string;
  is_eligible: boolean;
  other_session_name?: string | null;
}

export interface CandidateResponse {
  session: {
    id: string;
    name: string;
    code: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    current_enrolled: number;
    remaining_slots: number;
  };
  candidates: CandidateStudent[];
  stats: {
    total_students: number;
    available_count: number;
    enrolled_this_session: number;
    enrolled_other_session: number;
    ineligible_count: number;
  };
}

export interface SessionEnrollment {
  id: string;
  session_id: string;
  student_id: string;
  enrolled_at: string;
  identifier?: string;
  full_name?: string;
  email?: string;
  institution?: string;
  attempt_status?: string;
  score?: number;
}

export interface QuestionOption {
  id: string;
  label: string; // 'A', 'B', 'C', 'D', 'E'
  text: string;
  is_correct?: boolean;
}

export interface QuestionVersion {
  id: string;
  question_id: string;
  version_number: number;
  stem: string;
  weight: number;
  created_at: string;
  options: QuestionOption[];
}

export interface Question {
  id: string;
  code?: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  difficulty?: string | number;
  current_version_id?: string;
  version_id?: string;
  version_number?: number;
  version_no?: number;
  stem?: string;
  weight?: number;
  year?: number;
  options?: QuestionOption[];
  created_at: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'timed_out' | 'void';

export interface AttemptQuestionItem {
  id: string; // attempt_question_id
  question_version_id: string;
  order_seq: number;
  stem: string;
  weight: number;
  category_name?: string;
  selected_option_id?: string | null;
  is_doubtful?: boolean; // Flag ragu-ragu
  options: {
    id: string;
    label: string;
    text: string;
  }[];
}

export interface StartAttemptResponse {
  attempt_id: string;
  token?: string;
  started_at: string;
  duration_minutes: number;
  time_remaining_seconds: number;
  questions: AttemptQuestionItem[];
}

export interface AttemptDetail {
  id: string;
  session_id: string;
  exam_title?: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at?: string;
  duration_minutes: number;
  time_remaining_seconds: number;
  questions: AttemptQuestionItem[];
}

export interface ExamResult {
  id: string;
  attempt_id: string;
  session_id: string;
  session_name: string;
  exam_title: string;
  identifier: string;
  student_name?: string;
  full_name?: string;
  email?: string;
  institution?: string;
  raw_score: number;
  max_score: number;
  score: number;
  passed: boolean;
  passing_score: number;
  status: 'draft' | 'published';
  published_at?: string;
  submitted_at?: string;
  created_at: string;
  certificate_id?: string;
  certificate_no?: string;
  has_appeal?: boolean;
  appeal_status?: 'pending' | 'approved' | 'rejected';
}

export interface ResultDetail extends ExamResult {
  breakdown?: {
    category_id: string;
    category_name: string;
    total_questions: number;
    correct_count: number;
    score: number;
  }[];
  questions_feedback?: {
    order_seq: number;
    stem: string;
    selected_option_label?: string;
    is_correct?: boolean;
    is_annulled?: boolean;
  }[];
}

export interface Certificate {
  id: string;
  result_id: string;
  certificate_no: string;
  verification_code: string;
  status: 'valid' | 'revoked';
  issued_at: string;
  revoked_at?: string;
  revoked_reason?: string;
  student_name?: string;
  full_name?: string;
  identifier: string;
  institution?: string;
  exam_title: string;
  score: number;
}

export interface VerifyCertificateResponse {
  is_valid: boolean;
  certificate_no: string;
  verification_code: string;
  status: 'valid' | 'revoked';
  issued_at: string;
  revoked_at?: string;
  revoked_reason?: string;
  recipient: {
    name: string;
    identifier: string;
    institution: string;
  };
  exam: {
    title: string;
    score: number;
    passed: boolean;
  };
}

export interface Appeal {
  id: string;
  result_id: string;
  student_id: string;
  student_name?: string;
  full_name?: string;
  identifier?: string;
  exam_title?: string;
  reason?: string;
  message?: string;
  status: 'pending' | 'open' | 'approved' | 'accepted' | 'rejected';
  admin_notes?: string;
  response?: string;
  resolved_at?: string;
  responded_at?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_email?: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  reason?: string;
  created_at: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
