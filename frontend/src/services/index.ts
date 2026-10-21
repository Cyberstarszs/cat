import apiClient, { API_BASE_URL } from './api';
import {
  User,
  LoginResponse,
  ExamCategory,
  Exam,
  ExamSession,
  SessionEnrollment,
  Question,
  StartAttemptResponse,
  AttemptDetail,
  ExamResult,
  ResultDetail,
  Certificate,
  VerifyCertificateResponse,
  Appeal,
  AuditLog,
  NotificationItem,
  StudentProfile,
  CandidateResponse,
  CandidateStudent,
  PaginatedResponse,
} from '../types';

// ==================== AUTH SERVICE ====================
export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('cat_token');
      localStorage.removeItem('cat_user');
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await apiClient.post('/me/password', {
          old_password: oldPassword,
          new_password: newPassword,
        });
        return;
      }
      throw err;
    }
  },

  async dismissPasswordChange(): Promise<void> {
    try {
      await apiClient.post('/auth/dismiss-password-change');
    } catch {
      // Abaikan error agar navigasi user tetap berjalan normal
    }
  },

  async getMe(): Promise<{ user: User; profile?: StudentProfile | null }> {
    const res = await apiClient.get('/me');
    return res.data;
  },

  async updateProfile(data: { full_name?: string; phone?: string; institution?: string }): Promise<StudentProfile> {
    const res = await apiClient.patch('/me/profile', data);
    return res.data.profile;
  },
};

// ==================== EXAMS & CATEGORIES SERVICE ====================
export const examService = {
  async getCategories(params?: { year?: number }): Promise<ExamCategory[]> {
    const query = params?.year ? `?year=${params.year}` : '';
    try {
      const res = await apiClient.get<{ data: ExamCategory[] }>(`/categories${query}`);
      return res.data.data;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.get<{ data: ExamCategory[] }>(`/question-categories${query}`);
        return res.data.data;
      }
      throw err;
    }
  },

  async createCategory(data: { name: string; code: string; description?: string }): Promise<ExamCategory> {
    try {
      const res = await apiClient.post<{ category: ExamCategory }>('/categories', data);
      return res.data.category;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.post<{ category: ExamCategory }>('/question-categories', data);
        return res.data.category;
      }
      throw err;
    }
  },

  async updateCategory(id: string, data: { name?: string; code?: string; description?: string }): Promise<ExamCategory> {
    try {
      const res = await apiClient.patch<{ category: ExamCategory }>(`/categories/${id}`, data);
      return res.data.category;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.patch<{ category: ExamCategory }>(`/question-categories/${id}`, data);
        return res.data.category;
      }
      throw err;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    try {
      await apiClient.delete(`/categories/${id}`);
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        await apiClient.delete(`/question-categories/${id}`);
        return;
      }
      throw err;
    }
  },

  async getExams(): Promise<Exam[]> {
    const res = await apiClient.get<{ data: Exam[] }>('/exams');
    return res.data.data;
  },

  async getExamById(id: string): Promise<Exam> {
    const res = await apiClient.get<{ exam: Exam }>(`/exams/${id}`);
    return res.data.exam;
  },

  async createExam(data: {
    title: string;
    code: string;
    description?: string;
    year?: number;
    passing_score: number;
    duration_minutes?: number;
    rules?: { category_id: string; question_count: number }[];
  }): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>('/exams', data);
    return res.data.exam;
  },

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam> {
    const res = await apiClient.patch<{ exam: Exam }>(`/exams/${id}`, data);
    return res.data.exam;
  },

  async deleteExam(id: string): Promise<void> {
    await apiClient.delete(`/exams/${id}`);
  },

  async copyExam(id: string): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>(`/exams/${id}/copy`);
    return res.data.exam;
  },

  async addRule(examId: string, categoryId: string, count: number): Promise<void> {
    await apiClient.post(`/exams/${examId}/rules`, {
      category_id: categoryId,
      question_count: count,
    });
  },

  async updateRule(examId: string, ruleId: string, count: number): Promise<void> {
    await apiClient.patch(`/exams/${examId}/rules/${ruleId}`, {
      question_count: count,
    });
  },

  async deleteRule(examId: string, ruleId: string): Promise<void> {
    await apiClient.delete(`/exams/${examId}/rules/${ruleId}`);
  },
};

// ==================== QUESTIONS SERVICE ====================
export const questionService = {
  async getQuestions(params?: { category_id?: string; search?: string; year?: number | string }): Promise<Question[]> {
    const res = await apiClient.get<{ data: Question[] }>('/questions', { params });
    return res.data.data;
  },

  async getQuestionYears(): Promise<number[]> {
    const res = await apiClient.get<{ data: number[] }>('/questions/years');
    return res.data.data;
  },

  async getQuestionYearsDetailed(): Promise<Array<{ year: number; total_count: number; active_count: number }>> {
    const res = await apiClient.get<{ data: number[]; details?: Array<{ year: number; total_count: number; active_count: number }> }>('/questions/years');
    if (res.data.details && res.data.details.length > 0) {
      return res.data.details;
    }
    return (res.data.data || []).map((y) => ({ year: y, total_count: 0, active_count: 0 }));
  },

  async getQuestionById(id: string): Promise<Question> {
    const res = await apiClient.get<{ question: Question }>(`/questions/${id}`);
    return res.data.question;
  },

  async createQuestion(data: {
    code: string;
    category_id: string;
    stem: string;
    weight: number;
    difficulty?: string;
    year?: number;
    options: { label: string; text: string; is_correct: boolean }[];
  }): Promise<Question> {
    const res = await apiClient.post<{ question: Question }>('/questions', data);
    return res.data.question;
  },

  async createNewVersion(
    questionId: string,
    data: {
      stem: string;
      weight: number;
      options: { label: string; text: string; is_correct: boolean }[];
    }
  ): Promise<void> {
    await apiClient.post(`/questions/${questionId}/versions`, data);
  },

  async updateQuestion(id: string, data: { status?: string; year?: number }): Promise<Question> {
    const res = await apiClient.patch<{ question: Question }>(`/questions/${id}`, data);
    return res.data.question;
  },

  async deleteQuestion(id: string): Promise<void> {
    await apiClient.delete(`/questions/${id}`);
  },

  async previewQuestion(questionId: string): Promise<any> {
    const res = await apiClient.get(`/questions/${questionId}/preview`);
    return res.data;
  },

  async previewImportQuestions(file: File): Promise<{
    success: boolean;
    filename: string;
    file_type: 'docx' | 'doc' | 'csv';
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    rows: any[];
    valid_payload: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/questions/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async commitImportQuestions(questions: any[], year?: number): Promise<{
    success: boolean;
    total_imported: number;
    imported_count: number;
  }> {
    const res = await apiClient.post('/questions/import/commit', { questions, items: questions, year });
    return res.data;
  },

  async previewImportCSV(file: File): Promise<any> {
    return this.previewImportQuestions(file);
  },

  async commitImportCSV(items: any[]): Promise<any> {
    return this.commitImportQuestions(items);
  },

  async previewCorrection(versionId: string, type: string, oldOptionId?: string, newOptionId?: string): Promise<any> {
    const res = await apiClient.post(`/question-versions/${versionId}/corrections/preview`, {
      type,
      old_option_id: oldOptionId,
      new_option_id: newOptionId,
    });
    return res.data.preview;
  },

  async applyCorrection(
    versionId: string,
    type: string,
    reason: string,
    oldOptionId?: string,
    newOptionId?: string
  ): Promise<any> {
    const res = await apiClient.post(`/question-versions/${versionId}/corrections`, {
      type,
      reason,
      old_option_id: oldOptionId,
      new_option_id: newOptionId,
    });
    return res.data;
  },
};

// ==================== SESSIONS SERVICE ====================
export const sessionService = {
  async getPublicSessions(): Promise<any[]> {
    const res = await apiClient.get<{ data: any[] }>('/sessions/public');
    return res.data.data;
  },

  async getSessions(): Promise<ExamSession[]> {
    const res = await apiClient.get<{ data: ExamSession[] }>('/sessions');
    return res.data.data;
  },

  async getMySessions(): Promise<any[]> {
    const res = await apiClient.get<{ data: any[] }>('/me/sessions');
    return res.data.data;
  },

  async getSessionById(id: string): Promise<ExamSession> {
    const res = await apiClient.get<{ session: ExamSession }>(`/sessions/${id}`);
    return res.data.session;
  },

  async createSession(data: {
    exam_id: string;
    code: string;
    name: string;
    starts_at: string;
    ends_at: string;
    capacity?: number | null;
    question_year?: number | null;
  }): Promise<ExamSession> {
    const res = await apiClient.post<{ session: ExamSession }>('/sessions', data);
    return res.data.session;
  },

  async updateSession(id: string, data: Partial<ExamSession>): Promise<ExamSession> {
    const res = await apiClient.patch<{ session: ExamSession }>(`/sessions/${id}`, data);
    return res.data.session;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/sessions/${id}`);
  },

  async cancelSession(id: string): Promise<any> {
    const res = await apiClient.post(`/sessions/${id}/cancel`);
    return res.data;
  },

  async unenrollStudent(sessionId: string, enrollmentId: string): Promise<any> {
    const res = await apiClient.delete(`/sessions/${sessionId}/enrollments/${enrollmentId}`);
    return res.data;
  },

  async getCandidates(sessionId: string): Promise<CandidateResponse> {
    const res = await apiClient.get<CandidateResponse>(`/sessions/${sessionId}/candidates`);
    return res.data;
  },

  async getEnrollments(sessionId: string): Promise<SessionEnrollment[]> {
    const res = await apiClient.get<{ data: SessionEnrollment[] }>(`/sessions/${sessionId}/enrollments`);
    return res.data.data;
  },

  async previewEnrollments(sessionId: string, studentIdentifiers: string[]): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/enrollments/preview`, {
      student_identifiers: studentIdentifiers,
    });
    return res.data;
  },

  async enrollStudents(sessionId: string, studentIdentifiers: string[]): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/enrollments`, {
      student_identifiers: studentIdentifiers,
    });
    return res.data;
  },

  async finalizeSession(sessionId: string): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/finalize`);
    return res.data;
  },

  async getSessionMonitor(sessionId: string): Promise<any> {
    const res = await apiClient.get(`/sessions/${sessionId}/monitor`);
    return res.data;
  },

  async generateAccessCode(sessionId: string, code?: string): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/access-code`, { access_code: code || null });
    return res.data;
  },

  async extendAllSession(sessionId: string, extraMinutes: number): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/extend-all`, { extra_minutes: extraMinutes });
    return res.data;
  },

  async exportSessionBapPDF(sessionId: string): Promise<Blob> {
    const res = await apiClient.get(`/sessions/${sessionId}/bap/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },
  async exportSessionCredentialsPDF(sessionId: string): Promise<Blob> {
    const res = await apiClient.get(`/sessions/${sessionId}/credentials/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

// ==================== ATTEMPTS & CAT EXAM SERVICE ====================
export const attemptService = {
  async startAttempt(sessionId: string, accessCode?: string): Promise<StartAttemptResponse> {
    const res = await apiClient.post<StartAttemptResponse>(`/sessions/${sessionId}/start-attempt`, {
      access_code: accessCode || undefined,
    });
    return res.data;
  },

  async getAttempt(attemptId: string): Promise<AttemptDetail> {
    const res = await apiClient.get<{ attempt: AttemptDetail }>(`/attempts/${attemptId}`);
    return res.data.attempt;
  },

  async autosaveAnswer(
    attemptId: string,
    data: {
      attempt_question_id: string;
      selected_option_id: string | null;
      is_flagged?: boolean;
      client_seq: number;
    }
  ): Promise<any> {
    const res = await apiClient.put(`/attempts/${attemptId}/answers`, data);
    return res.data;
  },

  async recordEvent(
    attemptId: string,
    eventType: 'blur' | 'focus' | 'tab_switch' | 'heartbeat',
    payload?: any
  ): Promise<void> {
    await apiClient.post(`/attempts/${attemptId}/events`, {
      event_type: eventType,
      payload,
    });
  },

  async finishAttempt(attemptId: string): Promise<{ result_id: string; score: number; passed: boolean }> {
    const res = await apiClient.post(`/attempts/${attemptId}/finish`);
    return res.data;
  },

  async voidAttempt(attemptId: string, reason: string): Promise<any> {
    const res = await apiClient.post(`/attempts/${attemptId}/void`, { reason });
    return res.data;
  },

  async extendAttempt(attemptId: string, extraMinutes: number, reason: string): Promise<any> {
    const res = await apiClient.post(`/attempts/${attemptId}/extend`, {
      extra_minutes: extraMinutes,
      reason,
    });
    return res.data;
  },

  async getAttemptEvents(attemptId: string): Promise<any[]> {
    const res = await apiClient.get<{ data: any[] }>(`/attempts/${attemptId}/events`);
    return res.data.data;
  },
  async getAttemptResult(attemptId: string): Promise<ExamResult> {
    const res = await apiClient.get<{ result: ExamResult }>(`/attempts/${attemptId}/result`);
    return res.data.result;
  },
};

// ==================== RESULTS, APPEALS & CERTIFICATES ====================
export const resultService = {
  async getResults(params?: { session_id?: string; search?: string }): Promise<ExamResult[]> {
    const res = await apiClient.get<{ data: ExamResult[] }>('/results', { params });
    return res.data.data;
  },

  async getMyResults(): Promise<ExamResult[]> {
    const res = await apiClient.get<{ data: ExamResult[] }>('/me/results');
    return res.data.data;
  },

  async getResultById(id: string): Promise<ResultDetail> {
    const res = await apiClient.get<{ result: ResultDetail }>(`/results/${id}`);
    return res.data.result;
  },

  async publishResult(id: string): Promise<void> {
    await apiClient.post(`/results/${id}/publish`);
  },

  async publishSessionResults(sessionId: string): Promise<void> {
    await apiClient.post(`/results/publish-session/${sessionId}`);
  },

  async submitAppeal(resultId: string, reason: string): Promise<Appeal> {
    const res = await apiClient.post<{ appeal: Appeal }>(`/results/${resultId}/appeals`, {
      reason,
      message: reason,
    });
    return res.data.appeal;
  },

  async getAppeals(): Promise<Appeal[]> {
    const res = await apiClient.get<{ data: Appeal[] }>('/appeals');
    return res.data.data;
  },

  async getMyAppeals(): Promise<Appeal[]> {
    const res = await apiClient.get<{ data: Appeal[] }>('/me/appeals');
    return res.data.data;
  },

  async resolveAppeal(appealId: string, status: 'approved' | 'rejected', notes: string): Promise<void> {
    const backendStatus = status === 'approved' ? 'accepted' : 'rejected';
    const noteText = notes.trim() || (status === 'approved' ? 'Sanggahan disetujui.' : 'Sanggahan ditolak.');
    await apiClient.patch(`/appeals/${appealId}`, {
      status: backendStatus,
      response: noteText,
      admin_notes: noteText,
    });
  },

  async getCertificate(id: string): Promise<Certificate> {
    const res = await apiClient.get<{ certificate: Certificate }>(`/certificates/${id}`);
    return res.data.certificate;
  },

  async downloadCertificatePDF(certificateId: string): Promise<Blob> {
    const res = await apiClient.get(`/certificates/${certificateId}/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async verifyCertificate(code: string): Promise<VerifyCertificateResponse> {
    const res = await apiClient.get<VerifyCertificateResponse>(`/verify/${code}`);
    return res.data;
  },
};

// ==================== USERS & STUDENTS SERVICE ====================
export const userService = {
  async getStudents(params?: {
    search?: string;
    role?: string;
    institution?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<StudentProfile>> {
    const res = await apiClient.get<PaginatedResponse<StudentProfile>>('/students', { params });
    return res.data;
  },

  async getInstitutions(): Promise<string[]> {
    const res = await apiClient.get<{ data: string[] }>('/students/institutions');
    return res.data.data;
  },

  async createStudent(data: {
    identifier?: string;
    full_name: string;
    email: string;
    institution?: string;
    phone?: string;
    role?: 'mahasiswa' | 'umum';
  }): Promise<{ student: StudentProfile; initial_password?: string }> {
    const res = await apiClient.post('/students', data);
    return res.data;
  },

  async importStudentsCSV(file: File): Promise<{
    success: boolean;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    imported_count: number;
    skipped_count: number;
    import_id: string;
    credentials_download_url: string;
    errors?: Array<{ rowNumber: number; identifier: string; name: string; email: string; errors: string[] }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async downloadImportCredentials(importId: string): Promise<Blob> {
    const res = await apiClient.get(`/students/import/${importId}/credentials`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async updateStudent(
    id: string,
    data: {
      full_name?: string;
      email?: string;
      institution?: string;
      phone?: string;
      status?: 'active' | 'suspended';
      role?: 'mahasiswa' | 'umum';
    }
  ): Promise<{ success: boolean; student: StudentProfile }> {
    const res = await apiClient.patch<{ success: boolean; student: StudentProfile }>(`/students/${id}`, data);
    return res.data;
  },

  async deleteStudent(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  async createAdmin(email: string): Promise<{ success: boolean; user: User; initial_password?: string }> {
    const res = await apiClient.post<{ success: boolean; user: User; initial_password?: string }>('/users', { email });
    return res.data;
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
  },

  async getUsers(params?: { search?: string; role?: string; status?: string }): Promise<User[]> {
    const res = await apiClient.get<{ data: User[] }>('/users', { params });
    return res.data.data;
  },

  async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
    await apiClient.patch(`/users/${userId}`, { status });
  },

  async resetPassword(userId: string): Promise<{ new_password: string; temp_password: string }> {
    const res = await apiClient.post<{
      success: boolean;
      temp_password?: string;
      new_password?: string;
      message?: string;
    }>(`/users/${userId}/reset-password`);
    const pass = res.data.new_password || res.data.temp_password || '';
    return { new_password: pass, temp_password: pass };
  },
};

// ==================== AUDIT & NOTIFICATIONS SERVICE ====================
export const auditService = {
  async getAuditLogs(params?: {
    action?: string;
    entity_type?: string;
    actor_id?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    const res = await apiClient.get<{ data: AuditLog[] }>('/audit-logs', { params });
    return res.data.data;
  },
};

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const res = await apiClient.get<{ data: NotificationItem[] }>('/me/notifications');
      return res.data.data;
    } catch {
      const res = await apiClient.get<{ data: NotificationItem[] }>('/notifications');
      return res.data.data;
    }
  },

  async markAsRead(id: string): Promise<void> {
    try {
      await apiClient.patch(`/me/notifications/${id}/read`);
    } catch {
      await apiClient.patch(`/notifications/${id}/read`);
    }
  },
};

// ==================== REPORTS SERVICE ====================
export const reportService = {
  async getExamReport(examId: string): Promise<any> {
    const res = await apiClient.get(`/reports/exams/${examId}`);
    return res.data;
  },

  async getExamItemAnalysis(examId: string): Promise<any> {
    const res = await apiClient.get(`/reports/exams/${examId}/item-analysis`);
    return res.data;
  },
  async exportSessionCSV(sessionId: string): Promise<Blob> {
    const res = await apiClient.get(`/reports/sessions/${sessionId}/export`, {
      responseType: 'blob',
    });
    return res.data;
  },
};


// ==================== INSTITUTION & SYSTEM SETTINGS ====================
export interface InstitutionSettings {
  faculty_name: string;
  university_name: string;
  decan_name: string;
  decan_nip: string;
  decan_title: string;
  cert_city: string;
  cert_validity_years: number;
  cert_no_prefix: string;
}

export const settingsService = {
  async getInstitutionSettings(): Promise<InstitutionSettings> {
    const res = await apiClient.get<{ settings: InstitutionSettings }>('/settings/institution');
    return res.data.settings;
  },

  async updateInstitutionSettings(data: Partial<InstitutionSettings>): Promise<InstitutionSettings> {
    const res = await apiClient.patch<{ settings: InstitutionSettings }>('/settings/institution', data);
    return res.data.settings;
  },
};

// ==================== UNIRA MAHASISWA SERVICE ====================
export * from './unira';
