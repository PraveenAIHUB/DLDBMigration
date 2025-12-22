import { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function QuestionsManagement() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
  const [answerText, setAnswerText] = useState('');

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        asked_by:users!asked_by(name, email),
        answered_by:admin_users!answered_by(name),
        lot:lots(lot_number, name),
        car:cars(reg_no, make_model)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setQuestions(data);
    }
    setLoading(false);
  };

  const handleAnswer = async () => {
    if (!answerText.trim() || !selectedQuestion) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!adminData) return;

    const { error } = await supabase
      .from('questions')
      .update({
        answered: true,
        answer_text: answerText,
        answered_by: adminData.id,
        answered_at: new Date().toISOString(),
      })
      .eq('id', selectedQuestion.id);

    if (!error) {
      setSelectedQuestion(null);
      setAnswerText('');
      loadQuestions();
    }
  };

  const getUnansweredCount = () => {
    return questions.filter(q => !q.answered).length;
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600"></div>
        <p className="mt-4 text-slate-600">Loading questions...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Questions & Answers</h2>
              <p className="text-slate-600 mt-1">Manage bidder questions</p>
            </div>
            {getUnansweredCount() > 0 && (
              <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-semibold">
                {getUnansweredCount()} Unanswered
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Asked By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Question</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Lot/Car</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {questions.map((question) => (
                <tr key={question.id} className={`hover:bg-slate-50 transition-colors ${!question.answered ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-900">{question.asked_by?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{question.asked_by?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 max-w-md">
                    <div className="truncate">{question.question_text}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {question.lot ? (
                      <div>Lot: {question.lot.lot_number}</div>
                    ) : question.car ? (
                      <div>{question.car.make_model} - {question.car.reg_no}</div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                      question.answered
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {question.answered ? 'Answered' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(question.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dubai', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedQuestion(question)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View/Answer"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Question Details</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <p className="text-sm text-slate-600 mb-1">Asked By</p>
                <p className="font-medium text-slate-900">{selectedQuestion.asked_by?.name} ({selectedQuestion.asked_by?.email})</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Question</p>
                <p className="text-slate-900 bg-slate-50 p-4 rounded-lg">{selectedQuestion.question_text}</p>
              </div>
              {selectedQuestion.answered && selectedQuestion.answer_text && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Answer</p>
                  <p className="text-slate-900 bg-green-50 p-4 rounded-lg">{selectedQuestion.answer_text}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Answered by {selectedQuestion.answered_by?.name} on{' '}
                    {new Date(selectedQuestion.answered_at).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}
                  </p>
                </div>
              )}
              {!selectedQuestion.answered && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your Answer</label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    rows={4}
                    placeholder="Type your answer here..."
                  />
                  <button
                    onClick={handleAnswer}
                    disabled={!answerText.trim()}
                    className="mt-4 flex items-center gap-2 px-6 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Send Answer
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedQuestion(null);
                  setAnswerText('');
                }}
                className="w-full px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

