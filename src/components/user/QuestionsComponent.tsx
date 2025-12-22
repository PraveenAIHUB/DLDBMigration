import { useState, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface QuestionsComponentProps {
  lotId?: string;
  carId?: string;
}

export function QuestionsComponent({ lotId, carId }: QuestionsComponentProps) {
  const [question, setQuestion] = useState('');
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadMyQuestions();
    }
  }, [user, lotId, carId]);

  const loadMyQuestions = async () => {
    if (!user) return;

    let query = supabase
      .from('questions')
      .select('*, lot:lots(lot_number), car:cars(reg_no, make_model)')
      .eq('asked_by', user.id)
      .order('created_at', { ascending: false });

    if (lotId) {
      query = query.eq('lot_id', lotId);
    }
    if (carId) {
      query = query.eq('car_id', carId);
    }

    const { data } = await query;
    if (data) {
      setMyQuestions(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !user) return;

    setLoading(true);
    const { error } = await supabase
      .from('questions')
      .insert({
        lot_id: lotId || null,
        car_id: carId || null,
        asked_by: user.id,
        question_text: question,
        answered: false,
      });

    if (!error) {
      setQuestion('');
      loadMyQuestions();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Ask a Question
      </h3>

      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-dl-red focus:border-transparent"
          rows={3}
          placeholder="Type your question here..."
          required
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Sending...' : 'Send Question'}
        </button>
      </form>

      {myQuestions.length > 0 && (
        <div>
          <h4 className="font-medium text-slate-900 mb-2">Your Questions</h4>
          <div className="space-y-3">
            {myQuestions.map((q) => (
              <div key={q.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-sm text-slate-900 mb-2">{q.question_text}</p>
                {q.answered && q.answer_text ? (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Answer:</p>
                    <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{q.answer_text}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-2">Waiting for response...</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

